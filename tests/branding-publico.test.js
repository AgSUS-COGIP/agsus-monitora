import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buscarMarcaPublica,
  mapearBrandingPublico,
} from "../src/lib/access-branding-publico.js";
import {
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

  it("uma falha não escreve no cache", async () => {
    guardarMarca(IDENTIDADE_ATUAL);
    const antes = lerMarcaGuardada();
    await atualizarMarcaComBrandingPublico(document);
    expect(lerMarcaGuardada()).toEqual(antes);
  });
});
