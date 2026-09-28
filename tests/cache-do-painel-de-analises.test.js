import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAVE_DO_DONO,
  ESQUEMA_DO_PAYLOAD,
  VALIDADE_DO_CACHE_MS,
  chavesDoCacheAntigo,
  criarCacheDoPainel,
  payloadMudou,
  revalidarPayload,
} from "../src/lib/cache-do-painel-de-analises.js";
import {
  apagarCacheDasAnalises,
  armazenamentoDasAnalises,
} from "../src/modules/cache-das-analises-indexeddb.js";
import { indexedDBFalso } from "./indexeddb-falso.js";

const payload = (geradoEm, total = 2) => ({
  schema_version: ESQUEMA_DO_PAYLOAD,
  columns: ["id", "candidato"],
  rows: Array.from({ length: total }, (_, i) => [`id${i}`, `Pessoa ${i}`]),
  editais: [],
  total,
  generated_at: geradoEm,
  cache: { hit: true, refreshed_at: geradoEm },
});

/** Armazenamento em memória com a interface que o IndexedDB entrega. */
function armazenamentoEmMemoria() {
  const dados = new Map();
  return {
    dados,
    ler: async (chave) => structuredClone(dados.get(chave) ?? null),
    guardar: async (chave, valor) => {
      dados.set(chave, structuredClone(valor));
    },
    apagarTudo: async () => dados.clear(),
  };
}

const armazenamentoQueFalha = {
  ler: async () => {
    throw new Error("QuotaExceeded");
  },
  guardar: async () => {
    throw new Error("QuotaExceeded");
  },
  apagarTudo: async () => {
    throw new Error("bloqueado");
  },
};

const U1 = { usuarioId: "u1", area: "saude-indigena", escopo: "ativo" };

describe("cópia do painel de análises no navegador", () => {
  it("guarda e devolve o payload do mesmo usuário, área e escopo", async () => {
    const cache = criarCacheDoPainel({
      armazenamento: armazenamentoEmMemoria(),
      versao: "v1",
    });
    expect(await cache.ler(U1)).toBeNull();
    expect(await cache.guardar(U1, payload("10:00"))).toBe(true);
    expect(await cache.ler(U1)).toEqual(payload("10:00"));
  });

  it("áreas e escopos nunca se misturam", async () => {
    const cache = criarCacheDoPainel({
      armazenamento: armazenamentoEmMemoria(),
      versao: "v1",
    });
    await cache.guardar(U1, payload("10:00"));
    expect(await cache.ler({ ...U1, area: "projetos" })).toBeNull();
    expect(await cache.ler({ ...U1, escopo: "todos" })).toBeNull();
  });

  it("outro usuário não vê a cópia e ela é apagada", async () => {
    const armazenamento = armazenamentoEmMemoria();
    const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
    await cache.guardar(U1, payload("10:00"));
    await cache.guardar({ ...U1, area: "projetos" }, payload("10:00"));

    expect(await cache.ler({ ...U1, usuarioId: "u2" })).toBeNull();
    expect(armazenamento.dados.size).toBe(0);
    expect(await cache.ler(U1)).toBeNull();
  });

  it("sem usuário, nada é lido nem guardado", async () => {
    const armazenamento = armazenamentoEmMemoria();
    const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
    expect(await cache.guardar({ ...U1, usuarioId: "" }, payload("1"))).toBe(
      false,
    );
    expect(armazenamento.dados.size).toBe(0);
    expect(await cache.ler({ ...U1, usuarioId: "" })).toBeNull();
  });

  it("publicação nova do painel invalida a cópia", async () => {
    const armazenamento = armazenamentoEmMemoria();
    await criarCacheDoPainel({ armazenamento, versao: "v1" }).guardar(
      U1,
      payload("10:00"),
    );
    const depoisDoDeploy = criarCacheDoPainel({ armazenamento, versao: "v2" });
    expect(await depoisDoDeploy.ler(U1)).toBeNull();
  });

  it("payload de outro schema_version não é guardado", async () => {
    const armazenamento = armazenamentoEmMemoria();
    const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
    expect(
      await cache.guardar(U1, { ...payload("1"), schema_version: 2 }),
    ).toBe(false);
    expect(armazenamento.dados.has(CHAVE_DO_DONO)).toBe(false);
  });

  it("cópia vencida não serve", async () => {
    let agora = 1_000;
    const armazenamento = armazenamentoEmMemoria();
    const cache = criarCacheDoPainel({
      armazenamento,
      versao: "v1",
      relogio: () => agora,
    });
    await cache.guardar(U1, payload("10:00"));
    agora += VALIDADE_DO_CACHE_MS;
    expect(await cache.ler(U1)).not.toBeNull();
    agora += 1;
    expect(await cache.ler(U1)).toBeNull();
  });

  it("registro corrompido vira 'não há cópia'", async () => {
    const armazenamento = armazenamentoEmMemoria();
    const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
    await cache.guardar(U1, payload("10:00"));
    const chave = [...armazenamento.dados.keys()].find(
      (k) => k !== CHAVE_DO_DONO,
    );
    armazenamento.dados.get(chave).texto = "{quebrado";
    expect(await cache.ler(U1)).toBeNull();
  });

  it("armazenamento cheio ou bloqueado nunca lança erro", async () => {
    const cache = criarCacheDoPainel({
      armazenamento: armazenamentoQueFalha,
      versao: "v1",
    });
    await expect(cache.ler(U1)).resolves.toBeNull();
    await expect(cache.guardar(U1, payload("1"))).resolves.toBe(false);
    await expect(cache.apagarTudo()).resolves.toBeUndefined();
  });
});

describe("quando redesenhar", () => {
  it("só quando o servidor montou outro payload", () => {
    expect(payloadMudou(payload("10:00"), payload("10:00"))).toBe(false);
    expect(payloadMudou(payload("10:00"), payload("10:30"))).toBe(true);
    expect(payloadMudou(payload("10:00", 2), payload("10:00", 3))).toBe(true);
    expect(payloadMudou(payload(""), payload(""))).toBe(true);
    expect(payloadMudou(null, payload("10:00"))).toBe(true);
  });
});

describe("revalidação por trás da cópia", () => {
  const base = () => ({
    guardar: vi.fn(async () => true),
    aoMudar: vi.fn(),
    aoPerderAcesso: vi.fn(),
    apagarTudo: vi.fn(async () => {}),
  });

  it("dados iguais: guarda e não redesenha", async () => {
    const f = base();
    await revalidarPayload({
      ...f,
      guardado: payload("10:00"),
      buscar: async () => payload("10:00"),
    });
    expect(f.guardar).toHaveBeenCalledOnce();
    expect(f.aoMudar).not.toHaveBeenCalled();
  });

  it("dados novos: guarda e redesenha com eles", async () => {
    const f = base();
    const novo = payload("10:30", 3);
    await revalidarPayload({
      ...f,
      guardado: payload("10:00"),
      buscar: async () => novo,
    });
    expect(f.guardar).toHaveBeenCalledWith(novo);
    expect(f.aoMudar).toHaveBeenCalledWith(novo);
  });

  it("acesso revogado (42501) ou área inválida (22023) apaga as cópias", async () => {
    for (const code of ["42501", "22023"]) {
      const f = base();
      await revalidarPayload({
        ...f,
        guardado: payload("10:00"),
        buscar: async () => {
          throw Object.assign(new Error("sem acesso"), { code });
        },
      });
      expect(f.apagarTudo).toHaveBeenCalledOnce();
      expect(f.aoPerderAcesso).toHaveBeenCalledOnce();
      expect(f.aoMudar).not.toHaveBeenCalled();
    }
  });

  it("falha de rede mantém a cópia na tela", async () => {
    const f = base();
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await revalidarPayload({
      ...f,
      guardado: payload("10:00"),
      buscar: async () => {
        throw new Error("Failed to fetch");
      },
    });
    expect(f.apagarTudo).not.toHaveBeenCalled();
    expect(f.aoPerderAcesso).not.toHaveBeenCalled();
    expect(f.aoMudar).not.toHaveBeenCalled();
    aviso.mockRestore();
  });
});

describe("cache antigo no localStorage", () => {
  it("todas as chaves agsus_analises_cache_* e o marcador saem; o resto fica", () => {
    expect(
      chavesDoCacheAntigo([
        "agsus_analises_cache_v1_v5_u1_ativo",
        "agsus_analises_cache_v1_v4_u1_projetos_todos",
        "agsus_analises_responsavel_normalizado_v1",
        "agsus_analises_theme_v3",
        "sb-auth-token",
        null,
      ]),
    ).toEqual([
      "agsus_analises_cache_v1_v5_u1_ativo",
      "agsus_analises_cache_v1_v4_u1_projetos_todos",
      "agsus_analises_responsavel_normalizado_v1",
    ]);
  });
});

describe("armazenamento no IndexedDB", () => {
  const original = globalThis.indexedDB;
  afterEach(() => {
    globalThis.indexedDB = original;
  });

  it("o painel guarda e lê pelo IndexedDB; o MONITORA apaga o banco inteiro", async () => {
    const falso = indexedDBFalso();
    globalThis.indexedDB = falso;
    const cache = criarCacheDoPainel({
      armazenamento: armazenamentoDasAnalises,
      versao: "v1",
    });
    expect(await cache.guardar(U1, payload("10:00"))).toBe(true);
    expect(await cache.ler(U1)).toEqual(payload("10:00"));
    expect(falso.bancos.has("agsus-monitora-analises")).toBe(true);

    await apagarCacheDasAnalises();
    expect(falso.bancos.has("agsus-monitora-analises")).toBe(false);
    expect(await cache.ler(U1)).toBeNull();
  });

  it("sem IndexedDB (janela anônima, bloqueado), o painel segue pela rede", async () => {
    globalThis.indexedDB = undefined;
    const cache = criarCacheDoPainel({
      armazenamento: armazenamentoDasAnalises,
      versao: "v1",
    });
    await expect(cache.guardar(U1, payload("1"))).resolves.toBe(false);
    await expect(cache.ler(U1)).resolves.toBeNull();
    await expect(apagarCacheDasAnalises()).resolves.toBeUndefined();
  });
});
