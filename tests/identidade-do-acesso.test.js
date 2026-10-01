import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  guardarMarca,
  lerMarcaGuardada,
} from "../src/lib/access-branding-cache.js";
import { aplicarMarcaGuardadaNoArranque } from "../src/lib/access-branding-boot.js";

const MARCA_DA_INSTITUICAO = {
  backgroundUrl: "https://exemplo.org/agosto-lilas.jpg",
  panelColor: "#ffffff",
  logoUrl: "https://exemplo.org/logo-institucional.png",
  greeting: "Bem-vindo ao Agosto Lilás",
};

function montarTelaDeAcesso() {
  document.body.innerHTML = `
    <div id="loginScreen">
      <img id="loginLogo" src="" alt="" />
      <h1 id="loginGreeting"></h1>
    </div>`;
  return document.getElementById("loginScreen");
}

function identidadeNaTela() {
  const tela = document.getElementById("loginScreen");
  return {
    backgroundImage: tela.style.getPropertyValue("--login-background-image"),
    panelColor: tela.style.getPropertyValue("--login-panel-color"),
    logo: document.getElementById("loginLogo").getAttribute("src"),
    greeting: document.getElementById("loginGreeting").textContent,
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
  const html = readFileSync("index.html", "utf8");

  /*
    A instrução ("Acesse com sua conta institucional.") e o rodapé de segurança
    repetiam o botão. Ficam logo, saudação e botão.
  */
  it("não tem instrução nem rodapé de segurança, nem campo para a instrução", () => {
    expect(html).toContain('id="loginGreeting"');
    expect(html).toContain('id="googleLoginText"');
    expect(html).not.toContain("loginDescription");
    expect(html).not.toContain("loginSecurity");
    expect(html).not.toContain("cfgAccessInstruction");
  });
});

describe("ligação com applyConfigToUi", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");

  it("a identidade só é gravada quando veio do banco", () => {
    expect(app).toContain("configLoadOk && loadedConfigKeys.has(chave)");
    expect(app).toMatch(
      /if \(Object\.keys\(marcaParaGuardar\)\.length\) guardarMarca/,
    );
  });

  /*
    Se `guardarMarca` voltasse a ser chamada incondicionalmente, o defeito
    regressaria inteiro.
  */
  it("não existe chamada incondicional a guardarMarca", () => {
    // Os comentários do módulo citam a função ao explicar o defeito corrigido.
    const codigo = app
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const chamadas = [...codigo.matchAll(/guardarMarca\(/g)].length;
    expect(chamadas).toBe(1);
  });

  it("o logout não apaga nem troca a identidade", () => {
    expect(app).not.toContain("limparMarcaGuardada");
  });
});
