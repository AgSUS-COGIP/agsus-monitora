import { afterEach, describe, expect, it } from "vitest";
import {
  VALIDADE_DA_COPIA_MS,
  assinaturaDoAcesso,
  consultasDosDados,
  copiaServe,
  dadosDasRespostas,
  montarCopia,
  partesQueMudaram,
  respostasDasConsultas,
} from "../src/lib/copia-da-sessao.js";
import {
  apagarCopiaDaSessao,
  guardarCopiaDaSessao,
  lerCopiaDaSessao,
} from "../src/modules/copia-da-sessao-indexeddb.js";

const ok = (data) => ({ data, error: null });
const falha = { data: null, error: { message: "401" } };

const RESPOSTAS = {
  config: ok([{ chave: "app_title", valor: "Monitora" }]),
  paineis: ok([{ id: 1, codigo: "bi" }]),
  mapa: ok([{ chave: "lmap", payload: { dsei: [] } }]),
  unidades: ok([{ id_unidade: 7, nome_oficial: "DSEI Yanomami" }]),
  abas: ok([{ co_aba: "editais", no_aba: "Editais", co_view: "nucleo" }]),
  monitoramento: ok([{ id: 10, edital: "01/2026" }]),
};

const PERFIL = {
  id: "p1",
  perfil: "gestor",
  permissoes: { dashboard: 1, nucleo: 2 },
  areas: ["saude-indigena"],
  atualizado_em: "2026-09-28T10:00:00Z",
  ultimo_acesso: "2026-09-28T10:00:00Z",
};

describe("assinatura do acesso", () => {
  it("não muda com datas nem com a ordem de chaves e painéis", () => {
    const outraHora = {
      ultimo_acesso: "2026-09-29T08:00:00Z",
      areas: ["saude-indigena"],
      permissoes: { nucleo: 2, dashboard: 1 },
      perfil: "gestor",
      id: "p1",
      atualizado_em: "2026-09-29T08:00:00Z",
    };
    expect(assinaturaDoAcesso(outraHora, new Set(["b", "a"]))).toBe(
      assinaturaDoAcesso(PERFIL, ["a", "b"]),
    );
  });

  it.each([
    ["permissão", { permissoes: { dashboard: 1, nucleo: 1 } }],
    ["área", { areas: ["outra"] }],
    ["perfil", { perfil: "leitor" }],
    ["campo novo", { unidades_permitidas: [3] }],
  ])("muda quando muda %s", (_, mudanca) => {
    expect(assinaturaDoAcesso({ ...PERFIL, ...mudanca }, [])).not.toBe(
      assinaturaDoAcesso(PERFIL, []),
    );
  });

  it("muda quando muda um painel liberado", () => {
    expect(assinaturaDoAcesso(PERFIL, ["a"])).not.toBe(
      assinaturaDoAcesso(PERFIL, ["a", "b"]),
    );
  });
});

describe("dados das respostas", () => {
  it("guarda os dados de cada parte", () => {
    expect(dadosDasRespostas(RESPOSTAS)).toEqual({
      config: [{ chave: "app_title", valor: "Monitora" }],
      paineis: [{ id: 1, codigo: "bi" }],
      mapa: [{ chave: "lmap", payload: { dsei: [] } }],
      unidades: [{ id_unidade: 7, nome_oficial: "DSEI Yanomami" }],
      abas: [{ co_aba: "editais", no_aba: "Editais", co_view: "nucleo" }],
      // Só as linhas: o payload consolidado da RPC não era lido por ninguém.
      monitoramento: { linhas: [{ id: 10, edital: "01/2026" }] },
    });
  });

  it.each(["config", "paineis", "mapa", "unidades"])(
    "nenhuma cópia se %s falhou",
    (parte) => {
      expect(dadosDasRespostas({ ...RESPOSTAS, [parte]: falha })).toBeNull();
    },
  );

  /*
    O catálogo de abas tem reserva no código (o mesmo menu): falhar, ou a função
    ainda não existir no banco, não joga a cópia fora.
  */
  it("o catálogo de abas que falhou fica nulo, e a cópia continua", () => {
    const dados = dadosDasRespostas({ ...RESPOSTAS, abas: falha });
    expect(dados).not.toBeNull();
    expect(dados.abas).toBeNull();
    const semAbas = { ...RESPOSTAS };
    delete semAbas.abas;
    expect(dadosDasRespostas(semAbas).abas).toBeNull();
  });

  it("cópia antiga, sem o catálogo de abas, volta com as abas vazias", async () => {
    const antiga = dadosDasRespostas(RESPOSTAS);
    delete antiga.abas;
    const { abas } = await respostasDasConsultas(consultasDosDados(antiga));
    expect(abas).toEqual(ok(null));
  });

  it("nenhuma cópia se a tabela do monitoramento falhou", () => {
    expect(
      dadosDasRespostas({ ...RESPOSTAS, monitoramento: falha }),
    ).toBeNull();
  });

  it("sem permissão de monitoramento, a parte fica vazia", () => {
    expect(
      dadosDasRespostas({ ...RESPOSTAS, monitoramento: null }).monitoramento,
    ).toBeNull();
  });

  it("a cópia volta no formato das consultas", async () => {
    const dados = dadosDasRespostas(RESPOSTAS);
    const respostas = await respostasDasConsultas(consultasDosDados(dados));
    expect(respostas).toEqual(RESPOSTAS);
  });
});

describe("quando a cópia serve", () => {
  const sessao = { usuarioId: "u1", acesso: "a1", versao: "v1" };
  const agora = Date.UTC(2026, 8, 28);
  const copia = montarCopia({
    ...sessao,
    agora,
    dados: dadosDasRespostas(RESPOSTAS),
  });

  it("serve para o mesmo usuário, acesso e versão", () => {
    expect(copiaServe(copia, { ...sessao, agora: agora + 1000 })).toBe(true);
  });

  it.each([
    ["outro usuário", { usuarioId: "u2" }],
    ["acesso diferente", { acesso: "a2" }],
    ["outra versão publicada", { versao: "v2" }],
    ["vencida", { agora: agora + VALIDADE_DA_COPIA_MS + 1 }],
    ["guardada no futuro", { agora: agora - 1 }],
    ["sem usuário", { usuarioId: "" }],
  ])("não serve: %s", (_, mudanca) => {
    expect(copiaServe(copia, { ...sessao, agora, ...mudanca })).toBe(false);
  });

  it("não serve sem cópia ou sem dados", () => {
    expect(copiaServe(null, { ...sessao, agora })).toBe(false);
    expect(copiaServe({ ...copia, dados: null }, { ...sessao, agora })).toBe(
      false,
    );
  });
});

describe("o que mudou desde a cópia", () => {
  const anteriores = dadosDasRespostas(RESPOSTAS);

  it("nada, quando as respostas são as mesmas", () => {
    expect(partesQueMudaram(anteriores, structuredClone(anteriores)).size).toBe(
      0,
    );
  });

  it("só a parte alterada", () => {
    const atuais = structuredClone(anteriores);
    atuais.monitoramento.linhas[0].edital = "02/2026";
    expect([...partesQueMudaram(anteriores, atuais)]).toEqual([
      "monitoramento",
    ]);
  });

  it("o catálogo de abas conta como parte", () => {
    const atuais = structuredClone(anteriores);
    atuais.abas = null;
    expect([...partesQueMudaram(anteriores, atuais)]).toEqual(["abas"]);
  });
});

/** IndexedDB mínimo: o jsdom não tem um. Chamadas assíncronas, como no navegador. */
function indexedDBFalso() {
  const lojas = new Map();
  const depois = (fn) => setTimeout(fn, 0);
  return {
    open() {
      const pedido = {};
      depois(() => {
        const banco = {
          createObjectStore: (nome) => lojas.set(nome, new Map()),
          transaction(nome) {
            const transacao = {};
            const loja = lojas.get(nome);
            const operar = (fazer) => {
              const op = {};
              depois(() => {
                op.result = fazer();
                depois(() => transacao.oncomplete?.());
              });
              return op;
            };
            transacao.objectStore = () => ({
              get: (chave) => operar(() => structuredClone(loja.get(chave))),
              put: (valor, chave) =>
                operar(() => loja.set(chave, structuredClone(valor)) && chave),
              delete: (chave) => operar(() => loja.delete(chave) && undefined),
            });
            return transacao;
          },
          close() {},
        };
        pedido.result = banco;
        if (!lojas.size) pedido.onupgradeneeded?.();
        pedido.onsuccess?.();
      });
      return pedido;
    },
  };
}

describe("armazenamento da cópia", () => {
  const original = globalThis.indexedDB;
  afterEach(() => {
    globalThis.indexedDB = original;
  });

  it("guarda, lê e apaga", async () => {
    globalThis.indexedDB = indexedDBFalso();
    const copia = { usuarioId: "u1", dados: { config: [] } };
    expect(await lerCopiaDaSessao()).toBeNull();
    expect(await guardarCopiaDaSessao(copia)).toBe(true);
    expect(await lerCopiaDaSessao()).toEqual(copia);
    await apagarCopiaDaSessao();
    expect(await lerCopiaDaSessao()).toBeNull();
  });

  it("sem IndexedDB, não há cópia e nada lança erro", async () => {
    globalThis.indexedDB = undefined;
    expect(await lerCopiaDaSessao()).toBeNull();
    expect(await guardarCopiaDaSessao({ usuarioId: "u1" })).toBe(false);
    await expect(apagarCopiaDaSessao()).resolves.toBeUndefined();
  });
});
