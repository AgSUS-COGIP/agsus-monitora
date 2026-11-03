import type {
  CelulaDoCalendario,
  EditalComDataARevisar,
  EtapaDoCalendario,
  FaixaDaSemana,
} from "./tipos.ts";
import type { MouseEvent } from "react";
import type { MarcaNoDia } from "../../lib/calendario-editais.ts";
import { Fragment, useMemo } from "react";
import { dataLocal, situacaoDaEtapa } from "../../lib/etapas-de-edital.ts";
import {
  DIAS_SEMANA,
  dataExibidaNasProximas,
  detalheDaEtapa,
  etapasAtivasNoDia,
  faixasDaSemana,
  formatarCurto,
  periodoDaEtapa,
  rotuloDoNumeroDoEdital,
  tituloDoDia,
  unidadeCurta,
} from "../../lib/calendario-editais.ts";
import { Aviso, classes, Modal } from "../../ui/index.ts";

/*
  As peças do calendário: a grade do mês (e o skeleton dela), a linha de uma
  etapa (usada na Lista, nas próximas etapas e no popup do dia), a linha do
  tempo e o popup do dia. As classes são as de `cronograma.css`; a cor de cada
  tipo sai de `data-cor`, e o CSS decide o que é "rosa". A cor é sempre a do
  TIPO, e o rótulo do tipo vai escrito ao lado — a cor nunca é o único sinal.
*/

export function Seletor({
  id,
  vazio,
  opcoes,
  valor,
  aoMudar,
}: {
  id: string;
  vazio: string;
  opcoes: readonly (readonly [string, string])[];
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <select
      id={id}
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

/** O nome inteiro da etapa, da unidade e do tipo, para o `title` da faixa. */
const tituloDaFaixa = (etapa: EtapaDoCalendario) =>
  `${etapa.atividade} — ${detalheDaEtapa(etapa)} (${etapa.tipo.rotulo})`;

/*
  A grade do mês, como uma agenda: uma linha por semana; em cada uma, os sete
  dias (botões que abrem o popup) e, por cima, as faixas das etapas, que
  atravessam os dias do intervalo. Até três faixas por dia; o resto vira
  "+N mais". As faixas são só para o mouse (o clique abre o dia em que se
  clicou); para o teclado e o leitor de tela, o dia é o botão, e o rótulo dele
  diz quantas etapas há — o popup lista todas, com o tipo escrito.

  No celular as faixas não cabem: o dia mostra as bolinhas dos tipos e o total.
*/
export function GradeDoMes({
  celulas,
  etapas,
  selecionado,
  aoEscolherDia,
}: {
  celulas: readonly CelulaDoCalendario[];
  etapas: readonly EtapaDoCalendario[];
  selecionado: string;
  aoEscolherDia: (chave: string) => void;
}) {
  const semanas = useMemo(() => {
    const linhas: CelulaDoCalendario[][] = [];
    for (let i = 0; i < celulas.length; i += 7)
      linhas.push(celulas.slice(i, i + 7));
    return linhas.map((dias) => {
      const chaves = dias.map((celula) => celula.chave);
      return { dias, chaves, ...faixasDaSemana(etapas, chaves) };
    });
  }, [celulas, etapas]);

  return (
    <>
      <div className="cal-semana">
        {DIAS_SEMANA.map((dia) => (
          <span key={dia}>{dia}</span>
        ))}
      </div>
      <div className="cal-dias">
        {semanas.map((semana) => (
          <div key={semana.chaves[0]} className="cal-semana-linha">
            {semana.dias.map((celula, coluna) => (
              <CelulaDoMes
                key={celula.chave}
                celula={celula}
                coluna={coluna}
                aberto={celula.chave === selecionado}
                aoEscolherDia={aoEscolherDia}
              />
            ))}
            {semana.faixas.map((faixa) => (
              <FaixaDaEtapa
                key={`${faixa.etapa.editalId}:${faixa.etapa.ordem}:${faixa.etapa.data_inicio}`}
                faixa={faixa}
                chaves={semana.chaves}
                aoEscolherDia={aoEscolherDia}
              />
            ))}
            {semana.ocultas.map((ocultas, coluna) =>
              ocultas ? (
                <span
                  key={semana.chaves[coluna]}
                  className="cal-mais"
                  style={{ gridColumn: coluna + 1 }}
                  aria-hidden="true"
                >
                  +{ocultas} mais
                </span>
              ) : null,
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function CelulaDoMes({
  celula,
  coluna,
  aberto,
  aoEscolherDia,
}: {
  celula: CelulaDoCalendario;
  coluna: number;
  aberto: boolean;
  aoEscolherDia: (chave: string) => void;
}) {
  return (
    <button
      type="button"
      className={classes(
        "cal-celula",
        !celula.doMes && "fora-do-mes",
        celula.hoje && "hoje",
        aberto && "selecionado",
        !celula.total && "vazio",
      )}
      style={{ gridColumn: coluna + 1 }}
      data-dia={celula.chave}
      aria-label={celula.rotulo}
      aria-current={aberto ? "true" : undefined}
      onClick={() => aoEscolherDia(celula.chave)}
    >
      <span className="cal-numero">{celula.dia}</span>
      {celula.total ? (
        <span className="cal-resumo" aria-hidden="true">
          <span className="cal-pontos">
            {celula.pontos.map(({ tipo }) => (
              <i key={tipo.id} className="cal-ponto" data-cor={tipo.cor} />
            ))}
          </span>
          <span className="cal-resumo-total">{celula.total}</span>
        </span>
      ) : null}
    </button>
  );
}

function FaixaDaEtapa({
  faixa,
  chaves,
  aoEscolherDia,
}: {
  faixa: FaixaDaSemana;
  chaves: readonly string[];
  aoEscolherDia: (chave: string) => void;
}) {
  const { etapa, de, ate } = faixa;
  // Abre o dia em que se clicou, pela posição do clique dentro da faixa.
  function abrirDia(evento: MouseEvent<HTMLSpanElement>) {
    const caixa = evento.currentTarget.getBoundingClientRect();
    const dias = ate - de + 1;
    const fracao = caixa.width
      ? (evento.clientX - caixa.left) / caixa.width
      : 0;
    const coluna =
      de + Math.min(dias - 1, Math.max(0, Math.floor(fracao * dias)));
    aoEscolherDia(chaves[coluna] ?? chaves[de] ?? "");
  }
  return (
    <span
      className="cal-faixa"
      data-cor={etapa.tipo.cor}
      data-inicio={chaves[de]}
      data-fim={chaves[ate]}
      data-continua-antes={faixa.continuaAntes || undefined}
      data-continua-depois={faixa.continuaDepois || undefined}
      style={{ gridColumn: `${de + 1} / ${ate + 2}`, gridRow: faixa.faixa + 2 }}
      title={tituloDaFaixa(etapa)}
      aria-hidden="true"
      onClick={abrirDia}
    >
      <b>{unidadeCurta(etapa.unidade)}</b> – {etapa.atividade}
    </span>
  );
}

/* A grade antes da primeira carga: os dias da semana e 35 dias em skeleton. */
export function GradeEsqueleto() {
  return (
    <>
      <div className="cal-semana">
        {DIAS_SEMANA.map((dia) => (
          <span key={dia}>{dia}</span>
        ))}
      </div>
      <div className="cal-dias cal-dias-esqueleto" aria-hidden="true">
        {Array.from({ length: 35 }, (_, indice) => (
          <span key={indice} className="cal-celula cal-celula-esqueleto">
            <span className="ui-esqueleto cal-numero-esqueleto" />
          </span>
        ))}
      </div>
    </>
  );
}

/** "● Entrevistas": a bolinha da cor do tipo e o nome dele, por escrito. */
export function TipoDaEtapa({ etapa }: { etapa: EtapaDoCalendario }) {
  return (
    <span className="cal-tipo" data-cor={etapa.tipo.cor}>
      <i aria-hidden="true" />
      {etapa.tipo.rotulo}
    </span>
  );
}

/*
  A linha de uma etapa. Linha 1: o nome, em negrito. Linha 2, discreta: o tipo
  ("● Entrevistas"), a unidade, o edital e o período. À direita, quando há, a
  marca do dia ("início", "último dia", "até 13/11") em texto discreto.
*/
export function ItemDeEtapa({
  etapa,
  mostrarData = false,
  dataExibida = null,
  marca = "",
  aoEscolher,
}: {
  etapa: EtapaDoCalendario;
  mostrarData?: boolean;
  dataExibida?: string | null;
  /** "início", "último dia", "até 13/11"; vazio quando a etapa é do dia. */
  marca?: string;
  aoEscolher: (editalId: string) => void;
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
          {formatarCurto(dataLocal(dataExibida || etapa.data_inicio))}
        </span>
      ) : null}
      <span className="cal-item-corpo">
        <strong>{etapa.atividade}</strong>
        <small>
          <TipoDaEtapa etapa={etapa} /> · {etapa.unidade} ·{" "}
          {rotuloDoNumeroDoEdital(etapa.edital)} · {periodoDaEtapa(etapa)}
        </small>
      </span>
      {marca ? <span className="cal-item-marca">{marca}</span> : null}
    </button>
  );
}

/** A marca de uma etapa num dia: "início", "último dia", "até 13/11" ou nada. */
export function textoDaMarca(etapa: EtapaDoCalendario, marca: MarcaNoDia) {
  if (marca === "começa") return "início";
  if (marca === "último dia") return "último dia";
  if (marca === "em andamento")
    return `até ${formatarCurto(dataLocal(etapa.data_fim))}`;
  return "";
}

export const chaveDaEtapa = (etapa: EtapaDoCalendario, indice: number) =>
  `${etapa.editalId}:${etapa.ordem}:${etapa.data_inicio}:${indice}`;

/*
  Avisa quem pode corrigir quando há etapa de data impossível (ano digitado
  errado): sem isto, ela só sumia da lista de "Próximas etapas".
*/
export function AvisoDeDatasARevisar({
  editais,
}: {
  editais: readonly EditalComDataARevisar[];
}) {
  if (!editais.length) return null;
  return (
    <Aviso tom="warning" papel="status" como="p" className="cal-aviso-datas">
      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
      <span>
        {editais.length} edita{editais.length === 1 ? "l" : "is"} com data
        impossível no cronograma:{" "}
        {editais.map((item) => item.edital).join("; ")}. Corrija em Editais.
      </span>
    </Aviso>
  );
}

export function ProximasEtapas({
  etapas,
  hoje,
  aoEscolher,
}: {
  etapas: readonly EtapaDoCalendario[];
  hoje: Date;
  aoEscolher: (editalId: string) => void;
}) {
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
      dataExibida={dataExibidaNasProximas(etapa, hoje)}
      aoEscolher={aoEscolher}
    />
  ));
}

/*
  A cor do ponto é a do tipo, como em toda a tela; a situação vem da forma:
  cheio para o que passou, com halo para o que acontece agora, vazado (só o
  contorno na cor do tipo) para o que ainda vem.
*/
export function LinhaDoTempo({
  editalId,
  etapas,
  hoje,
}: {
  editalId: string;
  etapas: readonly EtapaDoCalendario[];
  hoje: Date;
}) {
  if (!editalId) return <li className="cal-vazio">Selecione um edital.</li>;
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
      <small>
        <TipoDaEtapa etapa={etapa} /> · {periodoDaEtapa(etapa)}
      </small>
    </li>
  ));
}

/*
  Detalhe do dia em popup. Fica sobre o calendário em vez de empurrar a página
  para baixo: quem clica num dia quer ler aquelas etapas e voltar. Lista tudo o
  que está ativo no dia — as mesmas etapas das faixas e do "+N mais" —:
  primeiro o que começa ou termina nele, depois o que só o atravessa. Escolher
  uma etapa foca o edital dela na linha do tempo e fecha o popup.
*/
export function DiaDoCalendario({
  chave,
  etapas,
  aoFechar,
  aoEscolherEdital,
}: {
  chave: string;
  etapas: readonly EtapaDoCalendario[];
  aoFechar: () => void;
  aoEscolherEdital: (editalId: string) => void;
}) {
  const doDia = etapasAtivasNoDia(etapas, chave);
  const primeiroEmAndamento = doDia.findIndex(
    ({ marca }) => marca === "em andamento",
  );
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
            doDia.map(({ etapa, marca }, indice) => (
              <Fragment key={chaveDaEtapa(etapa, indice)}>
                {indice === primeiroEmAndamento ? (
                  <p className="cal-modal-secao">Em andamento neste dia</p>
                ) : null}
                <ItemDeEtapa
                  etapa={etapa}
                  marca={textoDaMarca(etapa, marca)}
                  aoEscolher={(editalId) => {
                    aoEscolherEdital(editalId);
                    aoFechar();
                  }}
                />
              </Fragment>
            ))
          ) : (
            <p className="cal-vazio">Nenhuma etapa neste dia.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
