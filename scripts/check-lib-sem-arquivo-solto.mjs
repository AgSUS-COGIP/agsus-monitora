import { execFileSync } from "node:child_process";

/*
  src/lib/ por assunto.

  A lógica pura fica em src/lib/<assunto>/, com o mesmo nome da tela em
  src/modulos/<nome>/ quando serve a uma tela só, ou numa pasta técnica
  (sessao, seguranca, entrada, navegacao, carga, base) quando várias usam
  (docs/biblioteca/mapa-do-repositorio.md, seção "Assunto → pastas"). Na raiz
  só ficam o CLAUDE.md e o contrato de RPC, que os scripts de checagem leem
  pelo caminho. Pasta com mais de 30 arquivos diretos ganha subpasta: é o
  ponto em que procurar pelo nome volta a ficar difícil.
*/

export const SOLTOS_PERMITIDOS = Object.freeze([
  "CLAUDE.md",
  "rpc-contrato.ts",
]);
export const LIMITE_POR_PASTA = 30;

/*
  Pastas que já passavam do limite quando src/lib/ foi organizada por assunto
  (17/11/2026). Só encolhem: o número é o teto; ao dividir a pasta, baixe-o
  (ou tire a linha).
*/
export const ACIMA_DO_LIMITE = Object.freeze({
  "src/lib/avaliacao-documental/": 55,
});

const RAIZ = "src/lib/";

/**
 * Recebe caminhos relativos à raiz do repositório (como `git ls-files src/lib`)
 * e devolve as mensagens de problema; vazio quando está tudo certo.
 */
export function conferirLib(arquivos) {
  const problemas = [];
  const porPasta = new Map();
  for (const caminho of arquivos) {
    if (!caminho.startsWith(RAIZ)) continue;
    const resto = caminho.slice(RAIZ.length);
    const barra = resto.lastIndexOf("/");
    if (barra === -1) {
      if (!SOLTOS_PERMITIDOS.includes(resto))
        problemas.push(
          `${caminho} está solto em src/lib/: coloque na pasta do assunto`,
        );
      continue;
    }
    const pasta = `${RAIZ}${resto.slice(0, barra)}/`;
    porPasta.set(pasta, (porPasta.get(pasta) ?? 0) + 1);
  }
  for (const [pasta, quantos] of porPasta) {
    const limite = ACIMA_DO_LIMITE[pasta] ?? LIMITE_POR_PASTA;
    if (quantos > limite)
      problemas.push(
        `${pasta} tem ${quantos} arquivos diretos (limite ${limite}): divida em subpastas`,
      );
  }
  return problemas;
}

function principal() {
  const arquivos = execFileSync("git", ["ls-files", "src/lib"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const problemas = conferirLib(arquivos);
  if (problemas.length) {
    problemas.forEach((p) => console.error(p));
    console.error(
      "src/lib/ é organizada por assunto: ver docs/biblioteca/mapa-do-repositorio.md.",
    );
    process.exit(1);
  }
  console.log(
    `src/lib/ por assunto: ${arquivos.length} arquivo(s), nenhum solto na raiz, nenhuma pasta acima do limite (${LIMITE_POR_PASTA}; as registradas em ACIMA_DO_LIMITE, no máximo o tamanho de hoje).`,
  );
}

// Roda só quando chamado direto (o teste importa `conferirLib`).
if (
  String(process.argv[1] || "")
    .split("\\")
    .join("/")
    .endsWith("scripts/check-lib-sem-arquivo-solto.mjs")
) {
  principal();
}
