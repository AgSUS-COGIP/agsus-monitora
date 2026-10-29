import { chamarAcaoDaCasca } from "./acoes.ts";

/*
  As áreas onde as telas montam (`.content` > `<section class="page">`).

  Cada tela é React e monta na própria seção (src/main.ts: montarVisaoGeral,
  montarNucleo e os controladores sob demanda); a navegação
  (`src/app/navegacao.ts`) troca a `.active` e chama `render()`. A Visão geral
  é a seção ativa de saída. A ordem é a de antes: a navegação, os testes e os
  tours da Aya procuram as seções pelo id.
*/
export const TELAS_DA_CASCA = [
  // React: src/modulos/visao-geral/ (mapas da Saúde Indígena e de Projetos).
  "page-dashboard",
  // React: src/modulos/editais/nucleo.tsx (modal do edital e linha do tempo em portal).
  "page-nucleo",
  // React: src/modulos/cronograma/ (o popup do dia é portal no fim do body).
  "page-calendario",
  // React: src/modulos/aprovados/ (os modais são portais no fim do body).
  "page-approved",
  // React: src/modulos/recursos/ — Painel de recursos.
  "page-recursos",
  // React: src/modulos/recursos/ — Analisar recursos.
  "page-analisar-recursos",
  // React: src/modulos/entrevistas/.
  "page-entrevistas",
  // React: src/modulos/entrevistas/conduzir.tsx.
  "page-conduzir-entrevistas",
  // React: src/modulos/analises/.
  "page-analises",
  // React: src/modulos/avaliacao-documental/.
  "page-avaliacao-documental",
  // Triagem independente, sob o mesmo recurso de avaliação documental.
  "page-pre-classificacao",
  // React: src/modulos/classificacao/.
  "page-classificacao",
  // React: src/modulos/selecao/.
  "page-selecao",
] as const;

/** A tela aberta antes de a navegação escolher (a Visão geral). */
const TELA_DE_SAIDA = "page-dashboard";

export function AreasDasTelas() {
  return (
    <div className="content">
      {TELAS_DA_CASCA.map((id) => (
        <section
          key={id}
          id={id}
          className={id === TELA_DE_SAIDA ? "page active" : "page"}
        ></section>
      ))}
      <QuadroDoPainelExterno />
      <PaginaDeConfiguracoes />
    </div>
  );
}

/*
  O quadro dos painéis externos (`src/app/paineis-externos.ts`): título,
  "Atualizar", "Abrir em nova aba" e o `#externalMount`, onde cada painel
  ganha o próprio iframe na primeira abertura.
*/
function QuadroDoPainelExterno() {
  return (
    <section id="page-external" className="page">
      <div className="table-card card">
        <div className="table-head">
          <h3 id="externalTitle"></h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              id="externalRefreshBtn"
              className="btn secondary"
              onClick={() => void chamarAcaoDaCasca("reloadExternal")}
            >
              <i className="fa-solid fa-rotate-right"></i>{" "}
              <span id="externalRefreshText"></span>
            </button>{" "}
            <a
              id="externalOpen"
              className="btn green"
              target="_blank"
              rel="noopener"
            ></a>
          </div>
        </div>
        <div id="externalMount" className="external-placeholder"></div>
      </div>
    </section>
  );
}

/*
  Configurações: a moldura React (`#configuracoesApp`, src/modulos/configuracoes/)
  e os blocos das seções que montam sob demanda — `secoes.ts` os move para a
  seção certa (Acessos, Módulos e abas, Status das atualizações, Automação).
*/
function PaginaDeConfiguracoes() {
  return (
    <section id="page-config" className="page">
      <div id="configuracoesApp" data-configuracoes=""></div>
      <div className="admin-grid">
        <div id="acessosApp" className="full" data-acessos=""></div>
        <div id="modulosApp" className="full" data-modulos=""></div>
        <div
          id="saudeDasCargasApp"
          className="full"
          data-saude-das-cargas=""
        ></div>
        <div id="automacaoApp" className="full" data-automacao=""></div>
      </div>
    </section>
  );
}
