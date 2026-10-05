import { useState } from "react";
import { canChangeCandidateStatus } from "../../lib/access-roles.js";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  alteracaoJudicial,
  canEditCandidateStatus,
  formatarData,
  formatarNota,
  modalidadeSemAspas,
  statusEhConvocado,
  statusTravado,
  tomDoStatus,
} from "../../lib/lista-aprovados-rules.js";
import { Icone } from "../../componentes/icone.jsx";

/*
  Peças que as duas abas (aprovados e convocação) e os modais repetem. As
  classes são as de `aprovados.css` e `convocacao.css`. As genéricas
  (BotaoDeAcao, LinhasEsqueleto, ErroAoCarregar, Kpi) vêm de src/ui/.
*/

export { classes } from "../../ui/index.js";

export const plural = (total, singular, varios) =>
  `${formatNumberBR(total)} ${total === 1 ? singular : varios}`;

/*
  O selo do status; com a data da convocação (`dataConvocacao`, "AAAA-MM-DD"),
  Convocado mostra o dia em que foi chamado.
*/
export function SeloDeStatus({ status, dataConvocacao = "" }) {
  const data = statusEhConvocado(status) ? formatarData(dataConvocacao) : "";
  return (
    <span className="approved-status-celula">
      <span className={`approved-status ${tomDoStatus(status)}`}>
        {status || "Sem status"}
      </span>
      {data ? <small className="approved-status-data">em {data}</small> : null}
    </span>
  );
}

/*
  O nome do candidato; com `aoAbrir`, o nome é o botão que abre a gaveta do
  candidato (dados, status e cartas de convocação emitidas).
*/
export function NomeDoCandidato({ candidato, aoAbrir }) {
  return (
    <div className="approved-name">
      {aoAbrir ? (
        <button
          type="button"
          className="approved-nome-botao"
          data-approved-action="candidato"
          data-candidate-id={candidato.candidato_id}
          onClick={() => aoAbrir(candidato.candidato_id)}
        >
          <strong>{candidato.nome}</strong>
        </button>
      ) : (
        <strong>{candidato.nome}</strong>
      )}
      {candidato.sub_judice ? (
        <span className="approved-tag subjudice">SUB JUDICE</span>
      ) : null}
      <small>
        {candidato.edital || ""}
        {candidato.lista_ativa ? "" : " · Lista inativa"}
      </small>
    </div>
  );
}

/*
  Nota e modalidade mudadas por decisão judicial aparecem com o valor do
  resultado publicado riscado antes do atual ("33 → 40").
*/
function DeParaJudicial({ de, para }) {
  return (
    <span className="approved-de-para" title="Alterado por decisão judicial">
      <s>{de}</s>
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> alterado para </span>
      <strong>{para}</strong>
    </span>
  );
}

export function NotaDoCandidato({ candidato }) {
  const mudou = alteracaoJudicial(candidato)?.nota;
  return mudou ? (
    <DeParaJudicial
      de={formatarNota(mudou.de)}
      para={formatarNota(mudou.para)}
    />
  ) : (
    formatarNota(candidato.nota)
  );
}

export function ModalidadeDoCandidato({ candidato }) {
  const mudou = alteracaoJudicial(candidato)?.modalidade;
  return mudou ? (
    <DeParaJudicial de={mudou.de || "-"} para={mudou.para || "-"} />
  ) : (
    modalidadeSemAspas(candidato.modalidade) || "-"
  );
}

/*
  A ação de status é a mesma nas duas abas: lápis quando pode, cadeado quando
  quem poderia está barrado (lista inativa, ou status já definido e só o admin
  altera), e um traço para quem não pode.
*/
export function AcaoDeStatus({ perfil, candidato, atributos = {}, aoAbrir }) {
  if (canEditCandidateStatus(perfil, candidato))
    return (
      <button
        className="approved-icone-acao"
        type="button"
        title="Alterar status"
        aria-label={`Alterar status de ${candidato.nome}`}
        data-candidate-id={candidato.candidato_id}
        {...atributos}
        onClick={() => aoAbrir(candidato.candidato_id)}
      >
        <i className="fa-solid fa-pen" aria-hidden="true" />
      </button>
    );
  const barrado = !candidato.lista_ativa
    ? "Lista inativa"
    : statusTravado(perfil, candidato)
      ? "Status já definido: só o admin altera"
      : "";
  if (barrado && canChangeCandidateStatus(perfil))
    return (
      <button
        className="approved-icone-acao"
        type="button"
        disabled
        title={barrado}
        aria-label={barrado}
      >
        <i className="fa-solid fa-lock" aria-hidden="true" />
      </button>
    );
  return <span className="approved-no-action">—</span>;
}

/*
  A carta de convocação da linha: só para quem emite (aprovados >= editor) e em
  lista ativa; para os demais, nada.
*/
export function AcaoDeCarta({ perfil, candidato, atributos = {}, aoAbrir }) {
  if (!candidato.lista_ativa || !canChangeCandidateStatus(perfil)) return null;
  return (
    <button
      className="approved-icone-acao"
      type="button"
      title="Carta de convocação"
      aria-label={`Carta de convocação de ${candidato.nome}`}
      data-candidate-id={candidato.candidato_id}
      {...atributos}
      onClick={() => aoAbrir([candidato.candidato_id])}
    >
      <i className="fa-solid fa-envelope-open-text" aria-hidden="true" />
    </button>
  );
}

/** O ícone de PDF dos anexos; a cor vem do texto em volta. */
export const IconeDePdf = ({ tamanho = 22 }) => (
  <Icone nome="file-type-pdf" tamanho={tamanho} />
);

/*
  Os anexos do candidato: o ícone de PDF, cinza sem arquivo e vermelho com
  arquivo. Sem anexo, fica desativado (e não some), para que o lápis de status
  continue no mesmo lugar em todas as linhas.
*/
export function AcaoDeAnexos({ candidato, anexos = [], aoAbrir }) {
  const total = anexos.length;
  return (
    <button
      className="approved-icone-acao approved-anexos-botao"
      type="button"
      data-tem-anexo={total ? "" : undefined}
      disabled={!total}
      title={total ? `Ver anexos (${total})` : "Sem anexos"}
      aria-label={
        total
          ? `Ver ${total} anexo(s) de ${candidato.nome}`
          : `${candidato.nome} não tem anexos`
      }
      data-approved-action="anexos"
      data-candidate-id={candidato.candidato_id}
      onClick={() => aoAbrir(candidato.candidato_id)}
    >
      <IconeDePdf />
    </button>
  );
}

/*
  Barra de paginação das duas abas. Some quando tudo cabe numa página: com 30
  candidatos, controles de página são ruído. `pagina` é o resultado de
  `paginateApprovedCandidates`.
*/
const TAMANHOS_DE_PAGINA = [25, 50, 100, 200];

export function Paginacao({
  prefixo,
  pagina,
  tamanho,
  unidade,
  aoIrPara,
  aoMudarTamanho,
}) {
  const { total, page, totalPages, from, to } = pagina;
  return (
    <div
      className="approved-paginacao"
      id={`${prefixo}Paginacao`}
      hidden={totalPages <= 1}
    >
      <span
        className="approved-paginacao-info"
        id={`${prefixo}PaginacaoInfo`}
        aria-live="polite"
      >
        {totalPages > 1
          ? `Mostrando ${formatNumberBR(from)}–${formatNumberBR(to)} de ${formatNumberBR(total)} ${unidade}`
          : ""}
      </span>
      <span className="approved-paginacao-controles">
        <label
          className="approved-paginacao-tamanho"
          htmlFor={`${prefixo}PageSize`}
        >
          Por página
          <select
            id={`${prefixo}PageSize`}
            value={tamanho}
            onChange={(evento) => {
              const valor = Number(evento.target.value);
              if (Number.isFinite(valor) && valor > 0) aoMudarTamanho(valor);
            }}
          >
            {TAMANHOS_DE_PAGINA.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </label>
        <button
          id={`${prefixo}PagePrev`}
          className="btn secondary"
          type="button"
          disabled={page <= 1}
          onClick={() => aoIrPara(page - 1)}
        >
          <i className="fa-solid fa-chevron-left" aria-hidden="true" /> Anterior
        </button>
        <span
          id={`${prefixo}PaginaAtual`}
          className="approved-paginacao-pagina"
        >
          {totalPages > 1 ? `Página ${page} de ${totalPages}` : ""}
        </span>
        <button
          id={`${prefixo}PageNext`}
          className="btn secondary"
          type="button"
          disabled={page >= totalPages}
          onClick={() => aoIrPara(page + 1)}
        >
          Próxima <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

/*
  Campo cujo texto não é o valor. O número digitado vira inteiro, os termos
  viram lista — e amarrar o `value` ao valor lido tiraria da tela o que a
  pessoa está a escrever: apagar o "0" para digitar "12" voltaria a mostrar
  "0", e "ampla; " perderia o "; " antes do termo seguinte.

  O campo guarda o próprio texto e só o troca quando o valor muda por fora
  (o "Aplicar a todas", a troca de base do modelo) para algo que o texto atual
  já não diz.
*/
export function CampoEditavel({
  valor,
  ler = (texto) => texto,
  escrever = (atual) => String(atual ?? ""),
  aoMudar,
  ...atributos
}) {
  const [texto, setTexto] = useState(() => escrever(valor));
  const [visto, setVisto] = useState(valor);
  if (!Object.is(valor, visto)) {
    setVisto(valor);
    if (escrever(ler(texto)) !== escrever(valor)) setTexto(escrever(valor));
  }
  return (
    <input
      {...atributos}
      value={texto}
      onChange={(evento) => {
        setTexto(evento.target.value);
        aoMudar(ler(evento.target.value));
      }}
    />
  );
}
