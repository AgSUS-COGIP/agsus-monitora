import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compararComLinhaDeBase,
  contarDesvios,
  marcadoresInvalidos,
  TIPOS_DE_DESVIO,
} from "../scripts/check-acabamento-so-encolhe.mjs";

/*
  O acabamento só encolhe: o número de desvios de token por arquivo (cor, raio,
  sombra, z-index, curva, !important…) nunca aumenta em relação à linha de
  base. Arquivo novo entra com limite zero. A norma é docs/design-system-agsus.md.
*/

const SCRIPT = resolve("scripts/check-acabamento-so-encolhe.mjs");
const css = (texto, caminho = "src/x.css") => contarDesvios(caminho, texto);

describe("contarDesvios", () => {
  it("os tipos de desvio", () => {
    expect(TIPOS_DE_DESVIO).toEqual([
      "cor",
      "important",
      "zIndex",
      "raio",
      "sombra",
      "curva",
      "animaLayout",
      "blur",
    ]);
  });

  it("devolve todos os tipos, zerados quando não há desvio", () => {
    expect(css("a{color:var(--text)}")).toEqual({
      cor: 0,
      important: 0,
      zIndex: 0,
      raio: 0,
      sombra: 0,
      curva: 0,
      animaLayout: 0,
      blur: 0,
    });
  });

  it("cor: hex, rgb(), rgba() e hsl() contam; tokens.css não", () => {
    expect(css("a{color:#fff}").cor).toBe(1);
    expect(css("a{color:#ffffff80}").cor).toBe(1);
    expect(css("a{color:rgb(0 0 0)}").cor).toBe(1);
    expect(css("a{color:rgba(0,0,0,.5)}").cor).toBe(1);
    expect(css("a{color:hsl(10 10% 10%)}").cor).toBe(1);
    expect(contarDesvios("src/styles/tokens.css", "--c:#fff;").cor).toBe(0);
  });

  it("cor: conta uma por linha, e não conta var() nem comentário nem url()", () => {
    expect(css("a{\n color:#fff;\n background:#000;\n}").cor).toBe(2);
    expect(css("a{background:linear-gradient(#fff,#000)}").cor).toBe(1);
    expect(css("/* #fff */ a{background:url(#fff)}").cor).toBe(0);
    expect(css("/*\n  #fff e #000\n*/\na{color:var(--text)}").cor).toBe(0);
  });

  it("raio: 0, inherit, initial, unset e calc() com var() não contam; 999px sim", () => {
    for (const v of [
      "0",
      "0px",
      "inherit",
      "initial",
      "unset",
      "calc(var(--radius-lg) - 2px)",
    ])
      expect(css(`a{border-radius:${v}}`).raio, v).toBe(0);
    expect(css("a{border-radius:999px}").raio).toBe(1);
    expect(css("a{border-radius:9999px}").raio).toBe(1);
    expect(css("a{border-radius:0 0 8px 8px}").raio).toBe(1);
  });

  it("cor: seletor não conta; fallback de var() conta", () => {
    expect(css("#abc{color:var(--x)}").cor).toBe(0);
    expect(css("a[href='#abc']{margin:0}").cor).toBe(0);
    expect(css("#abc{color:#fff}").cor).toBe(1);
    expect(css("a{color:var(--x, #fff)}").cor).toBe(1);
    expect(
      css("a{\n background:linear-gradient(\n #fff,\n #000\n );\n}").cor,
    ).toBe(2);
  });

  it("z-index: número conta, var() não", () => {
    expect(css("a{z-index:3}").zIndex).toBe(1);
    expect(css("a{z-index:-1}").zIndex).toBe(1);
    expect(css("a{z-index:var(--z-toast)}").zIndex).toBe(0);
  });

  it("!important conta", () => {
    expect(css("a{color:var(--x)!important}").important).toBe(1);
    expect(css("a{color:var(--x) ! important}").important).toBe(1);
  });

  it("raio: valor fixo conta, var() não", () => {
    expect(css("a{border-radius:8px}").raio).toBe(1);
    expect(css("a{border-radius:var(--radius-lg)}").raio).toBe(0);
  });

  it("sombra: valor à mão conta; var() e none não", () => {
    expect(css("a{box-shadow:0 1px 2px rgba(0,0,0,.2)}").sombra).toBe(1);
    expect(css("a{box-shadow:var(--shadow-md)}").sombra).toBe(0);
    expect(css("a{box-shadow:none}").sombra).toBe(0);
  });

  it("curva: ease, linear e duração literal contam; tokens não", () => {
    expect(css("a{transition:opacity 120ms ease-in-out}").curva).toBe(1);
    expect(css("a{transition:opacity var(--duration-fast) ease}").curva).toBe(
      1,
    );
    expect(
      css("a{animation:giro var(--duration-slow) linear infinite}").curva,
    ).toBe(1);
    expect(css("a{transition:opacity .2s var(--ease-standard)}").curva).toBe(1);
    expect(
      css("a{transition:opacity var(--duration-fast) var(--ease-standard)}")
        .curva,
    ).toBe(0);
  });

  it("curva: declaração em várias linhas conta uma vez", () => {
    expect(
      css("a{\n transition:\n  opacity 1s ease,\n  transform 1s ease;\n}")
        .curva,
    ).toBe(1);
  });

  it("animaLayout: transition que cita width, height, top, left ou all", () => {
    expect(
      css("a{transition:width var(--duration-fast) var(--ease-standard)}")
        .animaLayout,
    ).toBe(1);
    expect(
      css("a{transition:all var(--duration-fast) var(--ease-standard)}")
        .animaLayout,
    ).toBe(1);
    expect(
      css("a{transition:opacity var(--duration-fast) var(--ease-standard)}")
        .animaLayout,
    ).toBe(0);
    expect(
      css("a{transition:border-left-color var(--duration-fast)}").animaLayout,
    ).toBe(0);
  });

  it("blur: backdrop-filter só passa em bloco com position fixed ou sticky", () => {
    expect(css("a{backdrop-filter:blur(4px)}").blur).toBe(1);
    expect(css("a{position:relative;backdrop-filter:blur(4px)}").blur).toBe(1);
    expect(css("a{position:fixed;backdrop-filter:blur(4px)}").blur).toBe(0);
    expect(css("a{backdrop-filter:blur(4px);position:sticky}").blur).toBe(0);
    expect(
      css(
        "@media (min-width:1px){a{backdrop-filter:blur(4px)}b{position:fixed}}",
      ).blur,
    ).toBe(1);
  });

  it("marcador com motivo isenta a linha", () => {
    expect(
      css(
        "a{border-radius:50% /* acabamento: permitido(raio) — círculo do avatar */}",
      ).raio,
    ).toBe(0);
    expect(
      css(
        "a{\n z-index:2; /* acabamento: permitido(zIndex) — local ao cartão */\n}",
      ).zIndex,
    ).toBe(0);
  });

  it("marcador sem motivo não isenta", () => {
    expect(
      css("a{border-radius:50% /* acabamento: permitido(raio) — */}").raio,
    ).toBe(1);
    expect(css("a{border-radius:50% /* acabamento: permitido */}").raio).toBe(
      1,
    );
    expect(
      css("a{border-radius:50% /* acabamento: permitido(raio) —   */}").raio,
    ).toBe(1);
  });

  it("o marcador é por tipo: sombra não isenta a cor da mesma linha", () => {
    expect(
      css(
        "a{\n box-shadow:0 4px 8px #000; /* acabamento: permitido(sombra) — composição */\n}",
      ),
    ).toMatchObject({ sombra: 0, cor: 1 });
    expect(
      css(
        "a{\n box-shadow:0 4px 8px #000; /* acabamento: permitido(cor,sombra) — composição */\n}",
      ),
    ).toMatchObject({ sombra: 0, cor: 0 });
    expect(
      css(
        "a{\n box-shadow:0 4px 8px #000; /* acabamento: permitido(cor , sombra) - composição */\n}",
      ),
    ).toMatchObject({ sombra: 0, cor: 0 });
  });

  it("marcador sem tipo ou com tipo desconhecido não isenta nada", () => {
    expect(
      css("a{\n border-radius:50%; /* acabamento: permitido — círculo */\n}")
        .raio,
    ).toBe(1);
    expect(
      css("a{\n border-radius:50%; /* acabamento: permitido() — círculo */\n}")
        .raio,
    ).toBe(1);
    expect(
      css(
        "a{\n border-radius:50%; /* acabamento: permitido(raio,cores) — círculo */\n}",
      ).raio,
    ).toBe(1);
    expect(
      marcadoresInvalidos("a{\n z-index:2; /* acabamento: permitido — x */\n}"),
    ).toEqual([
      { linha: 2, texto: "z-index:2; /* acabamento: permitido — x */" },
    ]);
    expect(
      marcadoresInvalidos(
        "a{ z-index:2; /* acabamento: permitido(zIndex) — x */ }",
      ),
    ).toEqual([]);
  });

  it("anel de foco (0 0 0 spread) e inset não contam como sombra; sombra com blur conta", () => {
    expect(css("a{box-shadow:0 0 0 3px var(--focus-ring)}").sombra).toBe(0);
    expect(
      css("a{box-shadow:0 0 0 2px var(--a, var(--b)), 0 0 0 3px red}").sombra,
    ).toBe(0);
    expect(css("a{box-shadow:inset 4px 0 0 var(--x)}").sombra).toBe(0);
    expect(css("a{box-shadow:0 0 0 1px red, var(--shadow-md)}").sombra).toBe(0);
    expect(css("a{box-shadow:0 0 0 3px #fff}")).toMatchObject({
      sombra: 0,
      cor: 1,
    });
    expect(css("a{box-shadow:0 4px 12px rgba(0,0,0,.2)}").sombra).toBe(1);
    expect(css("a{box-shadow:0 0 8px 2px red}").sombra).toBe(1);
    expect(css("a{box-shadow:0 0 0 1px red, 0 8px 16px red}").sombra).toBe(1);
  });

  it("o marcador vale só para a linha dele", () => {
    expect(
      css(
        "a{\n border-radius:50%; /* acabamento: permitido(raio) — círculo */\n box-shadow:0 0 2px red;\n}",
      ),
    ).toMatchObject({ raio: 0, sombra: 1 });
  });

  it(".tsx: só conta cor dentro de literal de string", () => {
    const tsx = (texto) => contarDesvios("src/ui/x.tsx", texto);
    expect(tsx('style={{ color: "#fff" }}').cor).toBe(1);
    expect(tsx("const c = '#abc';").cor).toBe(1);
    expect(tsx("const c = `rgb(0 0 0)`;").cor).toBe(1);
    expect(tsx("// #fff").cor).toBe(0);
    expect(tsx("/* #fff */ const a = 1;").cor).toBe(0);
    expect(tsx("const a = 1; // cor '#fff'").cor).toBe(0);
    expect(tsx("const a = n & 0xfff;").cor).toBe(0);
    expect(tsx('style={{ color: "var(--text)" }}').cor).toBe(0);
  });

  it(".tsx: o marcador isenta e outros tipos não se aplicam", () => {
    const tsx = (texto) => contarDesvios("src/ui/x.tsx", texto);
    expect(
      tsx('const c = "#fff"; // acabamento: permitido(cor) — cor do mapa').cor,
    ).toBe(0);
    expect(tsx('const c = "#fff"; // acabamento: permitido(cor) —').cor).toBe(
      1,
    );
    expect(tsx('const s = "z-index:3; border-radius:8px";')).toMatchObject({
      zIndex: 0,
      raio: 0,
    });
  });
});

describe("compararComLinhaDeBase", () => {
  const zerado = (parcial) => ({ ...parcial });

  it("só devolve as pioras, com antes e agora", () => {
    expect(
      compararComLinhaDeBase(
        { "a.css": zerado({ cor: 2, raio: 1 }) },
        { "a.css": zerado({ cor: 3, raio: 1 }) },
      ),
    ).toEqual([{ caminho: "a.css", tipo: "cor", antes: 2, agora: 3 }]);
  });

  it("ficar igual ou cair não é piora", () => {
    expect(
      compararComLinhaDeBase(
        { "a.css": { cor: 2, raio: 4 } },
        { "a.css": { cor: 2, raio: 1 } },
      ),
    ).toEqual([]);
  });

  it("arquivo novo tem limite zero", () => {
    expect(compararComLinhaDeBase({}, { "novo.css": { cor: 1 } })).toEqual([
      { caminho: "novo.css", tipo: "cor", antes: 0, agora: 1 },
    ]);
  });

  it("arquivo só na base (apagado) não acusa nada", () => {
    expect(compararComLinhaDeBase({ "velho.css": { cor: 5 } }, {})).toEqual([]);
  });

  it("tipo que a base não lista tem limite zero", () => {
    expect(
      compararComLinhaDeBase(
        { "a.css": { cor: 1 } },
        { "a.css": { cor: 1, blur: 2 } },
      ),
    ).toEqual([{ caminho: "a.css", tipo: "blur", antes: 0, agora: 2 }]);
  });
});

describe("check-acabamento-so-encolhe.mjs num repositório de verdade", () => {
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

  function escrever(caminho, texto) {
    const completo = join(pasta, caminho);
    mkdirSync(dirname(completo), { recursive: true });
    writeFileSync(completo, texto);
  }

  function rodar(...args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: pasta,
      encoding: "utf8",
    });
  }

  const BASE = "scripts/acabamento-linha-de-base.json";

  function repositorio() {
    pasta = mkdtempSync(join(tmpdir(), "acabamento-"));
    git("init", "-q", "-b", "main");
    escrever("src/a.css", "a{color:#fff;border-radius:8px}\n");
    git("add", ".");
  }

  it("--atualizar cria a linha de base e depois a verificação passa", () => {
    repositorio();
    const gravou = rodar("--atualizar");
    expect(gravou.status, gravou.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(pasta, BASE), "utf8"))).toEqual({
      "src/a.css": { cor: 1, raio: 1 },
    });
    const r = rodar();
    expect(r.status, r.stderr).toBe(0);
  });

  it("falha com a piora e aponta arquivo, tipo, antes e agora", () => {
    repositorio();
    rodar("--atualizar");
    escrever("src/a.css", "a{color:#fff;border-radius:8px;z-index:3}\n");
    escrever("src/novo.css", "b{color:#000}\n");
    git("add", ".");
    const r = rodar();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("src/a.css");
    expect(r.stderr).toContain("zIndex");
    expect(r.stderr).toContain("0 → 1");
    expect(r.stderr).toContain("src/novo.css");
    expect(r.stderr).toContain("docs/design-system-agsus.md");
  });

  it("--atualizar recusa gravar se algum número sobe", () => {
    repositorio();
    rodar("--atualizar");
    const antes = readFileSync(join(pasta, BASE), "utf8");
    escrever(
      "src/a.css",
      "a{\ncolor:#fff;\nbackground:#000;\nborder-radius:8px}\n",
    );
    const r = rodar("--atualizar");
    expect(r.status).toBe(1);
    expect(readFileSync(join(pasta, BASE), "utf8")).toBe(antes);
  });

  it("--atualizar baixa a linha de base quando o arquivo melhora", () => {
    repositorio();
    rodar("--atualizar");
    escrever("src/a.css", "a{color:var(--text)}\n");
    const r = rodar("--atualizar");
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(pasta, BASE), "utf8"))).toEqual({});
  });
});
