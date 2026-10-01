import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  arquivosNovosNoLegado,
  PASTAS_DO_LEGADO,
} from "../scripts/check-legado-so-encolhe.mjs";

/*
  O legado só encolhe: arquivo novo em src/modules/ ou src/analises/ (em
  relação à base) quebra o check:architecture. Editar e apagar podem.
*/

const SCRIPT = resolve("scripts/check-legado-so-encolhe.mjs");

describe("arquivosNovosNoLegado", () => {
  it("as pastas do legado são src/modules e src/analises", () => {
    expect(PASTAS_DO_LEGADO).toEqual(["src/modules/", "src/analises/"]);
  });

  it("acusa arquivo novo nas pastas do legado", () => {
    const antes = ["src/modules/a.js", "src/analises/b.js"];
    const agora = [
      "src/modules/a.js",
      "src/modules/novo.js",
      "src/analises/b.js",
      "src/analises/outro.css",
    ];
    expect(arquivosNovosNoLegado(antes, agora)).toEqual([
      "src/modules/novo.js",
      "src/analises/outro.css",
    ]);
  });

  it("aceita editar, apagar e criar fora do legado", () => {
    const antes = ["src/modules/a.js", "src/modules/b.js"];
    const agora = [
      "src/modules/a.js",
      "src/modulos/tela/tela.jsx",
      "src/ui/kpi.jsx",
      "src/componentes/x.jsx",
    ];
    expect(arquivosNovosNoLegado(antes, agora)).toEqual([]);
  });

  it("renomear dentro do legado conta como arquivo novo", () => {
    expect(
      arquivosNovosNoLegado(["src/modules/velho.js"], ["src/modules/novo.js"]),
    ).toEqual(["src/modules/novo.js"]);
  });

  it("não confunde pasta com prefixo parecido", () => {
    expect(
      arquivosNovosNoLegado([], ["src/modules-extra/a.js", "src/analisesx.js"]),
    ).toEqual([]);
  });
});

describe("check-legado-so-encolhe.mjs num repositório de verdade", () => {
  let pasta;

  afterEach(() => {
    if (pasta) rmSync(pasta, { recursive: true, force: true });
    pasta = null;
  });

  const git = (...args) =>
    execFileSync(
      "git",
      ["-c", "user.name=Teste", "-c", "user.email=teste@exemplo", ...args],
      { cwd: pasta, stdio: "pipe" },
    );

  function escrever(caminho, texto = "x\n") {
    const completo = join(pasta, caminho);
    mkdirSync(dirname(completo), { recursive: true });
    writeFileSync(completo, texto);
  }

  function rodar() {
    const env = { ...process.env };
    delete env.GITHUB_BASE_REF;
    return spawnSync(process.execPath, [SCRIPT], {
      cwd: pasta,
      env,
      encoding: "utf8",
    });
  }

  function repositorioComBase() {
    pasta = mkdtempSync(join(tmpdir(), "legado-"));
    git("init", "-q", "-b", "main");
    escrever("src/modules/existente.js");
    escrever("src/analises/painel.css");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    git("checkout", "-q", "-b", "feat");
  }

  it("falha com arquivo novo em src/modules", () => {
    repositorioComBase();
    escrever("src/modules/novo-modulo.js");
    git("add", ".");
    git("commit", "-q", "-m", "novo");
    const r = rodar();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("src/modules/novo-modulo.js");
  });

  it("passa editando e apagando no legado e criando em src/modulos", () => {
    repositorioComBase();
    escrever("src/modules/existente.js", "mudou\n");
    git("rm", "-q", "src/analises/painel.css");
    escrever("src/modulos/tela/tela.jsx");
    git("add", ".");
    git("commit", "-q", "-m", "ok");
    const r = rodar();
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Legado sem arquivo novo");
  });
});
