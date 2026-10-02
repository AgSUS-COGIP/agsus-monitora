import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarConfiguracoes } from "../../src/componentes/configuracoes/configuracoes.jsx";
import { criarEstadoDasConfiguracoes } from "../../src/componentes/configuracoes/estado.js";
import {
  criarImagensDaAparencia,
  EVENTO_FUNDO_DO_ACESSO,
} from "../../src/componentes/configuracoes/imagens.js";
import {
  abrirSecaoDeConfiguracao,
  organizarConfiguracoesEmSecoes,
} from "../../src/modules/config-secoes.js";
import { clicar, digitar, escolher, esperar } from "./interacoes.js";

/*
  Configurações › Página inicial, Tela de acesso e Aparência em React (etapa
  3 da arquitetura). Antes eram campos `cfg*` do index.html: o estado lia o
  DOM para publicar, config-apresentacao.js montava grupos e prévias por
  createElement, aviso-de-contraste.js desenhava com innerHTML e
  sidebar-branding.js injetava o bloco da barra lateral. Agora os valores
  vêm do estado (o legado publica em loadConfig) e a publicação manda as
  mesmas chaves, com as mesmas descrições e a mesma normalização de antes.
*/

// O que já está publicado (a tela carregada é igual ao banco).
const PUBLICADO = {
  page_title: "Saúde Indígena",
  page_subtitle: "Monitoramento DSEI/CASAI",
  broadcast_type: "info",
  broadcast_msg: "",
  auth_google_enabled: "true",
  auth_google_button_text: "Entrar com a conta AgSUS",
  auth_google_domain_hint: "agenciasus.org.br",
  auth_google_allowed_domains: "agenciasus.org.br,agsus.org.br",
  auth_access_greeting: "Olá!",
  auth_access_background_url: "https://cdn.test/branding/acesso-1.webp",
  auth_access_background_path: "branding/acesso-1.webp",
  auth_access_logo_url: "https://cdn.test/logo.png",
  auth_access_panel_color: "#c090eb",
  auth_access_texto_modo: "auto",
  ui_sidebar_logo_url: "/assets/agsus-logo.webp",
  ui_sidebar_background_color: "#ffffff",
};

const snapshot = (config = PUBLICADO) => ({
  configuracoes: Object.entries(config).map(([chave, valor]) => ({
    chave,
    valor,
  })),
  paineis: [],
});

let cliente;
let armazenamento;
let controlador;
let confirmar;
let avisar;

function criarCliente() {
  armazenamento = {
    list: vi.fn(async (pasta) => ({
      data:
        pasta === "branding"
          ? [
              { name: "acesso-1.webp" },
              { name: "acesso-2.png" },
              { name: "sidebar" },
            ]
          : [{ name: "logo-a.png" }, { name: "outra.txt" }],
      error: null,
    })),
    upload: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
    getPublicUrl: (caminho) => ({
      data: { publicUrl: `https://cdn.test/${caminho}` },
    }),
  };
  return {
    rpc: vi.fn(async (nome, argumentos) => {
      if (nome === "get_configuracoes_historico")
        return { data: [], error: null };
      if (nome === "definir_fundo_acesso_monitora")
        return {
          data: { url: argumentos.p_url, caminho: argumentos.p_caminho },
          error: null,
        };
      if (nome === "salvar_configuracoes_e_paineis_v2")
        return { data: { ok: true, total_alteracoes: 1 }, error: null };
      return { data: snapshot(), error: null };
    }),
    storage: { from: () => armazenamento },
  };
}

async function montar({ secao = "inicio", config = PUBLICADO } = {}) {
  document.body.innerHTML = `
    <img id="sideLogo" src="/assets/agsus-logo.webp" alt="" />
    <section id="page-config" class="page active">
      <div id="configuracoesApp" data-configuracoes></div>
      <div class="admin-grid"></div>
    </section>`;
  organizarConfiguracoesEmSecoes(document);
  abrirSecaoDeConfiguracao(document, secao);
  const estado = criarEstadoDasConfiguracoes({
    supabase: () => cliente,
    confirmar: (mensagem) => confirmar(mensagem),
    alertar: vi.fn(),
    recarregar: vi.fn(),
  });
  const imagens = criarImagensDaAparencia({
    supabase: () => cliente,
    configuracoes: estado,
    avisar: (...args) => avisar(...args),
    confirmar: (mensagem) => confirmar(mensagem),
  });
  await act(async () => {
    controlador = montarConfiguracoes({ estado, imagens });
  });
  await act(async () => estado.definirValoresCarregados(config));
  await esperar();
  return estado;
}

const $ = (id) => document.getElementById(id);
const salvar = () => document.querySelector(".config-barra__salvar");
const sujo = () =>
  Boolean(document.querySelector(".config-cabecalho__pendente"));
const tituloDoDialogo = () => $("configGovernanceTitle")?.textContent;
const secao = (id) =>
  document.querySelector(`.config-secao[data-secao="${id}"]`);
const previa = (id) => secao(id).querySelector(".config-previa__conteudo");

async function publicar(motivo = "Ajuste") {
  await clicar(salvar());
  await esperar();
  expect(tituloDoDialogo()).toBe("Revisar publicação");
  await digitar($("configPublishReason"), motivo);
  await clicar(
    [...document.querySelectorAll(".config-governance-footer .btn")].at(-1),
  );
  await esperar();
  return cliente.rpc.mock.calls.find(
    ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
  )?.[1];
}

const linhasPorChave = (chamada) =>
  new Map(chamada.p_config_rows.map((linha) => [linha.chave, linha]));

beforeEach(() => {
  cliente = criarCliente();
  confirmar = vi.fn(() => true);
  avisar = vi.fn();
});
afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--sidebar-custom-bg");
});

describe("o estado não depende mais do DOM legado", () => {
  it("as três seções desenham no corpo da própria seção, sem campo cfg*", async () => {
    await montar();
    for (const id of ["inicio", "acesso", "aparencia"])
      expect(secao(id).querySelector(".config-secao-react"), id).not.toBeNull();
    expect(document.querySelectorAll('[id^="cfg"]')).toHaveLength(0);
  });

  it("a publicação manda as mesmas chaves e descrições de antes, uma vez cada", async () => {
    await montar();
    await digitar($("configInicio-pageTitle"), "Novo título");
    const linhas = linhasPorChave(await publicar());
    const ESPERADO = {
      page_title: "Título da página inicial",
      page_subtitle: "Subtítulo da página inicial",
      auth_google_enabled: "Exibe ou oculta o login com Google",
      auth_google_button_text: "Texto do botão de autenticação Google",
      auth_google_domain_hint: "Domínio sugerido no login Google",
      auth_google_allowed_domains: "Domínios institucionais autorizados",
      auth_access_background_url: "Arte institucional da tela de acesso",
      auth_access_background_path:
        "Caminho da arte institucional da tela de acesso",
      auth_access_logo_url: "Logo da AgSUS na tela de acesso",
      auth_access_panel_color: "Cor do painel da tela de acesso",
      auth_access_texto_modo: "Texto sobre o painel de acesso",
      auth_access_greeting: "Saudação da tela de acesso",
      filter_title: "Título dos filtros",
      filter_subtitle: "Subtítulo dos filtros",
      filter_toggle_show: "Texto para mostrar filtros",
      filter_toggle_hide: "Texto para ocultar filtros",
      kpi_vagas_label: "Rótulo do KPI vagas imediatas",
      kpi_contratadas_label: "Rótulo do KPI contratadas",
      kpi_em_selecao_label: "Rótulo do KPI em seleção",
      kpi_ociosas_label: "Rótulo do KPI vagas ociosas",
      kpi_cadastro_reserva_label: "Rótulo do KPI cadastro reserva",
      kpi_criticos_label: "Rótulo do KPI críticos",
      kpi_inscritos_label: "Rótulo do KPI inscritos",
      broadcast_type: "Tipo do aviso global",
      broadcast_msg: "Mensagem do aviso global",
      ui_sidebar_logo_url:
        "Logo independente da barra lateral do AgSUS Monitora",
      ui_sidebar_background_color:
        "Cor de fundo da barra lateral do AgSUS Monitora",
    };
    for (const [chave, descricao] of Object.entries(ESPERADO))
      expect(linhas.get(chave)?.descricao, chave).toBe(descricao);
    expect(linhas.get("page_title").valor).toBe("Novo título");
    expect(linhas.get("auth_access_greeting").valor).toBe("Olá!");
    const chaves = cliente.rpc.mock.calls
      .find(([nome]) => nome === "salvar_configuracoes_e_paineis_v2")[1]
      .p_config_rows.map((linha) => linha.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("chave ausente no banco: o padrão que o formulário legado mostrava", async () => {
    await montar({ config: { page_title: "Painel" } });
    await digitar($("configInicio-pageSubtitle"), "x");
    const linhas = linhasPorChave(await publicar());
    const valor = (chave) => linhas.get(chave).valor;
    expect(valor("broadcast_type")).toBe("info");
    expect(valor("auth_google_enabled")).toBe("true");
    expect(valor("auth_google_allowed_domains")).toBe(
      "agenciasus.org.br,agsus.org.br",
    );
    expect(valor("auth_access_greeting")).toBe("Bem-vindo(a) ao MONITORA");
    expect(valor("auth_access_panel_color")).toBe("#c296eb");
    expect(valor("auth_access_texto_modo")).toBe("auto");
    expect(valor("auth_access_logo_url")).toMatch(
      /\/assets\/agsus-logo\.webp$/,
    );
    expect(valor("auth_access_background_url")).toMatch(
      /\/assets\/access-background-default\.svg$/,
    );
    expect(valor("auth_access_background_path")).toBe("");
    expect(valor("ui_sidebar_logo_url")).toBe("/assets/agsus-logo.webp");
    expect(valor("ui_sidebar_background_color")).toBe("#ffffff");
  });
});

describe("Página inicial", () => {
  it("a prévia acompanha o que se digita, como texto (nada de HTML)", async () => {
    await montar();
    expect(previa("inicio").textContent).toContain("Saúde Indígena");
    expect(previa("inicio").querySelector(".previa-aviso")).toBeNull();
    await escolher($("configInicio-broadcastType"), "danger");
    await digitar(
      $("configInicio-broadcastMsg"),
      "<img src=x onerror=alert(1)>Manutenção às 18h",
    );
    const aviso = previa("inicio").querySelector(
      '.previa-aviso[data-tom="danger"]',
    );
    expect(aviso.textContent).toContain("Crítico: <img src=x");
    expect(previa("inicio").querySelector("img")).toBeNull();
    await digitar($("configInicio-kpiVagasLabel"), "Postos");
    const kpis = previa("inicio").querySelectorAll(".ui-kpi");
    expect(kpis).toHaveLength(7);
    expect(kpis[0].textContent).toContain("Postos");
    expect(sujo()).toBe(true);
  });

  it("título em branco não publica e aponta o campo", async () => {
    await montar();
    await digitar($("configInicio-pageTitle"), "  ");
    cliente.rpc.mockClear();
    await clicar(salvar());
    expect(cliente.rpc).not.toHaveBeenCalled();
    expect(tituloDoDialogo()).toBe("Corrigir configurações");
    expect(document.body.textContent).toContain(
      "Informe o título da página inicial.",
    );
    expect($("configInicio-pageTitle").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("sair com alteração pergunta; aceito, descarta e o campo volta ao publicado", async () => {
    const estado = await montar();
    await digitar($("configInicio-filterTitle"), "Refinar");
    expect(estado.confirmarSaida(() => false)).toBe(false);
    await act(async () => expect(estado.confirmarSaida(() => true)).toBe(true));
    expect($("configInicio-filterTitle").value).toBe("");
    expect(sujo()).toBe(false);
  });
});

describe("Tela de acesso", () => {
  it("prévia com saudação, slogan e botão do Google; desligado, sem botão", async () => {
    await montar({ secao: "acesso" });
    const texto = () => previa("acesso").textContent;
    expect(texto()).toContain("Olá!");
    expect(texto()).toContain("Monitoramento de Processos Seletivos");
    expect(texto()).toContain("Entrar com a conta AgSUS");
    await digitar($("configAcesso-authAccessGreeting"), "Bem-vindo");
    expect(texto()).toContain("Bem-vindo");
    await escolher($("configAcesso-authGoogleEnabled"), "false");
    expect(previa("acesso").querySelector(".previa-acesso__google")).toBeNull();
    expect(texto()).toContain("Login Google desligado");
  });

  it("desligar o Google pede confirmação; recusado, não publica", async () => {
    await montar({ secao: "acesso" });
    await escolher($("configAcesso-authGoogleEnabled"), "false");
    confirmar.mockReturnValue(false);
    cliente.rpc.mockClear();
    await clicar(salvar());
    expect(confirmar).toHaveBeenCalledWith(
      expect.stringContaining("O login Google será desativado"),
    );
    expect(cliente.rpc).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    const linhas = linhasPorChave(await publicar());
    expect(linhas.get("auth_google_enabled").valor).toBe("false");
  });

  it("com o Google já desligado no banco, salvar outra coisa não pergunta de novo", async () => {
    await montar({
      secao: "acesso",
      config: { ...PUBLICADO, auth_google_enabled: "false" },
    });
    await digitar($("configAcesso-authAccessGreeting"), "Oi");
    await publicar();
    expect(confirmar).not.toHaveBeenCalledWith(
      expect.stringContaining("O login Google será desativado"),
    );
  });

  it("domínio sugerido fora do formato é recusado com a mensagem de antes", async () => {
    await montar({ secao: "acesso" });
    await digitar(
      $("configAcesso-authGoogleDomainHint"),
      "https://agsus.org.br",
    );
    await clicar(salvar());
    expect(tituloDoDialogo()).toBe("Corrigir configurações");
    expect(document.body.textContent).toContain(
      "O domínio Google deve estar no formato agenciasus.org.br, sem https://, @ ou barras.",
    );
  });

  it("domínios permitidos chegam normalizados (minúsculas, sem @, sem repetição)", async () => {
    await montar({
      secao: "acesso",
      config: {
        ...PUBLICADO,
        auth_google_allowed_domains:
          " @AgenciaSUS.org.br, agsus.org.br,agsus.org.br",
      },
    });
    expect($("configAcesso-authGoogleAllowedDomains").value).toBe(
      "agenciasus.org.br,agsus.org.br",
    );
  });
});

describe("Aparência", () => {
  it("a cor do painel mostra o contraste e reage ao modo do texto", async () => {
    await montar({ secao: "aparencia" });
    const contraste = () =>
      secao("aparencia").querySelector(".config-contraste").textContent;
    expect(contraste()).toContain("Acima do mínimo de 4.5");
    expect(contraste()).toContain("5.88");
    await escolher($("configAparencia-authAccessTextoModo"), "claro");
    expect(contraste()).toContain("Abaixo do mínimo de 4.5");
    // A prévia da tela de acesso usa a cor e o texto escolhidos.
    const cartao = previa("aparencia").querySelector(".previa-acesso__cartao");
    expect(cartao.style.background).not.toBe("");
  });

  it("logo do acesso com endereço inválido não publica", async () => {
    await montar({ secao: "aparencia" });
    await digitar(
      $("configAparencia-authAccessLogoUrl"),
      "javascript:alert(1)",
    );
    await clicar(salvar());
    expect(tituloDoDialogo()).toBe("Corrigir configurações");
    expect(document.body.textContent).toContain(
      "URL inválida no campo Logo da AgSUS no acesso.",
    );
  });

  it("a cor da barra no rascunho pinta a barra de verdade; descartada, volta", async () => {
    const estado = await montar({ secao: "aparencia" });
    const corDaBarra = () =>
      document.documentElement.style.getPropertyValue("--sidebar-custom-bg");
    await digitar($("configAparencia-uiSidebarBackgroundColor"), "#102a43");
    expect(corDaBarra()).toBe("#102a43");
    expect(document.body.classList.contains("sidebar-theme-dark")).toBe(true);
    expect(
      secao("aparencia").querySelectorAll(".config-contraste"),
    ).toHaveLength(2);
    await act(async () => estado.confirmarSaida(() => true));
    expect(corDaBarra()).toBe("#ffffff");
  });

  it("galeria de artes: a em uso sem Apagar; usar outra aplica na hora", async () => {
    const ouvidos = [];
    document.addEventListener(EVENTO_FUNDO_DO_ACESSO, (e) =>
      ouvidos.push(e.detail),
    );
    await montar({ secao: "aparencia" });
    await esperar();
    const cartoes = secao("aparencia").querySelectorAll(
      '[data-formato="paisagem"] .config-galeria__cartao',
    );
    // A subpasta "sidebar" não é imagem.
    expect(cartoes).toHaveLength(2);
    expect(cartoes[0].textContent).toContain("Em uso");
    expect(cartoes[0].querySelector(".config-galeria__apagar")).toBeNull();
    await clicar(cartoes[1].querySelector(".config-galeria__item"));
    await esperar();
    expect(cliente.rpc).toHaveBeenCalledWith("definir_fundo_acesso_monitora", {
      p_url: "https://cdn.test/branding/acesso-2.png",
      p_caminho: "branding/acesso-2.png",
    });
    expect(ouvidos.at(-1)).toEqual({
      url: "https://cdn.test/branding/acesso-2.png",
      caminho: "branding/acesso-2.png",
    });
    expect(avisar).toHaveBeenCalledWith("Arte aplicada à tela de acesso.");
    // Aplicada na hora: não fica pendente para "Salvar alterações".
    expect(sujo()).toBe(false);
    const depois = secao("aparencia").querySelectorAll(
      '[data-formato="paisagem"] .config-galeria__cartao',
    );
    expect(depois[1].textContent).toContain("Em uso");
  });

  it("apagar uma arte pede confirmação e remove do armazenamento", async () => {
    await montar({ secao: "aparencia" });
    await esperar();
    const apagar = secao("aparencia").querySelector(
      '[data-formato="paisagem"] .config-galeria__apagar',
    );
    confirmar.mockReturnValueOnce(false);
    await clicar(apagar);
    expect(armazenamento.remove).not.toHaveBeenCalled();
    await clicar(apagar);
    await esperar();
    expect(armazenamento.remove).toHaveBeenCalledWith([
      "branding/acesso-2.png",
    ]);
    expect(avisar).toHaveBeenCalledWith("Arte apagada.");
  });

  it("enviar uma arte: guarda, grava e, se a gravação falha, apaga o arquivo", async () => {
    await montar({ secao: "aparencia" });
    const arquivo = new File(["x"], "arte.png", { type: "image/png" });
    const entrada = $("configAparencia-arteArquivo");
    const escolherArquivo = async (lista) => {
      Object.defineProperty(entrada, "files", {
        value: lista,
        configurable: true,
      });
      await act(async () => {
        entrada.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await esperar();
    };
    await escolherArquivo([new File(["x"], "a.gif", { type: "image/gif" })]);
    expect(avisar).toHaveBeenCalledWith(
      "Use uma imagem JPG, PNG ou WEBP.",
      "warn",
    );
    expect(armazenamento.upload).not.toHaveBeenCalled();

    await escolherArquivo([arquivo]);
    expect(armazenamento.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^branding\/acesso-.+\.png$/),
      arquivo,
      expect.objectContaining({ upsert: false }),
    );
    expect(avisar).toHaveBeenCalledWith(
      "Imagem guardada e aplicada à tela de acesso.",
    );

    cliente.rpc.mockImplementationOnce(async () => ({
      data: null,
      error: { message: "sem permissão" },
    }));
    await escolherArquivo([arquivo]);
    expect(armazenamento.remove).toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(
      "Não foi possível guardar a imagem: sem permissão",
      "error",
    );
  });

  it("logo da barra: enviar guarda o arquivo e a escolha vai na publicação", async () => {
    await montar({ secao: "aparencia" });
    await esperar();
    const logos = secao("aparencia").querySelectorAll(
      '[data-formato="quadrado"] .config-galeria__cartao',
    );
    // Só as logo-*.png|jpg|webp.
    expect(logos).toHaveLength(1);
    await clicar(logos[0].querySelector(".config-galeria__item"));
    expect(secao("aparencia").textContent).toContain(
      "Logo selecionada. Clique em Salvar alterações para publicar.",
    );
    expect(sujo()).toBe(true);
    // A barra lateral de verdade já mostra a escolha.
    expect($("sideLogo").getAttribute("src")).toBe(
      "https://cdn.test/branding/sidebar/logo-a.png",
    );
    // A selecionada não pode ser apagada.
    expect(
      secao("aparencia").querySelector(
        '[data-formato="quadrado"] .config-galeria__apagar',
      ),
    ).toBeNull();
    const linhas = linhasPorChave(await publicar());
    expect(linhas.get("ui_sidebar_logo_url").valor).toBe(
      "https://cdn.test/branding/sidebar/logo-a.png",
    );
  });

  it("restaurar a logo padrão fica pendente até salvar", async () => {
    await montar({
      secao: "aparencia",
      config: {
        ...PUBLICADO,
        ui_sidebar_logo_url: "https://cdn.test/branding/sidebar/logo-a.png",
      },
    });
    const restaurar = [
      ...secao("aparencia").querySelectorAll(".config-imagem .btn"),
    ].filter((b) => b.textContent.includes("Restaurar padrão"))[1];
    await clicar(restaurar);
    expect(sujo()).toBe(true);
    expect(
      secao("aparencia").querySelector(".config-imagem__previa--logo").src,
    ).toMatch(/\/assets\/agsus-logo\.webp$/);
  });
});

describe("regras do código", () => {
  const arquivos = [
    "pagina-inicial.jsx",
    "tela-de-acesso.jsx",
    "aparencia.jsx",
    "partes.jsx",
    "imagens.js",
    "estado.js",
  ].map((nome) =>
    readFileSync(`src/componentes/configuracoes/${nome}`, "utf8"),
  );

  it("sem innerHTML, sem dangerouslySetInnerHTML e sem ler campos cfg* do DOM", () => {
    for (const fonte of arquivos) {
      expect(fonte).not.toMatch(/innerHTML|dangerouslySetInnerHTML/);
      expect(fonte).not.toMatch(/getElementById\(\s*["']cfg/);
    }
  });

  it("o legado não tem mais a marcação nem o código das três seções", () => {
    const html = readFileSync("index.html", "utf8");
    const app = readFileSync("src/modules/legacy-app.js", "utf8");
    for (const id of [
      "cfgPageTitle",
      "cfgBroadcastMsg",
      "cfgGoogleEnabled",
      "cfgAccessGreeting",
      "cfgAccessPanelColor",
      "cfgAccessBackgroundGallery",
      "cfgLoginLogo",
    ])
      expect(html, id).not.toContain(`id="${id}"`);
    for (const nome of [
      "function renderConfigForm",
      "function uploadAccessBackground",
      "function loadAccessBackgroundGallery",
      "function previewImg",
    ])
      expect(app, nome).not.toContain(nome);
  });
});
