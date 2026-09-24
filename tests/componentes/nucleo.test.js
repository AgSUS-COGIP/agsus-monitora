import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarNucleo } from "../../src/componentes/nucleo/nucleo.jsx";
import {
  publicarLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { UNIDADES_CORES } from "../../src/lib/responsavel-do-edital.js";
import { clicar, digitar, escolher, esperar, teclar } from "./interacoes.js";

/*
  A página "Editais" (Equipe Núcleo) em React: a tabela com as linhas que o
  legado publica, o painel operacional sobre o resumo dos cronogramas, o
  formulário do edital com o cronograma e a linha do tempo. "Hoje" é
  15/09/2026.
*/

const HOJE = new Date(2026, 8, 15, 10);

const UNIDADES = [
  {
    id_unidade: "U1",
    sigla: "DSEI-MAO",
    nome_oficial: "DSEI Manaus",
    tipo: "DSEI",
    uf_sede: "am",
  },
  {
    id_unidade: "U2",
    sigla: "CASAI-SP",
    nome_oficial: "CASAI São Paulo",
    tipo: "CASAI",
    uf_sede: "sp",
  },
];

const LINHAS = () => [
  {
    id: "1",
    unidade: "DSEI Manaus",
    id_unidade: "U1",
    edital: "10/2026",
    processo: "00700.000001/2026-00",
    responsavel: "USI",
    status: "Em andamento",
    etapa: "Análise curricular",
    risco: "Baixo",
    vagas_total: 10,
    contratados: 4,
    vagas_ociosas: 6,
    inscritos: 1308,
    link_edital: "https://exemplo.gov.br/edital-10",
  },
  {
    id: "2",
    unidade: "CASAI São Paulo",
    edital: "11/2026",
    status: "Concluído",
    etapa: "Resultado final",
    risco: "Alto",
    vagas_total: 5,
    contratados: 5,
    vagas_ociosas: 0,
    link_edital: "javascript:alert(1)",
  },
  {
    id: "3",
    unidade: "DSEI Manaus",
    edital: "10/2026",
    status: "Planejado",
    risco: "Baixo",
    vagas_total: 3,
    vagas_ociosas: 9,
  },
];

const RESUMO = [
  {
    id: "1",
    unidade: "DSEI Manaus",
    edital: "10/2026",
    alerta_tipo: "incompleto",
    status: "Em andamento",
    cronograma_total: 2,
  },
  {
    id: "2",
    unidade: "CASAI São Paulo",
    edital: "11/2026",
    alerta_tipo: "ok",
    status: "Concluído",
    cronograma_total: 3,
  },
  {
    id: "3",
    unidade: "DSEI Manaus",
    edital: "10/2026",
    alerta_tipo: "sem_cronograma",
    status: "Planejado",
    cronograma_total: 0,
  },
];

const CRONOGRAMAS = {
  1: {
    monitoramento: {
      edital: "10/2026",
      unidade: "DSEI Manaus",
      cronograma_automatico: true,
    },
    estado: {
      status: "Em andamento",
      etapa: "Análise curricular",
      proxima_atividade: "Resultado",
      percentual: 50,
    },
    etapas: [
      {
        ordem: 1,
        atividade: "Inscrições",
        data_inicio: "2026-09-01",
        data_fim: "2026-09-10",
      },
      {
        ordem: 2,
        atividade: "Análise curricular",
        data_inicio: "2026-09-14",
        data_fim: "2026-09-20",
      },
    ],
    historico: [
      {
        acao: "alteracao",
        motivo: "Cadastro inicial",
        created_at: "2026-09-01T12:00:00Z",
        created_by_email: "ana@agenciasus.org.br",
        total_alteracoes: 2,
      },
    ],
  },
  2: {
    monitoramento: { edital: "11/2026", unidade: "CASAI São Paulo" },
    etapas: [
      {
        ordem: 1,
        atividade: "Publicação do Edital",
        data_inicio: "2026-03-01",
        data_fim: "2026-03-01",
        observacao: "DOU",
      },
      {
        ordem: 2,
        atividade: "Entrevistas",
        data_inicio: "2026-04-01",
        data_fim: "2026-04-05",
      },
      {
        ordem: 3,
        atividade: "Resultado final do Processo Seletivo",
        data_inicio: "2026-05-01",
        data_fim: "2026-05-01",
      },
    ],
    historico: [],
  },
};

function supabaseFalso({ resumo = RESUMO, cronogramas = CRONOGRAMAS } = {}) {
  const auth = { ouvinte: null };
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "x" } },
        error: null,
      }),
      onAuthStateChange: (ouvinte) => {
        auth.ouvinte = ouvinte;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    trocarSessao: (evento, sessao) => auth.ouvinte?.(evento, sessao),
    rpc: vi.fn(async (nome, argumentos) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return { data: resumo, error: null };
      if (nome === "get_monitoramento_cronograma")
        return {
          data: cronogramas[argumentos.p_monitoramento_id] || {},
          error: null,
        };
      if (nome === "salvar_monitoramento_com_cronograma_v2")
        return {
          data: {
            ok: true,
            registro: { id: argumentos.p_payload.id || "novo" },
          },
          error: null,
        };
      return { data: null, error: { message: `RPC inesperada: ${nome}` } };
    }),
  };
}

let controlador = null;
let perfilAtual = null;

async function montar({
  perfil = { perfil: "edital_gestor" },
  supabase = supabaseFalso(),
  toast = vi.fn(),
  confirmar = vi.fn(() => true),
  aoSalvar = vi.fn(async () => {}),
  linhas = LINHAS(),
  publicar = true,
  abrir = true,
} = {}) {
  document.body.innerHTML = `<section id="page-nucleo" class="page active"></section>`;
  perfilAtual = perfil;
  await act(async () => {
    controlador = montarNucleo({
      secao: document.getElementById("page-nucleo"),
      supabase,
      toast,
      loader: () => {},
      getProfile: () => perfilAtual,
      confirmar,
      aoSalvar,
      agora: () => new Date(HOJE),
    });
  });
  if (publicar)
    await act(async () => {
      publicarUnidadesDoCatalogo(UNIDADES);
      publicarLinhasDoMonitoramento(linhas);
    });
  if (abrir) await esperar(() => controlador.render());
  return { supabase, toast, confirmar, aoSalvar };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador?.estado.desligar();
  controlador = null;
  await act(async () => redefinirDadosDoMonitoramento());
  document.body.innerHTML = "";
  delete window.aprovadosController;
  vi.restoreAllMocks();
});

const $ = (id) => document.getElementById(id);
const linhasDaTabela = () =>
  [...document.querySelectorAll("#nucleoRows tr[data-record-id]")].map(
    (tr) => tr.dataset.recordId,
  );
const linha = (id) =>
  document.querySelector(`#nucleoRows tr[data-record-id="${id}"]`);
const cartao = (chave) =>
  document.querySelector(`[data-alert-filter="${chave}"]`);
const abrirEdital = async (id) =>
  clicar(linha(id).querySelector('[aria-label^="Editar"]'));

describe("tabela de editais", () => {
  it("antes de o legado publicar as linhas, diz que está a carregar", async () => {
    await montar({ publicar: false, abrir: false });
    expect($("nucleoRows").textContent).toContain("Carregando editais");
  });

  it("ordena pelo risco e, depois, por quem tem mais vagas ociosas", async () => {
    await montar();
    expect(linhasDaTabela()).toEqual(["2", "3", "1"]);
  });

  it("colore status e risco, e só faz link de endereço http(s)", async () => {
    await montar();
    expect(linha("1").querySelector(".chip.blue").textContent).toBe(
      "Em andamento",
    );
    expect(linha("2").querySelector(".chip.green").textContent).toBe(
      "Concluído",
    );
    expect(linha("2").querySelector(".chip.red").textContent).toBe("Alto");
    expect(linha("1").querySelector("a.link").getAttribute("href")).toBe(
      "https://exemplo.gov.br/edital-10",
    );
    expect(linha("2").querySelector("a")).toBeNull();
    expect(linha("1").querySelectorAll("td.num")[2].textContent).toBe("6");
  });

  it("busca por edital, unidade, status, etapa, risco e processo", async () => {
    await montar();
    await digitar($("nucleoSearch"), "casai");
    expect(linhasDaTabela()).toEqual(["2"]);
    await digitar($("nucleoSearch"), "00700.000001");
    expect(linhasDaTabela()).toEqual(["1"]);
    await digitar($("nucleoSearch"), "nada disso");
    expect($("nucleoRows").textContent).toContain("Nenhum registro encontrado");
  });

  it("quem só consulta não vê Novo nem Editar", async () => {
    await montar({
      perfil: { perfil: "usuario" },
      supabase: supabaseFalso({ resumo: [] }),
    });
    expect($("newEditalBtn")).toBeNull();
    expect(document.querySelector('[aria-label^="Editar"]')).toBeNull();
    expect(linha("1").querySelector(".approved-no-action")).not.toBeNull();
  });

  it("o botão de listas abre o modal da Lista de Aprovados", async () => {
    window.aprovadosController = { openImportModal: vi.fn() };
    await montar();
    await clicar(
      linha("1").querySelector('[aria-label^="Lista de aprovados"]'),
    );
    expect(window.aprovadosController.openImportModal).toHaveBeenCalledWith(
      "1",
      "10/2026 · DSEI Manaus",
    );
  });
});

describe("painel operacional", () => {
  it("mostra os indicadores e o alerta de cada linha, pelo id", async () => {
    await montar();
    expect(cartao("todos").textContent).toContain("3");
    expect(cartao("incompleto").textContent).toContain("1");
    expect(cartao("andamento").textContent).toContain("2");
    // Dois registros com o mesmo edital e a mesma unidade: cada um tem o seu alerta.
    expect(linha("1").querySelector(".nucleo-row-alert").textContent).toContain(
      "incompleto",
    );
    expect(linha("3").querySelector(".nucleo-row-alert").textContent).toContain(
      "Sem cronograma",
    );
    expect(linha("2").querySelector(".nucleo-row-alert")).toBeNull();
    expect(linha("1").dataset.monitoramentoId).toBe("1");
  });

  it("o indicador filtra a tabela, é anunciado e pode ser limpo", async () => {
    await montar();
    await clicar(cartao("sem_cronograma"));
    expect(linhasDaTabela()).toEqual(["3"]);
    expect(cartao("sem_cronograma").getAttribute("aria-pressed")).toBe("true");
    expect(cartao("sem_cronograma").classList.contains("is-active")).toBe(true);
    const tarja = $("nucleoActiveAlertFilter");
    expect(tarja.getAttribute("role")).toBe("status");
    expect(tarja.textContent).toContain("Sem cronograma");

    await clicar($("clearNucleoAlertFilter"));
    expect(linhasDaTabela()).toEqual(["2", "3", "1"]);
    expect($("nucleoActiveAlertFilter").hidden).toBe(true);
  });

  it("reabrir a página com cache não chama a RPC nem recria os cartões", async () => {
    const { supabase } = await montar();
    const card = cartao("incompleto");
    const selo = linha("1").querySelector(".nucleo-row-alert");
    await esperar(() => controlador.render());
    expect(cartao("incompleto")).toBe(card);
    expect(linha("1").querySelector(".nucleo-row-alert")).toBe(selo);
    const pedidos = supabase.rpc.mock.calls.filter(
      ([nome]) => nome === "get_nucleo_cronograma_resumo",
    );
    expect(pedidos).toHaveLength(1);
  });

  it("aberturas simultâneas partilham uma carga", async () => {
    const supabase = supabaseFalso();
    await montar({ supabase, abrir: false });
    await esperar(() =>
      Promise.all([controlador.render(), controlador.render()]),
    );
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("salvar um cronograma invalida o cache", async () => {
    const { supabase } = await montar();
    await act(async () =>
      document.dispatchEvent(new CustomEvent("agsus:nucleo-cronograma-saved")),
    );
    await esperar(() => controlador.render());
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("carregando não é zero; vazio explica o contexto", async () => {
    let entregar;
    const supabase = supabaseFalso();
    supabase.rpc.mockImplementationOnce(
      () => new Promise((resolver) => (entregar = resolver)),
    );
    await montar({ supabase, abrir: false });
    expect($("nucleoKpiGrid").textContent).toBe("");
    const pendente = controlador.render();
    await esperar();
    expect($("nucleoKpiGrid").textContent).toContain("Carregando os alertas");
    await esperar(async () => {
      entregar({ data: [], error: null });
      await pendente;
    });
    expect($("nucleoKpiGrid").textContent).toContain(
      "Nenhum edital ativo na Equipe Núcleo",
    );
  });

  it("erro oferece Tentar de novo, sem mostrar a mensagem do banco", async () => {
    const supabase = supabaseFalso();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "relation does not exist" },
    });
    await montar({ supabase });
    const grade = $("nucleoKpiGrid");
    expect(grade.textContent).toContain("Não foi possível carregar os alertas");
    expect(grade.textContent).not.toContain("relation does not exist");
    await clicar($("nucleoSummaryRetry"));
    expect(cartao("todos")).not.toBeNull();
  });

  it("trocar de usuário apaga o que era da sessão anterior, mesmo a resposta a caminho", async () => {
    let entregar;
    const supabase = supabaseFalso();
    await montar({ supabase, abrir: false });
    supabase.trocarSessao("SIGNED_IN", { user: { id: "ana" } });
    supabase.rpc.mockImplementationOnce(
      () => new Promise((resolver) => (entregar = resolver)),
    );
    const pendente = controlador.render();
    await esperar();
    await act(async () => supabase.trocarSessao("SIGNED_OUT", null));
    await esperar(async () => {
      entregar({ data: RESUMO, error: null });
      await pendente;
    });
    expect(document.querySelector(".nucleo-row-alert")).toBeNull();
    expect(cartao("todos")).toBeNull();
    expect($("nucleoOperationalRefresh").disabled).toBe(false);
  });

  it("o primeiro SIGNED_IN só registra quem é, sem nova carga", async () => {
    const { supabase } = await montar();
    await act(async () =>
      supabase.trocarSessao("SIGNED_IN", { user: { id: "ana" } }),
    );
    expect(cartao("todos")).not.toBeNull();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("formulário do edital", () => {
  it("abre com o edital gravado, a unidade do catálogo e o cronograma", async () => {
    await montar();
    await abrirEdital("1");
    expect($("editModalTitle").textContent).toBe("Editar edital");
    expect($("mProcesso").value).toBe("00700.000001/2026-00");
    expect($("mResponsavel").value).toBe("USI");
    expect($("mUnidade").value).toBe("U1");
    expect($("mUf").value).toBe("AM");
    expect($("mAutoInscritos").textContent).toBe("1.308");
    expect(document.activeElement).toBe($("mProcesso"));
    expect(
      document.querySelectorAll("#cronogramaRows tr[data-cronograma-index]"),
    ).toHaveLength(2);
    expect($("cronogramaHistoryCount").textContent).toBe("1 registro");
    expect($("cronogramaHistory").textContent).toContain("Cadastro inicial");
  });

  it("Novo abre vazio, com o cálculo automático ligado", async () => {
    await montar();
    await clicar($("newEditalBtn"));
    expect($("editModalTitle").textContent).toBe("Novo edital");
    expect($("mEdital").value).toBe("");
    expect($("mCronogramaAutomatico").checked).toBe(true);
    expect($("cronogramaRows").textContent).toContain(
      "Nenhuma etapa cadastrada",
    );
  });

  it("o responsável troca o catálogo de unidades e limpa a escolhida", async () => {
    await montar();
    await abrirEdital("1");
    await escolher($("mResponsavel"), "CORES");
    const opcoes = [...$("mUnidade").options]
      .map((opcao) => opcao.value)
      .filter(Boolean);
    expect(opcoes).toEqual(UNIDADES_CORES);
    expect($("mUnidade").value).toBe("");
    expect($("mUf").value).toBe("");
  });

  it("com o automático, status e etapa são os das datas; sem ele, voltam a ser editáveis", async () => {
    await montar();
    await abrirEdital("1");
    expect($("mStatus").readOnly).toBe(true);
    expect($("mStatus").value).toBe("Em andamento");
    expect($("mEtapa").value).toBe("Análise curricular");
    expect($("cronogramaPercentualPreview").textContent).toBe("50%");

    await clicar($("mCronogramaAutomatico"));
    expect($("mStatus").readOnly).toBe(false);
    expect($("mStatus").value).toBe("Em andamento");
    expect($("cronogramaStatusPreview").textContent).toBe(
      "Cronograma pendente",
    );
  });

  it("valida enquanto se edita: o motivo é obrigatório", async () => {
    await montar();
    await abrirEdital("1");
    const caixa = $("cronogramaValidation");
    // O motivo só é cobrado depois de mexer no cronograma, não ao abrir o modal.
    expect(caixa.textContent).not.toContain("Informe o motivo");
    await clicar($("cronogramaExample"));
    expect(caixa.hidden).toBe(false);
    expect(caixa.textContent).toContain(
      "Informe o motivo da alteração do cronograma.",
    );
    await digitar($("mCronogramaMotivo"), "Ajuste de datas");
    expect(caixa.textContent).not.toContain("Informe o motivo");
  });

  it("status excepcional pede motivo e data da decisão", async () => {
    await montar();
    await abrirEdital("1");
    const detalhe = () =>
      $("mStatusOverrideMotivo").closest(".cronograma-override-detail");
    expect(detalhe().hidden).toBe(true);
    await escolher($("mStatusOverride"), "Suspenso");
    expect(detalhe().hidden).toBe(false);
    expect($("mStatus").value).toBe("Suspenso");
    expect($("cronogramaValidation").textContent).toContain(
      "Status excepcional exige motivo",
    );
  });

  it("o modelo padrão cria as doze etapas e abre o preenchimento em lote", async () => {
    const { confirmar } = await montar();
    await abrirEdital("1");
    await clicar($("cronogramaExample"));
    expect(confirmar).toHaveBeenCalledWith(
      "Substituir o cronograma atual pelo modelo padrão?",
    );
    expect(
      document.querySelectorAll("#cronogramaRows tr[data-cronograma-index]"),
    ).toHaveLength(12);
    expect($("cronogramaBulkDates").hidden).toBe(false);
    expect(document.activeElement).toBe($("cronogramaBulkInput"));

    await digitar($("cronogramaBulkInput"), "17/06/2026\n18 a 20/06/2026");
    await clicar($("cronogramaBulkApply"));
    const datas = (i) => [
      document.querySelectorAll('[data-field="data_inicio"]')[i].value,
      document.querySelectorAll('[data-field="data_fim"]')[i].value,
    ];
    expect(datas(0)).toEqual(["2026-06-17", "2026-06-17"]);
    expect(datas(1)).toEqual(["2026-06-18", "2026-06-20"]);
    expect($("cronogramaBulkFeedback").textContent).toContain(
      "Ainda faltam 10 etapas",
    );

    await digitar($("cronogramaBulkInput"), "amanhã");
    await clicar($("cronogramaBulkApply"));
    expect($("cronogramaBulkFeedback").className).toContain("is-error");
  });

  it("copia o cronograma de outro edital e sugere o motivo", async () => {
    await montar();
    await abrirEdital("1");
    const opcoes = [...$("cronogramaCopySource").options].map(
      (opcao) => opcao.value,
    );
    // Nem o próprio edital, nem quem não tem etapas.
    expect(opcoes).toEqual(["", "2"]);
    expect($("cronogramaCopyApply").disabled).toBe(true);

    await escolher($("cronogramaCopySource"), "2");
    await clicar($("cronogramaCopyApply"));
    const atividades = [
      ...document.querySelectorAll('[data-field="atividade"]'),
    ].map((campo) => campo.value);
    expect(atividades).toEqual([
      "Publicação do Edital",
      "Entrevistas",
      "Resultado final do Processo Seletivo",
    ]);
    expect($("mCronogramaMotivo").value).toBe(
      "Cronograma copiado do edital 11/2026 — CASAI São Paulo",
    );
    expect($("cronogramaCopyFeedback").textContent).toContain(
      "3 etapas copiadas",
    );
  });

  it("salva edital e cronograma numa RPC só, fecha e recarrega pelo legado", async () => {
    const salvo = vi.fn();
    document.addEventListener("agsus:nucleo-cronograma-saved", salvo);
    const { supabase, toast, aoSalvar } = await montar();
    await abrirEdital("1");
    await digitar($("mCronogramaMotivo"), "Ajuste de datas");
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    document.removeEventListener("agsus:nucleo-cronograma-saved", salvo);

    const [nome, argumentos] = supabase.rpc.mock.calls[0];
    expect(nome).toBe("salvar_monitoramento_com_cronograma_v2");
    expect(argumentos.p_payload).toMatchObject({
      id: "1",
      edital: "10/2026",
      unidade: "DSEI Manaus",
      id_unidade: "U1",
      uf: "AM",
      status: "Em andamento",
      etapa: "Análise curricular",
      cronograma_automatico: true,
      cronograma_origem: "MANUAL",
      vagas_total: 10,
    });
    expect(argumentos.p_cronograma.map((etapa) => etapa.ordem)).toEqual([1, 2]);
    expect(argumentos.p_motivo).toBe("Ajuste de datas");
    expect(argumentos.p_numero_errata).toBeNull();
    expect($("editModal")).toBeNull();
    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(salvo).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenLastCalledWith(
      "10/2026 salvo. 2 etapa(s) registradas e histórico atualizado.",
    );
  });

  it("erro de validação não chega ao banco", async () => {
    const { supabase, toast } = await montar();
    await clicar($("newEditalBtn"));
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(toast).toHaveBeenLastCalledWith(
      "Informe pelo menos edital e unidade.",
      "warn",
    );
    expect($("editModal")).not.toBeNull();
  });

  it("aviso pede confirmação; sem ela, não salva", async () => {
    const confirmar = vi.fn(() => false);
    const { supabase } = await montar({ confirmar });
    await abrirEdital("1");
    await digitar($("mCronogramaMotivo"), "Ajuste");
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    expect(confirmar).toHaveBeenCalledWith(
      expect.stringContaining("ponto(s) para revisão"),
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("falha ao ler o cronograma aparece no formulário", async () => {
    const supabase = supabaseFalso();
    supabase.rpc.mockImplementation(async (nome) =>
      nome === "get_monitoramento_cronograma"
        ? { data: null, error: { message: "sem permissão" } }
        : { data: RESUMO, error: null },
    );
    await montar({ supabase });
    await abrirEdital("1");
    expect($("cronogramaValidation").textContent).toContain(
      "Erro ao carregar cronograma: sem permissão",
    );
  });

  it("Esc fecha e devolve o foco ao botão que abriu", async () => {
    await montar();
    const botao = linha("1").querySelector('[aria-label^="Editar"]');
    botao.focus();
    await clicar(botao);
    await teclar(document, "Escape");
    expect($("editModal")).toBeNull();
    expect(document.activeElement).toBe(botao);
  });
});

describe("linha do tempo", () => {
  it("mostra a situação de cada etapa e o histórico", async () => {
    await montar();
    await clicar(linha("1").querySelector(".nucleo-view-timeline"));
    expect($("nucleoTimelineTitle").textContent).toBe("10/2026");
    expect($("nucleoTimelineSubtitle").textContent).toBe("DSEI Manaus");
    const situacoes = [
      ...document.querySelectorAll(".nucleo-timeline-item"),
    ].map((item) =>
      [...item.classList].find((classe) => classe.startsWith("is-")),
    );
    expect(situacoes).toEqual(["is-done", "is-current"]);
    expect($("nucleoTimelineContent").textContent).toContain("50%");
    expect($("nucleoTimelineContent").textContent).toContain(
      "Cadastro inicial",
    );

    await clicar($("closeNucleoTimeline"));
    expect($("nucleoTimelineModal")).toBeNull();
  });
});
