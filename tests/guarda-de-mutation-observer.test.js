import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const GUARDA = resolve("scripts/check-no-new-mutation-observer.mjs");

/*
  Protege a correção de 10/09/2026.

  A guarda lia as linhas `+` do diff para decidir se havia observador novo. Isso
  confunde *usar* com *reescrever*: no #173 foi preciso passar o prettier em
  `analises-dark-mode-fix.js`, que nunca tinha sido formatado, e a reformatação
  reescreveu a linha de um observador que já existia. A linha reapareceu como
  adição e o Quality Gate reprovou um PR que não introduziu observador nenhum.

  A regra proíbe o número crescer, então é o número que se compara. Estes testes
  correm a guarda de verdade, num repositório descartável, porque o que interessa
  não é como o ficheiro está escrito — é o código de saída que ele devolve.
*/

let repo;

function git(...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

function escrever(caminho, conteudo) {
  const destino = join(repo, caminho);
  mkdirSync(join(destino, ".."), { recursive: true });
  writeFileSync(destino, conteudo);
}

function commitar(mensagem) {
  git("add", "-A");
  git("commit", "-q", "-m", mensagem);
}

function correrGuarda() {
  // `GITHUB_BASE_REF` do CI apontaria para um `origin/` que não existe aqui.
  const { GITHUB_BASE_REF, ...ambiente } = process.env;
  try {
    const saida = execFileSync(process.execPath, [GUARDA], {
      cwd: repo,
      encoding: "utf8",
      env: ambiente,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { codigo: 0, texto: saida };
  } catch (erro) {
    return { codigo: erro.status, texto: `${erro.stdout}${erro.stderr}` };
  }
}

const COM_OBSERVADOR = `export function ligar(alvo) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => m.target);
  });
  observer.observe(alvo, { childList: true });
}
`;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "guarda-mo-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "teste@exemplo.org");
  git("config", "user.name", "Teste");
  git("config", "core.autocrlf", "false");
  git("config", "commit.gpgsign", "false");
  escrever("src/antigo.js", COM_OBSERVADOR);
  escrever("src/limpo.js", "export const nada = 1;\n");
  commitar("base");
  git("checkout", "-q", "-b", "trabalho");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("a guarda deixa passar o que não acrescenta observador", () => {
  it("um observador só reescrito continua sendo o mesmo observador", () => {
    escrever(
      "src/antigo.js",
      COM_OBSERVADOR.replace("(mutations)", "(listaDeMutacoes)").replace(
        "(m) => m.target",
        "(mutacao) => mutacao.target",
      ),
    );
    commitar("reformatar");

    // A prova de que este é o caso que reprovava antes: a linha do observador
    // aparece como adição no diff, tal e qual no #173.
    const adicoes = git("diff", "--unified=0", "main", "HEAD", "--", "src")
      .split(/\r?\n/)
      .filter((l) => l.startsWith("+") && l.includes("MutationObserver"));
    expect(adicoes).toHaveLength(1);

    expect(correrGuarda().codigo).toBe(0);
  });

  it("apagar um observador não reprova", () => {
    escrever("src/antigo.js", "export const nada = 1;\n");
    commitar("remover");
    const { codigo, texto } = correrGuarda();
    expect(codigo).toBe(0);
    expect(texto).toContain("0 uso(s)");
  });

  it("mexer fora de src/ não conta", () => {
    escrever("scripts/qualquer.js", COM_OBSERVADOR);
    commitar("fora de src");
    expect(correrGuarda().codigo).toBe(0);
  });
});

describe("a guarda continua reprovando uso novo de verdade", () => {
  it("num ficheiro novo", () => {
    escrever("src/novo.js", COM_OBSERVADOR);
    commitar("observador novo");
    const { codigo, texto } = correrGuarda();
    expect(codigo).toBe(1);
    expect(texto).toContain("src/novo.js: 0 -> 1");
  });

  it("num ficheiro que já tinha um", () => {
    escrever("src/antigo.js", COM_OBSERVADOR + COM_OBSERVADOR);
    commitar("segundo observador");
    const { codigo, texto } = correrGuarda();
    expect(codigo).toBe(1);
    expect(texto).toContain("src/antigo.js: 1 -> 2");
  });

  /*
    Comparar o total deixaria isto passar: um a menos aqui, um a mais ali, soma
    igual. É por ficheiro que se compara.
  */
  it("mesmo quando outro ficheiro perde um ao mesmo tempo", () => {
    escrever("src/antigo.js", "export const nada = 1;\n");
    escrever("src/limpo.js", COM_OBSERVADOR);
    commitar("trocar de sítio");
    const { codigo, texto } = correrGuarda();
    expect(codigo).toBe(1);
    expect(texto).toContain("src/limpo.js: 0 -> 1");
  });
});
