import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JUSTIFICATIVA_MINIMA,
  PERGUNTA_DA_REATIVACAO,
  SITUACOES,
  TEXTO_DESATIVADA,
  TITULO_DESATIVADA,
  argumentosDaSolicitacao,
  contaDesativadaNaResposta,
  diaEMes,
  situacaoDaSolicitacao,
  telaDaSolicitacao,
  validarSolicitacao,
} from "../src/lib/solicitacao-de-acesso.js";
import {
  carregarMinhaSolicitacao,
  enviarSolicitacao,
  garantirAcessoBasico,
  lerCampos,
  TITULO_VERIFICANDO,
} from "../src/modules/solicitacao-de-acesso.js";
import { lembrarContaDesativada } from "../src/modules/comemoracao-do-acesso.js";

/*
  Tela "Solicitar acesso". Em 30/09, uma conta DESATIVADA com um pedido
  aprovado meses antes via "Solicitação aprovada. Recarregue a página para
  entrar." — errado. Cada situação agora tem texto e formulário próprios.
*/

const PENDENTE = {
  status: "pendente",
  created_at: "2026-09-29T13:00:00Z",
  coordenacao_nome: "Norte",
  nome: "Ana",
  setor: "COGIP",
  justificativa: "Acompanho os editais da região norte.",
};

describe("situação do pedido de acesso", () => {
  it("sem pedido: formulário para enviar", () => {
    expect(situacaoDaSolicitacao({ solicitacao: null })).toBe(
      SITUACOES.SEM_PEDIDO,
    );
    expect(telaDaSolicitacao({})).toMatchObject({
      formulario: "editavel",
      acao: "enviar",
      texto: "",
    });
  });

  it("pendente: data do pedido, aguardando, formulário só leitura", () => {
    const tela = telaDaSolicitacao({ solicitacao: PENDENTE });
    expect(tela.situacao).toBe(SITUACOES.PENDENTE);
    expect(tela.texto).toBe(
      "Pedido enviado em 29/09 para a coordenação Norte, aguardando um administrador.",
    );
    expect(tela).toMatchObject({ formulario: "leitura", acao: null });
  });

  it("recusado: mostra a observação e deixa pedir de novo", () => {
    const tela = telaDaSolicitacao({
      solicitacao: {
        status: "recusado",
        avaliado_em: "2026-09-30T12:00:00Z",
        observacao_admin: "Use o e-mail institucional.",
      },
    });
    expect(tela.texto).toBe(
      "Pedido recusado em 30/09. Observação: Use o e-mail institucional. Você pode enviar um novo pedido.",
    );
    expect(tela).toMatchObject({ formulario: "editavel", acao: "enviar" });
  });

  it("conta desativada: vence qualquer pedido, sem 'aprovada' e sem formulário", () => {
    for (const status of ["aprovado", "recusado", null]) {
      const tela = telaDaSolicitacao({
        solicitacao: status ? { status } : null,
        contaDesativada: true,
      });
      expect(tela.situacao).toBe(SITUACOES.DESATIVADA);
      expect(tela.titulo).toBe("Seu acesso ao MONITORA foi desativado.");
      expect(tela.titulo).toBe(TITULO_DESATIVADA);
      expect(tela.texto).toBe(TEXTO_DESATIVADA);
      expect(tela.ilustracao).toBe("triste");
      expect(tela.texto).not.toMatch(/aprovad/i);
      expect(tela).toMatchObject({
        formulario: "oculto",
        acao: null,
        desativada: true,
        reativacao: "oferecer",
      });
    }
  });

  it("conta desativada com pedido pendente: é o pedido de reativação aguardando", () => {
    const tela = telaDaSolicitacao({
      solicitacao: PENDENTE,
      contaDesativada: true,
    });
    expect(tela.situacao).toBe(SITUACOES.REATIVACAO_PENDENTE);
    expect(tela.titulo).toBe(TITULO_DESATIVADA);
    expect(tela.texto).toBe(
      "Pedido de reativação enviado em 29/09, aguardando um administrador.",
    );
    expect(tela).toMatchObject({
      formulario: "leitura",
      acao: null,
      desativada: true,
      reativacao: "pendente",
      tom: "info",
    });
  });

  it("aprovado sem perfil ativo = acesso tirado depois (desativada)", () => {
    expect(situacaoDaSolicitacao({ solicitacao: { status: "aprovado" } })).toBe(
      SITUACOES.DESATIVADA,
    );
  });

  it("aprovado e com perfil ativo: botão 'Entrar agora', não texto de recarregar", () => {
    const tela = telaDaSolicitacao({
      solicitacao: { status: "aprovado" },
      perfilAtivo: true,
    });
    expect(tela).toMatchObject({
      situacao: SITUACOES.LIBERADO,
      acao: "entrar",
      formulario: "oculto",
    });
    expect(tela.texto).not.toMatch(/recarregue/i);
  });

  it("garantir_acesso_basico: 'existente' (ou o campo novo) marca a conta desativada", () => {
    expect(
      contaDesativadaNaResposta({ criado: false, motivo: "existente" }),
    ).toBe(true);
    expect(contaDesativadaNaResposta({ conta_desativada: true })).toBe(true);
    expect(
      contaDesativadaNaResposta({ criado: false, motivo: "dominio" }),
    ).toBe(false);
    expect(contaDesativadaNaResposta({ criado: true })).toBe(false);
    expect(contaDesativadaNaResposta(null)).toBe(false);
  });

  it("dia e mês no fuso de Brasília", () => {
    expect(diaEMes("2026-09-30T02:00:00Z")).toBe("29/09");
    expect(diaEMes("")).toBe("");
    expect(diaEMes("x")).toBe("");
  });
});

describe("validação do pedido", () => {
  const valido = {
    nome: "Ana",
    setor: "COGIP",
    coordenacao: "",
    justificativa: "Acompanho os editais da região norte.",
  };

  it("válido não tem erro", () => {
    expect(validarSolicitacao(valido)).toEqual({});
    expect(
      validarSolicitacao({ ...valido, setor: "", coordenacao: "norte" }),
    ).toEqual({});
  });

  it("cada campo diz o que falta", () => {
    const erros = validarSolicitacao({
      nome: " ",
      setor: "",
      coordenacao: "",
      justificativa: "curta",
    });
    expect(erros.nome).toBe("Informe seu nome.");
    expect(erros.setor).toBe(
      "Informe sua área / setor ou escolha a coordenação.",
    );
    expect(erros.justificativa).toBe(
      `Escreva ao menos ${JUSTIFICATIVA_MINIMA} caracteres (faltam ${JUSTIFICATIVA_MINIMA - 5}).`,
    );
    expect(
      validarSolicitacao({ ...valido, justificativa: "" }).justificativa,
    ).toBe("Explique por que precisa do acesso.");
    expect(
      validarSolicitacao({ ...valido, justificativa: "x".repeat(2001) })
        .justificativa,
    ).toMatch(/no máximo 2000/);
  });

  it("pedido de reativação: só nome e justificativa; sem setor", () => {
    const reativacao = { reativacao: true };
    expect(
      validarSolicitacao(
        { nome: "Ana", setor: "", coordenacao: "", justificativa: "curta" },
        reativacao,
      ),
    ).toEqual({
      justificativa: `Escreva ao menos ${JUSTIFICATIVA_MINIMA} caracteres (faltam ${JUSTIFICATIVA_MINIMA - 5}).`,
    });
    expect(
      argumentosDaSolicitacao(
        {
          nome: "Ana",
          setor: "COGIP",
          justificativa: "Voltei para a equipe de editais.",
          coordenacao: "norte",
        },
        reativacao,
      ),
    ).toEqual({
      p_nome: "Ana",
      p_setor: null,
      p_justificativa: "Voltei para a equipe de editais.",
      p_coordenacao: "norte",
    });
  });

  it("argumentos vazios viram null", () => {
    expect(
      argumentosDaSolicitacao({
        nome: " Ana ",
        setor: "",
        justificativa: "x",
        coordenacao: "",
      }),
    ).toEqual({
      p_nome: "Ana",
      p_setor: null,
      p_justificativa: "x",
      p_coordenacao: null,
    });
  });
});

// ── Tela: conta desativada pede reativação ──────────────────────────────────

const CARTAO = `
  <div id="accessRequestCard">
    <h2 id="accessRequestTitulo">Solicitar acesso</h2>
    <p class="access-request-subtitle">Envie o pedido.</p>
    <p class="access-request-invite">Convite.</p>
    <div id="accessRequestCarregando" class="hidden"></div>
    <div id="accessRequestStatus" class="hidden">
      <span id="accessRequestIlustracao" class="hidden">:(</span>
      <strong id="accessRequestStatusTitulo" class="hidden"></strong>
      <span id="accessRequestStatusTexto"></span>
      <button id="accessRequestEnterBtn" class="hidden"></button>
      <div id="accessRequestReativar" class="hidden">
        <span>Precisa do acesso de novo?</span>
        <button id="accessRequestReativarBtn" type="button">Pedir reativação</button>
      </div>
    </div>
    <div id="accessRequestForm">
      <input id="accessReqNome" />
      <small id="accessReqNomeErro" class="hidden"></small>
      <div id="accessReqSetorLinha">
        <input id="accessReqSetor" />
        <small id="accessReqSetorErro" class="hidden"></small>
      </div>
      <select id="accessReqCoordenacao"><option value="">Não sei</option></select>
      <small id="accessReqCoordenacaoErro" class="hidden"></small>
      <textarea id="accessReqJustificativa"></textarea>
      <small id="accessReqJustificativaErro" class="hidden"></small>
    </div>
    <button id="accessRequestBtn"><span id="accessRequestBtnTexto">Enviar pedido</span></button>
  </div>`;

const $ = (id) => document.getElementById(id);
const visivel = (id) => !$(id).classList.contains("hidden");

/** RPCs da tela; `pedidos` responde obter_minha_solicitacao_acesso em fila. */
function supabaseDaTela({ basico, pedidos }) {
  const fila = [...pedidos];
  return {
    rpc: vi.fn(async (nome) => {
      if (nome === "garantir_acesso_basico")
        return { data: basico, error: null };
      if (nome === "obter_minha_solicitacao_acesso")
        return { data: fila.length > 1 ? fila.shift() : fila[0], error: null };
      if (nome === "listar_coordenacoes_ativas")
        return { data: [], error: null };
      if (nome === "registrar_solicitacao_acesso")
        return { data: { ok: true, status: "pendente" }, error: null };
      return { data: null, error: null };
    }),
  };
}

describe("tela de acesso desativado: pedir reativação", () => {
  beforeEach(() => {
    document.body.innerHTML = CARTAO;
    localStorage.clear();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("oferece 'Pedir reativação', abre o formulário sem setor e, enviado, mostra o pedido aguardando", async () => {
    const sb = supabaseDaTela({
      basico: { criado: false, motivo: "existente" },
      pedidos: [
        { status: "aprovado" },
        {
          status: "pendente",
          created_at: "2026-09-30T13:00:00Z",
          nome: "Ana",
          justificativa: "Voltei para a equipe de editais.",
        },
      ],
    });
    await garantirAcessoBasico(sb);
    await carregarMinhaSolicitacao(sb, document, { usuarioId: "u1" });
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect(visivel("accessRequestIlustracao")).toBe(true);
    expect(visivel("accessRequestReativar")).toBe(true);
    expect($("accessRequestReativar").textContent).toContain(
      PERGUNTA_DA_REATIVACAO,
    );
    expect(visivel("accessRequestForm")).toBe(false);

    $("accessRequestReativarBtn").click();
    expect(visivel("accessRequestForm")).toBe(true);
    expect(visivel("accessReqSetorLinha")).toBe(false);
    expect(visivel("accessRequestReativar")).toBe(false);
    expect($("accessRequestBtnTexto").textContent).toBe("Pedir reativação");
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");

    $("accessReqNome").value = "Ana";
    $("accessReqJustificativa").value = "curta";
    const curta = await enviarSolicitacao(sb, lerCampos(document));
    expect(curta.ok).toBe(false);
    expect(Object.keys(curta.erros)).toEqual(["justificativa"]);
    expect(
      sb.rpc.mock.calls.some(([n]) => n === "registrar_solicitacao_acesso"),
    ).toBe(false);

    $("accessReqJustificativa").value = "Voltei para a equipe de editais.";
    const enviado = await enviarSolicitacao(sb, lerCampos(document));
    expect(enviado.ok).toBe(true);
    expect(
      sb.rpc.mock.calls.find(([n]) => n === "registrar_solicitacao_acesso")[1],
    ).toEqual({
      p_nome: "Ana",
      p_setor: null,
      p_justificativa: "Voltei para a equipe de editais.",
      p_coordenacao: null,
    });
    expect($("accessRequestStatusTexto").textContent).toBe(
      "Pedido de reativação enviado em 30/09, aguardando um administrador.",
    );
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect(visivel("accessRequestReativar")).toBe(false);
    expect(visivel("accessRequestBtn")).toBe(false);
    expect($("accessReqJustificativa").readOnly).toBe(true);
  });

  it("pedido pendente de conta desativada: mostra direto o pedido de reativação aguardando", async () => {
    const sb = supabaseDaTela({
      basico: { criado: false, motivo: "existente" },
      pedidos: [{ status: "pendente", created_at: "2026-09-29T13:00:00Z" }],
    });
    await garantirAcessoBasico(sb);
    await carregarMinhaSolicitacao(sb, document, { usuarioId: "u1" });
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect($("accessRequestStatusTexto").textContent).toBe(
      "Pedido de reativação enviado em 29/09, aguardando um administrador.",
    );
    expect(visivel("accessRequestReativar")).toBe(false);
    expect(visivel("accessReqSetorLinha")).toBe(false);
  });

  it("fora do domínio: a marca da tela de desativada segura o pedido de reativação", async () => {
    lembrarContaDesativada("u2");
    const sb = supabaseDaTela({
      basico: { criado: false, motivo: "dominio" },
      pedidos: [{ status: "pendente", created_at: "2026-09-29T13:00:00Z" }],
    });
    await garantirAcessoBasico(sb);
    await carregarMinhaSolicitacao(sb, document, { usuarioId: "u2" });
    expect($("accessRequestStatusTexto").textContent).toMatch(
      /^Pedido de reativação enviado em 29\/09/,
    );
  });

  it("sem conta desativada, o pedido pendente continua o comum", async () => {
    const sb = supabaseDaTela({
      basico: { criado: false, motivo: "dominio" },
      pedidos: [{ status: "pendente", created_at: "2026-09-29T13:00:00Z" }],
    });
    await garantirAcessoBasico(sb);
    await carregarMinhaSolicitacao(sb, document, { usuarioId: "u3" });
    expect($("accessRequestTitulo").textContent).toBe("Solicitar acesso");
    expect($("accessRequestStatusTexto").textContent).toBe(
      "Pedido enviado em 29/09, aguardando um administrador.",
    );
    expect(visivel("accessReqSetorLinha")).toBe(true);
  });
});

describe("tela de acesso: sem formulário antes de saber a situação", () => {
  beforeEach(() => {
    document.body.innerHTML = CARTAO;
    localStorage.clear();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  /** obter_minha_solicitacao_acesso só responde quando o teste mandar. */
  function supabaseEmEspera(basico) {
    let responder;
    const pedido = new Promise((resolve) => (responder = resolve));
    return {
      responder,
      sb: {
        rpc: vi.fn((nome) => {
          if (nome === "garantir_acesso_basico")
            return Promise.resolve({ data: basico, error: null });
          if (nome === "obter_minha_solicitacao_acesso") return pedido;
          return Promise.resolve({ data: [], error: null });
        }),
      },
    };
  }

  const esperando = () => {
    expect($("accessRequestTitulo").textContent).toBe(TITULO_VERIFICANDO);
    expect(visivel("accessRequestCarregando")).toBe(true);
    expect(visivel("accessRequestForm")).toBe(false);
    expect(visivel("accessRequestBtn")).toBe(false);
    expect(
      document.querySelector(".access-request-subtitle").className,
    ).toContain("hidden");
    expect($("accessRequestCard").getAttribute("aria-busy")).toBe("true");
  };

  it("conta desativada: não passa pelo formulário de 'Solicitar acesso'", async () => {
    const { sb, responder } = supabaseEmEspera({
      criado: false,
      motivo: "existente",
    });
    await garantirAcessoBasico(sb);
    const carga = carregarMinhaSolicitacao(sb, document, { usuarioId: "u9" });
    esperando();
    responder({ data: { status: "aprovado" }, error: null });
    await carga;
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect(visivel("accessRequestForm")).toBe(false);
    expect(visivel("accessRequestCarregando")).toBe(false);
    expect($("accessRequestCard").hasAttribute("aria-busy")).toBe(false);
  });

  it("pedido pendente: sai da espera direto para o pedido, só leitura", async () => {
    const { sb, responder } = supabaseEmEspera({
      criado: false,
      motivo: "dominio",
    });
    await garantirAcessoBasico(sb);
    const carga = carregarMinhaSolicitacao(sb, document, { usuarioId: "u8" });
    esperando();
    responder({
      data: { status: "pendente", created_at: "2026-09-29T13:00:00Z" },
      error: null,
    });
    await carga;
    expect(visivel("accessRequestForm")).toBe(true);
    expect($("accessReqJustificativa").readOnly).toBe(true);
    expect(visivel("accessRequestBtn")).toBe(false);
  });

  it("sem pedido: o formulário aparece só depois de saber", async () => {
    const { sb, responder } = supabaseEmEspera({
      criado: false,
      motivo: "dominio",
    });
    await garantirAcessoBasico(sb);
    const carga = carregarMinhaSolicitacao(sb, document, { usuarioId: "u7" });
    esperando();
    responder({ data: null, error: null });
    await carga;
    expect($("accessRequestTitulo").textContent).toBe("Solicitar acesso");
    expect(visivel("accessRequestForm")).toBe(true);
    expect(visivel("accessRequestBtn")).toBe(true);
    expect(
      document.querySelector(".access-request-subtitle").className,
    ).not.toContain("hidden");
  });

  it("consulta que falha (erro ou exceção): volta ao formulário, como antes", async () => {
    for (const falha of [
      () => Promise.resolve({ data: null, error: { message: "x" } }),
      () => Promise.reject(new Error("rede")),
    ]) {
      document.body.innerHTML = CARTAO;
      const sb = {
        rpc: vi.fn((nome) =>
          nome === "obter_minha_solicitacao_acesso"
            ? falha()
            : Promise.resolve({
                data: { criado: false, motivo: "dominio" },
                error: null,
              }),
        ),
      };
      await garantirAcessoBasico(sb);
      await carregarMinhaSolicitacao(sb, document, { usuarioId: "u6" });
      expect(visivel("accessRequestForm")).toBe(true);
      expect(visivel("accessRequestBtn")).toBe(true);
      expect(visivel("accessRequestCarregando")).toBe(false);
      expect($("accessRequestStatusTexto").textContent).toContain(
        "Não foi possível consultar seu pedido anterior",
      );
    }
  });
});
