/*
  Respostas fictícias das telas além da base, para a auditoria visual
  (tests/auditoria-visual.spec.js). `rpcsDaAuditoria(cenario, area)` devolve
  nome da RPC -> JSON (ou função que devolve `{ status, json }`), nos cenários
  "cheia", "vazio" e "erro". Tudo inventado; nenhum dado pessoal.

  Os editais são os de `monitoramento()` (tests/fixtures/acabamento/dados.js):
  mesmos ids (00000000-0000-4000-8000-<índice + 1>), mesmos números e
  unidades, para a página do edital e os cruzamentos por id baterem. As datas
  giram em torno de novembro de 2026 (o mês da auditoria), para o calendário,
  os prazos e as agendas terem o que mostrar.
*/

import { monitoramento } from "../acabamento/dados.js";

const ERRO_500 = () => ({
  status: 500,
  json: { code: "XX000", message: "Falha simulada do banco." },
});

/** Os editais da base (os da cheia), montados uma vez por área. */
const editaisPorArea = new Map();
function editaisDaBase(area) {
  if (!editaisPorArea.has(area))
    editaisPorArea.set(area, monitoramento("cheia", area).linhas);
  return editaisPorArea.get(area);
}

const tres = (n) => String(n).padStart(3, "0");
const pessoa = (n) => `Pessoa Teste ${tres(n)}`;
const email = (n) => `pessoa.teste.${tres(n)}@exemplo.org.br`;

/** "2026-10-01" + n dias, em aaaa-mm-dd (conta em UTC: sem fuso nem horário de verão). */
function dia(base, n = 0) {
  const data = new Date(`${base}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + n);
  return data.toISOString().slice(0, 10);
}

/** Resposta que depende dos argumentos da RPC (o corpo do POST). */
const comArgumentos = (montar) => (rota) => ({
  status: 200,
  json: montar(rota.request().postDataJSON() ?? {}),
});

const CARGOS = [
  "Enfermeiro 40h",
  "Técnico de enfermagem 40h",
  "Médico 40h",
  "Cirurgião-dentista 40h",
  "Agente indígena de saúde",
  "Nutricionista 30h",
];
const MODALIDADES = [
  "Ampla concorrência",
  "Pessoa negra",
  "Pessoa com deficiência",
];

/* ── Cronograma (calendário, página do edital, recursos) ─────────────── */

/** Editais com etapas: os 60 primeiros (os outros ficam sem cronograma lido). */
const EDITAIS_COM_ETAPAS = 60;

/**
 * As etapas de um edital: começam entre 1/10 e 14/11/2026 (o primeiro, o da
 * página do edital, em 21/10: está no meio), de modo que novembro tenha
 * inscrições, análises, recursos e entrevistas.
 */
function etapasDoEdital(i) {
  const inicio = dia("2026-10-01", (20 + i * 7) % 45);
  return [
    ["Publicação do edital", 0, 0],
    ["Período de inscrições", 2, 16],
    ["Análise documental e curricular", 18, 30],
    ["Divulgação do resultado preliminar da análise documental", 32, 32],
    ["Prazo de recurso do resultado preliminar", 33, 35],
    ["Entrevistas", 38, 45],
    ["Divulgação do resultado final", 50, 50],
  ].map(([atividade, de, ate], ordem) => ({
    monitoramento_id: editaisDaBase("sede")[i].id,
    ordem: ordem + 1,
    atividade,
    data_inicio: dia(inicio, de),
    data_fim: dia(inicio, ate),
    origem: "manual",
    observacao: null,
    concluida: dia(inicio, ate) < "2026-11-23",
  }));
}

function etapasDoCronograma(cenario) {
  if (cenario === "erro") return ERRO_500;
  if (cenario === "vazio") return [];
  return Array.from({ length: EDITAIS_COM_ETAPAS }, (_, i) =>
    etapasDoEdital(i),
  ).flat();
}

/** `get_monitoramento_cronograma(p_monitoramento_id)`: o cronograma de um edital. */
function cronogramaDoEdital(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  return comArgumentos(({ p_monitoramento_id: id }) => {
    const indice = editaisDaBase(area).findIndex((e) => e.id === id);
    const edital = editaisDaBase(area)[Math.max(indice, 0)];
    const etapas =
      cenario === "vazio" ? [] : etapasDoEdital(Math.max(indice, 0) % 60);
    return {
      monitoramento: {
        edital: edital.edital,
        unidade: edital.unidade,
        cronograma_automatico: true,
        status_override: null,
        etapa_override: null,
        nu_anos_validade: 1,
        nu_meses_validade: 0,
        st_prorrogado: false,
      },
      etapas: etapas.map((etapa) => ({
        ...etapa,
        monitoramento_id: undefined,
      })),
      historico:
        cenario === "vazio"
          ? []
          : Array.from({ length: 4 }, (_, j) => ({
              created_at: `2026-1${j % 2}-0${j + 2}T14:00:00Z`,
              acao: j === 0 ? "criacao" : "errata",
              numero_errata: j === 0 ? null : String(j),
              motivo: j === 0 ? null : "Ajuste de datas (teste)",
              created_by_email: email(j + 1),
              total_alteracoes: j + 1,
            })),
      estado: {
        status: edital.status,
        etapa: edital.etapa,
        proxima_atividade: "Divulgação do resultado final",
        percentual: 60,
      },
    };
  });
}

/** `listar_demandas_internas`: `{ demandas, pode_criar_em }`. */
function demandasInternas(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  if (cenario === "vazio") return { demandas: [], pode_criar_em: [area] };
  const editais = editaisDaBase(area);
  return {
    pode_criar_em: [area],
    demandas: Array.from({ length: 10 }, (_, i) => ({
      id: `demanda-${i + 1}`,
      area,
      edital_id: editais[i].id,
      edital: editais[i].edital,
      unidade: editais[i].unidade,
      titulo: `Demanda interna de teste ${i + 1}`,
      descricao: "Conferir a documentação antes da publicação.",
      data_inicio: dia("2026-11-03", i * 2),
      data_fim: dia("2026-11-03", i * 2 + (i % 3)),
      concluida: i % 4 === 0,
      concluida_em: i % 4 === 0 ? "2026-11-10T15:00:00Z" : null,
      concluida_por: i % 4 === 0 ? pessoa(1) : null,
      responsaveis: [{ id: `u${i}`, nome: pessoa(i + 1) }],
      pode_editar: true,
      criada_em: "2026-11-01T12:00:00Z",
      criada_por: pessoa(2),
      atualizada_em: "2026-11-01T12:00:00Z",
      atualizada_por: pessoa(2),
    })),
  };
}

/* ── Visão geral, mapas e página do edital ───────────────────────────── */

/** `listar_vagas_por_cargo_da_visao_geral(p_area, p_editais)`: vagas, quadro e lista. */
function vagasPorCargo(cenario) {
  if (cenario === "erro") return ERRO_500;
  return comArgumentos(({ p_editais: ids = [] }) => {
    if (cenario === "vazio") return { vagas: [], quadro: [], lista: [] };
    const porEdital = ids.slice(0, 220).map((id, i) =>
      [0, 1, 2].map((j) => ({
        id,
        codigo: `${1000 + i * 3 + j}`,
        cargo: CARGOS[(i + j) % CARGOS.length],
        vagas: 1 + ((i + j) % 4),
      })),
    );
    const todas = porEdital.flat();
    return {
      vagas: todas.map((v, k) => ({
        monitoramento_id: v.id,
        codigo: v.codigo,
        vaga: v.codigo,
        cargo: v.cargo,
        unidade: `Unidade de Teste ${tres((k % 40) + 1)}`,
        inscritos: 20 + (k % 60),
      })),
      quadro: todas.map((v) => ({
        monitoramento_id: v.id,
        cargo: v.cargo,
        lotacao: "Polo base de teste",
        vagas: v.vagas,
        reserva: false,
      })),
      lista: todas.map((v, k) => ({
        monitoramento_id: v.id,
        codigo_vaga: v.codigo,
        cargo: v.cargo,
        aprovados: k % 5,
      })),
    };
  });
}

/* ── Editais ─────────────────────────────────────────────────────────── */

/** `listar_editais_com_cronograma_encerrado`: `{ pode_concluir, editais }`. */
function encerradosDoCronograma(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  if (cenario === "vazio") return { pode_concluir: true, editais: [] };
  return {
    pode_concluir: true,
    editais: editaisDaBase(area)
      .slice(0, 12)
      .map((e, i) => ({
        id: e.id,
        edital: e.edital,
        numero: e.edital.replace(/^Edital 0*/, ""),
        unidade: e.unidade,
        area,
        status: "Em andamento",
        fim: dia("2026-10-01", i * 3),
        aviso:
          i % 3
            ? null
            : {
                id: `aviso-${i}`,
                tratamento: "PENDENTE",
                pode_dispensar: true,
              },
        pendencias:
          i % 4
            ? []
            : [
                {
                  conferencia: "EDITAL_SEM_LINK",
                  gravidade: "ATENCAO",
                  quantidade: 1,
                },
              ],
      })),
  };
}

/* ── Aprovados ───────────────────────────────────────────────────────── */

/** Listas vigentes: uma por edital dos 8 primeiros. */
function listasAprovados(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  if (cenario === "vazio") return [];
  return editaisDaBase(area)
    .slice(0, 8)
    .map((e, i) => ({
      lista_id: `lista-${i + 1}`,
      edital_id: e.id,
      edital: e.edital,
      unidade: e.unidade,
      ativo: true,
      origem: i % 2 ? "XLSX" : "CLASSIFICACAO",
      arquivo_nome: `aprovados-${tres(i + 1)}.xlsx`,
      arquivo_path: `${e.id}/aprovados.xlsx`,
      importado_em: "2026-11-05T13:00:00Z",
      importado_por_nome: pessoa(3),
      importado_por_email: email(3),
      total_candidatos: 7,
    }));
}

const STATUS_DO_APROVADO = [
  "",
  "Convocado",
  "Contratado",
  "",
  "Desistente",
  "",
];

/** O pacote do formato 2 de `listar_candidatos_aprovados_compacto` (listas num array). */
function pacoteDeAprovados(area, listas) {
  const colunas = [
    "candidato_id",
    "lista_id",
    "cargo",
    "classificacao",
    "nota",
    "nome",
    "modalidade",
    "status",
    "processo_sei",
    "matricula",
    "sub_judice",
    "codigo_vaga",
  ];
  const linhas = listas.flatMap((lista, l) =>
    Array.from({ length: lista.total_candidatos }, (_, c) => {
      const n = l * 7 + c + 1;
      const status = STATUS_DO_APROVADO[n % STATUS_DO_APROVADO.length];
      return [
        `candidato-${tres(n)}`,
        l,
        CARGOS[c % CARGOS.length],
        c + 1,
        Math.round((95 - c * 3.5) * 10) / 10,
        pessoa(n),
        MODALIDADES[c % MODALIDADES.length],
        status,
        status === "Contratado" ? `25000.${100000 + n}/2026-00` : null,
        status === "Contratado" ? `M-${1000 + n}` : null,
        n % 13 === 0,
        `${1000 + l * 3 + (c % 3)}`,
      ];
    }),
  );
  return {
    formato: 2,
    area,
    versao: "v-aprovados",
    inalterado: false,
    colunas_da_lista: [
      "lista_id",
      "edital_id",
      "edital",
      "unidade",
      "lista_ativa",
      "arquivo_nome",
      "importado_em",
    ],
    listas: listas.map((lista) => [
      lista.lista_id,
      lista.edital_id,
      lista.edital,
      lista.unidade,
      true,
      lista.arquivo_nome,
      lista.importado_em,
    ]),
    colunas,
    linhas,
    total: linhas.length,
  };
}

const pendenciasDoEdital = (area) => ({
  schema_version: 1,
  area,
  pendencias: [],
});

/** `abrir_lista_aprovados`: a abertura numa chamada (pacote, listas e o resto). */
function abrirListaAprovados(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  const listas = cenario === "vazio" ? [] : listasAprovados(cenario, area);
  return {
    formato: 1,
    area,
    pacote: pacoteDeAprovados(area, listas),
    listas,
    modelos: [],
    configs: [],
    anexos: [],
    convocacoes: listas.slice(0, 3).flatMap((_, l) =>
      [1, 2].map((c) => ({
        candidato_id: `candidato-${tres(l * 7 + c)}`,
        data_convocacao: dia("2026-11-10", l),
        cartas: 1,
      })),
    ),
    pendencias: pendenciasDoEdital(area),
    erros: {},
  };
}

/* ── Recursos ────────────────────────────────────────────────────────── */

const SITUACOES_DO_RECURSO = [
  "REGISTRADO",
  "EM_ANALISE_JURIDICA",
  "DEFERIDO",
  "PARCIALMENTE_INDEFERIDO",
  "INDEFERIDO",
];
const ORIGENS_DO_RECURSO = [
  { id: "analise-curricular", rotulo: "Análise curricular", ativo: true },
  { id: "entrevista", rotulo: "Entrevista", ativo: true },
  { id: "resultado-final", rotulo: "Resultado final", ativo: true },
];

/** `get_recursos_da_area(p_area)`: recursos, editais, origens e cronogramas. */
function recursosDaArea(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  const editais = cenario === "vazio" ? [] : editaisDaBase(area).slice(0, 10);
  return {
    schema_version: 1,
    area,
    pode_editar: true,
    pode_decidir: true,
    pode_administrar_modelos: true,
    origens: ORIGENS_DO_RECURSO,
    modelos: [],
    editais: editais.map((e, i) => ({
      id: e.id,
      edital: e.edital,
      unidade: e.unidade,
      tem_analises: i % 3 !== 2,
    })),
    // Um prazo de recurso e a resposta por origem (o prazo casa pelo nome da etapa).
    cronogramas: editais.flatMap((e, i) =>
      [
        ["da análise documental", 0],
        ["da entrevista", 10],
        ["do resultado final", 20],
      ].flatMap(([de, n], j) => [
        {
          edital_id: e.id,
          ordem: 2 * j + 1,
          atividade: `Prazo de recurso ${de}`,
          inicio: dia("2026-11-10", n + (i % 6)),
          fim: dia("2026-11-12", n + (i % 6)),
        },
        {
          edital_id: e.id,
          ordem: 2 * j + 2,
          atividade: `Resposta aos recursos ${de}`,
          inicio: dia("2026-11-16", n + (i % 6)),
          fim: dia("2026-11-16", n + (i % 6)),
        },
      ]),
    ),
    recursos: Array.from({ length: cenario === "vazio" ? 0 : 42 }, (_, i) => {
      const e = editais[i % editais.length];
      const situacao = SITUACOES_DO_RECURSO[i % SITUACOES_DO_RECURSO.length];
      const decidido = i % 5 >= 2;
      return {
        id: `recurso-${i + 1}`,
        nu: i + 1,
        edital_id: e.id,
        edital: e.edital,
        unidade: e.unidade,
        origem: ORIGENS_DO_RECURSO[i % 3].id,
        analise_id: `analise-${i + 1}`,
        candidato: pessoa(i + 1),
        codigo: String(5000 + i),
        cargo: CARGOS[i % CARGOS.length],
        vaga: `${1000 + (i % 30)}`,
        analista: pessoa((i % 6) + 50),
        situacao,
        processo_sei: i % 2 ? `25000.${200000 + i}/2026-11` : "",
        fora_analise: false,
        mudou_classificacao: situacao === "DEFERIDO" && i % 2 === 0,
        nota_anterior: 60 + (i % 20),
        nota_atual: decidido ? 62 + (i % 20) : 60 + (i % 20),
        resultado_atual: "Aprovado",
        resultado_anterior: "Reprovado",
        criado_em: `${dia("2026-11-01", i % 22)}T12:00:00Z`,
        parecer_enviado_em:
          i % 5 >= 1 ? `${dia("2026-11-05", i % 15)}T12:00:00Z` : null,
        decisao_em: decidido ? `${dia("2026-11-10", i % 12)}T12:00:00Z` : null,
        download_empregare_em: `${dia("2026-11-02", i % 20)}T12:00:00Z`,
        processo_sei_em:
          i % 2 ? `${dia("2026-11-03", i % 18)}T12:00:00Z` : null,
        upload_sei_em: null,
        resposta_candidato_em:
          decidido && i % 2 ? `${dia("2026-11-15", i % 7)}T12:00:00Z` : null,
        resposta_estado: decidido ? "ENVIADA" : null,
        qt_anexos: i % 4,
        revisao: 1,
      };
    }),
  };
}

/* ── Entrevistas e Seleção (os painéis por área) ─────────────────────── */

/** `get_entrevistas_da_area_se_mudou(p_area, p_versao)`: o painel de entrevistas. */
function entrevistasDaArea(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  const editais = editaisDaBase(area).slice(0, 8);
  const quantas = cenario === "vazio" ? 0 : 56;
  const PARECERES = ["APTO", "APTO", "INAPTO", "SEM_PARECER"];
  return {
    schema_version: 1,
    area,
    versao: `v-entrevistas-${cenario}`,
    gerado_em: "2026-11-23T11:00:00Z",
    ultima_carga: { em: "2026-11-23T08:30:00-03:00", linhas: quantas },
    criterios: ["Habilidade técnica", "Postura", "Comunicação"],
    entrevistas: Array.from({ length: quantas }, (_, i) => {
      const e = editais[i % editais.length];
      const parecer = PARECERES[i % PARECERES.length];
      return {
        id: `entrevista-${i + 1}`,
        edital_id: e.id,
        edital: e.edital,
        edital_planilha: e.edital.replace("Edital ", ""),
        unidade: e.unidade,
        vaga: `${1000 + (i % 24)}`,
        cargo: CARGOS[i % CARGOS.length],
        candidato: pessoa(i + 1),
        codigo: `C${100 + i}`,
        modalidade: MODALIDADES[i % MODALIDADES.length],
        nota: parecer === "SEM_PARECER" ? null : 4 + (i % 7),
        parecer,
        compareceu: parecer === "SEM_PARECER" && i % 2 ? null : "S",
        link: "https://exemplo.org.br/planilha",
        notas:
          parecer === "SEM_PARECER"
            ? []
            : [
                [0, 1 + (i % 5)],
                [1, 2 + (i % 3)],
                [2, 1 + (i % 4)],
              ],
        analise: {
          id: `analise-${i + 1}`,
          ligacao: "codigo",
          nota: 60 + (i % 30),
          resultado: "Aprovado",
          etapa: "Final",
          responsavel: pessoa((i % 6) + 50),
          ativo: true,
        },
      };
    }),
    aprovados_sem_entrevista: Array.from(
      { length: cenario === "vazio" ? 0 : 6 },
      (_, i) => ({
        analise_id: `analise-sem-${i + 1}`,
        candidato: pessoa(i + 200),
        codigo: `C${900 + i}`,
        vaga: `${1000 + i}`,
        cargo: CARGOS[i % CARGOS.length],
        edital: editais[i % editais.length].edital,
        unidade: editais[i % editais.length].unidade,
        nota: 70 + i,
        modalidade: MODALIDADES[0],
      }),
    ),
  };
}

/** `get_selecao_da_area_se_mudou(p_area, p_versao)`: o funil por vaga. */
function selecaoDaArea(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  const editais = editaisDaBase(area).slice(0, 12);
  const quantas = cenario === "vazio" ? 0 : 48;
  return {
    schema_version: 1,
    area,
    versao: `v-selecao-${cenario}`,
    gerado_em: "2026-11-23T11:00:00Z",
    ultima_carga: {
      em: "2026-11-23T09:02:00-03:00",
      linhas: quantas,
      sem_edital: 0,
    },
    vagas: Array.from({ length: quantas }, (_, i) => {
      const e = editais[i % editais.length];
      const inscritos = 30 + ((i * 17) % 90);
      const eliminados = i % 9;
      return {
        id: `vaga-${i + 1}`,
        edital_id: e.id,
        edital: e.edital.replace("Edital ", ""),
        unidade: e.unidade,
        vaga: `${104000 + i}`,
        cargo: CARGOS[i % CARGOS.length],
        inscritos,
        aptos: inscritos - eliminados - 3,
        cancelados: i % 3,
        reprovados_questionario: i % 5,
        eliminados_nota: i % 4,
        reprovados_analise: i % 6,
        triados: inscritos - eliminados - 5,
        total_eliminados: eliminados,
        observacao: "",
        convocados: 4 + (i % 8),
        origem_convocados: "entrevistas",
        aprovados: 2 + (i % 6),
        contratados: i % 3,
        nao_contratados: 1 + (i % 4),
      };
    }),
  };
}

/* ── Listas de editais das telas por edital ──────────────────────────── */

/** `listar_editais_entrevista(p_area, p_todos)`: os editais na janela da entrevista. */
function editaisDaEntrevista(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  const editais = cenario === "vazio" ? [] : editaisDaBase(area).slice(0, 14);
  return {
    admin_global: true,
    editais: editais.map((e, i) => ({
      id: e.id,
      edital: e.edital,
      unidade: e.unidade,
      treinamento: false,
      na_janela: i % 5 !== 4,
      janela_inicio: dia("2026-11-16", i % 5),
      janela_fim: dia("2026-11-27", i % 5),
      liberado_ate: i % 5 === 4 ? "2026-11-30" : "",
      motivo_liberacao: i % 5 === 4 ? "Reagendamento de teste" : "",
      visivel_por: i % 5 === 4 ? "liberacao" : "janela",
      pendentes: (i * 3) % 11,
    })),
  };
}

/** `listar_editais_classificacao(p_area)`. */
function editaisDaClassificacao(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  const editais = cenario === "vazio" ? [] : editaisDaBase(area).slice(0, 16);
  return {
    area,
    pode_editar: true,
    editais: editais.map((e, i) => ({
      id: e.id,
      edital: e.edital,
      unidade: e.unidade,
      candidatos: 20 + ((i * 13) % 140),
      versao_regra: i % 4 ? 1 + (i % 3) : undefined,
      nome_regra: i % 4 ? "Regra de teste" : null,
      treinamento: false,
    })),
  };
}

/** `listar_editais_avaliacao(p_area)` (Avaliação documental e Triagem). */
function editaisDaAvaliacao(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  const editais = cenario === "vazio" ? [] : editaisDaBase(area).slice(0, 16);
  return {
    area,
    editais: editais.map((e, i) => ({
      id: e.id,
      edital: e.edital,
      unidade: e.unidade,
      ativo: true,
      status: e.status,
      papel: i % 3 ? "ANALISTA" : "COORDENADOR",
      origem: "PLANILHA",
      versao_regra: i % 5 ? 1 + (i % 2) : null,
      nome_regra: i % 5 ? "Regra de teste" : null,
      situacao_regra: i % 5 ? "CONFERIDA" : null,
      treinamento: false,
      fichas: {
        concluidas: 10 + ((i * 7) % 80),
        pendentes: (i * 11) % 60,
        em_analise: i % 6,
        minhas_em_analise: i % 3,
      },
    })),
  };
}

/* ── Análises curriculares ───────────────────────────────────────────── */

const COLUNAS_DAS_ANALISES = [
  "id",
  "unidade",
  "edital",
  "codigo_vaga",
  "nome_vaga",
  "candidato",
  "categoria",
  "modalidade_concorrencia",
  "status_consolidado",
  "etapa",
  "responsavel_analise",
  "data_analise",
  "nota_final_ajustada",
  "pdf_status",
  "tem_pdf",
];
const STATUS_DA_ANALISE = [
  "Aprovado",
  "Pendente",
  "Revisar",
  "Reprovado",
  "Em análise",
  "Aprovado",
];

/** `get_analises_dashboard_payload_v2_se_mudou`: colunas + linhas (só o pacote "ativo"). */
function analisesDaArea(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  return comArgumentos(({ p_scope: escopo = "ativo" }) => {
    const editais = editaisDaBase(area).slice(0, 6);
    const quantas = cenario === "vazio" || escopo !== "ativo" ? 0 : 60;
    const rows = Array.from({ length: quantas }, (_, i) => {
      const e = editais[i % editais.length];
      const status = STATUS_DA_ANALISE[i % STATUS_DA_ANALISE.length];
      const feita = status !== "Pendente";
      const valores = {
        id: `analise-${i + 1}`,
        unidade: e.unidade,
        edital: e.edital.replace("Edital ", ""),
        codigo_vaga: `${1000 + (i % 18)}`,
        nome_vaga: CARGOS[i % CARGOS.length],
        candidato: pessoa(i + 1),
        categoria: "Saúde",
        modalidade_concorrencia: MODALIDADES[i % MODALIDADES.length],
        status_consolidado: status,
        etapa: feita ? "Análise" : "",
        responsavel_analise: feita ? pessoa((i % 6) + 50) : "",
        data_analise: feita
          ? `${String(1 + (i % 22)).padStart(2, "0")}/11/2026`
          : "",
        nota_final_ajustada: feita ? 50 + (i % 45) : null,
        pdf_status: "OK",
        tem_pdf: true,
      };
      return COLUNAS_DAS_ANALISES.map((c) => valores[c] ?? null);
    });
    return {
      schema_version: 4,
      scope: escopo,
      area,
      grupo: "SEDE",
      edital_status: escopo === "ativo" ? "Ativo" : "Inativo",
      versao: `v-analises-${cenario}-${escopo}`,
      columns: COLUNAS_DAS_ANALISES,
      rows,
      editais: editais.map((e) => ({
        grupo: "SEDE",
        unidade: e.unidade,
        edital: e.edital.replace("Edital ", ""),
        ativo: true,
        data_inicio_analise: "2026-11-03",
        data_fim_analise: "2026-11-28",
      })),
      total: rows.length,
      atualizado_em: "2026-11-23T10:45:00Z",
      generated_at: "2026-11-23T10:46:00Z",
    };
  });
}

/* ── Painéis de dados ────────────────────────────────────────────────── */

const TOTAL_DO_RELATORIO = 120;

function linhaDoRelatorio(relatorio, n, editais) {
  const e = editais[n % editais.length];
  const numero = e.edital.replace("Edital ", "");
  if (relatorio === "editais-por-cargo")
    return {
      edital: numero,
      unidade: e.unidade,
      codigo_vaga: `${1000 + n}`,
      cargo: CARGOS[n % CARGOS.length],
      vagas_imediatas: 1 + (n % 4),
      inscritos: 20 + ((n * 7) % 90),
      aprovados: n % 6,
    };
  if (relatorio === "aprovados")
    return {
      edital: numero,
      unidade: e.unidade,
      cargo: CARGOS[n % CARGOS.length],
      nota: Math.round((95 - (n % 30) * 1.5) * 10) / 10,
      classificacao: 1 + (n % 12),
      nome: pessoa(n + 1),
      status: ["Contratado", "Convocado", "", "Desistente"][n % 4],
      matricula: n % 4 === 0 ? `M-${1000 + n}` : null,
      data_contratacao: n % 4 === 0 ? dia("2026-10-01", n % 50) : null,
    };
  return {
    edital: numero,
    unidade: e.unidade,
    vagas_imediatas: 2 + (n % 15),
    data_divulgacao: dia("2026-03-02", n % 120),
    data_final: dia("2026-11-30", n % 60),
  };
}

/** `ler_relatorio_do_painel(p_area, p_relatorio, p_pagina, p_por_pagina)`: uma página. */
function relatorioDoPainel(cenario, area) {
  if (cenario === "erro") return ERRO_500;
  return comArgumentos(({ p_relatorio, p_pagina, p_por_pagina }) => {
    const total = cenario === "vazio" ? 0 : TOTAL_DO_RELATORIO;
    const pagina = Number(p_pagina) || 1;
    const porPagina = Number(p_por_pagina) || total;
    const inicio = (pagina - 1) * porPagina;
    const quantas = Math.max(0, Math.min(porPagina, total - inicio));
    const editais = editaisDaBase(area);
    return {
      schema_version: 4,
      area,
      relatorio: p_relatorio,
      linhas: Array.from({ length: quantas }, (_, k) => ({
        posicao: inicio + k + 1,
        ...linhaDoRelatorio(p_relatorio, inicio + k, editais),
      })),
      total,
      pagina,
      por_pagina: p_por_pagina ?? null,
      calculado_em: "2026-11-23T10:00:00Z",
      fontes: {},
      avisos: [],
    };
  });
}

/* ── Configurações › Acessos ─────────────────────────────────────────── */

const MODULOS = [
  "dashboard",
  "analises",
  "avaliacao_documental",
  "nucleo",
  "calendario",
  "aprovados",
  "entrevistas",
  "classificacao",
  "recursos",
  "selecao",
  "paineis_dados",
  "configuracoes",
  "acessos",
];
const celula = (nivel, origem = "grupo", nivelDoGrupo = nivel) => ({
  nivel,
  origem,
  nivel_grupo: nivelDoGrupo,
  revisao: 0,
});
const niveisDoGrupo = (nivel) =>
  Object.fromEntries(
    MODULOS.map((m) => [
      m,
      ["configuracoes", "acessos"].includes(m) ? "sem_acesso" : nivel,
    ]),
  );
const GRUPOS_DE_ACESSO = [
  {
    codigo: "usuario",
    nome: "Usuário",
    sistema: true,
    revisao: 1,
    usuarios: 38,
    niveis: niveisDoGrupo("leitor"),
  },
  {
    codigo: "editor",
    nome: "Editor",
    revisao: 1,
    usuarios: 16,
    niveis: niveisDoGrupo("editor"),
  },
  {
    codigo: "coordenador",
    nome: "Coordenador",
    revisao: 1,
    usuarios: 8,
    niveis: { ...niveisDoGrupo("editor"), acessos: "editor" },
  },
  {
    codigo: "admin",
    nome: "Administrador global",
    admin_global: true,
    sistema: true,
    revisao: 1,
    usuarios: 2,
    niveis: {},
  },
];
const AREAS_DE_ACESSO = [
  { id: "saude-indigena", titulo: "Saúde Indígena" },
  { id: "sede", titulo: "SEDE" },
  { id: "projetos", titulo: "Projetos" },
];
const COORDENACOES = ["Norte", "Sul", "Centro", "Leste"].map((nome, i) => ({
  codigo: nome.toLowerCase(),
  nome: `Coordenação de Teste ${nome}`,
  area: AREAS_DE_ACESSO[i % 3].id,
  ativo: true,
  unidades: [],
  editais: [],
  usuarios: 6 + i,
  revisao: 1,
}));
const TOTAL_DE_PESSOAS = 64;

/** `obter_matriz_acessos(p_busca, p_offset, …)`: uma página de 30 pessoas. */
function matrizDeAcessos(cenario) {
  if (cenario === "erro") return ERRO_500;
  return comArgumentos(({ p_offset: offset = 0 }) => {
    const total = cenario === "vazio" ? 0 : TOTAL_DE_PESSOAS;
    const quantas = Math.max(0, Math.min(30, total - offset));
    return {
      usuarios: Array.from({ length: quantas }, (_, k) => {
        const n = offset + k + 1;
        const grupo = GRUPOS_DE_ACESSO[n % 3];
        const area = AREAS_DE_ACESSO[n % 3].id;
        return {
          id: `usuario-${tres(n)}`,
          nome: pessoa(n),
          email: email(n),
          grupo: grupo.codigo,
          coordenacao: n % 4 ? COORDENACOES[n % 4].codigo : null,
          revisao_conta: `r${n}`,
          admin_global: false,
          ativo: true,
          cadastrado_em: "2026-08-01T12:00:00Z",
          ultimo_acesso:
            n % 5 ? `${dia("2026-11-01", n % 22)}T14:00:00Z` : null,
          convite_pendente: n % 9 === 0,
          areas_efetivas: [area],
          permissoes: {
            [`area:${area}`]: celula("leitor", "excecao", "sem_acesso"),
            ...Object.fromEntries(
              Object.entries(grupo.niveis).map(([m, nivel]) => [
                m,
                celula(nivel),
              ]),
            ),
          },
        };
      }),
      total,
      areas: AREAS_DE_ACESSO,
      paineis: [],
      grupos: GRUPOS_DE_ACESSO,
      coordenacoes: COORDENACOES,
      teto: {
        admin_global: true,
        usuario_id: "00000000-0000-4000-8000-000000000001",
        coordenacao: null,
        niveis: {},
        paineis: [],
      },
      historico: [],
    };
  });
}

/** `listar_solicitacoes_acesso`: os pedidos pendentes. */
function solicitacoesDeAcesso(cenario) {
  if (cenario === "erro") return ERRO_500;
  if (cenario === "vazio") return [];
  return Array.from({ length: 6 }, (_, i) => ({
    id: `pedido-${i + 1}`,
    nome: pessoa(i + 300),
    email: email(i + 300),
    setor: "Setor de Teste",
    justificativa: "Acompanhar os processos seletivos da área.",
    created_at: `${dia("2026-11-15", i)}T10:00:00Z`,
    coordenacao: COORDENACOES[i % 4].codigo,
    coordenacao_nome: COORDENACOES[i % 4].nome,
    area: AREAS_DE_ACESSO[i % 3].id,
    area_nome: AREAS_DE_ACESSO[i % 3].titulo,
    cargo: "analista",
    cargo_rotulo: "Analista",
    reativacao: i === 5,
  }));
}

/** `listar_contas_desativadas(p_busca)`: `{ contas }`. */
function contasDesativadas(cenario) {
  if (cenario === "erro") return ERRO_500;
  return {
    contas: Array.from({ length: cenario === "vazio" ? 0 : 8 }, (_, i) => ({
      id: `desativada-${i + 1}`,
      nome: pessoa(i + 400),
      email: email(i + 400),
      desativada_em: `${dia("2026-10-01", i * 4)}T12:00:00Z`,
      desativada_por: email(1),
      motivo: "Encerramento do contrato (teste)",
      grupo: "usuario",
      grupo_nome: "Usuário",
      coordenacao: null,
      areas: [AREAS_DE_ACESSO[i % 3].id],
      pedido_pendente: i === 0,
    })),
  };
}

/* ── Tudo junto ──────────────────────────────────────────────────────── */

export function rpcsDaAuditoria(cenario, area) {
  const vazioOuErro = (vazio) => (cenario === "erro" ? ERRO_500 : vazio);
  return {
    // Cronograma e página do edital
    listar_etapas_do_cronograma: etapasDoCronograma(cenario),
    get_monitoramento_cronograma: cronogramaDoEdital(cenario, area),
    listar_demandas_internas: demandasInternas(cenario, area),
    // Avisos de conferência (selo das telas e página do edital): nenhum aberto.
    listar_avisos_conferencia_se_mudou: vazioOuErro({
      versao: "v-avisos",
      gerado_em: "2026-11-23T06:00:00Z",
      avisos: [],
    }),
    // Visão geral, mapas e página do edital
    listar_vagas_por_cargo_da_visao_geral: vagasPorCargo(cenario),
    // Editais
    listar_editais_com_cronograma_encerrado: encerradosDoCronograma(
      cenario,
      area,
    ),
    listar_listas_aprovados: listasAprovados(cenario, area),
    // Aprovados (a abertura numa chamada e as chamadas de antes)
    abrir_lista_aprovados: abrirListaAprovados(cenario, area),
    listar_candidatos_aprovados_compacto:
      cenario === "erro"
        ? ERRO_500
        : pacoteDeAprovados(
            area,
            cenario === "vazio" ? [] : listasAprovados(cenario, area),
          ),
    listar_modelos_convocacao: vazioOuErro([]),
    listar_configuracao_convocacao: vazioOuErro([]),
    listar_anexos_candidatos_aprovados: vazioOuErro([]),
    listar_convocacoes_aprovados: vazioOuErro([]),
    listar_pendencias_do_edital: vazioOuErro(pendenciasDoEdital(area)),
    // Recursos e painéis por área
    get_recursos_da_area: recursosDaArea(cenario, area),
    get_entrevistas_da_area_se_mudou: entrevistasDaArea(cenario, area),
    get_selecao_da_area_se_mudou: selecaoDaArea(cenario, area),
    // Telas por edital: a lista de editais
    listar_editais_entrevista: editaisDaEntrevista(cenario, area),
    listar_editais_classificacao: editaisDaClassificacao(cenario, area),
    listar_editais_avaliacao: editaisDaAvaliacao(cenario, area),
    // Análises curriculares
    usuario_pode_ler_analises: vazioOuErro(true),
    get_analises_dashboard_payload_v2_se_mudou: analisesDaArea(cenario, area),
    obter_ultima_conferencia: vazioOuErro("2026-11-23T10:40:00Z"),
    // Sem ritmo: o card some (como no teste da tela).
    obter_ritmo_da_analise: vazioOuErro(null),
    // Painéis de dados
    ler_relatorio_do_painel: relatorioDoPainel(cenario, area),
    // Configurações › Acessos
    obter_matriz_acessos: matrizDeAcessos(cenario),
    listar_solicitacoes_acesso: solicitacoesDeAcesso(cenario),
    listar_contas_desativadas: contasDesativadas(cenario),
    listar_unidades_por_area: vazioOuErro(
      cenario === "vazio"
        ? []
        : Array.from({ length: 40 }, (_, i) => ({
            unidade: `Unidade de Teste ${tres(i + 1)}`,
            area: AREAS_DE_ACESSO[i % 3].id,
          })),
    ),
  };
}
