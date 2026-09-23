import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListaConvocacaoController } from "../src/modules/lista-convocacao.js";
import { modeloDeReferencia } from "../src/lib/modelo-de-convocacao.js";

/*
  A costura entre as peças: o modelo e a configuração como o banco os devolve, a
  derivação do quadro, o cálculo da ordem e o HTML — inclusive as permissões,
  que decidem se o botão de alterar status aparece.
*/

const OPCOES_STATUS = `
  <option value="">Todos os status</option>
  <option value="__sem_status__">Sem status</option>
  <option value="Contratado">Contratado</option>
  <option value="Desistente">Desistente</option>
`;

function montarTela() {
  document.body.innerHTML = `
    <button data-approved-tab="aprovados" class="approved-tab active"></button>
    <button data-approved-tab="convocacao" class="approved-tab"></button>
    <div id="approvedHeadActions"></div>
    <div id="approvedPanelAprovados"></div>
    <div id="approvedPanelConvocacao" class="hidden">
      <strong id="convocacaoKpiVagas">0</strong>
      <strong id="convocacaoKpiImediatas">0</strong>
      <strong id="convocacaoKpiConvocaveis">0</strong>
      <strong id="convocacaoKpiReserva">0</strong>
      <strong id="convocacaoKpiForaDaFila">0</strong>
      <select id="convocacaoFilterEdital"><option value="">Todos</option></select>
      <select id="convocacaoFilterCargo"><option value="">Todos</option></select>
      <select id="convocacaoFilterStatus">${OPCOES_STATUS}</select>
      <div class="table-wrap"><div id="convocacaoRows"></div></div>
      <div id="convocacaoPaginacao" hidden>
        <span id="convocacaoPaginacaoInfo"></span>
        <select id="convocacaoPageSize"><option value="50" selected>50</option></select>
        <button id="convocacaoPagePrev"></button>
        <span id="convocacaoPaginaAtual"></span>
        <button id="convocacaoPageNext"></button>
      </div>
    </div>
  `;
}

function montarFormulario() {
  document.body.innerHTML += `
    <button data-import-tab="arquivo" class="approved-tab active"></button>
    <button data-import-tab="convocacao" class="approved-tab"></button>
    <div id="approvedImportPanelArquivo"></div>
    <div id="approvedImportPanelConvocacao" class="hidden">
      <label><input type="radio" name="convocacaoTipo" value="com" checked /></label>
      <label><input type="radio" name="convocacaoTipo" value="sem" /></label>
      <div id="convocacaoQuadro">
        <select id="convocacaoModelo"></select>
        <button id="convocacaoEditarModelo"></button>
        <button id="convocacaoNovoModelo"></button>
        <p id="convocacaoModeloResumo"></p>
        <div id="convocacaoEditorModelo" class="hidden"></div>
        <p id="convocacaoVagasBloqueadas" class="hidden"></p>
        <div id="convocacaoVagasBloco">
          <input id="convocacaoPadraoImediata" type="number" value="0" />
          <button id="convocacaoAplicarPadrao"></button>
          <span id="convocacaoVagasResumo"></span>
          <table><thead id="convocacaoVagasHead"></thead><tbody id="convocacaoVagasRows"></tbody></table>
        </div>
      </div>
      <p id="convocacaoPermissionNote"></p>
      <button id="convocacaoSalvar"></button>
    </div>
  `;
}

let sequencial = 0;
const candidato = (nome, modalidade, extra = {}) => {
  sequencial += 1;
  return {
    candidato_id: `c${sequencial}`,
    nome,
    modalidade,
    nota: 100 - sequencial,
    classificacao: sequencial,
    cargo: "ENFERMEIRO",
    codigo_vaga: "VG-001",
    edital_id: "7",
    edital: "53/2025",
    unidade: "CASAI São Paulo",
    lista_ativa: true,
    status: "",
    ...extra,
  };
};

const MODELO_ID = "11111111-1111-1111-1111-111111111111";

/** O modelo de referência na forma que `listar_modelos_convocacao` devolve. */
const linhaDoModelo = (mudancas = {}) => {
  const base = modeloDeReferencia("lei-15142-2025");
  return {
    modelo_id: MODELO_ID,
    nome: base.nome,
    descricao: base.descricao,
    distribuicao: base.distribuicao,
    cota_multipla: base.cotaMultipla,
    minimo_reserva: base.minimoParaReserva,
    editais: 1,
    categorias: base.categorias.map((categoria) => ({
      ...categoria,
      termos: categoria.termos.join("; "),
      posicoes: (categoria.posicoes || []).join("; "),
      cascata: (categoria.cascata || []).join("; "),
    })),
    ...mudancas,
  };
};

/*
  Fingimos as duas RPCs de leitura. `rpc` devolve por nome para que o mesmo
  duplo sirva às chamadas paralelas de `carregarConfiguracoes`.
*/
const supabaseFalso = ({
  modelo = linhaDoModelo(),
  padraoImediata = 0,
  vagas = [],
  proporcionalidade = true,
  comModelo = true,
} = {}) => {
  const rpc = vi.fn(async (nome) => {
    if (nome === "listar_modelos_convocacao")
      return { data: modelo ? [modelo] : [], error: null };
    if (nome === "listar_configuracao_convocacao")
      return {
        data: [
          {
            edital_id: "7",
            proporcionalidade,
            modelo_id: comModelo ? MODELO_ID : null,
            padrao_imediata: padraoImediata,
            vagas,
          },
        ],
        error: null,
      };
    return { data: { ok: true }, error: null };
  });
  return { rpc };
};

/** Quadro exato numa vaga, sem depender da conta do percentual. */
const vagaManual = (codigo, quadro) => ({
  codigo_vaga: codigo,
  cargo: null,
  imediatas: Object.values(quadro).reduce((soma, valor) => soma + valor, 0),
  manual: true,
  quadro,
});

function criar({ candidatos, supabase, perfil = { perfil: "contratador" } }) {
  return createListaConvocacaoController({
    supabase,
    toast: () => {},
    loader: () => {},
    getProfile: () => perfil,
    getCandidates: () => candidatos,
    getLists: () => [
      { edital_id: "7", edital: "53/2025", unidade: "CASAI São Paulo" },
    ],
  });
}

const nomesNaTabela = () =>
  [...document.querySelectorAll("#convocacaoRows tr")]
    .map((linha) => linha.querySelector(".approved-name strong")?.textContent)
    .filter(Boolean);

describe("aba da lista de convocação", () => {
  beforeEach(() => {
    montarTela();
  });

  it("desenha a ordem de convocação, e não a de classificação", async () => {
    const controlador = criar({
      candidatos: [
        candidato("JOÃO", '"Pretos e Pardos"'),
        candidato("MARIA", "Ampla Concorrência"),
        candidato("PEDRO", '"Pretos e Pardos"'),
      ],
      supabase: supabaseFalso({
        vagas: [vagaManual("VG-001", { ampla: 2, pretos_pardos: 1 })],
      }),
    });
    await controlador.carregarConfiguracoes();
    controlador.render();

    expect(nomesNaTabela()).toEqual(["JOÃO", "PEDRO", "MARIA"]);
    expect(document.getElementById("convocacaoKpiImediatas").textContent).toBe(
      "3",
    );
  });

  /*
    O caminho real: percentual do modelo mais o total de vagas. 10 x 25% = 2,5
    sobe para 3; 10 x 5% = 0,5 sobe para 1; 3% e 2% descem para 0. Sobram 6.
  */
  it("deriva o quadro do percentual do modelo", async () => {
    const controlador = criar({
      candidatos: [candidato("MARIA", "Ampla Concorrência")],
      supabase: supabaseFalso({ padraoImediata: 10 }),
    });
    await controlador.carregarConfiguracoes();
    controlador.render();

    const cabecalho = document.querySelector(".convocacao-grupo");
    expect(cabecalho.textContent).toContain("10 vagas imediatas");
    expect(cabecalho.textContent).toContain("AC 6 · PP 3 · PCD 1");
  });

  it("respeita o total próprio da vaga", async () => {
    const controlador = criar({
      candidatos: [
        candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("B", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
      ],
      supabase: supabaseFalso({
        padraoImediata: 5,
        vagas: [
          {
            codigo_vaga: "VG-002",
            cargo: "MÉDICO",
            imediatas: 0,
            manual: false,
            quadro: {},
          },
        ],
      }),
    });
    await controlador.carregarConfiguracoes();
    controlador.render();

    const cabecalhos = [...document.querySelectorAll(".convocacao-grupo")].map(
      (linha) => linha.textContent,
    );
    expect(cabecalhos[0]).toContain("5 vagas imediatas");
    expect(cabecalhos[1]).toContain("Sem vaga imediata");
  });

  it("mostra quem desistiu fora da numeração, sem gastar vaga", async () => {
    const controlador = criar({
      candidatos: [
        candidato("MARIA", "Ampla", { status: "Desistente" }),
        candidato("CARLOS", "Ampla"),
      ],
      supabase: supabaseFalso({
        vagas: [vagaManual("VG-001", { ampla: 1 })],
      }),
    });
    await controlador.carregarConfiguracoes();
    controlador.render();

    expect(nomesNaTabela()).toEqual(["CARLOS", "MARIA"]);
    expect(document.querySelector(".convocacao-vaga.fora")).not.toBeNull();
    expect(document.getElementById("convocacaoKpiForaDaFila").textContent).toBe(
      "1",
    );
  });

  /*
    O termo desconhecido é do MODELO, não do sistema: o aviso aparece para que
    o gestor saiba que basta acrescentar o termo àquela categoria.
  */
  it("avisa quando a modalidade declarada não foi reconhecida", async () => {
    const controlador = criar({
      candidatos: [candidato("LUA", "Pessoa Trans")],
      supabase: supabaseFalso({ padraoImediata: 1 }),
    });
    await controlador.carregarConfiguracoes();
    controlador.render();
    expect(document.querySelector(".convocacao-alerta")).not.toBeNull();
  });

  it("mostra as duas reservas declaradas e destaca a que vale", async () => {
    const controlador = criar({
      candidatos: [candidato("ANA", '"pretos e pardos" e "quilombola"')],
      supabase: supabaseFalso({
        vagas: [vagaManual("VG-001", { ampla: 1 })],
      }),
    });
    await controlador.carregarConfiguracoes();
    controlador.render();

    const modalidade = document.querySelector(".convocacao-modalidade");
    expect(modalidade.textContent).toContain("PP");
    expect(modalidade.textContent).toContain("QUI");
    expect(modalidade.querySelector("strong").textContent).toBe("PP");
    expect(document.querySelector(".convocacao-multipla")).not.toBeNull();
  });

  /*
    A trava é a mesma da lista de aprovados e vem do candidato: lista inativa
    não se altera de nenhuma das duas abas.
  */
  it("bloqueia a ação de status quando a lista está inativa", async () => {
    const controlador = criar({
      candidatos: [candidato("MARIA", "Ampla", { lista_ativa: false })],
      supabase: supabaseFalso({ vagas: [vagaManual("VG-001", { ampla: 1 })] }),
    });
    await controlador.carregarConfiguracoes();
    controlador.render();
    expect(
      document.querySelector(
        '#convocacaoRows [data-convocacao-action="status"]',
      ),
    ).toBeNull();
    expect(
      document.querySelector("#convocacaoRows button[disabled]"),
    ).not.toBeNull();
  });

  it("chama o mesmo modal de status da lista de aprovados", async () => {
    const abrir = vi.fn();
    const controlador = createListaConvocacaoController({
      supabase: supabaseFalso({ vagas: [vagaManual("VG-001", { ampla: 1 })] }),
      toast: () => {},
      loader: () => {},
      getProfile: () => ({ perfil: "contratador" }),
      getCandidates: () => [candidato("MARIA", "Ampla")],
      getLists: () => [],
      openStatusModal: abrir,
    });
    await controlador.carregarConfiguracoes();
    controlador.render();

    document
      .querySelector('#convocacaoRows [data-convocacao-action="status"]')
      .click();
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  /*
    Edital sem modelo não inventa reserva: as vagas que o gestor digitou
    continuam de pé, todas como ampla. Nem mesmo quem declarou cota recebe
    posição reservada, porque não há regra que a crie.
  */
  it("sem modelo, as vagas saem todas como ampla", async () => {
    const controlador = criar({
      candidatos: [candidato("MARIA", '"Pretos e Pardos"')],
      supabase: supabaseFalso({ comModelo: false, padraoImediata: 10 }),
    });
    await controlador.carregarConfiguracoes();
    controlador.render();
    const cabecalho = document.querySelector(".convocacao-grupo").textContent;
    expect(cabecalho).toContain("10 vagas imediatas");
    expect(cabecalho).toContain("AC 10");
    expect(cabecalho).not.toContain("PP");
  });

  it("some com as ações da lista de aprovados ao trocar de aba", () => {
    const controlador = criar({ candidatos: [], supabase: supabaseFalso() });
    controlador.mostrarAbaDaPagina("convocacao");
    expect(
      document
        .getElementById("approvedHeadActions")
        .classList.contains("hidden"),
    ).toBe(true);
    controlador.mostrarAbaDaPagina("aprovados");
    expect(
      document
        .getElementById("approvedHeadActions")
        .classList.contains("hidden"),
    ).toBe(false);
  });
});

describe("formulário de convocação do edital", () => {
  beforeEach(() => {
    montarTela();
    montarFormulario();
  });

  it("lista as vagas que vieram da lista importada", async () => {
    const controlador = criar({
      candidatos: [
        candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("B", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("C", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
      ],
      supabase: supabaseFalso(),
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");

    expect(
      [...document.querySelectorAll("[data-convocacao-vaga]")].map(
        (linha) => linha.dataset.convocacaoVaga,
      ),
    ).toEqual(["VG-001", "VG-002"]);
    expect(document.getElementById("convocacaoVagasResumo").textContent).toBe(
      "2 vagas",
    );
  });

  it("mostra o quadro derivado ao lado do total de cada vaga", async () => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase: supabaseFalso({ padraoImediata: 10 }),
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");

    expect(
      document.querySelector(".convocacao-quadro-derivado").textContent,
    ).toBe("AC 6 · PP 3 · PCD 1");
  });

  it("resume o modelo e avisa quando ele é partilhado", async () => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase: supabaseFalso({ modelo: linhaDoModelo({ editais: 6 }) }),
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");

    const resumo = document.getElementById("convocacaoModeloResumo");
    expect(resumo.textContent).toContain("PP 25%");
    expect(resumo.textContent).toContain("usado por 6 editais");
    expect(resumo.classList.contains("compartilhado")).toBe(true);
  });

  it("manda para a RPC o tipo, o modelo e as vagas", async () => {
    const supabase = supabaseFalso({ padraoImediata: 4 });
    const controlador = criar({
      candidatos: [
        candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("C", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
      ],
      supabase,
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");

    supabase.rpc.mockClear();
    document.getElementById("convocacaoSalvar").click();
    await vi.waitFor(() => expect(supabase.rpc).toHaveBeenCalled());

    const [nome, argumentos] = supabase.rpc.mock.calls[0];
    expect(nome).toBe("salvar_configuracao_convocacao");
    expect(argumentos.p_edital_id).toBe("7");
    expect(argumentos.p_modelo_id).toBe(MODELO_ID);
    expect(argumentos.p_padrao_imediata).toBe(4);
    expect(argumentos.p_vagas).toEqual([
      expect.objectContaining({ codigo_vaga: "VG-001", imediatas: 4 }),
      expect.objectContaining({ codigo_vaga: "VG-002", imediatas: 4 }),
    ]);
  });

  it("aplica o total padrão a todas as vagas", async () => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase: supabaseFalso(),
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");

    const padrao = document.getElementById("convocacaoPadraoImediata");
    padrao.value = "4";
    padrao.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("convocacaoAplicarPadrao").click();

    expect(document.querySelector("[data-convocacao-imediatas]").value).toBe(
      "4",
    );
  });

  /*
    Ligar a sobrescrita copia o quadro derivado para os campos: começar do zero
    faria a vaga perder, sem aviso, as vagas que o percentual já lhe dava.
  */
  it("ao ligar a sobrescrita manual, parte do quadro derivado", async () => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase: supabaseFalso({ padraoImediata: 4 }),
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");

    const manual = document.querySelector("[data-convocacao-manual]");
    manual.checked = true;
    manual.dispatchEvent(new Event("change", { bubbles: true }));

    const campos = Object.fromEntries(
      [...document.querySelectorAll("[data-convocacao-vaga-cota]")].map(
        (campo) => [campo.dataset.convocacaoVagaCota, campo.value],
      ),
    );
    expect(campos).toMatchObject({ ampla: "3", pretos_pardos: "1" });
  });

  it("tranca o formulário para quem não pode gerir o edital", async () => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase: supabaseFalso(),
      perfil: { perfil: "usuario" },
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");

    expect(
      document.getElementById("convocacaoSalvar").classList.contains("hidden"),
    ).toBe(true);
    expect(
      document.querySelector("[data-convocacao-vaga] input").disabled,
    ).toBe(true);
  });
});

describe("editor do modelo de regras", () => {
  beforeEach(() => {
    montarTela();
    montarFormulario();
  });

  const abrirEditor = async (supabase, candidatos) => {
    const controlador = criar({ candidatos, supabase });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");
    document.getElementById("convocacaoEditarModelo").click();
    return controlador;
  };

  it("desenha uma ficha por categoria do modelo", async () => {
    await abrirEditor(supabaseFalso(), [
      candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
    ]);
    const fichas = [
      ...document.querySelectorAll("[data-convocacao-categoria]"),
    ];
    expect(fichas.map((f) => f.dataset.convocacaoCategoria)).toEqual([
      "ampla",
      "pretos_pardos",
      "indigena",
      "quilombola",
      "pcd",
    ]);
  });

  /*
    O ponto todo do modelo configurável: acrescentar a reserva que o edital
    tem e o sistema não conhecia — como a cota trans do 97/2025.
  */
  it("acrescenta e remove categoria", async () => {
    await abrirEditor(supabaseFalso(), [
      candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
    ]);
    document.getElementById("convocacaoAdicionarCategoria").click();
    expect(
      document.querySelectorAll("[data-convocacao-categoria]"),
    ).toHaveLength(6);

    document
      .querySelector(
        '[data-convocacao-categoria="pcd"] [data-convocacao-remover-categoria]',
      )
      .click();
    const restantes = [
      ...document.querySelectorAll("[data-convocacao-categoria]"),
    ].map((f) => f.dataset.convocacaoCategoria);
    expect(restantes).not.toContain("pcd");
  });

  it("a ampla não tem percentual nem botão de remover", async () => {
    await abrirEditor(supabaseFalso(), [
      candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
    ]);
    const ampla = document.querySelector('[data-convocacao-categoria="ampla"]');
    expect(
      ampla.querySelector("[data-convocacao-remover-categoria]"),
    ).toBeNull();
    expect(ampla.textContent).toContain("recebe o resto");
  });

  /* Trocar a distribuição faz aparecer os campos de posição do edital da FCC. */
  it("mostra os campos de posição ao escolher posições publicadas", async () => {
    await abrirEditor(supabaseFalso(), [
      candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
    ]);
    expect(
      document.querySelector('[data-convocacao-cat="posicoes"]'),
    ).toBeNull();

    const distribuicao = document.querySelector(
      '[data-convocacao-modelo="distribuicao"]',
    );
    distribuicao.value = "posicao_fixa";
    distribuicao.dispatchEvent(new Event("change", { bubbles: true }));

    expect(
      document.querySelector('[data-convocacao-cat="posicoes"]'),
    ).not.toBeNull();
  });

  it("manda o modelo inteiro para a RPC ao salvar", async () => {
    const supabase = supabaseFalso();
    await abrirEditor(supabase, [
      candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
    ]);

    const taxa = document.querySelector(
      '[data-convocacao-categoria="indigena"] [data-convocacao-cat="percentual"]',
    );
    taxa.value = "7";
    taxa.dispatchEvent(new Event("input", { bubbles: true }));

    supabase.rpc.mockClear();
    document.getElementById("convocacaoSalvarModelo").click();
    await vi.waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        "salvar_modelo_convocacao",
        expect.anything(),
      ),
    );

    const enviado = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_modelo_convocacao",
    )[1].p_modelo;
    expect(enviado.id).toBe(MODELO_ID);
    expect(enviado.categorias.find((c) => c.id === "indigena").percentual).toBe(
      7,
    );
    // Os termos viajam como texto, que é como a coluna os guarda.
    expect(typeof enviado.categorias[0].termos).toBe("string");
  });

  it("recusa percentuais que somem mais de 100%", async () => {
    const avisos = [];
    const supabase = supabaseFalso();
    const controlador = createListaConvocacaoController({
      supabase,
      toast: (mensagem, tom) => avisos.push([mensagem, tom]),
      loader: () => {},
      getProfile: () => ({ perfil: "admin" }),
      getCandidates: () => [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      getLists: () => [],
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");
    document.getElementById("convocacaoEditarModelo").click();

    const taxa = document.querySelector(
      '[data-convocacao-categoria="pretos_pardos"] [data-convocacao-cat="percentual"]',
    );
    taxa.value = "95";
    taxa.dispatchEvent(new Event("input", { bubbles: true }));

    supabase.rpc.mockClear();
    document.getElementById("convocacaoSalvarModelo").click();

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(avisos.at(-1)[1]).toBe("warn");
    expect(avisos.at(-1)[0]).toContain("105%");
  });

  /*
    Duplicar é a saída de quem quer mudar só o seu edital sem mexer nos outros
    que partilham o modelo.
  */
  it("duplicar abre uma cópia sem id, para virar modelo novo", async () => {
    await abrirEditor(
      supabaseFalso({ modelo: linhaDoModelo({ editais: 6 }) }),
      [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
    );
    expect(document.querySelector(".convocacao-editor-aviso")).not.toBeNull();

    document.getElementById("convocacaoDuplicarModelo").click();
    expect(
      document.querySelector('[data-convocacao-modelo="nome"]').value,
    ).toContain("(cópia)");
    expect(document.getElementById("convocacaoDuplicarModelo")).toBeNull();
    expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();
  });
});

describe("quadro manual e clareza do editor", () => {
  beforeEach(() => {
    montarTela();
    montarFormulario();
  });

  const abrir = async (supabase) => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase,
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");
    return controlador;
  };

  /*
    O que parecia defeito na tela: a sobrescrita manual mostrava um campo só.
    Mostra um por categoria do modelo — eram cinco, e a tela estava sem modelo
    escolhido, quando só existe a ampla.
  */
  it("a sobrescrita manual dá um campo por categoria do modelo", async () => {
    await abrir(supabaseFalso({ padraoImediata: 10 }));
    const manual = document.querySelector("[data-convocacao-manual]");
    manual.checked = true;
    manual.dispatchEvent(new Event("change", { bubbles: true }));

    const campos = [
      ...document.querySelectorAll("[data-convocacao-vaga-cota]"),
    ].map((campo) => campo.dataset.convocacaoVagaCota);
    expect(campos).toEqual([
      "ampla",
      "pretos_pardos",
      "indigena",
      "quilombola",
      "pcd",
    ]);
  });

  /*
    O quadro de cada vaga é DERIVADO do modelo. Pedir números antes de haver
    regra mostraria um resultado que muda sozinho assim que o modelo aparece,
    então as vagas só entram em cena depois.
  */
  it("sem modelo, as vagas do edital não aparecem e a tela diz o que falta", async () => {
    await abrir(supabaseFalso({ comModelo: false, padraoImediata: 10 }));
    expect(
      document
        .getElementById("convocacaoVagasBloco")
        .classList.contains("hidden"),
    ).toBe(true);
    const aviso = document.getElementById("convocacaoVagasBloqueadas");
    expect(aviso.classList.contains("hidden")).toBe(false);
    expect(aviso.textContent).toContain("Escolha um modelo");
  });

  /* Uma tarefa de cada vez: enquanto se mexe no modelo, as vagas saem da frente. */
  it("com o editor aberto, as vagas saem da frente e voltam ao fechar", async () => {
    await abrir(supabaseFalso({ padraoImediata: 4 }));
    const bloco = () => document.getElementById("convocacaoVagasBloco");
    expect(bloco().classList.contains("hidden")).toBe(false);

    document.getElementById("convocacaoEditarModelo").click();
    expect(bloco().classList.contains("hidden")).toBe(true);
    expect(
      document.getElementById("convocacaoVagasBloqueadas").textContent,
    ).toContain("Termine o modelo");

    document.getElementById("convocacaoCancelarModelo").click();
    expect(bloco().classList.contains("hidden")).toBe(false);
  });

  /*
    Modelo que existe mas não tem reserva nenhuma: as vagas aparecem — o gestor
    declarou que elas existem —, mas a sobrescrita manual não, porque só haveria
    uma coluna e ela não distribui nada.
  */
  it("modelo só com ampla mostra as vagas, mas tranca a sobrescrita manual", async () => {
    const soAmpla = linhaDoModelo({
      categorias: [
        {
          id: "ampla",
          rotulo: "Ampla concorrência",
          sigla: "AC",
          ampla: true,
          termos: "ampla*",
          posicoes: "",
          cascata: "",
        },
      ],
    });
    await abrir(supabaseFalso({ modelo: soAmpla, padraoImediata: 10 }));
    expect(
      document
        .getElementById("convocacaoVagasBloco")
        .classList.contains("hidden"),
    ).toBe(false);
    const manual = document.querySelector("[data-convocacao-manual]");
    expect(manual.disabled).toBe(true);
    expect(manual.title).toContain("modelo de regras");
  });

  /* A ordem da cascata decide quem recebe a vaga; tem de estar visível. */
  it("numera a cascata na ordem em que será tentada", async () => {
    await abrir(supabaseFalso());
    document.getElementById("convocacaoEditarModelo").click();

    const quilombola = document.querySelector(
      '[data-convocacao-categoria="quilombola"]',
    );
    const marcadas = [
      ...quilombola.querySelectorAll(".convocacao-cascata-item.marcada"),
    ].map((item) => item.textContent.replace(/\s+/g, " ").trim());
    expect(marcadas).toEqual(["1º IND", "2º PP"]);
  });

  it("a numeração acompanha a ordem em que se marca", async () => {
    await abrir(supabaseFalso());
    document.getElementById("convocacaoEditarModelo").click();

    const pcd = () =>
      document.querySelector('[data-convocacao-categoria="pcd"]');
    const marcar = (sigla) => {
      const caixa = pcd().querySelector(`[data-convocacao-cascata="${sigla}"]`);
      caixa.checked = true;
      caixa.dispatchEvent(new Event("change", { bubbles: true }));
    };
    marcar("quilombola");
    marcar("indigena");

    const marcadas = [
      ...pcd().querySelectorAll(".convocacao-cascata-item.marcada"),
    ].map((item) => item.textContent.replace(/\s+/g, " ").trim());
    expect(marcadas).toEqual(["1º QUI", "2º IND"]);
  });

  /*
    As duas escolhas do modelo não se explicam pelo rótulo, e a ajuda num
    `title` ninguém descobre.
  */
  it("mostra a ajuda da opção escolhida, e troca com ela", async () => {
    await abrir(supabaseFalso());
    document.getElementById("convocacaoEditarModelo").click();

    const ajudas = () =>
      [...document.querySelectorAll(".convocacao-editor-ajuda")].map(
        (item) => item.textContent,
      );
    expect(ajudas().join(" ")).toContain("pretos e pardos (25%)");

    const campo = document.querySelector(
      '[data-convocacao-modelo="cotaMultipla"]',
    );
    campo.value = "acumula_com_acumulavel";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    expect(ajudas().join(" ")).toContain("guarda as DUAS reservas");
  });

  it("não pede mais o fundamento: o nome do modelo já identifica a regra", async () => {
    await abrir(supabaseFalso());
    document.getElementById("convocacaoEditarModelo").click();
    expect(
      document.querySelector('[data-convocacao-modelo="descricao"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-convocacao-modelo="nome"]'),
    ).not.toBeNull();
  });
});

describe("armadilha da cota acumulável", () => {
  beforeEach(() => {
    montarTela();
    montarFormulario();
  });

  /*
    Escolher "só quando uma delas for a cota acumulável" sem marcar nenhuma
    categoria faz a regra degradar em silêncio para "só a de maior percentual".
    O gestor ficaria a achar que configurou o 91/2026.
  */
  it("avisa quando a regra de acumulação não tem categoria marcada", async () => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase: supabaseFalso(),
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");
    document.getElementById("convocacaoEditarModelo").click();
    expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();

    const campo = document.querySelector(
      '[data-convocacao-modelo="cotaMultipla"]',
    );
    campo.value = "acumula_com_acumulavel";
    campo.dispatchEvent(new Event("change", { bubbles: true }));

    const aviso = document.querySelector(".convocacao-editor-aviso");
    expect(aviso).not.toBeNull();
    expect(aviso.textContent).toContain("acumulável");

    // Marcar a caixa de PCD resolve, e o aviso sai.
    const acumulavel = document.querySelector(
      '[data-convocacao-categoria="pcd"] [data-convocacao-cat="acumulavel"]',
    );
    acumulavel.checked = true;
    acumulavel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();
  });
});

describe("escolha da base de um modelo novo", () => {
  beforeEach(() => {
    montarTela();
    montarFormulario();
  });

  const criarNovo = async () => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase: supabaseFalso(),
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");
    document.getElementById("convocacaoNovoModelo").click();
    return controlador;
  };

  const siglas = () =>
    [...document.querySelectorAll("[data-convocacao-categoria]")].map(
      (ficha) => ficha.dataset.convocacaoCategoria,
    );

  /*
    São quatro formatos distintos entre os editais lidos. Reescrever qualquer um
    deles à mão convida ao erro, então a criação parte de um catálogo.
  */
  it("oferece os formatos de edital já lidos, mais o branco", async () => {
    await criarNovo();
    const bases = [...document.querySelectorAll("[data-convocacao-base]")].map(
      (botao) => botao.dataset.convocacaoBase,
    );
    expect(bases).toContain("lei-15142-2025");
    expect(bases).toContain("lei-15142-reserva-unica");
    expect(bases).toContain("etnico-racial-posicoes");
    expect(bases).toContain("");
  });

  it("troca as categorias ao trocar de base", async () => {
    await criarNovo();
    expect(siglas()).toContain("pretos_pardos");

    document
      .querySelector('[data-convocacao-base="lei-15142-reserva-unica"]')
      .click();
    expect(siglas()).toEqual(["ampla", "ppiq", "pcd"]);

    document.querySelector('[data-convocacao-base=""]').click();
    expect(siglas()).toEqual(["ampla"]);
  });

  /* O nome é do edital, não da regra: sobrevive à troca de base. */
  it("preserva o nome já digitado ao trocar de base", async () => {
    await criarNovo();
    const nome = document.querySelector('[data-convocacao-modelo="nome"]');
    nome.value = "Projeto Caminhoneiros — 96/2025";
    nome.dispatchEvent(new Event("input", { bubbles: true }));

    document
      .querySelector('[data-convocacao-base="etnico-racial-posicoes"]')
      .click();
    expect(
      document.querySelector('[data-convocacao-modelo="nome"]').value,
    ).toBe("Projeto Caminhoneiros — 96/2025");
  });

  /* Modelo já salvo não oferece base: trocá-la apagaria o que está configurado. */
  it("não oferece base ao editar um modelo existente", async () => {
    const controlador = criar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      supabase: supabaseFalso(),
    });
    await controlador.carregarConfiguracoes();
    controlador.abrirFormulario("7");
    document.getElementById("convocacaoEditarModelo").click();
    expect(document.querySelector("[data-convocacao-base]")).toBeNull();
  });
});
