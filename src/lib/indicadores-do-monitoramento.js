/*
  Os indicadores da Visão geral, sem DOM: Processos seletivos, Vagas imediatas
  previstas, Contratações, Vagas ociosas, Processos críticos e Inscritos.

  A Visão geral da Saúde Indígena (`renderKpis`, em `legacy-app.js`) e a das
  outras áreas (`src/componentes/visao-geral-da-area/`) contam do mesmo jeito,
  a partir das linhas de `TB_MONITORAMENTO_INDIGENA`. A da Saúde Indígena ainda
  pode trocar os números pelo resumo do servidor quando não há filtro; a conta
  local é esta.
*/

const txt = (valor) => String(valor ?? "").trim();
const low = (valor) => txt(valor).toLowerCase();
const num = (valor) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};

const STATUS_ENCERRADOS = ["concluído", "concluido", "cancelado", "cancelada"];
const RISCOS_CRITICOS = ["alto", "médio", "medio"];

/** Edital concluído ou cancelado. */
export function ehEditalEncerrado(linha) {
  return STATUS_ENCERRADOS.includes(low(linha?.status));
}

/** Risco médio ou alto num edital que ainda não encerrou: é o "processo crítico". */
export function ehRiscoAtivo(linha) {
  return (
    !ehEditalEncerrado(linha) && RISCOS_CRITICOS.includes(low(linha?.risco))
  );
}

/** Soma de um campo numérico das linhas; vazio e texto contam zero. */
export function somarCampo(linhas, campo) {
  return (Array.isArray(linhas) ? linhas : []).reduce(
    (total, linha) => total + num(linha?.[campo]),
    0,
  );
}

/** Os seis números da faixa de indicadores. */
export function indicadoresDoMonitoramento(linhas) {
  const lista = Array.isArray(linhas) ? linhas : [];
  return {
    processos: lista.length,
    vagas: somarCampo(lista, "vagas_total"),
    contratados: somarCampo(lista, "contratados"),
    ociosas: somarCampo(lista, "vagas_ociosas"),
    criticos: lista.filter(ehRiscoAtivo).length,
    inscritos: somarCampo(lista, "inscritos"),
  };
}
