import { useEffect } from "react";
import {
  chaveDoDia,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../../lib/boas-vindas.js";
import {
  formatarNumero,
  tomDoRisco,
  tomDoStatusDoEdital,
} from "../../lib/editais-do-nucleo.js";
import { diaEMes, quandoDaEtapa } from "../../lib/visao-geral-da-area.js";

/*
  As peças da Visão geral da SEDE e de Projetos. A faixa de indicadores usa as
  classes da Saúde Indígena (`.kpis.kpis-main` e `.kpi.ag-*`, estilo em
  `health-reference-kpis.css`) para ficar igual a ela; o resto é de
  `src/styles/visao-geral-da-area.css`. Ícones em Font Awesome, como o resto
  da página da Saúde Indígena (DESIGN.md, "Ícones": um conjunto por componente).
*/

const INDICADORES = Object.freeze([
  {
    chave: "processos",
    rotulo: "Processos seletivos",
    icone: "fa-folder-open",
    tom: "ag-navy",
  },
  {
    chave: "vagas",
    rotulo: "Vagas imediatas previstas",
    icone: "fa-briefcase",
    tom: "ag-blue",
  },
  {
    chave: "contratados",
    rotulo: "Contratações de vagas imediatas + CR",
    icone: "fa-user-check",
    tom: "ag-green",
  },
  {
    chave: "ociosas",
    rotulo: "Vagas ociosas",
    icone: "fa-triangle-exclamation",
    tom: "ag-red",
  },
  {
    chave: "criticos",
    rotulo: "Processos críticos",
    icone: "fa-circle-exclamation",
    tom: "ag-yellow",
    filtra: true,
  },
  {
    chave: "inscritos",
    rotulo: "Inscritos",
    icone: "fa-users",
    tom: "ag-cyan",
  },
]);

/*
  Os seis indicadores. "Processos críticos" é um botão, como na Saúde
  Indígena: filtra a tabela dos editais pelos de risco médio ou alto.
*/
export function FaixaDeIndicadores({ indicadores, soCriticos, aoFiltrar }) {
  return (
    <div className="kpis kpis-main" aria-label="Indicadores da área">
      {INDICADORES.map((item) => {
        const conteudo = (
          <>
            <span>
              <i className={`fa-solid ${item.icone}`} aria-hidden="true" />
              <span>{item.rotulo}</span>
            </span>
            <b>{formatarNumero(indicadores[item.chave])}</b>
          </>
        );
        if (!item.filtra)
          return (
            <div key={item.chave} className={`kpi ${item.tom}`}>
              {conteudo}
            </div>
          );
        return (
          <button
            key={item.chave}
            type="button"
            className={[
              "kpi kpi-clickable",
              item.tom,
              soCriticos && "active-filter",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={soCriticos ? "true" : "false"}
            title="Filtrar a tabela pelos processos de risco médio e alto"
            onClick={aoFiltrar}
          >
            {conteudo}
          </button>
        );
      })}
    </div>
  );
}

/*
  A mesma mensagem da Saúde Indígena (`src/modules/boas-vindas.js`), com a
  conta dos editais desta área. Fechar vale até amanhã, em todas as áreas.
*/
export function BoasVindas({
  perfil,
  quantidade,
  agora,
  aoAbrirCronograma,
  aoFechar,
}) {
  const nome = primeiroNome(perfil?.nome || perfil?.email?.split("@")[0]);
  const titulo = [saudacao(agora.getHours()), nome].filter(Boolean).join(", ");
  return (
    <div className="boas-vindas" role="status" aria-live="polite">
      <div className="boas-vindas__texto">
        <strong>{titulo}</strong>
        <span>{resumoDoDia(quantidade)}</span>
      </div>
      {quantidade > 0 && (
        <button
          type="button"
          className="boas-vindas__acao"
          onClick={aoAbrirCronograma}
        >
          Ver cronograma
        </button>
      )}
      <button
        type="button"
        className="boas-vindas__fechar"
        aria-label="Fechar mensagem de boas-vindas"
        onClick={aoFechar}
      >
        ×
      </button>
    </div>
  );
}

/** Um bloco com título (h3, ícone Font Awesome) e contagem opcional. */
export function Bloco({ icone, titulo, contagem, acoes, className, children }) {
  return (
    <section
      className={["visao-da-area__bloco", className].filter(Boolean).join(" ")}
    >
      <header className="visao-da-area__cabecalho">
        <h3>
          <i className={`fa-solid ${icone}`} aria-hidden="true" /> {titulo}
        </h3>
        {contagem !== undefined && (
          <span className="chip blue">{contagem}</span>
        )}
        {acoes}
      </header>
      {children}
    </section>
  );
}

export function Vazio({ icone = "fa-folder-open", titulo, children }) {
  return (
    <div className="visao-da-area__vazio">
      <i className={`fa-solid ${icone}`} aria-hidden="true" />
      <strong>{titulo}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

/* Editais com etapa nos próximos 7 dias, pela próxima etapa de cada um. */
export function ProximasEtapas({ editais, agora }) {
  const hoje = chaveDoDia(agora);
  return (
    <Bloco
      icone="fa-list-check"
      titulo="Próximas etapas"
      contagem={editais.length}
      className="visao-da-area__proximas"
    >
      {editais.length ? (
        <ul className="visao-da-area__etapas">
          {editais.map((linha) => {
            const data = String(linha.cronograma_proxima_data).slice(0, 10);
            return (
              <li key={linha.id} className="visao-da-area__etapa">
                <span
                  className="visao-da-area__data"
                  data-hoje={data <= hoje ? "true" : undefined}
                >
                  <b>{diaEMes(data)}</b>
                  <small>{quandoDaEtapa(data, agora)}</small>
                </span>
                <span className="visao-da-area__etapa-texto">
                  <strong>
                    {linha.cronograma_proxima_atividade || "Etapa sem nome"}
                  </strong>
                  <small>
                    Edital {linha.edital} · {linha.unidade}
                  </small>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Vazio icone="fa-calendar-check" titulo="Nada nos próximos 7 dias">
          Nenhum edital da área tem etapa até a próxima semana.
        </Vazio>
      )}
    </Bloco>
  );
}

const COLUNAS = Object.freeze([
  ["edital", "Edital"],
  ["unidade", "Unidade"],
  ["etapa", "Etapa"],
  ["status", "Status"],
  ["risco", "Criticidade"],
  ["vagas_total", "Vagas"],
  ["inscritos", "Inscritos"],
  ["contratados", "Contratações"],
]);

/*
  Os editais da área, compactos. Avisa \`agsus:content-updated\` depois de
  desenhar: é o que põe os rótulos do modo cartão no celular
  (`mobile-table-cards.js`).
*/
export function TabelaDeEditais({
  editais,
  encerrados,
  mostrarEncerrados,
  soCriticos,
  aoAlternarEncerrados,
  aoLimparCriticos,
}) {
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [editais]);

  const acoes = (
    <span className="visao-da-area__acoes">
      {soCriticos && (
        <button
          type="button"
          className="btn secondary"
          onClick={aoLimparCriticos}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" /> Só críticos
        </button>
      )}
      {encerrados > 0 && (
        <button
          type="button"
          className="btn secondary"
          aria-pressed={mostrarEncerrados ? "true" : "false"}
          onClick={aoAlternarEncerrados}
        >
          {mostrarEncerrados
            ? "Ocultar encerrados"
            : `Mostrar encerrados (${formatarNumero(encerrados)})`}
        </button>
      )}
    </span>
  );

  return (
    <Bloco
      icone="fa-file-lines"
      titulo="Editais da área"
      contagem={editais.length}
      acoes={acoes}
      className="visao-da-area__editais"
    >
      {editais.length ? (
        <div className="visao-da-area__rolagem">
          <table className="visao-da-area__tabela">
            <thead>
              <tr>
                {COLUNAS.map(([chave, rotulo]) => (
                  <th key={chave} scope="col">
                    {rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editais.map((linha) => (
                <tr key={linha.id}>
                  <td>{linha.edital || "-"}</td>
                  <td>{linha.unidade || "-"}</td>
                  <td className="visao-da-area__etapa-da-linha">
                    {linha.etapa || "-"}
                  </td>
                  <td>
                    <span
                      className={`chip ${tomDoStatusDoEdital(linha.status)}`}
                    >
                      {linha.status || "-"}
                    </span>
                  </td>
                  <td>
                    <span className={`chip ${tomDoRisco(linha.risco)}`}>
                      {linha.risco || "-"}
                    </span>
                  </td>
                  <td className="num">{formatarNumero(linha.vagas_total)}</td>
                  <td className="num">{formatarNumero(linha.inscritos)}</td>
                  <td className="num">{formatarNumero(linha.contratados)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Vazio icone="fa-circle-check" titulo="Nenhum edital nesta seleção">
          {soCriticos
            ? "Nenhum processo de risco médio ou alto em andamento."
            : "Todos os editais da área estão encerrados."}
        </Vazio>
      )}
    </Bloco>
  );
}
