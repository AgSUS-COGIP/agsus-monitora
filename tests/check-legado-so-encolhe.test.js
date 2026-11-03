import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  arquivosNovosNoLegado,
  JAVASCRIPT_PERMITIDO_NO_LEGADO,
  javascriptNoLegado,
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
      "src/ui/kpi.tsx",
      "src/componentes/x.jsx",
    ];
    expect(arquivosNovosNoLegado(antes, agora)).toEqual([]);
  });

  it("renomear dentro do legado conta como arquivo novo", () => {
    expect(
      arquivosNovosNoLegado(["src/modules/velho.js"], ["src/modules/novo.js"]),
    ).toEqual(["src/modules/novo.js"]);
  });

  it("migrar para TypeScript (o .js vira .ts) não é arquivo novo", () => {
    expect(
      arquivosNovosNoLegado(
        ["src/modules/a.js", "src/modules/b.jsx"],
        ["src/modules/a.ts", "src/modules/b.tsx"],
      ),
    ).toEqual([]);
  });

  it("o .ts ao lado do .js que continua, ou de outro nome, é arquivo novo", () => {
    expect(
      arquivosNovosNoLegado(
        ["src/modules/a.js", "src/modules/velho.js"],
        ["src/modules/a.js", "src/modules/a.ts", "src/modules/novo.ts"],
      ),
    ).toEqual(["src/modules/a.ts", "src/modules/novo.ts"]);
  });

  it("não confunde pasta com prefixo parecido", () => {
    expect(
      arquivosNovosNoLegado([], ["src/modules-extra/a.js", "src/analisesx.js"]),
    ).toEqual([]);
  });
});

/*
  O legado não tem mais JavaScript escrito à mão (03/11/2026): nenhum .js pode
  voltar a src/modules/ ou src/analises/, nem um que já existia na base. Só o
  conhecimento gerado da Aya fica.
*/
describe("javascriptNoLegado", () => {
  it("só o gerado da Aya é permitido", () => {
    expect(JAVASCRIPT_PERMITIDO_NO_LEGADO).toEqual([
      "src/modules/aya-conhecimento-gerado.js",
    ]);
  });

  it("acusa .js, .jsx, .mjs e .cjs no legado, fora o gerado", () => {
    expect(
      javascriptNoLegado([
        "src/modules/aya-conhecimento-gerado.js",
        "src/modules/a.ts",
        "src/modules/b.js",
        "src/modules/c.jsx",
        "src/analises/d.mjs",
        "src/analises/e.cjs",
        "src/modules/f.css",
      ]),
    ).toEqual([
      "src/modules/b.js",
      "src/modules/c.jsx",
      "src/analises/d.mjs",
      "src/analises/e.cjs",
    ]);
  });

  it("JavaScript fora do legado não é com ele", () => {
    expect(
      javascriptNoLegado([
        "src/lib/contornos.js",
        "src/lib/rpc-contrato.js",
        "src/modules-extra/a.js",
      ]),
    ).toEqual([]);
  });

  it("o legado de verdade não tem JavaScript escrito à mão", () => {
    const arquivos = execFileSync(
      "git",
      ["ls-files", "--", "src/modules", "src/analises"],
      { encoding: "utf8" },
    )
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((caminho) => existsSync(caminho));
    expect(javascriptNoLegado(arquivos)).toEqual([]);
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
    escrever("src/modules/existente.ts");
    escrever("src/analises/painel.css");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    git("checkout", "-q", "-b", "feat");
  }

  it("falha com arquivo novo em src/modules", () => {
    repositorioComBase();
    escrever("src/modules/novo-modulo.ts");
    git("add", ".");
    git("commit", "-q", "-m", "novo");
    const r = rodar();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("src/modules/novo-modulo.ts");
  });

  it("falha com JavaScript no legado, mesmo um que já existia na base", () => {
    repositorioComBase();
    git("checkout", "-q", "main");
    escrever("src/modules/antigo.js");
    git("add", ".");
    git("commit", "-q", "-m", "base com js");
    git("checkout", "-q", "-B", "feat");
    escrever("src/modules/antigo.js", "editado\n");
    git("add", ".");
    git("commit", "-q", "-m", "edita o js");
    const r = rodar();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("JavaScript no legado");
    expect(r.stderr).toContain("src/modules/antigo.js");
  });

  it("o conhecimento gerado da Aya pode ficar em JavaScript", () => {
    repositorioComBase();
    git("checkout", "-q", "main");
    escrever("src/modules/aya-conhecimento-gerado.js");
    git("add", ".");
    git("commit", "-q", "-m", "gerado");
    git("checkout", "-q", "-B", "feat");
    escrever("src/modules/aya-conhecimento-gerado.js", "regerado\n");
    git("add", ".");
    git("commit", "-q", "-m", "regera");
    const r = rodar();
    expect(r.status, r.stderr).toBe(0);
  });

  it("a base andou e apagou um arquivo do legado: o ramo que ainda o tem passa", () => {
    repositorioComBase();
    git("checkout", "-q", "main");
    git("rm", "-q", "src/modules/existente.ts");
    git("commit", "-q", "-m", "a base apaga");
    git("checkout", "-q", "feat");
    escrever("src/modules/existente.ts", "editado no ramo\n");
    git("add", ".");
    git("commit", "-q", "-m", "edita");
    const r = rodar();
    expect(r.status, r.stderr).toBe(0);
  });

  it("passa editando e apagando no legado e criando em src/modulos", () => {
    repositorioComBase();
    escrever("src/modules/existente.ts", "mudou\n");
    git("rm", "-q", "src/analises/painel.css");
    escrever("src/modulos/tela/tela.jsx");
    git("add", ".");
    git("commit", "-q", "-m", "ok");
    const r = rodar();
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Legado sem arquivo novo");
  });
});
