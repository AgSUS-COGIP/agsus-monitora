/*
  Status das atualizações (Configurações › Status das atualizações, só administrador global),
  sem React e sem banco: o que chega de `get_saude_das_cargas`
  (20261001120000_saude_das_cargas.sql) vira uma lista de cargas com um selo —
  em dia, atrasada, falhou, em andamento ou nunca rodou.

  A REGRA DO SELO (cada carga, pelas últimas execuções)
    Ainda sem carga nenhuma execução registrada (ex.: área sem planilha ainda).
    Falhou          a execução terminada mais recente deu erro (ou foi recusada).
    Em andamento    só há execução em curso, nenhuma terminada.
    Atrasada        a última que deu certo terminou há mais que o prazo.
    Em dia          a última que deu certo está dentro do prazo.
  Carga sem prazo (a completa das análises, que roda quando alguém pede) só
  fica "em dia" ou "falhou".

  OS PRAZOS (folga sobre o esperado, decisão de 01/10/2026)
    Análises, incremental   esperado a cada 20 min · atrasada depois de 1 h
    Entrevistas e Seleção   esperado todo dia às 9h · atrasada depois de 26 h
    Robô da Empregare       esperado de segunda a sexta às 6h30 (Brasília) ·
                            atrasada depois de 26 h; do sábado até segunda 9h,
                            depois de 74 h (o fim de semana não conta)
    Tarefas a cada 2 min    atrasada depois de 15 min
    Tarefas diárias         atrasada depois de 26 h; mensais, depois de 32 dias
*/

const MINUTO = 60 * 1000;
export const PRAZO_ANALISES_MIN = 60;
export const PRAZO_DIARIO_MIN = 26 * 60;
export const PRAZO_FREQUENTE_MIN = 15;
export const PRAZO_MENSAL_MIN = 32 * 24 * 60;
export const PRAZO_FIM_DE_SEMANA_MIN = 74 * 60;

/** Prazo do robô da Empregare (dias úteis): 74 h do sábado até segunda 9h de Brasília, 26 h no resto. */
export function prazoDosDiasUteis(agora = new Date()) {
  const brasilia = new Date(agora.getTime() - 3 * 60 * MINUTO);
  const dia = brasilia.getUTCDay();
  const fimDeSemana =
    dia === 6 || dia === 0 || (dia === 1 && brasilia.getUTCHours() < 9);
  return fimDeSemana ? PRAZO_FIM_DE_SEMANA_MIN : PRAZO_DIARIO_MIN;
}

export const SITUACOES = Object.freeze({
  em_dia: Object.freeze({ rotulo: "Em dia", tom: "sucesso", ordem: 4 }),
  atrasada: Object.freeze({ rotulo: "Atrasada", tom: "aviso", ordem: 1 }),
  falhou: Object.freeze({ rotulo: "Falhou", tom: "perigo", ordem: 0 }),
  em_andamento: Object.freeze({
    rotulo: "Em andamento",
    tom: "info",
    ordem: 2,
  }),
  nunca: Object.freeze({ rotulo: "Ainda sem carga", tom: "neutro", ordem: 3 }),
});

const NOMES_DAS_AREAS = Object.freeze({
  "saude-indigena": "Saúde Indígena",
  sede: "SEDE",
  projetos: "Projetos",
});

/* As tarefas agendadas do banco (pg_cron), com nome de gente. */
const TAREFAS = Object.freeze({
  agsus_analises_cache_do_painel: "Painel de análises (pacote pronto)",
  agsus_aprovados_cache_por_area: "Lista de aprovados (pacote por área)",
  agsus_entrevistas_cache_do_painel: "Painel de entrevistas (pacote pronto)",
  agsus_analises_analyze_diario: "Estatísticas das tabelas de análises",
  agsus_eventos_acesso_limpeza_mensal: "Limpeza do registro de acessos",
});

/* O estado de cada tipo de execução, em ok / falha / andamento. */
const ESTADOS = Object.freeze({
  analise: { ok: ["processado"], falha: ["erro"] },
  planilha: { ok: ["CONCLUIDA"], falha: ["RECUSADA"] },
  robo: { ok: ["CONCLUIDA"], falha: ["FALHOU", "PARCIAL"] },
  tarefa: { ok: ["succeeded"], falha: ["failed"] },
});

const texto = (valor) => String(valor ?? "").trim();

const data = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

const inteiro = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
};

function normalizarExecucao(bruta, tipo) {
  const situacaoBruta = texto(bruta?.situacao);
  const regra = ESTADOS[tipo];
  const situacao = regra.ok.includes(situacaoBruta)
    ? "ok"
    : regra.falha.includes(situacaoBruta)
      ? "falha"
      : "andamento";
  return {
    inicio: data(bruta?.inicio),
    fim: data(bruta?.fim),
    situacao,
    situacaoBruta,
    linhas: inteiro(bruta?.linhas),
    mensagem: texto(bruta?.mensagem) || null,
  };
}

/** O prazo (min) de uma tarefa do pg_cron pela agenda dela; `null` sem regra. */
export function prazoDaAgenda(agenda) {
  const partes = texto(agenda).split(/\s+/);
  if (partes.length !== 5) return null;
  const [minuto, hora, dia] = partes;
  if (hora === "*" && dia === "*" && /^(\*|\d+-\d+)\/\d+$|^\*$/.test(minuto))
    return PRAZO_FREQUENTE_MIN;
  if (dia === "*" && /^\d+$/.test(hora)) return PRAZO_DIARIO_MIN;
  if (/^\d+$/.test(dia)) return PRAZO_MENSAL_MIN;
  return null;
}

/** O selo de uma carga pelas execuções (mais recente primeiro) e o prazo. */
export function situacaoDaCarga(execucoes, prazoMin, agora = new Date()) {
  if (!execucoes.length)
    return { situacao: "nunca", ultimaOk: null, idadeMin: null };
  const ultimaTerminada = execucoes.find((e) => e.situacao !== "andamento");
  const ultimaOk = execucoes.find((e) => e.situacao === "ok") || null;
  const referencia = ultimaOk ? ultimaOk.fim || ultimaOk.inicio : null;
  const idadeMin = referencia
    ? Math.max(0, Math.floor((agora.getTime() - referencia.getTime()) / MINUTO))
    : null;
  if (ultimaTerminada?.situacao === "falha")
    return { situacao: "falhou", ultimaOk, idadeMin };
  if (!ultimaOk) return { situacao: "em_andamento", ultimaOk, idadeMin };
  if (prazoMin && idadeMin > prazoMin)
    return { situacao: "atrasada", ultimaOk, idadeMin };
  return { situacao: "em_dia", ultimaOk, idadeMin };
}

const QUEM_DISPAROU = Object.freeze({
  AGENDA: "agenda",
  MONITORA: "Rodar agora",
  GITHUB: "GitHub",
});

/* Execução do robô da Empregare: as contagens de vagas entram na mensagem. */
function execucaoDoRobo(bruta) {
  const n = (campo) => inteiro(bruta?.[campo]) ?? 0;
  const partes = [
    `${n("vagas_pedidas")} vagas pedidas`,
    `${n("vagas_baixadas")} baixadas`,
    `${n("vagas_falha")} com falha`,
    `${n("vagas_recusadas")} recusadas`,
  ];
  const quem = QUEM_DISPAROU[texto(bruta?.disparo)];
  if (quem) partes.push(`disparo: ${quem}`);
  const mensagem = texto(bruta?.mensagem);
  return {
    ...bruta,
    mensagem: `${partes.join(" · ")}${mensagem ? `. ${mensagem}` : ""}`,
  };
}

function montarCarga(
  { id, nome, onde, esperado, prazoMin, tipo, execucoes },
  agora,
) {
  const lista = (Array.isArray(execucoes) ? execucoes : [])
    .map((e) => normalizarExecucao(e, tipo))
    .sort((a, b) => (b.inicio?.getTime() ?? 0) - (a.inicio?.getTime() ?? 0));
  const { situacao, ultimaOk, idadeMin } = situacaoDaCarga(
    lista,
    prazoMin,
    agora,
  );
  return {
    id,
    nome,
    onde,
    esperado,
    prazoMin,
    situacao,
    ultima: lista[0] || null,
    ultimaOk,
    idadeMin,
    emAndamento: lista[0]?.situacao === "andamento",
    historico: lista,
  };
}

/** O payload de `get_saude_das_cargas` em grupos de cargas, com o resumo. */
export function normalizarSaude(dados, agora = new Date()) {
  const analises = (Array.isArray(dados?.analises) ? dados.analises : []).map(
    (o) => {
      const incremental = texto(o?.tipo).toUpperCase() === "INCREMENTAL";
      const area =
        NOMES_DAS_AREAS[texto(o?.area)] || texto(o?.planilha) || texto(o?.area);
      const carga = montarCarga(
        {
          id: `analises:${texto(o?.origem)}`,
          nome: `${area} · ${incremental ? "incremental" : "carga completa"}`,
          onde: "Apps Script da planilha de análises",
          esperado: incremental ? "a cada 20 min" : "quando alguém pede",
          prazoMin: incremental ? PRAZO_ANALISES_MIN : null,
          tipo: "analise",
          execucoes: o?.execucoes,
        },
        agora,
      );
      return { ...carga, area: texto(o?.area), incremental };
    },
  );

  const planilhas = [
    montarCarga(
      {
        id: "entrevistas",
        nome: "Entrevistas",
        onde: "GitHub Actions · Sincronizar entrevistas",
        esperado: "todo dia às 9h",
        prazoMin: PRAZO_DIARIO_MIN,
        tipo: "planilha",
        execucoes: dados?.entrevistas,
      },
      agora,
    ),
    montarCarga(
      {
        id: "selecao",
        nome: "Seleção (planilha Auditoria)",
        onde: "GitHub Actions · Sincronizar seleção",
        esperado: "todo dia às 9h",
        prazoMin: PRAZO_DIARIO_MIN,
        tipo: "planilha",
        execucoes: dados?.selecao,
      },
      agora,
    ),
  ];

  // O robô só aparece depois da migration 20261005170000 (a chave vem no payload).
  const robos = Array.isArray(dados?.empregare)
    ? [
        montarCarga(
          {
            id: "empregare",
            nome: "Robô da Empregare",
            onde: "GitHub Actions · Robô da Empregare",
            esperado: "de segunda a sexta às 6h30",
            prazoMin: prazoDosDiasUteis(agora),
            tipo: "robo",
            execucoes: dados.empregare.map(execucaoDoRobo),
          },
          agora,
        ),
      ]
    : [];

  const tarefasDisponiveis = Array.isArray(dados?.tarefas);
  const tarefas = (tarefasDisponiveis ? dados.tarefas : []).map((t) => {
    const nome = texto(t?.nome);
    const ativa = t?.ativa !== false;
    return {
      ...montarCarga(
        {
          id: `tarefa:${nome}`,
          nome: TAREFAS[nome] || nome,
          onde: `Banco (pg_cron) · ${nome}`,
          esperado: texto(t?.agenda),
          prazoMin: ativa ? prazoDaAgenda(t?.agenda) : null,
          tipo: "tarefa",
          execucoes: t?.execucoes,
        },
        agora,
      ),
      ativa,
    };
  });

  const grupos = [
    {
      id: "analises",
      titulo: "Análises curriculares",
      descricao:
        "Cargas das planilhas de análises (Apps Script): a incremental a cada 20 min e a completa quando alguém pede.",
      cargas: analises,
    },
    {
      id: "planilhas",
      titulo: "Planilhas pelo GitHub Actions",
      descricao:
        "Entrevistas e Seleção, todo dia às 9h. Rodar agora: o botão de cada uma (ou GitHub → Actions → Run workflow).",
      cargas: planilhas,
    },
    {
      id: "robos",
      titulo: "Robô da Empregare",
      descricao:
        "Candidatos de cada vaga, do Excel exportado da Empregare, de segunda a sexta às 6h30.",
      cargas: robos,
    },
    {
      id: "tarefas",
      titulo: "Tarefas automáticas do banco",
      descricao:
        "Pacotes prontos dos painéis, estatísticas e limpeza (pg_cron).",
      cargas: tarefas,
      indisponivel: !tarefasDisponiveis,
    },
  ];

  const todas = grupos.flatMap((g) => g.cargas);
  const resumo = Object.fromEntries(Object.keys(SITUACOES).map((s) => [s, 0]));
  for (const c of todas) resumo[c.situacao] += 1;

  return {
    geradoEm: data(dados?.gerado_em),
    grupos,
    resumo,
    total: todas.length,
  };
}

/** "há 5 min", "há 3 h", "há 2 dias"; "—" sem data. */
export function textoDaIdade(minutos) {
  if (minutos === null || minutos === undefined) return "—";
  if (minutos < 1) return "agora há pouco";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} dias`;
}

/** "dd/mm/aaaa hh:mm" no fuso de quem usa; "—" sem data. */
export function dataHora(valor) {
  if (!valor) return "—";
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/* ── Visão simples: uma linha por aba do sistema ─────────────────────── */

/*
  A tela mostra o que a pessoa reconhece (as abas e o banco), não cada script:
    Análises curriculares · <área>   a incremental e a completa da planilha
    Entrevistas, Seleção             uma carga cada
    Atualização automática do banco  todas as tarefas do pg_cron
  A situação da linha é a pior das partes. A completa das análises, que não tem
  horário, só pesa quando falhou; "nunca rodou" dela não é problema. "Ainda sem
  carga" (ex.: a SEDE, que ainda não tem planilha de análise) não pede atenção:
  só falha e atraso entram no aviso do topo.
*/
const GRAVIDADE = Object.freeze([
  "falhou",
  "atrasada",
  "em_andamento",
  "nunca",
  "em_dia",
]);

const pior = (situacoes) =>
  GRAVIDADE.find((s) => situacoes.includes(s)) || "em_dia";

const refDaCarga = (c) =>
  c.ultimaOk ? ((c.ultimaOk.fim || c.ultimaOk.inicio)?.getTime() ?? 0) : 0;

function juntar({ id, titulo, explicacao, partes, situacoesQueContam }) {
  const situacao = partes.length ? pior(situacoesQueContam) : "nunca";
  const maisRecente = [...partes].sort(
    (a, b) => refDaCarga(b) - refDaCarga(a),
  )[0];
  const falha = partes.find((p) => p.situacao === "falhou");
  const erro = falha?.historico.find((e) => e.situacao === "falha") || null;
  return {
    id,
    titulo,
    explicacao,
    situacao,
    ultimaAtualizacao:
      maisRecente?.ultimaOk?.fim || maisRecente?.ultimaOk?.inicio || null,
    idadeMin: maisRecente?.ultimaOk ? maisRecente.idadeMin : null,
    emAndamento: partes.some((p) => p.emAndamento),
    erro: erro
      ? { quando: erro.inicio, mensagem: erro.mensagem, parte: falha.nome }
      : null,
    partes,
  };
}

const ORDEM_DAS_AREAS = ["saude-indigena", "sede", "projetos"];

export function visaoSimples(saude) {
  const porId = Object.fromEntries(saude.grupos.map((g) => [g.id, g]));
  const analises = porId.analises?.cargas || [];
  const areas = [...new Set(analises.map((c) => c.area))].sort(
    (a, b) => ORDEM_DAS_AREAS.indexOf(a) - ORDEM_DAS_AREAS.indexOf(b),
  );

  const linhas = areas.map((area) => {
    const partes = analises.filter((c) => c.area === area);
    const nome = NOMES_DAS_AREAS[area] || area;
    return juntar({
      id: `analises:${area}`,
      titulo: `Análises curriculares · ${nome}`,
      explicacao: `Atualiza a aba Análises curriculares da ${nome} a partir da planilha, a cada 20 minutos.`,
      partes,
      situacoesQueContam: partes
        .filter((p) => p.incremental || p.situacao === "falhou")
        .map((p) => p.situacao),
    });
  });

  for (const carga of porId.planilhas?.cargas || []) {
    linhas.push(
      juntar({
        id: carga.id,
        titulo: carga.id === "selecao" ? "Seleção" : "Entrevistas",
        explicacao:
          carga.id === "selecao"
            ? "Atualiza a aba Seleção a partir da planilha Auditoria, todo dia às 9h."
            : "Atualiza a aba Entrevistas a partir da planilha de entrevistados, todo dia às 9h.",
        partes: [carga],
        situacoesQueContam: [carga.situacao],
      }),
    );
  }

  for (const carga of porId.robos?.cargas || []) {
    linhas.push(
      juntar({
        id: carga.id,
        titulo: "Robô da Empregare",
        explicacao:
          "Traz os candidatos de cada vaga dos editais em curso a partir da Empregare, de segunda a sexta às 6h30.",
        partes: [carga],
        situacoesQueContam: [carga.situacao],
      }),
    );
  }

  const tarefas = porId.tarefas;
  linhas.push(
    tarefas?.indisponivel
      ? {
          id: "tarefas",
          titulo: "Atualização automática do banco",
          explicacao: "O banco não deixou ler as tarefas agendadas.",
          situacao: "nunca",
          ultimaAtualizacao: null,
          idadeMin: null,
          emAndamento: false,
          erro: null,
          partes: [],
          indisponivel: true,
        }
      : juntar({
          id: "tarefas",
          titulo: "Atualização automática do banco",
          explicacao:
            "Prepara os painéis para abrirem rápido (a cada 2 minutos), além de estatísticas e limpeza.",
          partes: tarefas?.cargas || [],
          situacoesQueContam: (tarefas?.cargas || [])
            .filter((c) => c.ativa !== false)
            .map((c) => c.situacao),
        }),
  );

  const atencao = linhas.filter((l) =>
    ["falhou", "atrasada"].includes(l.situacao),
  );
  return { linhas, atencao };
}
