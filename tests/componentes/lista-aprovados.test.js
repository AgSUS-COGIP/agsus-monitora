import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarListaAprovados } from "../../src/modulos/aprovados/lista-aprovados.jsx";
import { PLANILHAS } from "../../src/lib/planilhas.js";
import { clicar, digitar, escolher, esperar, teclar } from "./interacoes.js";
import {
  compactarCandidatos,
  compactarPorArea,
} from "./candidatos-compactos-falsos.js";
import {
  definirAreaAtual,
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";

/*
  A tela só mostra os editais da área atual (a padrão é a Saúde Indígena); os
  editais das fixtures precisam estar nas linhas do monitoramento. Registrado
  antes dos outros ganchos, o afterEach roda depois de desmontar.
*/
beforeEach(() =>
  publicarLinhasDoMonitoramento(
    ["10", "20"].map((id) => ({ id, CO_AREA: "saude-indigena" })),
  ),
);
afterEach(() => redefinirDadosDoMonitoramento());

/*
  A Lista de Aprovados em React: a aba de aprovados (indicadores, filtros,
  tabela paginada) e os modais de status, sub judice e listas do edital. A aba
  de convocação tem o seu próprio arquivo (`lista-de-convocacao.test.js`).
*/

const LISTA_ATIVA = {
  lista_id: "L10",
  edital_id: "10",
  edital: "03/2025",
  unidade: "DSEI Manaus",
  ativo: true,
  arquivo_nome: "aprovados-03-2025.xlsx",
  arquivo_path: "10/arquivo.xlsx",
  total_candidatos: 3,
};
const LISTA_INATIVA = {
  lista_id: "L20",
  edital_id: "20",
  edital: "04/2025",
  unidade: "CASAI São Paulo",
  ativo: false,
};

let sequencial = 0;
const candidato = (extra = {}) => {
  sequencial += 1;
  return {
    candidato_id: `c${sequencial}`,
    nome: `Candidato ${sequencial}`,
    cargo: "Enfermeiro",
    modalidade: "Ampla concorrência",
    classificacao: sequencial,
    nota: 90.5,
    edital_id: "10",
    edital: "03/2025",
    unidade: "DSEI Manaus",
    codigo_vaga: "VG-1",
    lista_ativa: true,
    status: "",
    ...extra,
  };
};

const CANDIDATOS = () => [
  candidato({
    candidato_id: "ana",
    nome: "Ana Ribeiro",
    status: "Contratado",
    matricula: "M-1",
  }),
  candidato({
    candidato_id: "bruno",
    nome: "Bruno Lima",
    cargo: "Médico",
    modalidade: "Pessoa negra",
  }),
  candidato({ candidato_id: "carla", nome: "Carla Souza", sub_judice: true }),
  candidato({
    candidato_id: "diego",
    nome: "Diego Alves",
    cargo: "Dentista",
    edital_id: "20",
    edital: "04/2025",
    lista_ativa: false,
    status: "Desistente",
  }),
];

function supabaseFalso({
  candidatos = CANDIDATOS(),
  listas = [LISTA_ATIVA, LISTA_INATIVA],
  anexos = [],
  erros = {},
  porArea = true,
} = {}) {
  /*
    O que o banco tem: a versão dos dados muda a cada escrita (como a
    assinatura de FC_VERSAO_APROVADOS_AREA); `candidatos` pode ser trocado.
  */
  const banco = { candidatos, versao: "v1" };
  let novos = 0;
  const responder = (nome) => {
    if (erros[nome]) return { data: null, error: { message: erros[nome] } };
    if (nome === "listar_listas_aprovados")
      return { data: listas, error: null };
    if (nome === "listar_anexos_candidatos_aprovados")
      return { data: anexos, error: null };
    if (nome === "registrar_anexo_candidato_aprovado")
      return { data: { ok: true, anexo_id: `novo-${++novos}` }, error: null };
    if (nome === "baixar_anexo_candidato_aprovado")
      return {
        data: { arquivo_nome: "termo.pdf", arquivo_base64: btoa("%PDF-1.4") },
        error: null,
      };
    if (nome === "listar_modelos_convocacao") return { data: [], error: null };
    if (nome === "listar_configuracao_convocacao")
      return { data: [], error: null };
    return { data: { ok: true }, error: null };
  };
  const pacote = (argumentos) => {
    const mensagem =
      erros.listar_candidatos_aprovados_compacto ||
      erros.listar_candidatos_aprovados;
    if (mensagem) return { data: null, error: { message: mensagem } };
    // Sem argumentos: a função de antes da migration (formato 1, todas as áreas).
    if (!argumentos)
      return { data: compactarCandidatos(banco.candidatos), error: null };
    if (!porArea)
      return {
        data: null,
        error: { code: "PGRST202", message: "função ausente" },
      };
    const { p_area: area, p_versao: versao } = argumentos;
    if (versao && versao === banco.versao)
      return {
        data: { formato: 2, area, versao, inalterado: true },
        error: null,
      };
    return {
      data: compactarPorArea(banco.candidatos, { area, versao: banco.versao }),
      error: null,
    };
  };
  const rpc = vi.fn((nome, argumentos) => {
    if (nome === "listar_candidatos_aprovados_compacto")
      return Promise.resolve(pacote(argumentos));
    // Toda escrita muda a versão dos dados no banco.
    if (/^(alterar|incluir|remover|importar|definir|salvar)_/.test(nome))
      banco.versao = `v${Number(banco.versao.slice(1)) + 1}`;
    const resposta = Promise.resolve(responder(nome));
    resposta.range = () => resposta;
    return resposta;
  });
  const bucket = {
    upload: vi.fn(async () => ({ data: {}, error: null })),
    download: vi.fn(async () => ({ data: new Blob(["x"]), error: null })),
  };
  const storage = { from: vi.fn(() => bucket) };
  return { rpc, storage, bucket, banco };
}

let controlador = null;
let perfilAtual = null;

async function montar({
  perfil = { perfil: "contratador" },
  supabase = supabaseFalso(),
  toast = vi.fn(),
  confirmar = () => true,
  lerPlanilha = async () => [{ nome: "X" }, { nome: "Y" }],
  novaAba = () => ({ mostrar: vi.fn(), fechar: vi.fn() }),
  secaoAtiva = true,
  carregar = true,
  armazenamento,
} = {}) {
  document.body.innerHTML = `<section id="page-approved" class="page${secaoAtiva ? " active" : ""}"></section>`;
  perfilAtual = perfil;
  await act(async () => {
    controlador = montarListaAprovados({
      secao: document.getElementById("page-approved"),
      supabase,
      toast,
      getProfile: () => perfilAtual,
      confirmar,
      lerPlanilha,
      novaAba,
      armazenamento,
    });
  });
  if (carregar) await esperar(() => controlador.render());
  return { supabase, toast };
}

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

const $ = (id) => document.getElementById(id);
/* Os argumentos de cada chamada a listar_candidatos_aprovados_compacto. */
const chamadasDoPacote = (supabase) =>
  supabase.rpc.mock.calls
    .filter(([nome]) => nome === "listar_candidatos_aprovados_compacto")
    .map(([, argumentos]) => argumentos);
const nomes = () =>
  [...document.querySelectorAll("#approvedRows .approved-name strong")].map(
    (item) => item.textContent,
  );
const linhaDe = (nome) =>
  [...document.querySelectorAll("#approvedRows tr")].find(
    (linha) =>
      linha.querySelector(".approved-name strong")?.textContent === nome,
  );
const opcaoDoFiltro = (filtro, rotulo) =>
  [
    ...$(filtro)
      .closest(".multi-select")
      .querySelectorAll(".multi-select-option"),
  ]
    .find((opcao) => opcao.textContent === rotulo)
    ?.querySelector("input");
const opcoesDoFiltro = (filtro) =>
  [
    ...$(filtro)
      .closest(".multi-select")
      .querySelectorAll(".multi-select-option"),
  ].map((opcao) => opcao.textContent);

describe("topo e visões", () => {
  it("as duas visões são abas (tablist) com o visual do controle segmentado, no topo", async () => {
    await montar();
    const visoes = document.querySelector(
      "#page-approved .ui-topo .ui-segmentado[role='tablist']",
    );
    expect(visoes).not.toBeNull();
    const [aprovados, convocacao] = visoes.querySelectorAll("[role='tab']");
    expect(aprovados.id).toBe("approvedTabAprovados");
    expect(aprovados.getAttribute("aria-selected")).toBe("true");
    expect(aprovados.classList.contains("is-ativo")).toBe(true);
    expect(aprovados.getAttribute("aria-controls")).toBe(
      "approvedPanelAprovados",
    );
    await clicar(convocacao);
    expect(convocacao.getAttribute("aria-selected")).toBe("true");
    expect($("approvedPanelConvocacao").classList.contains("hidden")).toBe(
      false,
    );
    expect($("approvedPanelAprovados").classList.contains("hidden")).toBe(true);
    expect($("approvedHeadActions").classList.contains("hidden")).toBe(true);
    expect(
      document.querySelector("#page-approved [data-status-da-carga]")
        .textContent,
    ).toMatch(/^Atualizado em /);
  });

  it("KPIs no Kpi compacto de src/ui, nas duas abas", async () => {
    await montar();
    for (const painel of [
      "approvedPanelAprovados",
      "approvedPanelConvocacao",
    ]) {
      const grade = $(painel).querySelector(".approved-kpis.ui-kpis");
      expect(grade.querySelectorAll(".ui-kpi").length).toBeGreaterThanOrEqual(
        5,
      );
    }
    expect($("approvedKpiTotal").classList.contains("ui-kpi-valor")).toBe(true);
  });
});

describe("carregamento", () => {
  it("antes do dado chegar, mostra skeleton — e não zero", async () => {
    await montar({ carregar: false });
    expect($("approvedKpiTotal").textContent).toBe("");
    expect($("approvedKpiTotal").classList.contains("ui-esqueleto")).toBe(true);
    expect($("convocacaoKpiVagas").classList.contains("ui-esqueleto")).toBe(
      true,
    );
    expect($("approvedCount").textContent).toBe("Carregando…");
    expect(
      document.querySelector("#page-approved [data-status-da-carga]")
        .textContent,
    ).toBe("Carregando dados...");
    expect(
      document.querySelectorAll("#approvedRows tr.ui-esqueleto-tr"),
    ).toHaveLength(8);
    expect(
      $("convocacaoRows").querySelector("tr.ui-esqueleto-tr"),
    ).not.toBeNull();
  });

  it("carregar não cobre a tela: não há tela de carregamento a chamar", async () => {
    const fonte = await import("node:fs").then(({ readFileSync }) =>
      readFileSync("src/modulos/aprovados/estado.js", "utf8"),
    );
    expect(fonte).not.toContain("loader");
  });

  it("se a primeira carga falha, mostra o erro e tenta de novo", async () => {
    const erros = { listar_listas_aprovados: "sem rede" };
    const supabase = supabaseFalso({ erros });
    await montar({ supabase });
    expect($("approvedErro").textContent).toContain(
      "Não foi possível carregar a lista de aprovados: sem rede",
    );
    expect($("approvedRows").textContent).toBe("Sem dados.");
    expect($("approvedRows").querySelector(".ui-esqueleto-tr")).toBeNull();
    expect($("convocacaoRows").textContent).toBe("Sem dados.");
    expect($("approvedCount").textContent).toBe("Sem dados");

    delete erros.listar_listas_aprovados;
    await clicar(
      $("approvedErro").querySelector('[data-acao="tentar-novamente"]'),
    );
    await esperar(() => new Promise((resolver) => setTimeout(resolver, 0)));
    expect(nomes()).toContain("Ana Ribeiro");
    expect($("approvedCount").textContent).toBe("4 candidatos");
  });

  it("desenha as linhas e os indicadores", async () => {
    await montar();
    expect(nomes()).toEqual([
      "Ana Ribeiro",
      "Bruno Lima",
      "Carla Souza",
      "Diego Alves",
    ]);
    expect($("approvedKpiTotal").textContent).toBe("4");
    expect($("approvedKpiContratado").textContent).toBe("1");
    expect($("approvedKpiDesistente").textContent).toBe("1");
    expect($("approvedCount").textContent).toBe("4 candidatos");
    expect(
      linhaDe("Ana Ribeiro").querySelector(".approved-status.success")
        .textContent,
    ).toBe("Contratado");
    expect(
      linhaDe("Bruno Lima").querySelector(".approved-status").textContent,
    ).toBe("Sem status");
    expect(
      linhaDe("Ana Ribeiro").querySelector("td.num:nth-of-type(5)").textContent,
    ).toBe("90,5");
  });

  it("busca os candidatos da área atual numa chamada só", async () => {
    const muitos = Array.from({ length: 1003 }, () => candidato());
    const supabase = supabaseFalso({ candidatos: muitos });
    await montar({ supabase });
    expect(chamadasDoPacote(supabase)).toEqual([
      { p_area: "saude-indigena", p_versao: null },
    ]);
    expect($("approvedKpiTotal").textContent).toBe("1.003");
  });

  it("sem a função por área no banco, usa a de antes (todas as áreas)", async () => {
    const supabase = supabaseFalso({ porArea: false });
    await montar({ supabase });
    expect(chamadasDoPacote(supabase)).toEqual([
      { p_area: "saude-indigena", p_versao: null },
      undefined,
    ]);
    // A tela recorta pela área, como sempre: os 4 são de editais da área.
    expect($("approvedKpiTotal").textContent).toBe("4");
  });

  it("avisa o erro de carregamento", async () => {
    const toast = vi.fn();
    await montar({
      supabase: supabaseFalso({
        erros: { listar_listas_aprovados: "sem rede" },
      }),
      toast,
    });
    expect(toast).toHaveBeenCalledWith(
      "Erro ao carregar lista de aprovados: sem rede",
      "error",
    );
  });

  it("anuncia a carga para o resto do app", async () => {
    const ouvinte = vi.fn();
    document.addEventListener("agsus:listas-aprovados-loaded", ouvinte);
    await montar();
    document.removeEventListener("agsus:listas-aprovados-loaded", ouvinte);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(ouvinte.mock.calls[0][0].detail.lists).toHaveLength(2);
  });
});

describe("filtros e paginação", () => {
  it("abre filtros recolhidos, permite filtrar e limpa todo o recorte", async () => {
    await montar();
    const painel = $("approvedFiltrosTitulo").closest(".ui-filtros");
    expect(painel.classList.contains("approved-filters")).toBe(true);
    expect(painel.querySelector(".ui-filtros-corpo").hidden).toBe(true);
    await clicar(painel.querySelector('[data-acao="recolher-filtros"]'));
    expect(painel.querySelector(".ui-filtros-corpo").hidden).toBe(false);
    await clicar(opcaoDoFiltro("approvedFilterCargo", "Médico"));
    expect(nomes()).toEqual(["Bruno Lima"]);
    await clicar(painel.querySelector('[data-acao="limpar-filtros"]'));
    expect(nomes()).toHaveLength(4);
  });
  it("escolher um edital encolhe os cargos e descarta o cargo que sumiu", async () => {
    await montar();
    expect(opcoesDoFiltro("approvedFilterCargo")).toEqual([
      "Dentista",
      "Enfermeiro",
      "Médico",
    ]);
    await clicar(opcaoDoFiltro("approvedFilterCargo", "Dentista"));
    expect(nomes()).toEqual(["Diego Alves"]);

    await clicar(
      opcaoDoFiltro("approvedFilterEdital", "03/2025 · DSEI Manaus"),
    );
    expect(opcoesDoFiltro("approvedFilterCargo")).toEqual([
      "Enfermeiro",
      "Médico",
    ]);
    // O Dentista era do outro edital: deixou de filtrar.
    expect(nomes()).toEqual(["Ana Ribeiro", "Bruno Lima", "Carla Souza"]);
    expect($("approvedCount").textContent).toBe("3 candidatos");
  });

  it("os indicadores ignoram o filtro de status", async () => {
    await montar();
    await clicar(opcaoDoFiltro("approvedFilterStatus", "Contratado"));
    expect(nomes()).toEqual(["Ana Ribeiro"]);
    expect($("approvedKpiTotal").textContent).toBe("4");
  });

  it("pagina de 50 em 50, e filtrar volta à primeira página", async () => {
    const muitos = Array.from({ length: 120 }, (_, indice) =>
      candidato({ cargo: indice < 60 ? "Enfermeiro" : "Médico" }),
    );
    await montar({ supabase: supabaseFalso({ candidatos: muitos }) });
    expect($("approvedPaginacao").hidden).toBe(false);
    expect($("approvedPaginacaoInfo").textContent).toBe(
      "Mostrando 1–50 de 120 candidatos",
    );
    expect($("approvedPagePrev").disabled).toBe(true);

    await clicar($("approvedPageNext"));
    await clicar($("approvedPageNext"));
    expect($("approvedPaginaAtual").textContent).toBe("Página 3 de 3");
    expect($("approvedPageNext").disabled).toBe(true);
    expect(document.querySelectorAll("#approvedRows tr")).toHaveLength(20);

    await clicar(opcaoDoFiltro("approvedFilterCargo", "Médico"));
    expect($("approvedPaginaAtual").textContent).toBe("Página 1 de 2");

    await escolher($("approvedPageSize"), "100");
    // Com tudo numa página, a barra some: controles de página seriam ruído.
    expect($("approvedPaginacao").hidden).toBe(true);
    expect(document.querySelectorAll("#approvedRows tr")).toHaveLength(60);
  });
});

describe("ações por perfil", () => {
  it("lista inativa mostra o cadeado, e não o lápis", async () => {
    await montar();
    const diego = linhaDe("Diego Alves");
    expect(diego.querySelector('[data-approved-action="status"]')).toBeNull();
    expect(
      diego.querySelector(
        'button[disabled]:not([data-approved-action="anexos"])',
      ).title,
    ).toBe("Lista inativa");
    expect(diego.textContent).toContain("Lista inativa");
  });

  it("quem só consulta vê um traço, e não o botão de sub judice", async () => {
    await montar({ perfil: { perfil: "usuario" } });
    expect(
      document.querySelector('[data-approved-action="status"]'),
    ).toBeNull();
    expect(
      linhaDe("Ana Ribeiro").querySelector(".approved-no-action"),
    ).not.toBeNull();
    expect($("approvedAddSubJudiceBtn")).toBeNull();
  });

  it("o perfil é relido a cada abertura da página", async () => {
    await montar({ perfil: { perfil: "usuario" } });
    perfilAtual = { perfil: "contratador" };
    await esperar(() => controlador.render());
    expect(
      document.querySelector('[data-approved-action="status"]'),
    ).not.toBeNull();
  });

  it("sem lista ativa, incluir sub judice fica desligado e diz porquê", async () => {
    await montar({ supabase: supabaseFalso({ listas: [LISTA_INATIVA] }) });
    const botao = $("approvedAddSubJudiceBtn");
    expect(botao.disabled).toBe(true);
    expect(botao.title).toBe("É necessário ter uma lista ativa");
  });
});

describe("modal de status", () => {
  it("abre com os dados do candidato e exige matrícula para Contratado", async () => {
    const { supabase, toast } = await montar();
    await clicar(
      linhaDe("Bruno Lima").querySelector('[data-approved-action="status"]'),
    );
    expect($("approvedStatusCandidate").textContent).toBe(
      "Bruno Lima · Médico",
    );
    expect(document.activeElement).toBe($("approvedStatusSelect"));

    await escolher($("approvedStatusSelect"), "Contratado");
    expect($("approvedMatriculaHint").textContent).toBe(
      "Obrigatória para este status.",
    );
    expect($("approvedStatusMatricula").required).toBe(true);

    supabase.rpc.mockClear();
    await clicar($("approvedStatusSave"));
    expect(toast).toHaveBeenCalledWith(
      "Informe a matrícula para Contratado ou Migração.",
      "warn",
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
    // O que foi digitado continua lá.
    expect($("approvedStatusSelect").value).toBe("Contratado");
  });

  it("salva pela RPC, fecha e recarrega", async () => {
    const { supabase, toast } = await montar();
    await clicar(
      linhaDe("Bruno Lima").querySelector('[data-approved-action="status"]'),
    );
    await escolher($("approvedStatusSelect"), "Contratado");
    await digitar($("approvedStatusSei"), "00700.000001/2026-00");
    await digitar($("approvedStatusMatricula"), " 12345 ");

    supabase.rpc.mockClear();
    await clicar($("approvedStatusSave"));
    expect(supabase.rpc).toHaveBeenCalledWith(
      "alterar_status_candidato_aprovado",
      {
        p_candidato_id: "bruno",
        p_status: "Contratado",
        p_processo_sei: "00700.000001/2026-00",
        p_matricula: "12345",
      },
    );
    expect($("approvedStatusModal")).toBeNull();
    expect(toast).toHaveBeenCalledWith("Status do candidato atualizado.");
    expect(supabase.rpc).toHaveBeenCalledWith("listar_listas_aprovados");
  });

  it("Esc fecha e devolve o foco ao botão que abriu", async () => {
    await montar();
    const lapis = linhaDe("Bruno Lima").querySelector(
      '[data-approved-action="status"]',
    );
    lapis.focus();
    await clicar(lapis);
    await teclar(document, "Escape");
    expect($("approvedStatusModal")).toBeNull();
    expect(document.activeElement).toBe(lapis);
  });

  it("prende o foco dentro do modal", async () => {
    await montar();
    await clicar(
      linhaDe("Bruno Lima").querySelector('[data-approved-action="status"]'),
    );
    const salvar = $("approvedStatusSave");
    salvar.focus();
    await teclar(document, "Tab");
    // Do último controle, o Tab volta ao primeiro (o Fechar do cabeçalho).
    expect(document.activeElement.textContent).toBe("Fechar");
  });
});

/*
  As ações não cobrem mais a tela: o botão da ação em curso mostra o andamento,
  e os das outras ficam desativados até ela terminar.
*/
describe("anexos do candidato", () => {
  const ADMIN = { perfil: "admin" };
  const ANEXOS = () => [
    {
      anexo_id: "x1",
      candidato_id: "bruno",
      arquivo_nome: "termo.pdf",
      tamanho: 2048,
      incluido_em: "2026-09-28T12:00:00Z",
    },
  ];
  const pdf = (nome, tamanho = 1000, tipo = "application/pdf") =>
    new File([new Uint8Array(tamanho)], nome, { type: tipo });
  async function escolherArquivos(arquivos) {
    const campo = $("approvedStatusAnexos");
    Object.defineProperty(campo, "files", {
      configurable: true,
      value: arquivos,
    });
    await act(async () => {
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  const botaoDeAnexos = (nome) =>
    linhaDe(nome).querySelector('[data-approved-action="anexos"]');
  // A releitura depois de salvar não volta: o que aparecer veio da confirmação.
  function segurarRecarga(supabase) {
    const responder = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation((nome, ...resto) =>
      nome === "listar_listas_aprovados"
        ? new Promise(() => {})
        : responder(nome, ...resto),
    );
  }
  const abrirStatusDe = (nome) =>
    clicar(linhaDe(nome).querySelector('[data-approved-action="status"]'));

  it("o ícone de PDF fica vermelho com anexo e desligado sem anexo", async () => {
    await montar({ supabase: supabaseFalso({ anexos: ANEXOS() }) });
    expect(botaoDeAnexos("Bruno Lima").disabled).toBe(false);
    expect(botaoDeAnexos("Bruno Lima").hasAttribute("data-tem-anexo")).toBe(
      true,
    );
    expect(botaoDeAnexos("Bruno Lima").title).toBe("Ver anexos (1)");
    expect(botaoDeAnexos("Ana Ribeiro").hasAttribute("data-tem-anexo")).toBe(
      false,
    );
    expect(botaoDeAnexos("Ana Ribeiro").disabled).toBe(true);
  });

  it("abre o PDF que vem do banco numa aba nova", async () => {
    const aba = { mostrar: vi.fn(), fechar: vi.fn() };
    // O jsdom não implementa URL.createObjectURL.
    let pdfAberto = null;
    URL.createObjectURL = vi.fn((blob) => {
      pdfAberto = blob;
      return "blob:pdf";
    });
    URL.revokeObjectURL = vi.fn();
    const supabase = supabaseFalso({ anexos: ANEXOS() });
    await montar({ supabase, novaAba: () => aba, perfil: ADMIN });
    await clicar(botaoDeAnexos("Bruno Lima"));
    expect($("approvedAnexosLista").textContent).toContain("termo.pdf");
    await clicar(
      $("approvedAnexosModal").querySelector(
        '[data-approved-action="abrir-anexo"]',
      ),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "baixar_anexo_candidato_aprovado",
      { p_anexo_id: "x1" },
    );
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(aba.mostrar).toHaveBeenCalledWith("blob:pdf");
    expect(pdfAberto.type).toBe("application/pdf");
    expect(await pdfAberto.text()).toBe("%PDF-1.4");
  });

  it("remove o anexo pela RPC, com o arquivo junto", async () => {
    const supabase = supabaseFalso({ anexos: ANEXOS() });
    await montar({ supabase, perfil: ADMIN });
    await clicar(botaoDeAnexos("Bruno Lima"));
    await clicar(
      $("approvedAnexosModal").querySelector(
        '[data-approved-action="remover-anexo"]',
      ),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "remover_anexo_candidato_aprovado",
      { p_anexo_id: "x1" },
    );
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("salvar o status grava cada PDF no banco, em base64", async () => {
    const supabase = supabaseFalso();
    const { toast } = await montar({ supabase, perfil: ADMIN });
    await abrirStatusDe("Bruno Lima");
    const conteudo = new File(["%PDF-1.7 termo"], "Termo de desistência.pdf", {
      type: "application/pdf",
    });
    await escolherArquivos([conteudo, pdf("b.pdf")]);
    expect($("approvedAnexosHint").textContent).toContain("2 de 5");
    await clicar($("approvedStatusSave"));

    expect(supabase.storage.from).not.toHaveBeenCalled();
    const registros = supabase.rpc.mock.calls.filter(
      ([nome]) => nome === "registrar_anexo_candidato_aprovado",
    );
    expect(registros).toHaveLength(2);
    expect(registros[0][1]).toEqual({
      p_candidato_id: "bruno",
      p_arquivo_nome: "Termo de desistência.pdf",
      p_arquivo_base64: btoa("%PDF-1.7 termo"),
    });
    expect(toast).toHaveBeenCalledWith(
      "Status atualizado e 2 anexo(s) enviados.",
    );
  });

  it("com 5 anexos, o campo não aceita mais arquivo", async () => {
    const cinco = Array.from({ length: 5 }, (_, i) => ({
      ...ANEXOS()[0],
      anexo_id: `a${i}`,
    }));
    await montar({ supabase: supabaseFalso({ anexos: cinco }), perfil: ADMIN });
    await abrirStatusDe("Bruno Lima");
    expect($("approvedStatusAnexos").disabled).toBe(true);
    expect($("approvedAnexosHint").textContent).toContain("5 de 5");
  });

  it("recusa o que não é PDF e o maior que 2 MB, sem enviar", async () => {
    const supabase = supabaseFalso();
    await montar({ supabase, perfil: ADMIN });
    await abrirStatusDe("Bruno Lima");
    await escolherArquivos([pdf("foto.png", 10, "image/png")]);
    expect($("approvedStatusModal").textContent).toContain("não é PDF");
    expect($("approvedStatusSave").disabled).toBe(true);

    await clicar(
      $("approvedStatusModal").querySelector('[aria-label^="Tirar"]'),
    );
    await escolherArquivos([pdf("grande.pdf", 2 * 1024 * 1024 + 1)]);
    expect($("approvedStatusModal").textContent).toContain("passa de 2 MB");
    expect($("approvedStatusSave").disabled).toBe(true);
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "registrar_anexo_candidato_aprovado",
      expect.anything(),
    );
  });

  it("status e anexos entram na linha sem esperar a releitura", async () => {
    const supabase = supabaseFalso();
    await montar({ supabase, perfil: ADMIN });
    segurarRecarga(supabase);
    await abrirStatusDe("Bruno Lima");
    await escolher($("approvedStatusSelect"), "Desistente");
    await escolherArquivos([pdf("termo.pdf"), pdf("rg.pdf")]);
    await clicar($("approvedStatusSave"));

    expect(supabase.rpc).toHaveBeenCalledWith("listar_listas_aprovados");
    expect(
      linhaDe("Bruno Lima").querySelector(".approved-status").textContent,
    ).toBe("Desistente");
    expect(botaoDeAnexos("Bruno Lima").hasAttribute("data-tem-anexo")).toBe(
      true,
    );
    expect(botaoDeAnexos("Bruno Lima").title).toBe("Ver anexos (2)");
    // Os botões não esperam a releitura.
    expect(botaoDeAnexos("Bruno Lima").disabled).toBe(false);
    await clicar(botaoDeAnexos("Bruno Lima"));
    expect($("approvedAnexosLista").textContent).toContain("rg.pdf");
  });

  it("remover o anexo tira da linha na hora", async () => {
    const supabase = supabaseFalso({ anexos: ANEXOS() });
    await montar({ supabase, perfil: ADMIN });
    segurarRecarga(supabase);
    await clicar(botaoDeAnexos("Bruno Lima"));
    await clicar(
      $("approvedAnexosModal").querySelector(
        '[data-approved-action="remover-anexo"]',
      ),
    );
    expect($("approvedAnexosModal").textContent).toContain(
      "Nenhum anexo para este candidato.",
    );
    expect(botaoDeAnexos("Bruno Lima").disabled).toBe(true);
  });

  it("o contratador altera o status, mas não vê o campo de anexar", async () => {
    await montar();
    await abrirStatusDe("Bruno Lima");
    expect($("approvedStatusSelect")).not.toBeNull();
    expect($("approvedStatusAnexos")).toBeNull();
    expect($("approvedStatusModal").textContent).not.toContain(
      "Anexar documentos",
    );
  });

  it("o contratador vê os anexos, mas não remove", async () => {
    await montar({ supabase: supabaseFalso({ anexos: ANEXOS() }) });
    await clicar(botaoDeAnexos("Bruno Lima"));
    expect($("approvedAnexosLista").textContent).toContain("termo.pdf");
    expect(
      $("approvedAnexosModal").querySelector(
        '[data-approved-action="abrir-anexo"]',
      ),
    ).not.toBeNull();
    expect(
      $("approvedAnexosModal").querySelector(
        '[data-approved-action="remover-anexo"]',
      ),
    ).toBeNull();
  });

  it("status já definido: o contratador vê o cadeado e o modal não abre", async () => {
    const { toast } = await montar();
    const cadeado = linhaDe("Ana Ribeiro").querySelector(
      'button[title="Status já definido: só o admin altera"]',
    );
    expect(cadeado.disabled).toBe(true);
    expect(
      linhaDe("Ana Ribeiro").querySelector('[data-approved-action="status"]'),
    ).toBeNull();
    // Mesmo chamado por fora (o legado), o estado recusa e diz porquê.
    await act(async () => controlador.estado.abrirStatus("ana"));
    expect($("approvedStatusModal")).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      "O status já foi definido. Só o admin pode alterá-lo.",
      "warn",
    );
  });

  it("o admin anexa também a candidato com status já definido", async () => {
    const supabase = supabaseFalso();
    await montar({ supabase, perfil: ADMIN });
    await abrirStatusDe("Ana Ribeiro");
    expect($("approvedStatusAnexos")).not.toBeNull();
    await escolherArquivos([pdf("contrato.pdf")]);
    await clicar($("approvedStatusSave"));
    expect(supabase.rpc).toHaveBeenCalledWith(
      "registrar_anexo_candidato_aprovado",
      expect.objectContaining({ p_candidato_id: "ana" }),
    );
  });

  it("o admin continua alterando um status já definido", async () => {
    await montar({ perfil: { perfil: "admin" } });
    await abrirStatusDe("Ana Ribeiro");
    expect($("approvedStatusTitle").textContent).toBe(
      "Alterar status do candidato",
    );
    expect($("approvedStatusSelect").disabled).toBe(false);
  });

  it("registro recusado pelo banco avisa qual arquivo não entrou", async () => {
    const supabase = supabaseFalso({
      erros: { registrar_anexo_candidato_aprovado: "limite" },
    });
    const { toast } = await montar({ supabase, perfil: ADMIN });
    await abrirStatusDe("Bruno Lima");
    await escolherArquivos([pdf("a.pdf")]);
    await clicar($("approvedStatusSave"));
    expect(botaoDeAnexos("Bruno Lima").disabled).toBe(true);
    expect(toast).toHaveBeenCalledWith(
      "Status atualizado, mas 1 anexo(s) não foram enviados. a.pdf: limite",
      "error",
    );
  });
});

describe("ações sem tela de carregamento", () => {
  function supabaseQueEspera(rpcDemorada) {
    const supabase = supabaseFalso();
    const responder = supabase.rpc.getMockImplementation();
    let concluir = () => {};
    supabase.rpc.mockImplementation((nome, ...resto) => {
      if (nome !== rpcDemorada) return responder(nome, ...resto);
      return new Promise((resolver) => {
        concluir = () => resolver({ data: { ok: true }, error: null });
      });
    });
    return { supabase, concluir: () => concluir() };
  }
  const removerDaCarla = () =>
    linhaDe("Carla Souza").querySelector(
      '[data-approved-action="remove-subjudice"]',
    );
  const terminar = (concluir) =>
    esperar(async () => {
      concluir();
      await new Promise((resolver) => setTimeout(resolver, 0));
    });

  it("o botão mostra o andamento e as outras ações esperam", async () => {
    const { supabase, concluir } = supabaseQueEspera(
      "alterar_status_candidato_aprovado",
    );
    await montar({ supabase });
    await clicar(
      linhaDe("Bruno Lima").querySelector('[data-approved-action="status"]'),
    );
    await escolher($("approvedStatusSelect"), "Desistente");
    await clicar($("approvedStatusSave"));

    const salvar = $("approvedStatusSave");
    expect(salvar.disabled).toBe(true);
    expect(salvar.getAttribute("aria-busy")).toBe("true");
    expect(salvar.textContent).toContain("Salvando…");
    expect(removerDaCarla().disabled).toBe(true);

    await terminar(concluir);
    expect($("approvedStatusModal")).toBeNull();
    expect(removerDaCarla().disabled).toBe(false);
    expect(removerDaCarla().hasAttribute("aria-busy")).toBe(false);
  });

  it("na tabela, só o botão daquela linha gira", async () => {
    const { supabase, concluir } = supabaseQueEspera("remover_sub_judice");
    await montar({ supabase });
    await clicar(removerDaCarla());
    expect(removerDaCarla().getAttribute("aria-busy")).toBe("true");
    expect(removerDaCarla().querySelector(".botao-girando")).not.toBeNull();
    // Botão só de ícone: o rótulo fica para o leitor de tela.
    expect(removerDaCarla().querySelector(".sr-only").textContent).toBe(
      "Removendo…",
    );
    await terminar(concluir);
    expect(removerDaCarla().querySelector(".botao-girando")).toBeNull();
  });

  it("com uma ação em curso, a segunda não sai para a rede", async () => {
    const { supabase, concluir } = supabaseQueEspera("remover_sub_judice");
    await montar({ supabase });
    await clicar(removerDaCarla());
    await esperar(() => controlador.estado.removerSubJudice("carla"));
    expect(
      supabase.rpc.mock.calls.filter(([nome]) => nome === "remover_sub_judice"),
    ).toHaveLength(1);
    await terminar(concluir);
  });
});

describe("sub judice", () => {
  it("inclui pela RPC, com a nota em formato brasileiro", async () => {
    const { supabase } = await montar();
    await clicar($("approvedAddSubJudiceBtn"));
    // Só a lista ativa recebe sub judice.
    expect(
      [...$("subJudiceEdital").options].map((opcao) => opcao.value),
    ).toEqual(["10"]);
    expect(
      [...$("subJudiceCargo").options].map((opcao) => opcao.value),
    ).toEqual(["Enfermeiro", "Médico"]);
    await digitar($("subJudiceNome"), "Elza Martins");
    await escolher($("subJudiceCargo"), "Médico");
    await digitar($("subJudiceNota"), "87,5");

    supabase.rpc.mockClear();
    await clicar($("subJudiceSave"));
    expect(supabase.rpc).toHaveBeenCalledWith("incluir_sub_judice", {
      p_edital_id: "10",
      p_cargo: "Médico",
      p_nome: "Elza Martins",
      p_nota: 87.5,
      p_modalidade: null,
      p_processo: null,
      p_observacao: null,
    });
    expect($("subJudiceModal")).toBeNull();
  });

  it("recusa nota inválida sem chamar o banco", async () => {
    const { supabase, toast } = await montar();
    await clicar($("approvedAddSubJudiceBtn"));
    await digitar($("subJudiceNome"), "Elza Martins");
    await digitar($("subJudiceNota"), "abc");
    supabase.rpc.mockClear();
    await clicar($("subJudiceSave"));
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      "Preencha edital, cargo, nome e uma nota válida.",
      "warn",
    );
  });

  it("remover pede confirmação citando a pessoa", async () => {
    const confirmar = vi.fn(() => true);
    const { supabase } = await montar({ confirmar });
    await clicar(
      linhaDe("Carla Souza").querySelector(
        '[data-approved-action="remove-subjudice"]',
      ),
    );
    expect(confirmar.mock.calls[0][0]).toContain("Carla Souza");
    expect(supabase.rpc).toHaveBeenCalledWith("remover_sub_judice", {
      p_candidato_id: "carla",
    });
  });

  it("sem confirmação, nada acontece", async () => {
    const { supabase } = await montar({ confirmar: () => false });
    supabase.rpc.mockClear();
    await clicar(
      linhaDe("Carla Souza").querySelector(
        '[data-approved-action="remove-subjudice"]',
      ),
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("sub judice: candidato já aprovado (decisão judicial)", () => {
  const ADMIN = { perfil: "admin" };
  const martelo = (nome) =>
    linhaDe(nome)?.querySelector('[data-approved-action="alteracao-judicial"]');
  /* Tirou 33, a Justiça deu 40: o banco já guardou o resultado publicado. */
  const ALTERADA = () =>
    candidato({
      candidato_id: "elza",
      nome: "Elza Martins",
      nota: 40,
      sub_judice: true,
      alterado_judicialmente: true,
      nota_original: 33,
      modalidade_original: "Ampla concorrência",
      classificacao_original: 7,
    });

  it("o editor só vê a aba de novo candidato e nenhum martelo", async () => {
    await montar();
    expect(martelo("Ana Ribeiro")).toBeNull();
    await clicar($("approvedAddSubJudiceBtn"));
    expect($("subJudiceTabAprovado")).toBeNull();
    expect($("subJudicePainelAprovado")).toBeNull();
    expect($("subJudiceSave")).not.toBeNull();
  });

  it("o admin escolhe edital, cargo e candidato e registra a nota nova", async () => {
    const { supabase } = await montar({ perfil: ADMIN });
    await clicar($("approvedAddSubJudiceBtn"));
    await clicar($("subJudiceTabAprovado"));
    expect($("subJudiceTabAprovado").getAttribute("aria-selected")).toBe(
      "true",
    );
    await escolher($("subJudiceAprovadoCargo"), "Médico");
    expect(
      [...$("subJudiceAprovadoCandidato").options].map((opcao) => opcao.value),
    ).toEqual(["", "bruno"]);
    await escolher($("subJudiceAprovadoCandidato"), "bruno");
    // Começa com a nota e a modalidade atuais.
    expect($("alteracaoJudicialNota").value).toBe("90,5");
    expect($("alteracaoJudicialModalidade").value).toBe("Pessoa negra");
    await digitar($("alteracaoJudicialNota"), "95");
    await digitar($("alteracaoJudicialProcesso"), "1000000-00.2026.4.01.3400");

    supabase.rpc.mockClear();
    await clicar($("alteracaoJudicialSalvar"));
    expect(supabase.rpc).toHaveBeenCalledWith("alterar_candidato_sub_judice", {
      p_candidato_id: "bruno",
      p_nota: 95,
      p_modalidade: null,
      p_processo: "1000000-00.2026.4.01.3400",
      p_observacao: null,
    });
    expect($("subJudiceModal")).toBeNull();
  });

  it("muda só a modalidade, sem mandar a nota", async () => {
    const { supabase } = await montar({ perfil: ADMIN });
    await clicar(martelo("Ana Ribeiro"));
    await escolher($("alteracaoJudicialModalidade"), "Pessoa negra");
    supabase.rpc.mockClear();
    await clicar($("alteracaoJudicialSalvar"));
    expect(supabase.rpc).toHaveBeenCalledWith(
      "alterar_candidato_sub_judice",
      expect.objectContaining({
        p_candidato_id: "ana",
        p_nota: null,
        p_modalidade: "Pessoa negra",
      }),
    );
  });

  it("o martelo da linha abre na aba do candidato já aprovado, com ele escolhido", async () => {
    await montar({ perfil: ADMIN });
    await clicar(martelo("Ana Ribeiro"));
    expect($("subJudiceTabAprovado").getAttribute("aria-selected")).toBe(
      "true",
    );
    expect($("subJudicePainelNovo").classList.contains("hidden")).toBe(true);
    expect($("subJudiceAprovadoCandidato").value).toBe("ana");
  });

  it("sem mudar nota nem modalidade, não sai para o banco", async () => {
    const { supabase, toast } = await montar({ perfil: ADMIN });
    await clicar(martelo("Ana Ribeiro"));
    supabase.rpc.mockClear();
    await clicar($("alteracaoJudicialSalvar"));
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      "Informe uma nota ou modalidade diferente da atual.",
      "warn",
    );
  });

  it("o alterado mostra 33 → 40 e não tem o botão de remover", async () => {
    await montar({
      supabase: supabaseFalso({ candidatos: [...CANDIDATOS(), ALTERADA()] }),
    });
    const linha = linhaDe("Elza Martins");
    expect(linha.querySelector(".approved-de-para s").textContent).toBe("33");
    expect(linha.querySelector(".approved-de-para strong").textContent).toBe(
      "40",
    );
    expect(
      linha.querySelector('[data-approved-action="remove-subjudice"]'),
    ).toBeNull();
  });

  it("o admin desfaz a alteração, com confirmação", async () => {
    const confirmar = vi.fn(() => true);
    const { supabase } = await montar({
      perfil: ADMIN,
      confirmar,
      supabase: supabaseFalso({ candidatos: [...CANDIDATOS(), ALTERADA()] }),
    });
    await clicar(martelo("Elza Martins"));
    expect(
      document.querySelector(".approved-decisao-original").textContent,
    ).toContain("33");
    supabase.rpc.mockClear();
    await clicar($("alteracaoJudicialDesfazer"));
    expect(confirmar.mock.calls[0][0]).toContain("Elza Martins");
    expect(supabase.rpc).toHaveBeenCalledWith("desfazer_alteracao_sub_judice", {
      p_candidato_id: "elza",
      p_observacao: null,
    });
  });
});

describe("modal de listas do edital", () => {
  const abrir = (editalId = "10") =>
    esperar(() =>
      controlador.openImportModal(editalId, "03/2025 · DSEI Manaus"),
    );

  it("sem permissão, não abre e avisa", async () => {
    const { toast } = await montar({ perfil: { perfil: "usuario" } });
    await abrir();
    expect($("approvedImportModal")).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      "Sem permissão para gerir lista de aprovados.",
      "warn",
    );
  });

  it("abre por cima de qualquer página, mesmo com a de aprovados escondida", async () => {
    await montar({ secaoAtiva: false, carregar: false });
    await abrir();
    const modal = $("approvedImportModal");
    expect(modal.parentElement).toBe(document.body);
    expect($("approvedImportEdital").textContent).toBe("03/2025 · DSEI Manaus");
  });

  it("para quem não é admin, a lista importada é só ativar/inativar", async () => {
    await montar({ perfil: { perfil: "edital_gestor" } });
    await abrir();
    expect($("approvedImportCurrentState").textContent).toContain(
      "aprovados-03-2025.xlsx",
    );
    expect($("approvedImportFileRow").classList.contains("hidden")).toBe(true);
    expect($("approvedImportSubmit")).toBeNull();
    expect($("approvedImportRemove")).toBeNull();
    expect($("approvedImportPermissionNote").textContent).toContain(
      "Só admin substitui ou remove o XLSX.",
    );
  });

  it("o admin pode substituir e remover", async () => {
    await montar({ perfil: { perfil: "admin" } });
    await abrir();
    expect($("approvedImportPermissionNote")).toBeNull();
    expect($("approvedImportSubmit").textContent).toContain("Substituir XLSX");
    expect($("approvedImportRemove")).not.toBeNull();
    expect(
      document.querySelector(".approved-import-replace-warning"),
    ).not.toBeNull();
  });

  it("edital sem lista oferece a importação e o modelo de planilha", async () => {
    await montar();
    await abrir("99");
    expect($("approvedImportCurrentState").textContent).toBe(
      "Sem lista importada",
    );
    expect($("approvedImportSubmit").textContent).toContain("Importar lista");
    expect($("approvedImportDownloadCurrent")).toBeNull();
    const modelo = $("approvedImportModelLink");
    expect(modelo.getAttribute("href")).toBe(
      PLANILHAS.modeloListaAprovados.url,
    );
    expect(modelo.getAttribute("download")).toBe(
      PLANILHAS.modeloListaAprovados.nomeDoArquivo,
    );
  });

  it("aplica a situação escolhida pela RPC", async () => {
    const { supabase } = await montar();
    await abrir();
    expect($("approvedImportActive").value).toBe("true");
    await escolher($("approvedImportActive"), "false");
    supabase.rpc.mockClear();
    await clicar($("approvedImportToggleActive"));
    expect(supabase.rpc).toHaveBeenCalledWith("definir_lista_aprovados_ativa", {
      p_lista_id: "L10",
      p_ativo: false,
    });
    // Continua aberto, para a pessoa ver o resultado.
    expect($("approvedImportModal")).not.toBeNull();
  });

  it("importa: lê o XLSX, anexa no bucket e grava os candidatos", async () => {
    const supabase = supabaseFalso();
    const lerPlanilha = vi.fn(async () => [{ nome: "X" }, { nome: "Y" }]);
    const mudou = vi.fn();
    document.addEventListener("agsus:listas-aprovados-changed", mudou);
    const { toast } = await montar({ supabase, lerPlanilha });
    await abrir("99");

    const arquivo = new File(["x"], "Lista Açaí 2026.xlsx");
    Object.defineProperty($("approvedImportFile"), "files", {
      value: [arquivo],
    });
    supabase.rpc.mockClear();
    await clicar($("approvedImportSubmit"));
    document.removeEventListener("agsus:listas-aprovados-changed", mudou);

    expect(lerPlanilha).toHaveBeenCalledWith(arquivo);
    expect(supabase.storage.from).toHaveBeenCalledWith(
      PLANILHAS.listaAprovadosImportada.bucket,
    );
    const [caminho] = supabase.bucket.upload.mock.calls[0];
    expect(caminho).toMatch(/^99\/\d+-.+-Lista-Acai-2026\.xlsx$/);
    const [nome, argumentos] = supabase.rpc.mock.calls[0];
    expect(nome).toBe("importar_lista_aprovados");
    expect(argumentos).toMatchObject({
      p_edital_id: "99",
      p_ativo: true,
      p_arquivo_nome: "Lista Açaí 2026.xlsx",
      p_arquivo_path: caminho,
      p_candidatos: [{ nome: "X" }, { nome: "Y" }],
      p_substituir: false,
    });
    expect(toast).toHaveBeenCalledWith(
      "2 candidato(s) importados com sucesso.",
    );
    expect($("approvedImportModal")).toBeNull();
    expect(mudou).toHaveBeenCalledTimes(1);
  });

  it("sem arquivo, ou grande demais, avisa sem enviar nada", async () => {
    const supabase = supabaseFalso();
    const { toast } = await montar({ supabase });
    await abrir("99");
    await clicar($("approvedImportSubmit"));
    expect(toast).toHaveBeenLastCalledWith("Selecione o arquivo XLSX.", "warn");

    const grande = new File(["x"], "grande.xlsx");
    Object.defineProperty(grande, "size", { value: 11 * 1024 * 1024 });
    Object.defineProperty($("approvedImportFile"), "files", {
      value: [grande],
    });
    await clicar($("approvedImportSubmit"));
    expect(toast).toHaveBeenLastCalledWith(
      "O XLSX deve ter no máximo 10 MB.",
      "warn",
    );
    expect(supabase.bucket.upload).not.toHaveBeenCalled();
  });

  it("remover a lista pede confirmação e avisa o resto do app", async () => {
    const confirmar = vi.fn(() => true);
    const { supabase } = await montar({
      perfil: { perfil: "admin" },
      confirmar,
    });
    await abrir();
    supabase.rpc.mockClear();
    await clicar($("approvedImportRemove"));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("remover_lista_aprovados", {
      p_lista_id: "L10",
    });
  });

  it("baixa o XLSX atual do bucket", async () => {
    const supabase = supabaseFalso();
    await montar({ supabase });
    const baixados = [];
    const original = URL.createObjectURL;
    URL.createObjectURL = () => "blob:falso";
    const clique = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function () {
        baixados.push(this.download);
      });
    await abrir();
    await clicar($("approvedImportDownloadCurrent"));
    clique.mockRestore();
    URL.createObjectURL = original;
    expect(supabase.bucket.download).toHaveBeenCalledWith("10/arquivo.xlsx");
    expect(baixados).toEqual(["aprovados-03-2025.xlsx"]);
  });

  it("reabrir começa na aba do arquivo, com rascunho limpo", async () => {
    await montar();
    await abrir();
    await clicar(document.querySelector('[data-import-tab="convocacao"]'));
    expect($("approvedImportPanelArquivo").classList.contains("hidden")).toBe(
      true,
    );
    await clicar(
      document.querySelector("#approvedImportModal .modal-head .btn"),
    );
    await abrir();
    expect($("approvedImportPanelArquivo").classList.contains("hidden")).toBe(
      false,
    );
  });
});

/*
  Só as listas e os candidatos dos editais da área escolhida no menu: o
  recorte é pelo conjunto de ids das linhas do monitoramento daquela área.
*/
describe("área atual", () => {
  it("candidatos, contador e seletor de edital seguem a área", async () => {
    publicarLinhasDoMonitoramento([
      { id: "10", CO_AREA: "saude-indigena" },
      { id: "20", CO_AREA: "sede" },
    ]);
    await montar();
    expect(nomes()).toEqual(["Ana Ribeiro", "Bruno Lima", "Carla Souza"]);
    expect($("approvedCount").textContent).toBe("3 candidatos");

    await act(async () => definirAreaAtual("sede"));
    expect(nomes()).toEqual(["Diego Alves"]);
    expect($("approvedCount").textContent).toBe("1 candidato");
    expect(opcoesDoFiltro("approvedFilterEdital")).toEqual([
      expect.stringContaining("04/2025"),
    ]);

    await act(async () => definirAreaAtual("projetos"));
    expect(nomes()).toEqual([]);
  });
});

describe("candidatos por área, com a cópia do navegador", () => {
  const USUARIO = { perfil: "contratador", user_id: "u1" };
  const ADMIN = { perfil: "admin" };

  function armazenamentoEmMemoria() {
    const dados = new Map();
    return {
      dados,
      ler: async (chave) => structuredClone(dados.get(chave) ?? null),
      guardar: async (chave, valor) => {
        dados.set(chave, structuredClone(valor));
      },
      apagarTudo: async () => dados.clear(),
    };
  }

  // A gravação da cópia não é esperada pela carga: dá a vez às promessas.
  const assentar = () => esperar(() => new Promise((r) => setTimeout(r, 0)));

  it("trocar de área no menu busca os candidatos da área nova", async () => {
    publicarLinhasDoMonitoramento([
      { id: "10", CO_AREA: "saude-indigena" },
      { id: "30", CO_AREA: "sede" },
    ]);
    const supabase = supabaseFalso({
      candidatos: [
        ...CANDIDATOS(),
        candidato({ candidato_id: "sede", nome: "Sara Sede", edital_id: "30" }),
      ],
    });
    await montar({ supabase });
    expect(nomes()).not.toContain("Sara Sede");

    await esperar(() => definirAreaAtual("sede"));
    await esperar(() => controlador.render());
    expect(chamadasDoPacote(supabase).at(-1)).toEqual({
      p_area: "sede",
      p_versao: null,
    });
    expect(nomes()).toEqual(["Sara Sede"]);
  });

  it("depois de uma escrita, relê do banco com a versão da tela e fica com a nova", async () => {
    const supabase = supabaseFalso();
    await montar({ supabase, perfil: ADMIN });
    await clicar(
      linhaDe("Bruno Lima").querySelector('[data-approved-action="status"]'),
    );
    await escolher($("approvedStatusSelect"), "Desistente");
    supabase.banco.candidatos = supabase.banco.candidatos.map((c) =>
      c.candidato_id === "bruno" ? { ...c, status: "Desistente" } : c,
    );
    await clicar($("approvedStatusSave"));
    await assentar();
    expect(chamadasDoPacote(supabase).at(-1)).toEqual({
      p_area: "saude-indigena",
      p_versao: "v1",
    });
    expect(
      linhaDe("Bruno Lima").querySelector(".approved-status").textContent,
    ).toBe("Desistente");
  });

  it("versão que continua valendo mantém os candidatos da tela", async () => {
    const supabase = supabaseFalso();
    await montar({ supabase });
    const antes = controlador.estado.obter().candidatos;
    await esperar(() => controlador.estado.carregar({ emSegundoPlano: true }));
    expect(chamadasDoPacote(supabase).at(-1)).toEqual({
      p_area: "saude-indigena",
      p_versao: "v1",
    });
    expect(controlador.estado.obter().candidatos).toBe(antes);
  });

  it("a próxima abertura mostra a cópia guardada e só pergunta a versão", async () => {
    const armazenamento = armazenamentoEmMemoria();
    await montar({ perfil: USUARIO, armazenamento });
    await assentar();
    expect(armazenamento.dados.has("aprovados:saude-indigena")).toBe(true);
    await act(async () => controlador.raiz.unmount());

    // Mesmo banco, mesma versão: a lista vem da cópia, sem baixar de novo.
    const supabase = supabaseFalso({ candidatos: [] });
    await montar({ perfil: USUARIO, armazenamento, supabase });
    await assentar();
    expect(chamadasDoPacote(supabase)).toEqual([
      { p_area: "saude-indigena", p_versao: "v1" },
    ]);
    expect(nomes()).toContain("Bruno Lima");
  });

  it("a cópia aparece na hora e a versão nova do banco a substitui", async () => {
    const armazenamento = armazenamentoEmMemoria();
    await montar({ perfil: USUARIO, armazenamento });
    await assentar();
    await act(async () => controlador.raiz.unmount());

    const supabase = supabaseFalso({
      candidatos: [candidato({ candidato_id: "nova", nome: "Nina Nova" })],
    });
    supabase.banco.versao = "v9";
    await montar({ perfil: USUARIO, armazenamento, supabase });
    await assentar();
    expect(nomes()).toEqual(["Nina Nova"]);
    const guardada = JSON.parse(
      armazenamento.dados.get("aprovados:saude-indigena").texto,
    );
    expect(guardada.versao).toBe("v9");
  });

  it("sem acesso à área na revalidação, a cópia sai e a lista fica vazia", async () => {
    const armazenamento = armazenamentoEmMemoria();
    await montar({ perfil: USUARIO, armazenamento });
    await assentar();
    await act(async () => controlador.raiz.unmount());

    const supabase = supabaseFalso();
    const responder = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation((nome, ...resto) =>
      nome === "listar_candidatos_aprovados_compacto"
        ? Promise.resolve({
            data: null,
            error: { code: "42501", message: "Sem permissão" },
          })
        : responder(nome, ...resto),
    );
    const { toast } = await montar({
      perfil: USUARIO,
      armazenamento,
      supabase,
    });
    await assentar();
    expect(nomes()).toEqual([]);
    expect(armazenamento.dados.size).toBe(0);
    expect(toast).toHaveBeenCalledWith(
      "Erro ao carregar lista de aprovados: Sem permissão",
      "error",
    );
  });
});
