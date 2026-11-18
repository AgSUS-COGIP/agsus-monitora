import { hojeEmBrasilia } from "../../lib/cronograma/cronograma-do-edital.ts";
import { telaPronta } from "../../app/registro-das-telas.ts";
import type { LinhaDaVisaoGeral } from "./tipos.ts";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  contratacoesAlemDasVagas,
  contratadasImediatas,
  temNumero,
  vagasSemContratacao,
} from "../../lib/visao-geral/indicadores-do-monitoramento.ts";
import type { ClienteDosAvisos } from "../conferencias/tipos.ts";
import { lazy, Suspense, useEffect, useRef } from "react";
import { importarComRecarga } from "../../lib/carga/importar-com-recarga.ts";
import {
  numeroDoFunil,
  textoDaFonteDoFunil,
} from "../../lib/editais/funil-do-edital.ts";
import {
  dataCurta,
  descricaoDoCronograma,
  linkSeguro,
  statusCanonico,
  urgenciaDoCronograma,
} from "../../lib/visao-geral/visao-geral.ts";
import { Gaveta, GradeDeKv, Kv, Secao } from "../../ui/index.ts";

/*
  Os detalhes de um processo seletivo (clique na linha da tabela ou num item
  de "Atenção"): status e prazo do cronograma, provimento, o resultado (lista
  vigente e admissões conciliadas com o RH), os avisos de conferência abertos
  do edital (sob demanda), o andamento do cronograma e as informações do
  edital. Ações: abrir o edital (link), a
  linha do tempo do cronograma (a do Núcleo, só leitura) e voltar à linha.
*/

const fmt = (valor: unknown) => formatNumberBR(valor);
const numeroOuTraco = (valor: unknown) => (temNumero(valor) ? fmt(valor) : "—");
// Os avisos (e a central que os desenha) chegam só quando a gaveta abre.
const AvisosDoEdital = lazy(
  importarComRecarga(() => import("./avisos-do-edital.tsx")),
);

export function GavetaDoProcesso({
  linha,
  aoFechar,
  aoVoltarALinha,
  area = "",
  supabase = null,
  aoAbrirCentral = null,
  secaoInicial = "",
}: {
  linha: LinhaDaVisaoGeral;
  aoFechar: () => void;
  aoVoltarALinha: () => void;
  /** A área da página: os avisos são lidos dela e recortados pelo edital. */
  area?: string;
  supabase?: ClienteDosAvisos | null;
  /** Leva à central de avisos (Status das atualizações); null sem acesso. */
  aoAbrirCentral?: (() => void) | null;
  /** A seção que abre à vista: "avisos" quando veio do selo de Atenção. */
  secaoInicial?: string;
}) {
  const corpo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!secaoInicial) return;
    corpo.current
      ?.querySelector(`[data-section="${secaoInicial}"]`)
      ?.scrollIntoView?.({ block: "start" });
  }, [secaoInicial, linha.id]);
  // O dia de Brasília, como a tabela (não o relógio do computador).
  const urgencia = urgenciaDoCronograma(linha, hojeEmBrasilia(new Date()));
  const percentual = Math.max(
    0,
    Math.min(100, Number(linha.cronograma_percentual || 0)),
  );
  // Há etapas · cálculo automático ou manual · suspenso/paralisado/cancelado.
  const cronograma = descricaoDoCronograma(linha);
  const link = linkSeguro(linha.link_edital);
  // A lista vigente (do acompanhamento): sem ela, Aprovados e afins são "—".
  const comLista = temNumero(linha.aprovados);
  const conciliadas = Number(linha.admissoes) || 0;
  // A linha do tempo é de Editais (a tela fica montada: src/app/telas.tsx).
  const linhaDoTempo = telaPronta("nucleo")?.estado.abrirLinhaDoTempo;
  return (
    <Gaveta
      id="visaoGeralGaveta"
      tituloId="visaoGeralGavetaTitulo"
      aoFechar={aoFechar}
      className="visao-geral-gaveta"
      sobretitulo="Detalhes do processo"
      titulo={linha.edital || "Processo seletivo"}
      resumo={linha.unidade || null}
      rotuloDoFechar="Fechar detalhes"
    >
      <div className="ui-gaveta-corpo" ref={corpo}>
        <div
          className="visao-geral-gaveta-situacao"
          data-urgencia={urgencia.tom}
        >
          <GradeDeKv rotulo="Situação">
            <Kv rotulo="Status">{statusCanonico(linha.status)}</Kv>
            <Kv rotulo="Fase">{linha.fase || "—"}</Kv>
            <Kv rotulo="Etapa atual">
              {linha.cronograma_atividade_atual || linha.etapa || "—"}
            </Kv>
            <Kv rotulo="Próxima atividade">
              {linha.cronograma_proxima_atividade || "—"}
            </Kv>
            <Kv rotulo="Prazo">{urgencia.rotulo}</Kv>
            {linha.atencao?.length ? (
              <Kv rotulo="Atenção">
                {linha.atencao.map((m) => m.rotulo).join(" · ")}
              </Kv>
            ) : null}
          </GradeDeKv>
        </div>

        <Secao icone="fa-briefcase" titulo="Provimento" secao="provimento">
          <GradeDeKv>
            <Kv rotulo="Vagas">{fmt(linha.vagas_total)}</Kv>
            <Kv rotulo="Contratadas">{fmt(contratadasImediatas(linha))}</Kv>
            <Kv rotulo="Além das vagas imediatas">
              {fmt(contratacoesAlemDasVagas(linha))}
            </Kv>
            <Kv rotulo="Sem contratação">{fmt(vagasSemContratacao(linha))}</Kv>
            <Kv rotulo="Inscritos">{numeroDoFunil(linha.inscritos)}</Kv>
          </GradeDeKv>
          {textoDaFonteDoFunil(linha) ? (
            <p className="visao-geral-progresso-texto">
              <span>{textoDaFonteDoFunil(linha)}</span>
            </p>
          ) : null}
          {(linha.textos_da_reabertura || []).map((texto) => (
            <p key={texto} className="visao-geral-progresso-texto">
              <span>{texto}</span>
            </p>
          ))}
        </Secao>

        <Secao icone="fa-trophy" titulo="Resultado" secao="resultado">
          <GradeDeKv>
            <Kv rotulo="Aprovados">{numeroOuTraco(linha.aprovados)}</Kv>
            <Kv rotulo="Aguardando chamada">
              {numeroOuTraco(linha.cadastro_reserva)}
            </Kv>
            <Kv rotulo="Desistentes">
              {comLista ? fmt(linha.desistentes) : "—"}
            </Kv>
            <Kv rotulo="1ª admissão (RH)">
              {dataCurta(linha.primeira_admissao) || "—"}
            </Kv>
            <Kv rotulo="Última admissão (RH)">
              {dataCurta(linha.ultima_admissao) || "—"}
            </Kv>
            <Kv rotulo="Admissões conciliadas">
              {conciliadas ? fmt(conciliadas) : "—"}
            </Kv>
          </GradeDeKv>
          {!comLista ? (
            <p className="visao-geral-progresso-texto">
              <span>Sem lista de aprovados vigente.</span>
            </p>
          ) : null}
        </Secao>

        <Secao
          icone="fa-triangle-exclamation"
          titulo="Avisos de conferência"
          secao="avisos"
        >
          <Suspense
            fallback={
              <div
                className="ui-esqueleto ui-esqueleto-linha"
                aria-hidden="true"
              />
            }
          >
            <AvisosDoEdital
              editalId={String(linha.id)}
              area={area}
              supabase={supabase}
              aoAbrirCentral={aoAbrirCentral}
            />
          </Suspense>
        </Secao>

        <Secao icone="fa-route" titulo="Cronograma" secao="cronograma">
          <div
            className="visao-geral-progresso"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentual}
            aria-label="Cronograma concluído"
          >
            <i style={{ width: `${percentual}%` }} />
          </div>
          <p className="visao-geral-progresso-texto">
            <strong>{percentual}% do cronograma</strong>
            <span>
              Próxima data: {dataCurta(linha.cronograma_proxima_data) || "—"}
            </span>
          </p>
          {cronograma ? (
            <p className="visao-geral-gaveta-aviso">{cronograma}</p>
          ) : (
            <p className="visao-geral-gaveta-aviso">
              <i className="fa-solid fa-calendar-xmark" aria-hidden="true" />{" "}
              Cronograma ainda não cadastrado em Editais.
            </p>
          )}
        </Secao>

        <Secao icone="fa-circle-info" titulo="Informações" secao="informacoes">
          <GradeDeKv>
            <Kv rotulo="Período">
              {`${dataCurta(linha.data_inicio) || "—"} a ${dataCurta(linha.data_fim) || "—"}`}
            </Kv>
            <Kv rotulo="Responsável">{linha.responsavel || "Não informado"}</Kv>
            <Kv rotulo="Risco">{linha.risco || "Não informado"}</Kv>
            <Kv rotulo="Observações">
              {linha.observacoes || "Sem observações"}
            </Kv>
          </GradeDeKv>
        </Secao>
      </div>
      <div className="ui-gaveta-rodape ui-acoes">
        {link ? (
          <a
            className="btn secondary small"
            href={link}
            target="_blank"
            rel="noopener"
          >
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            />{" "}
            Abrir edital
          </a>
        ) : null}
        {typeof linhaDoTempo === "function" ? (
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              aoFechar();
              linhaDoTempo(linha.id);
            }}
          >
            <i className="fa-solid fa-timeline" aria-hidden="true" /> Linha do
            tempo
          </button>
        ) : null}
        <button
          type="button"
          className="btn secondary small"
          onClick={aoVoltarALinha}
        >
          <i className="fa-solid fa-table-list" aria-hidden="true" /> Voltar à
          linha
        </button>
      </div>
    </Gaveta>
  );
}
