import { formatNumberBR } from "../../lib/formatters.js";
import {
  contratacoesDoCadastroReserva,
  contratadasImediatas,
  vagasSemContratacao,
} from "../../lib/indicadores-do-monitoramento.js";
import {
  dataCurta,
  linkSeguro,
  statusCanonico,
  urgenciaDoCronograma,
} from "../../lib/visao-geral.js";
import { Gaveta, GradeDeKv, Kv, Secao } from "../../ui/index.js";

/*
  Os detalhes de um processo seletivo (clique na linha da tabela ou num item
  de "Atenção"): status e prazo do cronograma, provimento, o andamento do
  cronograma e as informações do edital. Ações: abrir o edital (link), a
  linha do tempo do cronograma (a do Núcleo, só leitura) e voltar à linha.
*/

const fmt = (valor) => formatNumberBR(valor);

export function GavetaDoProcesso({ linha, aoFechar, aoVoltarALinha }) {
  const urgencia = urgenciaDoCronograma(linha);
  const percentual = Math.max(
    0,
    Math.min(100, Number(linha.cronograma_percentual || 0)),
  );
  const link = linkSeguro(linha.link_edital);
  const linhaDoTempo = window.nucleoController?.estado?.abrirLinhaDoTempo;
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
      <div className="ui-gaveta-corpo">
        <div
          className="visao-geral-gaveta-situacao"
          data-urgencia={urgencia.tom}
        >
          <GradeDeKv rotulo="Situação">
            <Kv rotulo="Status">{statusCanonico(linha.status)}</Kv>
            <Kv rotulo="Fase">{linha.fase || "-"}</Kv>
            <Kv rotulo="Etapa atual">
              {linha.cronograma_atividade_atual || linha.etapa || "-"}
            </Kv>
            <Kv rotulo="Próxima atividade">
              {linha.cronograma_proxima_atividade || "-"}
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
            <Kv rotulo="Cadastro reserva">
              {fmt(contratacoesDoCadastroReserva(linha))}
            </Kv>
            <Kv rotulo="Sem contratação">{fmt(vagasSemContratacao(linha))}</Kv>
            <Kv rotulo="Inscritos">{fmt(linha.inscritos)}</Kv>
          </GradeDeKv>
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
            <strong>{percentual}% concluído</strong>
            <span>
              Próxima data: {dataCurta(linha.cronograma_proxima_data) || "-"}
            </span>
          </p>
          {linha.cronograma_automatico ? null : (
            <p className="visao-geral-gaveta-aviso">
              <i className="fa-solid fa-calendar-xmark" aria-hidden="true" />{" "}
              Cronograma ainda não cadastrado em Editais.
            </p>
          )}
        </Secao>

        <Secao icone="fa-circle-info" titulo="Informações" secao="informacoes">
          <GradeDeKv>
            <Kv rotulo="Período">
              {`${dataCurta(linha.data_inicio) || "-"} a ${dataCurta(linha.data_fim) || "-"}`}
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
