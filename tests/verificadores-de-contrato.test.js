import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const estatico = readFileSync("scripts/check-rpc-contract.mjs", "utf8");
const contraBanco = readFileSync("scripts/check-rpc-contract-db.mjs", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

/*
  Os comentários destes ficheiros descrevem o erro corrigido e citam `/rest/v1/`,
  `Bearer` e `VITE_` para explicá-lo. Verificar o texto cru acusaria a própria
  explicação; o que interessa é o código.
*/
const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const estaticoCodigo = semComentarios(estatico);
const contraBancoCodigo = semComentarios(contraBanco);

/*
  Protege a correção de 08/09/2026.

  A primeira versão da verificação lia a especificação OpenAPI do PostgREST com a
  chave publicável e concluía dali quais RPCs existem. O OpenAPI, porém, reflete
  os privilégios da role que pergunta: com `anon`, 21 das 22 funções existentes
  ficam invisíveis porque são de `authenticated`. Ligada ao build, essa
  verificação derrubaria tudo acusando ausência de funções que existem.
*/
describe("verificação estática do contrato", () => {
  it("não faz rede nem lê credencial", () => {
    expect(estaticoCodigo).not.toMatch(/fetch\s*\(/);
    expect(estaticoCodigo).not.toMatch(/process\.env\.[A-Z_]*SUPABASE/);
    expect(estaticoCodigo).not.toMatch(/apikey/i);
  });

  it("é a única verificação de contrato presa ao build", () => {
    expect(pkg.scripts.build).toContain("check:rpc-contract");
    expect(pkg.scripts.build).not.toContain("check:rpc-contract:db");
  });
});

describe("verificação contra o banco", () => {
  it("existe como comando próprio, fora do build", () => {
    expect(pkg.scripts["check:rpc-contract:db"]).toBeTruthy();
  });

  it("não lê nenhuma variável VITE_, que iria para o bundle", () => {
    const leituras = [
      ...contraBancoCodigo.matchAll(/process\.env\.([A-Z0-9_]+)/g),
    ].map((m) => m[1]);
    expect(leituras.length).toBeGreaterThan(0);
    for (const nome of leituras) {
      expect(
        nome,
        `${nome} não pode ser origem de credencial de servidor`,
      ).not.toMatch(/^VITE_/);
    }
  });

  /*
    A chave publicável não é token de usuário autenticado. Usá-la como cabeçalho
    de autorização para tentar enxergar RPCs de `authenticated` seria tratar chave
    pública como credencial privilegiada — o erro original, com outra roupa.
  */
  it("não consulta o PostgREST nem usa chave pública como credencial", () => {
    expect(contraBancoCodigo).not.toMatch(/rest\/v1/);
    expect(contraBancoCodigo).not.toMatch(/Bearer/);
    expect(contraBancoCodigo).not.toMatch(/apikey/i);
  });

  it("consulta o catálogo do PostgreSQL em sessão somente-leitura", () => {
    expect(contraBancoCodigo).toContain("pg_proc");
    expect(contraBancoCodigo).toContain(
      "set session characteristics as transaction read only",
    );
  });

  it("depende de pg apenas como dependência de desenvolvimento", () => {
    expect(pkg.devDependencies?.pg).toBeTruthy();
    expect(pkg.dependencies?.pg).toBeUndefined();
  });
});

/*
  Os três scripts que falam com o banco partilham a mesma regra: credencial de
  servidor, nunca uma variável `VITE_*` — tudo com esse prefixo entra no bundle
  Vite e viaja para o navegador de quem abre a página.
*/
describe("scripts que falam com o banco", () => {
  const scripts = [
    "scripts/check-rpc-contract-db.mjs",
    "scripts/validar-migration-recusar.mjs",
    "scripts/capturar-baseline-rpcs.mjs",
    "scripts/medir-cronograma.mjs",
  ];

  it("nenhum lê variável VITE_", () => {
    for (const caminho of scripts) {
      const codigo = semComentarios(readFileSync(caminho, "utf8"));
      const leituras = [...codigo.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(
        (m) => m[1],
      );
      expect(leituras.length, `${caminho} não lê ambiente`).toBeGreaterThan(0);
      for (const nome of leituras) {
        expect(nome, `${caminho} lê ${nome}`).not.toMatch(/^VITE_/);
      }
    }
  });

  it("nenhum é importado pelo frontend", () => {
    const fontes = readdirSync("src", { recursive: true })
      .filter((n) => String(n).endsWith(".js"))
      .map((n) => readFileSync(join("src", String(n)), "utf8"))
      .join(String.fromCharCode(10));
    for (const caminho of scripts) {
      expect(fontes, `${caminho} alcançado pelo frontend`).not.toContain(
        caminho.split("/").pop(),
      );
    }
  });

  /*
    Chamar a RPC de recusa é escrever. A validação só pode fazê-lo dentro de
    transação revertida — se um `begin` deixar de ter `rollback`, o teste cai.
  */
  it("a validação da recusa reverte toda transação que abre", () => {
    const codigo = semComentarios(
      readFileSync("scripts/validar-migration-recusar.mjs", "utf8"),
    );
    const aberturas = (codigo.match(/query\("begin"\)/g) || []).length;
    const revertidas = (codigo.match(/query\("rollback"\)/g) || []).length;
    expect(aberturas).toBeGreaterThan(0);
    expect(revertidas).toBe(aberturas);
    expect(codigo).not.toMatch(/query\("commit"\)/);
  });

  /*
    O texto do ficheiro gerado menciona `drop function` ao descrever o rollback,
    e procurar a palavra solta acusaria essa menção. O que importa é o que o
    script manda executar: cada `cliente.query(` precisa começar por leitura.
  */
  it("a captura de linha de base só executa leitura", () => {
    const codigo = semComentarios(
      readFileSync("scripts/capturar-baseline-rpcs.mjs", "utf8"),
    );
    expect(codigo).toContain(
      "set session characteristics as transaction read only",
    );

    const comandos = codigo
      .split("cliente.query(")
      .slice(1)
      .map((trecho) =>
        trecho
          .replace(/^[\s`"']+/, "")
          .slice(0, 60)
          .toLowerCase(),
      );

    expect(comandos.length).toBeGreaterThan(0);
    for (const comando of comandos) {
      expect(
        comando.startsWith("select") ||
          comando.startsWith("set session characteristics"),
        `comando que não é leitura: ${comando}`,
      ).toBe(true);
    }
  });
});

/*
  Numa template literal, `\b` é o caractere de retrocesso, não a âncora de
  palavra. `new RegExp(`\b${nome}\b`)` compila um padrão que procura bytes de
  controle e nunca casa — silenciosamente.

  Não é hipótese: foi assim que `check-rpc-contract-db.mjs` reprovou a assinatura
  de `recusar_solicitacao_acesso` na primeira execução contra um Postgres real,
  com a assinatura visivelmente correta na própria mensagem de erro. O ESLint não
  vê: `no-control-regex` só olha literais de expressão regular.
*/
describe("expressões regulares montadas em template literal", () => {
  const ficheiros = readdirSync("scripts")
    .filter((n) => n.endsWith(".mjs"))
    .map((n) => ({ nome: n, fonte: readFileSync(join("scripts", n), "utf8") }));

  it("usam String.raw quando incluem barra invertida", () => {
    for (const { nome, fonte } of ficheiros) {
      const montagens = [
        ...semComentarios(fonte).matchAll(
          /new RegExp\(\s*(String\.raw)?`([^`]*)`/g,
        ),
      ];
      for (const [, cru, padrao] of montagens) {
        if (!padrao.includes("\\")) continue;
        expect(
          cru,
          `${nome}: RegExp com barra invertida sem String.raw — "${padrao}"`,
        ).toBe("String.raw");
      }
    }
  });
});

describe("reutilização de servidor no Playwright", () => {
  const config = readFileSync("playwright.config.js", "utf8");

  /*
    Reutilizar servidor já em execução produziu um verde falso: um preview antigo
    servia build anterior, e a suíte passou contra HTML que não existia mais.
  */
  it("não reutiliza servidor por padrão", () => {
    expect(config).not.toContain("reuseExistingServer: !process.env.CI");
    expect(config).toMatch(
      /reuseExistingServer:\s*process\.env\.PLAYWRIGHT_REUSE_SERVER === "1"/,
    );
  });
});

/*
  A suíte não pode voltar a depender da ausência de ambiente para não falar com
  produção. Foi assim que um teste começou a chamar o Supabase real: bastou
  existir um `.env.local`, porque o Vitest carrega as variáveis pelo Vite.
*/
describe("segurança dos testes", () => {
  const configVitest = readFileSync("vitest.config.js", "utf8");
  const guarda = readFileSync("tests/setup/rede-bloqueada.js", "utf8");

  it("a rede é bloqueada por omissão em toda a suíte", () => {
    expect(configVitest).toContain("setupFiles");
    expect(configVitest).toContain("tests/setup/rede-bloqueada.js");
  });

  it("o bloqueio nomeia a URL em vez de falhar em silêncio", () => {
    expect(guarda).toContain("Teste tentou falar com a rede");
    expect(guarda).toContain("beforeEach");
    expect(guarda).toContain("afterEach");
  });

  /*
    O que importa é o que o git carrega, não o que existe no disco. A versão
    anterior listava o diretório, então punia quem seguisse o README — que manda
    criar `.env.local` — mesmo com o ficheiro devidamente ignorado. Perguntar ao
    git verifica a promessa que o nome do teste faz.
  */
  it("nenhum ficheiro de ambiente está versionado", () => {
    const rastreados = execFileSync("git", ["ls-files", "-z"], {
      encoding: "utf8",
    })
      .split("\0")
      .filter((nome) => /^\.env/.test(nome) && nome !== ".env.example");
    expect(rastreados).toEqual([]);
  });

  it("o .gitignore cobre os ficheiros de ambiente locais", () => {
    const ignorados = readFileSync(".gitignore", "utf8");
    expect(ignorados).toMatch(/^\.env$/m);
    expect(ignorados).toMatch(/^\.env\.\*$/m);
    expect(ignorados).toMatch(/^!\.env\.example$/m);
  });
});
