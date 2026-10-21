import { useEffect, useMemo, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  agoraEmBrasilia,
  gravarRitmoRecolhido,
  MEDALHAS,
  MINIMO_DO_SELO,
  ROTULO_DA_MEDALHA,
  SELO_DE_PRECISAO,
  lerRitmoRecolhido,
  noMomentoDoResumo,
  ritmosDaArea,
  seloDoCard,
  textoDeReferencia,
  textoDoDia,
  textoDoMomento,
  textoDoPrazo,
  textoRecolhido,
  type EditalDoRitmo,
  type RitmoDoEdital,
  type SituacaoDoDia,
} from "../../lib/ritmo-da-analise.ts";
import { GradeDeKpis, Kpi, Selo } from "../../ui/index.js";
import { comemorarMetaDoDia } from "./marcos.ts";

/*
  Card "Ritmo da análise": um por edital com fichas no sistema (regras em
  src/lib/ritmo-da-analise.ts). Em destaque, o bloco "Hoje" — meta do dia,
  feito e quanto falta, com o selo que oscila ao longo do expediente
  (08:00–18:00) —; depois o edital (concluído e faltam) e, menores, a média
  dos últimos dias e a previsão de término.
  Sem dados (RPC ainda não publicada, falha, área sem fichas): não aparece.

  As contagens são as do resumo do Painel (as linhas que a tela já tem), no
  momento do "Conferido às" do topo — o subtítulo diz qual e de que edital,
  porque os KPIs do topo somam todos os editais da área. O "esperado até
  agora" anda com o relógio: a tela recalcula a cada 5 minutos, sem consulta.
  O botão recolhe o card numa linha (título, selo do dia e "hoje X de Y"); a
  escolha fica no navegador, por pessoa.
  Abaixo do "Hoje", "Destaques de hoje": só medalhistas (🥇🥈🥉, empate leva
  a mesma) e quem tem o selo Precisão (🎯); zera todo dia. Bateu a meta do
  dia, a comemoração da equipe sai uma vez por dia por pessoa (marcos.ts).
*/

const TOM_DO_SELO: Record<SituacaoDoDia | "concluido", string> = {
  concluido: "aprovado",
  batida: "aprovado",
  "no-ritmo": "aprovado",
  abaixo: "pendente",
  "nao-util": "neutro",
  "sem-meta": "neutro",
};

const RECALCULO_MS = 5 * 60 * 1000;
const DESLIGADAS = () => false;

/* Quem está na tela (o recolhido é por pessoa). */
function usuarioDaSessao() {
  const perfil = globalThis.window?.getMonitoraProfile?.();
  return String(perfil?.user_id || perfil?.id || "") || null;
}

const numero = (n: number | null) => (n === null ? "—" : formatNumberBR(n));

function BlocoDeHoje({ r }: { r: RitmoDoEdital }) {
  const d = r.dia;
  const comMeta = d.situacao !== "nao-util" && d.situacao !== "sem-meta";
  return (
    <div className="ui-pilha" data-hoje>
      <h3 className="ui-titulo">Hoje</h3>
      {comMeta ? (
        <GradeDeKpis rotulo={`Hoje no ${r.edital}`}>
          <Kpi
            tom="info"
            icone="fa-bullseye"
            rotulo="Meta de hoje"
            valor={numero(d.meta)}
            titulo="O que faltava às 00:00 dividido pelos dias úteis até o prazo, contando hoje"
          />
          <Kpi
            tom="sucesso"
            icone="fa-circle-check"
            rotulo="Feito hoje"
            valor={numero(d.feito)}
            titulo="Concluídas desde 00:00 (Brasília), no momento do resumo"
          />
          <Kpi
            tom="alerta"
            icone="fa-hourglass-half"
            rotulo="Faltam hoje"
            valor={numero(d.faltam)}
          />
        </GradeDeKpis>
      ) : null}
      <span className="ui-texto-secundario" data-texto-do-dia>
        {textoDoDia(r)}
      </span>
    </div>
  );
}

function DestaquesDeHoje({ r }: { r: RitmoDoEdital }) {
  const { medalhas, precisao } = r.destaques;
  if (!medalhas.length && !precisao.length) return null;
  return (
    <div className="ui-pilha" data-destaques>
      <h3 className="ui-titulo">Destaques de hoje</h3>
      <div className="ui-chips">
        {medalhas.map((m, i) => (
          <Selo
            key={`m-${i}-${m.nome}`}
            tom="neutro"
            titulo={`${ROTULO_DA_MEDALHA[m.posicao - 1]}: ${formatNumberBR(m.qt)} fichas concluídas hoje`}
          >
            <span data-medalha={m.posicao}>
              {MEDALHAS[m.posicao - 1]} {m.nome} · {formatNumberBR(m.qt)}
            </span>
          </Selo>
        ))}
        {precisao.map((nome, i) => (
          <Selo
            key={`p-${i}-${nome}`}
            tom="aprovado"
            titulo={`Precisão: ${MINIMO_DO_SELO} ou mais fichas hoje, nenhuma reaberta`}
          >
            <span data-precisao>
              {SELO_DE_PRECISAO} {nome}
            </span>
          </Selo>
        ))}
      </div>
    </div>
  );
}

function CardDoEdital({
  r,
  momento,
  recolhido,
  aoAlternar,
}: {
  r: RitmoDoEdital;
  momento: string;
  recolhido: boolean;
  aoAlternar: () => void;
}) {
  const selo = seloDoCard(r);
  const idDoCorpo = `ritmo-${r.id}-corpo`;
  return (
    <section
      className="ui-card ui-pilha"
      aria-label={`Ritmo da análise · ${r.edital}`}
      data-ritmo={r.id}
      data-recolhido={recolhido ? "" : undefined}
    >
      <div className="ui-secao-topo">
        <h2 className="ui-titulo">Ritmo da análise · {r.edital}</h2>
        {selo.rotulo ? (
          <Selo tom={TOM_DO_SELO[selo.situacao]}>{selo.rotulo}</Selo>
        ) : null}
        {recolhido ? (
          <span className="ui-texto-secundario" title={momento} data-resumo>
            {textoRecolhido(r)}
          </span>
        ) : null}
        <button
          type="button"
          className="btn ghost small"
          data-acao="recolher-ritmo"
          aria-expanded={!recolhido}
          aria-controls={idDoCorpo}
          aria-label={
            recolhido
              ? "Abrir o ritmo da análise"
              : "Recolher o ritmo da análise"
          }
          onClick={aoAlternar}
        >
          <i
            className={`fa-solid ${recolhido ? "fa-chevron-down" : "fa-chevron-up"}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {recolhido ? null : (
        <div className="ui-pilha" id={idDoCorpo}>
          <span className="ui-texto-secundario" data-momento>
            {momento}
          </span>
          <span className="ui-texto-secundario" title={r.etapa?.atividade}>
            {textoDoPrazo(r)}
          </span>
          <BlocoDeHoje r={r} />
          <DestaquesDeHoje r={r} />
          <GradeDeKpis rotulo={`Edital ${r.edital}`}>
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
          </GradeDeKpis>
          <span className="ui-texto-secundario" data-referencia>
            {textoDeReferencia(r)}
          </span>
        </div>
      )}
    </section>
  );
}

export function RitmoDaAnalise({
  editais,
  linhas,
  conferidoEm,
  usuario = usuarioDaSessao(),
  ligadas = DESLIGADAS,
}: {
  editais: readonly EditalDoRitmo[] | null;
  /** As linhas do resumo do Painel que a tela recebeu (todas, sem filtro). */
  linhas: readonly Record<string, unknown>[] | null;
  /** O "Conferido às" do topo: o momento do resumo. */
  conferidoEm?: string | null;
  usuario?: string | null;
  /** O liga/desliga das comemorações do sistema (situação do sistema). */
  ligadas?: () => boolean;
}) {
  const [recolhido, setRecolhido] = useState(() => lerRitmoRecolhido(usuario));
  // O esperado do dia anda com o relógio: recalcula sem consultar o banco.
  const [relogio, setRelogio] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setRelogio(Date.now()), RECALCULO_MS);
    return () => clearInterval(id);
  }, []);
  const { ritmos, hoje } = useMemo(() => {
    const agora = agoraEmBrasilia(new Date(relogio));
    if (!editais) return { ritmos: [], hoje: agora.hoje };
    return {
      ritmos: ritmosDaArea(
        noMomentoDoResumo(editais, linhas, agora.hoje),
        agora,
      ),
      hoje: agora.hoje,
    };
  }, [editais, linhas, relogio]);
  // Meta de hoje batida pela equipe: comemora uma vez por dia (marcos.ts).
  useEffect(() => {
    if (ritmos.length)
      comemorarMetaDoDia({ ritmos, hoje, usuario, ligadas: ligadas() });
  }, [ritmos, hoje, usuario, ligadas]);
  if (!ritmos.length) return null;
  const alternar = () => {
    gravarRitmoRecolhido(usuario, !recolhido);
    setRecolhido(!recolhido);
  };
  return (
    <>
      {ritmos.map((r) => (
        <CardDoEdital
          key={r.id}
          r={r}
          momento={textoDoMomento(r.edital, conferidoEm)}
          recolhido={recolhido}
          aoAlternar={alternar}
        />
      ))}
    </>
  );
}
