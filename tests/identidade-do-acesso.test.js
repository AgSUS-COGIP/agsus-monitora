import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  guardarMarca,
  lerMarcaGuardada,
} from "../src/lib/access-branding-cache.js";
import {
  aplicarMarcaGuardadaNoArranque,
  definirMarcaDaConfiguracao,
  marcaDaEntrada,
} from "../src/app/entrada/marca.js";

const MARCA_DA_INSTITUICAO = {
  backgroundUrl: "https://exemplo.org/agosto-lilas.jpg",
  panelColor: "#ffffff",
  logoUrl: "https://exemplo.org/logo-institucional.png",
  greeting: "Bem-vindo ao Agosto Lilás",
};

/* Arte e cor no `#loginScreen`; logo e saudação no estado que a tela (React) desenha. */
function montarTelaDeAcesso() {
  document.body.innerHTML = `<div id="loginScreen"></div>`;
  marcaDaEntrada.definir({ logoUrl: "", saudacao: "" });
  return document.getElementById("loginScreen");
}

function identidadeNaTela() {
  const tela = document.getElementById("loginScreen");
  return {
    backgroundImage: tela.style.getPropertyValue("--login-background-image"),
    panelColor: tela.style.getPropertyValue("--login-panel-color"),
    logo: marcaDaEntrada.obter().logoUrl,
    greeting: marcaDaEntrada.obter().saudacao,
  };
}

beforeEach(() => {
  localStorage.clear();
  montarTelaDeAcesso();
});
afterEach(() => localStorage.clear());

describe("cache da identidade", () => {
  it("guarda os quatro campos, não apenas fundo e cor", () => {
    guardarMarca(MARCA_DA_INSTITUICAO);
    expect(lerMarcaGuardada()).toEqual(MARCA_DA_INSTITUICAO);
  });

  /*
    Quem abriu a tela antes de a instrução sair tem `instruction` no cache. A
    leitura só considera os campos conhecidos: o resto da marca continua valendo
    e o campo velho some na próxima gravação.
  */
  it("cache antigo com instrução: lê o resto e descarta a instrução", () => {
    localStorage.setItem(
      "agsus_monitora_access_branding_v1",
      JSON.stringify({
        ...MARCA_DA_INSTITUICAO,
        instruction: "Acesse com sua conta institucional.",
      }),
    );
    expect(lerMarcaGuardada()).toEqual(MARCA_DA_INSTITUICAO);

    guardarMarca({ greeting: "Nova saudação" });
    const gravado = JSON.parse(
      localStorage.getItem("agsus_monitora_access_branding_v1"),
    );
    expect(gravado).not.toHaveProperty("instruction");
    expect(gravado.greeting).toBe("Nova saudação");
  });
});

describe("aplicação no arranque", () => {
  /*
    Aplicar só fundo e cor produzia tela híbrida: a arte de uma configuração com
    a saudação e o logotipo de outra. Os campos entram juntos.
  */
  it("aplica os quatro campos, sem deixar tela híbrida", () => {
    guardarMarca(MARCA_DA_INSTITUICAO);
    expect(aplicarMarcaGuardadaNoArranque(document)).toBe(true);

    const naTela = identidadeNaTela();
    expect(naTela.backgroundImage).toContain(
      MARCA_DA_INSTITUICAO.backgroundUrl,
    );
    expect(naTela.panelColor).toBe(MARCA_DA_INSTITUICAO.panelColor);
    expect(naTela.logo).toBe(MARCA_DA_INSTITUICAO.logoUrl);
    expect(naTela.greeting).toBe(MARCA_DA_INSTITUICAO.greeting);
  });

  /*
    Sem marca guardada, estado neutro: nada é pintado. A regra é não exibir uma
    identidade antiga como se fosse a configuração da instituição.
  */
  it("sem marca guardada não pinta nada", () => {
    expect(aplicarMarcaGuardadaNoArranque(document)).toBe(false);
    const naTela = identidadeNaTela();
    expect(naTela.backgroundImage).toBe("");
    expect(naTela.panelColor).toBe("");
    expect(naTela.greeting).toBe("");
  });

  /*
    O ciclo completo que a pessoa vê: primeiro carregamento, depois do logout e
    depois de recarregar precisam ser idênticos nos quatro valores.
  */
  it("login inicial = login após logout = login após reload", () => {
    guardarMarca(MARCA_DA_INSTITUICAO);

    aplicarMarcaGuardadaNoArranque(document);
    const inicial = identidadeNaTela();

    // Logout não toca no cache — nada aqui o altera.
    montarTelaDeAcesso();
    aplicarMarcaGuardadaNoArranque(document);
    const aposLogout = identidadeNaTela();

    montarTelaDeAcesso();
    aplicarMarcaGuardadaNoArranque(document);
    const aposReload = identidadeNaTela();

    expect(aposLogout).toEqual(inicial);
    expect(aposReload).toEqual(inicial);
  });
});

describe("falha ao carregar a configuração", () => {
  /*
    O defeito que chegou a produção: o caminho de erro de `loadConfig()` chamava
    `applyConfigToUi()` com a configuração vazia, os normalizadores devolviam os
    valores padrão, e `guardarMarca()` gravava-os como se fossem a identidade da
    instituição — contaminando a inicialização seguinte.
  */
  it("a última marca válida sobrevive a uma falha de carregamento", () => {
    guardarMarca(MARCA_DA_INSTITUICAO);

    // Uma falha não escreve no cache: nenhuma chamada a guardarMarca acontece.
    expect(lerMarcaGuardada()).toEqual(MARCA_DA_INSTITUICAO);

    montarTelaDeAcesso();
    aplicarMarcaGuardadaNoArranque(document);
    const naTela = identidadeNaTela();
    expect(naTela.backgroundImage).toContain(
      MARCA_DA_INSTITUICAO.backgroundUrl,
    );
    expect(naTela.panelColor).toBe(MARCA_DA_INSTITUICAO.panelColor);
  });
});

describe("tela de acesso sem repetição", () => {
  const tela = readFileSync("src/app/entrada/entrada.jsx", "utf8");
  const html = readFileSync("index.html", "utf8");

  /*
    A instrução ("Acesse com sua conta institucional.") e o rodapé de segurança
    repetiam o botão. Ficam logo, saudação e botão.
  */
  it("não tem instrução nem rodapé de segurança, nem campo para a instrução", () => {
    expect(tela).toContain('id="loginGreeting"');
    expect(tela).toContain('id="googleLoginText"');
    for (const fonte of [tela, html]) {
      expect(fonte).not.toContain("loginDescription");
      expect(fonte).not.toContain("loginSecurity");
      expect(fonte).not.toContain("cfgAccessInstruction");
    }
  });
});

/*
  A configuração completa (TB_CONFIGURACAO) chega pelo legado a cada
  `loadConfig` e passa por `definirMarcaDaConfiguracao`.
*/
describe("a marca vinda da configuração", () => {
  const COMPLETA = {
    auth_access_background_url: "https://exemplo.org/agosto-lilas.jpg",
    auth_access_panel_color: "#ffffff",
    auth_access_logo_url: "https://exemplo.org/logo-institucional.png",
    auth_access_greeting: "Bem-vindo ao Agosto Lilás",
  };

  it("a identidade só é gravada quando veio do banco", () => {
    // O caminho de erro do loadConfig: configuração vazia, nada carregou.
    definirMarcaDaConfiguracao({ valores: {}, carregou: false });
    expect(lerMarcaGuardada()).toBeNull();
    expect(identidadeNaTela().greeting).toBe("");

    // Carregou, mas sem as chaves da marca (anônimo): também não grava.
    definirMarcaDaConfiguracao({
      valores: { app_title: "MONITORA" },
      carregou: true,
      chaves: new Set(["app_title"]),
    });
    expect(lerMarcaGuardada()).toBeNull();
  });

  it("com as chaves do banco, aplica e grava os quatro campos juntos", () => {
    definirMarcaDaConfiguracao({
      valores: COMPLETA,
      carregou: true,
      chaves: new Set(Object.keys(COMPLETA)),
    });
    expect(identidadeNaTela()).toEqual({
      backgroundImage: `url("${MARCA_DA_INSTITUICAO.backgroundUrl}")`,
      panelColor: MARCA_DA_INSTITUICAO.panelColor,
      logo: MARCA_DA_INSTITUICAO.logoUrl,
      greeting: MARCA_DA_INSTITUICAO.greeting,
    });
    expect(lerMarcaGuardada()).toEqual({
      ...MARCA_DA_INSTITUICAO,
      textoModo: "auto",
    });
  });

  it("o rodapé institucional sai da configuração (departamento ou rodapé)", () => {
    definirMarcaDaConfiguracao({
      valores: { cogip_nome: "COGIP", footer_text: "AgSUS" },
      carregou: true,
      chaves: new Set(["cogip_nome", "footer_text"]),
    });
    expect(marcaDaEntrada.obter().rodape).toMatchObject({
      nome: "COGIP",
      departamento: "AgSUS",
    });
  });

  it("não existe chamada incondicional a guardarMarca", () => {
    // Os comentários do módulo citam a função ao explicar o defeito corrigido.
    const codigo = readFileSync("src/app/entrada/marca.js", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).toMatch(
      /if \(Object\.keys\(marcaParaGuardar\)\.length\) guardarMarca/,
    );
    // A outra é a do branding público, que guarda a resposta mesclada.
    expect([...codigo.matchAll(/guardarMarca\(/g)].length).toBe(2);
  });

  it("o logout não apaga nem troca a identidade", () => {
    for (const arquivo of [
      "src/app/sistema.js",
      "src/app/perfil.js",
      "src/app/sessao.js",
      "src/app/entrada/marca.js",
    ])
      expect(readFileSync(arquivo, "utf8")).not.toContain(
        "limparMarcaGuardada",
      );
  });
});
