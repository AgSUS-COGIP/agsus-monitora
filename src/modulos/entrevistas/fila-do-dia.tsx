import { useMemo } from "react";
import { nomeDoCargo } from "../../lib/conducao-de-entrevista.js";
import {
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
import { Campo, EstadoVazio, Segmentado, Selo } from "../../ui/index.js";

/*
  A fila de "Conduzir entrevistas" (fazer): os convocados do edital em
  cartões — avatar com as iniciais, nome, vaga e cargo, horário e banca, o
  selo da situação (aguardando, em andamento,
  concluída, faltou; as cores da Avaliação documental) e as notas lançadas.
  Clicar abre a ficha de notas em tela cheia; a lista visível é a do
  "Salvar e abrir o próximo".

  Acima: Hoje / Próximos / Todos (com a contagem), a vaga e o resumo das
  situações, que também filtra (clicar de novo tira). Fora de Hoje, um
  cabeçalho por dia. No celular, os cartões ocupam a largura.
*/

type Grupo = { chave: string; titulo: string; itens: ItemDaFila[] };

function agruparPorDia(itens: ItemDaFila[], hoje: string): Grupo[] {
  const grupos: Grupo[] = [];
  for (const item of itens) {
    const chave = item.data || "sem-horario";
    let grupo = grupos.find((g) => g.chave === chave);
    if (!grupo) {
      grupo = { chave, titulo: rotuloDoDia(item.data, hoje), itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push(item);
  }
  return grupos;
}

function CartaoDaFila({
  item,
  aoAbrir,
}: {
  item: ItemDaFila;
  aoAbrir: (id: string) => void;
}) {
  const s = SITUACOES[item.situacao];
  const cargo = nomeDoCargo(item.convocado.cargo);
  const percentual = item.esperadas
    ? Math.min(100, Math.round((item.lancadas / item.esperadas) * 100))
    : 0;
  return (
    <li>
      <button
        type="button"
        className="entrevistas-fila-cartao"
        data-situacao={item.situacao}
        data-convocado={item.id}
        aria-label={`Ficha de ${item.nome}: ${s.rotulo}`}
        onClick={() => aoAbrir(item.id)}
      >
        <span className="entrevistas-avatar" aria-hidden="true">
          {iniciais(item.nome)}
        </span>
        <span className="entrevistas-fila-corpo">
          <strong>{item.nome}</strong>
          <span>
            {[item.vaga && `Vaga ${item.vaga}`, cargo]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="entrevistas-fila-hora">
          <time>{item.inicio || "—"}</time>
          <small>{item.banca ? `Banca ${item.banca}` : ""}</small>
        </span>
        <span className="entrevistas-fila-situacao">
          <Selo tom={s.tom}>{s.rotulo}</Selo>
          {item.esperadas ? (
            <span
              className="entrevistas-fila-notas"
              title={`${item.lancadas} de ${item.esperadas} notas lançadas`}
            >
              <span className="entrevistas-fila-notas-barra">
                <span style={{ width: `${percentual}%` }} />
              </span>
              {item.lancadas}/{item.esperadas}
            </span>
          ) : null}
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

export function FilaDoDia({
  itens,
  hoje,
  recorte,
  contagem,
  aoMudarRecorte,
  vagas,
  vaga,
  aoMudarVaga,
  situacao,
  aoMudarSituacao,
  aoAbrir,
}: {
  itens: ItemDaFila[];
  hoje: string;
  recorte: Recorte;
  contagem: Record<Recorte, number>;
  aoMudarRecorte: (recorte: Recorte) => void;
  vagas: string[];
  vaga: string;
  aoMudarVaga: (vaga: string) => void;
  situacao: Situacao | "";
  aoMudarSituacao: (situacao: Situacao | "") => void;
  aoAbrir: (id: string) => void;
}) {
  const resumo = useMemo(() => resumoDasSituacoes(itens), [itens]);
  const visiveis = situacao
    ? itens.filter((i) => i.situacao === situacao)
    : itens;
  const grupos =
    recorte === "hoje"
      ? [{ chave: hoje, titulo: "", itens: visiveis }]
      : agruparPorDia(visiveis, hoje);
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
        {vagas.length > 1 ? (
          <Campo rotulo="Vaga">
            <select
              data-campo="fila-vaga"
              value={vaga}
              onChange={(ev) => aoMudarVaga(ev.target.value)}
            >
              <option value="">Todas as vagas</option>
              {vagas.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
      </div>
      {itens.length ? (
        <ul
          className="entrevistas-fila-resumo"
          aria-label="Situações"
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
        grupos.map((g) => (
          <div key={g.chave} className="entrevistas-fila-grupo">
            {g.titulo ? (
              <h3 className="entrevistas-fila-dia">
                {g.titulo}
                <span>{formatNumberBR(g.itens.length)}</span>
              </h3>
            ) : null}
            <ul className="entrevistas-fila-lista">
              {g.itens.map((item) => (
                <CartaoDaFila key={item.id} item={item} aoAbrir={aoAbrir} />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <EstadoVazio>
          {recorte === "hoje"
            ? "Nenhuma entrevista hoje."
            : recorte === "proximos"
              ? "Nenhuma entrevista agendada nos próximos dias."
              : "Nenhum candidato convocado ainda."}
        </EstadoVazio>
      )}
    </section>
  );
}
