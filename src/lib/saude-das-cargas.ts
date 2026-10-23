import type {
  Carga,
  SaudeNormalizada,
  SituacaoDaCarga,
  ExecucaoDaCarga,
  LinhaDaSaude,
} from "../componentes/saude-das-cargas/tipos.ts";
import {
  chaveDaLinha,
  chavesPorTarefa,
  type ChaveDaAutomacao,
  type ChavesDaAutomacao,
} from "./chaves-da-automacao.ts";
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
    Desligada       a chave da aba está desligada em Configurações › Automação
                    (20261022190000): não conta como atraso nem como falha.
  Carga sem prazo (a completa das análises e o robô da Empregare, que rodam
  quando alguém pede) só
  fica "em dia" ou "falhou".

  OS PRAZOS (folga sobre o esperado, decisão de 01/10/2026)
    Análises, incremental   esperado a cada 20 min · atrasada depois de 1 h
    Entrevistas             esperado de hora em hora, o dia todo (decisão de 06/10/2026) ·
                            atrasada depois de 4 h
    Seleção                 às 8h10, 13h10 e 18h10 de Brasília (decisão de 07/10/2026) ·
                            atrasada depois de 15 h (a noite inteira sem carga é esperada)
    Robô da Empregare       sem prazo: só roda pelo "Rodar agora" (decisão de 05/10/2026)
    Classificação em Python sem prazo: roda quando uma lista é gerada (o relatório de
                            desempate) e quando alguém clica em Gerar com a chave "Gerar
                            listas pelo Python" ligada (o cálculo). O selo sai de cada lista
                            (get_saude_das_cargas.classificacao_python, 20261023200000): falhou
                            quando a mais recente terminada falhou, não conferiu ou não chegou
                            ao GitHub, ou quando o pedido espera o job há mais que o limite
                            (relatório 30 min, cálculo 15 min)
    Conferências            todo dia às 6h (Brasília) · atrasada depois de 26 h
    Agenda dos robôs        o banco pede cada execução ao GitHub (pg_cron + pg_net,
                            20261008140000): falhou se o último pedido foi recusado ou se
                            não há chave no Vault; atrasada sem pedido aceito há 2 h
    Tarefas a cada poucos min  atrasada depois de 15 min (ex.: o pacote do Painel de
                            análises, a cada 5 min desde 20261024100000)
    Tarefas diárias         atrasada depois de 26 h; mensais, depois de 32 dias
*/

const MINUTO = 60 * 1000;
export const PRAZO_ANALISES_MIN = 60;
export const PRAZO_DIARIO_MIN = 26 * 60;
export const PRAZO_FREQUENTE_MIN = 15;
export const PRAZO_MENSAL_MIN = 32 * 24 * 60;
export const PRAZO_DE_HORA_EM_HORA_MIN = 4 * 60;
export const PRAZO_SELECAO_MIN = 15 * 60;
export const PRAZO_AGENDA_DOS_ROBOS_MIN = 2 * 60;
/* Classificação em Python: depois disto, o pedido que ainda espera o job conta como falha. */
export const ESPERA_DO_RELATORIO_MIN = 30;
export const ESPERA_DO_CALCULO_MIN = 15;

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
  desligada: Object.freeze({
    rotulo: "Desligada pelo administrador",
    tom: "neutro",
    ordem: 5,
  }),
});

const NOMES_DAS_AREAS: Readonly<Record<string, string>> = Object.freeze({
  "saude-indigena": "Saúde Indígena",
  sede: "SEDE",
  projetos: "Projetos",
});

/* As tarefas agendadas do banco (pg_cron), com nome de gente. */
const TAREFAS: Readonly<Record<string, string>> = Object.freeze({
  agsus_analises_cache_do_painel: "Painel de análises (pacote pronto)",
  agsus_aprovados_cache_por_area: "Lista de aprovados (pacote por área)",
  agsus_entrevistas_cache_do_painel: "Painel de entrevistas (pacote pronto)",
  agsus_analises_analyze_diario: "Estatísticas das tabelas de análises",
  agsus_eventos_acesso_limpeza_mensal: "Limpeza do registro de acessos",
  agsus_analises_encerrar_inativas: "Encerrar cargas de análises paradas",
  agsus_robo_sincronizar_entrevistas: "Agenda: pedir a carga das Entrevistas",
  agsus_robo_sincronizar_selecao: "Agenda: pedir a carga da Seleção",
  agsus_robo_conferencias: "Agenda: pedir as conferências",
  agsus_robo_conferir_disparos: "Agenda: conferir as respostas do GitHub",
  agsus_kpis_do_edital_pela_selecao: "KPIs do edital pela Seleção",
  agsus_fila_estatisticas: "Estatísticas da fila da Avaliação documental",
  agsus_analises_limpar_manifesto:
    "Limpeza do manifesto das cargas de análises",
});

/* Os workflows que o banco pede ao GitHub (lista fixa de FC_DISPARAR_ROBO). */
const NOMES_DOS_WORKFLOWS: Readonly<Record<string, string>> = Object.freeze({
  "sincronizar-entrevistas.yml": "Entrevistas",
  "sincronizar-selecao.yml": "Seleção",
  "conferencias.yml": "Conferências",
  "robo-empregare.yml": "Robô da Empregare",
  "pre-classificacao.yml": "Pré-classificação",
  // Só pelo Run workflow do GitHub (registrar_disparo_externo, 20261022170000).
  "leitura-de-arquivos.yml": "Leitura dos arquivos",
  "classificacao.yml": "Classificação em Python",
});

/* O estado de cada tipo de execução, em ok / falha / andamento. */
const ESTADOS = Object.freeze({
  analise: { ok: ["processado"], falha: ["erro"] },
  planilha: { ok: ["CONCLUIDA"], falha: ["RECUSADA"] },
  robo: { ok: ["CONCLUIDA"], falha: ["FALHOU", "PARCIAL"] },
  conferencia: { ok: ["CONCLUIDA"], falha: ["FALHOU", "PARCIAL"] },
  tarefa: { ok: ["succeeded"], falha: ["failed"] },
  // INICIADO: execução iniciada direto no GitHub (origem GITHUB, 20261020170000).
  disparo: { ok: ["ACEITO", "INICIADO"], falha: ["FALHOU", "SEM_TOKEN"] },
  // Classificação em Python (20261023200000): cada lista é uma execução.
  relatorio: {
    ok: ["PRONTO"],
    falha: ["NAO_CONFERE", "FALHOU", "SEM_DISPARO", "SEM_RESPOSTA"],
  },
  calculo: {
    ok: ["PRONTO", "REGISTRADO"],
    falha: ["NAO_CONFERE", "FALHOU", "SEM_DISPARO", "SEM_RESPOSTA"],
  },
});

const registro = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const registros = (valor: unknown): Record<string, unknown>[] =>
  (Array.isArray(valor) ? valor : [])
    .filter(
      (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v),
    )
    .map(registro);
const rotulo = (
  mapa: Readonly<Record<string, string>>,
  chave: string,
): string => (Object.hasOwn(mapa, chave) ? (mapa[chave] ?? "") : "");
const texto = (valor: unknown): string =>
  typeof valor === "string" ||
  typeof valor === "number" ||
  typeof valor === "boolean"
    ? String(valor).trim()
    : "";
const data = (valor: unknown): Date | null => {
  if (
    !(
      typeof valor === "string" ||
      typeof valor === "number" ||
      valor instanceof Date
    ) ||
    !valor
  )
    return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};
const inteiro = (valor: unknown) => {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
};

function normalizarExecucao(
  entrada: unknown,
  tipo: keyof typeof ESTADOS,
): ExecucaoDaCarga {
  const bruta = registro(entrada);
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
    // Análises: o banco encerrou a carga parada há mais de 30 min (20261007170000).
    encerradaPorInatividade: bruta?.encerrada_por_inatividade === true,
  };
}

/** O prazo (min) de uma tarefa do pg_cron pela agenda dela; `null` sem regra. */
export function prazoDaAgenda(agenda: unknown) {
  const partes = texto(agenda).split(/\s+/);
  if (partes.length !== 5) return null;
  const [minuto = "", hora = "", dia = ""] = partes;
  if (hora === "*" && dia === "*" && /^(\*|\d+-\d+)\/\d+$|^\*$/.test(minuto))
    return PRAZO_FREQUENTE_MIN;
  if (dia === "*" && /^\d+$/.test(hora)) return PRAZO_DIARIO_MIN;
  if (/^\d+$/.test(dia)) return PRAZO_MENSAL_MIN;
  return null;
}

/** O selo de uma carga pelas execuções (mais recente primeiro) e o prazo. */
export function situacaoDaCarga(
  execucoes: readonly ExecucaoDaCarga[],
  prazoMin: number | null,
  agora = new Date(),
): {
  situacao: SituacaoDaCarga;
  ultimaOk: ExecucaoDaCarga | null;
  idadeMin: number | null;
} {
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
  if (prazoMin && idadeMin !== null && idadeMin > prazoMin)
    return { situacao: "atrasada", ultimaOk, idadeMin };
  return { situacao: "em_dia", ultimaOk, idadeMin };
}

const QUEM_DISPAROU: Readonly<Record<string, string>> = Object.freeze({
  AGENDA: "agenda",
  MONITORA: "Rodar agora",
  GITHUB: "GitHub",
  ROBO: "fim do robô da Empregare",
  MANUAL: "SQL direto",
});

/* Execução do robô da Empregare: as contagens de vagas entram na mensagem. */
function execucaoDoRobo(entrada: unknown) {
  const bruta = registro(entrada);
  const n = (campo: string) => inteiro(bruta?.[campo]) ?? 0;
  const partes = [
    `${n("vagas_pedidas")} vagas pedidas`,
    `${n("vagas_baixadas")} baixadas`,
    `${n("vagas_falha")} com falha`,
    `${n("vagas_recusadas")} recusadas`,
  ];
  const quem = rotulo(QUEM_DISPAROU, texto(bruta?.disparo));
  if (quem) partes.push(`disparo: ${quem}`);
  const mensagem = texto(bruta?.mensagem);
  return {
    ...bruta,
    mensagem: `${partes.join(" · ")}${mensagem ? `. ${mensagem}` : ""}`,
  };
}

/* Execução das conferências: os avisos entram na mensagem. */
function execucaoDaConferencia(entrada: unknown) {
  const bruta = registro(entrada);
  const n = (campo: string) => inteiro(bruta?.[campo]) ?? 0;
  const partes = [
    `${n("novos")} avisos novos`,
    `${n("abertos")} abertos`,
    `${n("resolvidos")} resolvidos`,
  ];
  const falhas = Array.isArray(bruta?.falhas) ? bruta.falhas.length : 0;
  if (falhas) partes.push(`${falhas} conferências falharam`);
  const quem = rotulo(QUEM_DISPAROU, texto(bruta?.disparo));
  if (quem) partes.push(`disparo: ${quem}`);
  const mensagem = texto(bruta?.mensagem);
  return {
    ...bruta,
    mensagem: `${partes.join(" · ")}${mensagem ? `. ${mensagem}` : ""}`,
  };
}

/* Execução da pré-classificação: editais, vagas e o lote entram na mensagem. */
function execucaoDaPreClassificacao(entrada: unknown) {
  const bruta = registro(entrada);
  const n = (campo: string) => inteiro(bruta?.[campo]) ?? 0;
  const partes = [
    `${n("editais")} editais`,
    `${n("vagas")} vagas`,
    `${n("lote")} no lote`,
  ];
  if (bruta?.refazer) partes.push("lote refeito");
  const quem = rotulo(QUEM_DISPAROU, texto(bruta?.disparo));
  if (quem) partes.push(`disparo: ${quem}`);
  const mensagem = texto(bruta?.mensagem);
  return {
    ...bruta,
    mensagem: `${partes.join(" · ")}${mensagem ? `. ${mensagem}` : ""}`,
  };
}

/*
  Uma lista da Classificação em Python (o preparo do relatório ou o pedido de
  cálculo): o edital e o tipo entram na mensagem; ainda esperando o job há mais
  que o limite, conta como falha (SEM_RESPOSTA: o job não pegou o pedido).
*/
function itemDaClassificacao(entrada: unknown, limiteMin: number, agora: Date) {
  const bruta = registro(entrada);
  const situacao = texto(bruta?.situacao);
  const esperando = ["PEDIDO", "PREPARANDO", "CALCULANDO"].includes(situacao);
  const inicio = data(bruta?.inicio);
  const parado =
    esperando &&
    inicio !== null &&
    agora.getTime() - inicio.getTime() > limiteMin * MINUTO;
  const partes = [texto(bruta?.edital), texto(bruta?.tipo)].filter(Boolean);
  const mensagem = parado
    ? `Sem resposta do job há mais de ${limiteMin} min.`
    : texto(bruta?.mensagem);
  if (mensagem) partes.push(mensagem);
  return {
    inicio: bruta?.inicio,
    fim: esperando ? null : bruta?.fim,
    situacao: parado ? "SEM_RESPOSTA" : situacao,
    linhas: null,
    mensagem: partes.join(" · "),
  };
}

/* Pedido da agenda ao GitHub: o robô e o código HTTP entram na mensagem. */
function execucaoDoDisparo(entrada: unknown) {
  const bruta = registro(entrada);
  const workflow = texto(bruta?.workflow);
  const http = inteiro(bruta?.http);
  const partes = [rotulo(NOMES_DOS_WORKFLOWS, workflow) || workflow || "Robô"];
  // A origem (20261020170000): AGENDA sem rótulo; GITHUB com quem iniciou.
  const origem = texto(bruta?.origem);
  const ator = texto(bruta?.ator);
  if (origem === "MONITORA") partes.push("Rodar agora");
  else if (origem === "MANUAL") partes.push("SQL direto, sem usuário");
  else if (origem === "GITHUB")
    partes.push(ator ? `iniciada no GitHub por ${ator}` : "iniciada no GitHub");
  if (http !== null) partes.push(`HTTP ${http}`);
  const mensagem = texto(bruta?.mensagem);
  if (mensagem) partes.push(mensagem);
  return { ...bruta, linhas: null, mensagem: partes.join(" · ") };
}

/*
  A agenda dos robôs (get_saude_das_cargas.agenda_dos_robos, 20261008140000):
  sem chave no Vault, falhou; senão, o selo pelos pedidos — o último fechado
  recusado é falha e, sem pedido aceito há mais de 2 h, atrasada (a conta usa
  o último aceito do banco, que pode ser anterior aos 20 pedidos da lista).
*/
function montarAgenda(entrada: unknown, agora: Date): Carga {
  const bruta = registro(entrada);
  const carga = montarCarga(
    {
      id: "agenda_dos_robos",
      nome: "Agenda dos robôs",
      onde: "Banco (pg_cron + pg_net) → GitHub Actions",
      esperado: "Entrevistas de hora em hora; Seleção às 8h10, 13h10 e 18h10",
      prazoMin: PRAZO_AGENDA_DOS_ROBOS_MIN,
      tipo: "disparo",
      execucoes: registros(bruta.disparos).map(execucaoDoDisparo),
    },
    agora,
  );
  const chaveCadastrada =
    typeof bruta?.chave_cadastrada === "boolean"
      ? bruta.chave_cadastrada
      : null;
  const ultimoAceito = data(bruta?.ultimo_aceito);
  const idadeMin = ultimoAceito
    ? Math.max(
        0,
        Math.floor((agora.getTime() - ultimoAceito.getTime()) / MINUTO),
      )
    : carga.idadeMin;
  const ultimaFechada = carga.historico.find((e) => e.situacao !== "andamento");
  let situacao = carga.situacao;
  if (chaveCadastrada === false || ultimaFechada?.situacao === "falha")
    situacao = "falhou";
  else if (ultimoAceito)
    situacao =
      idadeMin !== null && idadeMin > PRAZO_AGENDA_DOS_ROBOS_MIN
        ? "atrasada"
        : "em_dia";
  return {
    ...carga,
    situacao,
    idadeMin,
    ultimaOk: ultimoAceito
      ? carga.ultimaOk || { inicio: ultimoAceito, fim: ultimoAceito }
      : carga.ultimaOk,
    agenda: {
      chaveCadastrada,
      ultimoAceito,
      falhas24h: inteiro(bruta?.falhas_24h) ?? 0,
      semChave24h: inteiro(bruta?.sem_chave_24h) ?? 0,
    },
  };
}

function montarCarga(
  {
    id,
    nome,
    onde,
    esperado,
    prazoMin,
    tipo,
    execucoes,
  }: {
    id: string;
    nome: string;
    onde: string;
    esperado: string;
    prazoMin: number | null;
    tipo: keyof typeof ESTADOS;
    execucoes: unknown;
  },
  agora: Date,
): Carga {
  const lista = registros(execucoes)
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
export function normalizarSaude(
  entrada: unknown,
  agora = new Date(),
): SaudeNormalizada {
  const dados = registro(entrada);
  const analises = registros(dados.analises).map((o) => {
    const incremental = texto(o?.tipo).toUpperCase() === "INCREMENTAL";
    const area =
      rotulo(NOMES_DAS_AREAS, texto(o?.area)) ||
      texto(o?.planilha) ||
      texto(o?.area);
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
  });

  const planilhas = [
    montarCarga(
      {
        id: "entrevistas",
        nome: "Entrevistas",
        onde: "GitHub Actions · Sincronizar entrevistas",
        esperado: "de hora em hora, o dia todo",
        prazoMin: PRAZO_DE_HORA_EM_HORA_MIN,
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
        esperado: "às 8h10, 13h10 e 18h10",
        prazoMin: PRAZO_SELECAO_MIN,
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
            esperado: "quando um administrador pede",
            prazoMin: null,
            tipo: "robo",
            execucoes: registros(dados.empregare).map(execucaoDoRobo),
          },
          agora,
        ),
      ]
    : [];

  // As conferências só aparecem depois da migration 20261005210000 (a chave vem no payload).
  if (Array.isArray(dados?.conferencias))
    robos.push(
      montarCarga(
        {
          id: "conferencias",
          nome: "Conferências de consistência",
          onde: "GitHub Actions · Conferências de consistência",
          esperado: "todo dia às 6h",
          prazoMin: PRAZO_DIARIO_MIN,
          tipo: "conferencia",
          execucoes: registros(dados.conferencias).map(execucaoDaConferencia),
        },
        agora,
      ),
    );

  // A pré-classificação só aparece depois da migration 20261006110000 (a chave vem no payload).
  if (Array.isArray(dados?.pre_classificacao))
    robos.push(
      montarCarga(
        {
          id: "pre_classificacao",
          nome: "Pré-classificação (Avaliação documental)",
          onde: "GitHub Actions · Pré-classificação da Avaliação documental",
          esperado: "no fim do robô da Empregare e no Recalcular",
          prazoMin: null,
          tipo: "conferencia",
          execucoes: registros(dados.pre_classificacao).map(
            execucaoDaPreClassificacao,
          ),
        },
        agora,
      ),
    );

  // A Classificação em Python só aparece depois da migration 20261023200000 (a chave vem no payload).
  const classificacao = registro(dados?.classificacao_python);
  if (Object.keys(classificacao).length)
    robos.push(
      montarCarga(
        {
          id: "classificacao_desempate",
          nome: "Relatório de desempate (Classificação em Python)",
          onde: "GitHub Actions · Classificação em Python",
          esperado: "quando uma lista é gerada na Classificação",
          prazoMin: null,
          tipo: "relatorio",
          execucoes: registros(classificacao.relatorios).map((r) =>
            itemDaClassificacao(r, ESPERA_DO_RELATORIO_MIN, agora),
          ),
        },
        agora,
      ),
      montarCarga(
        {
          id: "classificacao_calculo",
          nome: "Cálculo das listas pelo Python",
          onde: "GitHub Actions · Classificação em Python",
          esperado: "quando alguém clica em Gerar na Classificação",
          prazoMin: null,
          tipo: "calculo",
          execucoes: registros(classificacao.calculos).map((c) =>
            itemDaClassificacao(c, ESPERA_DO_CALCULO_MIN, agora),
          ),
        },
        agora,
      ),
    );

  // A agenda só aparece depois da migration 20261008140000 (a chave vem no payload).
  const agenda =
    dados?.agenda_dos_robos &&
    typeof dados.agenda_dos_robos === "object" &&
    !Array.isArray(dados.agenda_dos_robos)
      ? [montarAgenda(dados.agenda_dos_robos, agora)]
      : [];

  const tarefasDisponiveis = Array.isArray(dados?.tarefas);
  const tarefas = registros(dados.tarefas).map((t) => {
    const nome = texto(t?.nome);
    const ativa = t?.ativa !== false;
    return {
      ...montarCarga(
        {
          id: `tarefa:${nome}`,
          nome: rotulo(TAREFAS, nome) || nome,
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
        "Entrevistas de hora em hora; Seleção às 8h10, 13h10 e 18h10. Rodar agora: o botão de cada uma (ou GitHub → Actions → Run workflow).",
      cargas: planilhas,
    },
    {
      id: "robos",
      titulo: "Robô da Empregare e conferências",
      descricao:
        "Candidatos de cada vaga, do Excel exportado da Empregare, quando um administrador pede (Rodar agora); conferências de consistência todo dia às 6h.",
      cargas: robos,
    },
    {
      id: "agenda",
      titulo: "Agenda dos robôs",
      descricao:
        "O banco pede ao GitHub cada execução agendada dos robôs, na hora certa.",
      cargas: agenda,
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
  for (const c of todas) resumo[c.situacao] = (resumo[c.situacao] ?? 0) + 1;

  return {
    geradoEm: data(dados?.gerado_em),
    grupos,
    resumo,
    total: todas.length,
  };
}

/**
 * Marca da última conferência de consistência (início e fim, ISO): muda só
 * quando uma conferência nova começa ou termina. O cartão "Avisos de
 * conferência" relê os avisos quando ela muda, e não a cada releitura da tela.
 */
export function marcaDasConferencias(
  saude: Pick<SaudeNormalizada, "grupos"> | null | undefined,
) {
  const carga = (saude?.grupos || [])
    .flatMap((g) => g.cargas)
    .find((c) => c.id === "conferencias");
  const ultima = carga?.ultima;
  if (!ultima) return "";
  return `${ultima.inicio?.toISOString() ?? ""}|${ultima.fim?.toISOString() ?? ""}`;
}

/** "há 5 min", "há 3 h", "há 2 dias"; "—" sem data. */
export function textoDaIdade(minutos: number | null | undefined) {
  if (minutos === null || minutos === undefined) return "—";
  if (minutos < 1) return "agora há pouco";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} dias`;
}

/** "dd/mm/aaaa hh:mm" no fuso de quem usa; "—" sem data. */
export function dataHora(valor: unknown) {
  if (!valor) return "—";
  const d = data(valor);
  if (!d) return "—";
  if (Number.isNaN(d.getTime())) return "—";
  const dois = (n: number) => String(n).padStart(2, "0");
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
const GRAVIDADE: readonly SituacaoDaCarga[] = Object.freeze([
  "falhou",
  "atrasada",
  "em_andamento",
  "nunca",
  "em_dia",
  "desligada",
]);

const pior = (situacoes: SituacaoDaCarga[]) =>
  GRAVIDADE.find((s) => situacoes.includes(s)) || "em_dia";

const refDaCarga = (c: Carga) =>
  c.ultimaOk ? ((c.ultimaOk.fim || c.ultimaOk.inicio)?.getTime() ?? 0) : 0;

function juntar({
  id,
  titulo,
  explicacao,
  partes,
  situacoesQueContam,
}: {
  id: string;
  titulo: string;
  explicacao: string;
  partes: Carga[];
  situacoesQueContam: SituacaoDaCarga[];
}): LinhaDaSaude {
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
      ? {
          quando: erro.inicio,
          mensagem: erro.mensagem,
          parte: falha?.nome ?? "",
        }
      : null,
    partes,
  };
}

const ORDEM_DAS_AREAS = ["saude-indigena", "sede", "projetos"];

/* A linha de uma carga cuja chave está desligada: o selo diz isso, sem erro. */
function desligar(linha: LinhaDaSaude, chave: ChaveDaAutomacao | null) {
  if (!chave || chave.ligada) return linha;
  return {
    ...linha,
    situacao: "desligada" as const,
    erro: null,
    desligada: { motivo: chave.motivo, em: chave.em, por: chave.por },
  };
}

/**
 * Uma linha por aba. Com as chaves da automação (obter_chaves_da_automacao),
 * a carga desligada aparece como "Desligada pelo administrador".
 */
export function visaoSimples(
  saude: SaudeNormalizada,
  chaves: ChavesDaAutomacao | null = null,
): {
  linhas: LinhaDaSaude[];
  atencao: LinhaDaSaude[];
} {
  const porId = Object.fromEntries(saude.grupos.map((g) => [g.id, g]));
  const analises = porId.analises?.cargas || [];
  const areas = [
    ...new Set(
      analises
        .map((c) => c.area)
        .filter((area): area is string => typeof area === "string"),
    ),
  ].sort((a, b) => ORDEM_DAS_AREAS.indexOf(a) - ORDEM_DAS_AREAS.indexOf(b));

  const linhas = areas.map((area) => {
    const partes = analises.filter((c) => c.area === area);
    const nome = rotulo(NOMES_DAS_AREAS, area) || area;
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
      desligar(
        juntar({
          id: carga.id,
          titulo: carga.id === "selecao" ? "Seleção" : "Entrevistas",
          explicacao:
            carga.id === "selecao"
              ? "Atualiza a aba Seleção a partir da planilha Auditoria, às 8h10, 13h10 e 18h10."
              : "Atualiza a aba Entrevistas a partir da planilha de entrevistados, de hora em hora o dia todo.",
          partes: [carga],
          situacoesQueContam: [carga.situacao],
        }),
        chaveDaLinha(chaves, carga.id),
      ),
    );
  }

  const TEXTOS_DOS_ROBOS: Record<string, readonly [string, string]> = {
    empregare: [
      "Robô da Empregare",
      "Traz os candidatos de cada vaga dos editais em curso a partir da Empregare, quando um administrador clica em Rodar agora.",
    ],
    conferencias: [
      "Conferências de consistência",
      "Confere análises, entrevistas, classificação, aprovados e cargas e lista os avisos abaixo, todo dia às 6h.",
    ],
    pre_classificacao: [
      "Pré-classificação (Avaliação documental)",
      "Monta a Provisória por ART e o lote de convocação de cada vaga no fim do robô da Empregare e quando a coordenação clica em Recalcular.",
    ],
    classificacao_desempate: [
      "Relatório de desempate (Classificação em Python)",
      "Prepara o relatório de desempate de cada lista gerada na Classificação, pelo Python. Rodar agora reprocessa os pendentes.",
    ],
    classificacao_calculo: [
      "Cálculo das listas pelo Python",
      "Calcula a lista pedida pelo Gerar da Classificação; a tela confere com o cálculo dela antes de registrar.",
    ],
  };
  for (const carga of porId.robos?.cargas || []) {
    const [titulo, explicacao] = TEXTOS_DOS_ROBOS[carga.id] ||
      TEXTOS_DOS_ROBOS.empregare || [carga.nome, ""];
    linhas.push(
      desligar(
        juntar({
          id: carga.id,
          titulo,
          explicacao,
          partes: [carga],
          situacoesQueContam: [carga.situacao],
        }),
        chaveDaLinha(chaves, carga.id),
      ),
    );
  }

  for (const carga of porId.agenda?.cargas || []) {
    if (!carga.agenda) continue;
    const linha = juntar({
      id: carga.id,
      titulo: "Agenda dos robôs",
      explicacao:
        "O banco pede ao GitHub as cargas agendadas e as do Rodar agora, com a chave do Vault.",
      partes: [carga],
      situacoesQueContam: [carga.situacao],
    });
    // Entrevistas desligada: a agenda só pede as diárias (prazo de 26 h, não de 2 h).
    const soDiarias =
      linha.situacao === "atrasada" &&
      chaveDaLinha(chaves, "entrevistas")?.ligada === false &&
      carga.idadeMin !== null &&
      carga.idadeMin <= PRAZO_DIARIO_MIN;
    linhas.push({
      ...linha,
      situacao: soDiarias ? "em_dia" : linha.situacao,
      ultimaAtualizacao: carga.agenda.ultimoAceito || linha.ultimaAtualizacao,
      idadeMin: carga.idadeMin,
      agenda: carga.agenda,
    });
  }

  const tarefas = porId.tarefas;
  const porTarefa = chavesPorTarefa(chaves);
  const partesDasTarefas = (tarefas?.cargas || []).map((c) =>
    porTarefa.get(c.id.replace(/^tarefa:/, ""))?.ligada === false
      ? { ...c, situacao: "desligada" as const }
      : c,
  );
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
          partes: partesDasTarefas,
          situacoesQueContam: partesDasTarefas
            .filter((c) => c.ativa !== false && c.situacao !== "desligada")
            .map((c) => c.situacao),
        }),
  );

  const atencao = linhas.filter((l) =>
    ["falhou", "atrasada"].includes(l.situacao),
  );
  return { linhas, atencao };
}
