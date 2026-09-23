import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

/*
  Portão de arquitetura do Supabase Auth.

  Até 08/09/2026 este script varria apenas `src/`. Foi por isso que uma cópia
  esquecida de `legacy-app.js` na raiz do repositório — com cliente próprio,
  `flowType: "implicit"` e `detectSessionInUrl: true` — sobreviveu dois meses sem
  aparecer em nenhum relatório: o arquivo estava morto, mas o portão dizia que a
  dívida era do `src/modules/legacy-app.js`, onde ela já não existia.

  Agora a varredura cobre o repositório inteiro, e a lista de tetos está vazia:
  não há nenhuma ocorrência legada restante. Qualquer reaparecimento bloqueia o
  build, em qualquer diretório.
*/

const RAIZES = ["."];
const IGNORAR = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  "test-results",
  "playwright-report",
  ".vercel",
  // Os testes citam estes padrões para afirmar que não existem em produção.
  "tests",
]);

// O próprio verificador contém os padrões que procura.
const ESTE_FICHEIRO = "scripts/check-supabase-auth-architecture.mjs";
const EXTENSOES = new Set([".js", ".mjs", ".ts", ".html"]);

const PADROES = [
  [
    "window-client",
    "cliente via window.supabase",
    /window\.supabase\.createClient\s*\(/g,
  ],
  [
    "implicit-flow",
    "fluxo OAuth implícito",
    /flowType\s*:\s*["']implicit["']/g,
  ],
  [
    "url-session",
    "detecção automática da sessão",
    /detectSessionInUrl\s*:\s*true/g,
  ],
  [
    "extra-client",
    "cliente Supabase fora de lib/supabaseClient.js",
    /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*["']@supabase\/supabase-js["']/g,
  ],
];

/*
  O único ficheiro autorizado a instanciar o cliente. Não é um teto legado a
  reduzir: é a fronteira desejada, e deve continuar valendo.
*/
const FONTE_UNICA = new Map([
  ["src/lib/supabaseClient.js", new Map([["extra-client", 1]])],
]);

function percorrer(dir) {
  return readdirSync(dir).flatMap((nome) => {
    if (IGNORAR.has(nome)) return [];
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? percorrer(caminho) : [caminho];
  });
}

const violacoes = [];

for (const raiz of RAIZES) {
  for (const ficheiro of percorrer(raiz).filter((p) =>
    EXTENSOES.has(extname(p)),
  )) {
    const caminho = relative(".", ficheiro).replaceAll("\\", "/");
    if (caminho === ESTE_FICHEIRO) continue;
    // Saída compilada do frontend Laravel/Vite. Assim como `dist/`, contém
    // dependências empacotadas (inclusive internals do Supabase) e não é fonte
    // de arquitetura da aplicação. O código-fonte em `laravel/resources/`
    // continua sendo verificado normalmente.
    if (caminho.startsWith("laravel/public/assets/")) continue;
    const conteudo = readFileSync(ficheiro, "utf8");

    for (const [id, rotulo, padrao] of PADROES) {
      const total = [...conteudo.matchAll(padrao)].length;
      if (!total) continue;

      const permitido = FONTE_UNICA.get(caminho)?.get(id) || 0;
      if (total > permitido) {
        violacoes.push(
          `${caminho}: ${rotulo} tem ${total} ocorrência(s); máximo permitido: ${permitido}`,
        );
      }
    }
  }
}

if (violacoes.length) {
  console.error("Regressões na arquitetura Supabase Auth:");
  violacoes.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(
  "Arquitetura Supabase Auth validada: um único cliente, sem fluxo implícito.",
);
