import { irParaTela } from "../../app/ir-para-tela.ts";

export type TipoDaCentralDeConvocacoes = "entrevista" | "contratacao";

/**
 * Uma entrada para dois fluxos com fontes e permissões distintas.
 * Esta primeira etapa é a navegação: as ações continuam nos módulos de
 * origem até que os componentes possam ser compartilhados com segurança.
 */
export function CentralDeConvocacoes({
  tipo,
  aoMudar,
  podeEntrevistas,
  podeClassificacao,
}: {
  tipo: TipoDaCentralDeConvocacoes;
  aoMudar: (tipo: TipoDaCentralDeConvocacoes) => void;
  podeEntrevistas: boolean;
  podeClassificacao: boolean;
}) {
  const visao = podeEntrevistas && tipo === "entrevista" ? tipo : "contratacao";
  return (
    <section
      className="central-convocacoes ui-card"
      aria-label="Central de convocações"
    >
      <h3 className="central-convocacoes-titulo">Convocações</h3>
      {podeEntrevistas ? (
        <div
          className="central-convocacoes-escolha"
          role="group"
          aria-label="Tipo de convocação"
        >
          <button
            type="button"
            className={visao === "contratacao" ? "btn green" : "btn secondary"}
            aria-pressed={visao === "contratacao"}
            onClick={() => aoMudar("contratacao")}
          >
            Para contratação
          </button>
          <button
            type="button"
            className={visao === "entrevista" ? "btn green" : "btn secondary"}
            aria-pressed={visao === "entrevista"}
            onClick={() => aoMudar("entrevista")}
          >
            Para entrevistas
          </button>
        </div>
      ) : null}
      {visao === "entrevista" ? (
        <div className="central-convocacoes-acoes">
          {podeClassificacao ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => irParaTela({ view: "classificacao" })}
            >
              Abrir listas da Classificação
            </button>
          ) : null}
          <button
            type="button"
            className="btn green"
            onClick={() => irParaTela({ view: "conduzir-entrevistas" })}
          >
            Abrir Convocação para entrevistas
          </button>
        </div>
      ) : null}
    </section>
  );
}
