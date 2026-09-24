import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarListaAprovados } from "../../src/componentes/lista-aprovados/lista-aprovados.jsx";
import { modeloDeReferencia } from "../../src/lib/modelo-de-convocacao.js";
import { clicar, digitar, escolher, esperar } from "./interacoes.js";

/*
  A costura entre as peças da lista de convocação: o modelo e a configuração
  como o banco os devolve, a derivação do quadro, o cálculo da ordem e o
  desenho em React — inclusive as permissões, que decidem se o botão de alterar
  status aparece e se o formulário do edital pode ser editado.
*/

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
  Fingimos as RPCs de leitura. `rpc` devolve por nome, e a promessa tem
  `range` porque os candidatos vêm paginados.
*/
const supabaseFalso = ({
  candidatos = [],
  modelo = linhaDoModelo(),
  padraoImediata = 0,
  vagas = [],
  proporcionalidade = true,
  comModelo = true,
} = {}) => {
  const responder = (nome) => {
    if (nome === "listar_listas_aprovados")
      return {
        data: [
          {
            lista_id: "L7",
            edital_id: "7",
            edital: "53/2025",
            unidade: "CASAI São Paulo",
            ativo: true,
          },
        ],
        error: null,
      };
    if (nome === "listar_candidatos_aprovados")
      return { data: candidatos, error: null };
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
  };
  const rpc = vi.fn((nome) => {
    const resposta = Promise.resolve(responder(nome));
    resposta.range = () => resposta;
    return resposta;
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

let controlador = null;
let perfilAtual = null;

async function montar({
  candidatos = [],
  perfil = { perfil: "contratador" },
  toast = () => {},
  ...banco
} = {}) {
  document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
  perfilAtual = perfil;
  const supabase = supabaseFalso({ candidatos, ...banco });
  await act(async () => {
    controlador = montarListaAprovados({
      secao: document.getElementById("page-approved"),
      supabase,
      toast,
      loader: () => {},
      getProfile: () => perfilAtual,
      confirmar: () => true,
    });
  });
  await esperar(() => controlador.render());
  return { supabase };
}

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

const $ = (id) => document.getElementById(id);
const abrirAbaDeConvocacao = () =>
  clicar(document.querySelector('[data-approved-tab="convocacao"]'));
const nomesNaTabela = () =>
  [...document.querySelectorAll("#convocacaoRows tr")]
    .map((linha) => linha.querySelector(".approved-name strong")?.textContent)
    .filter(Boolean);

async function abrirFormulario() {
  await esperar(() => controlador.openImportModal("7", "53/2025 · CASAI"));
  await clicar(document.querySelector('[data-import-tab="convocacao"]'));
}

describe("aba da lista de convocação", () => {
  it("desenha a ordem de convocação, e não a de classificação", async () => {
    await montar({
      candidatos: [
        candidato("JOÃO", '"Pretos e Pardos"'),
        candidato("MARIA", "Ampla Concorrência"),
        candidato("PEDRO", '"Pretos e Pardos"'),
      ],
      vagas: [vagaManual("VG-001", { ampla: 2, pretos_pardos: 1 })],
    });
    await abrirAbaDeConvocacao();
    expect(nomesNaTabela()).toEqual(["JOÃO", "PEDRO", "MARIA"]);
    expect($("convocacaoKpiImediatas").textContent).toBe("3");
  });

  /*
    O caminho real: percentual do modelo mais o total de vagas. 10 x 25% = 2,5
    sobe para 3; 10 x 5% = 0,5 sobe para 1; 3% e 2% descem para 0. Sobram 6.
  */
  it("deriva o quadro do percentual do modelo", async () => {
    await montar({
      candidatos: [candidato("MARIA", "Ampla Concorrência")],
      padraoImediata: 10,
    });
    const cabecalho = document.querySelector(".convocacao-grupo");
    expect(cabecalho.textContent).toContain("10 vagas imediatas");
    expect(cabecalho.textContent).toContain("AC 6 · PP 3 · PCD 1");
  });

  it("respeita o total próprio da vaga", async () => {
    await montar({
      candidatos: [
        candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("B", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
      ],
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
    });
    const cabecalhos = [...document.querySelectorAll(".convocacao-grupo")].map(
      (linha) => linha.textContent,
    );
    expect(cabecalhos[0]).toContain("5 vagas imediatas");
    expect(cabecalhos[1]).toContain("Sem vaga imediata");
  });

  it("mostra quem desistiu fora da numeração, sem gastar vaga", async () => {
    await montar({
      candidatos: [
        candidato("MARIA", "Ampla", { status: "Desistente" }),
        candidato("CARLOS", "Ampla"),
      ],
      vagas: [vagaManual("VG-001", { ampla: 1 })],
    });
    expect(nomesNaTabela()).toEqual(["CARLOS", "MARIA"]);
    expect(document.querySelector(".convocacao-vaga.fora")).not.toBeNull();
    expect($("convocacaoKpiForaDaFila").textContent).toBe("1");
  });

  /*
    Status é filtro de exibição e entra DEPOIS do cálculo: o desistente some da
    tabela, mas continua a não gastar vaga.
  */
  it("filtrar por status não muda a ordem de quem fica", async () => {
    await montar({
      candidatos: [
        candidato("MARIA", "Ampla", { status: "Desistente" }),
        candidato("CARLOS", "Ampla"),
      ],
      vagas: [vagaManual("VG-001", { ampla: 1 })],
    });
    await abrirAbaDeConvocacao();
    await clicar(
      [
        ...document.querySelectorAll(
          "#approvedPanelConvocacao .multi-select-option",
        ),
      ]
        .find((opcao) => opcao.textContent === "Sem status")
        .querySelector("input"),
    );
    expect(nomesNaTabela()).toEqual(["CARLOS"]);
    expect(document.querySelector("#convocacaoRows td.num").textContent).toBe(
      "1",
    );
  });

  /*
    O termo desconhecido é do MODELO, não do sistema: o aviso aparece para que
    o gestor saiba que basta acrescentar o termo àquela categoria.
  */
  it("avisa quando a modalidade declarada não foi reconhecida", async () => {
    await montar({
      candidatos: [candidato("LUA", "Pessoa Trans")],
      padraoImediata: 1,
    });
    expect(document.querySelector(".convocacao-alerta")).not.toBeNull();
  });

  it("mostra as duas reservas declaradas e destaca a que vale", async () => {
    await montar({
      candidatos: [candidato("ANA", '"pretos e pardos" e "quilombola"')],
      vagas: [vagaManual("VG-001", { ampla: 1 })],
    });
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
    await montar({
      candidatos: [candidato("MARIA", "Ampla", { lista_ativa: false })],
      vagas: [vagaManual("VG-001", { ampla: 1 })],
    });
    expect(
      document.querySelector(
        '#convocacaoRows [data-convocacao-action="status"]',
      ),
    ).toBeNull();
    expect(
      document.querySelector("#convocacaoRows button[disabled]"),
    ).not.toBeNull();
  });

  it("abre o mesmo modal de status da lista de aprovados", async () => {
    await montar({
      candidatos: [candidato("MARIA", "Ampla")],
      vagas: [vagaManual("VG-001", { ampla: 1 })],
    });
    await abrirAbaDeConvocacao();
    await clicar(
      document.querySelector(
        '#convocacaoRows [data-convocacao-action="status"]',
      ),
    );
    expect($("approvedStatusModal")).not.toBeNull();
    expect($("approvedStatusCandidate").textContent).toBe("MARIA · ENFERMEIRO");
  });

  /*
    Edital sem modelo não inventa reserva: as vagas que o gestor digitou
    continuam de pé, todas como ampla. Nem mesmo quem declarou cota recebe
    posição reservada, porque não há regra que a crie.
  */
  it("sem modelo, as vagas saem todas como ampla", async () => {
    await montar({
      candidatos: [candidato("MARIA", '"Pretos e Pardos"')],
      comModelo: false,
      padraoImediata: 10,
    });
    const cabecalho = document.querySelector(".convocacao-grupo").textContent;
    expect(cabecalho).toContain("10 vagas imediatas");
    expect(cabecalho).toContain("AC 10");
    expect(cabecalho).not.toContain("PP");
  });

  it("some com as ações da lista de aprovados ao trocar de aba", async () => {
    await montar();
    const acoes = () => $("approvedHeadActions").classList.contains("hidden");
    expect(acoes()).toBe(false);
    await abrirAbaDeConvocacao();
    expect(acoes()).toBe(true);
    expect($("approvedPanelAprovados").classList.contains("hidden")).toBe(true);
    await clicar(document.querySelector('[data-approved-tab="aprovados"]'));
    expect(acoes()).toBe(false);
  });
});

describe("formulário de convocação do edital", () => {
  it("lista as vagas que vieram da lista importada", async () => {
    await montar({
      candidatos: [
        candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("B", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("C", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
      ],
    });
    await abrirFormulario();
    expect(
      [...document.querySelectorAll("[data-convocacao-vaga]")].map(
        (linha) => linha.dataset.convocacaoVaga,
      ),
    ).toEqual(["VG-001", "VG-002"]);
    expect($("convocacaoVagasResumo").textContent).toBe("2 vagas");
  });

  it("mostra o quadro derivado ao lado do total de cada vaga", async () => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      padraoImediata: 10,
    });
    await abrirFormulario();
    expect(
      document.querySelector(".convocacao-quadro-derivado").textContent,
    ).toBe("AC 6 · PP 3 · PCD 1");
  });

  it("redesenha o quadro da vaga enquanto se digita o total", async () => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
    });
    await abrirFormulario();
    const campo = document.querySelector("[data-convocacao-imediatas]");
    await digitar(campo, "");
    // Apagar não repõe o "0": quem vai escrever "12" não fica com "012".
    expect(campo.value).toBe("");
    await digitar(campo, "10");
    expect(
      document.querySelector(".convocacao-quadro-derivado").textContent,
    ).toBe("AC 6 · PP 3 · PCD 1");
  });

  it("resume o modelo e avisa quando ele é partilhado", async () => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      modelo: linhaDoModelo({ editais: 6 }),
    });
    await abrirFormulario();
    const resumo = $("convocacaoModeloResumo");
    expect(resumo.textContent).toContain("PP 25%");
    expect(resumo.textContent).toContain("usado por 6 editais");
    expect(resumo.classList.contains("compartilhado")).toBe(true);
  });

  it("manda para a RPC o tipo, o modelo e as vagas", async () => {
    const { supabase } = await montar({
      candidatos: [
        candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("C", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
      ],
      padraoImediata: 4,
    });
    await abrirFormulario();

    supabase.rpc.mockClear();
    await clicar($("convocacaoSalvar"));

    const [nome, argumentos] = supabase.rpc.mock.calls[0];
    expect(nome).toBe("salvar_configuracao_convocacao");
    expect(argumentos.p_edital_id).toBe("7");
    expect(argumentos.p_modelo_id).toBe(MODELO_ID);
    expect(argumentos.p_padrao_imediata).toBe(4);
    expect(argumentos.p_vagas).toEqual([
      expect.objectContaining({ codigo_vaga: "VG-001", imediatas: 4 }),
      expect.objectContaining({ codigo_vaga: "VG-002", imediatas: 4 }),
    ]);
    // Salvar recarrega a página: a ordem de convocação depende destas vagas.
    expect(supabase.rpc).toHaveBeenCalledWith("listar_candidatos_aprovados");
  });

  it("aplica o total padrão a todas as vagas", async () => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
    });
    await abrirFormulario();
    await digitar($("convocacaoPadraoImediata"), "4");
    await clicar($("convocacaoAplicarPadrao"));
    expect(document.querySelector("[data-convocacao-imediatas]").value).toBe(
      "4",
    );
  });

  /*
    Ligar a sobrescrita copia o quadro derivado para os campos: começar do zero
    faria a vaga perder, sem aviso, as vagas que o percentual já lhe dava.
  */
  it("ao ligar a sobrescrita manual, parte do quadro derivado", async () => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      padraoImediata: 4,
    });
    await abrirFormulario();
    await clicar(document.querySelector("[data-convocacao-manual]"));
    const campos = Object.fromEntries(
      [...document.querySelectorAll("[data-convocacao-vaga-cota]")].map(
        (campo) => [campo.dataset.convocacaoVagaCota, campo.value],
      ),
    );
    expect(campos).toMatchObject({ ampla: "3", pretos_pardos: "1" });
  });

  it("tranca o formulário quando o perfil perde a permissão", async () => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
    });
    await abrirFormulario();
    perfilAtual = { perfil: "usuario" };
    await esperar(() => controlador.render());

    expect($("convocacaoSalvar")).toBeNull();
    expect(
      document.querySelector("[data-convocacao-vaga] input").disabled,
    ).toBe(true);
    expect($("convocacaoPermissionNote").textContent).toContain(
      "Sem permissão",
    );
  });
});

describe("editor do modelo de regras", () => {
  const abrirEditor = async (opcoes = {}) => {
    const montado = await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      ...opcoes,
    });
    await abrirFormulario();
    await clicar($("convocacaoEditarModelo"));
    return montado;
  };
  const fichas = () =>
    [...document.querySelectorAll("[data-convocacao-categoria]")].map(
      (ficha) => ficha.dataset.convocacaoCategoria,
    );

  it("desenha uma ficha por categoria do modelo", async () => {
    await abrirEditor();
    expect(fichas()).toEqual([
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
    await abrirEditor();
    await clicar($("convocacaoAdicionarCategoria"));
    expect(fichas()).toHaveLength(6);

    await clicar(
      document.querySelector(
        '[data-convocacao-categoria="pcd"] [data-convocacao-remover-categoria]',
      ),
    );
    expect(fichas()).not.toContain("pcd");
  });

  it("a ampla não tem percentual nem botão de remover", async () => {
    await abrirEditor();
    const ampla = document.querySelector('[data-convocacao-categoria="ampla"]');
    expect(
      ampla.querySelector("[data-convocacao-remover-categoria]"),
    ).toBeNull();
    expect(ampla.textContent).toContain("recebe o resto");
  });

  /* Trocar a distribuição faz aparecer os campos de posição do edital da FCC. */
  it("mostra os campos de posição ao escolher posições publicadas", async () => {
    await abrirEditor();
    expect(
      document.querySelector('[data-convocacao-cat="posicoes"]'),
    ).toBeNull();
    await escolher(
      document.querySelector('[data-convocacao-modelo="distribuicao"]'),
      "posicao_fixa",
    );
    expect(
      document.querySelector('[data-convocacao-cat="posicoes"]'),
    ).not.toBeNull();
  });

  it("manda o modelo inteiro para a RPC ao salvar", async () => {
    const { supabase } = await abrirEditor();
    await digitar(
      document.querySelector(
        '[data-convocacao-categoria="indigena"] [data-convocacao-cat="percentual"]',
      ),
      "7",
    );
    await digitar(
      document.querySelector(
        '[data-convocacao-categoria="indigena"] [data-convocacao-cat="termos"]',
      ),
      "indigena*; aldeado",
    );

    supabase.rpc.mockClear();
    await clicar($("convocacaoSalvarModelo"));

    const enviado = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_modelo_convocacao",
    )[1].p_modelo;
    expect(enviado.id).toBe(MODELO_ID);
    const indigena = enviado.categorias.find((c) => c.id === "indigena");
    expect(indigena.percentual).toBe(7);
    // Os termos viajam como texto, que é como a coluna os guarda.
    expect(indigena.termos).toBe("indigena*; aldeado");
    // Salvo, o editor fecha e as vagas voltam.
    expect(document.querySelector("[data-convocacao-categoria]")).toBeNull();
    expect($("convocacaoVagasBloco").classList.contains("hidden")).toBe(false);
  });

  it("recusa percentuais que somem mais de 100%", async () => {
    const avisos = [];
    const { supabase } = await abrirEditor({
      perfil: { perfil: "admin" },
      toast: (mensagem, tom) => avisos.push([mensagem, tom]),
    });
    await digitar(
      document.querySelector(
        '[data-convocacao-categoria="pretos_pardos"] [data-convocacao-cat="percentual"]',
      ),
      "95",
    );

    supabase.rpc.mockClear();
    await clicar($("convocacaoSalvarModelo"));

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(avisos.at(-1)[1]).toBe("warn");
    expect(avisos.at(-1)[0]).toContain("105%");
  });

  /*
    Duplicar é a saída de quem quer mudar só o seu edital sem mexer nos outros
    que partilham o modelo.
  */
  it("duplicar abre uma cópia sem id, para virar modelo novo", async () => {
    await abrirEditor({ modelo: linhaDoModelo({ editais: 6 }) });
    expect(document.querySelector(".convocacao-editor-aviso")).not.toBeNull();

    await clicar($("convocacaoDuplicarModelo"));
    expect(
      document.querySelector('[data-convocacao-modelo="nome"]').value,
    ).toContain("(cópia)");
    expect($("convocacaoDuplicarModelo")).toBeNull();
    expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();
  });

  it("remover pede confirmação, e o edital fica sem modelo", async () => {
    const { supabase } = await abrirEditor();
    supabase.rpc.mockClear();
    await clicar($("convocacaoRemoverModelo"));
    expect(supabase.rpc).toHaveBeenCalledWith("remover_modelo_convocacao", {
      p_modelo_id: MODELO_ID,
    });
    expect($("convocacaoModelo").value).toBe("");
  });
});

describe("quadro manual e clareza do editor", () => {
  const abrir = async (opcoes = {}) => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      ...opcoes,
    });
    await abrirFormulario();
  };

  /*
    A sobrescrita manual mostra um campo por categoria do modelo — eram cinco,
    e a tela estava sem modelo escolhido, quando só existe a ampla.
  */
  it("a sobrescrita manual dá um campo por categoria do modelo", async () => {
    await abrir({ padraoImediata: 10 });
    await clicar(document.querySelector("[data-convocacao-manual]"));
    expect(
      [...document.querySelectorAll("[data-convocacao-vaga-cota]")].map(
        (campo) => campo.dataset.convocacaoVagaCota,
      ),
    ).toEqual(["ampla", "pretos_pardos", "indigena", "quilombola", "pcd"]);
  });

  /*
    O quadro de cada vaga é DERIVADO do modelo. Pedir números antes de haver
    regra mostraria um resultado que muda sozinho assim que o modelo aparece,
    então as vagas só entram em cena depois.
  */
  it("sem modelo, as vagas do edital não aparecem e a tela diz o que falta", async () => {
    await abrir({ comModelo: false, padraoImediata: 10 });
    expect($("convocacaoVagasBloco").classList.contains("hidden")).toBe(true);
    const aviso = $("convocacaoVagasBloqueadas");
    expect(aviso.classList.contains("hidden")).toBe(false);
    expect(aviso.textContent).toContain("Escolha um modelo");
  });

  it("escolher um modelo traz as vagas de volta", async () => {
    await abrir({ comModelo: false, padraoImediata: 10 });
    await escolher($("convocacaoModelo"), MODELO_ID);
    expect($("convocacaoVagasBloco").classList.contains("hidden")).toBe(false);
  });

  /* Uma tarefa de cada vez: enquanto se mexe no modelo, as vagas saem da frente. */
  it("com o editor aberto, as vagas saem da frente e voltam ao fechar", async () => {
    await abrir({ padraoImediata: 4 });
    const escondido = () =>
      $("convocacaoVagasBloco").classList.contains("hidden");
    expect(escondido()).toBe(false);

    await clicar($("convocacaoEditarModelo"));
    expect(escondido()).toBe(true);
    expect($("convocacaoVagasBloqueadas").textContent).toContain(
      "Termine o modelo",
    );

    await clicar($("convocacaoCancelarModelo"));
    expect(escondido()).toBe(false);
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
    await abrir({ modelo: soAmpla, padraoImediata: 10 });
    expect($("convocacaoVagasBloco").classList.contains("hidden")).toBe(false);
    const manual = document.querySelector("[data-convocacao-manual]");
    expect(manual.disabled).toBe(true);
    expect(manual.title).toContain("modelo de regras");
  });

  /* A ordem da cascata decide quem recebe a vaga; tem de estar visível. */
  it("numera a cascata na ordem em que será tentada", async () => {
    await abrir();
    await clicar($("convocacaoEditarModelo"));
    const quilombola = document.querySelector(
      '[data-convocacao-categoria="quilombola"]',
    );
    const marcadas = [
      ...quilombola.querySelectorAll(".convocacao-cascata-item.marcada"),
    ].map((item) => item.textContent.replace(/\s+/g, " ").trim());
    expect(marcadas).toEqual(["1º IND", "2º PP"]);
  });

  it("a numeração acompanha a ordem em que se marca", async () => {
    await abrir();
    await clicar($("convocacaoEditarModelo"));
    const pcd = () =>
      document.querySelector('[data-convocacao-categoria="pcd"]');
    await clicar(pcd().querySelector('[data-convocacao-cascata="quilombola"]'));
    await clicar(pcd().querySelector('[data-convocacao-cascata="indigena"]'));
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
    await abrir();
    await clicar($("convocacaoEditarModelo"));
    const ajudas = () =>
      [...document.querySelectorAll(".convocacao-editor-ajuda")]
        .map((item) => item.textContent)
        .join(" ");
    expect(ajudas()).toContain("pretos e pardos (25%)");
    await escolher(
      document.querySelector('[data-convocacao-modelo="cotaMultipla"]'),
      "acumula_com_acumulavel",
    );
    expect(ajudas()).toContain("guarda as DUAS reservas");
  });

  it("não pede mais o fundamento: o nome do modelo já identifica a regra", async () => {
    await abrir();
    await clicar($("convocacaoEditarModelo"));
    expect(
      document.querySelector('[data-convocacao-modelo="descricao"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-convocacao-modelo="nome"]'),
    ).not.toBeNull();
  });
});

describe("armadilha da cota acumulável", () => {
  /*
    Escolher "só quando uma delas for a cota acumulável" sem marcar nenhuma
    categoria faz a regra degradar em silêncio para "só a de maior percentual".
    O gestor ficaria a achar que configurou o 91/2026.
  */
  it("avisa quando a regra de acumulação não tem categoria marcada", async () => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
    });
    await abrirFormulario();
    await clicar($("convocacaoEditarModelo"));
    expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();

    await escolher(
      document.querySelector('[data-convocacao-modelo="cotaMultipla"]'),
      "acumula_com_acumulavel",
    );
    const aviso = document.querySelector(".convocacao-editor-aviso");
    expect(aviso).not.toBeNull();
    expect(aviso.textContent).toContain("acumulável");

    // Marcar a caixa de PCD resolve, e o aviso sai.
    await clicar(
      document.querySelector(
        '[data-convocacao-categoria="pcd"] [data-convocacao-cat="acumulavel"]',
      ),
    );
    expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();
  });
});

describe("escolha da base de um modelo novo", () => {
  beforeEach(async () => {
    await montar({
      candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
    });
    await abrirFormulario();
  });

  const siglas = () =>
    [...document.querySelectorAll("[data-convocacao-categoria]")].map(
      (ficha) => ficha.dataset.convocacaoCategoria,
    );

  /*
    São quatro formatos distintos entre os editais lidos. Reescrever qualquer um
    deles à mão convida ao erro, então a criação parte de um catálogo.
  */
  it("oferece os formatos de edital já lidos, mais o branco", async () => {
    await clicar($("convocacaoNovoModelo"));
    const bases = [...document.querySelectorAll("[data-convocacao-base]")].map(
      (botao) => botao.dataset.convocacaoBase,
    );
    expect(bases).toContain("lei-15142-2025");
    expect(bases).toContain("lei-15142-reserva-unica");
    expect(bases).toContain("etnico-racial-posicoes");
    expect(bases).toContain("");
  });

  it("troca as categorias ao trocar de base", async () => {
    await clicar($("convocacaoNovoModelo"));
    expect(siglas()).toContain("pretos_pardos");
    await clicar(
      document.querySelector(
        '[data-convocacao-base="lei-15142-reserva-unica"]',
      ),
    );
    expect(siglas()).toEqual(["ampla", "ppiq", "pcd"]);
    await clicar(document.querySelector('[data-convocacao-base=""]'));
    expect(siglas()).toEqual(["ampla"]);
  });

  /* O nome é do edital, não da regra: sobrevive à troca de base. */
  it("preserva o nome já digitado ao trocar de base", async () => {
    await clicar($("convocacaoNovoModelo"));
    await digitar(
      document.querySelector('[data-convocacao-modelo="nome"]'),
      "Projeto Caminhoneiros — 96/2025",
    );
    await clicar(
      document.querySelector('[data-convocacao-base="etnico-racial-posicoes"]'),
    );
    expect(
      document.querySelector('[data-convocacao-modelo="nome"]').value,
    ).toBe("Projeto Caminhoneiros — 96/2025");
  });

  /* Modelo já salvo não oferece base: trocá-la apagaria o que está configurado. */
  it("não oferece base ao editar um modelo existente", async () => {
    await clicar($("convocacaoEditarModelo"));
    expect(document.querySelector("[data-convocacao-base]")).toBeNull();
  });
});
