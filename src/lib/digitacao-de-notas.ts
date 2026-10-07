/*
  O lançamento da ficha de notas como numa planilha (a matriz de
  src/modulos/entrevistas/matriz-de-notas.tsx), sem React: o que fazer com o
  que foi digitado numa célula e para onde o foco vai.

  - `lerDigitacao`: o texto da célula diante das notas da escala do roteiro
    (`opcoesDaEscala`). "completa" = é uma nota da escala e nenhuma outra
    começa por ela (num 0 a 5, "3" já basta: a célula avança sozinha);
    "parcial" = pode virar uma nota ("1" num 0 a 10, "3" ou "3," quando há
    3,5): espera Enter, Tab ou seta; "recusada" = não há nota da escala que
    comece assim (a célula fica como estava e a tela avisa). Sem as notas da
    escala (faixa sem máximo), aceita qualquer número e nunca avança sozinha.
  - `moverNaGrade`: setas, Enter (próxima, passando à linha de baixo) e
    Backspace na célula vazia (anterior). Fora da grade: `null` (quem usa
    decide: passar ao próximo avaliador, focar o Salvar).

  Não muda a regra da nota: a validação final continua sendo `notaNaEscala`
  (src/lib/roteiro-de-entrevista.js) e a do banco.
*/

export type EstadoDaDigitacao = "vazia" | "completa" | "parcial" | "recusada";

export type Digitacao = {
  estado: EstadoDaDigitacao;
  /** O texto que a célula guarda ("3", "3,5"; vírgula como a pessoa digitou). */
  texto: string;
};

const normal = (texto: string) => texto.trim().replace(",", ".");

/** As formas como uma nota pode ser digitada: 3,5 → "3.5" e "3,5". */
function formas(valor: number): string[] {
  const ponto = String(valor);
  return [ponto, ponto.replace(".", ",")];
}

/**
 * O texto da célula diante das notas da escala. `texto` é o valor inteiro do
 * campo depois da tecla (o campo seleciona tudo ao focar: a tecla troca).
 */
export function lerDigitacao(
  texto: string,
  opcoes: readonly number[],
): Digitacao {
  const bruto = String(texto ?? "")
    .replace(/\s+/g, "")
    .replace(".", ",");
  if (!bruto) return { estado: "vazia", texto: "" };
  if (!/^\d+(,\d*)?$/.test(bruto)) return { estado: "recusada", texto: bruto };
  if (!opcoes.length) return { estado: "parcial", texto: bruto };
  const procurado = normal(bruto);
  const comPrefixo = opcoes.filter((o) =>
    formas(o).some((f) => normal(f).startsWith(procurado)),
  );
  if (!comPrefixo.length) return { estado: "recusada", texto: bruto };
  const exata = comPrefixo.some((o) => o === Number(procurado));
  const maisLongas = comPrefixo.some((o) => normal(String(o)) !== procurado);
  if (exata && !maisLongas && !bruto.endsWith(","))
    return { estado: "completa", texto: bruto };
  return { estado: "parcial", texto: bruto };
}

/** "0 a 5" ou "0; 2,5; 5" — a escala numa frase curta (aviso e dica da célula). */
export function textoDaEscala(opcoes: readonly number[]): string {
  if (!opcoes.length) return "";
  const br = (n: number) => String(n).replace(".", ",");
  const ordenadas = [...opcoes].sort((a, b) => a - b);
  const primeira = ordenadas[0] ?? 0;
  const ultima = ordenadas[ordenadas.length - 1] ?? 0;
  const inteirasSeguidas = ordenadas.every(
    (n, i) => Number.isInteger(n) && n === primeira + i,
  );
  if (inteirasSeguidas) return `${br(primeira)} a ${br(ultima)}`;
  if (ordenadas.length <= 6) return ordenadas.map(br).join("; ");
  return `${br(primeira)} a ${br(ultima)}`;
}

export type Posicao = { linha: number; coluna: number };
export type Movimento =
  "direita" | "esquerda" | "cima" | "baixo" | "proxima" | "anterior";

/** A tecla do campo → o movimento na grade (ou nada). */
export function movimentoDaTecla(
  tecla: string,
  shift = false,
): Movimento | null {
  switch (tecla) {
    case "ArrowRight":
      return "direita";
    case "ArrowLeft":
      return "esquerda";
    case "ArrowUp":
      return "cima";
    case "ArrowDown":
      return "baixo";
    case "Enter":
      return shift ? "anterior" : "proxima";
    default:
      return null;
  }
}

/**
 * A próxima posição numa grade `linhas` × `colunas` (todas as células
 * existem). "proxima"/"anterior" seguem a leitura (fim da linha → começo da
 * de baixo); as setas param na borda. Fora da grade, `null`.
 */
export function moverNaGrade(
  de: Posicao,
  movimento: Movimento,
  linhas: number,
  colunas: number,
): Posicao | null {
  if (linhas <= 0 || colunas <= 0) return null;
  const indice = de.linha * colunas + de.coluna;
  const total = linhas * colunas;
  const dePosicao = (i: number): Posicao | null =>
    i < 0 || i >= total
      ? null
      : { linha: Math.floor(i / colunas), coluna: i % colunas };
  switch (movimento) {
    case "proxima":
      return dePosicao(indice + 1);
    case "anterior":
      return dePosicao(indice - 1);
    case "direita":
      return de.coluna + 1 < colunas ? { ...de, coluna: de.coluna + 1 } : null;
    case "esquerda":
      return de.coluna > 0 ? { ...de, coluna: de.coluna - 1 } : null;
    case "baixo":
      return de.linha + 1 < linhas ? { ...de, linha: de.linha + 1 } : null;
    case "cima":
      return de.linha > 0 ? { ...de, linha: de.linha - 1 } : null;
  }
}
