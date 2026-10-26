import { Fragment, useMemo } from "react";
import type {
  LinhaDaAnalise,
  RegistroDaAnalise,
  DetalheDaAnalise,
} from "./tipos.ts";
import {
  detalheDaAnalise,
  tomDoStatus,
} from "../../lib/analises-curriculares.ts";
import { espelhoDoDetalhe } from "../../lib/espelho-do-painel-de-analises.ts";
import { mesclarDetalhe } from "../../lib/lista-do-painel-de-analises.js";
import { linhaSemParecer } from "../../lib/textos-do-painel-de-analises.js";
import { Gaveta, GradeDeKv, Kv, Secao, Selo } from "../../ui/index.ts";
import { EspelhoNaGaveta } from "./espelho-na-gaveta.tsx";

/*
  A gaveta de um registro da fila: candidato, status e responsável no topo;
  o contexto (grupo, unidade, edital, vaga, município/UF); os links (planilha
  de origem e PDF, só http(s)); as seções de pontuação, janela oficial e
  resultado; e o parecer. O que a lista enxuta não traz chega pelo
  detalhamento (estado.abrirDetalhe): até lá, as seções são o skeleton.
  Linha publicada pela ficha concluída (o detalhe traz "espelho"): a nota e
  os critérios saem pelo espelho de nota (EspelhoNaGaveta), logo depois da
  situação, no lugar da nota final e da pontuação de cada critério.

  Tudo é texto (filhos do React): o que veio da planilha nunca vira HTML.
*/

function SecoesEsqueleto() {
  return (
    <div className="ui-gaveta-corpo" aria-busy="true">
      {[0, 1, 2].map((indice) => (
        <span
          key={indice}
          className="ui-esqueleto ui-pendencia-esqueleto"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/* O parecer (texto da planilha, como texto). Sem parecer no banco, a seção some. */
function Parecer({ linha }: { linha: RegistroDaAnalise }) {
  const texto = String(linha.analise ?? "").trim();
  if (!texto) return null;
  return (
    <Secao icone="fa-file-lines" titulo="Parecer da análise" secao="parecer">
      <p className="ui-secao-texto analises-parecer">{texto}</p>
    </Secao>
  );
}

/**
 * `linha`: a da fila; `detalhe`: `{ situacao, dados }` do estado (ou nada,
 * quando a linha já veio completa).
 */
export function GavetaDaAnalise({
  linha,
  detalhe,
  area,
  aoFechar,
  aoTentarDeNovo,
}: {
  linha: LinhaDaAnalise;
  detalhe?: DetalheDaAnalise;
  area: string;
  aoFechar(): void;
  aoTentarDeNovo(): void;
}) {
  const situacao = detalhe?.situacao;
  const completa = { ...linha };
  if (detalhe?.situacao === "pronto") {
    mesclarDetalhe(completa, detalhe.dados);
    // Sem parecer no banco: o detalhe não manda a chave, e a seção some.
    if (linhaSemParecer(completa)) completa.analise = null;
  }
  const espelho = useMemo(
    () =>
      detalhe?.situacao === "pronto" ? espelhoDoDetalhe(detalhe.dados) : null,
    [detalhe],
  );
  const d = detalheDaAnalise(completa, area, { comEspelho: Boolean(espelho) });

  return (
    <Gaveta
      id="analisesGaveta"
      tituloId="analisesGavetaTitulo"
      aoFechar={aoFechar}
      sobretitulo="Análise curricular"
      titulo={d.titulo}
      rotuloDoFechar="Fechar detalhamento"
      resumo={
        <>
          <Selo tom={tomDoStatus(d.status)}>{d.status}</Selo>
          <span>
            <i className="fa-solid fa-user-check" aria-hidden="true" />{" "}
            {d.responsavel}
          </span>
        </>
      }
    >
      {d.contexto.length ? (
        <div
          className="ui-gaveta-contexto"
          data-tour="analises-gaveta-contexto"
        >
          {d.contexto.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <small>{rotulo}</small>
              <strong>{valor}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {situacao === "carregando" ? (
        <SecoesEsqueleto />
      ) : (
        <div className="ui-gaveta-corpo" data-tour="analises-gaveta-secoes">
          {situacao === "erro" ? (
            <p className="ui-aviso" data-tone="warning" role="alert">
              Não foi possível carregar o detalhamento.{" "}
              <button
                type="button"
                className="btn secondary small"
                onClick={aoTentarDeNovo}
              >
                Tentar novamente
              </button>
            </p>
          ) : null}
          {d.origem || d.pdf ? (
            <div
              className="ui-acoes analises-links"
              data-tour="analises-gaveta-links"
            >
              {d.origem ? (
                <a
                  className="btn secondary small"
                  href={d.origem}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i
                    className="fa-solid fa-arrow-up-right-from-square"
                    aria-hidden="true"
                  />{" "}
                  Abrir origem
                </a>
              ) : null}
              {d.pdf ? (
                <a
                  className="btn secondary small"
                  href={d.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="fa-solid fa-file-pdf" aria-hidden="true" />{" "}
                  Abrir PDF
                </a>
              ) : null}
            </div>
          ) : null}
          {espelho && d.secoes[0]?.chave !== "status" ? (
            <EspelhoNaGaveta espelho={espelho} />
          ) : null}
          {d.secoes.map((secao) => (
            <Fragment key={secao.chave}>
              <Secao
                icone={secao.icone}
                titulo={secao.titulo}
                secao={secao.chave}
              >
                <GradeDeKv>
                  {secao.itens.map(([rotulo, valor]) => (
                    <Kv key={rotulo} rotulo={rotulo}>
                      {valor}
                    </Kv>
                  ))}
                </GradeDeKv>
              </Secao>
              {espelho && secao.chave === "status" ? (
                <EspelhoNaGaveta espelho={espelho} />
              ) : null}
            </Fragment>
          ))}
          <Parecer linha={completa} />
        </div>
      )}
    </Gaveta>
  );
}
