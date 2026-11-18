import { useMemo } from "react";
import type { LinhaDoMonitoramento } from "../../componentes/tipos-do-monitoramento.ts";
import { guardarFiltrosDaTela } from "../../app/filtros-no-endereco.ts";
import type { JanelaDoApp } from "../../app/ir-para-tela.ts";
import { resumoDoMapa } from "../../lib/mapas/mapa-saude-indigena/aba-do-mapa.ts";
import type { DestaqueDoMapa } from "../../lib/mapas/mapa-saude-indigena/aba-do-mapa.ts";

/*
  O MAPA NA VISÃO GERAL (Saúde Indígena): um cartão no lugar do mapa grande,
  que virou a aba Mapa (src/modulos/mapa/). Três números pelas contas das
  bolhas (`resumoDoMapa`), da área inteira, como o Mapa os mostra: quantos
  DSEIs têm edital, o com mais ociosas e o menos preenchido. O nome do DSEI
  abre o Mapa já nele (`/saude-indigena/mapa/<dsei>`); "Abrir no mapa", no
  Brasil.

  O DSEI vai como filtro guardado da tela do Mapa (a navegação monta o
  endereço com ele, src/app/navegacao.ts `caminhoAtual`), e a troca de tela é
  a de sempre (`window.navigate`, que confere a permissão).
*/

const formatar = (n: number) => n.toLocaleString("pt-BR");

export interface PropsDoCartaoDoMapa {
  linhas: readonly LinhaDoMonitoramento[];
  carregado: boolean;
  /** Abre o Mapa (nos testes, um falso). */
  irPara?: (view: string) => unknown;
}

export function CartaoDoMapa({
  linhas,
  carregado,
  irPara = (view) => (globalThis.window as JanelaDoApp)?.navigate?.(view),
}: PropsDoCartaoDoMapa) {
  const resumo = useMemo(() => resumoDoMapa(linhas), [linhas]);
  const abrir = (dsei: string) => {
    guardarFiltrosDaTela(
      "mapa",
      dsei ? `dsei=${encodeURIComponent(dsei)}` : "",
    );
    irPara("mapa");
  };
  const destaque = (
    rotulo: string,
    item: DestaqueDoMapa | null,
    valor: (n: number) => string,
  ) =>
    item ? (
      <div className="visao-geral-cartao-do-mapa-fato">
        <dt>{rotulo}</dt>
        <dd>
          <button
            type="button"
            className="visao-geral-link"
            onClick={() => abrir(item.endereco)}
          >
            {item.nome}
          </button>{" "}
          · {valor(item.valor)}
        </dd>
      </div>
    ) : null;

  return (
    <section
      className="ui-card visao-geral-cartao-do-mapa"
      aria-labelledby="visaoGeralCartaoDoMapa"
      data-tour="visao-geral-mapa-saude-indigena"
    >
      <h2 className="ui-titulo" id="visaoGeralCartaoDoMapa">
        Mapa
      </h2>
      <dl className="visao-geral-cartao-do-mapa-fatos">
        <div className="visao-geral-cartao-do-mapa-fato">
          <dt>DSEIs com edital</dt>
          <dd>
            {carregado
              ? `${formatar(resumo.comEdital)} de ${formatar(resumo.total)}`
              : "…"}
          </dd>
        </div>
        {carregado
          ? destaque("Mais ociosas", resumo.maisOciosas, formatar)
          : null}
        {carregado
          ? destaque(
              "Menos preenchido",
              resumo.menosPreenchido,
              (n) => `${formatar(n)}%`,
            )
          : null}
      </dl>
      <button
        type="button"
        className="btn secondary visao-geral-cartao-do-mapa-abrir"
        onClick={() => abrir("")}
      >
        Abrir no mapa
      </button>
    </section>
  );
}
