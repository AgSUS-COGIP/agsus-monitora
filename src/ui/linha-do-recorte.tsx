import type { ReactNode } from "react";

/*
  O recorte ativo de uma tela (`.ui-recorte`): uma linha que diz quais filtros
  estão valendo ("Recorte ativo: Edital: X · Parecer: Apto") ou "Sem filtros".
  `ativos` é `[[campo, rótulo, valor]]`, o mesmo dos chips; `texto` troca a
  frase inteira (Análises, que abre pela situação do processo). Os filhos
  entram abaixo da linha — em geral `<MarcasDoRecorte>`. Usada por Recursos,
  Entrevistas e Análises curriculares.
*/
export type FiltroAtivo = readonly [string, string, string];

/*
  O alcance de cada busca, dito no campo: a da barra de uma tabela só filtra
  a tabela ("Buscar nesta tabela"); a do painel de filtros (ou a da Visão
  geral) recorta a página toda — números, gráficos e tabela — e, enquanto
  vale, o recorte mostra a marca de `textoDaBuscaNaPagina`.
*/
export const BUSCAR_NESTA_TABELA = "Buscar nesta tabela";
export const BUSCAR_NA_PAGINA = "Buscar em toda a página";

/** "Busca “Maria” filtrando a página toda"; "" sem busca. */
export function textoDaBuscaNaPagina(busca: unknown): string {
  const termo = String(busca ?? "").trim();
  return termo ? `Busca “${termo}” filtrando a página toda` : "";
}

/** A marca da busca que recorta a página toda (nada sem busca). */
export function MarcaDaBuscaNaPagina({ busca }: { busca: unknown }) {
  const texto = textoDaBuscaNaPagina(busca);
  if (!texto) return null;
  return (
    <span className="ui-marca" data-tom="alerta" data-marca="busca-na-pagina">
      <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> {texto}
    </span>
  );
}

export function textoDoRecorte(ativos: readonly FiltroAtivo[]): string {
  return ativos.length
    ? `Recorte ativo: ${ativos.map(([, rotulo, valor]) => `${rotulo}: ${valor}`).join(" · ")}`
    : "Sem filtros";
}

export interface PropriedadesDaLinhaDoRecorte {
  ativos?: readonly FiltroAtivo[];
  texto?: string;
  /** A busca do painel de filtros, que recorta a página toda: ganha a marca. */
  buscaNaPagina?: string;
  children?: ReactNode;
}

export function LinhaDoRecorte({
  ativos = [],
  texto,
  buscaNaPagina = "",
  children,
}: PropriedadesDaLinhaDoRecorte) {
  return (
    <section className="ui-card ui-recorte" aria-label="Recorte ativo">
      <p className="ui-recorte-texto" data-recorte="">
        {texto ?? textoDoRecorte(ativos)}
      </p>
      {textoDaBuscaNaPagina(buscaNaPagina) ? (
        <div className="ui-recorte-marcas">
          <MarcaDaBuscaNaPagina busca={buscaNaPagina} />
        </div>
      ) : null}
      {children}
    </section>
  );
}

/*
  As marcas do recorte, embaixo da linha: `{ chave, tom, icone, texto }`, com
  `tom` "sucesso", "alerta" ou "neutro" (o padrão).
*/
export interface MarcaDoRecorte {
  chave: string;
  /** "sucesso", "alerta" ou "neutro" (o padrão). */
  tom?: string;
  icone?: string;
  texto: ReactNode;
}

export interface PropriedadesDasMarcasDoRecorte {
  marcas: readonly MarcaDoRecorte[];
}

export function MarcasDoRecorte({ marcas }: PropriedadesDasMarcasDoRecorte) {
  if (!marcas.length) return null;
  return (
    <div className="ui-recorte-marcas">
      {marcas.map(({ chave, tom, icone, texto }) => (
        <span
          key={chave}
          className="ui-marca"
          data-tom={tom || "neutro"}
          data-marca={chave}
        >
          {icone ? (
            <i className={`fa-solid ${icone}`} aria-hidden="true" />
          ) : null}{" "}
          {texto}
        </span>
      ))}
    </div>
  );
}
