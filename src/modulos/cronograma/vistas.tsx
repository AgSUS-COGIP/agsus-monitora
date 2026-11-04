import type { EtapaDoCalendario } from "./tipos.ts";
import type { MarcaNoDia } from "../../lib/calendario-editais.ts";
import { useId, useMemo, useState } from "react";
import { dataLocal } from "../../lib/etapas-de-edital.ts";
import {
  DIAS_SEMANA,
  cabecalhoDoDiaDaLista,
  diasDaLista,
  emAndamentoNoDia,
  etapasAtivasNoDia,
  formatarCurto,
  unidadeCurta,
} from "../../lib/calendario-editais.ts";
import { classes } from "../../ui/index.ts";
import {
  ItemDeEtapa,
  TipoDaEtapa,
  chaveDaEtapa,
  textoDaMarca,
} from "./partes.tsx";

/*
  As vistas Lista e Semana do card do calendário. Recebem as etapas JÁ
  filtradas (as mesmas da grade do mês) e só desenham; as regras de quem entra
  em cada dia estão em `src/lib/calendario-editais.ts`. Clicar numa etapa abre
  o mesmo popup do dia da grade (`DiaDoCalendario`).

  A Lista rola com a página (sem barra de rolagem dentro do card). No mês de
  hoje ela começa hoje: os dias anteriores ficam recolhidos num botão, e o que
  já está em andamento aparece uma vez, em "Acontecendo agora".
*/

/** Acima disto, "Acontecendo agora" nasce recolhido. */
const ANDAMENTO_ABERTO_ATE = 3;

/** O dia do popup para uma etapa vista em `chave`: a ponta dela naquele dia, ou o fim. */
const diaDoPopup = (
  etapa: EtapaDoCalendario,
  marca: MarcaNoDia,
  chave: string,
) => (marca === "em andamento" ? etapa.data_fim || etapa.data_inicio : chave);

const quantasEtapas = (total: number) =>
  `${total} ${total === 1 ? "etapa" : "etapas"}`;

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
    "Acontecendo agora" vale para o primeiro dia que a lista mostra: hoje, se o
    período o contém, senão o primeiro dia do período.
  */
  const referencia =
    hojeChave >= inicio && hojeChave <= fim ? hojeChave : inicio;
  const ano = Number(hojeChave.slice(0, 4)) || new Date().getFullYear();
  const dias = useMemo(
    () => diasDaLista(etapas, inicio, fim, ano),
    [etapas, inicio, fim, ano],
  );
  const andamento = useMemo(
    () => emAndamentoNoDia(etapas, referencia),
    [etapas, referencia],
  );
  const anteriores = dias.filter((dia) => dia.chave < referencia);
  const seguintes = dias.filter((dia) => dia.chave >= referencia);
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [andamentoAberto, setAndamentoAberto] = useState(
    andamento.length <= ANDAMENTO_ABERTO_ATE,
  );
  const idDoAndamento = useId();

  if (!dias.length && !andamento.length)
    return (
      <p className="cal-vazio">
        Nenhuma etapa neste período com os filtros atuais
      </p>
    );

  const desenharDia = (dia: (typeof dias)[number]) => {
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
                marca={textoDaMarca(etapa, marca)}
                aoEscolher={() => aoAbrirDia(dia.chave)}
              />
            </li>
          ))}
        </ul>
      </li>
    );
  };

  return (
    <div className="cal-lista-vista">
      {andamento.length ? (
        <section className="cal-andamento" aria-label="Acontecendo agora">
          <button
            type="button"
            className="cal-andamento-cabeca"
            aria-expanded={andamentoAberto}
            aria-controls={idDoAndamento}
            onClick={() => setAndamentoAberto((aberto) => !aberto)}
          >
            <i
              className={`fa-solid fa-chevron-${andamentoAberto ? "down" : "right"}`}
              aria-hidden="true"
            />
            <span className="cal-andamento-titulo">
              Acontecendo agora · {quantasEtapas(andamento.length)}
            </span>
          </button>
          <ul
            id={idDoAndamento}
            className="cal-lista-itens"
            hidden={!andamentoAberto}
          >
            {andamento.map((etapa, indice) => (
              <li key={chaveDaEtapa(etapa, indice)}>
                <ItemDeEtapa
                  etapa={etapa}
                  marca={`até ${formatarCurto(dataLocal(etapa.data_fim))}`}
                  aoEscolher={() => aoAbrirDia(etapa.data_fim)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {anteriores.length ? (
        <button
          type="button"
          className="cal-anteriores"
          aria-expanded={verAnteriores}
          onClick={() => setVerAnteriores((ver) => !ver)}
        >
          {verAnteriores
            ? "Esconder os dias anteriores"
            : `Ver ${anteriores.length} ${
                anteriores.length === 1 ? "dia anterior" : "dias anteriores"
              } deste mês`}
        </button>
      ) : null}
      <ol className="cal-lista" aria-label="Etapas por dia">
        {verAnteriores ? anteriores.map(desenharDia) : null}
        {seguintes.map(desenharDia)}
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
  const ano = Number(hojeChave.slice(0, 4)) || new Date().getFullYear();
  const dias = useMemo(
    () =>
      chaves.map((chave) => {
        // Como no Mês: a etapa com período aparece só no início e no fim; o
        // dia do meio só a conta, e clicar no dia mostra quem está em andamento.
        const ativas = etapasAtivasNoDia(etapas, chave);
        const itens = ativas.filter(({ marca }) => marca !== "em andamento");
        return { chave, itens, emAndamento: ativas.length - itens.length };
      }),
    [etapas, chaves],
  );
  return (
    <ol className="cal-semana-vista" aria-label="Etapas da semana">
      {dias.map(({ chave, itens, emAndamento }) => {
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
              aria-label={`${cabecalhoDoDiaDaLista(chave, ano)}: ${total} ${
                total === 1 ? "etapa" : "etapas"
              }${emAndamento ? `, ${emAndamento} em andamento` : ""}`}
              onClick={() => aoAbrirDia(chave)}
            >
              <span>{data ? DIAS_SEMANA[data.getDay()] : ""}</span>
              <strong className="cal-numero">{data?.getDate()}</strong>
              {hoje ? <span className="cal-hoje-selo">Hoje</span> : null}
            </button>
            {total ? (
              <ul className="cal-semana-itens">
                {itens.map(({ etapa, marca }, indice) => {
                  const texto = textoDaMarca(etapa, marca);
                  return (
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
                        <strong className="cal-mini-nome">
                          {etapa.atividade}
                        </strong>
                        <small>
                          <TipoDaEtapa etapa={etapa} />
                        </small>
                        <small>
                          {unidadeCurta(etapa.unidade)}
                          {texto ? (
                            <span className="cal-mini-marca"> · {texto}</span>
                          ) : null}
                        </small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : emAndamento ? null : (
              <p className="cal-semana-vazio">Sem etapas</p>
            )}
            {emAndamento ? (
              <button
                type="button"
                className="cal-semana-andamento"
                onClick={() => aoAbrirDia(chave)}
              >
                {emAndamento} em andamento
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
