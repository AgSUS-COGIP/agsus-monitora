import type { ReactNode } from "react";
import { classes } from "./classes.ts";

/*
  O navegador de mês (o padrão das telas do SIGEPSI): ‹ anterior, › próximo,
  o mês à vista (anunciado ao mudar) e o botão do mês atual. Quem usa guarda
  o mês e diz o que cada botão faz; o rótulo dos passos muda quando o passo é
  outro (a semana do Cronograma).

  Usado no Cronograma (mês e semana) e na agenda dos convocados da
  Classificação (quando a agenda passa de um mês).

  `ids` e `tours` levam os ids e os `data-tour` de cada peça (contrato de
  teste e dos roteiros da Aya). Marcação: `.ui-navegador-de-mes` >
  `.ui-navegador-de-mes-setas` (os dois botões só com ícone, com
  `aria-label` e `title`) + o título (`.ui-titulo`, `aria-live`) + o botão
  do atual.
*/

type Peca = "anterior" | "seguinte" | "titulo" | "atual";

export interface PropriedadesDoNavegadorDeMes {
  /** O mês à vista ("Novembro 2026"). */
  titulo: ReactNode;
  aoAnterior: () => void;
  aoSeguinte: () => void;
  aoAtual: () => void;
  rotuloAnterior?: string;
  rotuloSeguinte?: string;
  rotuloAtual?: string;
  anteriorDesativado?: boolean;
  seguinteDesativado?: boolean;
  atualDesativado?: boolean;
  /** O nível do título (h2 no Cronograma, h4 dentro de um card). */
  nivel?: "h2" | "h3" | "h4";
  ids?: Partial<Record<Peca, string>>;
  tours?: Partial<Record<Peca | "grupo", string>>;
  className?: string;
}

export function NavegadorDeMes({
  titulo,
  aoAnterior,
  aoSeguinte,
  aoAtual,
  rotuloAnterior = "Mês anterior",
  rotuloSeguinte = "Próximo mês",
  rotuloAtual = "Mês atual",
  anteriorDesativado = false,
  seguinteDesativado = false,
  atualDesativado = false,
  nivel: Titulo = "h2",
  ids = {},
  tours = {},
  className,
}: PropriedadesDoNavegadorDeMes) {
  return (
    <div
      className={classes("ui-navegador-de-mes", className)}
      data-tour={tours.grupo}
    >
      <span className="ui-navegador-de-mes-setas">
        <button
          id={ids.anterior}
          data-tour={tours.anterior}
          data-acao="mes-anterior"
          className="btn secondary small"
          type="button"
          aria-label={rotuloAnterior}
          title={rotuloAnterior}
          disabled={anteriorDesativado}
          onClick={aoAnterior}
        >
          <i className="fa-solid fa-chevron-left" aria-hidden="true" />
        </button>
        <button
          id={ids.seguinte}
          data-tour={tours.seguinte}
          data-acao="mes-seguinte"
          className="btn secondary small"
          type="button"
          aria-label={rotuloSeguinte}
          title={rotuloSeguinte}
          disabled={seguinteDesativado}
          onClick={aoSeguinte}
        >
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      </span>
      <Titulo id={ids.titulo} className="ui-titulo" aria-live="polite">
        {titulo}
      </Titulo>
      <button
        id={ids.atual}
        data-tour={tours.atual}
        data-acao="mes-atual"
        className="btn secondary small"
        type="button"
        disabled={atualDesativado}
        onClick={aoAtual}
      >
        {rotuloAtual}
      </button>
    </div>
  );
}
