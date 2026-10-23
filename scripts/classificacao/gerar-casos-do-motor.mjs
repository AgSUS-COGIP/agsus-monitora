/*
  CASOS DOURADOS DA CLASSIFICAÇÃO (motor.ts × Python)

  Gera tests/fixtures/classificacao/casos-do-motor.json: editais FICTÍCIOS
  (nomes inventados, nenhum dado real) classificados pelo motor da tela
  (src/lib/classificacao/motor.ts) nas quatro listas. O vitest
  (tests/lib/classificacao-casos-do-motor.test.js) confere que o motor.ts ainda
  dá a mesma saída; o pytest (tests/python/test_classificacao_motor.py), que o
  Python dá a MESMA saída. Mudou o motor de propósito: rode de novo e acerte o
  Python até o pytest passar.

  Cobre: empate em cada critério (60+, indígena, experiência, tempo, idade, PcD),
  hora da certidão no mesmo dia (com e sem certidão), 29/02, dado nulo,
  empate final (sorteio registrado e pendente, ordem de inscrição, mesma
  posição, decisão manual), numeração densa e saltando, cotas com acúmulo
  (maior percentual, PcD e mais uma, todas), reserva conjunta (PPIQ),
  remanejamento, quadro × configuração de convocação × percentuais, limite da
  convocação (múltiplo, exceção do cargo, posição do CR, empatados no limite),
  eliminações da documental e da entrevista, ajustes de recurso, entrevistas
  repetidas ou sem análise, quem aguarda análise e a ordem alfabética do pt-BR.

  Uso: node scripts/classificacao/gerar-casos-do-motor.mjs
*/
import { writeFileSync } from "node:fs";
import { chaveDoGrupo } from "../../src/lib/classificacao/sorteio.ts";
import { classificarCaso } from "./classificar-como-a-tela.mjs";

const DESTINO = new URL(
  "../../tests/fixtures/classificacao/casos-do-motor.json",
  import.meta.url,
);
const TIPOS = ["PRELIMINAR", "CONVOCACAO", "ENTREVISTA", "FINAL"];

/* ── Candidatos ──────────────────────────────────────────────────────── */

let sequencia = 0;
function candidato(vaga, nome, campos = {}) {
  sequencia += 1;
  const n = String(sequencia).padStart(3, "0");
  return {
    analise_id: `c${n}-${vaga}`,
    codigo: String(5000 + sequencia),
    nome,
    vaga,
    cargo: campos.cargo ?? CARGOS[vaga] ?? "Cargo fictício",
    categoria: campos.categoria ?? "",
    modalidade: campos.modalidade ?? "Ampla concorrência",
    pcd: campos.pcd ?? "Não",
    data_nascimento: "nascimento" in campos ? campos.nascimento : "1990-05-10",
    hora_nascimento: campos.hora ?? null,
    nota_documental: campos.doc ?? 50,
    nota_art: campos.art ?? null,
    pontuacao_formacao: campos.formacao ?? null,
    pontuacao_cursos: campos.cursos ?? null,
    pontuacao_experiencia: campos.experiencia ?? null,
    pontuacao_etnica: campos.etnica ?? 0,
    exp_saude_indigena: "expIndigena" in campos ? campos.expIndigena : 100,
    exp_atencao_basica: campos.expBasica ?? null,
    exp_profissional: "expTempo" in campos ? campos.expTempo : 1000,
    status: campos.status ?? "Aprovado",
    etapa: campos.etapa ?? "",
    quadro: campos.quadro ?? QUADROS[vaga] ?? null,
  };
}

const CARGOS = {
  101: "Enfermeiro (Nível Superior)",
  102: "Médico Clínico",
  103: "Técnico de Enfermagem",
  104: "Agente Indígena de Saúde",
  105: "Analista Administrativo",
};
const QUADROS = { 101: "q-101", 102: "q-102", 105: "q-105" };

/*
  Vaga 101: um grupo por nota, cada um desempatado por um critério diferente
  (a nota final = documental + entrevista).
*/
const vaga101 = [
  // 80: 60+ decide (61 anos × 40 anos).
  candidato("101", "Ana Exemplo", { doc: 50, nascimento: "1964-03-01" }),
  candidato("101", "Bruno Teste", { doc: 50, nascimento: "1985-01-20" }),
  // 79: indígena comprovado decide.
  candidato("101", "Carla Ficticia", { doc: 49, etnica: 2 }),
  candidato("101", "Davi Modelo", { doc: 49, etnica: 0 }),
  // 78: experiência na saúde indígena decide; um sem dado (fica atrás).
  candidato("101", "Elisa Amostra", { doc: 48, expIndigena: 300 }),
  candidato("101", "Fábio Simulado", { doc: 48, expIndigena: 120 }),
  candidato("101", "Gabriela Ensaio", { doc: 48, expIndigena: null }),
  // 77: tempo de experiência decide.
  candidato("101", "Heitor Prova", { doc: 47, expTempo: 2000 }),
  candidato("101", "Íris Rascunho", { doc: 47, expTempo: 1500 }),
  // 76: maior idade, datas diferentes.
  candidato("101", "João Esboço", { doc: 46, nascimento: "1980-07-01" }),
  candidato("101", "Karina Piloto", { doc: 46, nascimento: "1982-07-01" }),
  // 75: mesma data; uma com hora da certidão, outra sem (23:59:59).
  candidato("101", "Lucas Treino", { doc: 45, nascimento: "1991-02-28" }),
  candidato("101", "Marina Demo", {
    doc: 45,
    nascimento: "1991-02-28",
    hora: "08:15",
  }),
  // 74: mesma data, sem certidão as duas; PcD decide.
  candidato("101", "Nelson Mock", { doc: 44, nascimento: "1993-09-09" }),
  candidato("101", "Olga Stub", {
    doc: 44,
    nascimento: "1993-09-09",
    pcd: "Sim",
    modalidade: "Pessoa com deficiência",
  }),
  // 73: empate em tudo — sorteio registrado.
  candidato("101", "Paulo Igual", { doc: 43, nascimento: "1995-01-01" }),
  candidato("101", "Paula Igual", { doc: 43, nascimento: "1995-01-01" }),
  // 72: empate em tudo — sorteio pendente (três).
  candidato("101", "Quirino Par", { doc: 42, nascimento: "1996-06-06" }),
  candidato("101", "Rita Par", { doc: 42, nascimento: "1996-06-06" }),
  candidato("101", "Sérgio Par", { doc: 42, nascimento: "1996-06-06" }),
  // Cotas: pretos e pardos, indígena, quilombola (reserva conjunta PPIQ).
  candidato("101", "Tânia Cota", {
    doc: 41,
    modalidade: "Pretos e pardos",
  }),
  candidato("101", "Ubiratã Cota", {
    doc: 40,
    modalidade: "Indígena",
    etnica: 1,
  }),
  candidato("101", "Vera Cota", {
    doc: 39,
    modalidade: "Quilombola / Pessoa com deficiência",
    pcd: "Sim",
  }),
  candidato("101", "Wagner Cota", {
    doc: 39,
    modalidade: "Pretos e pardos e PcD",
    pcd: "S",
  }),
  // Eliminações e situações.
  candidato("101", "Xavier Fora", { doc: 5 }),
  candidato("101", "Yara Reprovada", { status: "Reprovado", doc: 3 }),
  candidato("101", "Zeca Pendente", { status: "Pendente", doc: null }),
  candidato("101", "Álvaro Sem Nota", { doc: null }),
  candidato("101", "Bianca Inválida", { doc: "12,5,3" }),
  candidato("101", "Caio Ausente", { doc: 38 }),
  candidato("101", "Dora Inapta", { doc: 38 }),
  candidato("101", "Edu Sem Entrevista", { doc: 37 }),
  candidato("101", "Fernanda Competência", { doc: 37 }),
];

/* Vaga 102: exceção do cargo (Médico) e quadro com as modalidades explícitas. */
const vaga102 = [
  candidato("102", "Gustavo Médico", { doc: 60 }),
  candidato("102", "Helena Médica", { doc: 58, modalidade: "PcD", pcd: true }),
  candidato("102", "Igor Médico", { doc: 58 }),
  candidato("102", "Jade Médica", { doc: 55 }),
  candidato("102", "Kauã Médico", { doc: 55 }),
  candidato("102", "Lia Médica", { doc: 52 }),
  candidato("102", "Mauro Médico", { doc: 50 }),
];

/* Vaga 103: sem linha no quadro; a configuração de convocação tem o quadro manual. */
const vaga103 = [
  candidato("103", "Nara Técnica", { doc: 30, categoria: "Nível técnico" }),
  candidato("103", "Otávio Técnico", { doc: 30, categoria: "Nível técnico" }),
  candidato("103", "Pietra Técnica", {
    doc: 28,
    modalidade: "Pretos e pardos",
  }),
  candidato("103", "Quênia Técnica", { doc: 9, categoria: "Nível técnico" }),
];

/* Vaga 104: sem quadro e sem convocação; nomes para a ordem alfabética do pt-BR. */
const vaga104 = [
  candidato("104", "ana maria", { doc: 20 }),
  candidato("104", "Ana-Maria", { doc: 20 }),
  candidato("104", "Ana Maria", { doc: 20 }),
  candidato("104", "Ána Maria", { doc: 20 }),
  candidato("104", "Ana d'Ávila", { doc: 20 }),
  candidato("104", "Ana Lúcia", { doc: 20 }),
  candidato("104", "ÂNGELA", { doc: 20 }),
  candidato("104", "Ângelo", { doc: 20 }),
  candidato("104", "Anderson", { doc: 20 }),
  candidato("104", "", { doc: 19 }),
];

/* Vaga 105: 29/02 (60 anos completos ou não na data de corte) e nulos. */
const vaga105 = [
  candidato("105", "Bento Bissexto", {
    doc: 33,
    nascimento: "1964-02-29",
  }),
  candidato("105", "Célia Março", { doc: 33, nascimento: "1964-03-01" }),
  candidato("105", "Dario Sem Data", { doc: 33, nascimento: "" }),
  candidato("105", "Eva Sem Data", { doc: 33, nascimento: null }),
  candidato("105", "Félix Data Ruim", { doc: 31, nascimento: "1964-02-30" }),
  candidato("105", "Gil Data BR", { doc: 31, nascimento: "29/02/1964" }),
];

const CANDIDATOS = [...vaga101, ...vaga102, ...vaga103, ...vaga104, ...vaga105];
const id = (nome) => {
  const c = CANDIDATOS.find((x) => x.nome === nome);
  if (!c) throw new Error(`Candidato fictício não encontrado: ${nome}`);
  return c.analise_id;
};

/* ── Entrevistas ─────────────────────────────────────────────────────── */

function entrevista(nome, nota, campos = {}) {
  const c = CANDIDATOS.find((x) => x.nome === nome);
  return {
    id: `e-${c.analise_id}${campos.sufixo ?? ""}`,
    analise_id: c.analise_id,
    nome: c.nome,
    vaga: c.vaga,
    nota,
    parecer: campos.parecer ?? (nota === null ? "SEM_PARECER" : "APTO"),
    compareceu: campos.compareceu ?? "S",
    ligacao: campos.ligacao ?? "id",
    origem: campos.origem ?? "sistema",
    notas: campos.notas ?? [
      { ordem: 1, criterio: "Comunicação", nota: 6 },
      { ordem: 2, criterio: "Trabalho em equipe", nota: 7 },
    ],
  };
}

const ENTREVISTAS = [
  ...vaga101
    .filter(
      (c) =>
        ![
          "Xavier Fora",
          "Yara Reprovada",
          "Zeca Pendente",
          "Álvaro Sem Nota",
          "Bianca Inválida",
          "Caio Ausente",
          "Dora Inapta",
          "Edu Sem Entrevista",
          "Fernanda Competência",
        ].includes(c.nome),
    )
    .map((c) => entrevista(c.nome, 30)),
  entrevista("Caio Ausente", null, { compareceu: "N", parecer: "INAPTO" }),
  entrevista("Dora Inapta", 25, { parecer: "INAPTO" }),
  entrevista("Fernanda Competência", 30, {
    notas: [
      { ordem: 1, criterio: "Comunicação", nota: 0 },
      { ordem: 2, criterio: "Trabalho em equipe", nota: 9 },
    ],
  }),
  // Repetida: a da planilha sem parecer perde para a do sistema com parecer.
  entrevista("Ana Exemplo", 10, {
    sufixo: "-planilha",
    parecer: "SEM_PARECER",
    origem: "planilha",
    ligacao: "nome",
  }),
  // Entrevista de quem não está nas análises.
  {
    id: "e-orfa",
    analise_id: "nao-existe",
    nome: "Pessoa Fictícia Sem Análise",
    vaga: "101",
    nota: 40,
    parecer: "APTO",
    compareceu: "S",
    origem: "planilha",
    notas: [],
  },
  { id: "e-sem-id", analise_id: "", nome: "", vaga: "", nota: "abc" },
  ...vaga102.map((c, i) => entrevista(c.nome, 20 + (i % 3))),
  entrevista("Nara Técnica", 20),
  entrevista("Otávio Técnico", 20),
  entrevista("Pietra Técnica", "vinte"),
  ...vaga104.map((c) =>
    entrevista(c.nome, 10, { notas: [[1, 5, "Comunicação"]] }),
  ),
  ...vaga105.map((c) => entrevista(c.nome, 15)),
];

/* ── Quadro e convocação ─────────────────────────────────────────────── */

const QUADRO = [
  {
    id: "q-101",
    ordem: 1,
    cargo: "Enfermeiro (Nível Superior)",
    lotacao: "DSEI Fictício (Sede)",
    modalidades: null,
    vagas_imediatas: 6,
    cadastro_reserva: true,
  },
  {
    id: "q-102",
    ordem: 2,
    cargo: "Médico Clínico",
    lotacao: "Polo Base Fictício",
    modalidades: { "Ampla concorrência": 1, "Pessoas com deficiência": "1" },
    vagas_imediatas: 2,
    cadastro_reserva: false,
  },
  {
    id: "q-105",
    ordem: 3,
    cargo: "Analista Administrativo",
    lotacao: "DSEI Fictício",
    modalidades: {},
    vagas_imediatas: 1,
    cadastro_reserva: true,
  },
  {
    id: "q-sem-candidato",
    ordem: 4,
    cargo: "Nutricionista",
    lotacao: "DSEI Fictício",
    modalidades: null,
    vagas_imediatas: 0,
    cadastro_reserva: true,
  },
];

const CONVOCACAO = {
  edital_id: "edital-ficticio",
  configuracoes: [
    {
      edital_id: "edital-ficticio",
      proporcionalidade: true,
      modelo_id: "modelo-ficticio",
      padrao_imediata: 0,
      vagas: [
        {
          codigo_vaga: "103",
          cargo: "Técnico de Enfermagem",
          imediatas: 2,
          manual: true,
          quadro: { ampla: 1, pp: 1 },
        },
        {
          codigo_vaga: "105",
          cargo: "Analista Administrativo",
          imediatas: 3,
          manual: false,
          quadro: null,
        },
      ],
    },
  ],
  modelos: [
    {
      modelo_id: "modelo-ficticio",
      nome: "Modelo fictício",
      distribuicao: "proporcional",
      cota_multipla: "maior_percentual",
      editais: 1,
      categorias: [
        {
          id: "ampla",
          rotulo: "Ampla concorrência",
          sigla: "AC",
          ampla: true,
          percentual: 0,
          arredondamento: "meio_acima",
          minimo: 0,
        },
        {
          id: "pp",
          rotulo: "Pretos e pardos",
          sigla: "PP",
          ampla: false,
          percentual: 25,
          arredondamento: "meio_acima",
          minimo: 2,
        },
        {
          id: "pcd",
          rotulo: "Pessoas com deficiência",
          sigla: "PCD",
          ampla: false,
          acumulavel: true,
          percentual: 5,
          arredondamento: "sempre_acima",
          teto: 10,
          minimo: 5,
        },
      ],
    },
  ],
};

/* ── Regras ──────────────────────────────────────────────────────────── */

const CRITERIOS = [
  { criterio: "IDOSO_60" },
  { criterio: "INDIGENA_COMPROVADO" },
  { criterio: "EXP_SAUDE_INDIGENA" },
  { criterio: "EXP_PROFISSIONAL_TEMPO" },
  { criterio: "MAIOR_IDADE" },
  { criterio: "PCD" },
];

const MODALIDADES = [
  { codigo: "AC", nome: "Ampla concorrência" },
  {
    codigo: "PCD",
    nome: "Pessoas com deficiência",
    percentual: 10,
    arredondamento: "PARA_CIMA",
    remanejar_para: ["PPIQ"],
  },
  {
    codigo: "PPIQ",
    nome: "Pretos, pardos, indígenas e quilombolas",
    percentual: 30,
    agrupa: ["PP", "PI", "PQ"],
  },
];

const regraCompleta = {
  documental: {
    situacoes_aptas: ["Aprovado"],
    nota_minima: 10,
    parciais: ["FORMACAO", "EXPERIENCIA"],
  },
  entrevista: {
    nota_minima: 5,
    nota_eliminatoria_ate: 0,
    competencias: [{ ordem: 1, nome: "Comunicação", minimo: 1 }],
  },
  composicao: {
    componentes: [
      { codigo: "DOCUMENTAL", peso: 1 },
      { codigo: "ENTREVISTA", peso: 1 },
    ],
    casas: 2,
  },
  desempate: CRITERIOS,
  listas: {
    PRELIMINAR: { empate: "CRITERIOS" },
    ENTREVISTA: { empate: "CRITERIOS" },
    FINAL: { empate: "CRITERIOS" },
  },
  empate_final: { metodo: "SORTEIO", numeracao: "DENSA" },
  modalidades: MODALIDADES,
  cotas: { acumulo: "MAIOR_PERCENTUAL", minimo_vagas_reserva: 2 },
  convocacao: {
    multiplo_vagas: 3,
    posicao_max_cr: 10,
    incluir_empatados: true,
    excecoes: [{ termos: ["Médico"], multiplo_vagas: 2.5 }],
  },
};

/* Sorteio registrado do grupo "Paulo/Paula Igual" em cada lista que usa o empate final. */
const sorteio = (tipo) => ({
  id: `sorteio-${tipo}`,
  tipo_lista: tipo,
  vaga: "101",
  chave: chaveDoGrupo(tipo, "101", [id("Paulo Igual"), id("Paula Igual")]),
  metodo: "SORTEIO",
  semente: "semente-ficticia-0123456789",
  ordem: [id("Paula Igual"), id("Paulo Igual")],
  justificativa: null,
});

/* ── Os editais fictícios ────────────────────────────────────────────── */

const base = {
  candidatos: CANDIDATOS,
  entrevistas: ENTREVISTAS,
  quadro: QUADRO,
  unidade: "DSEI Fictício",
  dataCorte: "2025-02-28",
  desempates: [sorteio("PRELIMINAR"), sorteio("FINAL")],
  convocacao: null,
  ajustes: [],
};

const EDITAIS = [
  {
    nome: "criterios-sorteio-maior-percentual",
    entrada: { ...base, regra: regraCompleta },
  },
  {
    nome: "ordem-de-inscricao-saltando-pcd-mais-uma",
    entrada: {
      ...base,
      regra: {
        ...regraCompleta,
        data_corte: "2024-02-29",
        documental: {
          ...regraCompleta.documental,
          nota_minima: null,
          nota_minima_por_nivel: { superior: 40, tecnico: 25 },
          niveis_por_cargo: [{ termo: "Agente", nivel: "fundamental" }],
        },
        empate_final: { metodo: "ORDEM_INSCRICAO", numeracao: "SALTANDO" },
        modalidades: [
          { codigo: "AC" },
          {
            codigo: "PCD",
            percentual: 20,
            aparece_na_geral: false,
            recomeca_posicao: false,
          },
          { codigo: "PP", percentual: 20, remanejar_para: ["PI"] },
          { codigo: "PI", percentual: 5, arredondamento: "PARA_BAIXO" },
          { codigo: "PQ", percentual: 5, lista_propria: false },
        ],
        cotas: { acumulo: "PCD_MAIS_UMA", minimo_vagas_reserva: 0 },
        convocacao: {
          multiplo_vagas: null,
          posicao_max_cr: 4,
          incluir_empatados: false,
          excecoes: [],
        },
      },
    },
  },
  {
    nome: "mesma-posicao-todas-so-parecer",
    entrada: {
      ...base,
      dataCorte: "2024-03-01",
      regra: {
        ...regraCompleta,
        entrevista: { so_parecer: true, exige_comparecimento: false },
        composicao: {
          componentes: [
            { codigo: "DOCUMENTAL", peso: 2 },
            { codigo: "ART", peso: "0,5" },
          ],
          casas: 1,
          arredondamento: "TRUNCAR",
        },
        listas: {
          PRELIMINAR: { empate: "MESMA_POSICAO" },
          ENTREVISTA: { empate: "MESMA_POSICAO" },
          FINAL: { empate: "CRITERIOS" },
        },
        desempate: [
          { criterio: "MAIOR_IDADE", direcao: "MENOR_PRIMEIRO" },
          { criterio: "PONTUACAO_ETNICA" },
          { criterio: "NAO_EXISTE" },
        ],
        empate_final: { metodo: "MESMA_POSICAO", numeracao: "DENSA" },
        cotas: { acumulo: "TODAS" },
      },
    },
  },
  {
    nome: "decisao-manual-convocacao-ajustes",
    entrada: {
      ...base,
      convocacao: CONVOCACAO,
      desempates: [
        {
          id: "manual-final",
          tipo_lista: "FINAL",
          vaga: "101",
          chave: chaveDoGrupo("FINAL", "101", [
            id("Paulo Igual"),
            id("Paula Igual"),
          ]),
          metodo: "MANUAL",
          ordem: [id("Paulo Igual"), id("Paula Igual")],
          justificativa: "Decisão fictícia registrada para o teste.",
        },
        {
          id: "obsoleto",
          tipo_lista: "FINAL",
          vaga: "101",
          chave: "FINAL|101|a,b",
          metodo: "MANUAL",
          ordem: ["a", "b"],
        },
        {
          id: "obsoleto-preliminar",
          tipo_lista: "PRELIMINAR",
          vaga: null,
          chave: "PRELIMINAR|999|x,y",
          metodo: "SORTEIO",
          ordem: null,
        },
      ],
      ajustes: [
        {
          recurso_id: "recurso-2",
          analise_id: id("Davi Modelo"),
          numero: 12,
          aprovado_em: "2026-10-02T10:00:00+00:00",
          itens: [
            { codigo: "FORMACAO", anterior: 1, novo: 3 },
            { codigo: "DOCUMENTAL", anterior: 40, novo: "49,5" },
          ],
        },
        {
          recurso_id: "recurso-1",
          analise_id: id("Fernanda Competência"),
          numero: 7,
          aprovado_em: "2026-10-01T10:00:00+00:00",
          itens: [
            { codigo: "COMPETENCIA_1", anterior: 0, novo: 4 },
            { codigo: "COMPETENCIA_3", novo: 5 },
            { codigo: "ENTREVISTA", anterior: 30, novo: 31 },
            { codigo: "DESCONHECIDO", novo: 1 },
            { codigo: "ART", novo: null },
          ],
        },
        {
          recurso_id: "recurso-3",
          analise_id: id("Edu Sem Entrevista"),
          numero: 15,
          aprovado_em: "2026-10-03T10:00:00+00:00",
          itens: [{ codigo: "ENTREVISTA", novo: 20 }],
        },
      ],
      regra: {
        ...regraCompleta,
        empate_final: { metodo: "DECISAO_MANUAL", numeracao: "DENSA" },
        modalidades: [
          { codigo: "AC" },
          { codigo: "PP", nome: "Pretos e pardos", percentual: 20 },
          {
            codigo: "PCD",
            nome: "Pessoas com deficiência",
            percentual: 5,
            arredondamento: "PARA_CIMA",
          },
        ],
        cotas: { acumulo: "MAIOR_PERCENTUAL", minimo_vagas_reserva: 2 },
      },
    },
  },
  {
    nome: "regra-vazia-sem-data-de-corte",
    entrada: {
      ...base,
      dataCorte: null,
      desempates: [],
      regra: {
        etapas: { documental: false, entrevista: true },
        desempate: [{ criterio: "maior_idade" }, { criterio: "IDOSO_60" }],
        listas: { ENTREVISTA: { empate: "CRITERIOS" } },
      },
    },
  },
];

const casos = [];
for (const edital of EDITAIS)
  for (const tipo of TIPOS)
    casos.push({
      nome: `${edital.nome} · ${tipo}`,
      edital: edital.nome,
      tipo,
      saida: classificarCaso({ tipo, ...edital.entrada }),
    });

/* Uma linha por caso e por edital: o diff mostra qual caso mudou. */
const editais = EDITAIS.map(
  (e) => `${JSON.stringify(e.nome)}: ${JSON.stringify(e.entrada)}`,
);
const cabecalho = [
  `"gerado_por": "scripts/classificacao/gerar-casos-do-motor.mjs"`,
  `"aviso": "Dados fictícios. Não edite à mão: rode o gerador de novo (a saída é a do motor.ts)."`,
];
writeFileSync(
  DESTINO,
  [
    "{",
    `${cabecalho.join(",\n")},`,
    `"editais": {\n${editais.join(",\n")}\n},`,
    `"casos": [\n${casos.map((c) => JSON.stringify(c)).join(",\n")}\n]`,
    "}",
    "",
  ].join("\n"),
);
console.log(`${casos.length} casos gravados em ${DESTINO.pathname}`);
