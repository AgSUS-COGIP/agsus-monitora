import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { irParaTela } from "../../app/ir-para-tela.ts";
import { carregarTela } from "../../app/registro-das-telas.ts";
import type { ControladoresDasTelas } from "../../app/registro-das-telas.ts";
import { usarPaginaLigada } from "../../componentes/usar-pagina-ligada.ts";
import type { TipoDaCentralDeConvocacoes } from "../../lib/aprovados/central-de-convocacoes.ts";
import { Aviso, Carregando, Segmentado } from "../../ui/index.ts";

export type { TipoDaCentralDeConvocacoes };

/**
 * O edital que o atalho "Ver em Convocações" pediu (Classificação ›
 * Listas, Conduzir › Preparar): abre na loja de Conduzir uma vez. `vez`
 * distingue dois pedidos do mesmo edital.
 */
export type EditalPedidoDaCentral = { id: string; vez: number };

/* As duas convocações, no controle segmentado do design system (`Segmentado`, src/ui/). */
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
type ControladorDaConducao = ControladoresDasTelas["conduzir-entrevistas"];
type LeituraDasEntrevistas =
  | { tipo: "carregando" }
  | {
      tipo: "pronta";
      controlador: ControladorDaConducao;
      /** O `render()` desta abertura (editais e o edital lembrado). */
      aberta: Promise<unknown>;
    }
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
        const aberta = Promise.resolve(controlador.render()).catch(() => {});
        setLeitura({ tipo: "pronta", controlador, aberta });
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
  return usarPaginaLigada("conduzir-entrevistas");
}

/*
  O edital pedido pelo atalho abre na loja de Conduzir depois do `render()`
  (que abre o lembrado), só se estiver na lista de lá e não for o aberto.
  Trocar o edital aqui é trocar o de Conduzir entrevistas, como no seletor.
*/
function usarEditalPedido(
  leitura: LeituraDasEntrevistas,
  pedido: EditalPedidoDaCentral | null,
) {
  useEffect(() => {
    if (leitura.tipo !== "pronta" || !pedido?.id) return undefined;
    let viva = true;
    void leitura.aberta.then(() => {
      if (!viva) return;
      const { conducao } = leitura.controlador;
      const { editais, editalId } = conducao.obter();
      if (editalId === pedido.id) return;
      if (!editais.lista.some((m) => m.id === pedido.id)) return;
      conducao.abrirFicha(null);
      void conducao.abrirEdital(pedido.id);
    });
    return () => {
      viva = false;
    };
  }, [leitura, pedido]);
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
  editalPedido = null,
}: {
  tipo: TipoDaCentralDeConvocacoes;
  aoMudar: (tipo: TipoDaCentralDeConvocacoes) => void;
  podeEntrevistas: boolean;
  podeClassificacao: boolean;
  editalPedido?: EditalPedidoDaCentral | null;
}) {
  const visao = podeEntrevistas && tipo === "entrevista" ? tipo : "contratacao";
  const leitura = usarConvocacaoDasEntrevistas(visao === "entrevista");
  usarEditalPedido(leitura, visao === "entrevista" ? editalPedido : null);
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
          {leitura.tipo === "pronta"
            ? leitura.controlador.convocacaoParaLeitura(classificacao, {
                podeEditarAgenda: podeClassificacao,
              })
            : null}
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
