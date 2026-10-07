import type { ReactNode } from "react";
import { PARCIAL_DO_TIPO as PARCIAIS_DOS_TIPOS } from "../../../lib/avaliacao-documental/catalogo.js";
import {
  ACOES_DO_HISTORICO as ACOES,
  textoDaAlteracao,
  textoDaNota,
} from "../../../lib/avaliacao-documental/ficha.js";
import { ResumoDaNota } from "./resumo-da-nota.tsx";
import type { PropriedadesDoResumo } from "./resumo-da-nota.tsx";
import { Chips } from "./item-da-ficha.tsx";
import type { Bloco, EstadoDaFicha, Mudar, Passo } from "./tipos.ts";

/*
  A etapa final do modo foco: o resumo de todos os itens (ícone do estado,
  clicável para voltar), a nota final grande com a composição, observações
  prontas e observação, a prévia do parecer (sem resultado enquanto falta
  conferir) e o histórico. Concluir e próxima / Salvar rascunho ficam no
  rodapé fixo. Na ficha concluída, o parecer gravado.
*/

const PARCIAL_DO_TIPO = PARCIAIS_DOS_TIPOS as Readonly<
  Record<string, string | undefined>
>;
const ACOES_DO_HISTORICO = ACOES as Readonly<
  Record<string, string | undefined>
>;

const ICONE: Record<string, string> = {
  CONFORME: "fa-check",
  NAO_CONFORME: "fa-xmark",
  NAO_ENVIADO: "fa-ban",
  pendencia: "fa-circle-exclamation",
  nao_conferido: "fa-circle",
  opcional: "fa-circle",
};
const ESTADO: Record<string, string> = {
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
  NAO_ENVIADO: "Não enviado",
  pendencia: "Falta completar",
  nao_conferido: "Não conferido",
  opcional: "Opcional",
};

export type ItemDoHistorico = {
  versao: number;
  acao: string;
  quando: string;
  por?: string | null;
  motivo?: string | null;
  alteracao?: unknown[];
};

export type Previa = { completa: boolean; texto: string; motivos: string[] };

export type PropriedadesDaConclusao = {
  st: EstadoDaFicha;
  passos: Passo[];
  blocos: Bloco[];
  naoSeAplicam: string[];
  aoIr: (codigo: string) => void;
  nota: PropriedadesDoResumo;
  previa: Previa;
  concluida: boolean;
  desabilitado: boolean;
  mudar: Mudar;
  aoCopiarParecer: () => void;
  historico: ItemDoHistorico[];
  /** Blocos que só registram (sem decisão), já desenhados. */
  registros?: ReactNode;
};

/* O detalhe de cada linha do resumo: motivos, pontos apurados ou o que falta. */
function detalhe(st: EstadoDaFicha, bloco: Bloco, passo: Passo): string {
  const lancado = st.lancamento.blocos?.[bloco.codigo] || {};
  const partes: string[] = [];
  for (const codigo of lancado.motivos || []) {
    const m = (bloco.motivos || []).find((x) => x.codigo === codigo);
    if (m) partes.push(m.texto);
  }
  if (lancado.motivo_livre?.trim()) partes.push(lancado.motivo_livre.trim());
  const parcial = PARCIAL_DO_TIPO[bloco.tipo];
  if (parcial && lancado.situacao)
    partes.push(`${textoDaNota(st.avaliacao.parciais?.[parcial] ?? 0)} pontos`);
  if (passo.estado === "pendencia") {
    const falta = st.pendencias
      .filter((p) => p.bloco === bloco.codigo && p.tipo !== "situacao")
      .map((p) => p.texto);
    partes.push(...falta);
  }
  return partes.join(" · ");
}

function Historico({ itens }: { itens: ItemDoHistorico[] }) {
  if (!itens.length) return null;
  return (
    <details
      className="ui-card avd-ficha-historico"
      data-tour="avd-ficha-historico"
    >
      <summary>Histórico ({itens.length})</summary>
      <ol>
        {itens.map((h) => (
          <li key={`${h.versao}-${h.acao}-${h.quando}`}>
            <span>
              {new Date(h.quando).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>{" "}
            <strong>{ACOES_DO_HISTORICO[h.acao] || h.acao}</strong>
            {h.por ? ` · ${h.por}` : ""}
            {h.motivo ? ` · ${h.motivo}` : ""}
            {(h.alteracao || []).length ? (
              <ul>
                {(h.alteracao || []).map((a, i) => (
                  <li key={i}>{textoDaAlteracao(a)}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function ConclusaoDaFicha({
  st,
  passos,
  blocos,
  naoSeAplicam,
  aoIr,
  nota,
  previa,
  concluida,
  desabilitado,
  mudar,
  aoCopiarParecer,
  historico,
  registros,
}: PropriedadesDaConclusao) {
  const { lancamento } = st;
  const regra = st.dados.regra.configuracao;
  const prontas = regra.observacoes_prontas || [];
  const itens = passos.filter((p) => p.codigo !== "CONCLUSAO");
  return (
    <section
      className="avd-ficha-conclusao"
      data-bloco="CONCLUSAO"
      aria-labelledby="avdConclusaoTitulo"
      tabIndex={-1}
      data-tour="avd-ficha-conclusao"
    >
      <div className="avd-ficha-conclusao-grade">
        <div className="ui-card avd-ficha-resumo" data-tour="avd-ficha-resumo">
          <h3 id="avdConclusaoTitulo">
            {concluida ? "Análise concluída" : "Conclusão"}
          </h3>
          <ul className="avd-ficha-resumo-lista">
            {itens.map((p) => {
              const bloco = blocos.find((b) => b.codigo === p.codigo);
              if (!bloco) return null;
              const texto = detalhe(st, bloco, p);
              return (
                <li key={p.codigo}>
                  <button
                    type="button"
                    className="avd-ficha-resumo-item"
                    data-resumo={p.codigo}
                    data-estado={p.estado}
                    onClick={() => aoIr(p.codigo)}
                  >
                    <span className="avd-ficha-resumo-marca" aria-hidden="true">
                      <i
                        className={`fa-solid ${ICONE[p.estado] || "fa-circle"}`}
                      />
                    </span>
                    <span className="avd-ficha-resumo-texto">
                      <strong>{bloco.titulo}</strong>
                      {texto ? <small>{texto}</small> : null}
                    </span>
                    <span className="avd-ficha-resumo-estado">
                      {ESTADO[p.estado] || ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {naoSeAplicam.length ? (
            <p
              className="avd-ficha-nao-se-aplicam-linha"
              data-tour="avd-ficha-nao-se-aplicam"
            >
              Não se aplicam: {naoSeAplicam.join(", ")}
            </p>
          ) : null}
          {registros}
        </div>
        <ResumoDaNota {...nota} grande />
      </div>
      <div className="avd-ficha-conclusao-grade">
        <div
          className="ui-card avd-ficha-observacoes"
          data-tour="avd-ficha-observacoes"
        >
          {prontas.length ? (
            <Chips
              rotulo="Observações prontas"
              opcoes={prontas.map((o) => ({
                codigo: o.codigo,
                texto: o.rotulo || o.texto,
              }))}
              marcados={lancamento.observacoes_prontas || []}
              desabilitado={desabilitado}
              aoMudar={(observacoes_prontas) =>
                mudar((l) => {
                  l.observacoes_prontas = observacoes_prontas;
                  return l;
                })
              }
            />
          ) : null}
          <label className="avd-ficha-campo">
            <span className="avd-ficha-rotulo">Observação</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={lancamento.observacoes || ""}
              disabled={desabilitado}
              onChange={(ev) =>
                mudar((l) => {
                  l.observacoes = ev.target.value;
                  return l;
                })
              }
            />
          </label>
        </div>
        <div
          className="ui-card avd-ficha-parecer"
          data-tour="avd-ficha-parecer"
        >
          <div className="avd-ficha-parecer-topo">
            <strong>
              Parecer
              {!concluida && !previa.completa ? (
                <small className="avd-ficha-parcial"> (prévia)</small>
              ) : null}
            </strong>
            {previa.completa ? (
              <button
                type="button"
                className="btn secondary small"
                onClick={aoCopiarParecer}
              >
                <i className="fa-regular fa-copy" aria-hidden="true" /> Copiar
                parecer
              </button>
            ) : null}
          </div>
          {previa.completa ? (
            <pre>{previa.texto}</pre>
          ) : (
            <div className="avd-ficha-parecer-previa">
              <p>{previa.texto}</p>
              {previa.motivos.length ? (
                <ul>
                  {previa.motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <Historico itens={historico} />
    </section>
  );
}
