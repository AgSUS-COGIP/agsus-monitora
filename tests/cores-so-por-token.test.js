import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Cor só por token (DESIGN.md seção 0; docs/design-system-agsus.md 3.6).

  Por que existe: no tema escuro, o balão das mensagens próprias do chat ficou
  quase branco com texto claro, e a auditoria de 08/10/2026 achou o mesmo
  defeito em outras telas. Duas causas, as duas cobertas aqui:

  1. Cor literal (#hex, rgb/rgba/hsl, white/black) no CSS ou no código fica
     igual nos dois temas. Toda cor literal que existia foi classificada em
     `tests/fixtures/cores-literais-permitidas.json`, com o motivo por arquivo
     (marca, mapa, papel, efeito, tela de acesso, dívida do tema escuro
     legado…). Cor literal NOVA — ou mais uma ocorrência de uma que já existe
     — quebra este teste: use um token de `src/styles/tokens.css`. Se a cor é
     de propósito fixa (logo, mapa, papel), acrescente-a à lista com o motivo.
     Ao remover cores, regenere a lista: `ATUALIZAR_CORES=1 npx vitest run
     tests/cores-so-por-token.test.js` (ela só encolhe).

  2. Token semântico oficial (`--color-*`) sem valor no tema escuro fica com a
     cor do claro. Todo `--color-*` semântico usado em `src/` precisa estar no
     bloco `html[data-theme="dark"]` de `tokens.css`. Os primitivos
     (`--color-blue-500`, `--color-neutral-0`…) não mudam com o tema, de
     propósito; usá-los direto só nos arquivos da lista (seção `primitivos`).
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const LISTA = path.join(RAIZ, "tests/fixtures/cores-literais-permitidas.json");
const EXTENSOES = /\.(css|js|jsx|ts|tsx)$/;
// Gerados: os ícones (máscara SVG em data URI, a cor é a da máscara) e a base da AYA.
const IGNORADOS = new Set([
  "src/styles/icones-lucide.css",
  "src/modules/aya-conhecimento-gerado.js",
]);

function arquivosDoSrc(pasta = path.join(RAIZ, "src")) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) return arquivosDoSrc(caminho);
    return EXTENSOES.test(item.name) ? [caminho] : [];
  });
}

function relativo(caminho) {
  return path.relative(RAIZ, caminho).split(path.sep).join("/");
}

/* Tira comentários (as razões de contraste citam hex nos comentários). */
function semComentarios(texto, css) {
  const semBloco = texto.replace(/\/\*[\s\S]*?\*\//g, " ");
  return css ? semBloco : semBloco.replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1");
}

const HEX =
  /(?<![&\w#])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])/gi;
const FUNCAO = /\b(?:rgba?|hsla?)\(\s*[^)]*\)/gi;
const NOME = /(?<![\w-])(?:white|black)(?![\w-])/gi;

/** Cores literais de um arquivo: { "#fff": 2, "rgba(0,0,0,.5)": 1 }. */
export function coresLiterais(texto, css) {
  const limpo = semComentarios(texto.replace(/\r\n/g, "\n"), css);
  const contagem = {};
  const somar = (cor) => {
    const chave = cor.toLowerCase().replace(/\s+/g, "");
    contagem[chave] = (contagem[chave] || 0) + 1;
  };
  for (const m of limpo.matchAll(HEX)) somar(m[0]);
  for (const m of limpo.matchAll(FUNCAO)) {
    // rgba(var(--x)) e afins não são literais.
    if (!m[0].includes("var(")) somar(m[0]);
  }
  if (css) {
    // Só em valor de declaração (white-space e afins não casam pelo hífen).
    for (const linha of limpo.split("\n")) {
      const valor = linha.includes(":") ? linha.slice(linha.indexOf(":")) : "";
      for (const m of valor.matchAll(NOME)) somar(m[0]);
    }
  }
  return contagem;
}

const PRIMITIVO =
  /var\(\s*(--color-(?:blue|neutral|success|warning|danger)-\d+)\b/g;
const SEMANTICO = /var\(\s*(--color-[a-z0-9-]+)/g;

function lerLista() {
  return JSON.parse(fs.readFileSync(LISTA, "utf8"));
}

function levantamento() {
  const cores = {};
  const primitivos = {};
  const semanticos = new Set();
  for (const caminho of arquivosDoSrc()) {
    const rel = relativo(caminho);
    if (IGNORADOS.has(rel)) continue;
    const texto = fs.readFileSync(caminho, "utf8");
    const css = rel.endsWith(".css");
    if (rel !== "src/styles/tokens.css") {
      const achadas = coresLiterais(texto, css);
      if (Object.keys(achadas).length) cores[rel] = achadas;
      const limpo = semComentarios(texto, css);
      const usados = [...limpo.matchAll(PRIMITIVO)].map((m) => m[1]);
      if (usados.length) primitivos[rel] = [...new Set(usados)].sort();
      for (const m of limpo.matchAll(SEMANTICO)) semanticos.add(m[1]);
    }
  }
  return { cores, primitivos, semanticos };
}

function blocoEscuroDosTokens() {
  const tokens = fs.readFileSync(
    path.join(RAIZ, "src/styles/tokens.css"),
    "utf8",
  );
  const bloco = tokens.match(/html\[data-theme="dark"\]\s*\{([^}]*)\}/);
  if (!bloco) throw new Error("tokens.css sem bloco html[data-theme=dark]");
  return new Set(
    [...bloco[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
}

const { cores, primitivos, semanticos } = levantamento();

if (process.env.ATUALIZAR_CORES === "1") {
  const atual = lerLista();
  const motivos = atual.motivos || {};
  const novo = {
    leia: atual.leia,
    motivos: Object.fromEntries(
      Object.keys(cores)
        .sort()
        .map((rel) => [rel, motivos[rel] || "SEM MOTIVO: classifique"]),
    ),
    cores: Object.fromEntries(
      Object.keys(cores)
        .sort()
        .map((k) => [k, cores[k]]),
    ),
    primitivos: Object.fromEntries(
      Object.keys(primitivos)
        .sort()
        .map((k) => [k, primitivos[k]]),
    ),
  };
  fs.writeFileSync(LISTA, `${JSON.stringify(novo, null, 2)}\n`);
}

describe("cor só por token", () => {
  const lista = lerLista();

  it("nenhuma cor literal nova fora da lista de exceções", () => {
    const novas = [];
    for (const [rel, achadas] of Object.entries(cores)) {
      const permitidas = lista.cores[rel] || {};
      for (const [cor, n] of Object.entries(achadas)) {
        const limite = permitidas[cor] || 0;
        if (n > limite)
          novas.push(`${rel}: ${cor} (${n}, permitido ${limite})`);
      }
    }
    expect(
      novas,
      "Cor literal nova: troque por um token de src/styles/tokens.css " +
        "(ou, se a cor é fixa de propósito, ponha-a na lista com o motivo).",
    ).toEqual([]);
  });

  it("todo arquivo da lista tem o motivo da exceção", () => {
    const semMotivo = Object.keys(lista.cores).filter(
      (rel) => !lista.motivos[rel] || lista.motivos[rel].startsWith("SEM"),
    );
    expect(semMotivo).toEqual([]);
  });

  it("todo --color-* semântico usado tem valor no tema escuro", () => {
    const escuro = blocoEscuroDosTokens();
    const primitivo = /^--color-(?:blue|neutral|success|warning|danger)-\d+$/;
    // A barra lateral tem cor própria (configurável), igual nos dois temas.
    const proprioDaBarra = /^--color-sidebar-/;
    const semEscuro = [...semanticos]
      .filter((nome) => !primitivo.test(nome) && !proprioDaBarra.test(nome))
      .filter((nome) => !escuro.has(nome))
      .sort();
    expect(
      semEscuro,
      'Dê valor a estes tokens em html[data-theme="dark"] (tokens.css).',
    ).toEqual([]);
  });

  it("primitivo de cor direto só nos arquivos da lista", () => {
    const novos = [];
    for (const [rel, usados] of Object.entries(primitivos)) {
      const permitidos = new Set(lista.primitivos[rel] || []);
      for (const nome of usados)
        if (!permitidos.has(nome)) novos.push(`${rel}: ${nome}`);
    }
    expect(
      novos,
      "Primitivo não muda no tema escuro: use o token semântico " +
        "(--color-text-brand, --color-action-primary, --state-*…).",
    ).toEqual([]);
  });

  it("acha cor literal e ignora comentário, entidade HTML e white-space", () => {
    expect(
      coresLiterais(
        "a { color: #FFF; white-space: nowrap; background: rgba(0, 0, 0, 0.5); }\n/* #123456 */",
        true,
      ),
    ).toEqual({ "#fff": 1, "rgba(0,0,0,0.5)": 1 });
    expect(coresLiterais('const a = "&#160;"; // #abcdef', false)).toEqual({});
    expect(coresLiterais("b { border: 1px solid white; }", true)).toEqual({
      white: 1,
    });
  });
});
