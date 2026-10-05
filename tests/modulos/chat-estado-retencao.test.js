import { afterEach, describe, expect, it, vi } from "vitest";
import { criarEstadoDoChat } from "../../src/modulos/chat/estado.js";
import { reconciliarPagina, tirarMensagens } from "../../src/lib/chat.js";

/*
  O chat aberto reflete a retenção e o "Zerar mensagens" das Configurações
  (exclusão real no banco): o DELETE do Realtime (só com a chave) tira a
  mensagem da tela e a releitura da página mais nova tira o que sumiu.
*/

const EU = "eu";
const ANA = "ana";
const CONVERSA = {
  id: "c1",
  tipo: "DIRETA",
  participantes: [
    { id: EU, nome: "Eu" },
    { id: ANA, nome: "Ana" },
  ],
  nao_lidas: 0,
  atualizada_em: "2026-10-05T11:00:00Z",
};
const M1 = {
  id: "m1",
  conversa: "c1",
  autor: ANA,
  texto: "Oi",
  criada_em: "2026-10-05T10:00:00Z",
  apagada: false,
  reacoes: [],
};
const M2 = { ...M1, id: "m2", autor: EU, criada_em: "2026-10-05T11:00:00Z" };

function supabaseFalso(respostas) {
  return {
    rpc: vi.fn(async (nome, argumentos) => {
      const r = respostas[nome];
      if (!r) return { data: null, error: { message: `sem ${nome}` } };
      return { data: await r(argumentos || {}), error: null };
    }),
  };
}

let estado;
afterEach(() => estado?.desligar());

async function abrir(paginas) {
  let vez = 0;
  const supabase = supabaseFalso({
    listar_conversas_chat: () => ({ eu: EU, conversas: [CONVERSA] }),
    listar_mensagens_chat: () => paginas[Math.min(vez++, paginas.length - 1)],
    marcar_conversa_lida_chat: () => ({ conversa: "c1", lida_em: null }),
  });
  estado = criarEstadoDoChat({
    supabase,
    armazenamento: null,
    definirTitulo: () => {},
  });
  estado.ligar(EU);
  await estado.carregarConversas();
  await estado.abrirConversa("c1");
  return supabase;
}

describe("retenção e zerar refletem no chat aberto", () => {
  it("DELETE do Realtime (só a chave) tira a mensagem da conversa aberta", async () => {
    await abrir([{ conversa: CONVERSA, mensagens: [M1, M2], tem_mais: false }]);
    expect(estado.obter().mensagens).toHaveLength(2);
    estado._aoMudarMensagem({
      eventType: "DELETE",
      new: {},
      old: { CO_MENSAGEM: "m1" },
    });
    expect(estado.obter().mensagens.map((m) => m.id)).toEqual(["m2"]);
  });

  it("DELETE de mensagem que não está na tela não muda o estado", async () => {
    await abrir([{ conversa: CONVERSA, mensagens: [M1, M2], tem_mais: false }]);
    const antes = estado.obter().mensagens;
    estado._aoMudarMensagem({
      eventType: "DELETE",
      new: {},
      old: { CO_MENSAGEM: "outra" },
    });
    expect(estado.obter().mensagens).toBe(antes);
  });

  it("a releitura (voltar à aba, reconectar) tira o que o banco apagou", async () => {
    await abrir([
      { conversa: CONVERSA, mensagens: [M1, M2], tem_mais: false },
      { conversa: CONVERSA, mensagens: [], tem_mais: false },
    ]);
    expect(estado.obter().mensagens).toHaveLength(2);
    await estado.recarregarTudo();
    expect(estado.obter().mensagens).toEqual([]);
  });
});

describe("tirarMensagens e reconciliarPagina (regra pura)", () => {
  it("tirarMensagens devolve a mesma lista quando nada sai", () => {
    const lista = [M1, M2];
    expect(tirarMensagens(lista, ["x"])).toBe(lista);
    expect(tirarMensagens(lista, ["m2"])).toEqual([M1]);
  });

  it("reconciliarPagina guarda pendente, falha, mais nova que a página e as páginas antigas", () => {
    const antiga = { ...M1, id: "a0", criada_em: "2026-10-01T10:00:00Z" };
    const sumiu = { ...M1, id: "s1", criada_em: "2026-10-05T10:30:00Z" };
    const pendente = {
      ...M1,
      id: "p1",
      criada_em: "2026-10-05T09:00:00Z",
      pendente: true,
    };
    const chegou = { ...M1, id: "n1", criada_em: "2026-10-05T12:00:00Z" };
    const atuais = [antiga, M1, sumiu, pendente, chegou];
    expect(
      reconciliarPagina(atuais, [M1, M2], true).map((m) => m.id),
    ).toEqual(["a0", "p1", "m1", "m2", "n1"]);
    expect(
      reconciliarPagina(atuais, [M1, M2], false).map((m) => m.id),
    ).toEqual(["p1", "m1", "m2", "n1"]);
  });
});
