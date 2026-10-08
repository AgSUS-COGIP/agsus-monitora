import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Tema escuro do chat. Bug: no escuro, o balão das próprias mensagens usava
  --color-bg-selected (que não muda no escuro: #f2f6fc) com o texto claro do
  tema por cima — quem enviava não via o que escreveu. O chat só usa tokens
  que têm valor escuro: os aliases e os --chat-* de src/styles/tokens.css.
*/

const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const tokens = ler("src/styles/tokens.css");
const css = ler("src/modulos/chat/chat.css").replace(/\/\*[\s\S]*?\*\//g, "");

function bloco(seletor) {
  const inicio = tokens.indexOf(`${seletor} {`);
  expect(inicio).toBeGreaterThanOrEqual(0);
  return tokens.slice(inicio, tokens.indexOf("\n}", inicio));
}
const claro = bloco(":root");
const escuro = bloco('html[data-theme="dark"]');

const definidos = (texto) =>
  new Set([...texto.matchAll(/^\s*(--[\w-]+):/gm)].map(([, nome]) => nome));
const doEscuro = definidos(escuro);

// Valor final no escuro: segue as referências var(--x) (o escuro aponta os
// apelidos para os --color-*, que também ganharam valor escuro), caindo no
// :root quando o escuro não redefine o token.
function valorEscuro(nome, visitados = new Set()) {
  expect(visitados.has(nome), `${nome}: referência circular`).toBe(false);
  visitados.add(nome);
  const padrao = new RegExp(`(?:^|\\s)${nome}:\\s*([^;]+);`, "m");
  const valor = (escuro.match(padrao) || claro.match(padrao))?.[1]?.trim();
  expect(valor, `${nome} sem valor no escuro`).toBeTruthy();
  const hex = valor.match(/^#[0-9a-f]{6}$/i);
  if (hex) return hex[0];
  const ref = valor.match(/^var\((--[\w-]+)\)$/);
  expect(ref, `${nome} sem hex no escuro`).not.toBeNull();
  return valorEscuro(ref[1], visitados);
}

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/* Declarações de cor do chat: [propriedade, valor]. */
const declaracoesDeCor = [
  ...css.matchAll(
    /^\s*(color|background(?:-color)?|border(?:-[a-z]+)*|outline(?:-color)?|fill|stroke)\s*:\s*([^;]+);/gm,
  ),
]
  .filter(([, prop]) => !/-(radius|width|style|collapse|spacing)$/.test(prop))
  .map(([, prop, valor]) => [prop, valor.trim()]);

describe("chat no tema escuro", () => {
  it("não usa cor literal nem os --color-* (que ficam claros no escuro)", () => {
    expect(css).not.toMatch(/var\(--color-/);
    for (const [prop, valor] of declaracoesDeCor) {
      expect(valor, `${prop}: ${valor}`).not.toMatch(
        /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black)\b/i,
      );
    }
  });

  it("toda cor do chat vem de token redefinido no tema escuro", () => {
    const usados = new Set(
      declaracoesDeCor.flatMap(([, valor]) =>
        [...valor.matchAll(/var\((--[\w-]+)/g)].map(([, nome]) => nome),
      ),
    );
    expect(usados.size).toBeGreaterThan(10);
    const semEscuro = [...usados].filter((nome) => !doEscuro.has(nome));
    expect(semEscuro).toEqual([]);
  });

  it("os --chat-* existem no claro e no escuro", () => {
    const doChat = [...css.matchAll(/var\((--chat-[\w-]+)/g)].map(([, n]) => n);
    const doClaro = definidos(claro);
    for (const nome of new Set(doChat)) {
      expect(doClaro.has(nome), `${nome} no :root`).toBe(true);
      expect(doEscuro.has(nome), `${nome} no escuro`).toBe(true);
    }
  });

  it("o balão próprio usa os tokens do balão (fundo e texto)", () => {
    const regra = css.match(/\.chat-msg\.is-minha\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(regra).toMatch(/background:\s*var\(--chat-balao-meu-fundo\)/);
    expect(regra).toMatch(/color:\s*var\(--chat-balao-meu-texto\)/);
    const alheio = css.match(/\.chat-msg\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(alheio).toMatch(/background:\s*var\(--surface-card\)/);
    expect(alheio).toMatch(/color:\s*var\(--text-primary\)/);
  });

  it("contraste AA no escuro: balão, hora, destaque, link e contadores", () => {
    const balao = valorEscuro("--chat-balao-meu-fundo");
    const cartao = valorEscuro("--surface-card");
    const elevado = valorEscuro("--surface-raised");
    const pares = [
      [valorEscuro("--chat-balao-meu-texto"), balao],
      [valorEscuro("--text-secondary"), balao],
      [valorEscuro("--text-primary"), cartao],
      [valorEscuro("--chat-destaque"), cartao],
      [valorEscuro("--chat-destaque"), elevado],
      [valorEscuro("--chat-destaque"), valorEscuro("--chat-selecionado")],
      [valorEscuro("--chat-link"), cartao],
      [valorEscuro("--text-primary"), valorEscuro("--chat-selecionado")],
      [
        valorEscuro("--chat-contador-texto"),
        valorEscuro("--chat-contador-fundo"),
      ],
      [
        valorEscuro("--chat-primario-texto"),
        valorEscuro("--chat-primario-fundo"),
      ],
    ];
    for (const [texto, fundo] of pares)
      expect(
        contraste(texto, fundo),
        `${texto} sobre ${fundo}`,
      ).toBeGreaterThanOrEqual(4.5);
  });
});
