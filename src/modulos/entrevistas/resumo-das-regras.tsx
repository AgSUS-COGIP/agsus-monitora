import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  resumoDasRegrasDaEntrevista,
  type BlocoDoResumo,
  type DestinoDoResumo,
  type EntradaDoResumo,
} from "../../lib/resumo-da-entrevista.ts";
import { Aviso } from "../../ui/index.js";

/*
  O resumo das regras da entrevista no topo de Conduzir › Preparar, em
  linguagem simples (as frases são de src/lib/resumo-da-entrevista.ts, a
  partir da regra da Classificação, do roteiro e da banca do edital): quem é
  chamado (com a tabelinha por vaga), como a nota é calculada, quem avalia e
  o desempate. Cada bloco tem o botão que leva aonde aquilo se muda
  (`aoIr`: Classificação, roteiro, configuração, convocação); os detalhes
  técnicos (regra em uma linha, de onde vêm as vagas, os critérios) ficam
  atrás de "Ver detalhes".

  `podeIr(destino)`: quem não pode mudar não vê o "Editar" (sem selo
  "Somente consulta").
*/

export type PropriedadesDoResumo = {
  entrada: EntradaDoResumo;
  aoIr: (destino: DestinoDoResumo) => void;
  podeIr: (destino: DestinoDoResumo) => boolean;
  detalhes?: ReactNode;
};

const ICONES: Record<BlocoDoResumo["id"], string> = {
  convocacao: "fa-bullhorn",
  nota: "fa-clipboard-check",
  banca: "fa-users",
  desempate: "fa-scale-balanced",
};

function TabelaDasVagas({ bloco }: { bloco: BlocoDoResumo }) {
  if (!bloco.vagas?.length) return null;
  return (
    <div className="entrevistas-tabela-rolagem">
      <table className="entrevistas-tabela entrevistas-tabela-curta">
        <thead>
          <tr>
            <th scope="col">Vaga</th>
            <th scope="col">Vagas imediatas</th>
            <th scope="col">Chama até</th>
          </tr>
        </thead>
        <tbody>
          {bloco.vagas.map((v) => (
            <tr key={v.vaga} data-vaga={v.vaga}>
              <td>
                <span className="ui-texto-principal">{v.cargo || v.vaga}</span>
                {v.cargo ? (
                  <span className="entrevistas-origem-vaga">{v.vaga}</span>
                ) : null}
              </td>
              <td>{v.imediatas}</td>
              <td>{v.chamaAte}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResumoDasRegras({
  entrada,
  aoIr,
  podeIr,
  detalhes,
}: PropriedadesDoResumo) {
  const blocos = useMemo(() => resumoDasRegrasDaEntrevista(entrada), [entrada]);
  return (
    <section
      className="ui-card entrevistas-passo entrevistas-regras"
      aria-labelledby="entrevistasRegrasTitulo"
      data-tour="entrevistas-conduzir-regras"
    >
      <h2 className="ui-titulo" id="entrevistasRegrasTitulo">
        Regras da entrevista
      </h2>
      <div className="entrevistas-regras-blocos">
        {blocos.map((bloco) => {
          const acoes = bloco.acoes.filter((a) => podeIr(a.destino));
          return (
            <article
              key={bloco.id}
              className="entrevistas-regra"
              data-bloco={bloco.id}
              aria-labelledby={`entrevistasRegra-${bloco.id}`}
            >
              <div className="entrevistas-regra-topo">
                <h3 id={`entrevistasRegra-${bloco.id}`}>
                  <i
                    className={`fa-solid ${ICONES[bloco.id]}`}
                    aria-hidden="true"
                  />{" "}
                  {bloco.titulo}
                </h3>
                {acoes.length ? (
                  <span className="entrevistas-regra-acoes">
                    {acoes.map((a) => (
                      <button
                        key={a.destino}
                        type="button"
                        className="btn secondary small"
                        data-ir-para={a.destino}
                        aria-label={`${a.rotulo}: ${bloco.titulo.toLowerCase()}`}
                        onClick={() => aoIr(a.destino)}
                      >
                        {a.rotulo === "Editar" ? (
                          <i className="fa-solid fa-pen" aria-hidden="true" />
                        ) : null}{" "}
                        {a.rotulo}
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>
              {bloco.frases.map((frase) => (
                <p key={frase} className="entrevistas-regra-frase">
                  {frase}
                </p>
              ))}
              {bloco.avisos.map((aviso) => (
                <Aviso key={aviso} tom="warning">
                  {aviso}
                </Aviso>
              ))}
              <TabelaDasVagas bloco={bloco} />
            </article>
          );
        })}
      </div>
      {detalhes ? (
        <details className="entrevistas-regras-detalhes">
          <summary>Ver detalhes</summary>
          {detalhes}
        </details>
      ) : null}
    </section>
  );
}
