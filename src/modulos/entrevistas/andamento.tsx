import { useMemo } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  andamentoPorEdital,
  percentualFeito,
  proximosDiasDaAgenda,
  type AndamentoDoEdital,
  type EntrevistaDoPainel,
  type GrupoEmpatado,
  type ItemDaAgenda,
  type Numeros,
} from "../../lib/painel-de-entrevistas.ts";
import { rotuloDoDia } from "../../lib/fila-de-conducao.ts";
import { Aviso } from "../../ui/index.js";

/*
  Os blocos "vivos" do Painel de entrevistas (acompanhar), acima dos
  indicadores e da tabela:

  - Andamento: um cartão por edital do recorte (clicar escolhe o edital); com
    um edital escolhido (ou um só na área), o resumo dele e um cartão por
    vaga (clicar recorta a vaga; de novo, tira). Cada cartão: o percentual
    feito, a barra nas cores da Avaliação documental (apto verde, inapto
    vermelho, faltou amarelo, em andamento azul, o fundo é o que aguarda) e
    os números (convocados, entrevistados, faltaram, aptos, inaptos, sem
    parecer).
  - Agenda dos próximos dias: com um edital, os horários salvos na
    Classificação › Agenda, um dia por coluna; "Conduzir" leva à fila.
  - Empates: candidatos com a mesma nota da entrevista na mesma vaga; o
    desempate é feito na Classificação (botão com o edital já aberto).
*/

const n = (valor: number) => formatNumberBR(valor);

function BarraDoAndamento({
  numeros,
  rotulo,
}: {
  numeros: Numeros;
  rotulo: string;
}) {
  const total = numeros.convocados || 1;
  const parte = (valor: number) => `${(valor / total) * 100}%`;
  const b = numeros.barra;
  return (
    <span
      className="entrevistas-andamento-barra"
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentualFeito(numeros)}
    >
      <span data-parte="apto" style={{ width: parte(b.apto) }} />
      <span data-parte="inapto" style={{ width: parte(b.inapto) }} />
      <span data-parte="faltou" style={{ width: parte(b.faltou) }} />
      <span data-parte="andamento" style={{ width: parte(b.andamento) }} />
    </span>
  );
}

function NumerosDoAndamento({ numeros }: { numeros: Numeros }) {
  const itens: [string, string, number][] = [
    ["convocados", "convocados", numeros.convocados],
    ["entrevistados", "entrevistados", numeros.entrevistados],
    ["faltaram", "faltaram", numeros.faltaram],
    ["aptos", "aptos", numeros.aptos],
    ["inaptos", "inaptos", numeros.inaptos],
    ["sem-parecer", "sem parecer", numeros.semParecer],
  ];
  return (
    <dl className="entrevistas-andamento-numeros">
      {itens.map(([chave, rotulo, valor]) => (
        <div key={chave} data-numero={chave}>
          <dt>{rotulo}</dt>
          <dd>{n(valor)}</dd>
        </div>
      ))}
    </dl>
  );
}

function CartaoDoAndamento({
  chave,
  titulo,
  subtitulo,
  numeros,
  ativo,
  dica,
  aoClicar,
}: {
  chave: string;
  titulo: string;
  subtitulo: string;
  numeros: Numeros;
  ativo: boolean;
  dica: string;
  aoClicar: () => void;
}) {
  const feito = percentualFeito(numeros);
  return (
    <li>
      <button
        type="button"
        className="entrevistas-andamento-cartao"
        data-cartao={chave}
        data-completo={feito === 100 ? "sim" : undefined}
        aria-pressed={ativo}
        title={dica}
        onClick={aoClicar}
      >
        <span className="entrevistas-andamento-cabeca">
          <span className="entrevistas-andamento-titulo">
            <strong>{titulo}</strong>
            {subtitulo ? <span>{subtitulo}</span> : null}
          </span>
          <span className="entrevistas-andamento-percentual">{feito}%</span>
        </span>
        <BarraDoAndamento numeros={numeros} rotulo={`Andamento de ${titulo}`} />
        <NumerosDoAndamento numeros={numeros} />
      </button>
    </li>
  );
}

type PropriedadesDoAndamento = {
  entrevistas: EntrevistaDoPainel[];
  carregado: boolean;
  edital: string;
  vaga: string;
  aoEscolherEdital: (edital: string) => void;
  aoEscolherVaga: (vaga: string) => void;
};

/** O edital do recorte: o filtrado ou, havendo um só, ele. */
export function editalDoRecorte(
  editais: AndamentoDoEdital[],
  edital: string,
): AndamentoDoEdital | null {
  if (edital) return editais.find((e) => e.edital === edital) || null;
  return editais.length === 1 ? (editais[0] ?? null) : null;
}

export function AndamentoDasEntrevistas({
  entrevistas,
  carregado,
  edital,
  vaga,
  aoEscolherEdital,
  aoEscolherVaga,
}: PropriedadesDoAndamento) {
  const editais = useMemo(() => andamentoPorEdital(entrevistas), [entrevistas]);
  const escolhido = editalDoRecorte(editais, edital);
  if (!carregado)
    return (
      <section
        className="ui-card entrevistas-andamento"
        aria-busy="true"
        aria-label="Andamento"
      >
        <div className="ui-esqueleto-linha" />
        <div className="ui-esqueleto-linha" />
      </section>
    );
  if (!editais.length) return null;
  return (
    <section
      className="ui-card entrevistas-andamento"
      aria-labelledby="entrevistasAndamentoTitulo"
      data-tour="entrevistas-andamento"
    >
      <div className="entrevistas-andamento-topo">
        <h2 className="ui-titulo" id="entrevistasAndamentoTitulo">
          {escolhido ? `Edital ${escolhido.edital}` : "Andamento por edital"}
        </h2>
        {escolhido ? (
          <span className="entrevistas-andamento-resumo">
            {escolhido.unidade ? <span>{escolhido.unidade}</span> : null}
            <strong>{percentualFeito(escolhido.numeros)}% feito</strong>
            {edital ? (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => aoEscolherEdital("")}
              >
                Todos os editais
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      {escolhido ? (
        <div className="entrevistas-andamento-edital" data-edital-do-recorte>
          <BarraDoAndamento
            numeros={escolhido.numeros}
            rotulo={`Andamento do edital ${escolhido.edital}`}
          />
          <NumerosDoAndamento numeros={escolhido.numeros} />
        </div>
      ) : null}
      <ul className="entrevistas-andamento-cartoes">
        {escolhido
          ? escolhido.vagas.map((v) => (
              <CartaoDoAndamento
                key={v.vaga}
                chave={`vaga:${v.vaga}`}
                titulo={`Vaga ${v.vaga}`}
                subtitulo={v.cargo}
                numeros={v.numeros}
                ativo={vaga === v.vaga}
                dica={
                  vaga === v.vaga
                    ? "Mostrar todas as vagas"
                    : `Mostrar só a vaga ${v.vaga}`
                }
                aoClicar={() => aoEscolherVaga(vaga === v.vaga ? "" : v.vaga)}
              />
            ))
          : editais.map((e) => (
              <CartaoDoAndamento
                key={e.edital}
                chave={`edital:${e.edital}`}
                titulo={e.edital}
                subtitulo={e.unidade}
                numeros={e.numeros}
                ativo={false}
                dica={`Ver o andamento do edital ${e.edital} por vaga`}
                aoClicar={() => aoEscolherEdital(e.edital)}
              />
            ))}
      </ul>
    </section>
  );
}

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
      <div className="entrevistas-andamento-topo">
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
