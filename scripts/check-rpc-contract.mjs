import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

/*
  Verificação ESTÁTICA do contrato de RPC (ver `src/lib/rpc-contrato.js`).

  Roda em todo build, sem rede e sem credencial: toda chamada `.rpc("nome")` do
  frontend precisa estar declarada no contrato, e todo nome declarado precisa ser
  usado. Impede que o mapa central vire ficção enquanto o código segue por fora.

  A verificação **contra o banco** vive em `check-rpc-contract-db.mjs` e é um job
  separado, de propósito. Uma primeira versão deste ficheiro tentava fazer as duas
  coisas aqui, lendo a especificação OpenAPI do PostgREST com a chave pública —
  e estava errada: o OpenAPI segue os privilégios da role que pergunta. Com
  `anon`, 21 das 22 funções existentes ficam invisíveis, porque são de
  `authenticated`. O build cairia acusando ausência de funções que existem.
*/

const RAIZ_FONTE = "src";
const { CONTRATO_RPC } = await import(
  pathToFileURL(join(process.cwd(), "src/lib/rpc-contrato.js")).href
);

function percorrer(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? percorrer(caminho) : [caminho];
  });
}

// ── Passagem estática ─────────────────────────────────────────────────────
const usadas = new Map();
for (const ficheiro of percorrer(RAIZ_FONTE).filter((p) => p.endsWith(".js"))) {
  const caminho = relative(".", ficheiro).replaceAll("\\", "/");
  if (caminho === "src/lib/rpc-contrato.js") continue;
  const fonte = readFileSync(ficheiro, "utf8");

  const constantes = new Map();
  for (const m of fonte.matchAll(
    /const\s+(RPC_[A-Z_0-9]+)\s*=\s*"([a-z0-9_]+)"/g,
  )) {
    constantes.set(m[1], m[2]);
  }

  const registar = (nome) => {
    if (!nome) return;
    if (!usadas.has(nome)) usadas.set(nome, new Set());
    usadas.get(nome).add(caminho);
  };

  for (const m of fonte.matchAll(
    /\.rpc\(\s*(?:"([a-z0-9_]+)"|(RPC_[A-Z_0-9]+))/g,
  )) {
    registar(m[1] || constantes.get(m[2]));
  }

  /*
    Nem toda RPC passa pelo cliente Supabase. `obter_branding_acesso_publico` é
    pedida por `fetch` direto, de propósito, para não herdar a sessão do
    utilizador — e nem por isso deixa de ser dependência do frontend.

    Uma constante `RPC_*` cujo valor nomeia uma função do contrato conta, por
    isso, como uso: é dela que a URL é montada. Sem esta regra, a verificação
    acusaria como órfã uma função de que a tela de acesso depende.
  */
  for (const nome of constantes.values()) {
    if (CONTRATO_RPC[nome]) registar(nome);
  }
}

const problemas = [];

for (const [nome, ficheiros] of usadas) {
  if (!CONTRATO_RPC[nome]) {
    problemas.push(
      `RPC "${nome}" é chamada em ${[...ficheiros].join(", ")} mas não está no contrato.`,
    );
  }
}

for (const nome of Object.keys(CONTRATO_RPC)) {
  if (!usadas.has(nome)) {
    problemas.push(`RPC "${nome}" está no contrato mas nenhum módulo a chama.`);
  }
}

if (problemas.length) {
  console.error("Contrato de RPC desalinhado do código:");
  problemas.forEach((p) => console.error(`- ${p}`));
  process.exit(1);
}

console.log(
  `Contrato de RPC: ${usadas.size} função(ões) usada(s), todas declaradas.`,
);
