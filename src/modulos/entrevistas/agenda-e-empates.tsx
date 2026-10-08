import { useMemo } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  proximosDiasDaAgenda,
  type GrupoEmpatado,
  type ItemDaAgenda,
} from "../../lib/painel-de-entrevistas.ts";
import { rotuloDoDia } from "../../lib/fila-de-conducao.ts";
import { Aviso } from "../../ui/index.js";

/*
  Dois blocos do Painel de entrevistas, entre os KPIs e a tabela:

  - Agenda dos próximos dias: com um edital no recorte, os horários salvos na
    Classificação › Agenda, um dia por coluna; "Conduzir" leva à fila.
  - Empates: candidatos com a mesma nota da entrevista na mesma vaga; o
    desempate é feito na Classificação (botão com o edital já aberto).
*/

const n = (valor: number) => formatNumberBR(valor);

/* ── Agenda dos próximos dias ─────────────────────────────────────── */

export function AgendaDosProximosDias({
  itens,
  hoje,
  aoConduzir,
  aoAbrirAgenda,
}: {
  itens: ItemDaAgenda[] | null;
  hoje: string;
  aoConduzir: (() => void) | null;
  aoAbrirAgenda: (() => void) | null;
}) {
  const dias = useMemo(() => proximosDiasDaAgenda(itens, hoje), [itens, hoje]);
  return (
    <section
      className="ui-card entrevistas-agenda-proxima"
      aria-labelledby="entrevistasAgendaProximaTitulo"
      aria-busy={itens === null}
      data-tour="entrevistas-agenda-proxima"
    >
      <div className="entrevistas-agenda-topo">
        <h2 className="ui-titulo" id="entrevistasAgendaProximaTitulo">
          Agenda dos próximos dias
        </h2>
        <span className="ui-acoes">
          {aoAbrirAgenda ? (
            <button
              type="button"
              className="btn secondary small"
              onClick={aoAbrirAgenda}
            >
              Agenda na Classificação
            </button>
          ) : null}
          {aoConduzir ? (
            <button
              type="button"
              className="btn small"
              data-ir-para="conduzir-entrevistas"
              onClick={aoConduzir}
            >
              <i className="fa-solid fa-play" aria-hidden="true" /> Conduzir
            </button>
          ) : null}
        </span>
      </div>
      {itens === null ? (
        <div className="ui-esqueleto-linha" />
      ) : dias.length ? (
        <ol className="entrevistas-agenda-dias">
          {dias.map((d) => (
            <li
              key={d.data}
              data-dia={d.data}
              data-hoje={d.data === hoje ? "sim" : undefined}
            >
              <strong className="entrevistas-agenda-dia">
                {rotuloDoDia(d.data, hoje)}
                <span>
                  {n(d.itens.length)}{" "}
                  {d.itens.length === 1 ? "entrevista" : "entrevistas"}
                </span>
              </strong>
              <ul>
                {d.itens.slice(0, 6).map((i) => (
                  <li key={`${i.analise_id}-${i.inicio}`}>
                    <time>{String(i.inicio || "").slice(0, 5) || "—"}</time>
                    <span>{i.nome}</span>
                    <small>{i.vaga}</small>
                  </li>
                ))}
                {d.itens.length > 6 ? (
                  <li className="entrevistas-agenda-mais">
                    + {n(d.itens.length - 6)}
                  </li>
                ) : null}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="entrevistas-vazio-linha">
          Nenhuma entrevista agendada a partir de hoje.
        </p>
      )}
    </section>
  );
}

/* ── Empates na nota da entrevista ────────────────────────────────── */

export function AvisoDeEmpates({
  grupos,
  aoAbrirClassificacao,
}: {
  grupos: GrupoEmpatado[];
  aoAbrirClassificacao: (editalId: string | null) => void;
}) {
  if (!grupos.length) return null;
  const candidatos = grupos.reduce((total, g) => total + g.ids.length, 0);
  const editais = [...new Set(grupos.map((g) => g.editalId))];
  const unico = editais.length === 1 ? (editais[0] ?? null) : null;
  return (
    <Aviso tom="warning" className="entrevistas-empates">
      <span
        className="entrevistas-empates-texto"
        data-tour="entrevistas-empates"
      >
        <strong>
          {n(candidatos)} candidatos empatados na nota da entrevista
        </strong>{" "}
        — o desempate é feito na Classificação.
        <button
          type="button"
          className="btn secondary small"
          data-ir-para="classificacao"
          onClick={() => aoAbrirClassificacao(unico)}
        >
          Desempatar na Classificação
        </button>
      </span>
      <details className="entrevistas-empates-lista">
        <summary>
          {n(grupos.length)} {grupos.length === 1 ? "empate" : "empates"}
        </summary>
        <ul>
          {grupos.map((g) => (
            <li key={g.chave}>
              <strong>
                {g.edital} · vaga {g.vaga} ·{" "}
                {formatNumberBR(g.nota, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>{" "}
              {g.candidatos.join(", ")}
            </li>
          ))}
        </ul>
      </details>
    </Aviso>
  );
}
