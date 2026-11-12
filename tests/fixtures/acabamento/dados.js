/*
  Respostas fictícias das RPCs para as capturas do acabamento
  (tests/acabamento-capturas.spec.js). Quatro cenários de dados:
  - cheia: 220 editais (a tabela rola e o corpo é virtualizado/contínuo);
  - longo: poucos editais com nome de 200 caracteres, sem espaços em alguns;
  - vazio: nenhuma linha;
  - erro: a RPC responde 500.
  Tudo inventado; nenhum dado pessoal.
*/

export const CENARIOS = ["cheia", "longo", "vazio", "erro"];

const STATUS = ["Em andamento", "Homologado", "Encerrado", "Suspenso"];
const ETAPAS = [
  "Inscrições",
  "Avaliação documental",
  "Recursos",
  "Entrevistas",
  "Classificação",
  "Contratação",
];
const RISCOS = ["Baixo", "Médio", "Alto", "Crítico"];

/** Uma palavra comprida sem espaço: é o que mais quebra layout de célula. */
const SEM_ESPACO = "Distrito".concat("SanitarioEspecialIndigena".repeat(8));
export const NOME_DE_200 = (
  "Processo seletivo simplificado para formação de cadastro de reserva de profissionais de saúde " +
  "do Distrito Sanitário Especial Indígena com atuação nas aldeias de difícil acesso da região norte"
)
  .padEnd(200, " e")
  .slice(0, 200);

function linha(i, area, { longo = false } = {}) {
  const vagas = 4 + (i % 17);
  const contratados = i % (vagas + 1);
  return {
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    id_unidade: 100 + (i % 40),
    unidade: longo
      ? i % 2
        ? SEM_ESPACO
        : NOME_DE_200
      : `Unidade de Teste ${String(i + 1).padStart(3, "0")}`,
    sigla_unidade: `UT${i % 40}`,
    tipo_unidade: "DSEI",
    uf: ["AM", "PA", "MT", "RR", "TO"][i % 5],
    edital: longo
      ? NOME_DE_200
      : `Edital ${String((i % 90) + 1).padStart(3, "0")}/2026`,
    processo: `PS-${2026000 + i}`,
    ciclo: "2026",
    status: STATUS[i % STATUS.length],
    etapa: longo ? NOME_DE_200 : ETAPAS[i % ETAPAS.length],
    risco: RISCOS[i % RISCOS.length],
    ativo: true,
    inscritos: 120 + i * 3,
    aptos_analise: 90 + i,
    aprovados_analise: 40 + (i % 20),
    aprovados_prova: 20 + (i % 10),
    entrevistados: 10 + (i % 8),
    contratados,
    cancelados: i % 3,
    eliminados_nota: i % 7,
    total_eliminados: i % 9,
    reprovados_analise: i % 5,
    vagas_total: vagas,
    vagas_ociosas: Math.max(0, vagas - contratados),
    cargos: "Enfermeiro; Técnico de enfermagem; Médico",
    link_edital: "https://exemplo.org.br/edital.pdf",
    responsavel: "Pessoa Teste",
    observacoes: longo ? NOME_DE_200 : "",
    observacoes_internas: "",
    data_inicio: "2026-03-02",
    data_fim: "2026-12-18",
    cronograma_automatico: true,
    cronograma_atividade_atual: ETAPAS[i % ETAPAS.length],
    cronograma_proxima_atividade: "Divulgação do resultado",
    cronograma_proxima_data: "2026-12-01",
    cronograma_dias_para_proxima: (i % 30) - 5,
    cronograma_percentual: (i * 7) % 100,
    CO_AREA: area,
    ST_TREINAMENTO: false,
    TP_FONTE_FUNIL: "manual",
    DT_FONTE_FUNIL: null,
  };
}

/** `listar_monitoramento_operacional`: `{ linhas, versao }` ou a resposta de erro. */
export function monitoramento(cenario, area) {
  if (cenario === "erro")
    return () => ({
      status: 500,
      json: { code: "XX000", message: "Falha simulada do banco." },
    });
  const quantas = { cheia: 220, longo: 6, vazio: 0 }[cenario];
  return {
    linhas: Array.from({ length: quantas }, (_, i) =>
      linha(i, area, { longo: cenario === "longo" }),
    ),
    versao: `v-${cenario}`,
  };
}

/** `get_nucleo_cronograma_resumo`: uma linha por edital, com o alerta. */
export function resumoDoNucleo(cenario, area) {
  if (cenario === "erro")
    return () => ({
      status: 500,
      json: { code: "XX000", message: "Falha simulada do banco." },
    });
  const dados = monitoramento(cenario, area).linhas;
  return dados.map((l, i) => ({
    id: l.id,
    unidade: l.unidade,
    edital: l.edital,
    status: l.status,
    alerta_tipo: ["ok", "atrasado", "vence_hoje", "sem_cronograma"][i % 4],
    cronograma_total: 6,
  }));
}

/** `obter_modulos_e_abas`. */
export function modulosEAbas(cenario) {
  if (cenario === "erro")
    return () => ({
      status: 500,
      json: { code: "XX000", message: "Falha simulada do banco." },
    });
  if (cenario === "vazio")
    return { sistema: {}, areas: [], abas: [], paineis: [], historico: [] };
  const nome = (n) => (cenario === "longo" ? NOME_DE_200 : n);
  const areas = [
    ["saude-indigena", "Saúde Indígena"],
    ["sede", "SEDE"],
    ["projetos", "Projetos"],
  ].map(([co_area, no_area], i) => ({
    co_area,
    no_area: nome(no_area),
    ativo: true,
    situacao: i === 2 ? "MANUTENCAO" : "ATIVO",
    mensagem: null,
    previsao: null,
    abas: Array.from({ length: cenario === "cheia" ? 12 : 4 }, (_, j) => ({
      co_aba: `${co_area}-aba-${j}`,
      no_aba: nome(`Aba ${j + 1} de ${no_area}`),
      ativo: j % 4 !== 3,
      beta: j === 2,
      situacao: "ATIVO",
      mensagem: null,
      previsao: null,
    })),
  }));
  return {
    sistema: {
      situacao: "ATIVO",
      mensagem: null,
      previsao: null,
      comemoracoes: true,
    },
    areas,
    abas: areas.flatMap((a) => a.abas),
    paineis: Array.from({ length: cenario === "cheia" ? 30 : 3 }, (_, i) => ({
      id: `painel-${i}`,
      titulo: nome(`Painel externo ${i + 1}`),
      ativo: i % 5 !== 4,
      em_manutencao: i % 7 === 6,
    })),
    historico: Array.from({ length: cenario === "cheia" ? 40 : 2 }, (_, i) => ({
      escopo: "aba",
      area: "sede",
      aba: `aba-${i}`,
      painel: null,
      campo: "ativo",
      quando: "2026-11-10T14:00:00Z",
      motivo: nome("Ajuste de teste"),
      autor: "Pessoa Teste",
      anterior: true,
      novo: false,
    })),
  };
}
