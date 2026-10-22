import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  AREAS_DA_SOLICITACAO,
  CAMPOS_VAZIOS,
  CARGOS_DA_SOLICITACAO,
  MOTIVOS_DE_RECUSA,
  SITUACOES,
  TEXTO_DESATIVADA,
  TITULO_DESATIVADA,
  argumentosDaSolicitacao,
  camposDoPedido,
  camposNaArea,
  cargosDaArea,
  diaEMes,
  erroDaJustificativa,
  grupoSugeridoDoPedido,
  resumoDoPedido,
  situacaoDaSolicitacao,
  telaDaSolicitacao,
  validarRecusa,
  validarSolicitacao,
} from "../src/lib/solicitacao-de-acesso.ts";
import {
  AVISO_CANCELADO,
  AVISO_SEM_CONSULTA,
  TITULO_VERIFICANDO,
  criarPedidoDeAcesso,
  visaoDoPedido,
} from "../src/app/entrada/pedido-de-acesso.ts";
import { PaginaDaSolicitacao } from "../src/app/entrada/solicitacao-de-acesso.tsx";
import { lembrarContaDesativada } from "../src/lib/acesso-liberado.js";
import { clicar, digitar, escolher } from "./componentes/interacoes.js";

/*
  Solicitação de acesso por área (20261021140000): abas Projetos · Saúde
  Indígena · SEDE com os campos da área, justificativa com texto mínimo,
  pedido enviado com Editar e Cancelar, recusa com motivo e conta desativada
  com "Pedir reativação". O acesso continua só por aprovação.
*/

const JUSTIFICATIVA = "Vou avaliar as fichas da análise curricular do DSEI.";

const PENDENTE = {
  id: "s1",
  status: "pendente",
  created_at: "2026-10-20T13:00:00Z",
  nome: "Ana Souza",
  area: "saude-indigena",
  area_nome: "Saúde Indígena",
  cargo: "AVALIADOR",
  cargo_rotulo: "Avaliador(a) da análise curricular",
  setor: "DSEI Yanomami",
  justificativa: JUSTIFICATIVA,
};

const RECUSADO = {
  ...PENDENTE,
  status: "recusado",
  avaliado_em: "2026-10-21T12:00:00Z",
  motivo_recusa: "AREA_OU_LOTACAO",
  observacao_admin: "Área ou lotação não confere — o DSEI é outro",
};

const OPCOES = {
  areas: [],
  unidades: [
    { area: "saude-indigena", nome: "CASAI São Paulo", tipo: "CASAI" },
    { area: "saude-indigena", nome: "DSEI Yanomami", tipo: "DSEI" },
    { area: "saude-indigena", nome: "DSEI Altamira", tipo: "DSEI" },
    { area: "projetos", nome: "Saúde nas Fronteiras", tipo: null },
    { area: "projetos", nome: "MFC", tipo: null },
  ],
  coordenacoes: [{ codigo: "norte", nome: "Norte", area: "saude-indigena" }],
};

describe("listas fixas", () => {
  it("as abas são Projetos · Saúde Indígena · SEDE, com a lotação de cada uma", () => {
    expect(AREAS_DA_SOLICITACAO.map((a) => [a.rotulo, a.lotacao])).toEqual([
      ["Projetos", "lista"],
      ["Saúde Indígena", "lista"],
      ["SEDE", "texto"],
    ]);
  });

  it("cada área tem a própria lista de cargos, sempre com 'Outro'", () => {
    const codigos = (area) => cargosDaArea(area).map((c) => c.codigo);
    expect(codigos("saude-indigena")).toContain("COORDENACAO_DSEI");
    expect(codigos("saude-indigena")).not.toContain("JURIDICO");
    expect(codigos("projetos")).toContain("COORDENACAO_PROJETO");
    expect(codigos("sede")).toEqual(
      expect.arrayContaining(["JURIDICO", "COORDENACAO_SEDE"]),
    );
    for (const area of ["projetos", "saude-indigena", "sede"])
      expect(codigos(area).at(-1)).toBe("OUTRO");
  });

  it("o cargo sugere o grupo, se quem aprova pode atribuí-lo", () => {
    const todos = ["usuario", "avaliador", "edital_gestor", "coordenador"].map(
      (codigo) => ({ codigo }),
    );
    expect(grupoSugeridoDoPedido({ cargo: "AVALIADOR" }, todos)).toBe(
      "avaliador",
    );
    expect(grupoSugeridoDoPedido({ cargo: "COORDENACAO_DSEI" }, todos)).toBe(
      "coordenador",
    );
    // Coordenador com teto baixo: o grupo sugerido não está entre os possíveis.
    expect(
      grupoSugeridoDoPedido({ cargo: "COORDENACAO_DSEI" }, [
        { codigo: "usuario" },
        { codigo: "avaliador" },
      ]),
    ).toBe("usuario");
    expect(
      grupoSugeridoDoPedido(
        { cargo: "AVALIADOR", reativacao: true, grupo_anterior: "coordenador" },
        todos,
      ),
    ).toBe("coordenador");
    expect(grupoSugeridoDoPedido({}, [{ codigo: "avaliador" }])).toBe(
      "avaliador",
    );
  });

  it("cada cargo aponta para um grupo de TB_GRUPO_ACESSO", () => {
    const grupos = [
      "usuario",
      "avaliador",
      "edital_gestor",
      "contratador",
      "juridico",
      "coordenador",
    ];
    for (const c of CARGOS_DA_SOLICITACAO) expect(grupos).toContain(c.grupo);
  });
});

describe("situação do pedido", () => {
  it("sem pedido (ou cancelado): formulário", () => {
    expect(situacaoDaSolicitacao({})).toBe(SITUACOES.SEM_PEDIDO);
    expect(
      situacaoDaSolicitacao({ solicitacao: { status: "cancelado" } }),
    ).toBe(SITUACOES.SEM_PEDIDO);
    expect(telaDaSolicitacao({})).toMatchObject({
      conteudo: "formulario",
      texto: "",
    });
  });

  it("pendente: 'Pedido enviado — aguardando aprovação', resumo", () => {
    const tela = telaDaSolicitacao({ solicitacao: PENDENTE });
    expect(tela).toMatchObject({
      situacao: SITUACOES.PENDENTE,
      titulo: "Pedido enviado — aguardando aprovação",
      conteudo: "resumo",
    });
    expect(tela.texto).toContain("Enviado em 20/10");
  });

  it("recusado: mostra o motivo e volta ao formulário", () => {
    const tela = telaDaSolicitacao({ solicitacao: RECUSADO });
    expect(tela.titulo).toBe("Pedido recusado em 21/10");
    expect(tela.texto).toBe(
      "Motivo: Área ou lotação não confere — o DSEI é outro. Você pode corrigir e enviar um novo pedido.",
    );
    expect(tela.conteudo).toBe("formulario");
  });

  it("conta desativada vence qualquer pedido; pendente é a reativação", () => {
    for (const status of ["aprovado", "recusado", null])
      expect(
        telaDaSolicitacao({
          solicitacao: status ? { status } : null,
          contaDesativada: true,
        }),
      ).toMatchObject({
        titulo: TITULO_DESATIVADA,
        texto: TEXTO_DESATIVADA,
        conteudo: "oculto",
        oferecerReativacao: true,
      });
    expect(
      telaDaSolicitacao({ solicitacao: PENDENTE, contaDesativada: true }),
    ).toMatchObject({
      situacao: SITUACOES.REATIVACAO_PENDENTE,
      conteudo: "resumo",
      reativacao: true,
    });
  });

  it("aprovado: com perfil ativo é 'Entrar agora'; sem, acesso tirado depois", () => {
    expect(
      telaDaSolicitacao({
        solicitacao: { status: "aprovado" },
        perfilAtivo: true,
      }),
    ).toMatchObject({ situacao: SITUACOES.LIBERADO, entrar: true });
    expect(situacaoDaSolicitacao({ solicitacao: { status: "aprovado" } })).toBe(
      SITUACOES.DESATIVADA,
    );
  });

  it("dia e mês no fuso de Brasília", () => {
    expect(diaEMes("2026-10-01T02:00:00Z")).toBe("30/09");
    expect(diaEMes("x")).toBe("");
  });

  it("o resumo diz o que foi pedido, com o rótulo da lotação da área", () => {
    expect(resumoDoPedido(PENDENTE)).toEqual([
      { rotulo: "Nome", valor: "Ana Souza" },
      { rotulo: "Área", valor: "Saúde Indígena" },
      {
        rotulo: "Cargo ou função",
        valor: "Avaliador(a) da análise curricular",
      },
      { rotulo: "DSEI ou CASAI", valor: "DSEI Yanomami" },
      { rotulo: "Justificativa", valor: JUSTIFICATIVA },
    ]);
    expect(
      resumoDoPedido({ ...PENDENTE, cargo: "OUTRO", cargo_outro: "Apoio" })[2],
    ).toEqual({ rotulo: "Cargo ou função", valor: "Outro: Apoio" });
  });
});

describe("campos e validação", () => {
  const valido = {
    ...CAMPOS_VAZIOS,
    area: "saude-indigena",
    nome: "Ana Souza",
    cargo: "AVALIADOR",
    lotacao: "DSEI Yanomami",
    justificativa: JUSTIFICATIVA,
  };

  it("válido não tem erro", () => {
    expect(validarSolicitacao(valido)).toEqual({});
  });

  it("justificativa: obrigatória, 20 caracteres e 3 palavras de verdade", () => {
    expect(erroDaJustificativa("")).toBe("Explique por que precisa do acesso.");
    expect(erroDaJustificativa("Preciso ver")).toBe(
      "Escreva ao menos 20 caracteres (faltam 9).",
    );
    expect(erroDaJustificativa("dsdfsdfsfsa dvdddddddd TESTE FDFDF")).toMatch(
      /pelo menos 3 palavras/,
    );
    expect(erroDaJustificativa("aaaaaaaaaaaaaaaaaaaaaaaa")).not.toBe("");
    expect(erroDaJustificativa(JUSTIFICATIVA)).toBe("");
  });

  it("cada campo da área diz o que falta", () => {
    expect(
      validarSolicitacao({ ...CAMPOS_VAZIOS, area: "saude-indigena" }),
    ).toEqual({
      nome: "Informe seu nome completo.",
      justificativa: "Explique por que precisa do acesso.",
      cargo: "Escolha o cargo ou a função.",
      lotacao: "Escolha o DSEI ou a CASAI.",
    });
    expect(
      validarSolicitacao({ ...valido, area: "projetos", lotacao: "" }).lotacao,
    ).toBe("Escolha o projeto.");
    expect(
      validarSolicitacao({
        ...valido,
        area: "sede",
        cargo: "JURIDICO",
        lotacao: "",
      }).lotacao,
    ).toBe("Informe o setor ou a diretoria.");
  });

  it("cargo de outra área não vale; 'Outro' pede a descrição", () => {
    expect(validarSolicitacao({ ...valido, cargo: "JURIDICO" }).cargo).toBe(
      "Escolha o cargo ou a função.",
    );
    expect(
      validarSolicitacao({ ...valido, cargo: "OUTRO", cargoOutro: "x" })
        .cargoOutro,
    ).toMatch(/Descreva o cargo/);
    expect(
      validarSolicitacao({ ...valido, cargo: "OUTRO", cargoOutro: "Apoio" }),
    ).toEqual({});
  });

  it("lotação fora da lista carregada não vale", () => {
    expect(
      validarSolicitacao(valido, { lotacoes: ["DSEI Altamira"] }).lotacao,
    ).toBe("Escolha uma opção da lista.");
  });

  it("reativação: só nome e justificativa", () => {
    expect(
      validarSolicitacao(
        { nome: "Ana", justificativa: JUSTIFICATIVA },
        { reativacao: true },
      ),
    ).toEqual({});
    expect(
      argumentosDaSolicitacao(
        { ...valido, coordenacao: "norte" },
        { reativacao: true },
      ),
    ).toEqual({
      p_nome: "Ana Souza",
      p_area: null,
      p_cargo: null,
      p_cargo_outro: null,
      p_lotacao: null,
      p_justificativa: JUSTIFICATIVA,
      p_coordenacao: "norte",
    });
  });

  it("argumentos do pedido por área", () => {
    expect(
      argumentosDaSolicitacao({
        ...valido,
        cargo: "OUTRO",
        cargoOutro: "  Apoio técnico ",
      }),
    ).toEqual({
      p_nome: "Ana Souza",
      p_area: "saude-indigena",
      p_cargo: "OUTRO",
      p_cargo_outro: "Apoio técnico",
      p_lotacao: "DSEI Yanomami",
      p_justificativa: JUSTIFICATIVA,
      p_coordenacao: null,
    });
    expect(argumentosDaSolicitacao(valido).p_cargo_outro).toBeNull();
  });

  it("trocar de aba tira o que não vale na área nova", () => {
    const comCoordenacao = { ...valido, coordenacao: "norte" };
    expect(camposNaArea(comCoordenacao, "projetos")).toMatchObject({
      area: "projetos",
      cargo: "AVALIADOR",
      lotacao: "",
      coordenacao: "",
      nome: "Ana Souza",
      justificativa: JUSTIFICATIVA,
    });
    expect(
      camposNaArea({ ...valido, cargo: "COORDENACAO_DSEI" }, "sede").cargo,
    ).toBe("");
  });

  it("campos do pedido gravado (pedido antigo sem área: aba padrão, sem lotação)", () => {
    expect(camposDoPedido(PENDENTE)).toMatchObject({
      area: "saude-indigena",
      cargo: "AVALIADOR",
      lotacao: "DSEI Yanomami",
    });
    expect(
      camposDoPedido({ nome: "", setor: "COGIP" }, "Nome do Google"),
    ).toMatchObject({ nome: "Nome do Google", lotacao: "", cargo: "" });
  });
});

describe("recusa com motivo da lista", () => {
  it("a lista termina em 'Outro'", () => {
    expect(MOTIVOS_DE_RECUSA.at(-1)).toEqual({
      codigo: "OUTRO",
      rotulo: "Outro",
    });
  });

  it("motivo obrigatório; 'Outro' pede descrição com 3 palavras", () => {
    expect(validarRecusa({ motivo: "" })).toMatchObject({
      ok: false,
      campo: "motivo",
    });
    expect(
      validarRecusa({ motivo: "OUTRO", complemento: "curto" }),
    ).toMatchObject({ ok: false, campo: "complemento" });
    expect(
      validarRecusa({
        motivo: "OUTRO",
        complemento: "O e-mail não é da equipe do DSEI",
      }),
    ).toEqual({
      ok: true,
      argumentos: {
        p_motivo: "OUTRO",
        p_complemento: "O e-mail não é da equipe do DSEI",
      },
      texto: "O e-mail não é da equipe do DSEI",
    });
  });

  it("motivo da lista com complemento: o texto que a pessoa vê", () => {
    expect(
      validarRecusa({
        motivo: "AREA_OU_LOTACAO",
        complemento: "  o DSEI é outro ",
      }),
    ).toEqual({
      ok: true,
      argumentos: {
        p_motivo: "AREA_OU_LOTACAO",
        p_complemento: "o DSEI é outro",
      },
      texto: "Área ou lotação não confere — o DSEI é outro",
    });
    expect(
      validarRecusa({ motivo: "JA_TEM_ACESSO", complemento: "dddddddd" }),
    ).toMatchObject({ ok: false, campo: "complemento" });
  });
});

// ── A página (src/app/entrada/) ─────────────────────────────────────────────

/** RPCs da página; `pedidos` responde obter_minha_solicitacao_acesso em fila. */
function supabaseDaTela({
  pedidos = [null],
  desativadaNoBanco = false,
  contexto = null,
  opcoes = OPCOES,
  falhaNasOpcoes = false,
  erroNoEnvio = null,
  redeCaiNoEnvio = false,
} = {}) {
  const fila = [...pedidos];
  return {
    rpc: vi.fn(async (nome) => {
      if (nome === "minha_conta_desativada")
        return { data: desativadaNoBanco, error: null };
      if (nome === "obter_minha_solicitacao_acesso")
        return { data: fila.length > 1 ? fila.shift() : fila[0], error: null };
      if (nome === "listar_opcoes_da_solicitacao_acesso")
        return falhaNasOpcoes
          ? { data: null, error: { message: "falhou" } }
          : { data: opcoes, error: null };
      if (nome === "obter_contexto_monitora")
        return { data: contexto, error: null };
      if (nome === "registrar_solicitacao_acesso" && redeCaiNoEnvio)
        throw new TypeError("Failed to fetch");
      if (nome === "registrar_solicitacao_acesso")
        return erroNoEnvio
          ? { data: null, error: erroNoEnvio }
          : { data: { ok: true, status: "pendente" }, error: null };
      if (nome === "cancelar_minha_solicitacao_acesso")
        return { data: { ok: true, status: "cancelado" }, error: null };
      return { data: null, error: null };
    }),
  };
}

const USUARIO = (id) => ({
  id,
  email: `${id}@agenciasus.org.br`,
  user_metadata: { full_name: "Ana Souza" },
});

let raiz = null;
const sessaoFalsa = { entrarComGoogle: vi.fn(), limparSessao: vi.fn() };

async function desenhar(
  sb,
  { usuario = USUARIO("u1"), consultar = true } = {},
) {
  const pedido = criarPedidoDeAcesso({ cliente: () => sb, janela: window });
  document.body.innerHTML = `<div id="raiz"></div>`;
  raiz = createRoot(document.getElementById("raiz"));
  await act(async () => {
    raiz.render(
      createElement(PaginaDaSolicitacao, {
        pedido,
        sessao: sessaoFalsa,
        logoUrl: "/assets/agsus-logo.webp",
        slogan: "Monitoramento de Processos Seletivos",
        instituicao: "Agência Brasileira de Apoio à Gestão do SUS",
      }),
    );
  });
  await act(async () => {
    await pedido.carregar({ usuario, consultar });
  });
  return pedido;
}

const $ = (id) => document.getElementById(id);
const aba = (rotulo) =>
  [...document.querySelectorAll('[role="tab"]')].find(
    (b) => b.textContent === rotulo,
  );
const chamadas = (sb, nome) => sb.rpc.mock.calls.filter(([n]) => n === nome);
const opcoesDe = (id) => [...$(id).options].map((o) => o.textContent);

beforeEach(() => localStorage.clear());
afterEach(async () => {
  if (raiz) await act(async () => raiz.unmount());
  raiz = null;
  document.body.innerHTML = "";
  localStorage.clear();
  sessionStorage.clear();
});

describe("página: abas e campos por área", () => {
  it("duas colunas (marca com a Aya e o pedido), nome do Google e e-mail só leitura", async () => {
    await desenhar(supabaseDaTela());
    expect(document.querySelector(".solicitacao-marca")).not.toBeNull();
    expect(document.querySelector(".solicitacao-aya-fala").textContent).toMatch(
      /Escolha a aba de onde você trabalha/,
    );
    expect($("accessRequestTitulo").textContent).toBe("Solicitação de acesso");
    expect($("solicitacaoOnde").textContent).toBe("Onde você trabalha?");
    expect(document.querySelector(".solicitacao-onde").textContent).toContain(
      "Vai avaliar outra área? Diga na justificativa",
    );
    expect($("accessReqNome").value).toBe("Ana Souza");
    expect($("accessReqEmailCampo").readOnly).toBe(true);
    expect($("accessReqEmailCampo").value).toBe("u1@agenciasus.org.br");
    expect(
      [...document.querySelectorAll('[role="tab"]')].map((b) => b.textContent),
    ).toEqual(["Projetos", "Saúde Indígena", "SEDE"]);
    expect(aba("Saúde Indígena").getAttribute("aria-selected")).toBe("true");
  });

  it("Saúde Indígena: DSEI antes de CASAI, cargos da área e coordenação", async () => {
    await desenhar(supabaseDaTela());
    const grupos = [...$("accessReqLotacao").querySelectorAll("optgroup")].map(
      (g) => g.label,
    );
    expect(grupos).toEqual(["DSEI", "CASAI"]);
    expect(opcoesDe("accessReqLotacao")).toEqual([
      "Escolha",
      "DSEI Altamira",
      "DSEI Yanomami",
      "CASAI São Paulo",
    ]);
    expect(opcoesDe("accessReqCargo")).toContain(
      "Coordenação de DSEI ou CASAI",
    );
    expect(opcoesDe("accessReqCargo")).not.toContain("Jurídico");
    expect(opcoesDe("accessReqCoordenacao")).toEqual(["Não sei", "Norte"]);
  });

  it("Projetos: lista de projetos, sem coordenação; SEDE: setor em texto e Jurídico", async () => {
    const pedido = await desenhar(supabaseDaTela());
    await clicar(aba("Projetos"));
    expect(pedido.obter().campos.area).toBe("projetos");
    expect(opcoesDe("accessReqLotacao")).toEqual([
      "Escolha",
      "MFC",
      "Saúde nas Fronteiras",
    ]);
    expect($("accessReqCoordenacao")).toBeNull();
    expect(opcoesDe("accessReqCargo")).toContain("Coordenação de projeto");
    await clicar(aba("SEDE"));
    expect($("accessReqLotacao").tagName).toBe("INPUT");
    expect(opcoesDe("accessReqCargo")).toContain("Jurídico");
  });

  it("'Outro' abre o campo da descrição", async () => {
    await desenhar(supabaseDaTela());
    expect($("accessReqCargoOutro")).toBeNull();
    await escolher($("accessReqCargo"), "OUTRO");
    expect($("accessReqCargoOutro")).not.toBeNull();
  });

  it("lista de unidades que não carregou: erro e 'Tentar de novo'", async () => {
    const sb = supabaseDaTela({ falhaNasOpcoes: true });
    await desenhar(sb);
    expect(document.body.textContent).toContain(
      "Não foi possível carregar a lista.",
    );
    await clicar($("accessReqLotacaoRecarregar"));
    expect(chamadas(sb, "listar_opcoes_da_solicitacao_acesso")).toHaveLength(2);
  });

  it("justificativa curta: nada vai ao banco e o campo diz o que falta", async () => {
    const sb = supabaseDaTela();
    await desenhar(sb);
    await escolher($("accessReqCargo"), "AVALIADOR");
    await escolher($("accessReqLotacao"), "DSEI Yanomami");
    await digitar($("accessReqJustificativa"), "Preciso ver");
    await clicar($("accessRequestBtn"));
    expect(chamadas(sb, "registrar_solicitacao_acesso")).toHaveLength(0);
    expect(document.body.textContent).toContain(
      "Escreva ao menos 20 caracteres (faltam 9).",
    );
  });
});

describe("página: pedido enviado, editar e cancelar", () => {
  async function preencherEEnviar(sb) {
    await escolher($("accessReqCargo"), "AVALIADOR");
    await escolher($("accessReqLotacao"), "DSEI Yanomami");
    await digitar($("accessReqJustificativa"), JUSTIFICATIVA);
    await clicar($("accessRequestBtn"));
    return chamadas(sb, "registrar_solicitacao_acesso").at(-1)?.[1];
  }

  it("enviado: argumentos por área e 'Pedido enviado — aguardando aprovação' com o resumo", async () => {
    const sb = supabaseDaTela({ pedidos: [null, PENDENTE] });
    await desenhar(sb);
    expect(await preencherEEnviar(sb)).toEqual({
      p_nome: "Ana Souza",
      p_area: "saude-indigena",
      p_cargo: "AVALIADOR",
      p_cargo_outro: null,
      p_lotacao: "DSEI Yanomami",
      p_justificativa: JUSTIFICATIVA,
      p_coordenacao: null,
    });
    expect($("accessRequestStatusTitulo").textContent).toBe(
      "Pedido enviado — aguardando aprovação",
    );
    expect($("accessRequestResumo").textContent).toContain("DSEI Yanomami");
    expect($("accessRequestForm")).toBeNull();
    expect(document.querySelector(".solicitacao-aya-fala").textContent).toMatch(
      /Não chega e-mail/,
    );
  });

  it("editar: o formulário volta com o pedido; salvar grava e volta ao resumo", async () => {
    const sb = supabaseDaTela({
      pedidos: [PENDENTE, { ...PENDENTE, setor: "DSEI Altamira" }],
    });
    await desenhar(sb);
    await clicar($("accessRequestEditarBtn"));
    expect($("accessReqLotacao").value).toBe("DSEI Yanomami");
    expect($("accessRequestBtn").textContent).toBe("Salvar alterações");
    expect($("accessRequestStatus")).toBeNull();
    await escolher($("accessReqLotacao"), "DSEI Altamira");
    await clicar($("accessRequestBtn"));
    expect(
      chamadas(sb, "registrar_solicitacao_acesso").at(-1)[1].p_lotacao,
    ).toBe("DSEI Altamira");
    expect($("accessRequestResumo").textContent).toContain("DSEI Altamira");
  });

  it("editar e voltar: nada vai ao banco", async () => {
    const sb = supabaseDaTela({ pedidos: [PENDENTE] });
    await desenhar(sb);
    await clicar($("accessRequestEditarBtn"));
    await clicar($("accessRequestVoltarBtn"));
    expect($("accessRequestResumo")).not.toBeNull();
    expect(chamadas(sb, "registrar_solicitacao_acesso")).toHaveLength(0);
  });

  it("cancelar pede confirmação, cancela e volta ao formulário com o que foi pedido", async () => {
    const sb = supabaseDaTela({
      pedidos: [PENDENTE, { ...PENDENTE, status: "cancelado" }],
    });
    await desenhar(sb);
    await clicar($("accessRequestCancelarBtn"));
    expect(chamadas(sb, "cancelar_minha_solicitacao_acesso")).toHaveLength(0);
    await clicar($("accessRequestConfirmarCancelamento"));
    expect(chamadas(sb, "cancelar_minha_solicitacao_acesso")).toHaveLength(1);
    expect(document.body.textContent).toContain(AVISO_CANCELADO);
    expect($("accessReqLotacao").value).toBe("DSEI Yanomami");
    expect($("accessRequestBtn").textContent).toBe("Enviar pedido");
  });

  it("falha no envio: aviso com a mensagem do banco e o botão volta", async () => {
    const sb = supabaseDaTela({
      erroNoEnvio: {
        code: "22023",
        message: "Escolha o DSEI ou a CASAI na lista.",
      },
    });
    const pedido = await desenhar(sb);
    await preencherEEnviar(sb);
    expect(document.body.textContent).toContain(
      "Não foi possível enviar o pedido: Escolha o DSEI ou a CASAI na lista.",
    );
    expect(pedido.obter().enviando).toBe(false);
  });

  it("rede cai no envio (a promessa rejeita): aviso e o botão não fica preso", async () => {
    const sb = supabaseDaTela({ redeCaiNoEnvio: true });
    const pedido = await desenhar(sb);
    await preencherEEnviar(sb);
    expect(document.body.textContent).toContain(
      "Não foi possível enviar o pedido",
    );
    expect(pedido.obter().enviando).toBe(false);
  });
});

describe("página: recusado, desativada e liberado", () => {
  it("recusado: mostra o motivo e permite novo pedido com o que foi pedido", async () => {
    await desenhar(supabaseDaTela({ pedidos: [RECUSADO] }));
    expect($("accessRequestStatusTexto").textContent).toContain(
      "Motivo: Área ou lotação não confere — o DSEI é outro.",
    );
    expect($("accessReqLotacao").value).toBe("DSEI Yanomami");
    expect($("accessRequestBtn").textContent).toBe("Enviar novo pedido");
  });

  it("conta desativada: 'Pedir reativação' abre só nome e justificativa", async () => {
    const sb = supabaseDaTela({
      desativadaNoBanco: true,
      pedidos: [{ status: "aprovado" }, { ...PENDENTE, area: null }],
    });
    await desenhar(sb);
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect($("accessRequestForm")).toBeNull();
    await clicar($("accessRequestReativarBtn"));
    expect(document.querySelector('[role="tab"]')).toBeNull();
    expect($("accessReqCargo")).toBeNull();
    await digitar($("accessReqJustificativa"), JUSTIFICATIVA);
    await clicar($("accessRequestBtn"));
    expect(chamadas(sb, "registrar_solicitacao_acesso")[0][1]).toMatchObject({
      p_area: null,
      p_cargo: null,
      p_lotacao: null,
    });
    expect($("accessRequestStatusTitulo").textContent).toBe(
      "Pedido de reativação enviado",
    );
  });

  it("a marca da tela de desativada segura a reativação quando o banco não diz", async () => {
    lembrarContaDesativada("u1", window);
    await desenhar(supabaseDaTela({ pedidos: [PENDENTE] }));
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
  });

  it("aprovado com perfil ativo: 'Entrar agora'", async () => {
    await desenhar(
      supabaseDaTela({
        pedidos: [{ status: "aprovado" }],
        contexto: { profile: { id: "p1", ativo: true, perfil: "usuario" } },
      }),
    );
    expect($("accessRequestEnterBtn")).not.toBeNull();
  });

  it("os botões da conta chamam a sessão", async () => {
    await desenhar(supabaseDaTela());
    await clicar($("accessSwitchAccountBtn"));
    await clicar($("accessReturnLoginBtn"));
    expect(sessaoFalsa.entrarComGoogle).toHaveBeenCalled();
    expect(sessaoFalsa.limparSessao).toHaveBeenCalled();
  });
});

describe("estado: antes de saber a situação e sem consulta", () => {
  it("verificando: sem formulário", () => {
    const visao = visaoDoPedido({
      ...criarPedidoDeAcesso({ cliente: () => null }).obter(),
      carregando: true,
    });
    expect(visao).toMatchObject({
      titulo: TITULO_VERIFICANDO,
      conteudo: "oculto",
    });
  });

  it("consulta que falha: formulário com aviso", async () => {
    const sb = supabaseDaTela();
    sb.rpc.mockImplementation(async (nome) =>
      nome === "obter_minha_solicitacao_acesso"
        ? { data: null, error: { message: "x" } }
        : { data: null, error: null },
    );
    await desenhar(sb);
    expect(document.body.textContent).toContain(AVISO_SEM_CONSULTA);
    expect($("accessRequestForm")).not.toBeNull();
  });

  it("o front nunca pede acesso automático (garantir_acesso_basico)", async () => {
    const sb = supabaseDaTela();
    await desenhar(sb);
    expect(chamadas(sb, "garantir_acesso_basico")).toHaveLength(0);
  });
});
