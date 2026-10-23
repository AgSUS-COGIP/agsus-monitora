import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Os robôs que gravam no banco de produção só rodam por workflow_dispatch:
  pela agenda do banco (que respeita as chaves da automação, 20261022190000),
  pelo Rodar agora, pelo Run workflow ou chamados por outro workflow
  (workflow_call). Nada de `push` (em 22/10/2026 a
  "Sincronizar entrevistas" rodou três vezes em produção por push num ramo de
  trabalho) nem de `schedule` (o agendador é o banco: docs/agenda-dos-robos.md).
*/
const ROBOS = [
  "sincronizar-entrevistas.yml",
  "sincronizar-selecao.yml",
  "conferencias.yml",
  "robo-empregare.yml",
  "pre-classificacao.yml",
  "leitura-de-arquivos.yml",
  "classificacao.yml",
];
const gatilhos = (texto) => {
  const bloco =
    /^on:\n([\s\S]*?)^\S/m.exec(texto.replace(/\r\n/g, "\n"))?.[1] || "";
  return [...bloco.matchAll(/^ {2}(\w+):/gm)].map(([, nome]) => nome);
};

describe("gatilhos dos workflows dos robôs", () => {
  // workflow_call: só outro workflow do repositório chama (o fim do robô chama a pré-classificação).
  it.each(ROBOS)("%s só roda por workflow_dispatch", (arquivo) => {
    const lista = gatilhos(
      readFileSync(`.github/workflows/${arquivo}`, "utf8"),
    );
    expect(lista).toContain("workflow_dispatch");
    expect(lista.filter((g) => g !== "workflow_call")).toEqual([
      "workflow_dispatch",
    ]);
  });

  it("a pré-classificação no fim do robô confere a chave antes", () => {
    const pre = readFileSync(".github/workflows/pre-classificacao.yml", "utf8");
    const conferir = pre.slice(
      pre.indexOf("- name: Conferir a chave da pré-classificação automática"),
      pre.indexOf("- name: Pré-classificar\n"),
    );
    expect(conferir).toContain("if: ${{ inputs.apos_robo }}");
    expect(conferir).toContain(
      "run: python -m monitora.chave_da_automacao pre_classificacao",
    );
    expect(pre).toContain(
      "if: ${{ steps.chave_pre_classificacao.outputs.ligada != 'false' }}",
    );
  });
});
