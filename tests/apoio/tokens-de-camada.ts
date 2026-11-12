import { readFileSync } from "node:fs";

/* Camadas do projeto (`--z-*`): lê `:root` de app.css e tokens.css e resolve
   `var(--x)`, número puro e `calc(var(--x) ± n)`. Usado por testes que comparam z-index. */
const ARQUIVOS = ["src/styles/app.css", "src/styles/tokens.css"];

/* Devolve as declarações `--nome: valor` dos blocos de seletor
   `:root` (nível raiz, fora de @media). Os blocos do tema escuro
   (`html[data-theme="dark"]`) redefinem de propósito os tokens de cor e de
   sombra; por isso não entram na contagem de "definido uma vez só". */
function declaracoesDoRaiz(texto: string): Array<[string, string]> {
  const semComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, "");
  const achadas: Array<[string, string]> = [];
  const abertura = /(^|\})\s*([^{}]+?)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = abertura.exec(semComentarios))) {
    if (!(m[2] as string).split(",").some((s) => s.trim() === ":root"))
      continue;
    const inicio = abertura.lastIndex;
    const fim = semComentarios.indexOf("}", inicio);
    const corpo = semComentarios.slice(inicio, fim);
    for (const d of corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      achadas.push([d[1] as string, (d[2] as string).trim()]);
    }
  }
  return achadas;
}

export const definicoes = ARQUIVOS.flatMap((arquivo) =>
  declaracoesDoRaiz(readFileSync(arquivo, "utf8")),
);
const valores = new Map<string, string>();
for (const [nome, valor] of definicoes) {
  valores.set(nome, valor);
}

export function valorDe(nome: string): string {
  const valor = valores.get(nome);
  if (valor === undefined) throw new Error(`Token sem definição: ${nome}`);
  return valor;
}

/* Resolve `var(--x)`, número puro e `calc(var(--x) + n)`. */
export function resolver(valor: string): number {
  const v = valor.trim();
  if (/^-?\d+$/.test(v)) return Number(v);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) return resolver(valorDe(ref[1] as string));
  const soma = v.match(/^calc\(\s*var\((--[\w-]+)\)\s*([+-])\s*(\d+)\s*\)$/);
  if (soma) {
    const base = resolver(valorDe(soma[1] as string));
    return soma[2] === "+"
      ? base + Number(soma[3] as string)
      : base - Number(soma[3] as string);
  }
  throw new Error(`Valor que o teste não sabe resolver: ${valor}`);
}
