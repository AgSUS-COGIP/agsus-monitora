import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { clicar, digitar, esperar } from "../componentes/interacoes.js";

/*
  "Ajuste da pontuação" na gaveta do recurso (migration 20261005130000):
  quem decide propõe os novos valores dos componentes da regra do edital, vê
  a prévia (nova nota e nova posição, pelo motor da Classificação) e quem
  aprova a resposta aprova — recalculando a prévia. Quem não decide não vê a
  seção enquanto não houver ajuste.
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

const REGRA = {
  etapas: { documental: true, entrevista: false },
  documental: {
    situacoes_aptas: ["Aprovado"],
    parciais: ["FORMACAO", "EXPERIENCIA"],
  },
  composicao: { componentes: [{ codigo: "DOCUMENTAL", peso: 1 }], casas: 2 },
};

const analise = (id, nome, nota, formacao, experiencia) => ({
  analise_id: id,
  codigo: id,
  nome,
  vaga: "V1",
  cargo: "Enfermeiro",
  modalidade: "Ampla concorrência",
  status: "Aprovado",
  nota_documental: nota,
  pontuacao_formacao: formacao,
  pontuacao_experiencia: experiencia,
});

const DADOS_DA_PREVIA = {
  edital: { id: "e1", unidade: "DSEI" },
  regra: { versao: 1, configuracao: REGRA },
  candidatos: [
    analise("a0", "Bia Lima", 20, 8, 12),
    analise("a2", "Caio Melo", 18, 8, 10),
    analise("a1", "Ana Ribeiro", 15, 5, 10),
  ],
  entrevistas: [],
  quadro: [],
  cronograma: [],
  desempates: [],
  ajustes: [],
};

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
  situacao: "DEFERIDO",
  decisao_em: "2026-10-04T12:00:00Z",
  criado_em: "2026-09-20T12:00:00Z",
  atualizado_em: "2026-10-04T12:00:00Z",
  revisao: 5,
  ...extra,
});

/* Um banco falso com estado: as versões do ajuste mudam a cada escrita. */
function supabaseFalso({ podeDecidir = true, situacao = "DEFERIDO" } = {}) {
  const banco = { versoes: [], mudou: false };
  const resposta = () => ({
    recurso_id: "r1",
    situacao,
    pode_propor: podeDecidir,
    pode_aprovar: podeDecidir && situacao === "DEFERIDO",
    pode_cancelar: podeDecidir,
    ajustes: [...banco.versoes].reverse(),
  });
  const rpc = vi.fn(async (nome, args) => {
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
          recursos: [recurso({ situacao, mudou_classificacao: banco.mudou })],
          cronogramas: [],
        },
        error: null,
      };
    if (nome === "get_recurso_candidato_detalhe")
      return {
        data: { id: "r1", etapas: {}, historico: [], anexos: [] },
        error: null,
      };
    if (nome === "obter_ajustes_pontuacao_recurso")
      return { data: resposta(), error: null };
    if (nome === "obter_dados_previa_ajuste")
      return podeDecidir
        ? { data: DADOS_DA_PREVIA, error: null }
        : { data: null, error: { code: "42501", message: "Sem parecer" } };
    if (nome === "propor_ajuste_pontuacao") {
      for (const v of banco.versoes)
        if (v.situacao === "PROPOSTO") v.situacao = "CANCELADO";
      banco.versoes.push({
        id: `aj${banco.versoes.length + 1}`,
        recurso_id: "r1",
        numero: 7,
        analise_id: "a1",
        versao: banco.versoes.length + 1,
        situacao: "PROPOSTO",
        lista: args.p_dados.lista,
        justificativa: args.p_dados.justificativa,
        itens: args.p_dados.itens,
        previa: args.p_dados.previa,
        proposto_em: "2026-10-05T12:00:00Z",
        proposto_por: "Dra. Lia",
      });
      return { data: resposta(), error: null };
    }
    if (nome === "aprovar_ajuste_pontuacao") {
      const v = banco.versoes.find((x) => x.id === args.p_ajuste);
      Object.assign(v, {
        situacao: "APROVADO",
        aprovado_em: "2026-10-05T13:00:00Z",
        aprovado_por: "Dra. Lia",
        previa_aprovacao: args.p_previa,
        mudou_posicao: args.p_previa.mudou,
      });
      banco.mudou = args.p_previa.mudou;
      return { data: resposta(), error: null };
    }
    if (nome === "cancelar_ajuste_pontuacao") {
      const v = banco.versoes.find((x) => x.id === args.p_ajuste);
      Object.assign(v, {
        situacao: "CANCELADO",
        cancelado_em: "2026-10-05T14:00:00Z",
        motivo_cancelamento: args.p_motivo,
      });
      banco.mudou = false;
      return { data: resposta(), error: null };
    }
    return { data: null, error: null };
  });
  return { rpc, banco };
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
  await clicar(document.querySelector(".recursos-linha"));
  await esperar();
  await esperar();
}

const secaoDoAjuste = () =>
  document.querySelector('.ui-secao[data-section="ajuste"]');
const botao = (acao) =>
  secaoDoAjuste()?.querySelector(`[data-acao-ajuste="${acao}"]`);
const chamadas = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([n]) => n === nome);

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

describe("seção de ajuste da pontuação", () => {
  it("quem não decide não vê a seção sem ajuste", async () => {
    const supabase = supabaseFalso({ podeDecidir: false });
    await montar(supabase);
    expect(chamadas(supabase, "obter_ajustes_pontuacao_recurso")).toHaveLength(
      1,
    );
    expect(secaoDoAjuste()).toBeNull();
  });

  it("o formulário mostra os componentes da regra, o atual, o total somado e a prévia da posição", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(botao("propor"));
    await esperar();
    expect(chamadas(supabase, "obter_dados_previa_ajuste")).toHaveLength(1);
    const linhas = [
      ...secaoDoAjuste().querySelectorAll(
        ".recursos-ajuste-formulario [data-item]",
      ),
    ].map((l) => l.dataset.item);
    expect(linhas).toEqual(["FORMACAO", "EXPERIENCIA", "DOCUMENTAL"]);
    // Nada mudou: sem prévia e com o aviso.
    expect(botao("propor").disabled).toBe(true);
    expect(secaoDoAjuste().textContent).toContain("Altere ao menos um valor.");

    await digitar(
      secaoDoAjuste().querySelector('[name="novo-FORMACAO"]'),
      "11",
    );
    const total = secaoDoAjuste().querySelector(
      '[data-item="DOCUMENTAL"] [data-calculado]',
    );
    expect(total.textContent).toBe("21,00");
    const previa = secaoDoAjuste().querySelector("[data-previa]");
    expect(previa.dataset.previa).toBe("PRELIMINAR");
    expect(previa.textContent).toContain("posição 3º → 1º");
    expect(previa.textContent).toContain(
      "Mudam de posição: Bia Lima 1º → 2º; Caio Melo 2º → 3º",
    );
    // Falta a justificativa.
    expect(botao("propor").disabled).toBe(true);
    await digitar(
      secaoDoAjuste().querySelector('[name="justificativa"]'),
      "Diploma de especialização aceito no recurso.",
    );
    expect(botao("propor").disabled).toBe(false);
  });

  it("fluxo proposto → aprovado: a proposta leva itens e prévia; a aprovação recalcula a prévia e marca a classificação", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(botao("propor"));
    await esperar();
    await digitar(
      secaoDoAjuste().querySelector('[name="novo-FORMACAO"]'),
      "11",
    );
    await digitar(
      secaoDoAjuste().querySelector('[name="justificativa"]'),
      "Diploma de especialização aceito no recurso.",
    );
    await clicar(botao("propor"));
    await esperar();

    const [[, propor]] = chamadas(supabase, "propor_ajuste_pontuacao");
    expect(propor.p_recurso).toBe("r1");
    expect(propor.p_dados).toMatchObject({
      lista: "PRELIMINAR",
      justificativa: "Diploma de especialização aceito no recurso.",
      itens: [
        { codigo: "FORMACAO", anterior: 5, novo: 11 },
        expect.objectContaining({
          codigo: "DOCUMENTAL",
          anterior: 15,
          novo: 21,
        }),
      ],
      previa: expect.objectContaining({
        mudou: true,
        antes: expect.objectContaining({ posicao: 3 }),
        depois: expect.objectContaining({ posicao: 1 }),
      }),
    });
    const cartao = secaoDoAjuste().querySelector('[data-ajuste="PROPOSTO"]');
    expect(cartao).not.toBeNull();
    expect(cartao.textContent).toContain("Versão 1");
    // Proposto não vale: a aprovação é explícita.
    expect(chamadas(supabase, "aprovar_ajuste_pontuacao")).toHaveLength(0);

    await clicar(botao("aprovar"));
    await esperar();
    // A prévia é recalculada com os dados de agora (releitura forçada).
    expect(chamadas(supabase, "obter_dados_previa_ajuste")).toHaveLength(2);
    expect(
      secaoDoAjuste().querySelector("[data-aprovar-ajuste] [data-previa]")
        .textContent,
    ).toContain("posição 3º → 1º");
    await clicar(botao("confirmar-aprovacao"));
    await esperar();
    await esperar();

    const [[, aprovar]] = chamadas(supabase, "aprovar_ajuste_pontuacao");
    expect(aprovar).toMatchObject({
      p_ajuste: "aj1",
      p_previa: expect.objectContaining({ mudou: true, tipo: "PRELIMINAR" }),
    });
    const aprovado = secaoDoAjuste().querySelector('[data-ajuste="APROVADO"]');
    expect(aprovado).not.toBeNull();
    expect(
      aprovado.querySelector("[data-mudou-posicao]").textContent,
    ).toContain("Mudou a classificação");
    // A marca automática chega à gaveta pela releitura da aba.
    expect(document.querySelector("#recursosGaveta").textContent).toContain(
      "Classificação mudou",
    );
  });

  it("a releitura da aba com o formulário aberto não o troca por “Carregando…” nem perde o digitado", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(botao("propor"));
    await esperar();
    await digitar(
      secaoDoAjuste().querySelector('[name="novo-FORMACAO"]'),
      "11",
    );
    await act(async () => void painel.render());
    expect(secaoDoAjuste().textContent).not.toContain(
      "Carregando os dados da classificação",
    );
    await esperar();
    await esperar();
    // Os dados da prévia do recurso aberto são relidos por trás.
    expect(chamadas(supabase, "obter_dados_previa_ajuste")).toHaveLength(2);
    expect(secaoDoAjuste().querySelector('[name="novo-FORMACAO"]').value).toBe(
      "11",
    );
    expect(
      secaoDoAjuste().querySelector("[data-previa]").textContent,
    ).toContain("posição 3º → 1º");
  });

  it("cancelar o ajuste aprovado pede motivo e o tira", async () => {
    const supabase = supabaseFalso();
    supabase.banco.versoes.push({
      id: "aj1",
      recurso_id: "r1",
      numero: 7,
      analise_id: "a1",
      versao: 1,
      situacao: "APROVADO",
      lista: "PRELIMINAR",
      justificativa: "Diploma aceito.",
      itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }],
      proposto_em: "2026-10-05T12:00:00Z",
      aprovado_em: "2026-10-05T13:00:00Z",
      mudou_posicao: true,
    });
    supabase.banco.mudou = true;
    await montar(supabase);
    await clicar(botao("cancelar"));
    expect(botao("confirmar-cancelamento").disabled).toBe(true);
    await digitar(
      secaoDoAjuste().querySelector('[name="motivo"]'),
      "Erro material",
    );
    await clicar(botao("confirmar-cancelamento"));
    await esperar();
    await esperar();
    expect(chamadas(supabase, "cancelar_ajuste_pontuacao")[0][1]).toEqual({
      p_ajuste: "aj1",
      p_motivo: "Erro material",
    });
    expect(
      secaoDoAjuste().querySelector('[data-ajuste="APROVADO"]'),
    ).toBeNull();
    expect(secaoDoAjuste().textContent).toContain("Versões anteriores (1)");
  });

  it("em análise jurídica propõe, mas só aprova depois de deferir", async () => {
    const supabase = supabaseFalso({ situacao: "EM_ANALISE_JURIDICA" });
    supabase.banco.versoes.push({
      id: "aj1",
      versao: 1,
      situacao: "PROPOSTO",
      lista: "PRELIMINAR",
      itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }],
      proposto_em: "2026-10-05T12:00:00Z",
    });
    await montar(supabase);
    const aprovar = botao("aprovar");
    expect(aprovar.disabled).toBe(true);
    expect(aprovar.title).toBe(
      "Defira o recurso (total ou parcialmente) antes de aprovar o ajuste",
    );
    expect(botao("propor").textContent).toBe("Propor nova versão");
  });
});
