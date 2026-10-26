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

export function textoDoRecorte(ativos: readonly FiltroAtivo[]): string {
  return ativos.length
    ? `Recorte ativo: ${ativos.map(([, rotulo, valor]) => `${rotulo}: ${valor}`).join(" · ")}`
    : "Sem filtros";
}

export interface PropriedadesDaLinhaDoRecorte {
  ativos?: readonly FiltroAtivo[];
  texto?: string;
  children?: ReactNode;
}

export function LinhaDoRecorte({
  ativos = [],
  texto,
  children,
}: PropriedadesDaLinhaDoRecorte) {
  return (
    <section className="ui-card ui-recorte" aria-label="Recorte ativo">
      <p className="ui-recorte-texto" data-recorte="">
        {texto ?? textoDoRecorte(ativos)}
      </p>
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
