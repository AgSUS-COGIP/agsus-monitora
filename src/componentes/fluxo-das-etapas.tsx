import { useSyncExternalStore } from "react";
import { abrirTelaDoEdital } from "../app/abrir-tela-do-edital.ts";
import { numeroDoEdital } from "../lib/editais/numero-do-edital.ts";
import {
  etapasDoFluxo,
  tituloDoFluxo,
  type EditalDoFluxo,
} from "../lib/navegacao/fluxo-das-etapas.ts";
import { telaPermitida } from "../lib/navegacao/navegacao";
import {
  assinarDadosDoMonitoramento,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "./dados-do-monitoramento.ts";
import "./fluxo-das-etapas.css";

/*
  A faixa das etapas, no cabeçalho das telas do processo seletivo: "Documental
  do 93/2026" e os atalhos para as outras etapas do mesmo edital (Triagem ·
  Documental · Recursos · Entrevistas · Classificação · Aprovados), a atual
  marcada (aria-current="step"). O edital (e a vaga, onde a tela recorta por
  vaga) segue junto: o destino é o da aba "Candidatos" da página do edital
  (src/app/abrir-tela-do-edital.ts). A regra é
  src/lib/navegacao/fluxo-das-etapas.ts.

  A tela passa o que tem (o id do monitoramento, o número ou os dois); o que
  falta sai das linhas do monitoramento, se já carregadas.
*/

export interface PropriedadesDoFluxoDasEtapas {
  /** A tela atual (`view`). */
  view: string;
  edital: EditalDoFluxo;
  /** O código da vaga escolhida (só segue para as telas com vaga). */
  vaga?: string;
}

const texto = (valor: unknown) => String(valor ?? "").trim();

/* O id e o número, completando um pelo outro nas linhas da área. */
function usarEditalCompleto(edital: EditalDoFluxo): {
  id: string;
  numero: string;
} {
  const dados = useSyncExternalStore(
    assinarDadosDoMonitoramento,
    obterDadosDoMonitoramento,
    obterDadosDoMonitoramento,
  );
  const id = texto(edital.id);
  const numero = numeroDoEdital(edital.numero);
  if (id && numero) return { id, numero };
  const linhas = linhasDaArea(dados.linhas, dados.areaAtual);
  const linha = id
    ? linhas.find((l) => texto(l.id) === id)
    : numero
      ? linhas.find((l) => numeroDoEdital(l.edital) === numero)
      : undefined;
  return {
    id: id || texto(linha?.id),
    numero: numero || numeroDoEdital(linha?.edital),
  };
}

export function FluxoDasEtapas({
  view,
  edital,
  vaga = "",
}: PropriedadesDoFluxoDasEtapas) {
  const { id, numero } = usarEditalCompleto(edital);
  if (!id && !numero) return null;
  const perfil = window.getMonitoraProfile?.() ?? null;
  const etapas = etapasDoFluxo(
    (destino) => destino === view || telaPermitida(destino, perfil),
  );
  const codigo = texto(vaga);
  return (
    <nav className="fluxo-das-etapas" aria-label="Etapas do edital">
      <p className="fluxo-das-etapas-titulo">
        <strong>{tituloDoFluxo(view, numero)}</strong>
        {codigo ? (
          <span className="fluxo-das-etapas-vaga">vaga {codigo}</span>
        ) : null}
      </p>
      <ol className="fluxo-das-etapas-lista">
        {etapas.map((etapa) => (
          <li key={etapa.view}>
            {etapa.view === view ? (
              <span
                className="fluxo-das-etapas-etapa"
                data-etapa={etapa.view}
                aria-current="step"
              >
                {etapa.curto}
              </span>
            ) : (
              <button
                type="button"
                className="fluxo-das-etapas-etapa"
                data-etapa={etapa.view}
                title={`${etapa.rotulo} do ${numero || "edital"}`}
                disabled={etapa.como === "numero" ? !numero : !id}
                onClick={() => abrirTelaDoEdital(etapa, { id, numero }, codigo)}
              >
                {etapa.curto}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
