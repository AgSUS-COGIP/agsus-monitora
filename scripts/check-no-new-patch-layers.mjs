import { execFileSync } from "node:child_process";

/*
  Sem novas camadas de remendo.

  O MONITORA acumulou arquivos que consertam outros por fora (`*-fix`,
  `*-refinement`, `*-enhancements`, `post-157-…`) e módulos que trocam funções
  globais já definidas (`window.navigate = …`). Cada camada depende da anterior
  e mexer ficou arriscado. A regra: mudar a fonte, onde a coisa é definida.

  Como no check de MutationObserver, compara-se a QUANTIDADE com a base, não as
  linhas do diff: os remendos que já existem podem ser editados (e devem ser
  absorvidos pela fonte e apagados); o que não pode é o número crescer.
*/

const AREA = "src";

// Nome de arquivo que anuncia remendo.
const NOME_DE_REMENDO =
  /(^|[-_.])(fix|fixes|hotfix|patch|patches|refinement|refinements|enhancement|enhancements|recovery|tuning|override|overrides|workaround|regression|stability)([-_.]|$)|(^|[-_])post-?\d+/i;

// Troca de função global já definida por outro módulo.
const TROCA_DE_GLOBAL =
  /window\.(navigate|saveAdminSettings|openPanel|renderConfigForm|buildNav)\s*=(?!=)/g;

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function existe(ref) {
  try {
    git(["rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
}

function resolveBase() {
  const candidatos = [
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "origin/main",
    "main",
    "HEAD~1",
  ].filter(Boolean);
  const base = candidatos.find(existe);
  if (!base) {
    throw new Error(
      "Não foi possível determinar a base para a verificação de remendos.",
    );
  }
  return base;
}

export function ehNomeDeRemendo(caminho) {
  const nome = caminho
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "");
  return NOME_DE_REMENDO.test(nome);
}

function arquivosDeRemendo(ref) {
  return git(["ls-tree", "-r", "--name-only", ref, "--", AREA])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(ehNomeDeRemendo);
}

function trocasDeGlobal(ref) {
  let saida;
  try {
    // O git grep (ERE) não aceita o lookahead; o `==` é descartado abaixo.
    saida = git([
      "grep",
      "-n",
      "-E",
      "window[.](navigate|saveAdminSettings|openPanel|renderConfigForm|buildNav)[[:space:]]*=",
      ref,
      "--",
      AREA,
    ]);
  } catch {
    // `git grep` sai com 1 quando não há ocorrência.
    return new Map();
  }
  const porArquivo = new Map();
  for (const linha of saida.split(/\r?\n/).filter(Boolean)) {
    // formato: ref:caminho:linha:conteúdo
    const semRef = linha.slice(linha.indexOf(":") + 1);
    const caminho = semRef.slice(0, semRef.indexOf(":"));
    const conteudo = semRef.slice(semRef.indexOf(":", caminho.length + 1) + 1);
    if (conteudo.trim().startsWith("//")) continue;
    const quantidade = (conteudo.match(TROCA_DE_GLOBAL) || []).length;
    porArquivo.set(caminho, (porArquivo.get(caminho) || 0) + quantidade);
  }
  return porArquivo;
}

function principal() {
  const base = resolveBase();

  const antes = new Set(arquivosDeRemendo(base));
  const agora = arquivosDeRemendo("HEAD");
  const novos = agora.filter((caminho) => !antes.has(caminho));

  const globaisAntes = trocasDeGlobal(base);
  const globaisAgora = trocasDeGlobal("HEAD");
  const somar = (mapa) => [...mapa.values()].reduce((a, b) => a + b, 0);
  const totalAntes = somar(globaisAntes);
  const totalAgora = somar(globaisAgora);
  const cresceram = [...globaisAgora]
    .filter(([caminho, n]) => n > (globaisAntes.get(caminho) || 0))
    .map(
      ([caminho, n]) =>
        `  ${caminho}: ${globaisAntes.get(caminho) || 0} -> ${n}`,
    );

  let falhou = false;
  if (novos.length) {
    falhou = true;
    console.error(
      "Arquivo novo com nome de remendo em src/ (fix, refinement, enhancements, post-N…):",
    );
    novos.forEach((caminho) => console.error(`  ${caminho}`));
    console.error(
      "Mude a fonte onde o comportamento é definido, em vez de consertar por fora.",
    );
  }
  if (totalAgora > totalAntes) {
    falhou = true;
    console.error(
      `Nova troca de função global (window.navigate/saveAdminSettings/…): ${totalAntes} -> ${totalAgora}`,
    );
    cresceram.forEach((linha) => console.error(linha));
    console.error("Ajuste a função onde ela é definida, sem sobrescrevê-la.");
  }
  if (falhou) process.exit(1);

  console.log(
    `Sem novos remendos: ${agora.length} arquivo(s) de remendo e ${totalAgora} troca(s) de função global em ${AREA}/, nenhum a mais que ${base}.`,
  );
}

// Roda só quando chamado direto (o teste importa `ehNomeDeRemendo`).
if (
  String(process.argv[1] || "")
    .split("\\")
    .join("/")
    .endsWith("scripts/check-no-new-patch-layers.mjs")
) {
  principal();
}
