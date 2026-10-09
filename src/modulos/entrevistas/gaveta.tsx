import type {
  EntrevistaDoPainel,
  AprovadoSemEntrevista,
} from "./tipos-do-painel.ts";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  agruparAprovadosSemEntrevista,
  formatarNota,
  NOTA_MAXIMA,
  NOTA_MAXIMA_DO_CRITERIO,
  rotuloDoComparecimento,
  rotuloDoParecer,
} from "../../lib/entrevistas-do-painel.js";
import { EstadoVazio, Gaveta, GradeDeKv, Kv, Secao } from "../../ui/index.js";
import { SeloDoParecer } from "./tabela.tsx";

/*
  Gavetas da visão "Resultados" (a Gaveta de src/ui/, encostada à direita): o
  detalhe de uma entrevista (o caminho Análise curricular → Entrevista →
  Recurso, a nota de cada critério e o link da planilha) e a lista dos
  aprovados na análise sem entrevista registrada. Tudo em JSX, com texto —
  nada de HTML vindo dos dados.
*/

const ROTULO_DA_LIGACAO: Record<string, string> = {
  codigo: "pelo código do candidato",
  nome: "pelo nome do candidato",
};

/* Só http(s): o link vem da planilha. */
function linkSeguro(valor: unknown) {
  try {
    const url = new URL(String(valor ?? ""));
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function Caminho({ entrevista: e }: { entrevista: EntrevistaDoPainel }) {
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

function BarraDoCriterio({ nota }: { nota: number }) {
  const parte = Math.max(0, Math.min(1, nota / NOTA_MAXIMA_DO_CRITERIO));
  return (
    <span className="entrevistas-barra" aria-hidden="true">
      <span style={{ width: `${Math.round(parte * 100)}%` }} />
    </span>
  );
}

export function GavetaDaEntrevista({
  entrevista: e,
  aoFechar,
}: {
  entrevista: EntrevistaDoPainel;
  aoFechar(): void;
}) {
  const link = linkSeguro(e.link);
  return (
    <Gaveta
      id="entrevistasGaveta"
      tituloId="entrevistasGavetaTitulo"
      aoFechar={aoFechar}
      className="entrevistas-gaveta"
      sobretitulo={e.codigo ? `Candidato · cód. ${e.codigo}` : "Candidato"}
      titulo={e.candidato}
      rotuloDoFechar="Fechar detalhe"
      resumo={
        <>
          <span>
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
    >
      <div className="ui-gaveta-contexto">
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

      <div className="ui-gaveta-corpo">
        <Caminho entrevista={e} />

        <Secao
          icone="fa-file-lines"
          titulo="Análise curricular"
          secao="analise"
        >
          {e.analise ? (
            <GradeDeKv>
              <Kv rotulo="Nota da análise">{formatarNota(e.analise.nota)}</Kv>
              <Kv rotulo="Resultado">{e.analise.resultado}</Kv>
              <Kv rotulo="Etapa">{e.analise.etapa}</Kv>
              <Kv rotulo="Responsável">{e.analise.responsavel}</Kv>
              <Kv rotulo="Ligação">
                {e.analise.ligacao
                  ? ROTULO_DA_LIGACAO[e.analise.ligacao] || e.analise.ligacao
                  : null}
              </Kv>
              {e.analise.ativo ? null : (
                <Kv rotulo="Situação">Análise inativa</Kv>
              )}
            </GradeDeKv>
          ) : (
            <p className="ui-secao-vazio">
              Nenhuma análise curricular ligada a esta entrevista.
            </p>
          )}
        </Secao>

        <Secao icone="fa-comments" titulo="Entrevista" secao="entrevista">
          <GradeDeKv>
            <Kv rotulo="Nota total">
              {e.nota === null
                ? ""
                : `${formatarNota(e.nota)} / ${formatNumberBR(NOTA_MAXIMA)}`}
            </Kv>
            <Kv rotulo="Parecer">
              <SeloDoParecer parecer={e.parecer} />
            </Kv>
            <Kv rotulo="Compareceu">{rotuloDoComparecimento(e.compareceu)}</Kv>
            {e.somaDasNotas !== null ? (
              <Kv rotulo="Soma dos critérios">
                <span className={e.divergente ? "entrevistas-divergente" : ""}>
                  {formatarNota(e.somaDasNotas)}
                </span>
              </Kv>
            ) : null}
            <Kv rotulo="Edital na planilha">{e.edital_planilha}</Kv>
          </GradeDeKv>
          {e.notas.length ? (
            <ul className="entrevistas-criterios">
              {e.notas.map((n) => (
                <li key={n.indice} title={n.criterio}>
                  <span className="entrevistas-criterio-rotulo">{n.curto}</span>
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
            <p className="ui-secao-vazio">
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
    </Gaveta>
  );
}

export function GavetaDosSemEntrevista({
  aprovados,
  aoFechar,
}: {
  aprovados: readonly AprovadoSemEntrevista[];
  aoFechar(): void;
}) {
  const grupos = agruparAprovadosSemEntrevista(aprovados);
  return (
    <Gaveta
      id="entrevistasSemEntrevista"
      tituloId="entrevistasSemEntrevistaTitulo"
      aoFechar={aoFechar}
      className="entrevistas-gaveta"
      sobretitulo="Pendência"
      titulo="Aprovados na análise sem entrevista registrada"
      rotuloDoFechar="Fechar lista"
      resumo={
        <span>
          <i className="fa-solid fa-user-clock" aria-hidden="true" />
          {formatNumberBR(aprovados.length)}{" "}
          {aprovados.length === 1 ? "candidato" : "candidatos"} em{" "}
          {formatNumberBR(grupos.length)}{" "}
          {grupos.length === 1 ? "vaga" : "vagas"}
        </span>
      }
    >
      <div className="ui-gaveta-corpo">
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
              <p className="ui-secao-vazio">
                {[g.cargo, g.unidade].filter(Boolean).join(" · ")}
              </p>
              <ul className="entrevistas-sem-entrevista">
                {g.candidatos.map((a, indice) => (
                  <li
                    key={
                      typeof a.analise_id === "string" ||
                      typeof a.analise_id === "number"
                        ? a.analise_id
                        : `${g.chave}-${indice}`
                    }
                  >
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
          <EstadoVazio>
            Nenhum aprovado na análise sem entrevista no recorte atual.
          </EstadoVazio>
        )}
      </div>
    </Gaveta>
  );
}
