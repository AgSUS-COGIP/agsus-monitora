import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MINIMO_AA,
  TEXTO_CLARO,
  TEXTO_ESCURO,
  avaliarCor,
  razaoDeContraste,
} from "../src/lib/contraste.js";
import {
  aplicarAviso,
  htmlDaPrevia,
  ligarAvisoDeContraste,
} from "../src/modules/aviso-de-contraste.js";

const sidebar = readFileSync("src/modules/sidebar-branding.js", "utf8");
const main = readFileSync("src/main.js", "utf8");
const css = readFileSync("src/styles/post157-interface-tuning.css", "utf8");

/*
  A Configurações tinha só um `<input type="color">` cru: escolhia-se um tom,
  salvava-se, e só então se descobria se dava para ler.

  Diferença deliberada em relação ao SIGAV, que mostra o mesmo aviso: lá o
  cálculo é sempre contra texto branco, e um painel lilás claro acusa 2.30
  mesmo quando a tela é desenhada com texto escuro. Aqui o primeiro plano é
  derivado da cor, então o número é o do texto que a pessoa vai ver.
*/
describe("a razão de contraste", () => {
  it("bate com os valores conhecidos da WCAG", () => {
    expect(razaoDeContraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(razaoDeContraste("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("não depende da ordem dos argumentos", () => {
    expect(razaoDeContraste("#102a43", "#c090eb")).toBeCloseTo(
      razaoDeContraste("#c090eb", "#102a43"),
      10,
    );
  });
});

describe("avaliação da cor escolhida", () => {
  it("mede contra o texto que a tela vai usar, não sempre contra o branco", () => {
    const claro = avaliarCor("#c090eb");
    expect(claro.corDoTexto).toBe(TEXTO_ESCURO);
    expect(claro.razao).toBeCloseTo(5.88, 1);
    expect(claro.passa).toBe(true);

    const escuro = avaliarCor("#6c009e");
    expect(escuro.corDoTexto).toBe(TEXTO_CLARO);
    expect(escuro.passa).toBe(true);
  });

  /*
    Derivar o primeiro plano garante a melhor das duas opções, não que ela
    baste: tons médios reprovam mesmo assim. É o que faz o aviso valer a pena.
  */
  it("acusa os tons médios, onde nenhum primeiro plano resolve", () => {
    const medio = avaliarCor("#8a7fb0");
    expect(medio.passa).toBe(false);
    expect(medio.razao).toBeLessThan(MINIMO_AA);
    expect(medio.mensagem).toContain("Abaixo do mínimo de 4.5");
    expect(medio.mensagem).toContain(String(medio.razao.toFixed(2)));
  });

  /*
    Num tom médio é o meio da escala que atrapalha, não a direção: escurecer faz
    o texto claro passar, clarear faz o escuro passar. A frase não pode mandar
    só escurecer.
  */
  it("a mensagem de falha não manda só escurecer", () => {
    const medio = avaliarCor("#8a7fb0");
    expect(medio.mensagem).toContain("mais escura ou mais clara");
  });

  it("a mensagem de sucesso também traz o número", () => {
    const ok = avaliarCor("#c090eb");
    expect(ok.mensagem).toContain("Acima do mínimo de 4.5");
    expect(ok.mensagem).toContain("5.88");
  });

  it("recusa o que não é cor hexadecimal", () => {
    for (const entrada of [
      null,
      undefined,
      "",
      "azul",
      "#fff",
      "#12345g",
      42,
    ]) {
      expect(avaliarCor(entrada)).toBeNull();
    }
  });

  it("aceita maiúsculas e espaços, como o input devolve", () => {
    expect(avaliarCor("  #C090EB ").cor).toBe("#c090eb");
  });
});

describe("a prévia mostra o que a cor produz", () => {
  it("usa a cor escolhida como fundo e o texto derivado", () => {
    const html = htmlDaPrevia(avaliarCor("#6c009e"));
    expect(html).toContain("background:#6c009e");
    expect(html).toContain(`color:${TEXTO_CLARO}`);
  });

  it("a barra lateral não mostra o botão de acesso, que ela não tem", () => {
    expect(
      htmlDaPrevia(avaliarCor("#c090eb"), { comBotao: false }),
    ).not.toContain("contraste-previa__botao");
    expect(htmlDaPrevia(avaliarCor("#c090eb"))).toContain(
      "contraste-previa__botao",
    );
  });
});

describe("o aviso no formulário", () => {
  const criarInput = (valor) => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = valor;
    document.body.appendChild(input);
    return input;
  };

  it("desenha prévia e aviso no container", () => {
    const container = document.createElement("div");
    const avaliacao = aplicarAviso(container, "#8a7fb0");
    expect(avaliacao.passa).toBe(false);
    expect(container.hidden).toBe(false);
    expect(container.querySelector(".contraste-previa")).toBeTruthy();
    expect(
      container.querySelector('.contraste-aviso[data-nivel="alerta"]'),
    ).toBeTruthy();
  });

  it("marca como ok quando passa", () => {
    const container = document.createElement("div");
    aplicarAviso(container, "#c090eb");
    expect(
      container.querySelector('.contraste-aviso[data-nivel="ok"]'),
    ).toBeTruthy();
  });

  it("some quando a cor é inválida", () => {
    const container = document.createElement("div");
    expect(aplicarAviso(container, "nada")).toBeNull();
    expect(container.hidden).toBe(true);
    expect(container.innerHTML).toBe("");
  });

  /*
    `input` e não só `change`: o seletor nativo dispara `input` enquanto a
    pessoa arrasta, e é aí que o número precisa acompanhar.
  */
  it("acompanha o arrasto do seletor", () => {
    const input = criarInput("#c090eb");
    const container = document.createElement("div");
    document.body.appendChild(container);
    ligarAvisoDeContraste(input, container);
    expect(container.textContent).toContain("5.88");

    input.value = "#8a7fb0";
    input.dispatchEvent(new Event("input"));
    expect(container.textContent).toContain("Abaixo do mínimo");
  });

  it("não liga duas vezes no mesmo campo", () => {
    const input = criarInput("#c090eb");
    const container = document.createElement("div");
    expect(ligarAvisoDeContraste(input, container)).toBe(true);
    expect(ligarAvisoDeContraste(input, container)).toBe(true);
    expect(input.dataset.avisoDeContraste).toBe("1");
  });
});

describe("os dois campos de cor recebem o aviso", () => {
  it("o painel de acesso é ligado no arranque", () => {
    expect(main).toContain("instalarAvisoDoPainelDeAcesso()");
  });

  it("a barra lateral tem o seu container e a sua ligação", () => {
    expect(sidebar).toContain('id="cfgSidebarColorAviso"');
    expect(sidebar).toContain("ligarAvisoDeContraste(");
    expect(sidebar).toContain("comBotao: false");
  });

  it("o aviso não depende só de cor para se distinguir", () => {
    expect(css).toContain('.contraste-aviso[data-nivel="alerta"]');
    // O número vai escrito na mensagem, não só no realce.
    expect(avaliarCor("#8a7fb0").mensagem).toMatch(/\d\.\d{2}/);
  });
});
