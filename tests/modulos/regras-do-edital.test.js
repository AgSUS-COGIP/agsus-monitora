import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { montarRegrasDoEdital } from "../componentes/montar-regras-do-edital.js";
import { clicar, esperar } from "../componentes/interacoes.js";

/*
  Regras do edital (Editais › Regras do edital): as etapas sem editor próprio
  aqui (Entrevista e Chamada para contratação) mostram o resumo do que já
  existe e só LEEM o banco; a troca de etapa usa o mesmo cliente.
*/

const EDITAL = "e93";

function supabaseFalso() {
  return {
    rpc: vi.fn(async (nome) => {
      const respostas = {
        obter_entrevistas_do_edital: {
          edital: { id: EDITAL, edital: "93/2026" },
          pode_editar: true,
          configuracao: { roteiro: null, lancamento: null },
          regra_classificacao: {
            versao: 1,
            convocacao: { multiplo_vagas: 3, incluir_empatados: true },
            desempate: [{ criterio: "IDOSO_60" }],
            empate_final: { metodo: "SORTEIO" },
          },
          avaliadores: [],
          convocados: [],
        },
        listar_configuracao_convocacao: [
          {
            edital_id: EDITAL,
            modelo_id: "m1",
            proporcionalidade: true,
            padrao_imediata: 0,
            vagas: [{ codigo_vaga: "177001", cargo: "Analista", imediatas: 2 }],
          },
        ],
        listar_modelos_convocacao: [
          {
            modelo_id: "m1",
            nome: "Modelo de teste",
            categorias: [
              {
                id: "pp",
                sigla: "PP",
                rotulo: "Pretos e pardos",
                percentual: 25,
              },
            ],
          },
        ],
      };
      return { data: respostas[nome] ?? null, error: null };
    }),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
  };
}

let montado;
afterEach(async () => {
  await act(async () => montado?.raiz.unmount());
  document.body.innerHTML = "";
});

describe("Regras do edital: Entrevista e Chamada", () => {
  it("Entrevista: o resumo de Preparar, só lendo o banco", async () => {
    const supabase = supabaseFalso();
    montado = await montarRegrasDoEdital({
      supabase,
      editalId: EDITAL,
      etapa: "entrevista",
    });
    await esperar();
    const texto = montado.secao.textContent;
    expect(texto).toContain("Quem é chamado para a entrevista");
    expect(texto).toContain("Desempate");
    expect(supabase.rpc.mock.calls.map(([n]) => n)).toEqual([
      "obter_entrevistas_do_edital",
    ]);
  });

  it("Chamada: o modelo, as reservas e as vagas imediatas; trocar de etapa", async () => {
    const supabase = supabaseFalso();
    montado = await montarRegrasDoEdital({
      supabase,
      editalId: EDITAL,
      etapa: "chamada",
    });
    await esperar();
    const chamada = montado.secao.querySelector(
      "[data-tour='regras-do-edital-chamada']",
    );
    expect(chamada.textContent).toContain("Modelo de teste");
    expect(chamada.textContent).toContain("PP 25%");
    expect(chamada.textContent).toContain("2 em 1 vaga");
    expect(
      chamada.querySelector("[data-acao='editar-chamada']"),
    ).not.toBeNull();
    await clicar(
      [...montado.secao.querySelectorAll(".ui-segmentado button")].find((b) =>
        b.textContent.includes("Entrevista"),
      ),
    );
    await esperar();
    expect(
      montado.secao.querySelector("[data-tour='regras-do-edital']").dataset
        .etapa,
    ).toBe("entrevista");
  });
});
