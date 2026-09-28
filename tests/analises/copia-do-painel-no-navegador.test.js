import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  carregarPayloadDoPainel,
  limparCacheAntigoDoLocalStorage,
} from "../../src/analises/analises-consolidated-transport.js";
import { indexedDBFalso } from "../indexeddb-falso.js";

/*
  A carga do painel com a cópia no IndexedDB: a segunda abertura mostra a
  cópia sem esperar a RPC e só chama `aoMudar` se o servidor mandou outro
  payload. Substitui o cache do localStorage do analises-app.js e o cache em
  memória que o transporte tinha.
*/

const payload = (geradoEm, nomes) => ({
  schema_version: 3,
  columns: ["id", "candidato", "responsavel_analise"],
  rows: nomes.map((nome, i) => [`id${i}`, nome, i === 0 ? "Ana" : null]),
  editais: [],
  total: nomes.length,
  generated_at: geradoEm,
  cache: { hit: true, refreshed_at: geradoEm },
});

const resposta = (dados) => async () => ({ data: dados, error: null });

function adiada() {
  let resolver;
  const promessa = new Promise((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

const esperarGravacao = () => new Promise((r) => setTimeout(r, 50));
const nomes = (resultado) => resultado.linhas.map((l) => l.candidato);

async function abrir(rpc, extra = {}) {
  const aoMudar = vi.fn();
  const aoPerderAcesso = vi.fn();
  const resultado = await carregarPayloadDoPainel(
    { rpc },
    { escopo: "ativo", usuarioId: "u1", aoMudar, aoPerderAcesso, ...extra },
  );
  return { resultado, aoMudar, aoPerderAcesso };
}

describe("cópia do painel no navegador", () => {
  const original = globalThis.indexedDB;

  beforeEach(() => {
    globalThis.indexedDB = indexedDBFalso();
  });
  afterEach(() => {
    globalThis.indexedDB = original;
    localStorage.clear();
  });

  it("a primeira abertura espera a RPC; a segunda mostra a cópia na hora e redesenha quando chega outro payload", async () => {
    const primeira = await abrir(resposta(payload("10:00", ["Maria"])));
    expect(primeira.resultado.daCopia).toBe(false);
    expect(nomes(primeira.resultado)).toEqual(["Maria"]);

    const servidor = adiada();
    const rpc = vi.fn(() => servidor.promessa);
    await esperarGravacao();

    // A RPC ainda não respondeu e a carga já tem as linhas da cópia.
    const segunda = await abrir(rpc);
    expect(segunda.resultado.daCopia).toBe(true);
    expect(nomes(segunda.resultado)).toEqual(["Maria"]);
    expect(rpc).toHaveBeenCalledOnce();
    expect(segunda.aoMudar).not.toHaveBeenCalled();

    servidor.resolver({
      data: payload("10:30", ["Maria", "João"]),
      error: null,
    });
    await vi.waitFor(() => expect(segunda.aoMudar).toHaveBeenCalledOnce());
    const novo = segunda.aoMudar.mock.calls[0][0];
    expect(novo.payload.generated_at).toBe("10:30");
    expect(nomes(novo)).toEqual(["Maria", "João"]);
    // Linha sem responsável sai normalizada, como antes.
    expect(novo.linhas[1].responsavel_analise).toBe("Sem responsável");
  });

  it("payload igual ao da cópia não redesenha", async () => {
    const rpc = vi.fn(resposta(payload("10:00", ["Maria"])));
    await abrir(rpc);
    let segunda;
    await vi.waitFor(async () => {
      segunda = await abrir(rpc);
      expect(segunda.resultado.daCopia).toBe(true);
    });
    await esperarGravacao();
    expect(segunda.aoMudar).not.toHaveBeenCalled();
  });

  it("outro usuário no mesmo navegador não vê a cópia de quem veio antes", async () => {
    await abrir(resposta(payload("10:00", ["Maria"])));
    await esperarGravacao();
    const { resultado } = await abrir(resposta(payload("11:00", ["Pedro"])), {
      usuarioId: "u2",
    });
    expect(resultado.daCopia).toBe(false);
    expect(nomes(resultado)).toEqual(["Pedro"]);
  });

  it("acesso revogado apaga a cópia e avisa o painel", async () => {
    await abrir(resposta(payload("10:00", ["Maria"])));
    const semAcesso = async () => ({
      data: null,
      error: { code: "42501", message: "Sem permissão" },
    });
    let aberto;
    await vi.waitFor(async () => {
      aberto = await abrir(semAcesso);
      expect(aberto.resultado.daCopia).toBe(true);
    });
    await vi.waitFor(() => expect(aberto.aoPerderAcesso).toHaveBeenCalled());
    // Sem cópia agora: o erro de permissão chega a quem abrir.
    await vi.waitFor(async () => {
      await expect(abrir(semAcesso)).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("Atualizar (forcarRede) vai ao servidor sem passar pela cópia", async () => {
    await abrir(resposta(payload("10:00", ["Maria"])));
    await esperarGravacao();
    const { resultado } = await abrir(
      resposta(payload("10:30", ["Maria", "João"])),
      { forcarRede: true },
    );
    expect(resultado.daCopia).toBe(false);
    expect(nomes(resultado)).toEqual(["Maria", "João"]);
  });

  it("sem IndexedDB, a carga segue pela RPC como antes", async () => {
    globalThis.indexedDB = undefined;
    const { resultado } = await abrir(resposta(payload("10:00", ["Maria"])));
    expect(resultado.daCopia).toBe(false);
    expect(nomes(resultado)).toEqual(["Maria"]);
  });

  it("o cache antigo do localStorage (e o recovery dele) sai; o resto fica", () => {
    localStorage.setItem("agsus_analises_cache_v1_v5_u1_ativo", "{}");
    localStorage.setItem("agsus_analises_cache_v1_v5_u1_projetos_ativo", "{}");
    localStorage.setItem("agsus_analises_theme_v3", "dark");
    limparCacheAntigoDoLocalStorage();
    expect(localStorage.getItem("agsus_analises_cache_v1_v5_u1_ativo")).toBe(
      null,
    );
    expect(
      localStorage.getItem("agsus_analises_cache_v1_v5_u1_projetos_ativo"),
    ).toBe(null);
    expect(localStorage.getItem("agsus_analises_theme_v3")).toBe("dark");
  });
});
