/*
  Dados fictícios do acompanhamento das inscrições do 114/2026 (cartão
  "Inscrições"): o cronograma com a "Validação das inscrições" depois do fim e
  retratos de duas vagas. Usados pelos testes da lib e do cartão.
*/
export const CRONOGRAMA_114 = [
  {
    atividade: "Publicação do Edital",
    inicio: "2026-09-30",
    fim: "2026-09-30",
  },
  {
    atividade: "Período de Inscrições",
    inicio: "2026-10-05",
    fim: "2026-10-14",
  },
  {
    atividade:
      "Validação das inscrições, por meio da verificação da documentação obrigatória",
    inicio: "2026-10-15",
    fim: "2026-10-22",
  },
];

export const r = (vaga, data, inscritos, aptos, extra = {}) => ({
  vaga,
  data,
  inscritos,
  finalizados: inscritos - 1,
  aptos,
  eliminados: 1,
  previa: false,
  em: `${data}T13:00:00Z`,
  ...extra,
});

export const DADOS_114 = {
  hoje: "2026-10-09",
  cronograma: CRONOGRAMA_114,
  vagas: [
    { codigo: "181100", cargo: "Analista — Belo Horizonte" },
    { codigo: "181101", cargo: "Motorista — Vitória" },
  ],
  retratos: [
    r("181100", "2026-10-06", 10, 4),
    r("181101", "2026-10-07", 3, 1),
    r("181100", "2026-10-08", 15, 6),
    r("181100", "2026-10-09", 18, 7),
  ],
};
