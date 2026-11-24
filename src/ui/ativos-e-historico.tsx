import { useMemo } from "react";
import {
  contarPorSituacao,
  separarAtivosEHistorico,
  textoDasSituacoes,
  vistaDaLista,
} from "../lib/base/ativos-e-historico.ts";
import type {
  SituacaoContada,
  VistaDaLista,
} from "../lib/base/ativos-e-historico.ts";
import { classes } from "./classes.ts";
import { Segmentado } from "./segmentado.tsx";
import { Selo } from "./selo.tsx";
import { usarEstadoDaSessao } from "./usar-estado-da-sessao.ts";

/*
  "Ativos" e "Histórico" de uma lista: a lista de trabalho fica curta e o que
  já terminou, a um clique. O controle é um `Segmentado` (radiogroup, setas
  ← →) com quantos há em cada vista no rótulo; ao lado, quantos há de cada
  situação na vista escolhida ("Em andamento 12 · Suspenso 1"), cada uma num
  `Selo` com o ponto (a cor só complementa o rótulo).

  `usarAtivosEHistorico(itens, { chave, ehHistorico, situacao })` separa a
  lista e guarda a vista na sessão (`chave`, volta no F5); devolve os itens
  visíveis e as propriedades do controle. A lógica é
  src/lib/base/ativos-e-historico.ts.

  Marcação: `.ui-ativos-e-historico` > `.ui-segmentado` (`data-valor`
  "ativos" | "historico") + `ul.ui-ativos-situacoes`.
*/

export interface PropriedadesDeAtivosEHistorico {
  vista: VistaDaLista;
  aoMudar: (vista: VistaDaLista) => void;
  ativos: number;
  historico: number;
  situacoes: ReadonlyArray<SituacaoContada>;
  /** Com número, a terceira opção, "Todas" (as duas juntas). */
  todas?: number;
  /** Outros nomes das opções ("Listas ativas", "Inativas"). */
  rotulos?: Partial<Record<VistaDaLista, string>>;
  /** O nome acessível do controle ("Editais"). */
  rotulo?: string;
  /** O tom do `Selo` de cada situação (o padrão é "neutro"). */
  tomDaSituacao?: (rotulo: string) => string;
  className?: string;
  tour?: string;
}

export function AtivosEHistorico({
  vista,
  aoMudar,
  ativos,
  historico,
  situacoes,
  todas,
  rotulos,
  rotulo = "Lista",
  tomDaSituacao,
  className,
  tour,
}: PropriedadesDeAtivosEHistorico) {
  return (
    <div
      className={classes("ui-ativos-e-historico", className)}
      data-tour={tour}
    >
      <Segmentado
        rotulo={rotulo}
        valor={vista}
        aoMudar={aoMudar}
        opcoes={[
          {
            valor: "ativos",
            rotulo: rotulos?.ativos ?? "Ativos",
            contagem: ativos,
          },
          {
            valor: "historico",
            rotulo: rotulos?.historico ?? "Histórico",
            contagem: historico,
          },
          ...(todas === undefined
            ? []
            : [
                {
                  valor: "todas" as const,
                  rotulo: rotulos?.todas ?? "Todas",
                  contagem: todas,
                },
              ]),
        ]}
      />
      {situacoes.length ? (
        <ul
          className="ui-ativos-situacoes"
          aria-label="Por situação"
          title={textoDasSituacoes(situacoes)}
        >
          {situacoes.map(({ rotulo: nome, quantos }) => (
            <li key={nome}>
              <Selo tom={tomDaSituacao?.(nome) ?? "neutro"} ponto>
                {nome} <strong>{quantos.toLocaleString("pt-BR")}</strong>
              </Selo>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface OpcoesDeAtivosEHistorico<T> {
  /** A chave da sessão (tela e área): a vista volta no F5. */
  chave: string;
  ehHistorico: (item: T) => boolean;
  situacao: (item: T) => unknown;
}

export interface ResultadoDeAtivosEHistorico<T> {
  vista: VistaDaLista;
  /** Os itens da vista escolhida, na ordem em que vieram. */
  visiveis: T[];
  /** As propriedades do `AtivosEHistorico` (sem rótulo nem tom). */
  controle: Pick<
    PropriedadesDeAtivosEHistorico,
    "vista" | "aoMudar" | "ativos" | "historico" | "situacoes"
  >;
}

export function usarAtivosEHistorico<T>(
  itens: ReadonlyArray<T> | null | undefined,
  { chave, ehHistorico, situacao }: OpcoesDeAtivosEHistorico<T>,
): ResultadoDeAtivosEHistorico<T> {
  const [vista, setVista] = usarEstadoDaSessao<VistaDaLista>(
    chave,
    "ativos",
    vistaDaLista,
  );
  const separada = useMemo(
    () => separarAtivosEHistorico(itens, ehHistorico),
    [itens, ehHistorico],
  );
  const todos = useMemo(() => [...(itens || [])], [itens]);
  const visiveis =
    vista === "todas"
      ? todos
      : vista === "historico"
        ? separada.historico
        : separada.ativos;
  const situacoes = useMemo(
    () => contarPorSituacao(visiveis, situacao),
    [visiveis, situacao],
  );
  return {
    vista,
    visiveis,
    controle: {
      vista,
      aoMudar: setVista,
      ativos: separada.ativos.length,
      historico: separada.historico.length,
      situacoes,
    },
  };
}
