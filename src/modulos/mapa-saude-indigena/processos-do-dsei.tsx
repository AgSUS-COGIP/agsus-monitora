import { useMemo } from "react";
import type { LinhaDoMonitoramento } from "../../componentes/tipos-do-monitoramento.ts";
import { processosDoDsei } from "../../lib/mapas/mapa-saude-indigena/processos-do-dsei.ts";
import type { DseiDoMapa } from "../../lib/mapas/mapa-saude-indigena/tipos.ts";
import { situacaoDoIndicador } from "../../lib/visao-geral/indicadores-do-monitoramento.ts";

/*
  "Processos seletivos" no painel do DSEI: editais abertos, vagas,
  contratadas, em seleção, ociosas e aguardando chamada do distrito, pelas
  contas da Visão geral (`processosDoDsei`). "Abrir na Visão geral" leva a
  Visão geral filtrada pelas unidades do DSEI (o filtro Unidade). Não depende
  do SIGEPSI.
*/

const formatar = (n: number) => n.toLocaleString("pt-BR");

export interface PropsDosProcessosDoDsei {
  dsei: DseiDoMapa;
  linhas: readonly LinhaDoMonitoramento[];
  aoAbrirNaVisaoGeral?(unidades: string[]): void;
}

export function ProcessosDoDsei({
  dsei,
  linhas,
  aoAbrirNaVisaoGeral,
}: PropsDosProcessosDoDsei) {
  const p = useMemo(() => processosDoDsei(linhas, dsei.k), [linhas, dsei.k]);
  const k = p.indicadores;
  const titulo = `mapa-si-processos-${dsei.k.replace(/\W+/g, "-")}`;
  const valor = (chave: "emSelecao" | "ociosas") => {
    const s = situacaoDoIndicador(k, chave);
    return s.tipo === "valor"
      ? { texto: formatar(s.valor), titulo: undefined }
      : { texto: "—", titulo: s.motivo };
  };
  const numeros: { rotulo: string; texto: string; titulo?: string }[] = [
    { rotulo: "Editais abertos", texto: formatar(p.editaisAbertos) },
    { rotulo: "Vagas", texto: formatar(k.vagas) },
    { rotulo: "Contratadas", texto: formatar(k.contratadas) },
    { rotulo: "Em seleção", ...valor("emSelecao") },
    { rotulo: "Ociosas", ...valor("ociosas") },
    {
      rotulo: "Aguardando chamada",
      texto: p.aguardandoChamada === null ? "—" : formatar(p.aguardandoChamada),
      ...(p.aguardandoChamada === null
        ? { titulo: "sem lista de aprovados nos editais" }
        : {}),
    },
  ];
  return (
    <section
      className="mapa-si-resumo mapa-si-processos"
      aria-labelledby={titulo}
    >
      <div className="mapa-si-resumo__introducao">
        <h2 id={titulo}>Processos seletivos</h2>
        {p.unidades.length && aoAbrirNaVisaoGeral ? (
          <button
            type="button"
            className="btn secondary small"
            onClick={() => aoAbrirNaVisaoGeral(p.unidades)}
          >
            Abrir na Visão geral
          </button>
        ) : null}
      </div>
      {k.processos ? (
        <dl className="mapa-si-resumo__indicadores mapa-si-processos__numeros">
          {numeros.map((n) => (
            <div key={n.rotulo} title={n.titulo}>
              <dt>{n.rotulo}</dt>
              <dd>{n.texto}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Nenhum edital acompanhado neste DSEI.</p>
      )}
    </section>
  );
}
