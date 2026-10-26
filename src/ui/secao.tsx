import type { ReactNode } from "react";

/*
  Seção de detalhe (na gaveta), o par rótulo/valor e a grade deles. Usados
  pela gaveta de Recursos e pela de Entrevistas. Um `Kv` vazio mostra "—" e
  fica marcado (`data-empty`) para o CSS apagá-lo.

  Marcação: `.ui-secao`, `.ui-kv`, `.ui-kv-grade`.
*/

const vazio = (valor: ReactNode) =>
  valor === null || valor === undefined || valor === "" || valor === "—";

export interface PropriedadesDoKv {
  rotulo: ReactNode;
  children?: ReactNode;
}

/* Um par rótulo/valor; vazio, some (`data-empty`). */
export function Kv({ rotulo, children }: PropriedadesDoKv) {
  const semValor = vazio(children);
  return (
    <div className="ui-kv" data-empty={semValor || undefined}>
      <div className="ui-kv-rotulo">{rotulo}</div>
      <div className="ui-kv-valor">{semValor ? "—" : children}</div>
    </div>
  );
}

export interface PropriedadesDaGradeDeKv {
  className?: string;
  rotulo?: string;
  children?: ReactNode;
}

/* A grade de pares rótulo/valor; `className` acrescenta a de quem usa. */
export function GradeDeKv({
  className,
  rotulo,
  children,
}: PropriedadesDaGradeDeKv) {
  const base = "ui-kv-grade";
  return (
    <div
      className={className ? `${base} ${className}` : base}
      aria-label={rotulo}
    >
      {children}
    </div>
  );
}

export interface PropriedadesDaSecao {
  icone: string;
  titulo: string;
  secao?: string;
  children?: ReactNode;
}

/* Uma seção da gaveta: ícone, título e o conteúdo. */
export function Secao({ icone, titulo, secao, children }: PropriedadesDaSecao) {
  return (
    <section className="ui-secao" data-section={secao} aria-label={titulo}>
      <div className="ui-secao-topo">
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
        <span>{titulo}</span>
      </div>
      {children}
    </section>
  );
}
