import { execFileSync } from "node:child_process";
import { resolverBase } from "./arquivos-alterados.mjs";

/*
  Timestamp de migration único, antes do merge.

  Duas branches mescladas em paralelo podem escolher o mesmo horário para a
  migration nova (05/11/2026: 20261105190000_area_na_api.sql e
  20261105190000_fontes_apos_leitura_da_api_de_editais.sql). O teste
  tests/estado-das-migrations.test.js só via o repetido depois, já na main,
  e aí o jeito era registrar em REPETIDOS_CONHECIDOS — renumerar migration
  aplicada não pode.

  Este passo compara as migrations de supabase/migrations/ do pull request
  com as da ponta ATUAL da main (o CI faz o fetch dela antes) e:

  - FALHA quando uma migration nova usa um timestamp que a main já tem, ou
    que outra migration nova do mesmo PR também usa;
  - FALHA quando uma migration que está na main sumiu ou mudou de nome no PR
    (migration aplicada nunca é renumerada);
  - AVISA quando a migration nova tem timestamp menor que a última da main:
    ela roda fora de ordem num banco novo; o melhor é pôr um horário depois.

  "Nova" é a que existe no PR e não existe na main, comparando pelo nome
  inteiro. Com a branch atrasada (local), as migrations que só a main tem
  não contam como novas nem como apagadas.
*/

export const PASTA_DAS_MIGRATIONS = "supabase/migrations";

const NOME_COM_TIMESTAMP = /^(\d{8,14})_.+\.sql$/;

/** O timestamp do nome (sem pasta), ou `null` quando não há. */
export function timestampDe(caminho) {
  const nome = String(caminho).split("/").pop();
  return NOME_COM_TIMESTAMP.exec(nome)?.[1] ?? null;
}

const nomeDe = (caminho) => String(caminho).split("/").pop();

/**
 * Compara as migrations do PR (`agora`) com as da main (`naBase`).
 * `noInicio` é a lista de onde o ramo saiu da main (para saber o que o PR
 * apagou, e não o que a main criou depois); sem ele, usa `naBase`.
 * @returns {{ novas: string[], erros: string[], avisos: string[] }}
 */
export function compararMigrations(naBase, agora, noInicio = naBase) {
  const base = naBase.map(nomeDe).filter(timestampDe);
  const atuais = agora.map(nomeDe).filter(timestampDe);
  const inicio = noInicio.map(nomeDe).filter(timestampDe);
  const existeNaBase = new Set(base);
  const existeAgora = new Set(atuais);
  const novas = atuais.filter((nome) => !existeNaBase.has(nome)).sort();

  const daBasePorTimestamp = new Map();
  for (const nome of base) {
    const ts = timestampDe(nome);
    if (!daBasePorTimestamp.has(ts)) daBasePorTimestamp.set(ts, []);
    daBasePorTimestamp.get(ts).push(nome);
  }
  const ultimaDaBase = [...daBasePorTimestamp.keys()].sort().pop() ?? null;

  const erros = [];
  const avisos = [];
  const novasPorTimestamp = new Map();
  for (const nome of novas) {
    const ts = timestampDe(nome);
    const naMain = daBasePorTimestamp.get(ts);
    if (naMain)
      erros.push(
        `${nome}: o timestamp ${ts} já existe na main (${naMain.join(", ")}). Renomeie a migration NOVA deste PR para um horário livre, depois da última da main (${ultimaDaBase}); a da main já pode estar aplicada e não muda.`,
      );
    if (!novasPorTimestamp.has(ts)) novasPorTimestamp.set(ts, []);
    novasPorTimestamp.get(ts).push(nome);
    if (!naMain && ultimaDaBase && ts < ultimaDaBase)
      avisos.push(
        `${nome}: o timestamp ${ts} é anterior à última migration da main (${ultimaDaBase}). Num banco novo ela roda fora da ordem em que foi escrita; se não depende disso, renomeie para depois de ${ultimaDaBase}.`,
      );
  }
  for (const [ts, nomes] of novasPorTimestamp)
    if (nomes.length > 1)
      erros.push(
        `${nomes.join(", ")}: migrations novas deste PR com o mesmo timestamp ${ts}. Dê um horário diferente a cada uma.`,
      );

  const apagadas = inicio
    .filter((nome) => existeNaBase.has(nome) && !existeAgora.has(nome))
    .sort();
  for (const nome of apagadas)
    erros.push(
      `${nome}: está na main e sumiu (ou mudou de nome) neste PR. Migration já mesclada pode estar aplicada: não renumere nem apague; corrija com uma migration nova.`,
    );

  return { novas, erros, avisos };
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function migrationsEm(ref) {
  return git(["ls-tree", "--name-only", `${ref}:${PASTA_DAS_MIGRATIONS}`])
    .split(/\r?\n/)
    .filter(Boolean);
}

/*
  Onde o ramo saiu da base. No clone raso do CI não há histórico, mas lá o
  HEAD é o merge do PR com a main: a ponta da base serve.
*/
function pontoDePartida(base) {
  try {
    return git(["merge-base", "HEAD", base]) || base;
  } catch {
    return base;
  }
}

/* No GitHub Actions, o aviso vira anotação no PR. */
function avisar(texto) {
  if (process.env.GITHUB_ACTIONS) console.log(`::warning::${texto}`);
  else console.warn(`Aviso: ${texto}`);
}

function principal() {
  const base = resolverBase();
  if (!base) {
    console.error(
      "Sem a main para comparar (origin/main ou corporativo/main). No CI, o passo 'Baixar base das verificações incrementais' faz o fetch dela.",
    );
    process.exit(1);
  }
  const { novas, erros, avisos } = compararMigrations(
    migrationsEm(base),
    migrationsEm("HEAD"),
    migrationsEm(pontoDePartida(base)),
  );
  avisos.forEach(avisar);
  if (erros.length) {
    console.error(
      `Migrations em ${PASTA_DAS_MIGRATIONS}/ em conflito com ${base}:`,
    );
    erros.forEach((erro) => console.error(`  ${erro}`));
    process.exit(1);
  }
  console.log(
    novas.length
      ? `Migrations novas com timestamp livre em ${base}: ${novas.join(", ")}.`
      : `Nenhuma migration nova em relação a ${base}.`,
  );
}

// Roda só quando chamado direto (o teste importa `compararMigrations`).
if (
  String(process.argv[1] || "")
    .split("\\")
    .join("/")
    .endsWith("scripts/check-migrations-timestamp-unico.mjs")
) {
  principal();
}
