import { describe, expect, it, vi } from "vitest";
import { criarEstadoDaConducao } from "../../src/modulos/entrevistas/estado-da-conducao.ts";

function servidor() {
  const pendentes = [];
  let aoMudarSessao;
  return {
    pendentes,
    rpc: (nome) =>
      new Promise((resolver) => pendentes.push({ nome, resolver })),
    auth: {
      onAuthStateChange: (ouvinte) => {
        aoMudarSessao = ouvinte;
      },
    },
    sessao: (id) => aoMudarSessao("SIGNED_IN", id ? { user: { id } } : null),
  };
}
const payload = (versao) => ({
  edital: { id: "e1" },
  pode_editar: true,
  lista_convocacao: { lista: { id: "l1" } },
  versao,
  convocados: [],
  avaliadores: [],
});
const responder = (pedido, dados) =>
  pedido.resolver({ data: dados, error: null });
async function abrir(estado, supabase, versao) {
  const posicao = supabase.pendentes.length;
  const abertura = estado.abrirEdital("e1");
  responder(supabase.pendentes[posicao], payload(versao));
  responder(supabase.pendentes[posicao + 1], null);
  await abertura;
}

describe("gravações antigas de Conduzir entrevistas", () => {
  it("trocar área protege o mesmo edital e a gravação nova de uma resposta antiga", async () => {
    const supabase = servidor(),
      toast = vi.fn(),
      aoMudarResultados = vi.fn();
    const estado = criarEstadoDaConducao({
      supabase,
      toast,
      aoMudarResultados,
      tempoLimiteMs: 10_000,
    });
    estado.trocarArea("sede");
    await abrir(estado, supabase, 1);
    const antiga = estado.lancarNotas("i1", { notas: [] });
    const pedidoAntigo = supabase.pendentes.at(-1);
    estado.trocarArea("projetos");
    await abrir(estado, supabase, 2);
    const nova = estado.lancarNotas("i1", { notas: [] });
    const pedidoNovo = supabase.pendentes.at(-1);
    responder(pedidoAntigo, payload(10));
    expect((await antiga).ok).not.toBe(true);
    expect(estado.obter().edital.versao).toBe(2);
    expect(estado.obter().acao.tipo).toBe("notas");
    expect(toast).not.toHaveBeenCalled();
    expect(aoMudarResultados).not.toHaveBeenCalled();
    responder(pedidoNovo, payload(3));
    expect((await nova).ok).toBe(true);
    expect(estado.obter().edital.versao).toBe(3);
    expect(estado.obter().acao).toBeNull();
    expect(aoMudarResultados).toHaveBeenCalledTimes(1);
  });
  it("a falha de uma gravação da sessão anterior não afeta a pessoa que entrou", async () => {
    const supabase = servidor(),
      toast = vi.fn(),
      aoMudarResultados = vi.fn();
    const estado = criarEstadoDaConducao({
      supabase,
      toast,
      aoMudarResultados,
      tempoLimiteMs: 10_000,
    });
    supabase.sessao("pessoa-1");
    estado.trocarArea("sede");
    await abrir(estado, supabase, 1);
    const antiga = estado.lancarNotas("i1", { notas: [] });
    const pedido = supabase.pendentes.at(-1);
    supabase.sessao(null);
    supabase.sessao("pessoa-2");
    estado.trocarArea("sede");
    await abrir(estado, supabase, 2);
    pedido.resolver({
      data: null,
      error: { code: "42501", message: "acesso antigo" },
    });
    expect((await antiga).ok).not.toBe(true);
    expect(estado.obter().edital.versao).toBe(2);
    expect(estado.obter().podeEditar).toBe(true);
    expect(toast).not.toHaveBeenCalled();
    expect(aoMudarResultados).not.toHaveBeenCalled();
  });
});
