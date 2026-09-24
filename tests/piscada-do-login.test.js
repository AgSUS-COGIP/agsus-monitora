import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  guardarMarca,
  lerMarcaGuardada,
  limparMarcaGuardada,
} from "../src/lib/access-branding-cache.js";
import { needsLightForeground } from "../src/lib/access-branding.js";

const html = readFileSync("index.html", "utf8");
const cache = readFileSync("src/lib/access-branding-cache.js", "utf8");
const marca = readFileSync("src/lib/access-branding.js", "utf8");

/*
  A piscada ao recarregar a tela de acesso.

  `main.js` é `type="module"`, portanto adiado: só roda depois de o HTML ser
  analisado, quando o navegador já pintou a tela com os padrões neutros do CSS.
  A marca guardada era aplicada ali — e a cada recarga via-se claro e neutro
  primeiro, escuro e institucional logo depois.

  A correção não muda a lógica: antecipa-a. Dois scripts clássicos, síncronos,
  bloqueiam o analisador antes de o conteúdo existir.

  O preço é uma cópia da leitura do cache dentro do `index.html`, que não pode
  importar módulos. Estes testes são o que impede as duas cópias de se
  separarem em silêncio.
*/

function scriptDoHead() {
  const i = html.indexOf("aplicarMarcaAntesDoPrimeiroPaint");
  expect(i, "script de pré-paint ausente do index.html").toBeGreaterThan(-1);
  return html.slice(i, html.indexOf("</script>", i));
}

describe("a marca é aplicada antes do primeiro paint", () => {
  it("o script do head é clássico e síncrono", () => {
    const trecho = html.slice(
      0,
      html.indexOf("aplicarMarcaAntesDoPrimeiroPaint"),
    );
    const abertura = trecho.lastIndexOf("<script");
    const tag = trecho.slice(abertura);
    expect(tag).not.toContain('type="module"');
    expect(tag).not.toContain("defer");
    expect(tag).not.toContain("async");
  });

  /*
    Os comentários deste ficheiro citam `<body>` ao explicar por que o script
    precisa correr antes dele. Procurar a marca no texto cru acusaria a própria
    explicação; o que vale é o documento sem comentários.
  */
  it("roda no <head>, antes do <body>", () => {
    const semComentarios = html.replace(/<!--[\s\S]*?-->/g, "");
    expect(
      semComentarios.indexOf("aplicarMarcaAntesDoPrimeiroPaint"),
    ).toBeLessThan(semComentarios.indexOf("<body"));
  });

  /*
    A classe é exigida em `#loginScreen.login-panel-dark` por
    post-152-regression-fixes.css. Aplicá-la no elemento — e não no <html> —
    reaproveita todos esses seletores sem duplicar nenhum.
  */
  it("a classe é aplicada logo depois do elemento existir", () => {
    const elemento = html.indexOf('id="loginScreen"');
    const aplicacao = html.indexOf("__agsusPainelEscuro", elemento);
    const cartao = html.indexOf('class="login-card"', elemento);
    expect(aplicacao).toBeGreaterThan(elemento);
    expect(aplicacao).toBeLessThan(cartao);
  });

  it("a variável da cor vai na raiz, para ser herdada antes do elemento", () => {
    expect(scriptDoHead()).toContain(
      'raiz.style.setProperty("--login-panel-color", cor)',
    );
  });
});

describe("as duas cópias não podem divergir", () => {
  it("usam a mesma chave de armazenamento", () => {
    const chave = cache.match(/const CHAVE = "([^"]+)"/)?.[1];
    expect(chave).toBeTruthy();
    expect(scriptDoHead()).toContain(chave);
  });

  it("usam o mesmo limiar de luminância", () => {
    const formula = marca.match(
      /\(red \* (\d+) \+ green \* (\d+) \+ blue \* (\d+)\) \/ (\d+) < (\d+)/,
    );
    expect(formula, "fórmula de luminância mudou de forma").toBeTruthy();
    const [, r, g, b, div, limiar] = formula;
    const inline = scriptDoHead();
    expect(inline).toContain(`r * ${r} + g * ${g} + b * ${b}`);
    expect(inline).toContain(`/ ${div} < ${limiar}`);
  });

  it("escrevem os mesmos nomes de variável CSS que o CSS lê", () => {
    const inline = scriptDoHead();
    for (const nome of ["--login-panel-color", "--login-background-image"]) {
      expect(inline).toContain(nome);
    }
  });

  /*
    Só os campos que a tela pinta. Se o script inline passasse a ler algo fora
    de CAMPOS, leria um dado que o cache nunca guarda.
  */
  it("só lê campos que o cache guarda", () => {
    const campos = [...cache.matchAll(/^\s*"(\w+)",$/gm)].map((m) => m[1]);
    const inline = scriptDoHead();
    for (const lido of ["panelColor", "backgroundUrl"]) {
      expect(campos, `${lido} não está em CAMPOS`).toContain(lido);
      expect(inline).toContain(`marca.${lido}`);
    }
  });
});

describe("os estados que a medição no navegador confirmou", () => {
  /*
    Medido no preview em 09/09/2026, recarregando a página:

      com cache #052029  -> var na raiz #052029, classe aplicada,
                            card rgb(5, 32, 41)
      sem cache          -> var vazia, sem classe,
                            fundo rgb(238, 244, 248), card branco
      com cache #f2e8d5  -> sem classe escura, título rgb(16, 42, 67)
  */
  it("uma cor escura pede primeiro plano claro", () => {
    expect(needsLightForeground("#052029")).toBe(true);
  });

  it("uma cor clara não pede", () => {
    expect(needsLightForeground("#f2e8d5")).toBe(false);
    expect(needsLightForeground("#ffffff")).toBe(false);
  });

  /*
    Sem cache a tela fica neutra — nunca a arte padrão apresentada como se
    fosse escolha da instituição, e nunca o roxo do legado.
  */
  it("o CSS de partida continua neutro", () => {
    const tuning = readFileSync(
      "src/styles/post157-interface-tuning.css",
      "utf8",
    );
    expect(tuning).toContain("background-color: #eef4f8");
    expect(tuning).not.toContain("#4d2270");
    expect(tuning).not.toContain("#c296eb");
  });

  it("o script tolera armazenamento bloqueado", () => {
    const inline = scriptDoHead();
    expect(inline).toContain("try {");
    expect(inline).toContain("catch (erro)");
  });

  /*
    Aspas e barras invertidas na URL quebrariam a declaração CSS — a mesma
    proteção que `comoUrlCss` faz do lado do módulo.
  */
  it("a URL da arte é higienizada antes de virar url()", () => {
    expect(scriptDoHead()).toContain('replace(/["\\\\]/g, "")');
  });
});

/*
  O modo do texto não sobrevivia a um F5.

  Sequência medida: o carregamento autenticado guardava `textoModo` no cache; o
  pré-paint o aplicava; e então `obter_branding_acesso_publico()` respondia com
  a sua lista fixa de seis chaves, `guardarMarca` **substituía** o cache inteiro
  por essa resposta, e o campo desaparecia — a tela revertia para o padrão no
  mesmo carregamento, e o F5 seguinte já nascia sem ele.

  Substituir contradizia a regra que o próprio módulo declara: uma resposta
  incompleta não pode trocar uma identidade correta por outra.
*/
describe("uma resposta parcial não apaga o cache", () => {
  beforeEach(() => {
    limparMarcaGuardada();
  });

  it("mescla em vez de substituir", () => {
    guardarMarca({ panelColor: "#c090eb", textoModo: "claro" });
    // A RPC pública responde sem o modo, como faz hoje.
    guardarMarca({ panelColor: "#c090eb", greeting: "Olá" });

    const guardada = lerMarcaGuardada();
    expect(guardada.textoModo).toBe("claro");
    expect(guardada.greeting).toBe("Olá");
  });

  it("devolve a marca completa, para quem aplica não usar a resposta crua", () => {
    guardarMarca({ panelColor: "#c090eb", textoModo: "claro" });
    const completa = guardarMarca({ greeting: "Olá" });
    expect(completa.textoModo).toBe("claro");
    expect(completa.panelColor).toBe("#c090eb");
  });

  it("o que a resposta traz continua vencendo o que estava guardado", () => {
    guardarMarca({ panelColor: "#c090eb" });
    guardarMarca({ panelColor: "#6c009e" });
    expect(lerMarcaGuardada().panelColor).toBe("#6c009e");
  });

  it("quem aplica usa o resultado da mescla", () => {
    const boot = readFileSync("src/lib/access-branding-boot.js", "utf8");
    expect(boot).toContain("const completa = guardarMarca(marca) || marca");
    expect(boot).toContain("aplicarMarcaNaTela(completa, documento)");
  });
});

/*
  A tela de acesso antiga — foto em i.postimg.cc e cartão branco — aparecia
  sempre que o CSS dos módulos atrasava, porque app.css ainda a desenhava.
  Sem arte configurada, o fundo é liso, em todos os arquivos que pintam a tela.
*/
describe("fundo da tela de acesso sem arte configurada", () => {
  const folhas = [
    "src/styles/app.css",
    "src/styles/platform-shell.css",
    "src/styles/config-page.css",
  ].map((arquivo) => [arquivo, readFileSync(arquivo, "utf8")]);

  it.each(folhas)("%s não carrega imagem de host externo", (_, css) => {
    expect(css).not.toMatch(/url\(\s*["']?https?:/);
  });

  it.each(folhas)("%s não usa mais o roxo legado", (_, css) => {
    expect(css).not.toContain("#4d2270");
  });

  it("a alternativa da arte é nenhuma imagem", () => {
    const [, app] = folhas[0];
    const regra = app.slice(app.indexOf(".login-screen {"));
    expect(regra.slice(0, regra.indexOf("}"))).toContain(
      "background-image: var(--login-background-image, none)",
    );
  });
});
