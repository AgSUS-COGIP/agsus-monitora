import type { ReactNode } from "react";
import { classes } from "./classes.ts";

/*
  O cabeçalho das telas da seleção (`.ui-cabecalho-da-tela`), numa linha que
  quebra no celular: a trilha pequena ("Projetos / Seleção") e o título
  grande; o edital (o SeletorDeEdital em linha, com "Edital" acima); e, à
  direita, as seções (um <Segmentado>), o que a tela acrescentar (`children`)
  e o Atualizar só com o ícone (nome acessível "Atualizar").

  O título da página no cabeçalho do app fica só para o leitor de tela
  nessas telas (`tituloNaTela` em src/lib/rotas.ts): aqui ele aparece uma
  vez, grande.
*/

export interface PropriedadesDoCabecalhoDaTela {
  trilha: string;
  titulo: string;
  edital?: ReactNode;
  secoes?: ReactNode;
  aoAtualizar?: () => void;
  atualizarDesativado?: boolean;
  className?: string;
  tour?: string;
  children?: ReactNode;
}

export function CabecalhoDaTela({
  trilha,
  titulo,
  edital = null,
  secoes = null,
  aoAtualizar,
  atualizarDesativado = false,
  className,
  tour,
  children,
}: PropriedadesDoCabecalhoDaTela) {
  return (
    <header
      className={classes("ui-cabecalho-da-tela", className)}
      data-tour={tour}
    >
      <div className="ui-cabecalho-nome">
        {trilha ? <span className="ui-cabecalho-trilha">{trilha}</span> : null}
        <h2 className="ui-cabecalho-titulo">{titulo}</h2>
      </div>
      {edital ? <div className="ui-cabecalho-edital">{edital}</div> : null}
      <div className="ui-cabecalho-acoes">
        {secoes}
        {children}
        {aoAtualizar ? (
          <button
            type="button"
            className="btn contorno ui-botao-icone"
            data-acao="atualizar"
            aria-label="Atualizar"
            title="Atualizar"
            disabled={atualizarDesativado}
            onClick={aoAtualizar}
          >
            <i className="fa-solid fa-rotate" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
