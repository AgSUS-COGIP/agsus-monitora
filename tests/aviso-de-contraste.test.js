import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MINIMO_AA,
  MODO_AUTO,
  MODO_CLARO,
  MODO_ESCURO,
  TEXTO_CLARO,
  TEXTO_ESCURO,
  avaliarCor,
  corDoTextoPara,
  normalizarModo,
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

/*
  Forçar o texto claro sobre um painel claro reprova a WCAG — e é uma escolha
  legítima de identidade visual. O papel do sistema é avisar com o número na
  tela, não decidir sozinho. Por isso o modo existe e `auto` continua o padrão.

  A parte difícil não foi a classe: a tela de acesso é pintada ANTES do login,
  a partir de `obter_branding_acesso_publico()`, cuja lista de chaves é fixa em
  SQL. Sem acrescentar `auth_access_texto_modo` a essa lista, a escolha não
  chega a quem ainda não entrou.
*/
describe("modo do texto sobre o painel", () => {
  const html = readFileSync("index.html", "utf8");
  const governanca = readFileSync("src/modules/config-governance.js", "utf8");
  const app = readFileSync("src/modules/legacy-app.js", "utf8");
  const boot = readFileSync("src/lib/access-branding-boot.js", "utf8");
  const cache = readFileSync("src/lib/access-branding-cache.js", "utf8");
  const publico = readFileSync("src/lib/access-branding-publico.js", "utf8");
  const migracao = readFileSync(
    "supabase/migrations/20260910120000_modo_do_texto_da_tela_de_acesso.sql",
    "utf8",
  );

  it("auto é o padrão e preserva o comportamento anterior", () => {
    expect(normalizarModo(undefined)).toBe(MODO_AUTO);
    expect(normalizarModo("qualquer coisa")).toBe(MODO_AUTO);
    expect(corDoTextoPara("#c090eb", MODO_AUTO)).toBe(TEXTO_ESCURO);
    expect(corDoTextoPara("#6c009e", MODO_AUTO)).toBe(TEXTO_CLARO);
  });

  it("claro e escuro impõem, independentemente da luminância", () => {
    expect(corDoTextoPara("#c090eb", MODO_CLARO)).toBe(TEXTO_CLARO);
    expect(corDoTextoPara("#6c009e", MODO_ESCURO)).toBe(TEXTO_ESCURO);
  });

  /*
    O ponto do pedido: dá para deixar claro, e o aviso diz o preço.
  */
  it("forçar claro num painel claro reprova, e o aviso mostra isso", () => {
    const forcado = avaliarCor("#c090eb", MODO_CLARO);
    expect(forcado.corDoTexto).toBe(TEXTO_CLARO);
    expect(forcado.passa).toBe(false);
    expect(forcado.razao).toBeLessThan(MINIMO_AA);
    expect(forcado.mensagem).toContain("Abaixo do mínimo de 4.5");

    const automatico = avaliarCor("#c090eb");
    expect(automatico.passa).toBe(true);
  });

  it("o aviso reage à troca de modo, não só à de cor", () => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = "#c090eb";
    const seletor = document.createElement("select");
    for (const v of ["auto", "claro", "escuro"]) {
      const o = document.createElement("option");
      o.value = v;
      seletor.appendChild(o);
    }
    const container = document.createElement("div");
    ligarAvisoDeContraste(input, container, { seletorDeModo: seletor });
    expect(container.textContent).toContain("Acima do mínimo");

    seletor.value = "claro";
    seletor.dispatchEvent(new Event("change"));
    expect(container.textContent).toContain("Abaixo do mínimo");
  });

  it("a tela aplica o modo, e não só a luminância", () => {
    const fn = boot.slice(
      boot.indexOf("export function aplicarCorDoPainel"),
      boot.indexOf("export function aplicarMarcaNaTela"),
    );
    expect(fn).toContain("corDoTextoPara(cor, modo)");
    expect(boot).toContain(
      "aplicarCorDoPainel(tela, marca.panelColor, marca.textoModo)",
    );
  });

  it("o modo viaja pelo cache e pelo mapa da RPC pública", () => {
    expect(cache).toContain('"textoModo"');
    expect(publico).toContain('auth_access_texto_modo: "textoModo"');
  });

  /*
    Sem esta chave na lista da função, a escolha não alcança quem ainda não fez
    login — que é justamente a tela onde ela aparece.
  */
  it("a migration acrescenta a chave à RPC pública, sem remover nenhuma", () => {
    const chaves = [...migracao.matchAll(/'(auth_[a-z_]+)'/g)].map((m) => m[1]);
    expect(chaves).toContain("auth_access_texto_modo");
    for (const antiga of [
      "auth_access_background_url",
      "auth_access_logo_url",
      "auth_access_panel_color",
      "auth_access_greeting",
      "auth_access_instruction",
      "auth_google_button_text",
    ]) {
      expect(chaves, `${antiga} sumiu da lista`).toContain(antiga);
    }
    expect(migracao).toContain("create or replace function");
    expect(migracao).not.toMatch(/drop\s+(function|table|column|policy)/i);
  });

  it("o pré-paint respeita o modo guardado", () => {
    expect(html).toContain("marca.textoModo");
    const bloco = html.slice(
      html.indexOf("aplicarMarcaAntesDoPrimeiroPaint"),
      html.indexOf(
        "</script>",
        html.indexOf("aplicarMarcaAntesDoPrimeiroPaint"),
      ),
    );
    expect(bloco).toContain('modo === "claro"');
    expect(bloco).toContain('modo === "escuro"');
  });

  it("a chave entra nos dois caminhos de gravação", () => {
    expect(governanca).toContain('"auth_access_texto_modo"');
    expect(app).toContain('chave: "auth_access_texto_modo"');
  });

  it("o campo existe no formulário com as três opções", () => {
    expect(html).toContain('id="cfgAccessTextoModo"');
    for (const valor of ["auto", "claro", "escuro"]) {
      expect(html).toContain(`value="${valor}"`);
    }
  });
});
