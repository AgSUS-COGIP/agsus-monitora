import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Tipografia das telas React (regras de ouro 7, docs/biblioteca/design-e-tokens.md; Design System AgSUS
  4.1 e 4.3): pesos só até 600, nada abaixo de 12px e sentence case — sem
  `text-transform: uppercase` em rótulos, títulos e botões.

  Por que existe: o pente fino de 10/11/2026 achou rótulos de 9 e 10px na
  Convocação, pesos 700–900 em Conferências, AYA e no seletor múltiplo, e
  sobretítulos em caixa alta na Avaliação documental, Configurações, Mapa da
  Saúde Indígena e no modal institucional — além do título dos grupos da
  barra lateral, que o Design System pede em sentence case.

  Vale para o CSS de `src/modulos/` e `src/ui/`, para o CSS dos componentes
  React que ainda mora em `src/styles/` e para o CSS da casca, que pinta todas
  as telas: cabeçalho, entrada, carregamento, rótulos, chips e cabeçalhos de
  tabela (`app.css`, `platform-shell.css`, `loading-experience.css`,
  `nielsen-shell-ux.css`, `comemoracao.css`). Na segunda passada do pente fino
  (10/11/2026) esses arquivos ainda tinham pesos de 700 a 1000, textos de 8 a
  11px e caixa alta no perfil do cabeçalho, nos rótulos e nas tabelas; e o
  negrito (`<b>`/`<strong>`) herdava `bolder`, que sobe 600 para 900.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const PASTAS = ["src/modulos", "src/ui"];
const ARQUIVOS_DE_COMPONENTES = [
  "src/styles/app.css",
  "src/styles/barra-lateral.css",
  "src/styles/comemoracao.css",
  "src/styles/indigenous-territories-layer.css",
  "src/styles/loading-experience.css",
  "src/styles/mobile-table-cards.css",
  "src/styles/multi-select-busca.css",
  "src/styles/nielsen-shell-ux.css",
  "src/styles/platform-shell.css",
  "src/styles/saude-das-cargas.css",
];

/*
  Exceções, por "arquivo seletor": o tamanho é de um ícone (não de texto) ou
  o texto é uma sigla digitada. Rótulo de mapa não é exceção: o de 11px do
  "Mapa DSEIs" e o das Terras Indígenas subiram para 12px (11/11/2026).
*/
const EXCECOES = new Set([
  // A sigla da cota digitada no campo (PCD, PPI), não um rótulo.
  "src/modulos/aprovados/convocacao.css .convocacao-categoria-sigla",
  // Ícone de "conferido" num círculo de 20px.
  "src/modulos/entrevistas/entrevistas.css .entrevistas-aba-da-ficha-check",
  // Seta do botão do seletor múltiplo (ícone).
  "src/styles/multi-select-busca.css .multi-select-trigger .fa-chevron-down",
  // Seta do menu da conta, no cabeçalho (ícone).
  "src/styles/platform-shell.css .top-user-chevron",
]);

function cssDe(pasta: string): string[] {
  return fs
    .readdirSync(path.join(RAIZ, pasta), { withFileTypes: true })
    .flatMap((item) => {
      const relativo = `${pasta}/${item.name}`;
      if (item.isDirectory()) return cssDe(relativo);
      return item.name.endsWith(".css") ? [relativo] : [];
    });
}

interface Regra {
  arquivo: string;
  seletor: string;
  corpo: string;
}

function regras(arquivo: string): Regra[] {
  const texto = fs
    .readFileSync(path.join(RAIZ, arquivo), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  const achadas: Regra[] = [];
  for (const [, seletor = "", corpo = ""] of texto.matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    achadas.push({
      arquivo,
      seletor: seletor.replace(/\s+/g, " ").trim(),
      corpo,
    });
  }
  return achadas;
}

const TODAS = [...PASTAS.flatMap((p) => cssDe(p)), ...ARQUIVOS_DE_COMPONENTES]
  .flatMap(regras)
  .filter((r) => !EXCECOES.has(`${r.arquivo} ${r.seletor}`));

function ondeAparece(teste: (corpo: string) => boolean): string[] {
  return TODAS.filter((r) => teste(r.corpo)).map(
    (r) => `${r.arquivo} ${r.seletor}`,
  );
}

describe("tipografia das telas", () => {
  it("dá ao negrito um peso fixo, sem o `bolder` do navegador", () => {
    const base = regras("src/styles/app.css").find((r) =>
      /^b, ?strong$/.test(r.seletor),
    );
    expect(base?.corpo).toMatch(/font-weight:\s*600/);
  });

  it("não usa peso acima de 600", () => {
    expect(
      ondeAparece((c) => /font-weight:\s*(bold|bolder|[7-9]\d\d)\b/.test(c)),
    ).toEqual([]);
  });

  it("não usa texto abaixo de 12px", () => {
    expect(
      ondeAparece((c) => {
        const px = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(c);
        if (px && Number(px[1]) < 12) return true;
        const rem = /font-size:\s*(\d*\.?\d+)rem/.exec(c);
        return Boolean(rem && Number(rem[1]) < 0.75);
      }),
    ).toEqual([]);
  });

  it("escreve rótulos e títulos em sentence case, sem caixa alta", () => {
    expect(ondeAparece((c) => /text-transform:\s*uppercase/.test(c))).toEqual(
      [],
    );
  });
});
