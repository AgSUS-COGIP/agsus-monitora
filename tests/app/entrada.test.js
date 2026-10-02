import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SLOGAN,
  ligarEntradaAPagina,
  montarEntrada,
} from "../../src/app/entrada/entrada.jsx";
import { criarMarcaDaEntrada } from "../../src/app/entrada/marca.js";
import {
  FASES,
  TEXTO_DO_BOTAO,
  TEXTO_DO_BOTAO_OCUPADO,
  configuracaoDaEntrada,
} from "../../src/app/sessao.js";
import { clicar } from "../componentes/interacoes.js";

/*
  A tela de acesso (src/app/entrada/): desenha a marca e a configuração que
  vêm de fora (estado da marca, configuração da sessão), as mensagens e o
  botão; a fase da sessão mostra e esconde o #loginScreen e o pedido.
*/

function sessaoFalsa(inicial = {}) {
  let estado = {
    fase: FASES.DESLOGADO,
    usuario: null,
    mensagem: { texto: "", tom: "" },
    entrando: false,
    erroDeConfiguracao: "",
    consultarPedido: true,
    configuracao: configuracaoDaEntrada(),
    ...inicial,
  };
  const ouvintes = new Set();
  return {
    obter: () => estado,
    assinar: (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    definir(parcial) {
      estado = { ...estado, ...parcial };
      ouvintes.forEach((ouvinte) => ouvinte());
    },
    entrarComGoogle: vi.fn(),
    limparSessao: vi.fn(),
  };
}

function pedidoFalso() {
  const estado = {
    usuarioId: "",
    email: "u1@agenciasus.org.br",
    carregando: true,
    status: null,
    formulario: { formulario: "oculto" },
    campos: { nome: "", setor: "", coordenacao: "", justificativa: "" },
    erros: {},
    coordenacoes: [],
    focoNaJustificativa: 0,
  };
  return {
    obter: () => estado,
    assinar: () => () => {},
    carregar: vi.fn(async () => null),
    limpar: vi.fn(),
  };
}

let tela = null;

async function montar({
  sessao = sessaoFalsa(),
  marca = criarMarcaDaEntrada(),
  pedido = pedidoFalso(),
} = {}) {
  await act(async () => {
    tela = montarEntrada({
      elemento: document.getElementById("telaDeEntrada"),
      sessao,
      marca,
      pedido,
    });
  });
  return { sessao, marca, pedido };
}

const $ = (id) => document.getElementById(id);

beforeEach(() => {
  document.body.className = "config-loading";
  document.body.innerHTML = `
    <section id="loginScreen" class="login-screen">
      <div id="telaDeEntrada"><div class="login-card" aria-hidden="true"></div></div>
    </section>
    <section id="appScreen" class="app hidden"></section>`;
});

afterEach(async () => {
  await act(async () => tela?.desmontar());
  tela = null;
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("tela de acesso", () => {
  it("troca o cartão vazio do index.html pelo de verdade, com o slogan", async () => {
    await montar();
    expect(document.querySelectorAll(".login-card")).toHaveLength(1);
    expect($("loginSubtitle").textContent).toBe(SLOGAN);
    expect(SLOGAN).toBe("Monitoramento de Processos Seletivos");
    expect($("loginGreeting").textContent).toBe("Bem-vindo(a) ao MONITORA");
    expect($("googleLoginText").textContent).toBe(TEXTO_DO_BOTAO);
    expect($("loginMsg").classList.contains("hidden")).toBe(true);
  });

  it("desenha a marca configurada: logo, saudação, texto do botão e rodapé", async () => {
    const marca = criarMarcaDaEntrada();
    await montar({ marca });
    await act(async () =>
      marca.definir({
        logoUrl: "https://exemplo.org/logo.png",
        saudacao: "Bem-vindo ao Agosto Lilás",
        textoDoBotao: "Entrar com a conta da AgSUS",
        rodape: {
          nome: "COGIP",
          logoUrl: "",
          funcao: "Dados",
          versao: "v3",
          departamento: "AgSUS",
        },
      }),
    );
    expect($("loginLogo").getAttribute("src")).toBe(
      "https://exemplo.org/logo.png",
    );
    expect($("loginGreeting").textContent).toBe("Bem-vindo ao Agosto Lilás");
    expect($("googleLoginText").textContent).toBe(
      "Entrar com a conta da AgSUS",
    );
    expect($("loginCogipName").textContent).toBe("COGIP");
    expect($("loginCogipRole").textContent).toBe("Dados · v3");
    expect($("loginFoot").textContent).toBe("AgSUS");
  });

  it("o texto do botão da configuração vence o da marca guardada", async () => {
    const marca = criarMarcaDaEntrada();
    marca.definir({ textoDoBotao: "Da marca guardada" });
    const sessao = sessaoFalsa({
      configuracao: configuracaoDaEntrada({
        auth_google_button_text: "Da configuração",
      }),
    });
    await montar({ sessao, marca });
    expect($("googleLoginText").textContent).toBe("Da configuração");
  });

  it("sem rodapé configurado, o bloco institucional não aparece", async () => {
    await montar();
    expect(document.querySelector(".login-cogip")).toBeNull();
  });

  it("logo que não carrega some", async () => {
    await montar();
    await act(async () => $("loginLogo").dispatchEvent(new Event("error")));
    expect($("loginLogo").hidden).toBe(true);
  });

  it("Google desligado nas configurações: sem botão", async () => {
    await montar({
      sessao: sessaoFalsa({
        configuracao: configuracaoDaEntrada({ auth_google_enabled: "false" }),
      }),
    });
    expect($("googleLoginBtn")).toBeNull();
  });

  it("o botão chama a sessão e fica ocupado enquanto entra", async () => {
    const { sessao } = await montar();
    await clicar($("googleLoginBtn"));
    expect(sessao.entrarComGoogle).toHaveBeenCalled();
    await act(async () =>
      sessao.definir({
        entrando: true,
        mensagem: { texto: "Escolha sua conta.", tom: "warn" },
      }),
    );
    expect($("googleLoginBtn").disabled).toBe(true);
    expect($("googleLoginBtn").getAttribute("aria-busy")).toBe("true");
    expect($("googleLoginText").textContent).toBe(TEXTO_DO_BOTAO_OCUPADO);
    expect($("loginMsg").className).toBe("alert warn");
    expect($("loginMsg").textContent).toBe("Escolha sua conta.");
  });

  it("sem as variáveis do Supabase: o aviso de configuração", async () => {
    await montar({
      sessao: sessaoFalsa({ erroDeConfiguracao: "Configure o Supabase." }),
    });
    expect($("configMsg").textContent).toBe("Configure o Supabase.");
    expect($("configMsg").getAttribute("role")).toBe("alert");
  });

  it("não usa innerHTML: texto do banco entra como texto", async () => {
    const marca = criarMarcaDaEntrada();
    await montar({ marca });
    await act(async () =>
      marca.definir({ saudacao: "<img src=x onerror=alert(1)>" }),
    );
    expect($("loginGreeting").textContent).toBe("<img src=x onerror=alert(1)>");
    expect($("loginGreeting").querySelector("img")).toBeNull();
  });
});

describe("a fase da sessão na página", () => {
  it("conectado: a tela de acesso some; deslogado: volta", async () => {
    const { sessao } = await montar();
    expect($("loginScreen").classList.contains("hidden")).toBe(false);
    await act(async () => sessao.definir({ fase: FASES.CONECTADO }));
    expect($("loginScreen").classList.contains("hidden")).toBe(true);
    await act(async () => sessao.definir({ fase: FASES.DESLOGADO }));
    expect($("loginScreen").classList.contains("hidden")).toBe(false);
  });

  it("sem acesso: modo do pedido, cartão e carga do pedido (uma vez por pessoa)", async () => {
    const { sessao, pedido } = await montar();
    const usuario = { id: "u1", email: "u1@agenciasus.org.br" };
    await act(async () =>
      sessao.definir({
        fase: FASES.SEM_ACESSO,
        usuario,
        consultarPedido: true,
      }),
    );
    expect(document.body.classList.contains("access-request-mode")).toBe(true);
    expect($("accessRequestCard")).not.toBeNull();
    expect(pedido.carregar).toHaveBeenCalledWith({ usuario, consultar: true });

    await act(async () =>
      sessao.definir({ mensagem: { texto: "x", tom: "warn" } }),
    );
    expect(pedido.carregar).toHaveBeenCalledTimes(1);

    // Outra conta no meio do pedido: carrega de novo, para ela.
    const outra = { id: "u2", email: "u2@agenciasus.org.br" };
    await act(async () => sessao.definir({ usuario: outra }));
    expect(pedido.carregar).toHaveBeenLastCalledWith({
      usuario: outra,
      consultar: true,
    });

    await act(async () =>
      sessao.definir({ fase: FASES.DESLOGADO, usuario: null }),
    );
    expect(document.body.classList.contains("access-request-mode")).toBe(false);
    expect($("accessRequestCard")).toBeNull();
    expect(pedido.limpar).toHaveBeenCalled();
  });

  it("ligar e desligar não deixa assinatura para trás", () => {
    const sessao = sessaoFalsa();
    const desligar = ligarEntradaAPagina({ sessao, pedido: pedidoFalso() });
    desligar();
    sessao.definir({ fase: FASES.CONECTADO });
    expect($("loginScreen").classList.contains("hidden")).toBe(false);
  });
});
