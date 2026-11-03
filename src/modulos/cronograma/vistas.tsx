import type { EtapaDoCalendario, MarcoDaEtapa } from "./tipos.ts";
import type { MarcaNoDia } from "../../lib/calendario-editais.ts";
import { useEffect, useMemo, useRef } from "react";
import { dataLocal } from "../../lib/etapas-de-edital.ts";
import {
  DIAS_SEMANA,
  cabecalhoDoDiaDaLista,
  diasDaLista,
  emAndamentoNoDia,
  etapasAtivasNoDia,
  formatarCurto,
} from "../../lib/calendario-editais.ts";
import { classes } from "../../ui/index.ts";
import { BolinhaDaUnidade, ItemDeEtapa, chaveDaEtapa } from "./partes.tsx";

/*
  As vistas Lista e Semana do card do calendário. Recebem as etapas JÁ
  filtradas (as mesmas da grade do mês) e só desenham; as regras de quem entra
  em cada dia estão em `src/lib/calendario-editais.ts`. Clicar numa etapa abre
  o mesmo popup do dia da grade (`DiaDoCalendario`), no dia em que ela começa
  ou termina — o popup só lista as pontas dos intervalos.
*/

/* "começa" e "último dia" reaproveitam a marca da grade (sólida e contornada). */
const MARCO_DA_MARCA: Record<MarcaNoDia, MarcoDaEtapa> = {
  começa: "início",
  "último dia": "fim",
  "no dia": "",
  "em andamento": "",
};

/** O dia do popup para uma etapa vista em `chave`: a ponta dela naquele dia, ou o fim. */
const diaDoPopup = (
  etapa: EtapaDoCalendario,
  marca: MarcaNoDia,
  chave: string,
) => (marca === "em andamento" ? etapa.data_fim || etapa.data_inicio : chave);

export function VistaDaLista({
  etapas,
  inicio,
  fim,
  hojeChave,
  aoAbrirDia,
}: {
  etapas: readonly EtapaDoCalendario[];
  inicio: string;
  fim: string;
  hojeChave: string;
  aoAbrirDia: (chave: string) => void;
}) {
  /*
    "Em andamento" vale para o primeiro dia que a lista mostra: hoje, se o
    período o contém (a lista abre nele), senão o primeiro dia do período.
  */
  const referencia =
    hojeChave >= inicio && hojeChave <= fim ? hojeChave : inicio;
  const dias = useMemo(
    () => diasDaLista(etapas, inicio, fim),
    [etapas, inicio, fim],
  );
  const andamento = useMemo(
    () => emAndamentoNoDia(etapas, referencia),
    [etapas, referencia],
  );
  const lista = useRef<HTMLOListElement>(null);

  // A lista rola dentro do card e abre em hoje (ou no próximo dia com etapa).
  useEffect(() => {
    const ol = lista.current;
    if (!ol) return;
    const alvo = [...ol.querySelectorAll<HTMLElement>("[data-dia]")].find(
      (dia) => (dia.dataset.dia || "") >= referencia,
    );
    ol.scrollTop = alvo ? Math.max(0, alvo.offsetTop - ol.offsetTop) : 0;
  }, [dias, referencia]);

  if (!dias.length && !andamento.length)
    return (
      <p className="cal-vazio">
        Nenhuma etapa neste período com os filtros atuais
      </p>
    );

  return (
    <div className="cal-lista-vista">
      {andamento.length ? (
        <section className="cal-andamento" aria-labelledby="calAndamentoTitulo">
          <h3 id="calAndamentoTitulo" className="cal-lista-dia-titulo">
            Em andamento
            <small> em {formatarCurto(dataLocal(referencia))}</small>
          </h3>
          <ul className="cal-lista-itens">
            {andamento.map((etapa, indice) => (
              <li key={chaveDaEtapa(etapa, indice)}>
                <ItemDeEtapa
                  etapa={etapa}
                  marco="fim"
                  textoDoMarco={`até ${formatarCurto(dataLocal(etapa.data_fim))}`}
                  aoEscolher={() => aoAbrirDia(etapa.data_fim)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ol className="cal-lista" ref={lista} aria-label="Etapas por dia">
        {dias.map((dia) => {
          const hoje = dia.chave === hojeChave;
          return (
            <li
              key={dia.chave}
              className={classes("cal-lista-dia", hoje && "hoje")}
              data-dia={dia.chave}
              aria-current={hoje ? "date" : undefined}
            >
              <h3 className="cal-lista-dia-titulo">
                {dia.titulo}
                {hoje ? <span className="cal-hoje-selo">Hoje</span> : null}
              </h3>
              <ul className="cal-lista-itens">
                {dia.itens.map(({ etapa, marca }, indice) => (
                  <li key={chaveDaEtapa(etapa, indice)}>
                    <ItemDeEtapa
                      etapa={etapa}
                      marco={MARCO_DA_MARCA[marca]}
                      textoDoMarco={marca === "no dia" ? "" : marca}
                      aoEscolher={() => aoAbrirDia(dia.chave)}
                    />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function VistaDaSemana({
  etapas,
  chaves,
  hojeChave,
  aoAbrirDia,
}: {
  etapas: readonly EtapaDoCalendario[];
  chaves: readonly string[];
  hojeChave: string;
  aoAbrirDia: (chave: string) => void;
}) {
  const dias = useMemo(
    () =>
      chaves.map((chave) => ({
        chave,
        itens: etapasAtivasNoDia(etapas, chave),
      })),
    [etapas, chaves],
  );
  return (
    <ol className="cal-semana-vista" aria-label="Etapas ativas na semana">
      {dias.map(({ chave, itens }) => {
        const data = dataLocal(chave);
        const hoje = chave === hojeChave;
        const total = itens.length;
        return (
          <li
            key={chave}
            className={classes("cal-semana-dia", hoje && "hoje")}
            data-dia={chave}
            aria-current={hoje ? "date" : undefined}
          >
            <button
              type="button"
              className="cal-semana-cabeca"
              aria-label={`${cabecalhoDoDiaDaLista(chave)}: ${total} ${
                total === 1 ? "etapa ativa" : "etapas ativas"
              }`}
              onClick={() => aoAbrirDia(chave)}
            >
              <span>{data ? DIAS_SEMANA[data.getDay()] : ""}</span>
              <strong className="cal-numero">{data?.getDate()}</strong>
            </button>
            {total ? (
              <ul className="cal-semana-itens">
                {itens.map(({ etapa, marca }, indice) => (
                  <li key={chaveDaEtapa(etapa, indice)}>
                    <button
                      type="button"
                      className="cal-mini"
                      data-cor={etapa.tipo.cor}
                      data-marca={marca}
                      title={`${etapa.atividade} — ${etapa.unidade}, Ed. ${etapa.edital}`}
                      onClick={() =>
                        aoAbrirDia(diaDoPopup(etapa, marca, chave))
                      }
                    >
                      {marca === "começa" || marca === "último dia" ? (
                        <span className="cal-mini-marca">{marca}</span>
                      ) : null}
                      <span className="cal-mini-nome">{etapa.atividade}</span>
                      <small>
                        <BolinhaDaUnidade unidade={etapa.unidade} />
                        {etapa.unidade}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cal-semana-vazio">Sem etapas</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
