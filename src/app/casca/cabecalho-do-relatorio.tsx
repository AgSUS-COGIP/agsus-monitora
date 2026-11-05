import { usarMoldura } from "./pecas.tsx";

/*
  O cabeçalho do relatório em PDF (`exportPDF`): só na impressão
  (`.print-only`), no topo do conteúdo, com o recorte da Visão geral.
*/
export function CabecalhoDoRelatorio() {
  const { relatorio: r } = usarMoldura();
  if (!r) return null;
  const numero = (valor: number) => Number(valor || 0).toLocaleString("pt-BR");
  return (
    <div id="printReportHeader" className="print-only">
      <div
        style={{
          padding: "0 0 12px",
          borderBottom: "2px solid #003b70",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: "#003b70" }}>
          {r.titulo}
        </div>
        <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
          {`Relatório de processos seletivos · gerado em ${r.geradoEm}`}
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
          <b>Filtros:</b> {r.filtros}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#222",
            marginTop: 8,
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <span>
            <b>{numero(r.processos)}</b> processos
          </span>
          <span>
            <b>{numero(r.vagas)}</b> vagas previstas
          </span>
          <span>
            <b>{numero(r.contratados)}</b> contratações
          </span>
          <span style={{ color: "#a3322b" }}>
            <b>{numero(r.ociosas)}</b> {`ociosas (${r.pctOciosas}%)`}
          </span>
        </div>
      </div>
    </div>
  );
}
