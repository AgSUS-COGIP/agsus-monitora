import { Fragment } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  acompanhamentoDoPedido,
  SITUACOES_DA_EXECUCAO,
  SITUACOES_DA_VAGA,
} from "../../lib/painel-dos-robos.js";
import { dataHora } from "../../lib/saude-das-cargas.js";
import { Icone } from "../icone.jsx";

/*
  O que roda e o que rodou em cada robô (Status das atualizações):
    - Acompanhamento: depois de um pedido desta tela, a execução em
      andamento e o resultado (por vaga: gravada, candidatos, com link),
      com o link da execução no GitHub (a seção é só do administrador global);
    - UltimasExecucoes: as 8 últimas, com os parâmetros usados e quem pediu.
  Dados de get_painel_dos_robos (src/lib/painel-dos-robos.js) e da situação
  do pedido no banco (situacao_do_disparo_robo: aceito, recusado, sem chave).
*/

const numeroOuTraco = (n) =>
  n === null || n === undefined ? "—" : formatNumberBR(n);

function SeloDaExecucao({ situacao }) {
  const s =
    SITUACOES_DA_EXECUCAO[situacao] || SITUACOES_DA_EXECUCAO.EM_ANDAMENTO;
  return <span className={`saude-selo saude-selo--${s.tom}`}>{s.rotulo}</span>;
}

function LinkDoGithub({ url }) {
  if (!url) return null;
  return (
    <a
      className="robos-github"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir a execução no GitHub"
    >
      <Icone nome="square-arrow-out-up-right" tamanho={12} />
      GitHub
    </a>
  );
}

/** Uma linha por vaga da execução: situação, candidatos no arquivo, ativos, com link. */
export function ResultadoPorVaga({ porVaga }) {
  if (!porVaga?.length) return null;
  return (
    <div className="saude-historico robos-por-vaga">
      <table>
        <thead>
          <tr>
            <th scope="col">Vaga</th>
            <th scope="col">Situação</th>
            <th scope="col" className="num">
              No arquivo
            </th>
            <th scope="col" className="num">
              Ativos
            </th>
            <th scope="col" className="num">
              Com link
            </th>
          </tr>
        </thead>
        <tbody>
          {porVaga.map((v) => {
            const s = SITUACOES_DA_VAGA[v.situacao] || {
              rotulo: v.situacao,
              tom: "neutro",
            };
            return (
              <tr key={v.vaga} data-vaga={v.vaga}>
                <td>{v.vaga}</td>
                <td>
                  <span className={`saude-selo saude-selo--${s.tom}`}>
                    {s.rotulo}
                  </span>
                  {v.mensagem ? (
                    <small className="robos-por-vaga__mensagem">
                      {v.mensagem}
                    </small>
                  ) : null}
                </td>
                <td className="num">{numeroOuTraco(v.arquivo)}</td>
                <td className="num">{numeroOuTraco(v.ativos)}</td>
                <td className="num">{numeroOuTraco(v.comLink)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TEXTO_DA_ETAPA = Object.freeze({
  aguardando: "Pedido enviado. Aguardando o GitHub.",
  github: "Aceito pelo GitHub. Na fila ou rodando.",
  rodando: "Rodando.",
  terminou: "Terminou.",
});

/** O último pedido desta tela para o robô, enquanto a pessoa não o dispensa. */
export function Acompanhamento({ robo, atual, estado }) {
  const pedido = atual.acompanhamentos?.[robo.id];
  const situacao = acompanhamentoDoPedido({
    robo: robo.id,
    pedido,
    execucoes: atual.painel?.dados?.execucoes?.[robo.id] || [],
  });
  if (!situacao) return null;
  const { etapa, execucao, url } = situacao;
  let frase = TEXTO_DA_ETAPA[etapa] || "";
  if (etapa === "recusado") frase = situacao.texto;
  if (etapa === "github" && situacao.semRegistro)
    frase =
      "Aceito pelo GitHub. O resultado deste modo fica no resumo da execução.";
  return (
    <div
      className={`robos-acompanhamento robos-acompanhamento--${etapa}`}
      role="status"
      aria-live="polite"
      data-tour="robos-acompanhamento"
    >
      <div className="robos-acompanhamento__topo">
        <Icone
          nome={
            etapa === "terminou" || (etapa === "github" && situacao.semRegistro)
              ? "circle-check"
              : etapa === "recusado"
                ? "circle-alert"
                : "refresh-cw"
          }
          tamanho={14}
        />
        <strong>{frase}</strong>
        {execucao && etapa === "terminou" ? (
          <SeloDaExecucao situacao={execucao.situacao} />
        ) : null}
        <LinkDoGithub url={url} />
        <button
          type="button"
          className="robos-acompanhamento__fechar"
          aria-label="Dispensar o acompanhamento"
          title="Dispensar"
          onClick={() => estado.dispensarAcompanhamento(robo.id)}
        >
          ×
        </button>
      </div>
      {pedido.frase ? (
        <small className="robos-acompanhamento__pedido">
          Pedido às {dataHora(pedido.em)}: {pedido.frase}
        </small>
      ) : null}
      {execucao ? (
        <>
          <small className="robos-acompanhamento__resultado">
            {execucao.resultado}
            {execucao.mensagem ? ` · ${execucao.mensagem}` : ""}
          </small>
          <ResultadoPorVaga porVaga={execucao.porVaga} />
        </>
      ) : null}
    </div>
  );
}

/** As últimas execuções do robô, com parâmetros e quem pediu. */
export function UltimasExecucoes({ execucoes }) {
  if (!execucoes?.length)
    return <p className="saude-parte__vazio">Nenhuma execução registrada.</p>;
  return (
    <div
      className="saude-historico robos-execucoes"
      data-tour="robos-execucoes"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Início</th>
            <th scope="col">Quem pediu</th>
            <th scope="col">Parâmetros</th>
            <th scope="col">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {execucoes.map((e) => (
            <Fragment key={e.id || e.inicio?.toISOString()}>
              <tr data-execucao={e.id || undefined}>
                <td>{dataHora(e.inicio)}</td>
                <td>{e.quem}</td>
                <td className="robos-execucoes__parametros">
                  {e.parametros.texto}
                </td>
                <td className="robos-execucoes__resultado">
                  <SeloDaExecucao situacao={e.situacao} />{" "}
                  <span>{e.resultado}</span> <LinkDoGithub url={e.execucao} />
                  {e.mensagem ? (
                    <small className="robos-por-vaga__mensagem">
                      {e.mensagem}
                    </small>
                  ) : null}
                </td>
              </tr>
              {e.porVaga.length ? (
                <tr className="robos-execucoes__linha-das-vagas">
                  <td colSpan={4}>
                    <details className="robos-execucoes__vagas">
                      <summary>Por vaga ({e.porVaga.length})</summary>
                      <ResultadoPorVaga porVaga={e.porVaga} />
                    </details>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
