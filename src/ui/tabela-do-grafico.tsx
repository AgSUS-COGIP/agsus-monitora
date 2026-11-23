import { createContext } from "react";

/*
  Os números de um gráfico em tabela (padrão do SIGEPSI, DS 10.5 "Tabela |
  Gráfico"): para o leitor de tela (sempre, escondida da vista) e para quem
  quer ver os valores (o botão "Tabela" do CardDeGrafico). As linhas são os
  rótulos do eixo (ou as fatias) e as colunas, as séries; vale para barra,
  linha e rosca, montadas pelo `montar()` do `Grafico`.

  O CardDeGrafico guarda se mostra a tabela no lugar do gráfico e quantos
  gráficos se registraram (o botão só aparece quando há um).
*/
export interface SerieDoGrafico {
  label?: string;
  data?: ReadonlyArray<unknown>;
}

export interface DadosDaTabelaDoGrafico {
  colunas: string[];
  linhas: { rotulo: string; valores: string[] }[];
}

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function textoDoValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "number")
    return Number.isFinite(valor) ? NUMERO.format(valor) : "—";
  if (typeof valor === "object" && valor !== null) {
    // Ponto { x, y } (dispersão, linha com objetos): o valor é o y.
    const y = (valor as { y?: unknown }).y;
    if (y !== undefined) return textoDoValor(y);
  }
  return String(valor);
}

/**
 * Tabela a partir de `data` do Chart.js; null se não há rótulo nem série.
 * `rotulosCompletos`: os nomes inteiros, quando o gráfico os abrevia (a
 * tabela mostra o nome todo); `valor`: o nome da coluna da série sem rótulo
 * (o padrão é "Valor").
 */
export function dadosDaTabelaDoGrafico(
  data: {
    labels?: ReadonlyArray<unknown>;
    datasets?: ReadonlyArray<SerieDoGrafico>;
  },
  {
    rotulosCompletos,
    valor = "Valor",
  }: { rotulosCompletos?: ReadonlyArray<string>; valor?: string } = {},
): DadosDaTabelaDoGrafico | null {
  const series = (data.datasets || []).filter((s) => Array.isArray(s.data));
  const rotulos = (data.labels || []).map((r, i) => {
    const completo = rotulosCompletos?.[i];
    if (completo) return completo;
    return Array.isArray(r) ? r.join(" ") : String(r ?? "");
  });
  if (!series.length || !rotulos.length) return null;
  return {
    colunas: series.map((s, i) =>
      String(s.label || (series.length === 1 ? valor : `Série ${i + 1}`)),
    ),
    linhas: rotulos.map((rotulo, i) => ({
      rotulo,
      valores: series.map((s) => textoDoValor(s.data?.[i])),
    })),
  };
}

/** O que a linha `indice` diz, para anunciar ("Março: Inscritos 120, Aptos 80"). */
export function textoDoPonto(
  dados: DadosDaTabelaDoGrafico,
  indice: number,
  serie?: number,
): string {
  const linha = dados.linhas[indice];
  if (!linha) return "";
  const pares = linha.valores
    .map((valor, i) => ({ valor, coluna: dados.colunas[i] }))
    .filter((_, i) => serie === undefined || i === serie)
    .map(({ valor, coluna }) =>
      dados.colunas.length === 1 && coluna === "Valor"
        ? valor
        : `${coluna} ${valor}`,
    );
  return `${linha.rotulo}: ${pares.join(", ")}`;
}

export interface ContextoDoCardDeGrafico {
  emTabela: boolean;
  registrar: () => () => void;
}

export const ContextoDoGrafico = createContext<ContextoDoCardDeGrafico | null>(
  null,
);

export function TabelaDoGrafico({
  dados,
  titulo,
  visivel,
  item = "Item",
  aoEscolher,
}: {
  dados: DadosDaTabelaDoGrafico;
  titulo: string;
  visivel: boolean;
  /** O nome da primeira coluna ("Critério", "Unidade"). */
  item?: string;
  /** Com a tabela à vista, o rótulo de cada linha filtra (como o clique no gráfico). */
  aoEscolher?: (indice: number) => void;
}) {
  return (
    <div
      className={visivel ? "ui-grafico-tabela" : "sr-only"}
      data-tabela-do-grafico=""
    >
      {/* No celular continua tabela (poucas colunas) e rola de lado no corpo
          do cartão, em vez de virar um cartão por linha. */}
      <table data-mobile-table="scroll">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">{item}</th>
            {dados.colunas.map((coluna, i) => (
              <th key={i} scope="col">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dados.linhas.map((linha, i) => (
            <tr key={i}>
              <th scope="row" title={linha.rotulo}>
                {aoEscolher && visivel ? (
                  <button
                    type="button"
                    className="ui-grafico-tabela-escolher"
                    data-acao="filtrar-pelo-grafico"
                    title={`Filtrar: ${linha.rotulo}`}
                    onClick={() => aoEscolher(i)}
                  >
                    {linha.rotulo}
                  </button>
                ) : (
                  linha.rotulo
                )}
              </th>
              {linha.valores.map((valor, j) => (
                <td key={j}>{valor}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
