import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JUSTIFICATIVA_MINIMA,
  PERGUNTA_DA_REATIVACAO,
  SITUACOES,
  TEXTO_DESATIVADA,
  TITULO_DESATIVADA,
  argumentosDaSolicitacao,
  diaEMes,
  situacaoDaSolicitacao,
  telaDaSolicitacao,
  validarSolicitacao,
} from "../src/lib/solicitacao-de-acesso.js";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  AVISO_SEM_CONSULTA,
  TITULO_VERIFICANDO,
  criarPedidoDeAcesso,
  visaoDoPedido,
} from "../src/app/entrada/pedido-de-acesso.js";
import { CartaoDoPedido } from "../src/app/entrada/pedido-de-acesso.jsx";
import { lembrarContaDesativada } from "../src/lib/acesso-liberado.js";
import { clicar, digitar } from "./componentes/interacoes.js";

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

// ── O cartão (src/app/entrada/): estado e desenho ───────────────────────────

/** RPCs do cartão; `pedidos` responde obter_minha_solicitacao_acesso em fila. */
function supabaseDaTela({
  pedidos,
  desativadaNoBanco = false,
  contexto = null,
}) {
  const fila = [...pedidos];
  return {
    rpc: vi.fn(async (nome) => {
      if (nome === "minha_conta_desativada")
        return { data: desativadaNoBanco, error: null };
      if (nome === "obter_minha_solicitacao_acesso")
        return { data: fila.length > 1 ? fila.shift() : fila[0], error: null };
      if (nome === "listar_coordenacoes_ativas")
        return {
          data: [
            {
              area: "si",
              area_nome: "Saúde Indígena",
              codigo: "norte",
              nome: "Norte",
            },
          ],
          error: null,
        };
      if (nome === "obter_contexto_monitora")
        return { data: contexto, error: null };
      if (nome === "registrar_solicitacao_acesso")
        return { data: { ok: true, status: "pendente" }, error: null };
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
let pedido = null;
const sessaoFalsa = { entrarComGoogle: vi.fn(), limparSessao: vi.fn() };

async function desenharCartao(sb) {
  pedido = criarPedidoDeAcesso({ cliente: () => sb, janela: window });
  document.body.innerHTML = `<div id="raiz"></div>`;
  raiz = createRoot(document.getElementById("raiz"));
  await act(async () => {
    raiz.render(createElement(CartaoDoPedido, { pedido, sessao: sessaoFalsa }));
  });
  return pedido;
}

const $ = (id) => document.getElementById(id);
const existe = (id) => Boolean($(id));

beforeEach(() => localStorage.clear());
afterEach(async () => {
  if (raiz) await act(async () => raiz.unmount());
  raiz = null;
  document.body.innerHTML = "";
  localStorage.clear();
  sessionStorage.clear();
});

describe("tela de acesso desativado: pedir reativação", () => {
  it("oferece 'Pedir reativação', abre o formulário sem setor e, enviado, mostra o pedido aguardando", async () => {
    const sb = supabaseDaTela({
      desativadaNoBanco: true,
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
    await desenharCartao(sb);
    await act(() => pedido.carregar({ usuario: USUARIO("u1") }));
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect(existe("accessRequestIlustracao")).toBe(true);
    expect($("accessRequestReativar").textContent).toContain(
      PERGUNTA_DA_REATIVACAO,
    );
    expect(existe("accessRequestForm")).toBe(false);
    expect(document.querySelector(".access-request-subtitle")).toBeNull();

    await clicar($("accessRequestReativarBtn"));
    expect(existe("accessRequestForm")).toBe(true);
    expect(existe("accessReqSetor")).toBe(false);
    expect(existe("accessRequestReativar")).toBe(false);
    expect($("accessRequestBtnTexto").textContent).toBe("Pedir reativação");
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect(document.activeElement).toBe($("accessReqJustificativa"));

    // O nome veio do Google; justificativa curta não vai ao banco.
    expect($("accessReqNome").value).toBe("Ana Souza");
    await digitar($("accessReqJustificativa"), "curta");
    await clicar($("accessRequestBtn"));
    expect(Object.keys(pedido.obter().erros)).toEqual(["justificativa"]);
    expect(document.body.textContent).toContain("Escreva ao menos");
    expect(
      sb.rpc.mock.calls.some(([n]) => n === "registrar_solicitacao_acesso"),
    ).toBe(false);

    await digitar(
      $("accessReqJustificativa"),
      "Voltei para a equipe de editais.",
    );
    await clicar($("accessRequestBtn"));
    expect(
      sb.rpc.mock.calls.find(([n]) => n === "registrar_solicitacao_acesso")[1],
    ).toEqual({
      p_nome: "Ana Souza",
      p_setor: null,
      p_justificativa: "Voltei para a equipe de editais.",
      p_coordenacao: null,
    });
    expect($("accessRequestStatusTexto").textContent).toBe(
      "Pedido de reativação enviado em 30/09, aguardando um administrador.",
    );
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect(existe("accessRequestReativar")).toBe(false);
    expect(existe("accessRequestBtn")).toBe(false);
    expect($("accessReqJustificativa").readOnly).toBe(true);
  });

  it("pedido pendente de conta desativada: mostra direto o pedido de reativação aguardando", async () => {
    const sb = supabaseDaTela({
      desativadaNoBanco: true,
      pedidos: [{ status: "pendente", created_at: "2026-09-29T13:00:00Z" }],
    });
    await desenharCartao(sb);
    await act(() => pedido.carregar({ usuario: USUARIO("u1") }));
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect($("accessRequestStatusTexto").textContent).toBe(
      "Pedido de reativação enviado em 29/09, aguardando um administrador.",
    );
    expect(existe("accessRequestReativar")).toBe(false);
    expect(existe("accessReqSetor")).toBe(false);
  });

  it("sem resposta do banco: a marca da tela de desativada segura o pedido de reativação", async () => {
    lembrarContaDesativada("u2");
    const sb = supabaseDaTela({
      pedidos: [{ status: "pendente", created_at: "2026-09-29T13:00:00Z" }],
    });
    await desenharCartao(sb);
    await act(() => pedido.carregar({ usuario: USUARIO("u2") }));
    expect($("accessRequestStatusTexto").textContent).toMatch(
      /^Pedido de reativação enviado em 29\/09/,
    );
  });

  it("sem conta desativada, o pedido pendente continua o comum", async () => {
    const sb = supabaseDaTela({
      pedidos: [{ status: "pendente", created_at: "2026-09-29T13:00:00Z" }],
    });
    await desenharCartao(sb);
    await act(() => pedido.carregar({ usuario: USUARIO("u3") }));
    expect($("accessRequestTitulo").textContent).toBe("Solicitar acesso");
    expect($("accessRequestStatusTexto").textContent).toBe(
      "Pedido enviado em 29/09, aguardando um administrador.",
    );
    expect(existe("accessReqSetor")).toBe(true);
    expect(document.querySelector(".access-request-invite").textContent).toBe(
      "Se você recebeu um convite, entre com o e-mail convidado.",
    );
  });

  it("conta desativada mostrada deixa a marca para o 'Bem-vindo(a) de volta'", async () => {
    const sb = supabaseDaTela({ desativadaNoBanco: true, pedidos: [null] });
    await desenharCartao(sb);
    await act(() => pedido.carregar({ usuario: USUARIO("u4") }));
    expect(localStorage.getItem("agsus_monitora_acesso_desativado:u4")).toBe(
      "1",
    );
  });
});

describe("tela de acesso: sem formulário antes de saber a situação", () => {
  /** obter_minha_solicitacao_acesso só responde quando o teste mandar. */
  function supabaseEmEspera({ desativada = false } = {}) {
    let responder;
    const resposta = new Promise((resolve) => (responder = resolve));
    return {
      responder,
      sb: {
        rpc: vi.fn((nome) => {
          if (nome === "obter_minha_solicitacao_acesso") return resposta;
          if (nome === "minha_conta_desativada")
            return Promise.resolve({ data: desativada, error: null });
          return Promise.resolve({ data: [], error: null });
        }),
      },
    };
  }

  const esperando = () => {
    expect($("accessRequestTitulo").textContent).toBe(TITULO_VERIFICANDO);
    expect(existe("accessRequestCarregando")).toBe(true);
    expect(existe("accessRequestForm")).toBe(false);
    expect(existe("accessRequestBtn")).toBe(false);
    expect(document.querySelector(".access-request-subtitle")).toBeNull();
    expect($("accessRequestCard").getAttribute("aria-busy")).toBe("true");
  };

  async function carregarEsperando(sb, id) {
    await desenharCartao(sb);
    let carga;
    await act(async () => {
      carga = pedido.carregar({ usuario: USUARIO(id) });
    });
    esperando();
    // Num objeto: devolver a promessa direto a faria ser esperada aqui.
    return { carga };
  }

  it("conta desativada: não passa pelo formulário de 'Solicitar acesso'", async () => {
    const { sb, responder } = supabaseEmEspera({ desativada: true });
    const { carga } = await carregarEsperando(sb, "u9");
    await act(async () => {
      responder({ data: { status: "aprovado" }, error: null });
      await carga;
    });
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect(existe("accessRequestForm")).toBe(false);
    expect(existe("accessRequestCarregando")).toBe(false);
    expect($("accessRequestCard").hasAttribute("aria-busy")).toBe(false);
  });

  it("pedido pendente: sai da espera direto para o pedido, só leitura", async () => {
    const { sb, responder } = supabaseEmEspera();
    const { carga } = await carregarEsperando(sb, "u8");
    await act(async () => {
      responder({
        data: {
          status: "pendente",
          created_at: "2026-09-29T13:00:00Z",
          justificativa: "Acompanho os editais da região norte.",
        },
        error: null,
      });
      await carga;
    });
    expect(existe("accessRequestForm")).toBe(true);
    expect($("accessReqJustificativa").readOnly).toBe(true);
    expect($("accessReqJustificativa").value).toBe(
      "Acompanho os editais da região norte.",
    );
    expect(existe("accessRequestBtn")).toBe(false);
  });

  it("sem pedido: o formulário aparece só depois de saber", async () => {
    const { sb, responder } = supabaseEmEspera();
    const { carga } = await carregarEsperando(sb, "u7");
    await act(async () => {
      responder({ data: null, error: null });
      await carga;
    });
    expect($("accessRequestTitulo").textContent).toBe("Solicitar acesso");
    expect(existe("accessRequestForm")).toBe(true);
    expect(existe("accessRequestBtn")).toBe(true);
    expect(document.querySelector(".access-request-subtitle")).not.toBeNull();
    expect($("accessReqEmail").textContent).toBe("u7@agenciasus.org.br");
  });

  it("consulta que falha (erro ou exceção): volta ao formulário, como antes", async () => {
    for (const falha of [
      () => Promise.resolve({ data: null, error: { message: "x" } }),
      () => Promise.reject(new Error("rede")),
    ]) {
      const sb = {
        rpc: vi.fn((nome) =>
          nome === "obter_minha_solicitacao_acesso"
            ? falha()
            : Promise.resolve({ data: null, error: null }),
        ),
      };
      await desenharCartao(sb);
      await act(() => pedido.carregar({ usuario: USUARIO("u6") }));
      expect(existe("accessRequestForm")).toBe(true);
      expect(existe("accessRequestBtn")).toBe(true);
      expect(existe("accessRequestCarregando")).toBe(false);
      expect($("accessRequestStatusTexto").textContent).toBe(
        AVISO_SEM_CONSULTA,
      );
      await act(async () => raiz.unmount());
      raiz = null;
    }
  });

  it("a carga do login falhou: o formulário aparece sem consultar", async () => {
    const sb = supabaseDaTela({ pedidos: [null] });
    await desenharCartao(sb);
    await act(() =>
      pedido.carregar({ usuario: USUARIO("u5"), consultar: false }),
    );
    expect(existe("accessRequestForm")).toBe(true);
    expect(existe("accessRequestBtn")).toBe(true);
    expect(sb.rpc).not.toHaveBeenCalled();
  });
});

describe("conta desativada vinda do banco (minha_conta_desativada)", () => {
  it("sem pista no navegador e com pedido pendente, mostra a reativação aguardando (não um pedido comum)", async () => {
    const sb = supabaseDaTela({
      desativadaNoBanco: true,
      pedidos: [
        {
          status: "pendente",
          created_at: "2026-09-30T15:15:00Z",
          nome: "Ana",
          justificativa: "Preciso voltar para a equipe de editais.",
        },
      ],
    });
    await desenharCartao(sb);
    await act(() => pedido.carregar({ usuario: USUARIO("sem-marca") }));
    expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    expect(document.body.textContent).toContain("reativação");
  });
});

describe("pedido liberado e acesso só por convite", () => {
  it("pedido aprovado com perfil ativo: 'Entrar agora' marca as boas-vindas e recarrega", async () => {
    const sb = supabaseDaTela({
      pedidos: [{ status: "aprovado" }],
      contexto: { profile: { id: "p1", ativo: true }, panel_ids: [] },
    });
    const recarregar = vi.fn();
    const janela = {
      sessionStorage: window.sessionStorage,
      localStorage: window.localStorage,
      location: { reload: recarregar },
    };
    pedido = criarPedidoDeAcesso({ cliente: () => sb, janela });
    await pedido.carregar({ usuario: USUARIO("u10") });
    expect(visaoDoPedido(pedido.obter()).status).toMatchObject({
      titulo: "Acesso liberado",
      entrar: true,
    });
    pedido.entrarAgora();
    expect(
      sessionStorage.getItem("agsus_monitora_acesso_liberado_pendente"),
    ).toBe("1");
    expect(recarregar).toHaveBeenCalled();
  });

  it("o front nunca pede acesso automático (garantir_acesso_basico)", async () => {
    const sb = supabaseDaTela({ pedidos: [null] });
    pedido = criarPedidoDeAcesso({ cliente: () => sb, janela: window });
    await pedido.carregar({ usuario: USUARIO("u11") });
    expect(
      sb.rpc.mock.calls.some(([nome]) => nome === "garantir_acesso_basico"),
    ).toBe(false);
  });

  it("a coordenação é escolhida numa lista agrupada por área", async () => {
    const sb = supabaseDaTela({ pedidos: [null] });
    await desenharCartao(sb);
    await act(() => pedido.carregar({ usuario: USUARIO("u12") }));
    const grupo = document.querySelector("#accessReqCoordenacao optgroup");
    expect(grupo.label).toBe("Saúde Indígena");
    expect(grupo.querySelector("option").value).toBe("norte");
  });

  it("os botões da conta chamam a sessão", async () => {
    const sb = supabaseDaTela({ pedidos: [null] });
    await desenharCartao(sb);
    await clicar($("accessSwitchAccountBtn"));
    await clicar($("accessReturnLoginBtn"));
    expect(sessaoFalsa.entrarComGoogle).toHaveBeenCalled();
    expect(sessaoFalsa.limparSessao).toHaveBeenCalled();
  });

  it("falha no envio: aviso em vermelho e o botão volta", async () => {
    const sb = supabaseDaTela({ pedidos: [null] });
    sb.rpc.mockImplementation(async (nome) =>
      nome === "registrar_solicitacao_acesso"
        ? { data: null, error: { message: "permission denied for function" } }
        : { data: null, error: null },
    );
    await desenharCartao(sb);
    await act(() => pedido.carregar({ usuario: USUARIO("u13") }));
    await digitar($("accessReqSetor"), "COGIP");
    await digitar(
      $("accessReqJustificativa"),
      "Acompanho os editais da região norte.",
    );
    await clicar($("accessRequestBtn"));
    expect($("accessRequestStatus").className).toContain("danger");
    expect($("accessRequestStatusTexto").textContent).toContain(
      "Não foi possível enviar o pedido: Permissão insuficiente",
    );
    expect($("accessRequestBtn").disabled).toBe(false);
  });
});
