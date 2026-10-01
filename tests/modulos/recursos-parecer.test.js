import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { clicar, digitar, esperar } from "../componentes/interacoes.js";

/*
  A tela de Recursos com o parecer jurídico: os 4 KPIs, quem vê os botões de
  decisão (só quem tem recursos_parecer, que o banco devolve em
  pode_decidir), o aviso "Aguardando parecer jurídico" para os demais e a
  chamada de transicionar_recurso_candidato com o parecer.
*/
vi.mock("../../src/lib/chartjs-global.js", () => ({
  Chart: class {
    constructor(canvas, configuracao) {
      this.data = configuracao.data;
      this.options = configuracao.options;
    }
    update() {}
    destroy() {}
  },
}));

const { montarRecursos } =
  await import("../../src/modulos/recursos/recursos.jsx");

const recurso = (extra = {}) => ({
  id: "r1",
  nu: 7,
  edital_id: "e1",
  edital: "105/2026",
  unidade: "DSEI Litoral Sul",
  origem: "analise-curricular",
  analise_id: "a1",
  fora_analise: false,
  candidato: "Ana Ribeiro",
  codigo: "111",
  analista: "Carla",
  situacao: "EM_ANALISE_JURIDICA",
  parecer_enviado_em: "2026-09-21T12:00:00Z",
  criado_em: "2026-09-20T12:00:00Z",
  atualizado_em: "2026-09-21T12:00:00Z",
  revisao: 3,
  ...extra,
});

function supabaseFalso({ podeDecidir, recursos = [recurso()] }) {
  const rpc = vi.fn(async (nome) => {
    if (nome === "get_recursos_da_area")
      return {
        data: {
          schema_version: 1,
          area: "saude-indigena",
          pode_editar: true,
          pode_decidir: podeDecidir,
          origens: [],
          editais: [],
          modelos: [],
          recursos,
          cronogramas: [],
        },
        error: null,
      };
    if (nome === "get_recurso_candidato_detalhe")
      return {
        data: {
          id: "r1",
          observacao: "",
          etapas: {},
          historico: [],
          anexos: [],
          parecer_enviado_por: "Carla",
          parecer: recursos[0].situacao === "DEFERIDO" ? "Defiro." : null,
          decisao_por: "Dra. Lia",
        },
        error: null,
      };
    if (nome === "transicionar_recurso_candidato")
      return { data: { situacao: "DEFERIDO", revisao: 4 }, error: null };
    return { data: null, error: null };
  });
  return { rpc };
}

let secao;
let painel;

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-recursos";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarRecursos({ supabase, toast: vi.fn() });
  });
  await act(async () => void painel.render());
  await esperar();
}

async function abrirGaveta() {
  await clicar(document.querySelector(".recursos-linha"));
  await esperar();
  await esperar();
}

const parecer = () =>
  document.querySelector('.ui-secao[data-section="parecer"]');
const botoesDeDecisao = () =>
  [...(parecer()?.querySelectorAll("[data-acao-parecer]") || [])].map(
    (b) => b.dataset.acaoParecer,
  );
const kpis = () =>
  [...document.querySelectorAll(".recursos-kpis [data-kpi]")].map(
    (k) => k.dataset.kpi,
  );

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("saude-indigena");
});

afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
});

describe("KPIs", () => {
  it("quatro, em card compacto: aguardando parecer, prazo vencido, deferidos e indeferidos", async () => {
    await montar(
      supabaseFalso({
        podeDecidir: false,
        recursos: [
          recurso(),
          recurso({
            id: "r2",
            nu: 8,
            situacao: "PARCIALMENTE_INDEFERIDO",
            decisao_em: "2026-09-25T12:00:00Z",
          }),
          recurso({
            id: "r3",
            nu: 9,
            situacao: "DEFERIDO",
            decisao_em: "2026-09-25T12:00:00Z",
          }),
        ],
      }),
    );
    expect(kpis()).toEqual([
      "aguardando-parecer",
      "prazo-vencido",
      "deferidos",
      "indeferidos",
    ]);
    const valor = (chave) =>
      document.querySelector(`[data-kpi="${chave}"] .ui-kpi-valor`).textContent;
    expect(valor("aguardando-parecer")).toBe("1");
    expect(valor("deferidos")).toBe("2");
    expect(valor("indeferidos")).toBe("0");
    for (const card of document.querySelectorAll(".recursos-kpis .ui-kpi"))
      expect(card.querySelector("button.ui-kpi-alvo")).not.toBeNull();
    // Deferidos filtra os dois (com o parcialmente).
    await clicar(document.querySelector('[data-kpi="deferidos"] button'));
    expect(document.querySelector(".recursos-contagem").textContent).toBe(
      "2 de 3",
    );
  });
});

describe("quem vê os botões de decisão", () => {
  it("sem o parecer jurídico: nenhum botão de decisão, só 'Aguardando parecer jurídico'", async () => {
    await montar(supabaseFalso({ podeDecidir: false }));
    await abrirGaveta();
    expect(parecer()).not.toBeNull();
    expect(botoesDeDecisao()).toEqual([]);
    expect(parecer().textContent).toContain("Aguardando parecer jurídico");
  });

  it("quem edita envia o registrado para parecer", async () => {
    const supabase = supabaseFalso({
      podeDecidir: false,
      recursos: [recurso({ situacao: "REGISTRADO", parecer_enviado_em: null })],
    });
    await montar(supabase);
    await abrirGaveta();
    expect(botoesDeDecisao()).toEqual(["enviar_parecer"]);
  });

  it("com o parecer jurídico: decide com o texto do parecer", async () => {
    const supabase = supabaseFalso({ podeDecidir: true });
    await montar(supabase);
    await abrirGaveta();
    expect(botoesDeDecisao()).toEqual([
      "deferir",
      "deferir_parcialmente",
      "indeferir",
      "devolver",
    ]);
    expect(parecer().textContent).not.toContain("Aguardando parecer jurídico");

    await clicar(parecer().querySelector('[data-acao-parecer="deferir"]'));
    const form = parecer().querySelector('form[data-parecer="deferir"]');
    const confirmar = form.querySelector('button[type="submit"]');
    expect(confirmar.disabled).toBe(true);
    await digitar(
      form.querySelector("textarea"),
      "Defiro: a documentação comprova a experiência.",
    );
    expect(confirmar.disabled).toBe(false);
    await clicar(confirmar);
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "transicionar_recurso_candidato",
      {
        p_id: "r1",
        p_acao: "deferir",
        p_revisao: 3,
        p_texto: "Defiro: a documentação comprova a experiência.",
      },
    );
  });

  it("decidido: o parecer aparece; quem não decide não reabre nem exclui", async () => {
    await montar(
      supabaseFalso({
        podeDecidir: false,
        recursos: [
          recurso({ situacao: "DEFERIDO", decisao_em: "2026-09-25T12:00:00Z" }),
        ],
      }),
    );
    await abrirGaveta();
    expect(parecer().textContent).toContain("Defiro.");
    expect(botoesDeDecisao()).toEqual([]);
    const excluir = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith("Excluir"),
    );
    expect(excluir).toBeUndefined();
    const resposta = document.querySelector('input[name="resposta_candidato"]');
    expect(resposta.disabled).toBe(true);
  });
});
