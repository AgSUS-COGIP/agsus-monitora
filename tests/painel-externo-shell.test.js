import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Este ficheiro cobria também o botão de recolher, que no #176 só existia dentro
  do painel externo. O botão passou a ser o controle único do sistema inteiro, e
  a cobertura dele mudou de casa: `tests/componentes/barra-lateral.test.js`. Aqui ficam
  as barras de rolagem, que continuam sendo um problema só do painel externo.
*/
const css = readFileSync("src/styles/platform-shell.css", "utf8");

/*
  Os comentários deste CSS explicam o defeito citando `padding`, `!important` e
  `#conteudoPrincipal`. Verificar o texto cru acusaria a própria explicação; o
  que vale são as declarações.
*/
const regras = css.replace(/\/\*[\s\S]*?\*\//g, "");

/*
  Recorta a regra que declara o seletor pedido. Procurar a primeira ocorrência do
  texto não serve: `body.external-panel-mode .main` aparece antes, na regra que
  esconde o cabeçalho.
*/
const bloco = (seletor, declaracao) =>
  regras
    .split("}")
    .map((parte) => parte + "}")
    .find(
      (r) => r.includes(seletor) && (!declaracao || r.includes(declaracao)),
    ) || "";

/*
  Duas barras de rolagem no painel externo.

  Medido no preview em 10/09/2026, com o painel de Análises embarcado:

    1440x900   scrollHeight 934 contra clientHeight 900   -> 34px a mais
     800x900   scrollHeight 948 contra clientHeight 900   -> 48px a mais

  O quadro é travado em `min-height: 100dvh` — uma tela inteira — e cada caixa da
  cadeia soma o seu espaçamento por cima. Não era um espaçamento, eram três:
  `.table-card` 14, `.content` 34, `.main` 20.
*/
describe("o painel externo não pode ter duas barras de rolagem", () => {
  it("zera a cadeia inteira, não só uma caixa", () => {
    const alvo = bloco("body.external-panel-mode .main", "padding");
    for (const parte of [
      "body.external-panel-mode .main",
      "body.external-panel-mode #conteudoPrincipal",
      "body.external-panel-mode #page-external .table-card",
    ]) {
      expect(alvo, `${parte} ficou fora da regra`).toContain(parte);
    }
    expect(alvo).toContain("padding: 0 !important");
    expect(
      bloco("body.external-panel-mode .content", "padding-bottom"),
    ).toContain("padding-bottom: 0 !important");
  });

  /*
    Sem `!important` a correção valia só no largo: `mobile-app.css` declara os
    mesmos espaçamentos com `!important`, que vence especificidade. E sem o id a
    regra concorrente ainda ganhava no `.main`, porque alcança o elemento por
    `#conteudoPrincipal` — um id vence qualquer número de classes.
  */
  it("alcança as declarações concorrentes, que são !important e por id", () => {
    const alvo = bloco("body.external-panel-mode .main", "padding");
    expect(alvo).toContain("#conteudoPrincipal");
    expect(alvo).toMatch(/!important/);
  });

  it("trava o transbordo para o caso de alguém acrescentar espaçamento amanhã", () => {
    expect(bloco("body.external-panel-mode .app")).toContain(
      "overflow: hidden",
    );
  });

  /*
    O escopo é o que garante que nada mudou fora do painel externo: toda regra
    nova nasce de `body.external-panel-mode`.
  */
  it("nenhuma regra nova escapa do modo painel externo", () => {
    const novas = [
      "body.external-panel-mode .main",
      "body.external-panel-mode .content",
      "body.external-panel-mode .app",
    ];
    for (const seletor of novas) {
      expect(regras, `${seletor} ausente`).toContain(seletor);
    }
  });
});
