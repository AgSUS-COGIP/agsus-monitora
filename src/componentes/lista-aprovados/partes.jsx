import { useState } from "react";
import { canChangeCandidateStatus } from "../../lib/access-roles.js";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  canEditCandidateStatus,
  tomDoStatus,
} from "../../lib/lista-aprovados-rules.js";

/*
  Peças que as duas abas (aprovados e convocação) e os modais repetem. As
  classes são as de `lista-aprovados.css` e `lista-convocacao.css`.
*/

export const classes = (...lista) => lista.filter(Boolean).join(" ");

export const plural = (total, singular, varios) =>
  `${formatNumberBR(total)} ${total === 1 ? singular : varios}`;

/** Indicador da fileira de KPIs. Antes do dado chegar, "—": carregando não é zero. */
export function Kpi({ id, tom, icone, rotulo, valor, carregado = true }) {
  return (
    <div className="approved-kpi" data-tone={tom}>
      <span className="approved-kpi-icon">
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
      </span>
      <div>
        <span className="approved-kpi-label">{rotulo}</span>
        <strong id={id}>{carregado ? formatNumberBR(valor) : "—"}</strong>
      </div>
    </div>
  );
}

export function SeloDeStatus({ status }) {
  return (
    <span className={`approved-status ${tomDoStatus(status)}`}>
      {status || "Sem status"}
    </span>
  );
}

export function NomeDoCandidato({ candidato }) {
  return (
    <div className="approved-name">
      <strong>{candidato.nome}</strong>
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
  A ação de status é a mesma nas duas abas: lápis quando pode, cadeado quando a
  lista está inativa para quem poderia, e um traço para quem não pode.
*/
export function AcaoDeStatus({ perfil, candidato, atributos = {}, aoAbrir }) {
  if (canEditCandidateStatus(perfil, candidato))
    return (
      <button
        className="btn icon outline"
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
  if (!candidato.lista_ativa && canChangeCandidateStatus(perfil))
    return (
      <button
        className="btn icon outline"
        type="button"
        disabled
        title="Lista inativa"
        aria-label="Lista inativa"
      >
        <i className="fa-solid fa-lock" aria-hidden="true" />
      </button>
    );
  return <span className="approved-no-action">—</span>;
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
