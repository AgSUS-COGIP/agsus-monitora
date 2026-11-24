import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { classes } from "./classes.ts";

/*
  O cabeçalho das telas da seleção (`.ui-cabecalho-da-tela`), numa linha que
  quebra no celular: a trilha pequena ("Projetos / Seleção") e o título
  grande; o edital (o SeletorDeEdital em linha, com "Edital" acima); e, à
  direita, as seções (um <Segmentado>), o que a tela acrescentar (`children`)
  e o Atualizar só com o ícone (nome acessível "Atualizar"). Embaixo, numa
  linha inteira, as `etapas` (a faixa do fluxo entre as etapas do edital,
  src/componentes/fluxo-das-etapas.tsx).

  Na tela aberta de uma área, a trilha e o título não ficam aqui: vão, por
  portal, para o cabeçalho do app (`TituloNoTopo`), que mostra
  "● Área › Tela". As telas (src/app/telas.tsx) dizem onde, pelo
  `DestinoDoTitulo`; sem ele (telas soltas, testes, Configurações), o nome
  fica aqui, como antes. Sem outra coisa a mostrar, o cabeçalho da tela nem
  aparece no conteúdo.
*/

export interface DestinoDoTitulo {
  /** O elemento do título no cabeçalho do app. */
  elemento: HTMLElement;
  /** A trilha quando a tela não traz a sua (o nome da área). */
  trilhaPadrao: string;
}

export const DestinoDoTituloDaTela = createContext<DestinoDoTitulo | null>(
  null,
);

/* "● Área › Tela" no cabeçalho do app. O título da página (h1) segue lá, para o leitor de tela. */
function TituloNoTopo({
  destino,
  trilha,
  titulo,
}: {
  destino: DestinoDoTitulo;
  trilha: string;
  titulo: string;
}) {
  return createPortal(
    <span className="topo-tela" aria-hidden="true">
      <span className="topo-tela__trilha">
        <span className="topo-tela__ponto" />
        {trilha || destino.trilhaPadrao}
      </span>
      <span className="topo-tela__separador">›</span>
      <span className="topo-tela__titulo">{titulo}</span>
    </span>,
    destino.elemento,
  );
}

export interface PropriedadesDoCabecalhoDaTela {
  trilha: string;
  titulo: string;
  descricao?: ReactNode;
  edital?: ReactNode;
  secoes?: ReactNode;
  etapas?: ReactNode;
  aoAtualizar?: () => void;
  atualizarDesativado?: boolean;
  className?: string;
  tour?: string;
  children?: ReactNode;
}

export function CabecalhoDaTela({
  trilha,
  titulo,
  descricao = null,
  edital = null,
  secoes = null,
  etapas = null,
  aoAtualizar,
  atualizarDesativado = false,
  className,
  tour,
  children,
}: PropriedadesDoCabecalhoDaTela) {
  const destino = useContext(DestinoDoTituloDaTela);
  const noTopo = destino ? (
    <TituloNoTopo destino={destino} trilha={trilha} titulo={titulo} />
  ) : null;
  const temAcoes = Boolean(secoes || children || aoAtualizar);
  if (destino && !edital && !temAcoes && !etapas) return noTopo;
  return (
    <header
      className={classes("ui-cabecalho-da-tela", className)}
      data-tour={tour}
      data-titulo-no-topo={destino ? "" : undefined}
    >
      {noTopo}
      {destino ? null : (
        <div className="ui-cabecalho-nome">
          {trilha ? (
            <span className="ui-cabecalho-trilha">{trilha}</span>
          ) : null}
          <h2 className="ui-cabecalho-titulo">{titulo}</h2>
          {descricao ? (
            <p className="ui-cabecalho-descricao">{descricao}</p>
          ) : null}
        </div>
      )}
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
      {etapas}
    </header>
  );
}
