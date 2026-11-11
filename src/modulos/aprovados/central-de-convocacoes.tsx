import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { irParaTela } from "../../app/ir-para-tela.ts";
import { carregarTela } from "../../app/registro-das-telas.ts";
import { situacaoDoSistema } from "../../app/situacao-do-sistema.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { paginaDesligada } from "../../lib/pagina-desligada.ts";
import { abasDoMenu, catalogoDoBanco } from "../../modules/catalogo-de-abas.ts";
import { Aviso, Carregando, Segmentado } from "../../ui/index.ts";

export type TipoDaCentralDeConvocacoes = "entrevista" | "contratacao";

/* As duas convocações, no controle segmentado do design system (DESIGN.md). */
const TIPOS_DE_CONVOCACAO = [
  { valor: "contratacao", rotulo: "Para contratação" },
  { valor: "entrevista", rotulo: "Para entrevistas" },
] as const satisfies ReadonlyArray<{
  valor: TipoDaCentralDeConvocacoes;
  rotulo: string;
}>;

/*
  A convocação para entrevista vem do controlador de Conduzir entrevistas
  (`convocacaoParaLeitura`, com a loja daquela tela): nada de estado
  próprio aqui. A tela baixa sob demanda só quando se escolhe "Para
  entrevistas"; `render()` é o da abertura dela (área atual, editais e o
  edital aberto ou lembrado), repetido a cada vez que se volta a esta visão.
*/
type LeituraDasEntrevistas =
  | { tipo: "carregando" }
  | { tipo: "pronta"; desenhar: (acoes?: ReactNode) => ReactNode }
  | { tipo: "erro"; mensagem: string };

function usarConvocacaoDasEntrevistas(ligada: boolean): LeituraDasEntrevistas {
  const [leitura, setLeitura] = useState<LeituraDasEntrevistas>({
    tipo: "carregando",
  });
  useEffect(() => {
    if (!ligada) return undefined;
    let viva = true;
    carregarTela("conduzir-entrevistas").then(
      (controlador) => {
        if (!viva) return;
        setLeitura({
          tipo: "pronta",
          desenhar: controlador.convocacaoParaLeitura,
        });
        void Promise.resolve(controlador.render()).catch(() => {});
      },
      (erro: unknown) => {
        if (!viva) return;
        setLeitura({
          tipo: "erro",
          mensagem: `Não foi possível abrir a convocação para entrevistas: ${
            erro instanceof Error ? erro.message : String(erro)
          }`,
        });
      },
    );
    return () => {
      viva = false;
    };
  }, [ligada]);
  return leitura;
}

/*
  Conduzir entrevistas desligada pela coordenação na área (Módulos e abas):
  a convocação para entrevista não aparece na central, como não aparece no
  menu. Quem desenha a central junta isto à permissão (`podeEntrevistas`).
*/
export function usarConducaoLigada(): boolean {
  const { area } = usarAreaAtual();
  return !paginaDesligada({
    abas: abasDoMenu(),
    doBanco: catalogoDoBanco(),
    situacao: situacaoDoSistema(),
    view: "conduzir-entrevistas",
    area,
  });
}

/**
 * Uma entrada para dois fluxos com fontes e permissões distintas. Para
 * entrevistas: a lista de convocação da Classificação, só leitura, na loja
 * de Conduzir entrevistas; convocar continua lá. Para contratação: a aba
 * Convocação de sempre (abaixo desta central).
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
  const leitura = usarConvocacaoDasEntrevistas(visao === "entrevista");
  /*
    Sem acesso às entrevistas (ou com Conduzir entrevistas desligada na área)
    só existe a convocação para contratação: nada a escolher, e um cartão só
    com o título seria espaço vazio.
  */
  if (!podeEntrevistas) return null;
  const classificacao = podeClassificacao ? (
    <button
      type="button"
      className="btn secondary"
      onClick={() => irParaTela({ view: "classificacao" })}
    >
      Abrir listas da Classificação
    </button>
  ) : null;
  return (
    <section
      className="central-convocacoes ui-card"
      aria-label="Central de convocações"
      data-tour="central-convocacoes"
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
        <>
          {leitura.tipo === "carregando" ? <Carregando /> : null}
          {leitura.tipo === "pronta" ? leitura.desenhar(classificacao) : null}
          {leitura.tipo === "erro" ? (
            <>
              <Aviso tom="danger">{leitura.mensagem}</Aviso>
              <div className="central-convocacoes-acoes">
                <button
                  type="button"
                  className="btn"
                  onClick={() => irParaTela({ view: "conduzir-entrevistas" })}
                >
                  Abrir Convocação para entrevistas
                </button>
                {classificacao}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
