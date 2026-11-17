import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROBOS_DE_CARGA } from "../src/lib/robos-de-carga.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import { MIGRATION } from "./apoio/banco-dos-robos.ts";
import { CATALOGO_DOS_ROBOS } from "./fixtures/catalogo-dos-robos.ts";

/*
  O catálogo dos robôs (migration 20261109180000, já aplicada; o SQL em
  tests/fixtures/sql-do-banco/) e o resto do repositório: o que a tela pede,
  os .yml, a fixture dos testes da tela e o contrato cabem nele. O
  comportamento no banco está em tests/catalogo-dos-robos-no-banco.test.ts.
*/

/* ── O catálogo, lido da migration ─────────────────────────────────────────── */
interface LinhaDoWorkflow {
  workflow: string;
  chave: string | null;
  inputs: string[];
  disparavel: boolean;
  externo: boolean;
}
const CATALOGO: LinhaDoWorkflow[] = [
  ...MIGRATION.matchAll(
    /\('([a-z0-9-]+\.yml)', '[^']+', (null|'\w+'),\s*'\{([a-z_,]*)\}', '([SN])', '([SN])'\)/g,
  ),
].map(([, workflow = "", chave = "", inputs = "", disparavel, externo]) => ({
  workflow,
  chave: chave === "null" ? null : chave.slice(1, -1),
  inputs: inputs ? inputs.split(",") : [],
  disparavel: disparavel === "S",
  externo: externo === "S",
}));
const porWorkflow = new Map(CATALOGO.map((l) => [l.workflow, l]));
interface LinhaDaTarefa {
  tarefa: string;
  prefixo: boolean;
  chave: string | null;
  workflow: string | null;
}
const TAREFAS: LinhaDaTarefa[] = [
  ...MIGRATION.matchAll(
    /\('(agsus_[a-z0-9_]+)', '([SN])', '[^']+', (null|'\w+'), (null|'[a-z0-9-]+\.yml')\)/g,
  ),
].map(([, tarefa = "", prefixo, chave = "", workflow = ""]) => ({
  tarefa,
  prefixo: prefixo === "S",
  chave: chave === "null" ? null : chave.slice(1, -1),
  workflow: workflow === "null" ? null : workflow.slice(1, -1),
}));

describe("tudo o que pede ou registra workflow cabe no catálogo", () => {
  it("as linhas foram lidas (11 workflows, 17 tarefas)", () => {
    expect(CATALOGO).toHaveLength(11);
    expect(TAREFAS).toHaveLength(17);
  });

  it("os robôs da tela (ROBOS_DE_CARGA) pedem workflows disparáveis", () => {
    for (const robo of ROBOS_DE_CARGA)
      expect(porWorkflow.get(robo.workflow)?.disparavel, robo.workflow).toBe(
        true,
      );
  });

  // Vale para as migrations que vierem: as aplicadas saíram do repositório.
  it("todo FC_DISPARAR_ROBO('x.yml' das migrations do repositório (tarefas do pg_cron e funções) está no catálogo", () => {
    const pasta = "supabase/migrations";
    const pedidos = new Set<string>();
    const arquivos = existsSync(pasta)
      ? readdirSync(pasta).filter((f) => f.endsWith(".sql"))
      : [];
    for (const arquivo of arquivos)
      for (const [, w = ""] of readFileSync(`${pasta}/${arquivo}`, "utf8")
        .replace(/\r\n/g, "\n")
        .matchAll(/"FC_DISPARAR_ROBO"\('{1,2}([a-z0-9-]+\.yml)'/g))
        pedidos.add(w);
    for (const w of pedidos) expect(porWorkflow.has(w), w).toBe(true);
  });

  it("todo workflow que o banco pede ou deixa registrar existe em .github/workflows", () => {
    for (const l of CATALOGO.filter((x) => x.disparavel || x.externo))
      expect(existsSync(`.github/workflows/${l.workflow}`), l.workflow).toBe(
        true,
      );
  });

  it("a fixture dos testes da tela (tests/fixtures/catalogo-dos-robos.ts) é o catálogo da migration", () => {
    expect(
      CATALOGO_DOS_ROBOS.workflows
        .map((w) => [w.workflow, w.chave, w.disparavel])
        .sort(),
    ).toEqual(CATALOGO.map((l) => [l.workflow, l.chave, l.disparavel]).sort());
    expect(
      CATALOGO_DOS_ROBOS.tarefas
        .map((t) => [t.tarefa, t.prefixo, t.chave, t.workflow])
        .sort(),
    ).toEqual(
      TAREFAS.map((t) => [t.tarefa, t.prefixo, t.chave, t.workflow]).sort(),
    );
    for (const w of CATALOGO_DOS_ROBOS.workflows)
      expect(MIGRATION).toContain(`('${w.workflow}', '${w.nome}',`);
    for (const t of CATALOGO_DOS_ROBOS.tarefas)
      expect(MIGRATION).toContain(
        `('${t.tarefa}', '${t.prefixo ? "S" : "N"}', '${t.rotulo}',`,
      );
  });

  it("o RPC do catálogo está no contrato, sem argumentos", () => {
    expect(CONTRATO_RPC.obter_catalogo_dos_robos?.argumentos).toEqual([]);
  });
});
