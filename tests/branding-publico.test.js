import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buscarMarcaPublica,
  mapearBrandingPublico,
} from "../src/lib/access-branding-publico.js";
import {
  aplicarCorDoPainel,
  aplicarMarcaGuardadaNoArranque,
  aplicarMarcaNaTela,
  atualizarMarcaComBrandingPublico,
} from "../src/lib/access-branding-boot.js";
import {
  guardarMarca,
  lerMarcaGuardada,
} from "../src/lib/access-branding-cache.js";

const URL_FALSA = "https://exemplo.supabase.co";
const CHAVE_PUBLICA = "sb_publishable_chave_de_teste";

/*
  O que a RPC devolve para uma instituição que configurou a sua identidade. A
  migration monta esta resposta por lista de chaves no próprio SQL — nunca
  `select *`.
*/
const RESPOSTA_DA_RPC = {
  auth_access_background_url: "https://exemplo.org/agosto-lilas.jpg",
  auth_access_logo_url: "https://exemplo.org/logo.png",
  auth_access_panel_color: "#ffffff",
  auth_access_greeting: "Bem-vindo ao Agosto Lilás",
  auth_access_instruction: "Entre com sua conta institucional.",
  auth_google_button_text: "Entrar com Google institucional",
};

const IDENTIDADE_ATUAL = {
  backgroundUrl: "https://exemplo.org/agosto-lilas.jpg",
  logoUrl: "https://exemplo.org/logo.png",
  panelColor: "#ffffff",
  greeting: "Bem-vindo ao Agosto Lilás",
  instruction: "Entre com sua conta institucional.",
  buttonText: "Entrar com Google institucional",
};

const MARCA_ANTIGA = {
  backgroundUrl: "https://exemplo.org/campanha-do-ano-passado.jpg",
  panelColor: "#c296eb",
  greeting: "Saudação antiga",
};

/*
  Um JWT expirado e indecifrável, do formato que o PostgREST recusa com
  `401 PGRST301` — "None of the keys was able to decode the JWT". É o estado em
  que uma sessão corrompida deixa o armazenamento.
*/
function jwtExpirado() {
  const b64 = (o) =>
    btoa(JSON.stringify(o))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const exp = Math.floor(Date.now() / 1000) - 7200;
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      sub: "00000000-0000-0000-0000-000000000000",
      role: "authenticated",
      exp,
    }),
    "assinatura-invalida",
  ].join(".");
}

function semearSessao(token) {
  localStorage.setItem(
    "agsus-monitora-auth",
    JSON.stringify({
      access_token: token,
      token_type: "bearer",
      refresh_token: "r",
    }),
  );
}

/** Espião de `fetch` que regista o cabeçalho realmente enviado. */
function fetchQue(resultado) {
  const chamadas = [];
  const buscar = vi.fn(async (url, opcoes) => {
    chamadas.push({ url, headers: opcoes?.headers || {} });
    if (resultado instanceof Error) throw resultado;
    return resultado;
  });
  buscar.chamadas = chamadas;
  return buscar;
}

const respostaOk = (corpo) => ({
  ok: true,
  status: 200,
  json: async () => corpo,
});
const respostaErro = (status) => ({
  ok: false,
  status,
  json: async () => ({}),
});

const buscarCom = (buscar) =>
  buscarMarcaPublica({ buscar, url: URL_FALSA, chave: CHAVE_PUBLICA });

function montarTelaDeAcesso() {
  document.body.innerHTML = `
    <div id="loginScreen">
      <img id="loginLogo" src="" alt="" />
      <h1 id="loginGreeting"></h1>
      <p id="loginDescription"></p>
      <button><span id="googleLoginText"></span></button>
    </div>`;
}

function identidadeNaTela() {
  const tela = document.getElementById("loginScreen");
  return {
    fundo: tela.style.getPropertyValue("--login-background-image"),
    painel: tela.style.getPropertyValue("--login-panel-color"),
    logo: document.getElementById("loginLogo").getAttribute("src"),
    saudacao: document.getElementById("loginGreeting").textContent,
    instrucao: document.getElementById("loginDescription").textContent,
    botao: document.getElementById("googleLoginText").textContent,
  };
}

beforeEach(() => {
  localStorage.clear();
  montarTelaDeAcesso();
});
afterEach(() => localStorage.clear());

describe("tradução da resposta da RPC", () => {
  it("mapeia as seis chaves públicas para os campos do cache", () => {
    expect(mapearBrandingPublico(RESPOSTA_DA_RPC)).toEqual(IDENTIDADE_ATUAL);
  });

  /*
    Segunda barreira. A lista no SQL já impede que outra chave seja lida; se
    ainda assim algo chegasse, não passaria daqui para o cache nem para a tela.
  */
  it("descarta qualquer campo fora da lista", () => {
    const marca = mapearBrandingPublico({
      ...RESPOSTA_DA_RPC,
      smtp_password: "segredo",
      auth_google_allowed_domains: "agenciasus.org.br",
      monit_id: "referência interna",
    });
    expect(marca).toEqual(IDENTIDADE_ATUAL);
    expect(JSON.stringify(marca)).not.toContain("segredo");
  });

  it("devolve null quando não sobra nada de útil", () => {
    expect(mapearBrandingPublico({})).toBeNull();
    expect(mapearBrandingPublico(null)).toBeNull();
    expect(mapearBrandingPublico([])).toBeNull();
    expect(mapearBrandingPublico({ auth_access_greeting: "   " })).toBeNull();
  });
});

/*
  O ponto central desta correção, em duas partes.

  A chamada é pública e não pode depender de haver — ou não haver — sessão válida
  no armazenamento. E a credencial pública não pode viajar em `Authorization`:
  esse cabeçalho é o lugar do JWT de quem está autenticado, e uma chave
  `sb_publishable_…` não é um JWT. O gateway identifica a aplicação pela `apikey`.

  Medido no banco real em 09/09/2026:

    cabeçalhos                      GET /configuracoes    POST /rpc/…
    só apikey                       200, dez chaves       404 PGRST202
    apikey + Bearer <chave>         200, dez chaves       404 PGRST202
    apikey + Bearer <JWT expirado>  401 PGRST301          401 PGRST301
*/
describe("os cabeçalhos da chamada pública", () => {
  const cabecalhosDe = (buscar) => buscar.chamadas[0].headers;

  it("envia apikey", async () => {
    const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
    await buscarCom(buscar);
    expect(cabecalhosDe(buscar).apikey).toBe(CHAVE_PUBLICA);
  });

  /*
    A regressão que esta correção fecha: a chave publicável ia também em
    `Authorization: Bearer`, fingindo-se de identidade de utilizador.
  */
  it("NÃO envia Authorization", async () => {
    const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
    await buscarCom(buscar);
    const cabecalhos = cabecalhosDe(buscar);
    expect(cabecalhos).not.toHaveProperty("Authorization");
    expect(cabecalhos).not.toHaveProperty("authorization");
    expect(JSON.stringify(cabecalhos)).not.toContain("Bearer");
  });

  it("JWT inválido no armazenamento não altera os cabeçalhos", async () => {
    const token = jwtExpirado();
    semearSessao(token);

    const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
    const marca = await buscarCom(buscar);

    const cabecalhos = cabecalhosDe(buscar);
    expect(cabecalhos).toEqual({
      "Content-Type": "application/json",
      apikey: CHAVE_PUBLICA,
    });
    expect(JSON.stringify(cabecalhos)).not.toContain(token);
    expect(marca).toEqual(IDENTIDADE_ATUAL);
  });

  it("sessão válida no armazenamento também não altera os cabeçalhos", async () => {
    semearSessao("token-de-sessao-perfeitamente-valido");

    const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
    const marca = await buscarCom(buscar);

    expect(cabecalhosDe(buscar)).toEqual({
      "Content-Type": "application/json",
      apikey: CHAVE_PUBLICA,
    });
    expect(JSON.stringify(cabecalhosDe(buscar))).not.toContain(
      "token-de-sessao",
    );
    expect(marca).toEqual(IDENTIDADE_ATUAL);
  });

  it("a resposta continua filtrada pela whitelist, venha o que vier", async () => {
    const buscar = fetchQue(
      respostaOk({
        ...RESPOSTA_DA_RPC,
        smtp_password: "segredo",
        auth_google_allowed_domains: "agenciasus.org.br",
      }),
    );
    const marca = await buscarCom(buscar);
    expect(marca).toEqual(IDENTIDADE_ATUAL);
    expect(JSON.stringify(marca)).not.toContain("segredo");
  });

  it("não cria cliente Supabase: fala por fetch direto", async () => {
    const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
    await buscarCom(buscar);
    expect(buscar.chamadas[0].url).toBe(
      `${URL_FALSA}/rest/v1/rpc/obter_branding_acesso_publico`,
    );
  });
});

describe("degradação", () => {
  it("devolve null em resposta de erro, sem lançar", async () => {
    expect(await buscarCom(fetchQue(respostaErro(401)))).toBeNull();
    expect(await buscarCom(fetchQue(respostaErro(404)))).toBeNull();
  });

  it("devolve null quando a rede falha, sem lançar", async () => {
    expect(
      await buscarCom(fetchQue(new TypeError("Failed to fetch"))),
    ).toBeNull();
  });

  it("devolve null sem url ou sem chave", async () => {
    const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
    expect(
      await buscarMarcaPublica({ buscar, url: "", chave: CHAVE_PUBLICA }),
    ).toBeNull();
    expect(
      await buscarMarcaPublica({ buscar, url: URL_FALSA, chave: "" }),
    ).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("os seis cenários de identidade", () => {
  it("1. cache vazio, nenhuma sessão: recebe a identidade configurada", async () => {
    expect(lerMarcaGuardada()).toBeNull();
    expect(aplicarMarcaGuardadaNoArranque(document)).toBe(false);

    const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
    aplicarMarcaNaTela(marca, document);

    const naTela = identidadeNaTela();
    expect(naTela.fundo).toContain(IDENTIDADE_ATUAL.backgroundUrl);
    expect(naTela.painel).toBe(IDENTIDADE_ATUAL.panelColor);
    expect(naTela.logo).toBe(IDENTIDADE_ATUAL.logoUrl);
    expect(naTela.saudacao).toBe(IDENTIDADE_ATUAL.greeting);
    expect(naTela.instrucao).toBe(IDENTIDADE_ATUAL.instruction);
    expect(naTela.botao).toBe(IDENTIDADE_ATUAL.buttonText);
  });

  it("2. cache vazio com JWT inválido no armazenamento: funciona na mesma", async () => {
    semearSessao(jwtExpirado());
    expect(lerMarcaGuardada()).toBeNull();

    const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
    expect(marca).toEqual(IDENTIDADE_ATUAL);
    aplicarMarcaNaTela(marca, document);
    expect(identidadeNaTela().saudacao).toBe(IDENTIDADE_ATUAL.greeting);
  });

  /*
    Com cache válido e sessão corrompida, a única coisa proibida é regredir ao
    padrão. Atualizar para a identidade atual é bom; manter a guardada é aceitável.
  */
  it("3. cache válido com JWT inválido: nunca volta ao padrão", async () => {
    guardarMarca(MARCA_ANTIGA);
    semearSessao(jwtExpirado());
    aplicarMarcaGuardadaNoArranque(document);

    const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
    guardarMarca(marca);
    aplicarMarcaNaTela(marca, document);

    const naTela = identidadeNaTela();
    expect(naTela.saudacao).toBe(IDENTIDADE_ATUAL.greeting);
    expect(naTela.saudacao).not.toBe("Seja bem-vindo(a) à AgSUS");
    expect(lerMarcaGuardada().backgroundUrl).toBe(
      IDENTIDADE_ATUAL.backgroundUrl,
    );
  });

  it("4. sessão autenticada válida: o branding também funciona", async () => {
    semearSessao("token-valido");
    const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
    expect(marca).toEqual(IDENTIDADE_ATUAL);
  });

  it("5. RPC fora do ar com cache válido: o cache permanece", async () => {
    guardarMarca(IDENTIDADE_ATUAL);
    aplicarMarcaGuardadaNoArranque(document);

    const marca = await buscarCom(fetchQue(new TypeError("Failed to fetch")));
    expect(marca).toBeNull();

    expect(lerMarcaGuardada()).toEqual(IDENTIDADE_ATUAL);
    expect(identidadeNaTela().saudacao).toBe(IDENTIDADE_ATUAL.greeting);
  });

  it("6. RPC fora do ar sem cache: neutro, nunca a arte antiga", async () => {
    expect(aplicarMarcaGuardadaNoArranque(document)).toBe(false);

    const marca = await buscarCom(fetchQue(respostaErro(404)));
    expect(marca).toBeNull();
    expect(aplicarMarcaNaTela(marca, document)).toBe(false);

    const naTela = identidadeNaTela();
    expect(naTela.fundo).toBe("");
    expect(naTela.painel).toBe("");
    expect(naTela.saudacao).toBe("");
    expect(lerMarcaGuardada()).toBeNull();
  });
});

describe("cache antigo é substituído pela identidade atual", () => {
  it("a RPC nova atualiza o que estava guardado", async () => {
    guardarMarca(MARCA_ANTIGA);
    aplicarMarcaGuardadaNoArranque(document);
    expect(identidadeNaTela().saudacao).toBe(MARCA_ANTIGA.greeting);

    const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
    guardarMarca(marca);
    aplicarMarcaNaTela(marca, document);

    expect(identidadeNaTela().saudacao).toBe(IDENTIDADE_ATUAL.greeting);
    expect(lerMarcaGuardada()).toEqual({
      ...MARCA_ANTIGA,
      ...IDENTIDADE_ATUAL,
    });
  });

  /*
    O `fetch` é substituído explicitamente. Sem isso, o teste dependeria de o
    ambiente **não** ter as variáveis do Supabase — e passaria a fazer chamada
    real assim que alguém criasse um `.env.local`. Foi exatamente o que
    aconteceu durante a validação do preview: a suíte começou a falar com
    produção e a gravar a marca verdadeira no cache.
  */
  it("uma falha não escreve no cache", async () => {
    guardarMarca(IDENTIDADE_ATUAL);
    const antes = lerMarcaGuardada();

    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    try {
      await atualizarMarcaComBrandingPublico(document);
    } finally {
      globalThis.fetch = original;
    }

    expect(lerMarcaGuardada()).toEqual(antes);
  });
});

/*
  O contraste é derivado da cor, sempre, em qualquer caminho que a aplique.

  Antes havia duas implementações da mesma identidade: `applyConfigToUi()`
  aplicava cor **e** classe; o arranque aplicava só a cor. Na tela de acesso não
  autenticada — onde `applyConfigToUi()` nem toca na identidade, porque `anon`
  não recebe `auth_access_panel_color` — o resultado era painel escuro com texto
  escuro. Ilegível, e permanente.

  A classe nunca é guardada: `panelColor` é a única fonte de verdade.
*/
describe("cor do painel e contraste são atómicos", () => {
  const tela = () => document.getElementById("loginScreen");

  it("cor clara não recebe a classe escura", () => {
    for (const clara of ["#ffffff", "#f2f2f2", "#e1e4e5", "#c296eb"]) {
      tela().classList.add("login-panel-dark");
      aplicarCorDoPainel(tela(), clara);
      expect(tela().classList.contains("login-panel-dark"), clara).toBe(false);
      expect(tela().style.getPropertyValue("--login-panel-color")).toBe(clara);
    }
  });

  it("cor escura recebe a classe escura", () => {
    for (const escura of ["#0b2c4d", "#000000", "#102a43", "#1f2937"]) {
      tela().classList.remove("login-panel-dark");
      aplicarCorDoPainel(tela(), escura);
      expect(tela().classList.contains("login-panel-dark"), escura).toBe(true);
      expect(tela().style.getPropertyValue("--login-panel-color")).toBe(escura);
    }
  });

  it("alternar claro → escuro → claro acerta os dois sentidos", () => {
    aplicarCorDoPainel(tela(), "#ffffff");
    expect(tela().classList.contains("login-panel-dark")).toBe(false);
    aplicarCorDoPainel(tela(), "#0b2c4d");
    expect(tela().classList.contains("login-panel-dark")).toBe(true);
    aplicarCorDoPainel(tela(), "#ffffff");
    expect(tela().classList.contains("login-panel-dark")).toBe(false);
  });

  /*
    A regressão do print: F5 com cache de painel escuro abria com texto escuro,
    porque só a cor era restaurada.
  */
  it("cache com painel escuro já pinta com a classe no primeiro passo", () => {
    guardarMarca({ ...IDENTIDADE_ATUAL, panelColor: "#0b2c4d" });
    aplicarMarcaGuardadaNoArranque(document);
    expect(tela().style.getPropertyValue("--login-panel-color")).toBe(
      "#0b2c4d",
    );
    expect(tela().classList.contains("login-panel-dark")).toBe(true);
  });

  it("cache com painel claro não deixa a classe presa", () => {
    tela().classList.add("login-panel-dark");
    guardarMarca({ ...IDENTIDADE_ATUAL, panelColor: "#ffffff" });
    aplicarMarcaGuardadaNoArranque(document);
    expect(tela().classList.contains("login-panel-dark")).toBe(false);
  });

  it("marca vinda da RPC com painel escuro também aplica a classe", async () => {
    const buscar = fetchQue(
      respostaOk({ ...RESPOSTA_DA_RPC, auth_access_panel_color: "#0b2c4d" }),
    );
    const marca = await buscarCom(buscar);
    aplicarMarcaNaTela(marca, document);
    expect(tela().classList.contains("login-panel-dark")).toBe(true);
  });

  it("sem cor, nada é tocado", () => {
    tela().classList.remove("login-panel-dark");
    expect(aplicarCorDoPainel(tela(), "")).toBe(false);
    expect(aplicarCorDoPainel(null, "#0b2c4d")).toBe(false);
    expect(tela().classList.contains("login-panel-dark")).toBe(false);
  });

  /*
    O contrato que impede a regressão voltar: quem aplica a identidade não pode
    escrever a variável de cor sem passar por aqui.
  */
  it("nenhum módulo aplica a cor sem derivar o contraste", () => {
    const semComentarios = (f) =>
      readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const ficheiro of [
      "src/modules/legacy-app.js",
      "src/lib/access-branding-boot.js",
    ]) {
      const codigo = semComentarios(ficheiro);
      const escritas = (
        codigo.match(/setProperty\(\s*"--login-panel-color"/g) || []
      ).length;
      const esperado = ficheiro.endsWith("access-branding-boot.js") ? 1 : 0;
      expect(
        escritas,
        `${ficheiro} escreve a cor fora da função partilhada`,
      ).toBe(esperado);
    }
  });
});
