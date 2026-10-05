import { afterEach, describe, expect, it, vi } from "vitest";
import { criarEstadoDoChat } from "../../src/modulos/chat/estado.js";

/*
  O estado do chat (src/modulos/chat/estado.js) na v1.1, sem React: limpar a
  conversa (só para mim) e reações — na hora na tela, confirmadas pela RPC,
  desfeitas se a RPC falhar e aplicadas pelo Realtime.
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
      const data = await r(argumentos || {});
      if (data?.__erro) return { data: null, error: data.__erro };
      return { data, error: null };
    }),
  };
}

const base = {
  listar_conversas_chat: () => ({ eu: EU, conversas: [CONVERSA] }),
  listar_mensagens_chat: () => ({
    conversa: CONVERSA,
    mensagens: [M1, M2],
    tem_mais: true,
  }),
  marcar_conversa_lida_chat: () => ({ conversa: "c1", lida_em: null }),
};

let estado;
afterEach(() => estado?.desligar());

async function abrir(respostas = {}) {
  const toast = vi.fn();
  const supabase = supabaseFalso({ ...base, ...respostas });
  estado = criarEstadoDoChat({
    supabase,
    toast,
    armazenamento: null,
    definirTitulo: () => {},
  });
  estado.ligar(EU);
  await estado.carregarConversas();
  await estado.abrirConversa("c1");
  return { supabase, toast };
}

describe("limpar conversa (estado)", () => {
  it("chama a RPC, tira da tela o que veio até a limpeza e guarda limpa_em", async () => {
    const limpaEm = "2026-10-05T12:00:00Z";
    const { supabase } = await abrir({
      limpar_conversa_chat: () => ({
        ...CONVERSA,
        limpa_em: limpaEm,
        ultima: null,
      }),
    });
    expect(estado.obter().mensagens).toHaveLength(2);
    expect(await estado.limparConversa()).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("limpar_conversa_chat", {
      p_conversa: "c1",
    });
    const e = estado.obter();
    expect(e.mensagens).toEqual([]);
    expect(e.temMais).toBe(false);
    expect(e.conversa.limpa_em).toBe(limpaEm);
    expect(e.conversas.find((c) => c.id === "c1").ultima).toBeNull();

    // O que é anterior à limpeza não volta pelo Realtime.
    estado._aoMudarMensagem({
      eventType: "UPDATE",
      new: {
        CO_MENSAGEM: "m1",
        CO_CONVERSA: "c1",
        CO_USUARIO_AUTOR: ANA,
        DS_TEXTO: "Oi!",
        DT_CRIACAO: M1.criada_em,
        ST_APAGADA: "N",
      },
    });
    expect(estado.obter().mensagens).toEqual([]);
  });

  it("falhou: avisa e não mexe na tela", async () => {
    const { toast } = await abrir({
      limpar_conversa_chat: () => ({ __erro: { code: "42501" } }),
    });
    expect(await estado.limparConversa()).toBe(false);
    expect(estado.obter().mensagens).toHaveLength(2);
    expect(toast).toHaveBeenCalledWith(
      "Seu acesso não inclui esta conversa.",
      "error",
    );
  });
});

describe("reações (estado)", () => {
  it("aparece na hora e a resposta da RPC confirma", async () => {
    let soltar;
    const { supabase } = await abrir({
      alternar_reacao_chat: () =>
        new Promise((r) => {
          soltar = () =>
            r({ ...M1, reacoes: [{ emoji: "👍", usuarios: [EU, ANA] }] });
        }),
    });
    const pedido = estado.alternarReacao("m1", "👍");
    expect(estado.obter().mensagens[0].reacoes).toEqual([
      { emoji: "👍", usuarios: [EU] },
    ]);
    soltar();
    expect(await pedido).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("alternar_reacao_chat", {
      p_mensagem: "m1",
      p_emoji: "👍",
    });
    expect(estado.obter().mensagens[0].reacoes).toEqual([
      { emoji: "👍", usuarios: [EU, ANA] },
    ]);
  });

  it("falhou: volta ao que era e avisa", async () => {
    const { toast } = await abrir({
      alternar_reacao_chat: () => ({ __erro: { message: "Sem rede" } }),
    });
    expect(await estado.alternarReacao("m1", "✅")).toBe(false);
    expect(estado.obter().mensagens[0].reacoes).toEqual([]);
    expect(toast).toHaveBeenCalledWith("Sem rede", "error");
  });

  it("não reage com emoji fora da lista, em mensagem apagada ou que não está na tela", async () => {
    const { supabase } = await abrir({
      listar_mensagens_chat: () => ({
        conversa: CONVERSA,
        mensagens: [M1, { ...M2, apagada: true, texto: "" }],
        tem_mais: false,
      }),
    });
    expect(await estado.alternarReacao("m1", "🍕")).toBe(false);
    expect(await estado.alternarReacao("m2", "👍")).toBe(false);
    expect(await estado.alternarReacao("m9", "👍")).toBe(false);
    expect(
      supabase.rpc.mock.calls.some(([n]) => n === "alternar_reacao_chat"),
    ).toBe(false);
  });

  it("o Realtime aplica a reação na conversa aberta e ignora a de outra conversa", async () => {
    await abrir();
    const linha = {
      CO_MENSAGEM: "m2",
      CO_USUARIO: ANA,
      DS_EMOJI: "🙏",
      CO_CONVERSA: "c1",
      ST_REGISTRO_ATIVO: "S",
    };
    estado._aoMudarReacao({ new: linha });
    expect(estado.obter().mensagens[1].reacoes).toEqual([
      { emoji: "🙏", usuarios: [ANA] },
    ]);
    const antes = estado.obter().mensagens;
    estado._aoMudarReacao({ new: { ...linha, CO_CONVERSA: "c2" } });
    expect(estado.obter().mensagens).toBe(antes);
  });
});
