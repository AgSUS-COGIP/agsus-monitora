import { irParaTela } from "../../app/ir-para-tela.ts";
import { Segmentado } from "../../ui/index.ts";

export type TipoDaCentralDeConvocacoes = "entrevista" | "contratacao";

/* As duas convocações, no controle segmentado do design system (DESIGN.md). */
const TIPOS_DE_CONVOCACAO = [
  { valor: "contratacao", rotulo: "Para contratação" },
  { valor: "entrevista", rotulo: "Para entrevistas" },
] as const satisfies ReadonlyArray<{
  valor: TipoDaCentralDeConvocacoes;
  rotulo: string;
}>;

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
  /*
    Sem acesso às entrevistas só existe a convocação para contratação: nada a
    escolher, e um cartão só com o título seria espaço vazio.
  */
  if (!podeEntrevistas) return null;
  const visao = tipo === "entrevista" ? tipo : "contratacao";
  return (
    <section
      className="central-convocacoes ui-card"
      aria-label="Central de convocações"
    >
      <div className="central-convocacoes-topo">
        <h3 className="central-convocacoes-titulo">Convocações</h3>
        <Segmentado
          rotulo="Tipo de convocação"
          opcoes={TIPOS_DE_CONVOCACAO}
          valor={visao}
          aoMudar={aoMudar}
        />
      </div>
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
            className="btn"
            onClick={() => irParaTela({ view: "conduzir-entrevistas" })}
          >
            Abrir Convocação para entrevistas
          </button>
        </div>
      ) : null}
    </section>
  );
}
