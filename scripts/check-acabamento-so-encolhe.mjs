import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/*
  O acabamento só encolhe.

  A norma visual (docs/design-system-agsus.md) manda usar token em vez de valor
  fixo. Este script conta, por arquivo, os desvios que uma máquina enxerga e
  compara com a linha de base em scripts/acabamento-linha-de-base.json: o
  número de cada tipo, em cada arquivo, só pode cair. Arquivo que não está na
  linha de base (novo) tem limite zero; arquivo apagado some dela sozinho.

  Uso:
    node scripts/check-acabamento-so-encolhe.mjs              verifica (sai 1 se piorar)
    node scripts/check-acabamento-so-encolhe.mjs --atualizar  grava a contagem
        atual como linha de base; recusa se algum número subir (para baixar a
        linha depois de corrigir um lote). Sem linha de base ainda, cria.

  Arquivos: `git ls-files` dos .css e .tsx de src/ (arquivo apagado e
  ainda não commitado é ignorado).

  Tipos (TIPOS_DE_DESVIO): cor (hex, rgb(), rgba(), hsl(); em .css fora de
  src/styles/tokens.css, em .tsx só dentro de literal de string), important,
  zIndex (número), raio (border-radius sem var()), sombra (box-shadow sem var()
  e sem none), curva (transition/animation com ease, linear ou duração em
  ms/s literais), animaLayout (transition que cita width, height, top, left ou
  all) e blur (backdrop-filter em bloco sem position fixed/sticky).

  Exceção legítima: na mesma linha, um comentário `acabamento: permitido —
  <motivo>` (em CSS, entre barra-asterisco e asterisco-barra; em .tsx também
  depois de duas barras). Sem motivo depois do
  travessão, o marcador não isenta. Comentários e url(...) não contam.

  Limitações (heurística simples, de propósito):
  - Conta uma ocorrência por declaração (cor: por linha). Declaração em várias
    linhas é isenta se qualquer uma das linhas dela tiver o marcador.
  - O `blur` olha só o próprio bloco `{ ... }`: um `position: fixed` herdado de
    outra regra não é visto; use o marcador. Só o `backdrop-filter` sem prefixo.
  - No .tsx, "literal de string" é "..." e '...' (até o fim da linha) e `...`;
    um apóstrofo em texto de JSX pode abrir um literal falso até o fim da linha.
  - No .css não se distingue seletor `#abc` de cor hex; é raro e se resolve
    com o marcador.
*/

export const TIPOS_DE_DESVIO = [
  "cor",
  "important",
  "zIndex",
  "raio",
  "sombra",
  "curva",
  "animaLayout",
  "blur",
];

const ARQUIVO_DE_TOKENS = "src/styles/tokens.css";
const CAMINHO_DA_LINHA_DE_BASE = "scripts/acabamento-linha-de-base.json";

const COR =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?)\(/i;
const MARCADOR =
  /(?:\/\*|\/\/)\s*acabamento:\s*permitido\s*[—–-]\s*(?!\*\/)\S/i;
const CURVA_PALAVRA =
  /(?<![\w-])(?:ease|ease-in|ease-out|ease-in-out|linear)(?![\w-])/i;
const DURACAO_LITERAL = /(?<![\w.-])(?:\d+\.?\d*|\.\d+)m?s(?![\w-])/i;
const LAYOUT_PALAVRA = /(?<![\w-])(?:width|height|top|left|all)(?![\w-])/i;

const zerado = () => Object.fromEntries(TIPOS_DE_DESVIO.map((t) => [t, 0]));

/* Troca por espaços tudo menos as quebras de linha, para manter as linhas. */
const branquear = (trecho) => trecho.replace(/[^\r\n]/g, " ");

/* As linhas (a partir de 1) cujo texto original tem o marcador com motivo. */
function linhasComMarcador(texto) {
  const linhas = new Set();
  texto.split("\n").forEach((linha, i) => {
    if (MARCADOR.test(linha)) linhas.add(i + 1);
  });
  return linhas;
}

function contarCss(caminho, texto) {
  const contagem = zerado();
  const permitidas = linhasComMarcador(texto);
  const limpo = texto
    .replace(/\/\*[\s\S]*?\*\//g, branquear)
    .replace(/url\([^)]*\)/gi, branquear);

  if (caminho !== ARQUIVO_DE_TOKENS) {
    limpo.split("\n").forEach((linha, i) => {
      if (COR.test(linha) && !permitidas.has(i + 1)) contagem.cor += 1;
    });
  }

  const isenta = (de, ate) => {
    for (let n = de; n <= ate; n += 1) if (permitidas.has(n)) return true;
    return false;
  };

  const conta = (bloco) => {
    const temPosicaoFixa = bloco.some(
      (d) =>
        d.propriedade === "position" && /^(?:fixed|sticky)\b/i.test(d.valor),
    );
    for (const d of bloco) {
      if (isenta(d.de, d.ate)) continue;
      const { propriedade: p, valor: v } = d;
      if (/!\s*important/i.test(v)) contagem.important += 1;
      if (p === "z-index" && /^-?\d/.test(v)) contagem.zIndex += 1;
      if (p === "border-radius" && !/^var\(/i.test(v)) contagem.raio += 1;
      if (p === "box-shadow" && !/^var\(/i.test(v) && !/^none\b/i.test(v))
        contagem.sombra += 1;
      if (/^(?:-webkit-)?(?:transition|animation)(?:-[a-z-]+)?$/.test(p)) {
        if (
          CURVA_PALAVRA.test(v) ||
          DURACAO_LITERAL.test(v.replace(/var\([^)]*\)/gi, ""))
        )
          contagem.curva += 1;
        if (p.includes("transition") && LAYOUT_PALAVRA.test(v))
          contagem.animaLayout += 1;
      }
      if (p === "backdrop-filter" && !temPosicaoFixa) contagem.blur += 1;
    }
  };

  /* Percorre o CSS separando blocos `{}` e declarações `;`. */
  const pilha = [[]];
  let pedaco = "";
  let linhaInicial = 0;
  let linha = 1;
  const fecharDeclaracao = () => {
    const i = pedaco.indexOf(":");
    if (i > 0 && pedaco.trim()) {
      pilha[pilha.length - 1].push({
        propriedade: pedaco.slice(0, i).trim().toLowerCase(),
        valor: pedaco.slice(i + 1).trim(),
        de: linhaInicial,
        ate: linha,
      });
    }
    pedaco = "";
    linhaInicial = 0;
  };
  for (const c of limpo) {
    if (c === "{") {
      pedaco = "";
      linhaInicial = 0;
      pilha.push([]);
    } else if (c === "}") {
      fecharDeclaracao();
      if (pilha.length > 1) conta(pilha.pop());
    } else if (c === ";") {
      fecharDeclaracao();
    } else {
      if (!linhaInicial && !/\s/.test(c)) linhaInicial = linha;
      pedaco += c;
    }
    if (c === "\n") linha += 1;
  }
  fecharDeclaracao();
  while (pilha.length) conta(pilha.pop());
  return contagem;
}

/* Texto dos literais de string de um .tsx, por linha (comentários ficam de fora). */
function literaisPorLinha(texto) {
  const porLinha = new Map();
  const guardar = (linha, c) =>
    porLinha.set(linha, (porLinha.get(linha) ?? "") + c);
  let linha = 1;
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    const dois = texto.slice(i, i + 2);
    if (dois === "//") {
      while (i < texto.length && texto[i] !== "\n") i += 1;
    } else if (dois === "/*") {
      const fim = texto.indexOf("*/", i + 2);
      const ate = fim === -1 ? texto.length : fim + 2;
      for (; i < ate; i += 1) if (texto[i] === "\n") linha += 1;
    } else if (c === '"' || c === "'" || c === "`") {
      i += 1;
      while (i < texto.length && texto[i] !== c) {
        if (texto[i] === "\n") {
          linha += 1;
          if (c !== "`") break;
        }
        if (texto[i] === "\\") i += 1;
        else guardar(linha, texto[i]);
        i += 1;
      }
      i += 1;
    } else {
      if (c === "\n") linha += 1;
      i += 1;
    }
  }
  return porLinha;
}

function contarTsx(texto) {
  const contagem = zerado();
  const permitidas = linhasComMarcador(texto);
  for (const [linha, literais] of literaisPorLinha(texto)) {
    if (COR.test(literais) && !permitidas.has(linha)) contagem.cor += 1;
  }
  return contagem;
}

/** Conta os desvios de token de um arquivo (`.css` ou `.tsx`). */
export function contarDesvios(caminho, texto) {
  const normal = caminho.split("\\").join("/");
  const fonte = texto.replace(/\r\n?/g, "\n");
  return /\.tsx$/i.test(normal) ? contarTsx(fonte) : contarCss(normal, fonte);
}

/**
 * As pioras de `atual` em relação a `base` (mapas caminho → contagem). Arquivo
 * ou tipo ausente na base tem limite 0; arquivo só na base (apagado) é ignorado.
 */
export function compararComLinhaDeBase(base, atual) {
  const pioras = [];
  for (const [caminho, contagem] of Object.entries(atual)) {
    for (const tipo of TIPOS_DE_DESVIO) {
      const antes = base[caminho]?.[tipo] ?? 0;
      const agora = contagem[tipo] ?? 0;
      if (agora > antes) pioras.push({ caminho, tipo, antes, agora });
    }
  }
  return pioras;
}

/* Só os arquivos com algum desvio, só os tipos > 0, chaves ordenadas. */
function paraLinhaDeBase(contagens) {
  const saida = {};
  for (const caminho of Object.keys(contagens).sort()) {
    const itens = TIPOS_DE_DESVIO.filter((t) => contagens[caminho][t] > 0);
    if (itens.length)
      saida[caminho] = Object.fromEntries(
        itens.map((t) => [t, contagens[caminho][t]]),
      );
  }
  return saida;
}

function arquivosDoFront() {
  return execFileSync("git", ["ls-files", "--", "src"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  })
    .split(/\r?\n/)
    .filter((caminho) => /\.(?:css|tsx)$/.test(caminho) && existsSync(caminho));
}

function contarTudo() {
  const contagens = {};
  for (const caminho of arquivosDoFront())
    contagens[caminho] = contarDesvios(caminho, readFileSync(caminho, "utf8"));
  return contagens;
}

function totais(contagens) {
  const soma = zerado();
  for (const c of Object.values(contagens))
    for (const t of TIPOS_DE_DESVIO) soma[t] += c[t] ?? 0;
  return TIPOS_DE_DESVIO.map((t) => `${t} ${soma[t]}`).join(", ");
}

function acusar(pioras) {
  console.error(
    "O acabamento só encolhe: desvio de token a mais que a linha de base:",
  );
  pioras.forEach(({ caminho, tipo, antes, agora }) =>
    console.error(`  ${caminho}: ${tipo} ${antes} → ${agora}`),
  );
  console.error(
    "Use o token (var(--…)) em vez do valor fixo; exceção legítima leva na mesma linha `/* acabamento: permitido — <motivo> */`. Norma: docs/design-system-agsus.md; uso: docs/biblioteca/design-e-tokens.md.",
  );
}

function principal() {
  const atualizar = process.argv.includes("--atualizar");
  const atual = contarTudo();
  const temBase = existsSync(CAMINHO_DA_LINHA_DE_BASE);
  const base = temBase
    ? JSON.parse(readFileSync(CAMINHO_DA_LINHA_DE_BASE, "utf8"))
    : {};
  const pioras = compararComLinhaDeBase(base, atual);

  if (atualizar) {
    if (temBase && pioras.length) {
      acusar(pioras);
      console.error("A linha de base não foi gravada: ela só pode baixar.");
      process.exit(1);
    }
    mkdirSync(dirname(CAMINHO_DA_LINHA_DE_BASE), { recursive: true });
    writeFileSync(
      CAMINHO_DA_LINHA_DE_BASE,
      `${JSON.stringify(paraLinhaDeBase(atual), null, 2)}\n`,
    );
    console.log(
      `Linha de base gravada em ${CAMINHO_DA_LINHA_DE_BASE}: ${totais(atual)}.`,
    );
    return;
  }

  if (pioras.length) {
    acusar(pioras);
    process.exit(1);
  }
  console.log(
    `Acabamento sem desvio novo de token em ${Object.keys(atual).length} arquivo(s): ${totais(atual)}.`,
  );
}

// Roda só quando chamado direto (o teste importa as funções).
if (
  String(process.argv[1] || "")
    .split("\\")
    .join("/")
    .endsWith("scripts/check-acabamento-so-encolhe.mjs")
) {
  principal();
}
