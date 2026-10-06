import { describe, expect, it } from "vitest";

import { criarEstadoDaConducao } from "../../src/modulos/entrevistas/estado-da-conducao.js";

/*
  Leituras e gravações da condução fora de ordem: a releitura do edital pedida
  antes de uma gravação chegava depois dela e devolvia à tela as notas
  antigas; a falha na leitura dos roteiros deixava a lista "não carregada" e
  a tela relia a cada desenho.
*/
function supabaseControlado() {
  const pendentes = [];
  return {
    pendentes,
    rpc: (nome, argumentos) =>
      new Promise((resolver) => pendentes.push({ nome, argumentos, resolver })),
  };
}

const responder = (pedido, data) => pedido.resolver({ data, error: null });
const pedidos = (supabase, nome) =>
  supabase.pendentes.filter((p) => p.nome === nome);

// Com a lista de convocação registrada, abrir o edital não pede o cálculo.
const edital = (versao) => ({
  edital: { id: "m1" },
  pode_editar: true,
  lista_convocacao: { lista: { id: "lista1" } },
  convocados: [],
  versao,
});

describe("condução: gravação e leitura fora de ordem", () => {
  it("a releitura pedida antes da gravação não sobrescreve o payload gravado", async () => {
    const supabase = supabaseControlado();
    const conducao = criarEstadoDaConducao({
      supabase,
      toast: () => {},
      tempoLimiteMs: 10_000,
    });
    const abrir = conducao.abrirEdital("m1");
    responder(pedidos(supabase, "obter_entrevistas_do_edital")[0], edital(1));
    responder(pedidos(supabase, "obter_agenda_entrevista")[0], null);
    await abrir;

    const releitura = conducao.recarregarEdital();
    const gravacao = conducao.lancarNotas("e1", { notas: [] });
    responder(pedidos(supabase, "lancar_notas_entrevista")[0], edital(3));
    await gravacao;
    expect(conducao.obter().edital.versao).toBe(3);

    responder(pedidos(supabase, "obter_entrevistas_do_edital")[1], edital(2));
    responder(pedidos(supabase, "obter_agenda_entrevista")[1], null);
    await releitura;
    expect(conducao.obter().edital.versao).toBe(3);
    expect(conducao.obter().carregandoEdital).toBe(false);
  });

  it("falha nos roteiros: fica carregado com o erro (não relê sozinha)", async () => {
    const supabase = supabaseControlado();
    const conducao = criarEstadoDaConducao({ supabase, tempoLimiteMs: 10_000 });
    const carga = conducao.carregarRoteiros("sede");
    pedidos(supabase, "listar_roteiros_entrevista")[0].resolver({
      data: null,
      error: { code: "XX000", message: "falhou" },
    });
    await carga;
    const { roteiros } = conducao.obter();
    expect(roteiros.carregando).toBe(false);
    expect(roteiros.carregado).toBe(true);
    expect(roteiros.erro).not.toBe("");
  });
});
