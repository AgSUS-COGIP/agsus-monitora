/*
  Dois modelos de referência como estavam antes de 02/10/2026, com a ordem
  "espalhada ao longo da convocação" (proporcional). O catálogo hoje usa a
  ordem do simulador do MGI — a regra do "Lei 15.142" voltou como "padrão
  Cebraspe", e a da FGV é o modelo do MGI com mínimos —, mas a ordem espalhada
  e os mínimos por cota continuam valendo para os modelos já salvos no banco,
  e é isso que os testes que usam estes conferem.
*/
export const LEI_15142_ESPALHADA = Object.freeze({
  // Regra dos editais 96/2025, 30/2026, 93/2026, Cebraspe 2026 e FGV.
  id: "lei-15142-2025",
  nome: "Lei 15.142/2025 — 25/3/2 e 5% PCD",
  descricao:
    "25% pretos e pardos, 3% indígenas, 2% quilombolas e 5% PCD, intercalados ao longo da convocação. Editais 96/2025, 30/2026 e 93/2026.",
  distribuicao: "proporcional",
  cotaMultipla: "maior_percentual",
  categorias: [
    {
      id: "ampla",
      rotulo: "Ampla concorrência",
      sigla: "AC",
      ampla: true,
      termos: ["ampla*", "geral*", "ac", "livre*", "universal*"],
    },
    {
      id: "pretos_pardos",
      rotulo: "Pretos e pardos",
      sigla: "PP",
      percentual: 25,
      termos: ["preto*", "pardo*", "negro*", "negra*", "afro*", "pp", "ppi"],
      cascata: [],
    },
    {
      id: "indigena",
      rotulo: "Indígena",
      sigla: "IND",
      percentual: 3,
      termos: ["indigena*", "indio*", "ppi"],
      cascata: ["quilombola", "pretos_pardos"],
    },
    {
      id: "quilombola",
      rotulo: "Quilombola",
      sigla: "QUI",
      percentual: 2,
      termos: ["quilombol*", "quilombo*"],
      cascata: ["indigena", "pretos_pardos"],
    },
    {
      id: "pcd",
      rotulo: "Pessoa com deficiência",
      sigla: "PCD",
      percentual: 5,
      termos: ["pcd*", "deficien*", "pne*"],
      cascata: [],
    },
  ],
});

export const FGV_MINIMOS_POR_CARGO = Object.freeze({
  /*
      Edital da FGV. Mesmos percentuais da Lei 15.142/2025, mas com dois
      detalhes que nenhum outro tem juntos:

        6.4 — o PCD arredonda SEMPRE para cima (Decreto 9.508, §3), enquanto as
              cotas raciais seguem a regra dos 0,5 (7.1.1);
        6.5 — só há reserva de PCD em cargo com CINCO ou mais vagas, e
        7.1.3 — só há reserva racial em cargo com DUAS ou mais.

      É o edital que obrigou o mínimo a ser por categoria: numa vaga de três,
      a reserva racial vale e a de PCD não.

      Sem cascata: o 7.13 manda a reserva vazia direto para a ampla.
    */
  id: "fgv-minimos-por-cargo",
  nome: "FGV — 25/3/2 e 5% PCD, com mínimos por cargo",
  descricao:
    "Como a Lei 15.142, mas a PCD arredonda sempre para cima e só existe com 5 ou mais vagas; a cota racial, com 2 ou mais.",
  distribuicao: "proporcional",
  cotaMultipla: "maior_percentual",
  categorias: [
    {
      id: "ampla",
      rotulo: "Ampla concorrência",
      sigla: "AC",
      ampla: true,
      termos: ["ampla*", "geral*", "ac", "livre*", "universal*"],
    },
    {
      id: "pretos_pardos",
      rotulo: "Pessoas negras",
      sigla: "PP",
      percentual: 25,
      minimo: 2,
      termos: ["preto*", "pardo*", "negro*", "negra*", "afro*", "pp"],
      cascata: [],
    },
    {
      id: "indigena",
      rotulo: "Indígena",
      sigla: "IND",
      percentual: 3,
      minimo: 2,
      termos: ["indigena*", "indio*"],
      cascata: [],
    },
    {
      id: "quilombola",
      rotulo: "Quilombola",
      sigla: "QUI",
      percentual: 2,
      minimo: 2,
      termos: ["quilombol*", "quilombo*"],
      cascata: [],
    },
    {
      id: "pcd",
      rotulo: "Pessoa com deficiência",
      sigla: "PCD",
      percentual: 5,
      minimo: 5,
      arredondamento: "sempre_acima",
      termos: ["pcd*", "deficien*", "pne*"],
      cascata: [],
    },
  ],
});
