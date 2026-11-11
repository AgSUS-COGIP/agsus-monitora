import { act } from "react";
import type { Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { criarNucleo } from "../../src/modulos/editais/nucleo.tsx";
import type { OpcoesDaPaginaDoNucleo } from "../../src/modulos/editais/nucleo.tsx";
import type { RespostaDaRpc } from "../../src/modulos/editais/resumo.ts";
import type {
  ControladoresDasTelas,
  ViewDeTela,
} from "../../src/app/registro-das-telas.ts";
import { definido } from "../definido.ts";
import { authFalso, sessaoFalsa } from "../supabase-falso.ts";
import type { OuvinteDaSessao } from "../supabase-falso.ts";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import {
  definirAreaAtual,
  publicarLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { UNIDADES_CORES } from "../../src/lib/responsavel-do-edital.ts";
import { clicar, digitar, escolher, esperar, teclar } from "./interacoes.ts";
import { montarTela } from "../montar-tela.ts";
import { registrarTelas } from "../../src/app/registro-das-telas.ts";
import { criarNavegacao } from "../../src/app/navegacao.ts";
import { montarTelasNoTeste } from "../app/telas-no-teste.ts";

/*
  A página "Editais" (Equipe Núcleo) em React: a tabela com as linhas que o
  legado publica, o painel operacional sobre o resumo dos cronogramas, o
  formulário do edital com o cronograma e a linha do tempo. "Hoje" é
  15/09/2026.
*/

const HOJE = new Date(2026, 8, 15, 10);

// O formulário do edital chega por import() (lazy): já baixado, abre no clique.
beforeAll(() => import("../../src/modulos/editais/modal-do-edital.tsx"));

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

const CRONOGRAMAS: Record<string, object> = {
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

/* TA_UNIDADE_AREA como está no banco (29/09/2026: CCE e Escritório passaram a Projetos). */
const UNIDADES_POR_AREA = [
  { unidade: "CCE", area: "projetos" },
  { unidade: "Escritório Distrital e Regional", area: "projetos" },
  { unidade: "SEDE", area: "sede" },
  { unidade: "MFC", area: "projetos" },
  {
    unidade: "Projeto Agora Tem Especialistas Caminhoneiros",
    area: "projetos",
  },
  { unidade: "Rio Doce", area: "projetos" },
  { unidade: "Saúde nas Fronteiras", area: "projetos" },
];

/* Os argumentos que as RPCs de Editais recebem neste teste. */
type ArgumentosDoNucleo = {
  p_monitoramento_id?: string | number;
  p_id?: string;
  p_area?: string;
  p_edital?: string;
  p_payload?: Record<string, unknown>;
  p_motivo?: unknown;
  p_numero_errata?: unknown;
  p_cronograma?: Record<string, unknown>[];
  p_dados?: { linhas?: unknown[] };
};

type RpcDoNucleo = (
  nome: string,
  argumentos?: ArgumentosDoNucleo,
) => Promise<RespostaDaRpc>;

function supabaseFalso({
  resumo = RESUMO,
  cronogramas = CRONOGRAMAS,
}: { resumo?: object[]; cronogramas?: Record<string, object> } = {}) {
  const auth: { ouvinte: OuvinteDaSessao | null } = { ouvinte: null };
  return {
    auth: authFalso("x", (ouvinte) => {
      auth.ouvinte = ouvinte;
    }),
    /* A sessão do teste só traz o usuário; o resto da Session é neutro. */
    trocarSessao: (
      evento: AuthChangeEvent,
      sessao: { user: { id: string } } | null,
    ) =>
      auth.ouvinte?.(
        evento,
        sessao && {
          ...sessaoFalsa("x"),
          user: { ...sessaoFalsa("x").user, ...sessao.user },
        },
      ),
    rpc: vi.fn<RpcDoNucleo>(async (nome, argumentos) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return { data: resumo, error: null };
      if (nome === "get_monitoramento_cronograma")
        return {
          data:
            cronogramas[String(definido(argumentos).p_monitoramento_id)] || {},
          error: null,
        };
      if (nome === "listar_unidades_por_area")
        return { data: UNIDADES_POR_AREA, error: null };
      if (nome === "mover_edital_de_area")
        return {
          data: {
            ok: true,
            id: definido(argumentos).p_id,
            para: definido(argumentos).p_area,
          },
          error: null,
        };
      if (nome === "salvar_monitoramento_com_cronograma_v2")
        return {
          data: {
            ok: true,
            registro: {
              id: definido(definido(argumentos).p_payload).id || "novo",
            },
          },
          error: null,
        };
      return { data: null, error: { message: `RPC inesperada: ${nome}` } };
    }),
  };
}

type ControladorDoNucleo = ReturnType<typeof criarNucleo> & {
  raiz: Pick<Root, "unmount"> | null;
};
let navegacao: ReturnType<typeof criarNavegacao> | null = null;

/*
  Uma tela de mentira no registro: só o que o teste usa. O resto do
  controlador não existe (quem o chamar quebra, como no JavaScript).
*/
type Parcial<T> = {
  [K in keyof T]?: T[K] extends (...argumentos: infer A) => unknown
    ? (...argumentos: A) => unknown
    : T[K] | null;
};
function telaDeMentira<V extends ViewDeTela>(
  parcial: Parcial<ControladoresDasTelas[V]>,
): ControladoresDasTelas[V] {
  return parcial as ControladoresDasTelas[V];
}
let controlador: ControladorDoNucleo | null = null;
let perfilAtual: unknown = null;

async function montar({
  perfil = { perfil: "edital_gestor" },
  supabase = supabaseFalso(),
  toast = vi.fn(),
  confirmar = vi.fn(() => true),
  aoSalvar = vi.fn(async () => {}),
  linhas = LINHAS(),
  publicar = true,
  abrir = true,
  relogio = true,
  comNavegacao = false,
}: {
  perfil?: unknown;
  supabase?: ReturnType<typeof supabaseFalso>;
  toast?: ReturnType<typeof vi.fn<(mensagem: string, tom?: string) => void>>;
  confirmar?: ReturnType<typeof vi.fn<(mensagem: string) => boolean>>;
  aoSalvar?: ReturnType<typeof vi.fn<() => Promise<void>>>;
  linhas?: object[];
  publicar?: boolean;
  abrir?: boolean;
  relogio?: boolean;
  comNavegacao?: boolean;
} = {}) {
  perfilAtual = perfil;
  if (comNavegacao) {
    /*
      Como no app: Editais é rota da raiz, e as Regras do edital ficam no
      endereço (src/app/navegacao.ts).
    */
    document.body.innerHTML = "";
    const criado = criarNucleo({
      supabase,
      toast,
      loader: () => {},
      getProfile: () => perfilAtual,
      confirmar,
      aoSalvar,
      agora: relogio ? () => new Date(HOJE) : undefined,
    });
    const montado = montarTelasNoTeste(
      criarNavegacao({
        janela: { location: { reload() {} } },
        obterPerfil: () => ({
          id: "g",
          ativo: true,
          perfil: "edital_gestor",
          areas: ["saude-indigena", "sede", "projetos"],
        }),
        confirmarSaida: () => true,
        aplicarAtualizacao: () => false,
      }),
      { nucleo: criado },
    );
    navegacao = montado.navegacao;
    definido(navegacao).irPara("nucleo");
    controlador = { ...criado, raiz: { unmount: () => montado.desmontar() } };
  } else {
    document.body.innerHTML = `<section id="page-nucleo" class="page active"></section>`;
  }
  if (!comNavegacao)
    await act(async () => {
      controlador = montarTela<
        OpcoesDaPaginaDoNucleo,
        ReturnType<typeof criarNucleo>
      >(criarNucleo, "page-nucleo", {
        secao: document.getElementById("page-nucleo"),
        supabase,
        toast,
        loader: () => {},
        getProfile: () => perfilAtual,
        confirmar,
        aoSalvar,
        // relogio: false monta como em produção, sem relógio injetado.
        agora: relogio ? () => new Date(HOJE) : undefined,
      });
    });
  if (publicar)
    await act(async () => {
      publicarUnidadesDoCatalogo(UNIDADES);
      publicarLinhasDoMonitoramento(linhas);
    });
  if (abrir) await esperar(() => definido(controlador).render());
  return { supabase, toast, confirmar, aoSalvar };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.localStorage.clear();
});

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador?.estado.desligar();
  controlador = null;
  await act(async () => redefinirDadosDoMonitoramento());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const $ = (id: string) => document.getElementById(id);
const campo = (id: string) =>
  document.querySelector<HTMLInputElement>(`#${id}`);
const seletor = (id: string) =>
  document.querySelector<HTMLSelectElement>(`#${id}`);
const areaDeTexto = (id: string) =>
  document.querySelector<HTMLTextAreaElement>(`#${id}`);
const botaoPorId = (id: string) =>
  document.querySelector<HTMLButtonElement>(`#${id}`);
const linhasDaTabela = () =>
  [
    ...document.querySelectorAll<HTMLElement>("#nucleoRows tr[data-record-id]"),
  ].map((tr) => tr.dataset.recordId);
const linha = (id: string) =>
  document.querySelector<HTMLElement>(`#nucleoRows tr[data-record-id="${id}"]`);
/* O indicador clicável (o botão do Kpi); o skeleton não tem botão. */
const cartao = (chave: string) =>
  document.querySelector<HTMLElement>(
    `#nucleoOperationalKpis [data-kpi="${chave}"] .ui-kpi-alvo`,
  );
const indicadores = () => $("nucleoOperationalKpis");
const atualizar = () =>
  document.querySelector<HTMLButtonElement>(
    '#page-nucleo [data-acao="atualizar"]',
  );
const abrirEdital = async (id: string) =>
  clicar(linha(id)?.querySelector<HTMLElement>('[aria-label^="Editar"]'));

describe("tabela de editais", () => {
  it("antes de o legado publicar as linhas, a tabela e os KPIs são skeleton", async () => {
    await montar({ publicar: false, abrir: false });
    expect($("nucleoRows")?.getAttribute("aria-busy")).toBe("true");
    expect(
      $("nucleoRows")?.querySelectorAll<HTMLElement>(".ui-esqueleto-tr").length,
    ).toBe(8);
    expect($("nucleoRows")?.textContent).toBe("");
    expect(
      indicadores()?.querySelectorAll<HTMLElement>('.ui-kpi[aria-busy="true"]'),
    ).toHaveLength(8);
    // ED-1.4: os cartões de situação também nascem skeleton.
    expect(
      indicadores()
        ?.querySelector<HTMLElement>('[data-kpi="ativos"]')
        ?.getAttribute("aria-busy"),
    ).toBe("true");
    expect(
      document.querySelector<HTMLElement>("#page-nucleo [data-status-da-carga]")
        ?.textContent,
    ).toBe("Carregando dados…");
  });

  it("ordena pelo risco e, depois, por quem tem mais vagas ociosas", async () => {
    await montar();
    expect(linhasDaTabela()).toEqual(["2", "3", "1"]);
  });

  it("colore status e risco, e só faz link de endereço http(s)", async () => {
    await montar();
    const selo = (id: string, tom: string) =>
      linha(id)?.querySelector<HTMLElement>(`.ui-selo[data-tom="${tom}"]`)
        ?.textContent;
    expect(selo("1", "info")).toBe("Em andamento");
    expect(selo("2", "sucesso")).toBe("Concluído");
    expect(selo("2", "perigo")).toBe("Alto");
    expect(
      linha("1")?.querySelector<HTMLElement>("a.link")?.getAttribute("href"),
    ).toBe("https://exemplo.gov.br/edital-10");
    expect(linha("2")?.querySelector<HTMLElement>("a")).toBeNull();
    expect(
      linha("1")?.querySelectorAll<HTMLElement>("td.num")[2]?.textContent,
    ).toBe("6");
  });

  it("busca por edital, unidade, status, etapa, risco e processo", async () => {
    await montar();
    await digitar($("nucleoSearch"), "casai");
    expect(linhasDaTabela()).toEqual(["2"]);
    await digitar($("nucleoSearch"), "00700.000001");
    expect(linhasDaTabela()).toEqual(["1"]);
    await digitar($("nucleoSearch"), "nada disso");
    expect($("nucleoRows")?.textContent).toContain(
      "Nenhum registro encontrado",
    );
  });

  it("quem só consulta não vê Novo nem Editar", async () => {
    await montar({
      perfil: { perfil: "usuario" },
      supabase: supabaseFalso({ resumo: [] }),
    });
    expect($("newEditalBtn")).toBeNull();
    expect(
      document.querySelector<HTMLElement>('[aria-label^="Editar"]'),
    ).toBeNull();
    expect(
      linha("1")?.querySelector<HTMLElement>(".approved-no-action"),
    ).not.toBeNull();
  });

  it("o botão de listas abre o modal da Lista de Aprovados (pelo registro das telas)", async () => {
    const aprovados = {
      nome: "Lista de aprovados",
      conteudo: null,
      render() {},
      openImportModal: vi.fn(),
    };
    registrarTelas({
      approved: {
        carregar: async () => telaDeMentira<"approved">(aprovados),
      },
    });
    try {
      await montar();
      await clicar(
        linha("1")?.querySelector<HTMLElement>(
          '[aria-label^="Lista de aprovados"]',
        ),
      );
      await vi.waitFor(() =>
        expect(aprovados.openImportModal).toHaveBeenCalledWith(
          "1",
          "10/2026 · DSEI Manaus",
        ),
      );
    } finally {
      registrarTelas({});
    }
  });

  it("Regras do edital: abre no lugar da tabela, com o edital e a etapa no endereço, troca de etapa e volta", async () => {
    // O pacote da página baixa sob demanda; aqui, já em cache.
    await import("../../src/modulos/regras-do-edital/regras-do-edital.tsx");
    await montar({ comNavegacao: true });
    const pagina = async () => {
      for (let i = 0; i < 200; i += 1) {
        const achada = document.querySelector<HTMLElement>(
          "[data-tour='regras-do-edital']",
        );
        if (achada) return achada;
        await act(async () => new Promise((r) => setTimeout(r, 25)));
      }
      return null;
    };
    await clicar(
      linha("1")?.querySelector<HTMLElement>(
        '[aria-label^="Regras do edital"]',
      ),
    );
    const regras = await pagina();
    expect(regras).not.toBeNull();
    expect(regras?.dataset.etapa).toBe("triagem");
    expect(regras?.textContent).toContain("Regras do edital 10/2026");
    expect(location.pathname).toMatch(/\/editais\/1\/regras\/triagem$/);
    expect(
      [
        ...definido(regras).querySelectorAll<HTMLElement>(
          ".ui-segmentado button",
        ),
      ].map((b) => b.textContent?.trim()),
    ).toEqual([
      "1 Triagem",
      "2 Avaliação documental",
      "3 Entrevista",
      "4 Classificação",
      "5 Chamada para contratação",
    ]);
    expect(document.getElementById("nucleoRows")).toBeNull();

    // Outra etapa: troca o endereço sem empilhar.
    const tamanho = history.length;
    await clicar(
      [
        ...definido(regras).querySelectorAll<HTMLElement>(
          ".ui-segmentado button",
        ),
      ].find((b) => b.textContent?.includes("Classificação")),
    );
    expect((await pagina())?.dataset.etapa).toBe("classificacao");
    expect(location.pathname).toMatch(/\/editais\/1\/regras\/classificacao$/);
    expect(history.length).toBe(tamanho);

    // "← Editais": volta pelo histórico (sem entrada órfã) e a tabela volta.
    await act(async () => {
      const voltou = new Promise((r) =>
        window.addEventListener("popstate", r, { once: true }),
      );
      document
        .querySelector<HTMLElement>("[data-acao='voltar-aos-editais']")
        ?.click();
      await voltou;
    });
    expect(
      document.querySelector<HTMLElement>("[data-tour='regras-do-edital']"),
    ).toBeNull();
    expect(document.getElementById("nucleoRows")).not.toBeNull();
    expect(location.pathname).toMatch(/\/editais$/);
    expect(definido(navegacao).obter().regras).toBeNull();
  });

  it("Regras do edital no histórico: o voltar do navegador fecha a página, o avançar reabre", async () => {
    await import("../../src/modulos/regras-do-edital/regras-do-edital.tsx");
    await montar({ comNavegacao: true });
    definido(navegacao).abrirEntrada();
    await clicar(
      linha("1")?.querySelector<HTMLElement>(
        '[aria-label^="Regras do edital"]',
      ),
    );
    expect(definido(navegacao).obter().regras).toEqual({
      edital: "1",
      etapa: "triagem",
    });
    await act(async () => {
      const mudou = new Promise((r) =>
        window.addEventListener("popstate", r, { once: true }),
      );
      history.back();
      await mudou;
    });
    expect(definido(navegacao).obter().regras).toBeNull();
    expect(
      document.querySelector<HTMLElement>("[data-tour='regras-do-edital']"),
    ).toBeNull();
    await act(async () => {
      const mudou = new Promise((r) =>
        window.addEventListener("popstate", r, { once: true }),
      );
      history.forward();
      await mudou;
    });
    expect(definido(navegacao).obter().regras).toEqual({
      edital: "1",
      etapa: "triagem",
    });
  });
});

describe("painel operacional", () => {
  it("mostra os indicadores e o alerta de cada linha, pelo id", async () => {
    await montar();
    expect(cartao("todos")?.textContent).toContain("3");
    expect(cartao("incompleto")?.textContent).toContain("1");
    expect(cartao("andamento")?.textContent).toContain("2");
    // Dois registros com o mesmo edital e a mesma unidade: cada um tem o seu alerta.
    expect(
      linha("1")?.querySelector<HTMLElement>(".nucleo-row-alert")?.textContent,
    ).toContain("incompleto");
    expect(
      linha("3")?.querySelector<HTMLElement>(".nucleo-row-alert")?.textContent,
    ).toContain("Sem cronograma");
    expect(
      linha("2")?.querySelector<HTMLElement>(".nucleo-row-alert"),
    ).toBeNull();
    expect(linha("1")?.dataset.monitoramentoId).toBe("1");
  });

  it("o indicador filtra a tabela, é anunciado e pode ser limpo", async () => {
    await montar();
    await clicar(cartao("sem_cronograma"));
    expect(linhasDaTabela()).toEqual(["3"]);
    expect(cartao("sem_cronograma")?.getAttribute("aria-pressed")).toBe("true");
    expect(
      cartao("sem_cronograma")
        ?.closest(".ui-kpi")
        ?.classList.contains("is-ativo"),
    ).toBe(true);
    const tarja = definido($("nucleoActiveAlertFilter"));
    expect(tarja.getAttribute("role")).toBe("status");
    expect(tarja.textContent).toContain("Sem cronograma");

    await clicar(tarja.querySelector<HTMLElement>(".ui-chip"));
    expect(linhasDaTabela()).toEqual(["2", "3", "1"]);
    expect($("nucleoActiveAlertFilter")).toBeNull();
  });

  /* Histórias em docs/historias-de-usuario/editais.md. */
  it("ED-1.1 — mostra Editais ativos e inativos no formato dos outros cartões", async () => {
    await montar();
    const ativos = definido(cartao("ativos"));
    const inativos = definido(cartao("inativos"));
    expect(ativos.textContent).toContain("Editais ativos");
    expect(
      ativos.querySelector<HTMLElement>(".ui-kpi-valor")?.textContent,
    ).toBe("2");
    expect(inativos.textContent).toContain("Editais inativos");
    expect(
      inativos.querySelector<HTMLElement>(".ui-kpi-valor")?.textContent,
    ).toBe("1");
    expect(cartao("todos")?.textContent).toContain("Total de editais");
    expect(
      ativos.closest(".ui-kpi")?.querySelector<HTMLElement>(".ui-kpi-icone"),
    ).not.toBe(null);
  });

  it("ED-2.1/2.2/2.3/2.4 — clicar filtra, clicar de novo tira; o chip diz Situação", async () => {
    await montar();
    await clicar(cartao("inativos"));
    expect(linhasDaTabela()).toEqual(["2"]);
    expect(cartao("inativos")?.getAttribute("aria-pressed")).toBe("true");
    expect($("nucleoActiveAlertFilter")?.textContent).toContain("Situação");
    expect($("nucleoActiveAlertFilter")?.textContent).toContain(
      "Editais inativos",
    );

    // ED-2.2: o mesmo cartão de novo tira o filtro.
    await clicar(cartao("inativos"));
    expect(linhasDaTabela()).toEqual(["2", "3", "1"]);
    expect($("nucleoActiveAlertFilter")).toBeNull();

    // ED-2.3: o "x" do chip tira.
    await clicar(cartao("ativos"));
    expect(linhasDaTabela()).toEqual(["3", "1"]);
    await clicar(
      $("nucleoActiveAlertFilter")?.querySelector<HTMLElement>(".ui-chip"),
    );
    expect(linhasDaTabela()).toEqual(["2", "3", "1"]);

    // ED-2.4: outro indicador troca o filtro.
    await clicar(cartao("ativos"));
    await clicar(cartao("sem_cronograma"));
    expect(linhasDaTabela()).toEqual(["3"]);
    expect(cartao("ativos")?.getAttribute("aria-pressed")).toBe("false");
    expect($("nucleoActiveAlertFilter")?.textContent).toContain("Alerta");
  });

  it("reabrir a página com cache não chama a RPC nem recria os cartões", async () => {
    const { supabase } = await montar();
    const card = definido(cartao("incompleto"));
    const selo = linha("1")?.querySelector<HTMLElement>(".nucleo-row-alert");
    await esperar(() => definido(controlador).render());
    expect(cartao("incompleto")).toBe(card);
    expect(linha("1")?.querySelector<HTMLElement>(".nucleo-row-alert")).toBe(
      selo,
    );
    const pedidos = supabase.rpc.mock.calls.filter(
      ([nome]) => nome === "get_nucleo_cronograma_resumo",
    );
    expect(pedidos).toHaveLength(1);
  });

  it("aberturas simultâneas partilham uma carga", async () => {
    const supabase = supabaseFalso();
    await montar({ supabase, abrir: false });
    await esperar(() =>
      Promise.all([
        definido(controlador).render(),
        definido(controlador).render(),
      ]),
    );
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("salvar um cronograma invalida o cache", async () => {
    const { supabase } = await montar();
    await act(async () =>
      document.dispatchEvent(new CustomEvent("agsus:nucleo-cronograma-saved")),
    );
    await esperar(() => definido(controlador).render());
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("carregando não é zero (skeleton); vazio é curto", async () => {
    let entregar: ((resposta: RespostaDaRpc) => void) | undefined;
    const supabase = supabaseFalso();
    supabase.rpc.mockImplementationOnce(
      () => new Promise<RespostaDaRpc>((resolver) => (entregar = resolver)),
    );
    await montar({ supabase, abrir: false });
    const esqueleto = () =>
      indicadores()?.querySelectorAll<HTMLElement>('.ui-kpi[aria-busy="true"]');
    expect(esqueleto()).toHaveLength(8);
    expect(
      indicadores()?.querySelector<HTMLElement>("b.ui-kpi-valor"),
    ).toBeNull();
    expect(cartao("todos")).toBeNull();
    const pendente = definido(controlador).render();
    await esperar();
    expect(esqueleto()).toHaveLength(8);
    await esperar(async () => {
      definido(entregar)({ data: [], error: null });
      await pendente;
    });
    expect(indicadores()?.textContent).toContain("Nenhum edital nesta área.");
  });

  it("erro oferece Tentar de novo, sem mostrar a mensagem do banco", async () => {
    const supabase = supabaseFalso();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "relation does not exist" },
    });
    await montar({ supabase });
    const grade = definido(indicadores());
    expect(
      grade.querySelector<HTMLElement>('[role="alert"]')?.textContent,
    ).toContain("Não foi possível carregar os alertas dos editais");
    expect(grade.textContent).not.toContain("relation does not exist");
    expect($("nucleoSummaryRetry")?.textContent).toContain("Tentar novamente");
    await clicar($("nucleoSummaryRetry"));
    expect(cartao("todos")).not.toBeNull();
  });

  it("trocar de usuário apaga o que era da sessão anterior, mesmo a resposta a caminho", async () => {
    let entregar: ((resposta: RespostaDaRpc) => void) | undefined;
    const supabase = supabaseFalso();
    await montar({ supabase, abrir: false });
    supabase.trocarSessao("SIGNED_IN", { user: { id: "ana" } });
    supabase.rpc.mockImplementationOnce(
      () => new Promise<RespostaDaRpc>((resolver) => (entregar = resolver)),
    );
    const pendente = definido(controlador).render();
    await esperar();
    await act(async () => supabase.trocarSessao("SIGNED_OUT", null));
    await esperar(async () => {
      definido(entregar)({ data: RESUMO, error: null });
      await pendente;
    });
    expect(document.querySelector<HTMLElement>(".nucleo-row-alert")).toBeNull();
    expect(cartao("todos")).toBeNull();
    expect(atualizar()?.disabled).toBe(false);
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
    expect($("editModalTitle")?.textContent).toBe("Editar edital");
    expect(campo("mProcesso")?.value).toBe("00700.000001/2026-00");
    expect(seletor("mResponsavel")?.value).toBe("USI");
    expect(seletor("mUnidade")?.value).toBe("U1");
    expect(campo("mUf")?.value).toBe("AM");
    expect($("mAutoInscritos")?.textContent).toBe("1.308");
    expect(document.activeElement).toBe($("mProcesso"));
    expect(
      document.querySelectorAll<HTMLElement>(
        "#cronogramaRows tr[data-cronograma-index]",
      ),
    ).toHaveLength(2);
    expect($("cronogramaHistoryCount")?.textContent).toBe("1 registro");
    expect($("cronogramaHistory")?.textContent).toContain("Cadastro inicial");
  });

  it("Novo abre vazio, com o cálculo automático ligado", async () => {
    await montar();
    await clicar($("newEditalBtn"));
    expect($("editModalTitle")?.textContent).toBe("Novo edital");
    expect(campo("mEdital")?.value).toBe("");
    expect(campo("mCronogramaAutomatico")?.checked).toBe(true);
    expect($("cronogramaRows")?.textContent).toContain(
      "Nenhuma etapa cadastrada",
    );
  });

  it("o responsável troca o catálogo de unidades e limpa a escolhida", async () => {
    await montar();
    await abrirEdital("1");
    await escolher($("mResponsavel"), "CORES");
    const opcoes = () =>
      [...definido(seletor("mUnidade")).options]
        .map((opcao) => opcao.value)
        .filter((valor) => valor && valor !== "__nova__");
    // Edital da Saúde Indígena: as unidades do CORES são da SEDE ou de Projetos.
    expect(opcoes()).toEqual([]);
    expect(seletor("mUnidade")?.value).toBe("");
    expect(campo("mUf")?.value).toBe("");
    await escolher($("mResponsavel"), "USI");
    expect(opcoes()).toEqual(["U2", "U1"]);
  });

  it("sem área definida (a RPC falhou), o CORES mostra as sete unidades", async () => {
    const supabase = supabaseFalso();
    const original = definido(supabase.rpc.getMockImplementation());
    supabase.rpc.mockImplementation(async (nome, argumentos) =>
      nome === "listar_unidades_por_area"
        ? { data: null, error: { message: "ainda não existe" } }
        : original(nome, argumentos),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await montar({ supabase });
    await abrirEdital("1");
    await escolher($("mResponsavel"), "CORES");
    expect(
      [...definido(seletor("mUnidade")).options]
        .map((opcao) => opcao.value)
        .filter((valor) => valor && valor !== "__nova__"),
    ).toEqual(UNIDADES_CORES);
  });

  it("com o automático, status e etapa são os das datas; sem ele, voltam a ser editáveis", async () => {
    await montar();
    await abrirEdital("1");
    expect(campo("mStatus")?.readOnly).toBe(true);
    expect(campo("mStatus")?.value).toBe("Em andamento");
    expect(campo("mEtapa")?.value).toBe("Análise curricular");
    expect($("cronogramaPercentualPreview")?.textContent).toBe("50%");

    await clicar($("mCronogramaAutomatico"));
    expect(campo("mStatus")?.readOnly).toBe(false);
    expect(campo("mStatus")?.value).toBe("Em andamento");
    expect($("cronogramaStatusPreview")?.textContent).toBe(
      "Cronograma pendente",
    );
  });

  it("valida enquanto se edita: o motivo é obrigatório", async () => {
    await montar();
    await abrirEdital("1");
    const caixa = definido($("cronogramaValidation"));
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

  it("edital novo não pede justificativa, nem ao mexer no cronograma nem ao salvar", async () => {
    const { supabase, toast } = await montar();
    await clicar($("newEditalBtn"));
    expect($("editModalTitle")?.textContent).not.toBe("Editar edital");
    await digitar($("mEdital"), "20/2026");
    await escolher($("mUnidade"), "U1");
    // Mexer no cronograma (desligar o automático) é o que cobrava o motivo.
    await clicar($("mCronogramaAutomatico"));
    expect($("cronogramaValidation")?.textContent).not.toContain(
      "Informe o motivo",
    );
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_monitoramento_com_cronograma_v2",
    );
    expect(chamada, JSON.stringify(toast.mock.calls.slice(-1))).toBeTruthy();
    // Sem motivo: o banco registra "Cadastro do edital" no histórico.
    expect(chamada?.[1]?.p_motivo).toBe("");
    expect(chamada?.[1]?.p_payload?.id ?? "").toBe("");
  });

  it("status excepcional pede motivo e data da decisão", async () => {
    await montar();
    await abrirEdital("1");
    const detalhe = () =>
      $("mStatusOverrideMotivo")?.closest<HTMLElement>(
        ".cronograma-override-detail",
      );
    expect(detalhe()?.hidden).toBe(true);
    await escolher($("mStatusOverride"), "Suspenso");
    expect(detalhe()?.hidden).toBe(false);
    expect(campo("mStatus")?.value).toBe("Suspenso");
    expect($("cronogramaValidation")?.textContent).toContain(
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
      document.querySelectorAll<HTMLElement>(
        "#cronogramaRows tr[data-cronograma-index]",
      ),
    ).toHaveLength(12);
    expect($("cronogramaBulkDates")?.hidden).toBe(false);
    expect(document.activeElement).toBe($("cronogramaBulkInput"));

    await digitar($("cronogramaBulkInput"), "17/06/2026\n18 a 20/06/2026");
    await clicar($("cronogramaBulkApply"));
    const datas = (i: number) => [
      document.querySelectorAll<HTMLInputElement>('[data-field="data_inicio"]')[
        i
      ]?.value,
      document.querySelectorAll<HTMLInputElement>('[data-field="data_fim"]')[i]
        ?.value,
    ];
    expect(datas(0)).toEqual(["2026-06-17", "2026-06-17"]);
    expect(datas(1)).toEqual(["2026-06-18", "2026-06-20"]);
    expect($("cronogramaBulkFeedback")?.textContent).toContain(
      "Ainda faltam 10 etapas",
    );

    await digitar($("cronogramaBulkInput"), "amanhã");
    await clicar($("cronogramaBulkApply"));
    expect($("cronogramaBulkFeedback")?.className).toContain("is-error");
  });

  it("copia o cronograma de outro edital e sugere o motivo", async () => {
    await montar();
    await abrirEdital("1");
    const opcoes = [...definido(seletor("cronogramaCopySource")).options].map(
      (opcao) => opcao.value,
    );
    // Nem o próprio edital, nem quem não tem etapas.
    expect(opcoes).toEqual(["", "2"]);
    expect(botaoPorId("cronogramaCopyApply")?.disabled).toBe(true);

    await escolher($("cronogramaCopySource"), "2");
    await clicar($("cronogramaCopyApply"));
    const atividades = [
      ...document.querySelectorAll<HTMLInputElement>(
        '[data-field="atividade"]',
      ),
    ].map((campo) => campo.value);
    expect(atividades).toEqual([
      "Publicação do Edital",
      "Entrevistas",
      "Resultado final do Processo Seletivo",
    ]);
    expect(areaDeTexto("mCronogramaMotivo")?.value).toBe(
      "Cronograma copiado do edital 11/2026 — CASAI São Paulo",
    );
    expect($("cronogramaCopyFeedback")?.textContent).toContain(
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

    const [nome, argumentos] = definido(supabase.rpc.mock.calls[0]);
    expect(nome).toBe("salvar_monitoramento_com_cronograma_v2");
    expect(argumentos?.p_payload).toMatchObject({
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
    expect(argumentos?.p_cronograma?.map((etapa) => etapa.ordem)).toEqual([
      1, 2,
    ]);
    expect(argumentos?.p_motivo).toBe("Ajuste de datas");
    expect(argumentos?.p_numero_errata).toBeNull();
    expect($("editModal")).toBeNull();
    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(salvo).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenLastCalledWith(
      "10/2026 salvo. 2 etapa(s) registradas e histórico atualizado.",
    );
  });

  it("edital cadastrado: o quadro de vagas do PDF é salvo na hora, sem o Salvar do edital", async () => {
    const supabase = supabaseFalso();
    const original = definido(supabase.rpc.getMockImplementation());
    supabase.rpc.mockImplementation(async (nome, argumentos) =>
      nome === "salvar_quadro_de_vagas"
        ? {
            data: { linhas: definido(definido(argumentos).p_dados).linhas },
            error: null,
          }
        : original(nome, argumentos),
    );
    const resposta = {
      edital: "10/2026",
      cronograma: [],
      vagas: [
        {
          cargo: "Enfermeiro",
          lotacao: "Polo Base Leonardo",
          modalidades: { "Ampla Concorrência": 1 },
          vagas_imediatas: 1,
          cadastro_reserva: true,
        },
        {
          cargo: "Enfermeiro",
          lotacao: "Polo Base Pavuru",
          modalidades: { "Ampla Concorrência": null },
          vagas_imediatas: 0,
          cadastro_reserva: true,
        },
      ],
      modalidades: ["Ampla Concorrência"],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => resposta,
      })),
    );
    try {
      await montar({ supabase });
      await abrirEdital("1");
      const entrada = definido($("anexosArquivo"));
      Object.defineProperty(entrada, "files", {
        value: [
          new File(["%PDF-1.4"], "anexos.pdf", { type: "application/pdf" }),
        ],
      });
      await act(async () => {
        entrada.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await esperar();
      await clicar($("anexosSalvarQuadro"));
      await esperar();
      const [, argumentos] = definido(
        supabase.rpc.mock.calls.find(
          ([nome]) => nome === "salvar_quadro_de_vagas",
        ),
      );
      expect(argumentos?.p_edital).toBe("1");
      expect(argumentos?.p_dados?.linhas).toHaveLength(2);
      expect($("anexosDoEdital")?.textContent).toContain(
        "Quadro de vagas salvo: 2 linhas.",
      );
      expect($("anexosSalvarQuadro")?.textContent).toBe("Quadro salvo");
      expect($("editModal")).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
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
    expect($("cronogramaValidation")?.textContent).toContain(
      "Erro ao carregar cronograma: sem permissão",
    );
  });

  it("Esc fecha e devolve o foco ao botão que abriu", async () => {
    await montar();
    const botao = definido(
      linha("1")?.querySelector<HTMLElement>('[aria-label^="Editar"]'),
    );
    botao.focus();
    await clicar(botao);
    await teclar(document, "Escape");
    expect($("editModal")).toBeNull();
    expect(document.activeElement).toBe(botao);
  });
});

describe("não perder o edital", () => {
  const rascunhosGuardados = () =>
    Object.keys(window.localStorage).filter((chave) =>
      chave.startsWith("agsus_monitora_rascunho_edital_v1:"),
    );
  const botaoDoRodape = (texto: string) =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "#editModal .modal-body button",
      ),
    ].find((botao) => botao.textContent?.trim() === texto);

  it("clicar no fundo escuro não fecha o formulário", async () => {
    await montar();
    await clicar($("newEditalBtn"));
    await digitar($("mEdital"), "20/2026");
    await clicar($("editModal"));
    expect($("editModal")).not.toBeNull();
    expect(campo("mEdital")?.value).toBe("20/2026");
    expect($("editalDescartar")).toBeNull();
  });

  it("sem mudança, Cancelar fecha direto, sem perguntar", async () => {
    await montar();
    await abrirEdital("1");
    await clicar(botaoDoRodape("Cancelar"));
    expect($("editModal")).toBeNull();
    expect(rascunhosGuardados()).toEqual([]);
  });

  it("com mudança, Esc pergunta; Esc de novo volta à edição; Descartar fecha e apaga o rascunho", async () => {
    await montar();
    await abrirEdital("1");
    await digitar($("mObs"), "Anotação que não pode sumir");
    expect(rascunhosGuardados()).toHaveLength(1);

    await teclar(document, "Escape");
    expect($("editModal")).not.toBeNull();
    const pergunta = definido($("editalDescartar"));
    expect(pergunta.getAttribute("role")).toBe("alertdialog");
    expect(pergunta.textContent).toContain("Descartar as alterações?");
    expect(document.activeElement).toBe($("editalContinuar"));

    await teclar(document, "Escape");
    expect($("editalDescartar")).toBeNull();
    expect(areaDeTexto("mObs")?.value).toBe("Anotação que não pode sumir");

    await clicar(botaoDoRodape("Cancelar"));
    await clicar($("editalContinuar"));
    expect($("editModal")).not.toBeNull();

    await clicar(
      [
        ...document.querySelectorAll<HTMLElement>(
          "#editModal .modal-head button",
        ),
      ].find((botao) => botao.textContent?.trim() === "Fechar"),
    );
    await clicar($("editalDescartarConfirmar"));
    expect($("editModal")).toBeNull();
    expect(rascunhosGuardados()).toEqual([]);
  });

  it("reabrir Novo oferece o rascunho: Retomar devolve o que foi digitado", async () => {
    await montar();
    await clicar($("newEditalBtn"));
    await digitar($("mEdital"), "20/2026");
    await escolher($("mUnidade"), "U1");
    // A aba fechou ou a página recarregou: o modal some sem perguntar.
    await act(async () => definido(controlador).estado.fecharModal());

    await clicar($("newEditalBtn"));
    expect(campo("mEdital")?.value).toBe("");
    expect($("editalRascunho")?.textContent).toContain(
      "Há um rascunho de 10:00.",
    );
    await clicar($("editalRascunhoRetomar"));
    expect($("editalRascunho")).toBeNull();
    expect(campo("mEdital")?.value).toBe("20/2026");
    expect(seletor("mUnidade")?.value).toBe("U1");
    expect(campo("mUf")?.value).toBe("AM");
  });

  it("Descartar o rascunho abre o formulário limpo e o apaga", async () => {
    await montar();
    await clicar($("newEditalBtn"));
    await digitar($("mEdital"), "20/2026");
    await act(async () => definido(controlador).estado.fecharModal());

    await clicar($("newEditalBtn"));
    await clicar($("editalRascunhoDescartar"));
    expect($("editalRascunho")).toBeNull();
    expect(campo("mEdital")?.value).toBe("");
    expect(rascunhosGuardados()).toEqual([]);
  });

  it("o rascunho de um edital não aparece em outro", async () => {
    await montar();
    await abrirEdital("1");
    await digitar($("mObs"), "Nota do edital 1");
    await act(async () => definido(controlador).estado.fecharModal());

    await abrirEdital("2");
    expect($("editalRascunho")).toBeNull();
    await act(async () => definido(controlador).estado.fecharModal());
    await abrirEdital("1");
    expect($("editalRascunho")).not.toBeNull();
  });

  it("salvar apaga o rascunho", async () => {
    await montar();
    await abrirEdital("1");
    await digitar($("mCronogramaMotivo"), "Ajuste de datas");
    expect(rascunhosGuardados()).toHaveLength(1);
    await clicar($("saveEditalBtn"));
    expect($("editModal")).toBeNull();
    expect(rascunhosGuardados()).toEqual([]);
  });
});

describe("edital sempre na área certa", () => {
  const valoresDaUnidade = () =>
    [...definido(seletor("mUnidade")).options]
      .map((opcao) => opcao.value)
      .filter(Boolean);
  const chamadaDe = (
    supabase: ReturnType<typeof supabaseFalso>,
    nome: string,
  ) => definido(supabase.rpc.mock.calls.find(([chamada]) => chamada === nome));

  it("Novo mostra a área do menu; editar mostra a do edital", async () => {
    await montar();
    await act(async () => definirAreaAtual("sede"));
    await clicar($("newEditalBtn"));
    expect($("mArea")?.textContent).toBe("Área: SEDE");
    await act(async () => definido(controlador).estado.fecharModal());

    await act(async () => definirAreaAtual("saude-indigena"));
    await abrirEdital("1");
    expect($("mArea")?.textContent).toBe("Área: Saúde Indígena");
  });

  it("em Projetos, o CORES oferece CCE e Escritório Distrital e Regional", async () => {
    await montar();
    await act(async () => definirAreaAtual("projetos"));
    await clicar($("newEditalBtn"));
    await escolher($("mResponsavel"), "CORES");
    expect(valoresDaUnidade()).toEqual(
      expect.arrayContaining(["CCE", "Escritório Distrital e Regional"]),
    );
    expect(valoresDaUnidade()).not.toContain("SEDE");
  });

  it("em Projetos, CCE aparece mesmo sem edital e sem o responsável CORES", async () => {
    await montar();
    await act(async () => definirAreaAtual("projetos"));
    await clicar($("newEditalBtn"));
    expect(valoresDaUnidade()).toEqual(
      expect.arrayContaining(["CCE", "Escritório Distrital e Regional"]),
    );
    expect(valoresDaUnidade()).not.toContain("SEDE");
  });

  it("na SEDE, o CORES oferece só a unidade SEDE, e o payload leva a área", async () => {
    const { supabase } = await montar();
    await act(async () => definirAreaAtual("sede"));
    await clicar($("newEditalBtn"));
    await escolher($("mResponsavel"), "CORES");
    expect(valoresDaUnidade()).toEqual(["SEDE", "__nova__"]);
    await digitar($("mEdital"), "30/2026");
    await escolher($("mUnidade"), "SEDE");
    // Sem etapas, o cálculo automático não deixa salvar.
    await clicar($("mCronogramaAutomatico"));
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    const [, argumentos] = chamadaDe(
      supabase,
      "salvar_monitoramento_com_cronograma_v2",
    );
    expect(argumentos?.p_payload).toMatchObject({
      unidade: "SEDE",
      responsavel: "CORES",
      co_area: "sede",
    });
  });

  it("editar salva na área do próprio edital", async () => {
    const { supabase } = await montar();
    await act(async () => definirAreaAtual("sede"));
    await act(async () => definido(controlador).estado.abrirEdital("1"));
    expect($("mArea")?.textContent).toBe("Área: Saúde Indígena");
    await digitar($("mCronogramaMotivo"), "Ajuste");
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    const [, argumentos] = chamadaDe(
      supabase,
      "salvar_monitoramento_com_cronograma_v2",
    );
    expect(argumentos?.p_payload?.co_area).toBe("saude-indigena");
  });

  it("dá para digitar uma unidade nova, que vai no payload com a área", async () => {
    const { supabase } = await montar();
    await act(async () => definirAreaAtual("projetos"));
    await clicar($("newEditalBtn"));
    await digitar($("mEdital"), "31/2026");
    await escolher($("mUnidade"), "__nova__");
    expect($("mUnidadeNova")).not.toBeNull();
    expect(campo("mUf")?.readOnly).toBe(false);
    await digitar($("mUnidadeNova"), "Projeto Mais Médicos Especialistas");
    // Unidade da própria área: sem aviso.
    expect($("mUnidadeNovaAjuda")).toBeNull();
    await clicar($("mCronogramaAutomatico"));
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    const [, argumentos] = chamadaDe(
      supabase,
      "salvar_monitoramento_com_cronograma_v2",
    );
    expect(argumentos?.p_payload).toMatchObject({
      unidade: "Projeto Mais Médicos Especialistas",
      id_unidade: null,
      co_area: "projetos",
    });
  });

  it("unidade digitada que é de outra área avisa antes de salvar", async () => {
    await montar();
    await act(async () => definirAreaAtual("sede"));
    await clicar($("newEditalBtn"));
    await escolher($("mUnidade"), "__nova__");
    await digitar($("mUnidadeNova"), "rio doce");
    const ajuda = definido($("mUnidadeNovaAjuda"));
    expect(ajuda.className).toContain("is-erro");
    expect(ajuda.textContent).toContain("Esta unidade é da área Projetos");
  });

  it("só administrador vê Mover para outra área", async () => {
    await montar();
    await abrirEdital("1");
    expect($("editalMoverAbrir")).toBeNull();
    await act(async () => definido(controlador).estado.fecharModal());

    perfilAtual = { perfil: "admin" };
    await clicar($("newEditalBtn"));
    // Edital novo não tem de onde sair.
    expect($("editalMoverAbrir")).toBeNull();
  });

  it("administrador move o edital com motivo e confirmação", async () => {
    const { supabase, confirmar, aoSalvar, toast } = await montar({
      perfil: { perfil: "admin" },
    });
    await abrirEdital("1");
    await clicar($("editalMoverAbrir"));
    const areas = [...definido(seletor("mMoverArea")).options]
      .map((opcao) => opcao.value)
      .filter(Boolean);
    expect(areas).toEqual(["sede", "projetos"]);
    expect(botaoPorId("editalMoverConfirmar")?.disabled).toBe(true);

    await escolher($("mMoverArea"), "sede");
    await digitar($("mMoverMotivo"), "Cadastrado na área errada");
    supabase.rpc.mockClear();
    await clicar($("editalMoverConfirmar"));
    expect(confirmar).toHaveBeenCalledWith(
      "Mover o edital 10/2026 de Saúde Indígena para SEDE?",
    );
    const [, argumentos] = chamadaDe(supabase, "mover_edital_de_area");
    expect(argumentos).toEqual({
      p_id: "1",
      p_area: "sede",
      p_motivo: "Cadastrado na área errada",
    });
    expect($("editModal")).toBeNull();
    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenLastCalledWith("10/2026 movido para SEDE.");
  });

  it("com o formulário mexido, mover fica bloqueado", async () => {
    await montar({ perfil: { perfil: "admin" } });
    await abrirEdital("1");
    await digitar($("mObs"), "mudança não salva");
    await clicar($("editalMoverAbrir"));
    await escolher($("mMoverArea"), "projetos");
    await digitar($("mMoverMotivo"), "motivo");
    expect($("editalMoverBloqueio")).not.toBeNull();
    expect(botaoPorId("editalMoverConfirmar")?.disabled).toBe(true);
  });
});

describe("linha do tempo", () => {
  it("mostra a situação de cada etapa e o histórico", async () => {
    await montar();
    await clicar(
      linha("1")?.querySelector<HTMLElement>(".nucleo-view-timeline"),
    );
    expect($("nucleoTimelineTitle")?.textContent).toBe("10/2026");
    expect($("nucleoTimelineSubtitle")?.textContent).toBe("DSEI Manaus");
    const situacoes = [
      ...document.querySelectorAll<HTMLElement>(".nucleo-timeline-item"),
    ].map((item) =>
      [...item.classList].find((classe) => classe.startsWith("is-")),
    );
    expect(situacoes).toEqual(["is-done", "is-current"]);
    expect($("nucleoTimelineContent")?.textContent).toContain("50%");
    expect($("nucleoTimelineContent")?.textContent).toContain(
      "Cadastro inicial",
    );

    await clicar($("closeNucleoTimeline"));
    expect($("nucleoTimelineModal")).toBeNull();
  });
});

describe("padrão das telas (topo, tabela contínua, skeleton e erro)", () => {
  it("o topo traz a data do resumo, Atualizar e Novo edital", async () => {
    await montar();
    const topo = definido(
      document.querySelector<HTMLElement>("#page-nucleo .ui-topo"),
    );
    expect(
      topo.querySelector<HTMLElement>("[data-status-da-carga]")?.textContent,
    ).toMatch(/^Atualizado em /);
    expect(topo.querySelector<HTMLElement>("#nucleoOperationalRefresh")).toBe(
      atualizar(),
    );
    expect(
      topo.querySelector<HTMLElement>("#newEditalBtn")?.textContent,
    ).toContain("Novo edital");
    expect(
      document.querySelector<HTMLElement>(".nucleo-page-card #nucleoSearch"),
    ).not.toBe(null);
  });

  it("quem só lê não vê Novo edital", async () => {
    await montar({ perfil: { perfil: "usuario" } });
    expect($("newEditalBtn")).toBeNull();
  });

  it("a tabela mostra 50 por vez e o resto no Carregar mais", async () => {
    const muitas = Array.from({ length: 60 }, (_, indice) => ({
      id: `e${indice}`,
      unidade: `Unidade ${String(indice).padStart(2, "0")}`,
      edital: `${indice}/2026`,
      status: "Em andamento",
      etapa: "Inscrições",
      risco: "Baixo",
      vagas_total: 1,
      contratados: 0,
      vagas_ociosas: 1,
    }));
    await montar({ linhas: muitas });
    expect(linhasDaTabela()).toHaveLength(50);
    await clicar(
      document.querySelector<HTMLElement>(
        '.nucleo-page-card [data-acao="carregar-mais"]',
      ),
    );
    expect(linhasDaTabela()).toHaveLength(60);
  });

  it("linha do tempo: skeleton enquanto carrega e erro com Tentar novamente", async () => {
    const supabase = supabaseFalso();
    const original = definido(supabase.rpc.getMockImplementation());
    let modo = "pendente";
    let entregar: ((resposta: RespostaDaRpc) => void) | null = null;
    supabase.rpc.mockImplementation((nome, argumentos) => {
      if (nome !== "get_monitoramento_cronograma")
        return original(nome, argumentos);
      if (modo === "pendente")
        return new Promise<RespostaDaRpc>((resolver) => (entregar = resolver));
      if (modo === "erro")
        return Promise.resolve({ data: null, error: { message: "falhou" } });
      return original(nome, argumentos);
    });
    await montar({ supabase });

    await clicar(
      linha("1")?.querySelector<HTMLElement>(".nucleo-view-timeline"),
    );
    const conteudo = () => $("nucleoTimelineContent");
    expect(
      conteudo()?.querySelector<HTMLElement>(
        '[aria-busy="true"] .ui-esqueleto-bloco',
      ),
    ).not.toBeNull();

    modo = "erro";
    await esperar(async () => {
      definido(entregar)({ data: null, error: { message: "falhou" } });
    });
    const alerta = definido(
      conteudo()?.querySelector<HTMLElement>('[role="alert"]'),
    );
    expect(alerta.textContent).toContain(
      "Não foi possível carregar o cronograma",
    );

    modo = "ok";
    await clicar(
      alerta.querySelector<HTMLElement>('[data-acao="tentar-novamente"]'),
    );
    await esperar();
    expect(conteudo()?.querySelector<HTMLElement>('[role="alert"]')).toBeNull();
    expect(conteudo()?.textContent).toContain("Cadastro inicial");
  });
});

describe("cronograma e rascunho sem efeitos colaterais", () => {
  it("digitar a data de início pelo teclado: o fim acompanha até a data completa", async () => {
    await montar();
    await clicar($("newEditalBtn"));
    await clicar($("cronogramaAddRow"));
    const inicio = () =>
      document.querySelector<HTMLInputElement>('[data-field="data_inicio"]');
    const fim = () =>
      document.querySelector<HTMLInputElement>('[data-field="data_fim"]');
    // O campo de data emite o ano parcial a cada tecla.
    await digitar(inicio(), "0002-06-17");
    await digitar(inicio(), "0020-06-17");
    await digitar(inicio(), "2026-06-17");
    expect(fim()?.value).toBe("2026-06-17");

    // Fim informado diferente do início: não acompanha mais.
    await digitar(fim(), "2026-06-20");
    await digitar(inicio(), "2026-06-18");
    expect(fim()?.value).toBe("2026-06-20");
  });

  it("sem relógio injetado, renderizar de novo não regrava o rascunho", async () => {
    await montar({ relogio: false });
    await clicar($("newEditalBtn"));
    await digitar($("mEdital"), "20/2026");
    const gravar = vi.spyOn(Storage.prototype, "setItem");
    const gravacoesDoRascunho = () =>
      gravar.mock.calls.filter(([chave]) =>
        chave.startsWith("agsus_monitora_rascunho_edital_v1:"),
      ).length;

    await act(async () => publicarLinhasDoMonitoramento(LINHAS()));
    await act(async () => publicarLinhasDoMonitoramento(LINHAS()));

    expect(gravacoesDoRascunho()).toBe(0);
  });
});

describe("retificação do cronograma por PDF", () => {
  /* O "Leia-se" lido pela função Python para o edital 10/2026 (id 1). */
  const RETIFICACAO = {
    tipo: "retificacao",
    numero: 1,
    rotulo: "1ª Retificação do Cronograma",
    edital: "10/2026",
    sei: "0001234",
    assinada_em: "2026-09-12",
    leia_se: [
      {
        atividade: "Inscrições",
        data_inicio: "2026-09-01",
        data_fim: "2026-09-10",
        negrito: false,
        avisos: [],
      },
      {
        atividade: "Análise curricular",
        data_inicio: "2026-09-14",
        data_fim: "2026-09-25",
        negrito: true,
        avisos: [],
      },
      {
        atividade: "Resultado final do Processo Seletivo",
        data_inicio: "2026-09-29",
        data_fim: "2026-10-02",
        texto_datas: "29/09 e 02/10",
        negrito: true,
        avisos: [
          '"29/09 e 02/10" são duas datas soltas; lido como o intervalo de 29/09/2026 a 02/10/2026. Confira.',
        ],
      },
    ],
    avisos: [],
  };

  async function lerPdf(resposta = RETIFICACAO) {
    const buscar = vi.fn(
      async (_endereco: RequestInfo | URL, _opcoes?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => resposta,
      }),
    );
    vi.stubGlobal("fetch", buscar);
    await clicar($("cronogramaRetificacao"));
    const entrada = definido($("retificacaoArquivo"));
    Object.defineProperty(entrada, "files", {
      value: [
        new File(["%PDF-1.4"], "retificacao.pdf", { type: "application/pdf" }),
      ],
    });
    await act(async () => {
      entrada.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await esperar();
    return buscar;
  }

  const situacoes = () =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "#retificacaoComparacao tbody tr",
      ),
    ].map((tr) => tr.dataset.situacao);

  afterEach(() => vi.unstubAllGlobals());

  it("só aparece em edital cadastrado", async () => {
    await montar();
    await clicar($("newEditalBtn"));
    expect($("cronogramaRetificacao")).toBeNull();
  });

  it("mostra a comparação etapa a etapa com os avisos, sem gravar nada", async () => {
    const { supabase } = await montar();
    await abrirEdital("1");
    supabase.rpc.mockClear();
    const buscar = await lerPdf();

    expect(buscar.mock.calls[0]?.[0]).toBe(
      "/api/anexos-do-edital?tipo=retificacao",
    );
    expect($("retificacaoDocumento")?.textContent).toContain(
      "1ª Retificação do Cronograma · Edital 10/2026 · SEI 0001234 · assinada em 12/09/2026",
    );
    expect(situacoes()).toEqual(["igual", "muda", "nova"]);
    expect($("retificacaoComparacao")?.textContent).toContain(
      "duas datas soltas",
    );
    expect($("retificacaoResumo")?.textContent).toBe(
      "1 com data nova · 1 nova(s) · 0 sai(em) · 1 igual(is)",
    );
    expect(campo("retificacaoErrata")?.value).toBe(
      "1ª Retificação do Cronograma",
    );
    expect(areaDeTexto("retificacaoMotivo")?.value).toContain("SEI 0001234");
    expect(botaoPorId("retificacaoAplicar")?.disabled).toBe(false);
    expect(
      supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "salvar_monitoramento_com_cronograma_v2",
      ),
    ).toHaveLength(0);
  });

  it("PDF de outro edital bloqueia com aviso e não mostra o Aplicar", async () => {
    await montar();
    await abrirEdital("1");
    await lerPdf({ ...RETIFICACAO, edital: "105/2026" });
    expect($("retificacaoBloqueio")?.textContent).toBe(
      "O PDF é do edital 105/2026, e este é o 10/2026. Escolha a retificação deste edital.",
    );
    expect($("retificacaoComparacao")).toBeNull();
    expect($("retificacaoAplicar")).toBeNull();
  });

  it("formulário mexido impede aplicar até salvar ou descartar", async () => {
    await montar();
    await abrirEdital("1");
    await digitar($("mObs"), "Anotação");
    await lerPdf();
    expect($("retificacaoPendencias")?.textContent).toContain(
      "Salve ou descarte as alterações do formulário",
    );
    expect(botaoPorId("retificacaoAplicar")?.disabled).toBe(true);
  });

  it("ajusta e aplica: grava o cronograma novo com a errata e o SEI no motivo", async () => {
    const { supabase, aoSalvar, toast } = await montar();
    await abrirEdital("1");
    await lerPdf();
    // A etapa nova fica um dia a menos, corrigida à mão antes de aplicar.
    await digitar(
      document.querySelector<HTMLElement>(
        '[aria-label="Fim de Resultado final do Processo Seletivo"]',
      ),
      "2026-10-01",
    );
    supabase.rpc.mockClear();
    await clicar($("retificacaoAplicar"));
    await esperar();

    const [, argumentos] = definido(
      supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_monitoramento_com_cronograma_v2",
      ),
    );
    expect(argumentos?.p_numero_errata).toBe("1ª Retificação do Cronograma");
    expect(argumentos?.p_motivo).toBe(
      "Lançada pela 1ª Retificação do Cronograma (SEI 0001234, assinada em 12/09/2026): 1 etapa(s) com data nova, 1 incluída(s).",
    );
    expect(
      argumentos?.p_cronograma?.map((e) => [
        e.ordem,
        e.atividade,
        e.data_inicio,
        e.data_fim,
        e.origem,
      ]),
    ).toEqual([
      [1, "Inscrições", "2026-09-01", "2026-09-10", "MANUAL"],
      [2, "Análise curricular", "2026-09-14", "2026-09-25", "ERRATA"],
      [
        3,
        "Resultado final do Processo Seletivo",
        "2026-09-29",
        "2026-10-01",
        "ERRATA",
      ],
    ]);
    expect(argumentos?.p_payload).toMatchObject({
      id: "1",
      edital: "10/2026",
      data_inicio: "2026-09-01",
      data_fim: "2026-10-01",
    });
    expect($("editModal")).toBeNull();
    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenLastCalledWith(
      "10/2026 salvo. 3 etapa(s) registradas e histórico atualizado.",
    );
  });
});

/*
  Cartão #57: validade do processo seletivo no formulário. A RPC de leitura
  (get_monitoramento_cronograma) só devolve os três campos depois da migration
  20261111200000; o fixture CRONOGRAMAS["1"] é o banco de antes.
*/
describe("validade do processo seletivo", () => {
  const comValidade = (validade: object) =>
    supabaseFalso({
      cronogramas: {
        ...CRONOGRAMAS,
        1: {
          ...CRONOGRAMAS["1"],
          monitoramento: {
            ...(CRONOGRAMAS["1"] as { monitoramento: object }).monitoramento,
            ...validade,
          },
        },
      },
    });
  const payload = (supabase: ReturnType<typeof supabaseFalso>) =>
    supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_monitoramento_com_cronograma_v2",
    )?.[1]?.p_payload;

  it("lê a validade gravada, mostra o prazo e devolve as três chaves ao salvar", async () => {
    const supabase = comValidade({
      nu_anos_validade: 1,
      nu_meses_validade: 6,
      st_prorrogado: false,
    });
    await montar({ supabase });
    await abrirEdital("1");
    expect(campo("mValidadeAnos")?.value).toBe("1");
    expect(campo("mValidadeMeses")?.value).toBe("6");
    expect(seletor("mValidadeProrrogado")?.value).toBe("nao");
    expect($("mValidadeNaoLida")).toBeNull();
    // Encerramento pelas etapas: 20/09/2026 + 18 meses.
    expect($("mValidadePrazo")?.textContent).toBe("Válida até 20/03/2028.");

    await escolher($("mValidadeProrrogado"), "sim");
    expect($("mValidadePrazo")?.textContent).toBe("Válida até 20/09/2029.");
    await digitar($("mCronogramaMotivo"), "Prorrogação do edital");
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    expect(payload(supabase)).toMatchObject({
      nu_anos_validade: 1,
      nu_meses_validade: 6,
      st_prorrogado: true,
    });
  });

  it("valor fora do limite mostra a mensagem no campo e não salva", async () => {
    const supabase = comValidade({
      nu_anos_validade: 0,
      nu_meses_validade: 0,
      st_prorrogado: false,
    });
    await montar({ supabase });
    await abrirEdital("1");
    expect($("mValidadePrazo")?.textContent).toBe(
      "Sem prazo: a lista não vence.",
    );
    await digitar($("mValidadeMeses"), "12");
    expect(campo("mValidadeMeses")?.getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).toContain(
      "Use um número inteiro de 0 a 11 meses.",
    );
    await digitar($("mCronogramaMotivo"), "Ajuste");
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    expect(payload(supabase)).toBeUndefined();
    expect(document.activeElement?.id).toBe("mValidadeMeses");
  });

  it("banco sem a leitura: avisa, abre vazio e só manda o que foi preenchido", async () => {
    const { supabase } = await montar();
    await abrirEdital("1");
    expect($("mValidadeNaoLida")).not.toBeNull();
    expect(campo("mValidadeAnos")?.value).toBe("");
    expect(seletor("mValidadeProrrogado")?.value).toBe("");
    await digitar($("mCronogramaMotivo"), "Ajuste");
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    const semMexer = payload(supabase);
    expect(semMexer).toBeDefined();
    expect(semMexer).not.toHaveProperty("nu_anos_validade");
    expect(semMexer).not.toHaveProperty("nu_meses_validade");
    expect(semMexer).not.toHaveProperty("st_prorrogado");
  });

  it("banco sem a leitura: o campo preenchido vai sozinho", async () => {
    const { supabase } = await montar();
    await abrirEdital("1");
    await digitar($("mValidadeAnos"), "2");
    await digitar($("mCronogramaMotivo"), "Ajuste");
    supabase.rpc.mockClear();
    await clicar($("saveEditalBtn"));
    const enviado = payload(supabase);
    expect(enviado).toMatchObject({ nu_anos_validade: 2 });
    expect(enviado).not.toHaveProperty("nu_meses_validade");
    expect(enviado).not.toHaveProperty("st_prorrogado");
  });

  it("edital novo nasce com os padrões do banco (0, 0, não)", async () => {
    await montar();
    await clicar($("newEditalBtn"));
    expect(campo("mValidadeAnos")?.value).toBe("0");
    expect(campo("mValidadeMeses")?.value).toBe("0");
    expect(seletor("mValidadeProrrogado")?.value).toBe("nao");
  });
});
