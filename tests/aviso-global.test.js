import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avisoGlobal } from "../src/lib/aviso-global.js";

describe("aviso global", () => {
  it("fica oculto quando não há mensagem configurada", () => {
    expect(avisoGlobal({ mensagem: "", tipo: "info" }).visivel).toBe(false);
    expect(avisoGlobal({}).visivel).toBe(false);
  });

  it("trata mensagem só de espaços como ausência de aviso", () => {
    expect(avisoGlobal({ mensagem: "   " }).visivel).toBe(false);
  });

  it("aparece com a mensagem aparada quando há texto", () => {
    const aviso = avisoGlobal({ mensagem: "  Manutenção às 18h  " });
    expect(aviso.visivel).toBe(true);
    expect(aviso.mensagem).toBe("Manutenção às 18h");
  });

  it("traduz os três tipos para as variantes de .alert", () => {
    const classe = (tipo) => avisoGlobal({ mensagem: "x", tipo }).classe;
    expect(classe("info")).toBe("alert broadcast-bar");
    expect(classe("warning")).toBe("alert broadcast-bar warn");
    expect(classe("danger")).toBe("alert broadcast-bar error");
  });

  it("aceita o tipo em qualquer caixa e com espaços", () => {
    expect(avisoGlobal({ mensagem: "x", tipo: " DANGER " }).classe).toBe(
      "alert broadcast-bar error",
    );
  });

  /*
    Se o tipo vier fora da lista — chave editada à mão no banco, valor de uma
    versão futura — a mensagem ainda precisa aparecer. Errar a cor é menos grave
    que engolir o recado.
  */
  it("mostra o aviso mesmo com tipo desconhecido", () => {
    const aviso = avisoGlobal({ mensagem: "Atenção", tipo: "roxo" });
    expect(aviso.visivel).toBe(true);
    expect(aviso.classe).toBe("alert broadcast-bar");
  });

  it("não quebra com valores que não são texto", () => {
    expect(avisoGlobal({ mensagem: null, tipo: null }).visivel).toBe(false);
    expect(avisoGlobal({ mensagem: 42, tipo: 7 }).mensagem).toBe("42");
  });
});

describe("ligação do aviso global com a interface", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("src/modules/legacy-app.js", "utf8");

  it("tem no HTML o elemento que recebe o aviso", () => {
    expect(html).toContain('id="broadcastBar"');
    expect(html).toContain('role="status"');
  });

  /*
    A posição importa: a barra de offline é `position: fixed` no topo. Se o aviso
    também fosse fixo, um cobriria o outro exatamente quando os dois importam.
  */
  it("posiciona o aviso entre o cabeçalho e o conteúdo", () => {
    const depoisDoCabecalho =
      html.indexOf("broadcastBar") > html.indexOf("</header>");
    const antesDoConteudo =
      html.indexOf("broadcastBar") < html.indexOf('<div class="content">');
    expect(depoisDoCabecalho && antesDoConteudo).toBe(true);
  });

  /*
    Este é o teste que pega a regressão original: o aviso era gravado e relido no
    formulário, mas nada o aplicava à interface.
  */
  it("aplica o aviso sempre que a configuração é aplicada", () => {
    const aplica = app.slice(
      app.indexOf("function applyConfigToUi() {"),
      app.indexOf("function renderConfigForm() {"),
    );
    expect(aplica).toContain("aplicarAvisoGlobal()");
  });

  it("escreve o aviso como texto, nunca como marcação", () => {
    const fn = app.slice(
      app.indexOf("function aplicarAvisoGlobal() {"),
      app.indexOf("function applyConfigToUi() {"),
    );
    expect(fn).toContain("barra.textContent =");
    expect(fn).not.toMatch(/.innerHTMLs*=/);
  });
});
