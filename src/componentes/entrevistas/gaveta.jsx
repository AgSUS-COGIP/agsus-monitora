import { formatNumberBR } from "../../lib/formatters.js";
import {
  agruparAprovadosSemEntrevista,
  formatarNota,
  NOTA_MAXIMA,
  NOTA_MAXIMA_DO_CRITERIO,
  rotuloDoComparecimento,
  rotuloDoParecer,
} from "../../lib/entrevistas-do-painel.js";
import { Modal } from "../modal.jsx";
import { Kv, Secao, TopoDaGaveta } from "../recursos/partes.jsx";
import { SeloDoParecer } from "./tabela.jsx";

/*
  Gavetas do painel de entrevistas, com o desenho da gaveta do painel de
  análises (`.analises-drawer-backdrop` > `.analises-drawer`): o detalhe de uma
  entrevista (o caminho Análise curricular → Entrevista → Recurso, a nota de
  cada critério e o link da planilha) e a lista dos aprovados na análise sem
  entrevista registrada. Tudo em JSX, com texto — nada de HTML vindo dos dados.
*/

const ROTULO_DA_LIGACAO = {
  codigo: "pelo código do candidato",
  nome: "pelo nome do candidato",
};

/* Só http(s): o link vem da planilha. */
function linkSeguro(valor) {
  try {
    const url = new URL(String(valor ?? ""));
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function Caminho({ entrevista: e }) {
  const etapas = [
    {
      chave: "analise",
      rotulo: "Análise curricular",
      valor: e.analise
        ? `${formatarNota(e.analise.nota)} · ${e.analise.resultado || "—"}`
        : "Sem análise ligada",
      feita: Boolean(e.analise),
    },
    {
      chave: "entrevista",
      rotulo: "Entrevista",
      valor: `${formatarNota(e.nota)} · ${rotuloDoParecer(e.parecer)}`,
      feita: true,
    },
    {
      chave: "recurso",
      rotulo: "Recurso",
      valor: "Consulte a aba Recursos",
      feita: false,
    },
  ];
  return (
    <ol className="entrevistas-caminho" aria-label="Caminho do candidato">
      {etapas.map((etapa) => (
        <li
          key={etapa.chave}
          className={etapa.feita ? "is-feita" : undefined}
          data-etapa={etapa.chave}
        >
          <small>{etapa.rotulo}</small>
          <strong>{etapa.valor}</strong>
        </li>
      ))}
    </ol>
  );
}

function BarraDoCriterio({ nota }) {
  const parte = Math.max(0, Math.min(1, nota / NOTA_MAXIMA_DO_CRITERIO));
  return (
    <span className="entrevistas-barra" aria-hidden="true">
      <span style={{ width: `${Math.round(parte * 100)}%` }} />
    </span>
  );
}

export function GavetaDaEntrevista({ entrevista: e, aoFechar }) {
  const link = linkSeguro(e.link);
  return (
    <Modal
      id="entrevistasGaveta"
      rotuloId="entrevistasGavetaTitulo"
      aoFechar={aoFechar}
      className="analises-drawer-backdrop entrevistas-gaveta"
      cartaoClassName="analises-drawer"
    >
      <TopoDaGaveta
        sobretitulo={e.codigo ? `Candidato · cód. ${e.codigo}` : "Candidato"}
        titulo={e.candidato}
        tituloId="entrevistasGavetaTitulo"
        rotuloDoFechar="Fechar detalhe"
        aoFechar={aoFechar}
        resumo={
          <>
            <span className="status">
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              {rotuloDoParecer(e.parecer)}
            </span>
            <span>
              <i className="fa-solid fa-user-check" aria-hidden="true" />
              Compareceu: {rotuloDoComparecimento(e.compareceu)}
            </span>
            {e.divergente ? <span>Nota divergente</span> : null}
            {e.semEdital ? <span>Sem edital cadastrado</span> : null}
          </>
        }
      />
      <div className="analises-drawer-context">
        <div>
          <small>Edital</small>
          <strong>{e.edital || "—"}</strong>
        </div>
        <div>
          <small>Unidade</small>
          <strong>{e.unidade || "—"}</strong>
        </div>
        <div>
          <small>Vaga</small>
          <strong>
            {[e.vaga, e.cargo].filter(Boolean).join(" · ") || "—"}
          </strong>
        </div>
        <div>
          <small>Modalidade</small>
          <strong>{e.modalidade || "—"}</strong>
        </div>
      </div>

      <div id="analisesDrawerBody">
        <div className="detail-shell">
          <Caminho entrevista={e} />

          <Secao
            icone="fa-file-lines"
            titulo="Análise curricular"
            secao="analise"
          >
            {e.analise ? (
              <div className="analises-detail-section-grid">
                <Kv rotulo="Nota da análise">{formatarNota(e.analise.nota)}</Kv>
                <Kv rotulo="Resultado">{e.analise.resultado}</Kv>
                <Kv rotulo="Etapa">{e.analise.etapa}</Kv>
                <Kv rotulo="Responsável">{e.analise.responsavel}</Kv>
                <Kv rotulo="Ligação">
                  {ROTULO_DA_LIGACAO[e.analise.ligacao] || e.analise.ligacao}
                </Kv>
                {e.analise.ativo ? null : (
                  <Kv rotulo="Situação">Análise inativa</Kv>
                )}
              </div>
            ) : (
              <div className="analises-detail-analysis">
                <span className="analises-detail-empty">
                  Nenhuma análise curricular ligada a esta entrevista.
                </span>
              </div>
            )}
          </Secao>

          <Secao icone="fa-comments" titulo="Entrevista" secao="entrevista">
            <div className="analises-detail-section-grid">
              <Kv rotulo="Nota total">
                {e.nota === null
                  ? ""
                  : `${formatarNota(e.nota)} / ${formatNumberBR(NOTA_MAXIMA)}`}
              </Kv>
              <Kv rotulo="Parecer">
                <SeloDoParecer parecer={e.parecer} />
              </Kv>
              <Kv rotulo="Compareceu">
                {rotuloDoComparecimento(e.compareceu)}
              </Kv>
              {e.somaDasNotas !== null ? (
                <Kv rotulo="Soma dos critérios">
                  <span
                    className={e.divergente ? "entrevistas-divergente" : ""}
                  >
                    {formatarNota(e.somaDasNotas)}
                  </span>
                </Kv>
              ) : null}
              <Kv rotulo="Edital na planilha">{e.edital_planilha}</Kv>
            </div>
            {e.notas.length ? (
              <ul className="entrevistas-criterios">
                {e.notas.map((n) => (
                  <li key={n.indice} title={n.criterio}>
                    <span className="entrevistas-criterio-rotulo">
                      {n.curto}
                    </span>
                    <BarraDoCriterio nota={n.nota} />
                    {/* Critério fora da escala 0–5 (planilha mal lida): a nota, sem o "/ 5". */}
                    <b>
                      {formatarNota(n.nota)}
                      {n.nota <= NOTA_MAXIMA_DO_CRITERIO
                        ? ` / ${formatNumberBR(NOTA_MAXIMA_DO_CRITERIO)}`
                        : ""}
                    </b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="analises-detail-empty">
                Sem notas por critério na planilha.
              </p>
            )}
            {link ? (
              <p className="entrevistas-link">
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <i
                    className="fa-solid fa-arrow-up-right-from-square"
                    aria-hidden="true"
                  />{" "}
                  Abrir planilha da entrevista
                </a>
              </p>
            ) : null}
          </Secao>
        </div>
      </div>
    </Modal>
  );
}

export function GavetaDosSemEntrevista({ aprovados, aoFechar }) {
  const grupos = agruparAprovadosSemEntrevista(aprovados);
  return (
    <Modal
      id="entrevistasSemEntrevista"
      rotuloId="entrevistasSemEntrevistaTitulo"
      aoFechar={aoFechar}
      className="analises-drawer-backdrop entrevistas-gaveta"
      cartaoClassName="analises-drawer"
    >
      <TopoDaGaveta
        sobretitulo="Pendência"
        titulo="Aprovados na análise sem entrevista registrada"
        tituloId="entrevistasSemEntrevistaTitulo"
        rotuloDoFechar="Fechar lista"
        aoFechar={aoFechar}
        resumo={
          <span>
            <i className="fa-solid fa-user-clock" aria-hidden="true" />
            {formatNumberBR(aprovados.length)}{" "}
            {aprovados.length === 1 ? "candidato" : "candidatos"} em{" "}
            {formatNumberBR(grupos.length)}{" "}
            {grupos.length === 1 ? "vaga" : "vagas"}
          </span>
        }
      />
      <div id="analisesDrawerBody">
        <div className="detail-shell">
          {grupos.length ? (
            grupos.map((g) => (
              <Secao
                key={g.chave}
                icone="fa-briefcase"
                titulo={[g.edital, g.vaga && `Vaga ${g.vaga}`]
                  .filter(Boolean)
                  .join(" · ")}
                secao="sem-entrevista"
              >
                <p className="analises-detail-empty">
                  {[g.cargo, g.unidade].filter(Boolean).join(" · ")}
                </p>
                <ul className="entrevistas-sem-entrevista">
                  {g.candidatos.map((a, indice) => (
                    <li key={a.analise_id ?? `${g.chave}-${indice}`}>
                      <span>
                        <strong>{a.candidato}</strong>
                        <small>
                          {[a.codigo && `Cód. ${a.codigo}`, a.modalidade]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      <b title="Nota da análise">{formatarNota(a.nota)}</b>
                    </li>
                  ))}
                </ul>
              </Secao>
            ))
          ) : (
            <div className="empty">
              Nenhum aprovado na análise sem entrevista no recorte atual.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
