// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/*
  A regra `no-restricted-syntax` do eslint.config.js barra HTML montado a
  partir de texto no front (porta de XSS). Estes casos garantem que ela pega
  cada forma e não acusa o jeito certo (JSX, textContent, createElement).
*/
const eslint = new ESLint({ cwd: process.cwd() });

async function erros(codigo, arquivo) {
  const [resultado] = await eslint.lintText(codigo, { filePath: arquivo });
  return resultado.messages
    .filter((m) => m.ruleId === "no-restricted-syntax")
    .map((m) => m.message);
}

describe("sem HTML cru no front", () => {
  it.each([
    ["innerHTML", "el.innerHTML = nome;"],
    ["outerHTML", "el.outerHTML = nome;"],
    ["srcdoc", "quadro.srcdoc = nome;"],
    ["innerHTML +=", "el.innerHTML += nome;"],
    ["insertAdjacentHTML", 'el.insertAdjacentHTML("beforeend", nome);'],
    ["createContextualFragment", "faixa.createContextualFragment(nome);"],
    ["document.write", "document.write(nome);"],
  ])("barra %s", async (_, codigo) => {
    const mensagens = await erros(
      `export function f(el, quadro, faixa, nome) { ${codigo} }`,
      "src/modules/exemplo-sem-html-cru.js",
    );
    expect(mensagens).toHaveLength(1);
  });

  it("barra dangerouslySetInnerHTML no JSX e em objeto de props", async () => {
    const mensagens = await erros(
      [
        "export const A = ({ t }) => <p dangerouslySetInnerHTML={{ __html: t }} />;",
        "export const props = (t) => ({ dangerouslySetInnerHTML: { __html: t } });",
      ].join("\n"),
      "src/componentes/exemplo-sem-html-cru.jsx",
    );
    expect(mensagens).toHaveLength(2);
  });

  it("aceita texto como filho, textContent e createElement", async () => {
    const mensagens = await erros(
      [
        "export const A = ({ t }) => <p>{t}</p>;",
        "export function f(el, t) {",
        '  const s = document.createElement("span");',
        "  s.textContent = t;",
        "  el.append(s);",
        "  navigator.clipboard.write([]);",
        "}",
      ].join("\n"),
      "src/componentes/exemplo-sem-html-cru.jsx",
    );
    expect(mensagens).toEqual([]);
  });
});
