import { useSyncExternalStore } from "react";
import { canChangeCandidateStatus } from "../../lib/access-roles.js";
import {
  canEditCandidateStatus,
  formatarData,
  formatarNota,
  modalidadeSemAspas,
} from "../../lib/lista-aprovados-rules.js";
import { formatarDataHora } from "../../lib/cronograma-do-edital.js";
import {
  BlocosEsqueleto,
  Gaveta,
  GradeDeKv,
  Kv,
  Secao,
} from "../../ui/index.js";
import { SeloDeStatus } from "./partes.jsx";

/*
  A gaveta do candidato (clique no nome, nas duas abas): os dados da lista, o
  status com a data da convocação e o histórico das cartas de convocação
  emitidas para ele — também nas listas anteriores do edital
  (listar_cartas_do_candidato). Quem edita altera o status e emite a carta
  daqui.
*/

const SAIDAS = { SEI: "Copiada para o SEI", DOCX: "DOCX", PDF: "PDF" };

function Carta({ carta }) {
  const outros = Number(carta.candidatos) - 1;
  return (
    <li className="aprovados-carta-emitida">
      <div>
        <strong>
          {carta.modelo} <small>v{carta.versao}</small>
        </strong>
        <small>
          {formatarDataHora(carta.emitida_em)}
          {carta.usuario ? ` · ${carta.usuario}` : ""}
          {` · ${SAIDAS[carta.saida] || carta.saida}`}
          {outros > 0
            ? ` · com mais ${outros} candidato${outros === 1 ? "" : "s"}`
            : ""}
        </small>
      </div>
      <small>
        {carta.data_limite
          ? `Prazo até ${formatarData(carta.data_limite)}`
          : "Sem data limite"}
        {carta.convocacao_marcada
          ? ` · marcado Convocado em ${formatarData(carta.convocacao_marcada)}`
          : ""}
      </small>
    </li>
  );
}

export function GavetaDoCandidato({ estado, perfil, candidato, convocacao }) {
  const { historicos } = useSyncExternalStore(
    estado.carta.assinar,
    estado.carta.obter,
  );
  const historico = historicos.get(String(candidato.candidato_id));
  const fechar = estado.fecharModal;
  const dataConvocacao = convocacao?.data || historico?.dataConvocacao || "";
  const podeStatus = canEditCandidateStatus(perfil, candidato);
  const podeCarta =
    Boolean(candidato.lista_ativa) && canChangeCandidateStatus(perfil);

  return (
    <Gaveta
      id="approvedCandidatoGaveta"
      tituloId="approvedCandidatoTitulo"
      aoFechar={fechar}
      sobretitulo={[candidato.edital, candidato.unidade]
        .filter(Boolean)
        .join(" · ")}
      titulo={candidato.nome}
      resumo={
        <SeloDeStatus
          status={String(candidato.status || "")}
          dataConvocacao={dataConvocacao}
        />
      }
      rotuloDoFechar={`Fechar os dados de ${candidato.nome}`}
    >
      <div className="ui-gaveta-corpo aprovados-gaveta-corpo">
        {podeStatus || podeCarta ? (
          <div className="ui-acoes aprovados-gaveta-acoes">
            {podeStatus ? (
              <button
                type="button"
                className="btn secondary"
                data-gaveta-action="status"
                onClick={() => estado.abrirStatus(candidato.candidato_id)}
              >
                <i className="fa-solid fa-pen" aria-hidden="true" /> Alterar
                status
              </button>
            ) : null}
            {podeCarta ? (
              <button
                type="button"
                className="btn green"
                data-gaveta-action="carta"
                onClick={() => estado.abrirCarta([candidato.candidato_id])}
              >
                <i
                  className="fa-solid fa-envelope-open-text"
                  aria-hidden="true"
                />{" "}
                Carta de convocação
              </button>
            ) : null}
          </div>
        ) : null}

        <Secao icone="fa-id-card" titulo="Na lista" secao="dados">
          <GradeDeKv rotulo="Dados do candidato na lista">
            <Kv rotulo="Cargo">{candidato.cargo}</Kv>
            <Kv rotulo="Código da vaga">{candidato.codigo_vaga}</Kv>
            <Kv rotulo="Modalidade">
              {modalidadeSemAspas(candidato.modalidade)}
            </Kv>
            <Kv rotulo="Classificação">{candidato.classificacao ?? ""}</Kv>
            <Kv rotulo="Nota">
              {candidato.nota === null || candidato.nota === undefined
                ? ""
                : formatarNota(candidato.nota)}
            </Kv>
            <Kv rotulo="Data da convocação">{formatarData(dataConvocacao)}</Kv>
            <Kv rotulo="Processo SEI">{candidato.processo_sei}</Kv>
            <Kv rotulo="Matrícula">{candidato.matricula}</Kv>
          </GradeDeKv>
        </Secao>

        <Secao
          icone="fa-envelope-open-text"
          titulo="Cartas de convocação"
          secao="cartas"
        >
          {!historico || historico.carregando ? (
            <div className="aprovados-cartas-emitidas" aria-busy="true">
              <BlocosEsqueleto
                quantos={2}
                className="aprovados-carta-esqueleto"
              />
            </div>
          ) : historico.erro ? (
            <p className="ui-vazio">
              Não foi possível ler as cartas.{" "}
              <button
                type="button"
                className="btn secondary small"
                onClick={() =>
                  void estado.carta.carregarHistorico(candidato.candidato_id, {
                    forcar: true,
                  })
                }
              >
                Tentar de novo
              </button>
            </p>
          ) : historico.cartas.length ? (
            <ul
              className="aprovados-cartas-emitidas"
              id="approvedCandidatoCartas"
            >
              {historico.cartas.map((carta) => (
                <Carta key={carta.carta_id} carta={carta} />
              ))}
            </ul>
          ) : (
            <p className="ui-vazio">Nenhuma carta emitida.</p>
          )}
        </Secao>
      </div>
    </Gaveta>
  );
}
