import type { ReactNode } from "react";
import { BotoesDeExportacao } from "./botoes-de-exportacao.tsx";
import { MaisAcoes } from "./mais-acoes.tsx";
import type { PropriedadesDosBotoesDeExportacao } from "./botoes-de-exportacao.tsx";

/*
  O topo de uma tela (`.ui-topo`): as visões (um <Segmentado>, opcional), a
  data da última carga, discreta e uma vez só (`.status-discreto`), e as ações
  (Atualizar, "Exportar em Excel" e "Salvar em PDF" — BotoesDeExportacao — e
  os botões da tela, que entram como filhos, depois deles). `rotuloDaAtualizacao` troca o texto do Atualizar (os Painéis
  usam "Sincronizar").

  `principal`: a ação principal da tela (Novo edital, Sub judice), sempre à
  vista e por último. Abaixo de 768px, só ela fica no topo; o resto (o
  Atualizar, a exportação e os filhos) vai para "Mais ações" (MaisAcoes). Sem
  `principal`, a principal é o Atualizar.

  O título e a área já estão no cabeçalho do app, e tema e tela cheia são do
  app (barra lateral e menu da conta): o topo não os repete.
*/

/** Sem `exportacao` (ou sem `excel` e `pdf` nela), os botões de exportar não aparecem. */
export interface PropriedadesDoTopoDoPainel {
  status: ReactNode;
  aoAtualizar: () => void;
  atualizarDesativado?: boolean;
  rotuloDaAtualizacao?: string;
  exportacao?: PropriedadesDosBotoesDeExportacao;
  visoes?: ReactNode;
  principal?: ReactNode;
  idDaAtualizacao?: string;
  tour?: string;
  children?: ReactNode;
}

export function TopoDoPainel({
  visoes = null,
  status,
  aoAtualizar,
  idDaAtualizacao,
  atualizarDesativado,
  rotuloDaAtualizacao = "Atualizar",
  exportacao,
  principal = null,
  tour,
  children,
}: PropriedadesDoTopoDoPainel) {
  const atualizar = (
    <button
      id={idDaAtualizacao}
      type="button"
      className="btn secondary"
      data-acao="atualizar"
      disabled={atualizarDesativado}
      onClick={aoAtualizar}
    >
      <i className="fa-solid fa-rotate" aria-hidden="true" />{" "}
      {rotuloDaAtualizacao}
    </button>
  );
  return (
    <header className="ui-topo" data-tour={tour}>
      {visoes ? <div className="ui-topo-titulo">{visoes}</div> : null}
      <div className="ui-topo-acoes">
        <span className="status-discreto" data-status-da-carga="">
          {status}
        </span>
        {principal ? null : atualizar}
        <MaisAcoes>
          {principal ? atualizar : null}
          {exportacao ? <BotoesDeExportacao {...exportacao} /> : null}
          {children}
        </MaisAcoes>
        {principal}
      </div>
    </header>
  );
}
