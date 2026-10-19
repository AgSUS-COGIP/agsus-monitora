import { useMemo } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  agoraEmBrasilia,
  ritmosDaArea,
  ROTULO_DA_SITUACAO,
  textoDoPrazo,
  textoDoRitmo,
  type EditalDoRitmo,
  type RitmoDoEdital,
  type SituacaoDoRitmo,
} from "../../lib/ritmo-da-analise.ts";
import { GradeDeKpis, Kpi, Selo } from "../../ui/index.js";

/*
  Card "Ritmo da análise": um por edital com fichas no sistema (regras em
  src/lib/ritmo-da-analise.ts). Prazo da etapa do cronograma, quanto falta,
  quantas por dia e por avaliador até lá, e o ritmo atual com a projeção.
  Sem dados (RPC ainda não publicada, falha, área sem fichas): não aparece.
*/

const TOM_DO_SELO: Record<SituacaoDoRitmo, string> = {
  concluido: "aprovado",
  "no-ritmo": "aprovado",
  abaixo: "pendente",
  vencido: "reprovado",
  "sem-prazo": "neutro",
  "sem-historico": "neutro",
};

const numero = (n: number | null) => (n === null ? "—" : formatNumberBR(n));

function CardDoEdital({ r }: { r: RitmoDoEdital }) {
  const selo = ROTULO_DA_SITUACAO[r.situacao];
  const avaliadores = `${r.avaliadores} ${r.avaliadores === 1 ? "avaliador" : "avaliadores"}`;
  return (
    <section
      className="ui-card ui-pilha"
      aria-label={`Ritmo da análise · ${r.edital}`}
      data-ritmo={r.id}
    >
      <div className="ui-secao-topo">
        <h2 className="ui-titulo">Ritmo da análise · {r.edital}</h2>
        {selo ? <Selo tom={TOM_DO_SELO[r.situacao]}>{selo}</Selo> : null}
      </div>
      <span className="ui-texto-secundario" title={r.etapa?.atividade}>
        {textoDoPrazo(r)}
      </span>
      <GradeDeKpis rotulo={`Ritmo da análise do ${r.edital}`}>
        <Kpi
          tom="sucesso"
          icone="fa-circle-check"
          rotulo="Concluído"
          valor={`${r.percentual}%`}
          titulo={`${formatNumberBR(r.concluidas)} fichas concluídas`}
        />
        <Kpi
          tom="alerta"
          icone="fa-hourglass-half"
          rotulo="Faltam"
          valor={numero(r.faltam)}
          titulo="Pendentes, em análise e a revisar (fora do lote não conta)"
        />
        <Kpi
          tom="info"
          icone="fa-calendar-day"
          rotulo={`Por dia até o prazo${r.porDia !== null ? ` (${r.diasRestantes} ${r.diasRestantes === 1 ? "dia útil" : "dias úteis"})` : ""}`}
          valor={numero(r.porDia)}
        />
        <Kpi
          tom="destaque"
          icone="fa-user-check"
          rotulo={`Por avaliador/dia (${avaliadores})`}
          valor={
            r.porAvaliador === null ? "—" : `≈${formatNumberBR(r.porAvaliador)}`
          }
          titulo={
            r.avaliadoresDaEquipe
              ? "Analistas ativos na equipe do edital"
              : "Quem concluiu fichas nos últimos 7 dias"
          }
        />
        <Kpi
          tom="neutro"
          icone="fa-gauge-high"
          rotulo="Ritmo atual (por dia)"
          valor={r.ritmo === null ? "—" : `≈${formatNumberBR(r.ritmo)}`}
          titulo={
            r.diasDoRitmo
              ? `Média dos últimos ${r.diasDoRitmo} ${r.diasDoRitmo === 1 ? "dia" : "dias"} com análise · hoje: ${formatNumberBR(r.concluidasHoje)}`
              : undefined
          }
        />
      </GradeDeKpis>
      <span className="ui-texto-secundario">{textoDoRitmo(r)}</span>
    </section>
  );
}

export function RitmoDaAnalise({
  editais,
}: {
  editais: readonly EditalDoRitmo[] | null;
}) {
  const ritmos = useMemo(
    () => (editais ? ritmosDaArea(editais, agoraEmBrasilia()) : []),
    [editais],
  );
  if (!ritmos.length) return null;
  return (
    <>
      {ritmos.map((r) => (
        <CardDoEdital key={r.id} r={r} />
      ))}
    </>
  );
}
