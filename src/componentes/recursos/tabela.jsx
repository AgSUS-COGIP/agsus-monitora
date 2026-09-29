import { useEffect, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  ETAPAS,
  rotuloDaOrigem,
  rotuloDaSituacao,
  tomDaSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { classes } from "./paineis.jsx";

/*
  A tabela da aba Recursos. Clique na linha (ou Enter) abre a gaveta de
  detalhe. Mostra 50 por vez e "Mostrar mais": a fila de recursos de uma área é
  de centenas, não de milhares. Abaixo de 900px vira cartões
  (`mobile-table-cards.js`, pelo aviso `agsus:content-updated`).
*/

const POR_VEZ = 50;
const COLUNAS = 9;

export function dataBR(valor) {
  const texto = String(valor ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? texto.split("-").reverse().join("/")
    : "";
}

export function SeloDaSituacao({ situacao }) {
  return (
    <span className="recursos-selo" data-tone={tomDaSituacao(situacao)}>
      {rotuloDaSituacao(situacao)}
    </span>
  );
}

/* Prazo com o destaque de atraso: vencido (vermelho), vence em até 2 dias (âmbar). */
export function Prazo({ recurso }) {
  const { prazo, diasParaPrazo, atrasado, etapas } = recurso;
  if (!prazo.data)
    return (
      <span className="recursos-prazo" data-tone="neutral">
        Não encontrado
      </span>
    );
  const respondido = etapas.resposta_candidato;
  const tom = atrasado
    ? "danger"
    : !respondido && diasParaPrazo <= 2
      ? "warning"
      : "neutral";
  const detalhe = respondido
    ? "respondido"
    : atrasado
      ? `vencido há ${formatNumberBR(-diasParaPrazo)} ${diasParaPrazo === -1 ? "dia" : "dias"}`
      : diasParaPrazo === 0
        ? "vence hoje"
        : `em ${formatNumberBR(diasParaPrazo)} ${diasParaPrazo === 1 ? "dia" : "dias"}`;
  return (
    <span
      className="recursos-prazo"
      data-tone={tom}
      title={prazo.aviso || prazo.atividade}
    >
      {dataBR(prazo.data)}
      {prazo.fonte === "abertura" ? "*" : ""}
      <small>{detalhe}</small>
    </span>
  );
}

export function MarcasDasEtapas({ etapas }) {
  return (
    <span
      className="recursos-etapas"
      aria-label={`${ETAPAS.filter((e) => etapas[e.id]).length} de ${ETAPAS.length} etapas`}
    >
      {ETAPAS.map((etapa) => (
        <span
          key={etapa.id}
          className={classes(
            "recursos-etapa-marca",
            etapas[etapa.id] && "is-feita",
          )}
          title={`${etapa.rotulo}: ${etapas[etapa.id] ? "feito" : "pendente"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function TabelaDeRecursos({
  recursos,
  total,
  origens,
  carregado,
  podeEditar,
  aoAbrir,
  aoNovo,
}) {
  const [limite, setLimite] = useState(POR_VEZ);
  useEffect(() => setLimite(POR_VEZ), [recursos]);
  const visiveis = recursos.slice(0, limite);

  useEffect(() => {
    if (carregado)
      document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [carregado, visiveis]);

  return (
    <div className="table-card card recursos-tabela-card">
      <div className="table-head">
        <h3>
          <i className="fa-solid fa-table-list" aria-hidden="true" /> Recursos
        </h3>
        <span className="chip blue" id="recursosContagem">
          {carregado
            ? recursos.length === total
              ? `${formatNumberBR(total)} ${total === 1 ? "recurso" : "recursos"}`
              : `${formatNumberBR(recursos.length)} de ${formatNumberBR(total)}`
            : "Carregando…"}
        </span>
      </div>
      <div className="table-wrap recursos-tabela-rolagem">
        <table className="recursos-tabela">
          <thead>
            <tr>
              <th scope="col" className="num">
                Nº
              </th>
              <th scope="col">Candidato</th>
              <th scope="col">Edital</th>
              <th scope="col">Origem</th>
              <th scope="col">Analista</th>
              <th scope="col">Situação</th>
              <th scope="col">Etapas</th>
              <th scope="col">Prazo</th>
              <th scope="col" className="num">
                Dias em aberto
              </th>
            </tr>
          </thead>
          <tbody>
            {!carregado ? (
              Array.from({ length: 6 }, (_, linha) => (
                <tr
                  key={linha}
                  className="esqueleto-da-tabela"
                  aria-hidden="true"
                >
                  {Array.from({ length: COLUNAS }, (_, coluna) => (
                    <td key={coluna}>
                      <span className="esqueleto" />
                    </td>
                  ))}
                </tr>
              ))
            ) : visiveis.length ? (
              visiveis.map((r) => (
                <tr
                  key={r.id}
                  className={classes(
                    "recursos-linha",
                    r.atrasado && "is-atrasado",
                  )}
                  tabIndex={0}
                  onClick={() => aoAbrir(r.id)}
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter" || evento.key === " ") {
                      evento.preventDefault();
                      aoAbrir(r.id);
                    }
                  }}
                  aria-label={`Recurso nº ${r.nu} de ${r.candidato}: abrir detalhe`}
                >
                  <td className="num">{r.nu}</td>
                  <td>
                    <span className="recursos-candidato">
                      <b>{r.candidato}</b>
                      <small>
                        {[
                          r.codigo && `Cód. ${r.codigo}`,
                          r.vaga && `Vaga ${r.vaga}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      {r.fora_analise ? (
                        <span className="recursos-marca-fora">
                          Fora das análises
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <span className="recursos-candidato">
                      <b>{r.edital}</b>
                      <small>{r.unidade}</small>
                    </span>
                  </td>
                  <td>{rotuloDaOrigem(r.origem, origens)}</td>
                  <td>
                    {r.analista || (
                      <span className="recursos-sem">Sem analista</span>
                    )}
                  </td>
                  <td>
                    <SeloDaSituacao situacao={r.situacao} />
                  </td>
                  <td>
                    <MarcasDasEtapas etapas={r.etapas} />
                  </td>
                  <td>
                    <Prazo recurso={r} />
                  </td>
                  <td className="num">{r.diasEmAberto ?? ""}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUNAS} className="recursos-vazio-tabela">
                  {total ? (
                    "Nenhum recurso com estes filtros."
                  ) : (
                    <>
                      Nenhum recurso cadastrado nesta área.{" "}
                      {podeEditar ? (
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={aoNovo}
                        >
                          <i className="fa-solid fa-plus" aria-hidden="true" />{" "}
                          Cadastrar o primeiro
                        </button>
                      ) : null}
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {carregado && recursos.length > limite ? (
        <div className="recursos-mais">
          <button
            type="button"
            className="btn secondary"
            onClick={() => setLimite((n) => n + POR_VEZ)}
          >
            Mostrar mais ({formatNumberBR(recursos.length - limite)} restantes)
          </button>
        </div>
      ) : null}
      {carregado && recursos.some((r) => r.prazo.fonte === "abertura") ? (
        <p className="recursos-nota">
          * O cronograma não traz a resposta aos recursos; o prazo é o fim do
          prazo de recurso.
        </p>
      ) : null}
    </div>
  );
}
