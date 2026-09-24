import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { montarListaAprovados } from "../../src/componentes/lista-aprovados/lista-aprovados.jsx";
import { PLANILHAS } from "../../src/lib/planilhas.js";
import { clicar, digitar, escolher, esperar, teclar } from "./interacoes.js";

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
  erros = {},
} = {}) {
  const lotes = [];
  const responder = (nome) => {
    if (erros[nome]) return { data: null, error: { message: erros[nome] } };
    if (nome === "listar_listas_aprovados")
      return { data: listas, error: null };
    if (nome === "listar_modelos_convocacao") return { data: [], error: null };
    if (nome === "listar_configuracao_convocacao")
      return { data: [], error: null };
    return { data: { ok: true }, error: null };
  };
  const rpc = vi.fn((nome) => {
    if (nome === "listar_candidatos_aprovados") {
      const pagina = (de, ate) => {
        lotes.push([de, ate]);
        return Promise.resolve({
          data: candidatos.slice(de, ate + 1),
          error: null,
        });
      };
      return { range: pagina };
    }
    const resposta = Promise.resolve(responder(nome));
    resposta.range = () => resposta;
    return resposta;
  });
  const bucket = {
    upload: vi.fn(async () => ({ data: {}, error: null })),
    download: vi.fn(async () => ({ data: new Blob(["x"]), error: null })),
  };
  const storage = { from: vi.fn(() => bucket) };
  return { rpc, storage, bucket, lotes };
}

let controlador = null;
let perfilAtual = null;

async function montar({
  perfil = { perfil: "contratador" },
  supabase = supabaseFalso(),
  toast = vi.fn(),
  confirmar = () => true,
  lerPlanilha = async () => [{ nome: "X" }, { nome: "Y" }],
  secaoAtiva = true,
  carregar = true,
} = {}) {
  document.body.innerHTML = `<section id="page-approved" class="page${secaoAtiva ? " active" : ""}"></section>`;
  perfilAtual = perfil;
  await act(async () => {
    controlador = montarListaAprovados({
      secao: document.getElementById("page-approved"),
      supabase,
      toast,
      loader: () => {},
      getProfile: () => perfilAtual,
      confirmar,
      lerPlanilha,
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

describe("carregamento", () => {
  it("antes do dado chegar, mostra carregando — e não zero", async () => {
    await montar({ carregar: false });
    expect($("approvedKpiTotal").textContent).toBe("—");
    expect($("approvedCount").textContent).toBe("Carregando…");
    expect($("approvedRows").textContent).toContain(
      "Carregando lista de aprovados",
    );
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

  it("busca os candidatos de mil em mil, até o lote vir incompleto", async () => {
    const muitos = Array.from({ length: 1003 }, () => candidato());
    const supabase = supabaseFalso({ candidatos: muitos });
    await montar({ supabase });
    expect(supabase.lotes).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect($("approvedKpiTotal").textContent).toBe("1.003");
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
    expect(diego.querySelector("button[disabled]").title).toBe("Lista inativa");
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
      "O perfil edital_gestor pode ativar/inativar",
    );
  });

  it("o admin pode substituir e remover", async () => {
    await montar({ perfil: { perfil: "admin" } });
    await abrir();
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
