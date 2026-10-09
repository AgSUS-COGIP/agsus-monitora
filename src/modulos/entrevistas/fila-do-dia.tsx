import { useMemo } from "react";
import { nomeDoCargo } from "../../lib/conducao-de-entrevista.ts";
import {
  agruparPorVaga,
  buscarNaFila,
  iniciais,
  RECORTES,
  resumoDasSituacoes,
  rotuloDoDia,
  SITUACOES,
  type ItemDaFila,
  type Recorte,
  type Situacao,
} from "../../lib/fila-de-conducao.ts";
import { formatNumberBR } from "../../lib/formatters.js";
import { EstadoVazio, Segmentado, Selo } from "../../ui/index.js";
import { numeroBR } from "./resultado-da-ficha.tsx";

/*
  A fila de "Conduzir entrevistas" (fazer): os convocados do edital em
  cartões, agrupados por vaga (cabeçalho "código · cargo" com a contagem) —
  avatar com as iniciais do primeiro e do último nome, nome e código, o
  horário e a banca (quando há agenda), o selo da situação (aguardando, em
  andamento, concluída, faltou; as cores da Avaliação documental) e, só
  quando há o que mostrar, as notas lançadas ou a nota final. Clicar abre a
  ficha de notas em tela cheia; a ordem da tela é a do "Salvar e abrir o
  próximo".

  Acima, numa linha: Hoje / Próximos / Todos (com a contagem) e a busca por
  nome ou código; embaixo, o resumo das situações, que também filtra
  (clicar de novo tira). Fora de Hoje, o cartão mostra o dia ("Amanhã",
  "qua., 09/10"). No celular, os cartões ocupam a largura.
*/

function TempoDoCartao({ item, hoje }: { item: ItemDaFila; hoje: string }) {
  if (!item.inicio && !item.banca) return null;
  const dia =
    item.data && item.data !== hoje ? rotuloDoDia(item.data, hoje) : "";
  return (
    <span className="entrevistas-fila-hora">
      {item.inicio ? (
        <time dateTime={item.data ? `${item.data}T${item.inicio}` : undefined}>
          {item.inicio}
        </time>
      ) : null}
      <small>
        {[dia, item.banca ? `Banca ${item.banca}` : ""]
          .filter(Boolean)
          .join(" · ")}
      </small>
    </span>
  );
}

function NotasDoCartao({ item }: { item: ItemDaFila }) {
  const nota = item.convocado.nota;
  if (item.situacao === "concluida" && nota !== null && nota !== undefined)
    return (
      <span className="entrevistas-fila-nota" title="Nota da entrevista">
        {numeroBR(nota)} pts
      </span>
    );
  if (item.situacao !== "em_andamento" || !item.esperadas || !item.lancadas)
    return null;
  const percentual = Math.min(
    100,
    Math.round((item.lancadas / item.esperadas) * 100),
  );
  return (
    <span
      className="entrevistas-fila-notas"
      title={`${item.lancadas} de ${item.esperadas} notas lançadas`}
    >
      <span className="entrevistas-fila-notas-barra" aria-hidden="true">
        <span style={{ width: `${percentual}%` }} />
      </span>
      {item.lancadas} de {item.esperadas}
    </span>
  );
}

function CartaoDaFila({
  item,
  hoje,
  aoAbrir,
}: {
  item: ItemDaFila;
  hoje: string;
  aoAbrir: (id: string) => void;
}) {
  const s = SITUACOES[item.situacao];
  const detalhe = [
    item.convocado.codigo ? `Cód. ${item.convocado.codigo}` : "",
    item.convocado.modalidade || "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <button
        type="button"
        className="entrevistas-fila-cartao"
        data-situacao={item.situacao}
        data-convocado={item.id}
        aria-label={`Ficha de ${item.nome}${item.inicio ? `, ${item.inicio}` : ""}: ${s.rotulo}`}
        onClick={() => aoAbrir(item.id)}
      >
        <span className="entrevistas-avatar" aria-hidden="true">
          {iniciais(item.nome)}
        </span>
        <span className="entrevistas-fila-corpo">
          <strong>{item.nome}</strong>
          {detalhe ? <span>{detalhe}</span> : null}
        </span>
        <TempoDoCartao item={item} hoje={hoje} />
        <span className="entrevistas-fila-situacao">
          <Selo tom={s.tom}>{s.rotulo}</Selo>
          <NotasDoCartao item={item} />
        </span>
      </button>
    </li>
  );
}

const ORDEM_DAS_SITUACOES: Situacao[] = [
  "aguardando",
  "em_andamento",
  "concluida",
  "faltou",
];

export type PropriedadesDaFila = {
  itens: ItemDaFila[];
  hoje: string;
  recorte: Recorte;
  contagem: Record<Recorte, number>;
  aoMudarRecorte: (recorte: Recorte) => void;
  busca: string;
  aoMudarBusca: (busca: string) => void;
  situacao: Situacao | "";
  aoMudarSituacao: (situacao: Situacao | "") => void;
  aoAbrir: (id: string) => void;
};

function textoDoVazio(recorte: Recorte) {
  if (recorte === "hoje") return "Nenhuma entrevista hoje.";
  if (recorte === "proximos")
    return "Nenhuma entrevista agendada nos próximos dias.";
  return "Nenhum candidato convocado ainda.";
}

export function FilaDoDia({
  itens,
  hoje,
  recorte,
  contagem,
  aoMudarRecorte,
  busca,
  aoMudarBusca,
  situacao,
  aoMudarSituacao,
  aoAbrir,
}: PropriedadesDaFila) {
  const buscados = useMemo(() => buscarNaFila(itens, busca), [itens, busca]);
  const resumo = useMemo(() => resumoDasSituacoes(buscados), [buscados]);
  const visiveis = useMemo(
    () =>
      situacao ? buscados.filter((i) => i.situacao === situacao) : buscados,
    [buscados, situacao],
  );
  const grupos = useMemo(() => agruparPorVaga(visiveis), [visiveis]);
  return (
    <section
      className="ui-card entrevistas-fila"
      aria-labelledby="entrevistasFilaTitulo"
      data-tour="conduzir-fila"
    >
      <h2 className="sr-only" id="entrevistasFilaTitulo">
        Fila das entrevistas
      </h2>
      <div className="entrevistas-fila-controles">
        <Segmentado
          rotulo="Quais entrevistas"
          className="entrevistas-fila-recortes"
          tour="conduzir-recortes"
          opcoes={RECORTES.map((r) => ({
            valor: r.valor,
            rotulo: `${r.rotulo} (${formatNumberBR(contagem[r.valor])})`,
          }))}
          valor={recorte}
          aoMudar={(valor: string) => aoMudarRecorte(valor as Recorte)}
        />
        {itens.length ? (
          <label className="entrevistas-fila-busca" data-tour="conduzir-busca">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <span className="sr-only">Buscar por nome ou código</span>
            <input
              type="search"
              data-campo="fila-busca"
              placeholder="Buscar por nome ou código"
              value={busca}
              onChange={(ev) => aoMudarBusca(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Escape" && busca) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  aoMudarBusca("");
                }
              }}
            />
          </label>
        ) : null}
      </div>
      {buscados.length ? (
        <ul
          className="entrevistas-fila-resumo"
          aria-label="Filtrar por situação"
          data-tour="conduzir-situacoes"
        >
          {ORDEM_DAS_SITUACOES.map((s) => (
            <li key={s}>
              <button
                type="button"
                data-situacao={s}
                aria-pressed={situacao === s}
                disabled={!resumo[s] && situacao !== s}
                onClick={() => aoMudarSituacao(situacao === s ? "" : s)}
              >
                <strong>{formatNumberBR(resumo[s])}</strong>{" "}
                {SITUACOES[s].rotulo}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {visiveis.length ? (
        grupos.map((g) => {
          const cargo = nomeDoCargo(g.cargo);
          return (
            <div
              key={g.vaga || "sem-vaga"}
              className="entrevistas-fila-grupo"
              data-vaga={g.vaga}
            >
              <h3 className="entrevistas-fila-vaga">
                <span>
                  {g.vaga ? (
                    <>
                      <span className="entrevistas-fila-vaga-codigo">
                        {g.vaga}
                      </span>
                      {cargo ? ` · ${cargo}` : ""}
                    </>
                  ) : (
                    "Sem vaga"
                  )}
                </span>
                <span className="entrevistas-fila-vaga-contagem">
                  {formatNumberBR(g.itens.length)}
                </span>
              </h3>
              <ul className="entrevistas-fila-lista">
                {g.itens.map((item) => (
                  <CartaoDaFila
                    key={item.id}
                    item={item}
                    hoje={hoje}
                    aoAbrir={aoAbrir}
                  />
                ))}
              </ul>
            </div>
          );
        })
      ) : busca.trim() && itens.length ? (
        <EstadoVazio>
          Ninguém encontrado para “{busca.trim()}”.{" "}
          <button
            type="button"
            className="btn ghost small"
            onClick={() => aoMudarBusca("")}
          >
            Limpar busca
          </button>
        </EstadoVazio>
      ) : situacao && itens.length ? (
        <EstadoVazio>
          Nenhum candidato nesta situação.{" "}
          <button
            type="button"
            className="btn ghost small"
            onClick={() => aoMudarSituacao("")}
          >
            Ver todos
          </button>
        </EstadoVazio>
      ) : (
        <EstadoVazio>{textoDoVazio(recorte)}</EstadoVazio>
      )}
    </section>
  );
}
