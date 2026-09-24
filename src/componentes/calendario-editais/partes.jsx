import { dataLocal, situacaoDaEtapa } from "../../lib/etapas-de-edital.js";
import {
  DIAS_SEMANA,
  etapasDoDia,
  formatarCurto,
  periodoDaEtapa,
  tituloDoDia,
} from "../../lib/calendario-editais.js";
import { Modal } from "../modal.jsx";

/*
  As peças do calendário: a grade do mês, a linha de uma etapa (usada nas
  próximas etapas e no popup do dia), a linha do tempo e o popup do dia. As
  classes são as de `src/styles/calendario-editais.css`; a cor de cada tipo sai
  de `data-cor`, e o CSS decide o que é "rosa".
*/

const classes = (...lista) => lista.filter(Boolean).join(" ");

export function Seletor({ id, title, vazio, opcoes, valor, aoMudar }) {
  return (
    <select
      id={id}
      title={title}
      value={valor}
      onChange={(evento) => aoMudar(evento.target.value)}
    >
      <option value="">{vazio}</option>
      {opcoes.map(([chave, rotulo]) => (
        <option key={chave} value={chave}>
          {rotulo}
        </option>
      ))}
    </select>
  );
}

export function GradeDoMes({ celulas, selecionado, aoEscolherDia }) {
  return (
    <>
      <div className="cal-semana">
        {DIAS_SEMANA.map((dia) => (
          <span key={dia}>{dia}</span>
        ))}
      </div>
      <div className="cal-dias">
        {celulas.map((celula) => {
          const aberto = celula.chave === selecionado;
          return (
            <button
              key={celula.chave}
              type="button"
              className={classes(
                "cal-celula",
                !celula.doMes && "fora-do-mes",
                celula.hoje && "hoje",
                aberto && "selecionado",
                !celula.total && "vazio",
              )}
              data-dia={celula.chave}
              aria-label={celula.rotulo}
              aria-current={aberto ? "true" : undefined}
              onClick={() => aoEscolherDia(celula.chave)}
            >
              <span className="cal-numero">{celula.dia}</span>
              <span className="cal-pontos">
                {celula.pontos.map(({ tipo, total }) => (
                  <span
                    key={tipo.id}
                    className="cal-ponto"
                    data-cor={tipo.cor}
                    title={`${tipo.rotulo}: ${total}`}
                  >
                    <i aria-hidden="true" />
                    {total}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function ItemDeEtapa({
  etapa,
  marco = "",
  mostrarData = false,
  aoEscolher,
}) {
  return (
    <button
      type="button"
      className="cal-item"
      data-edital-id={etapa.editalId}
      data-cor={etapa.tipo.cor}
      onClick={() => aoEscolher(etapa.editalId)}
    >
      {mostrarData ? (
        <span className="cal-item-data">
          {formatarCurto(dataLocal(etapa.data_inicio))}
        </span>
      ) : null}
      <span className="cal-item-corpo">
        <strong>
          {/*
            A marca vem ANTES do nome, não depois. O nome é truncado com
            reticências quando é longo — e os nomes reais são longos ("Prazo de
            recurso referente ao resultado preliminar da Avaliação Documental e
            de Títulos"). Depois do nome, a marca era a primeira coisa a
            desaparecer, justamente nas linhas em que ela mais importa.
          */}
          {marco ? (
            <span className="cal-marco" data-marco={marco}>
              {marco}
            </span>
          ) : null}
          {etapa.atividade}
        </strong>
        <small>
          Ed. {etapa.edital} • {etapa.unidade} • {periodoDaEtapa(etapa)}
        </small>
      </span>
    </button>
  );
}

const chaveDaEtapa = (etapa, indice) =>
  `${etapa.editalId}:${etapa.ordem}:${etapa.data_inicio}:${indice}`;

export function ProximasEtapas({ etapas, aoEscolher }) {
  if (!etapas.length)
    return (
      <p className="cal-vazio">
        Nenhuma etapa em aberto para os filtros atuais.
      </p>
    );
  return etapas.map((etapa, indice) => (
    <ItemDeEtapa
      key={chaveDaEtapa(etapa, indice)}
      etapa={etapa}
      mostrarData
      aoEscolher={aoEscolher}
    />
  ));
}

export function LinhaDoTempo({ editalId, etapas, hoje }) {
  if (!editalId)
    return (
      <li className="cal-vazio">
        Selecione um edital, ou clique numa etapa do calendário.
      </li>
    );
  if (!etapas.length)
    return <li className="cal-vazio">Este edital não tem etapas com data.</li>;
  return etapas.map((etapa, indice) => (
    <li
      key={chaveDaEtapa(etapa, indice)}
      className="cal-passo"
      data-situacao={situacaoDaEtapa(etapa, hoje) ?? undefined}
      data-cor={etapa.tipo.cor}
    >
      <span className="cal-passo-marca" aria-hidden="true" />
      <strong>{etapa.atividade}</strong>
      <small>{periodoDaEtapa(etapa)}</small>
    </li>
  ));
}

/*
  Detalhe do dia em popup. Fica sobre o calendário em vez de empurrar a página
  para baixo: quem clica num dia quer ler aquelas etapas e voltar, não perder a
  grade de vista nem rolar até ao rodapé. Escolher uma etapa foca o edital dela
  na linha do tempo e fecha o popup.
*/
export function DiaDoCalendario({ chave, etapas, aoFechar, aoEscolherEdital }) {
  const doDia = etapasDoDia(etapas, chave);
  return (
    <Modal
      id="calDiaModal"
      className="cal-modal"
      cartaoClassName="cal-modal-card"
      rotuloId="calDiaTitulo"
      aoFechar={aoFechar}
    >
      <div className="modal-head">
        <h3 id="calDiaTitulo">{tituloDoDia(chave, doDia.length)}</h3>
        <button
          id="calDiaFechar"
          className="btn secondary"
          type="button"
          data-foco-inicial
          onClick={aoFechar}
        >
          Fechar
        </button>
      </div>
      <div className="modal-body">
        <div id="calDiaLista">
          {doDia.length ? (
            doDia.map(({ etapa, marco }, indice) => (
              <ItemDeEtapa
                key={chaveDaEtapa(etapa, indice)}
                etapa={etapa}
                marco={marco}
                aoEscolher={(editalId) => {
                  aoEscolherEdital(editalId);
                  aoFechar();
                }}
              />
            ))
          ) : (
            <p className="cal-vazio">
              Nenhuma etapa começa ou termina neste dia.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
