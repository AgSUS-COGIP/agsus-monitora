// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Banco,
  bancoDeHoje,
  constraintsDe,
  corposDasFuncoes,
  ENSAIO,
  entrar,
  erroDe,
  TAREFAS,
  estadoDoCron,
  MIGRATION,
  ROLLBACK,
  rodarArquivo,
  uma,
  USUARIO_COMUM,
  USUARIO_MASTER,
} from "./apoio/banco-dos-robos.ts";
import { CATALOGO_DOS_ROBOS } from "./fixtures/catalogo-dos-robos.ts";

/*
  Migration 20261109180000 (catálogo dos robôs e chave única) num Postgres de
  verdade (PGlite). Duas metades:

  1. NADA QUEBRA. Três bancos iguais ao de hoje: um fica como está, outro recebe
     a migration, outro recebe a migration e o rollback. As mesmas perguntas vão
     aos três e as respostas têm de ser as mesmas: cada workflow × origem ×
     entrada em FC_DISPARAR_ROBO (com o pedido que vai ao GitHub, letra por letra),
     com chave ligada e desligada, sem a chave do Vault e com o pg_net fora;
     registrar_disparo_externo; FC_CHAVE_DO_WORKFLOW e FC_CHAVE_DA_TAREFA de todo
     nome; alterar_chave_da_automacao numa sequência com todos os erros;
     obter_chaves_da_automacao; automacao_ligada; disparar_robo (Rodar agora).
     O rollback devolve ainda o corpo de cada função, as constraints e os
     comentários como eram.

  2. O QUE MUDA DE PROPÓSITO, com as guardas: o catálogo, a chave estrangeira,
     o alinhador da chave com o pg_cron, a tarefa nova, o RPC do catálogo, e a
     migration e o rollback que recusam o estado que não conhecem sem aplicar nada.
*/

const LONGO = 120_000;

const WORKFLOWS = [
  "sincronizar-entrevistas.yml",
  "sincronizar-selecao.yml",
  "conferencias.yml",
  "expurgo-anexos-chat.yml",
  "robo-empregare.yml",
  "pre-classificacao.yml",
  "leitura-de-arquivos.yml",
  "classificacao.yml",
  "contratacao-dos-aprovados.yml",
  "pacotes-dos-paineis.yml",
  "casamento-da-lista.yml",
];
const DISPARAVEIS = WORKFLOWS.filter(
  (w) => !["expurgo-anexos-chat.yml", "leitura-de-arquivos.yml"].includes(w),
);
const TODOS_OS_NOMES = [...WORKFLOWS, "nao-existe.yml", "", "CONFERENCIAS.YML"];
const ENTRADAS: unknown[] = [
  {},
  { modo: "normal" },
  { editais: "93/2026" },
  { vagas: "179698" },
  { limite: "5" },
  { anexos: "true" },
  { candidatos: "1" },
  { seco: "true" },
  { forcar_congelado: "x" },
  { listas: "x" },
  { pedido: "x" },
  { disparado_por: "x" },
  { modo: 1 },
  { modo: null },
  [],
  "texto",
  { modo: "x".repeat(20001) },
  {
    modo: "normal",
    editais: "1/2026",
    vagas: "1",
    limite: "2",
    anexos: "false",
  },
];
const ORIGENS = [
  ["MONITORA", USUARIO_MASTER, null],
  ["AGENDA", null, "AGENDA"],
  ["MANUAL", null, null],
] as const;
const MOTIVO = "Teste de regressão da chave da automação no banco";

interface Linha {
  [campo: string]: unknown;
}

/* Um pedido a FC_DISPARAR_ROBO: o que voltou, a linha gravada e o que foi ao pg_net. */
async function disparo(
  db: Banco,
  workflow: string | null,
  entrada: unknown,
  usuario: string | null,
  origem: string | null,
) {
  const antes = await uma<{ n: number }>(
    db,
    `select count(*)::int as n from net."PEDIDO"`,
  );
  let resposta: string;
  let id: number | null = null;
  try {
    const r = await uma<{ id: number | null }>(
      db,
      `select private."FC_DISPARAR_ROBO"($1, $2::jsonb, $3::uuid, $4) as id`,
      [
        workflow,
        entrada === undefined ? null : JSON.stringify(entrada),
        usuario,
        origem,
      ],
    );
    id = r?.id ?? null;
    resposta = id === null ? "nulo" : "id";
  } catch (e) {
    const erro = e as { code?: string; message?: string };
    resposta = `erro ${erro.code}: ${erro.message}`;
  }
  const linha = id
    ? await uma<Linha>(
        db,
        `select "NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DS_MENSAGEM",
                "CO_PEDIDO_HTTP" is not null as tem_pedido, "DT_RESPOSTA" is not null as respondeu
           from public."TL_DISPARO_ROBO" where "CO_DISPARO" = $1`,
        [id],
      )
    : null;
  const pedidos = await db.query<Linha>(
    `select url, body, headers, timeout from net."PEDIDO" order by id offset $1`,
    [antes?.n ?? 0],
  );
  return { resposta, linha, pedidos: pedidos.rows };
}

/* Todos os pedidos, nas condições do banco de hoje e nas variações. */
async function bateriaDeDisparos(db: Banco) {
  const saida: Record<string, unknown> = {};
  const rodar = async (rotulo: string, entradas: unknown[]) => {
    for (const workflow of [...TODOS_OS_NOMES, null])
      for (const [origem, usuario, pOrigem] of ORIGENS)
        for (const [i, entrada] of entradas.entries())
          saida[`${rotulo}|${workflow}|${origem}|${i}`] = await disparo(
            db,
            workflow,
            entrada,
            usuario,
            pOrigem,
          );
  };
  await rodar("hoje", ENTRADAS);
  // Todas as chaves invertidas: a agenda passa a pedir o que não pedia, e vice-versa.
  await db.exec(
    `update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = case "ST_LIGADA" when 'S' then 'N' else 'S' end`,
  );
  await rodar("chaves invertidas", ENTRADAS.slice(0, 3));
  await db.exec(
    `update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = case "ST_LIGADA" when 'S' then 'N' else 'S' end`,
  );
  // Sem a chave no Vault: SEM_TOKEN, nada vai ao GitHub.
  await db.exec(`update vault.secrets set name = 'outro_nome'`);
  await rodar("sem chave no vault", ENTRADAS.slice(0, 2));
  await db.exec(`update vault.secrets set name = 'github_disparo_robos'`);
  // pg_net fora: FALHOU com o código do erro.
  await db.exec(`select set_config('teste.net_falha', 'on', false)`);
  await rodar("pg_net fora", ENTRADAS.slice(0, 2));
  await db.exec(`select set_config('teste.net_falha', 'off', false)`);
  // Sessão do pg_cron: vira AGENDA mesmo sem p_origem.
  await db.exec(`set application_name = 'pg_cron'`);
  await rodar("sessão do pg_cron", ENTRADAS.slice(0, 2));
  await db.exec(`set application_name = ''`);
  // Origem que não existe.
  saida["origem inválida"] = await erroDe(
    db.query(
      `select private."FC_DISPARAR_ROBO"('conferencias.yml', '{}'::jsonb, null, 'GITHUB')`,
    ),
  );
  return saida;
}

async function bateriaDeChaves(db: Banco) {
  const saida: Record<string, unknown> = {};
  for (const w of [...TODOS_OS_NOMES, null])
    saida[`workflow ${w}`] = (
      await uma<{ c: string | null }>(
        db,
        `select private."FC_CHAVE_DO_WORKFLOW"($1) as c`,
        [w],
      )
    )?.c;
  for (const t of [
    ...TAREFAS.map(([nome]) => nome),
    "agsus_robo_inscricoes_120_2026",
    "agsus_robo_inscricoes_",
    "agsus_robo_inscricoes",
    "agsusXrobo_inscricoes_1",
    "agsus_robo_inscricoesX",
    "agsus_robo_inscricoes_%",
    "AGSUS_ROBO_CONFERENCIAS",
    "qualquer",
    "",
    null,
  ])
    saida[`tarefa ${t}`] = (
      await uma<{ c: string | null }>(
        db,
        `select private."FC_CHAVE_DA_TAREFA"($1) as c`,
        [t],
      )
    )?.c;
  for (const c of [
    "entrevistas",
    "paineis",
    "classificacao_calculo",
    "nao_existe",
    null,
  ])
    saida[`ligada ${c}`] = (
      await uma<{ l: boolean }>(db, `select public.automacao_ligada($1) as l`, [
        c,
      ])
    )?.l;
  return saida;
}

async function bateriaDeRegistros(db: Banco) {
  const saida: Record<string, unknown> = {};
  let n = 0;
  const registrar = async (
    rotulo: string,
    workflow: unknown,
    ator: unknown,
    url: unknown,
  ) => {
    try {
      const r = await uma<{ id: number | null }>(
        db,
        `select public.registrar_disparo_externo($1, $2, $3, 'resumo') as id`,
        [workflow, ator, url],
      );
      saida[rotulo] = r?.id
        ? await uma(
            db,
            `select "NO_WORKFLOW", "TP_ORIGEM", "TP_SITUACAO", "NO_ATOR_GITHUB", "DS_URL_EXECUCAO", "DS_MENSAGEM"
               from public."TL_DISPARO_ROBO" where "CO_DISPARO" = $1`,
            [r.id],
          )
        : "nulo";
    } catch (e) {
      saida[rotulo] = `erro ${(e as { code?: string }).code}`;
    }
  };
  for (const w of [...TODOS_OS_NOMES, null]) {
    n += 1;
    await registrar(
      `registro ${w}`,
      w,
      "fulano",
      `https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/${1000 + n}`,
    );
  }
  await registrar(
    "repetido",
    "conferencias.yml",
    "outra-pessoa",
    "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/1003",
  );
  await registrar(
    "url ruim",
    "conferencias.yml",
    "fulano",
    "https://exemplo.com/x",
  );
  await registrar(
    "ator ruim",
    "conferencias.yml",
    "não é login!",
    "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/2000",
  );
  await registrar(
    "bot",
    "classificacao.yml",
    "github-actions[bot]",
    "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/2001",
  );
  saida.total = (
    await uma<{ n: number }>(
      db,
      `select count(*)::int as n from public."TL_DISPARO_ROBO"`,
    )
  )?.n;
  return saida;
}

/*
  A única diferença de propósito que aparece nas respostas de hoje: a tarefa nova
  do alinhador (agsus_alinhar_chaves_da_automacao, sem chave) no pg_cron e, por
  isso, em "tarefas sem chave" de obter_chaves_da_automacao. Sai da comparação só
  ela; o teste "a única diferença é a tarefa do alinhador" confere que existe.
*/
const ALINHADOR = "agsus_alinhar_chaves_da_automacao";
function semAlinhador(valor: unknown): unknown {
  if (Array.isArray(valor))
    return valor
      .filter(
        (v) => !(v && typeof v === "object" && (v as Linha).nome === ALINHADOR),
      )
      .map(semAlinhador);
  if (valor && typeof valor === "object")
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([k]) => k !== ALINHADOR)
        .map(([k, v]) => [k, semAlinhador(v)]),
    );
  return valor;
}

/* Tira datas e horas (mudam a cada execução) de qualquer resposta. */
function semHoras(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(semHoras);
  if (valor && typeof valor === "object")
    return Object.fromEntries(
      Object.entries(valor)
        .filter(
          ([k]) =>
            ![
              "gerado_em",
              "em",
              "inicio",
              "fim",
              "DT_EVENTO",
              "DT_ATUALIZACAO",
            ].includes(k),
        )
        .map(([k, v]) => [k, semHoras(v)]),
    );
  return valor;
}

async function retratoDasChaves(db: Banco) {
  return {
    chaves: (
      await db.query(
        `select "CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO"
           from public."TB_CHAVE_AUTOMACAO" order by 1`,
      )
    ).rows,
    historico: (
      await db.query(
        `select "CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS"
           from public."TH_CHAVE_AUTOMACAO" order by "CO_EVENTO"`,
      )
    ).rows,
    cron: await estadoDoCron(db),
  };
}

async function bateriaDeAlterarChave(db: Banco) {
  const passos: Record<string, unknown> = {};
  const alterar = async (
    rotulo: string,
    chave: unknown,
    ligar: unknown,
    motivo: unknown,
  ) => {
    let resposta: unknown;
    try {
      resposta = semHoras(
        (
          await uma<{ r: unknown }>(
            db,
            `select public.alterar_chave_da_automacao($1, $2, $3) as r`,
            [chave, ligar, motivo],
          )
        )?.r,
      );
    } catch (e) {
      const erro = e as { code?: string; message?: string };
      resposta = `erro ${erro.code}: ${erro.message}`;
    }
    passos[rotulo] = { resposta, ...(await retratoDasChaves(db)) };
  };
  await entrar(db, null);
  await alterar("sem sessão", "paineis", false, MOTIVO);
  await entrar(db, USUARIO_COMUM, false);
  await alterar("sem permissão", "paineis", false, MOTIVO);
  await entrar(db, USUARIO_MASTER, true);
  await alterar("chave nula", null, false, MOTIVO);
  await alterar("ligar nulo", "paineis", null, MOTIVO);
  await alterar("motivo curto", "paineis", false, "curto");
  await alterar(
    "teclado batido",
    "paineis",
    false,
    "asdasdasd sdfsdfsdf qweqweqwe",
  );
  await alterar("chave desconhecida", "nao_existe", false, MOTIVO);
  await alterar("já desligada", "entrevistas", false, MOTIVO);
  await alterar("desliga os painéis", "paineis", false, MOTIVO);
  await alterar("religa os painéis", "paineis", true, `${MOTIVO} de novo`);
  await alterar(
    "liga as entrevistas",
    "entrevistas",
    true,
    `${MOTIVO}, entrevistas`,
  );
  await alterar(
    "desliga a manutenção",
    "manutencao",
    false,
    `${MOTIVO}, manutenção`,
  );
  await alterar(
    "desliga sem tarefa",
    "classificacao",
    false,
    `${MOTIVO}, classificação`,
  );
  await alterar("já ligada", "conferencias", true, MOTIVO);
  passos["obter_chaves_da_automacao"] = semHoras(
    (
      await uma<{ r: unknown }>(
        db,
        `select public.obter_chaves_da_automacao() as r`,
      )
    )?.r,
  );
  await entrar(db, USUARIO_COMUM, false);
  passos["obter sem permissão"] = await erroDe(
    db.query(`select public.obter_chaves_da_automacao()`),
  );
  return passos;
}

async function bateriaDoRodarAgora(db: Banco) {
  const saida: Record<string, unknown> = {};
  const rodar = async (rotulo: string, robo: unknown, entrada: unknown) => {
    try {
      const r = await uma<{ id: number }>(
        db,
        `select public.disparar_robo($1, $2::jsonb) as id`,
        [robo, JSON.stringify(entrada)],
      );
      saida[rotulo] = await uma(
        db,
        `select d."NO_WORKFLOW", d."TP_ORIGEM", d."CO_USUARIO", d."TP_SITUACAO",
                (select p.body from net."PEDIDO" p where p.id = d."CO_PEDIDO_HTTP") as corpo
           from public."TL_DISPARO_ROBO" d where d."CO_DISPARO" = $1`,
        [r?.id],
      );
    } catch (e) {
      const erro = e as { code?: string; message?: string };
      saida[rotulo] = `erro ${erro.code}: ${erro.message}`;
    }
  };
  await entrar(db, null);
  await rodar("sem sessão", "selecao", {});
  await entrar(db, USUARIO_COMUM, false);
  await rodar("sem permissão", "selecao", {});
  await entrar(db, USUARIO_MASTER, true);
  await rodar("seleção", "selecao", {});
  await rodar("seleção de novo em 2 min", "selecao", {});
  await rodar("entrevistas", "entrevistas", { modo: "normal" });
  await rodar("conferências seco", "conferencias", { modo: "seco" });
  await rodar("robô fumaça", "empregare", { modo: "fumaca", limite: 3 });
  await rodar("triagem seca", "pre_classificacao", {
    modo: "seco",
    editais: ["93/2026"],
  });
  await rodar("desempate", "classificacao_desempate", {});
  await rodar("robô desconhecido", "nao_existe", {});
  await rodar("modo inválido", "conferencias", { modo: "fumaca" });
  await rodar("opção que o robô não aceita", "selecao", { vagas: "1" });
  return saida;
}

async function todasAsBaterias(db: Banco) {
  return {
    chaves: await bateriaDeChaves(db),
    disparos: await bateriaDeDisparos(db),
    registros: await bateriaDeRegistros(db),
    rodarAgora: await bateriaDoRodarAgora(db),
    alterarChave: await bateriaDeAlterarChave(db),
  };
}

async function comentarios(db: Banco) {
  return (
    await db.query(
      `select p.oid::regprocedure::text as objeto, obj_description(p.oid, 'pg_proc') as texto
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private')
       union all
       select 'constraint ' || conname, obj_description(oid, 'pg_constraint')
         from pg_constraint where conrelid = 'public."TL_DISPARO_ROBO"'::regclass
       union all
       select 'coluna NO_WORKFLOW', col_description('public."TL_DISPARO_ROBO"'::regclass, 2)
       order by 1`,
    )
  ).rows;
}

async function tabelas(db: Banco) {
  return (
    await db.query<{ t: string }>(
      `select schemaname || '.' || tablename as t from pg_tables
        where schemaname in ('public', 'private') order by 1`,
    )
  ).rows.map((l) => l.t);
}

describe("nada quebra: hoje × depois da migration × depois do rollback", () => {
  let hoje: Banco;
  let migrado: Banco;
  let desfeito: Banco;
  const fotos: Record<string, Record<string, unknown>> = {};

  beforeAll(async () => {
    hoje = await bancoDeHoje();
    migrado = await bancoDeHoje();
    await rodarArquivo(migrado, MIGRATION);
    desfeito = await bancoDeHoje();
    await rodarArquivo(desfeito, MIGRATION);
    await rodarArquivo(desfeito, ROLLBACK);
    fotos.estrutura = {
      hoje: {
        funcoes: await corposDasFuncoes(hoje),
        constraints: await constraintsDe(hoje, "TL_DISPARO_ROBO"),
        comentarios: await comentarios(hoje),
        tabelas: await tabelas(hoje),
        cron: await estadoDoCron(hoje),
      },
      desfeito: {
        funcoes: await corposDasFuncoes(desfeito),
        constraints: await constraintsDe(desfeito, "TL_DISPARO_ROBO"),
        comentarios: await comentarios(desfeito),
        tabelas: await tabelas(desfeito),
        cron: await estadoDoCron(desfeito),
      },
    };
    for (const [nome, db] of [
      ["hoje", hoje],
      ["migrado", migrado],
      ["desfeito", desfeito],
    ] as const)
      fotos[nome] = await todasAsBaterias(db);
  }, 600_000);

  for (const parte of [
    "chaves",
    "disparos",
    "registros",
    "rodarAgora",
    "alterarChave",
  ]) {
    it(`${parte}: a migration responde igual a hoje`, () => {
      expect(semAlinhador(fotos.migrado?.[parte])).toEqual(fotos.hoje?.[parte]);
    });
    it(`${parte}: depois do rollback, responde igual a hoje`, () => {
      expect(fotos.desfeito?.[parte]).toEqual(fotos.hoje?.[parte]);
    });
  }

  it("a única diferença é a tarefa do alinhador, que aparece no pg_cron e em tarefas sem chave", () => {
    const passos = fotos.migrado?.alterarChave as Record<
      string,
      { cron?: Record<string, boolean> }
    >;
    expect(passos["sem sessão"]?.cron?.[ALINHADOR]).toBe(true);
    const obter = (
      fotos.migrado?.alterarChave as Record<string, { sem_chave?: Linha[] }>
    ).obter_chaves_da_automacao;
    expect(obter?.sem_chave?.map((t) => t.nome)).toContain(ALINHADOR);
    expect(JSON.stringify(fotos.hoje)).not.toContain(ALINHADOR);
  });

  it("a bateria cobre o que diz: cada workflow pedido ao GitHub com o corpo e os cabeçalhos", () => {
    const disparos = fotos.hoje?.disparos as Record<
      string,
      { resposta: string; pedidos: Linha[]; linha: Linha | null }
    >;
    const pedidos = Object.values(disparos).flatMap((d) => d.pedidos ?? []);
    const urls = new Set(pedidos.map((p) => p.url));
    for (const w of DISPARAVEIS)
      expect(urls).toContain(
        `https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/${w}/dispatches`,
      );
    expect(urls.size).toBe(DISPARAVEIS.length);
    expect(pedidos[0]?.headers).toMatchObject({
      Authorization: "Bearer token-de-teste",
    });
    // Cada situação aparece: o teste não passa por só olhar o caminho feliz.
    const situacoes = new Set(
      Object.values(disparos).map((d) => d.linha?.TP_SITUACAO ?? null),
    );
    for (const s of ["PEDIDO", "SEM_TOKEN", "FALHOU", null])
      expect(situacoes).toContain(s);
    const respostas = Object.values(disparos).map((d) => d.resposta);
    expect(respostas).toContain("nulo"); // agenda com chave desligada
    expect(respostas.some((r) => r.startsWith("erro 22023"))).toBe(true);
  });

  it("o rollback devolve cada função (corpo, volatilidade, definer), as constraints, os comentários e as tabelas", () => {
    const { hoje: h, desfeito: d } = fotos.estrutura as Record<
      string,
      Record<string, unknown>
    >;
    expect(d?.funcoes).toEqual(h?.funcoes);
    expect(d?.constraints).toEqual(h?.constraints);
    expect(d?.comentarios).toEqual(h?.comentarios);
    expect(d?.tabelas).toEqual(h?.tabelas);
    expect(d?.cron).toEqual(h?.cron);
  });
});

describe("o que muda de propósito", () => {
  it(
    "catálogo dos workflows: as listas fixas de antes, linha por linha",
    async () => {
      const db = await bancoDeHoje();
      await rodarArquivo(db, MIGRATION);
      const r = await db.query(
        `select "NO_WORKFLOW", "CO_CHAVE", "DS_INPUT_ACEITO", "ST_DISPARAVEL", "ST_REGISTRO_EXTERNO"
         from public."TB_ROBO_WORKFLOW" order by 1`,
      );
      expect(r.rows).toEqual(
        [
          ["casamento-da-lista.yml", null, ["modo", "pedido"], "S", "N"],
          ["classificacao.yml", "classificacao", ["modo", "listas"], "S", "S"],
          ["conferencias.yml", "conferencias", ["modo"], "S", "S"],
          ["contratacao-dos-aprovados.yml", "conferencias", ["modo"], "S", "N"],
          ["expurgo-anexos-chat.yml", null, [], "N", "N"],
          ["leitura-de-arquivos.yml", null, [], "N", "S"],
          ["pacotes-dos-paineis.yml", "paineis", ["modo"], "S", "N"],
          [
            "pre-classificacao.yml",
            "pre_classificacao",
            ["modo", "editais", "forcar_congelado"],
            "S",
            "S",
          ],
          [
            "robo-empregare.yml",
            "robo_de_inscricoes",
            [
              "modo",
              "editais",
              "vagas",
              "limite",
              "anexos",
              "candidatos",
              "seco",
              "forcar_congelado",
            ],
            "S",
            "S",
          ],
          ["sincronizar-entrevistas.yml", "entrevistas", ["modo"], "S", "S"],
          ["sincronizar-selecao.yml", "selecao", ["modo"], "S", "S"],
        ].map(([w, c, i, d, e]) => ({
          NO_WORKFLOW: w,
          CO_CHAVE: c,
          DS_INPUT_ACEITO: i,
          ST_DISPARAVEL: d,
          ST_REGISTRO_EXTERNO: e,
        })),
      );
    },
    LONGO,
  );

  it(
    "o log dos pedidos: chave estrangeira no lugar do CHECK, com índice; recusa workflow fora e não deixa apagar do catálogo o que está em uso",
    async () => {
      const db = await bancoDeHoje();
      await rodarArquivo(db, MIGRATION);
      const constraints = await constraintsDe(db, "TL_DISPARO_ROBO");
      expect(
        constraints.some((c) => c.startsWith("CK_DISPROBO_NOWORKFLOW")),
      ).toBe(false);
      expect(constraints).toContain(
        'FK_DISPROBO_ROBOWKF FOREIGN KEY ("NO_WORKFLOW") REFERENCES "TB_ROBO_WORKFLOW"("NO_WORKFLOW") ON DELETE RESTRICT',
      );
      expect(
        await uma(
          db,
          `select 1 as ok from pg_indexes where indexname = 'IN_DISPROBO_NOWORKFLOW'`,
        ),
      ).toEqual({ ok: 1 });
      expect(
        (
          await erroDe(
            db.query(
              `insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "TP_SITUACAO")
             values ('nao-existe.yml', 'MANUAL', 'FALHOU')`,
            ),
          )
        )?.codigo,
      ).toBe("23503");
      await db.query(
        `select private."FC_DISPARAR_ROBO"('conferencias.yml', '{}'::jsonb, null, null)`,
      );
      expect(
        (
          await erroDe(
            db.query(
              `delete from public."TB_ROBO_WORKFLOW" where "NO_WORKFLOW" = 'conferencias.yml'`,
            ),
          )
        )?.codigo,
      ).toBe("23001"); // restrict_violation: ON DELETE RESTRICT
    },
    LONGO,
  );

  it(
    "o catálogo recusa linha malformada (nome, disparado_por, S/N, input em workflow que o banco não pede, chave que não existe)",
    async () => {
      const db = await bancoDeHoje();
      await rodarArquivo(db, MIGRATION);
      const inserir = (
        w: string,
        chave: string | null,
        inputs: string,
        disparavel: string,
        externo: string,
      ) =>
        erroDe(
          db.query(
            `insert into public."TB_ROBO_WORKFLOW" ("NO_WORKFLOW", "NO_ROBO", "CO_CHAVE", "DS_INPUT_ACEITO", "ST_DISPARAVEL", "ST_REGISTRO_EXTERNO")
           values ($1, 'Teste', $2, $3::text[], $4, $5)`,
            [w, chave, inputs, disparavel, externo],
          ),
        );
      expect(
        (await inserir("Com Espaco.yml", null, "{modo}", "S", "N"))?.codigo,
      ).toBe("23514");
      expect(
        (await inserir("../fora.yml", null, "{modo}", "S", "N"))?.codigo,
      ).toBe("23514");
      expect(
        (await inserir("sem-extensao", null, "{modo}", "S", "N"))?.codigo,
      ).toBe("23514");
      expect(
        (await inserir("novo.yml", null, "{modo,disparado_por}", "S", "N"))
          ?.codigo,
      ).toBe("23514");
      expect(
        (await inserir("novo.yml", null, "{Modo}", "S", "N"))?.codigo,
      ).toBe("23514");
      expect(
        (await inserir("novo.yml", null, "{modo}", "X", "N"))?.codigo,
      ).toBe("23514");
      expect(
        (await inserir("novo.yml", null, "{modo}", "N", "N"))?.codigo,
      ).toBe("23514");
      expect(
        (await inserir("novo.yml", "nao_existe", "{modo}", "S", "N"))?.codigo,
      ).toBe("23503");
      expect(
        await inserir("novo.yml", "paineis", "{modo}", "S", "N"),
      ).toBeNull();
      const tarefa = (nome: string, prefixo: string, workflow: string | null) =>
        erroDe(
          db.query(
            `insert into public."TB_TAREFA_AGENDADA" ("NO_TAREFA", "ST_PREFIXO", "DS_ROTULO", "NO_WORKFLOW")
           values ($1, $2, 'Teste', $3)`,
            [nome, prefixo, workflow],
          ),
        );
      expect((await tarefa("outra_coisa", "N", null))?.codigo).toBe("23514");
      expect((await tarefa("agsus_x", "X", null))?.codigo).toBe("23514");
      expect((await tarefa("agsus_x", "N", "nao-existe.yml"))?.codigo).toBe(
        "23503",
      );
    },
    LONGO,
  );

  it(
    "workflow novo é um INSERT: o banco pede, aceita os inputs dele, respeita a chave e registra",
    async () => {
      const db = await bancoDeHoje();
      await rodarArquivo(db, MIGRATION);
      await db.exec(
        `insert into public."TB_ROBO_WORKFLOW" ("NO_WORKFLOW", "NO_ROBO", "CO_CHAVE", "DS_INPUT_ACEITO", "ST_DISPARAVEL", "ST_REGISTRO_EXTERNO")
       values ('robo-novo.yml', 'Robô novo', 'selecao', '{modo,lote}', 'S', 'S')`,
      );
      const pedir = (entrada: object, origem: string | null) =>
        db.query<{ id: number | null }>(
          `select private."FC_DISPARAR_ROBO"('robo-novo.yml', $1::jsonb, null, $2) as id`,
          [JSON.stringify(entrada), origem],
        );
      expect(
        (await pedir({ modo: "normal", lote: "3" }, null)).rows[0]?.id,
      ).toBeGreaterThan(0);
      expect((await erroDe(pedir({ vagas: "1" }, null)))?.codigo).toBe("22023");
      // Chave "selecao" desligada: a agenda não pede.
      expect((await pedir({}, "AGENDA")).rows[0]?.id).toBeNull();
      expect(
        (
          await uma<{ c: string }>(
            db,
            `select private."FC_CHAVE_DO_WORKFLOW"('robo-novo.yml') as c`,
          )
        )?.c,
      ).toBe("selecao");
      const pedido = await uma<{ body: { inputs: unknown } }>(
        db,
        `select body from net."PEDIDO" order by id desc limit 1`,
      );
      expect(pedido?.body.inputs).toEqual({
        modo: "normal",
        lote: "3",
        disparado_por: "manual",
      });
      expect(
        await erroDe(
          db.query(
            `select public.registrar_disparo_externo('robo-novo.yml', 'fulano', 'https://github.com/a/b/actions/runs/1')`,
          ),
        ),
      ).toBeNull();
      // Workflow só de registro (ST_DISPARAVEL = N) não é pedido.
      expect(
        (
          await erroDe(
            db.query(
              `select private."FC_DISPARAR_ROBO"('leitura-de-arquivos.yml', '{}'::jsonb)`,
            ),
          )
        )?.codigo,
      ).toBe("22023");
    },
    LONGO,
  );

  it(
    "tarefa: o nome exato ganha do prefixo; tarefa fora do catálogo não tem chave",
    async () => {
      const db = await bancoDeHoje();
      await rodarArquivo(db, MIGRATION);
      await db.exec(
        `insert into public."TB_TAREFA_AGENDADA" ("NO_TAREFA", "ST_PREFIXO", "DS_ROTULO", "CO_CHAVE")
       values ('agsus_robo_inscricoes_especial', 'N', 'Especial', 'paineis')`,
      );
      const chave = async (t: string) =>
        (
          await uma<{ c: string | null }>(
            db,
            `select private."FC_CHAVE_DA_TAREFA"($1) as c`,
            [t],
          )
        )?.c;
      expect(await chave("agsus_robo_inscricoes_especial")).toBe("paineis");
      expect(await chave("agsus_robo_inscricoes_especial_2")).toBe(
        "robo_de_inscricoes",
      );
      expect(await chave("agsus_tarefa_nova")).toBeNull();
    },
    LONGO,
  );

  describe("o alinhador: a chave manda no pg_cron", () => {
    let db: Banco;
    beforeAll(async () => {
      db = await bancoDeHoje({
        tarefasExtras: [
          ["agsus_robo_inscricoes_120_2026", "0 10 * * *", true],
          ["agsus_tarefa_sem_catalogo", "0 1 * * *", false],
        ],
        tarefas: { agsus_robo_conferir_disparos: false },
      });
      await rodarArquivo(db, MIGRATION);
    }, LONGO);

    it("chave desligada com tarefa religada por fora: o alinhador desliga e deixa no histórico, sem usuário", async () => {
      await db.exec(
        `update cron.job set active = true where jobname = 'agsus_robo_sincronizar_selecao'`,
      );
      const r = await uma<{ m: string[] }>(
        db,
        `select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"() as m`,
      );
      expect(r?.m).toEqual(["agsus_robo_sincronizar_selecao"]);
      expect((await estadoDoCron(db)).agsus_robo_sincronizar_selecao).toBe(
        false,
      );
      const evento = await uma(
        db,
        `select "CO_CHAVE", "ST_LIGADA", "CO_USUARIO", "DS_TAREFAS", "DS_MOTIVO"
           from public."TH_CHAVE_AUTOMACAO" order by "CO_EVENTO" desc limit 1`,
      );
      expect(evento).toMatchObject({
        CO_CHAVE: "selecao",
        ST_LIGADA: "N",
        CO_USUARIO: null,
        DS_TAREFAS: ["agsus_robo_sincronizar_selecao"],
      });
    });

    it("chave ligada com tarefa parada por fora: religa; várias chaves de uma vez, um evento por chave, em ordem", async () => {
      await db.exec(
        `update cron.job set active = false where jobname in ('agsus_analises_cache_do_painel', 'agsus_fila_estatisticas', 'agsus_aprovados_cache_por_area')`,
      );
      const antes =
        (
          await uma<{ n: number }>(
            db,
            `select count(*)::int as n from public."TH_CHAVE_AUTOMACAO"`,
          )
        )?.n ?? 0;
      const r = await uma<{ m: string[] }>(
        db,
        `select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"() as m`,
      );
      expect(r?.m).toEqual([
        "agsus_analises_cache_do_painel",
        "agsus_aprovados_cache_por_area",
        "agsus_fila_estatisticas",
      ]);
      const eventos = await db.query(
        `select "CO_CHAVE", "DS_TAREFAS" from public."TH_CHAVE_AUTOMACAO" order by "CO_EVENTO" offset $1`,
        [antes],
      );
      expect(eventos.rows).toEqual([
        { CO_CHAVE: "manutencao", DS_TAREFAS: ["agsus_fila_estatisticas"] },
        {
          CO_CHAVE: "paineis",
          DS_TAREFAS: [
            "agsus_analises_cache_do_painel",
            "agsus_aprovados_cache_por_area",
          ],
        },
      ]);
    });

    it("tarefa sem chave (ou fora do catálogo) nunca é tocada; prefixo das inscrições segue a chave", async () => {
      const cron = await estadoDoCron(db);
      expect(cron.agsus_robo_conferir_disparos).toBe(false);
      expect(cron.agsus_tarefa_sem_catalogo).toBe(false);
      expect(cron.agsus_robo_inscricoes_120_2026).toBe(true);
      await db.exec(
        `update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = 'N' where "CO_CHAVE" = 'robo_de_inscricoes'`,
      );
      await db.query(`select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"()`);
      expect((await estadoDoCron(db)).agsus_robo_inscricoes_120_2026).toBe(
        false,
      );
      await db.exec(
        `update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = 'S' where "CO_CHAVE" = 'robo_de_inscricoes'`,
      );
      await db.query(`select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"()`);
    });

    it("alinhado, não mexe em nada nem grava histórico; com p_chave, só aquela chave e sem histórico", async () => {
      const antes = await uma<{ n: number }>(
        db,
        `select count(*)::int as n from public."TH_CHAVE_AUTOMACAO"`,
      );
      expect(
        (
          await uma<{ m: string[] }>(
            db,
            `select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"() as m`,
          )
        )?.m,
      ).toEqual([]);
      await db.exec(
        `update cron.job set active = true where jobname in ('agsus_robo_sincronizar_entrevistas', 'agsus_robo_sincronizar_selecao')`,
      );
      expect(
        (
          await uma<{ m: string[] }>(
            db,
            `select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"('selecao') as m`,
          )
        )?.m,
      ).toEqual(["agsus_robo_sincronizar_selecao"]);
      expect((await estadoDoCron(db)).agsus_robo_sincronizar_entrevistas).toBe(
        true,
      );
      expect(
        await uma(
          db,
          `select count(*)::int as n from public."TH_CHAVE_AUTOMACAO"`,
        ),
      ).toEqual(antes);
      await db.query(`select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"()`);
    });

    it("a tarefa agsus_alinhar_chaves_da_automacao: a cada 5 min, ativa, sem chave, e o comando roda", async () => {
      const tarefa = await uma<{
        schedule: string;
        command: string;
        active: boolean;
      }>(
        db,
        `select schedule, command, active from cron.job where jobname = 'agsus_alinhar_chaves_da_automacao'`,
      );
      expect(tarefa).toMatchObject({ schedule: "*/5 * * * *", active: true });
      expect(tarefa?.command).toContain("pg_try_advisory_xact_lock");
      expect(
        (
          await uma<{ c: string | null }>(
            db,
            `select private."FC_CHAVE_DA_TAREFA"('agsus_alinhar_chaves_da_automacao') as c`,
          )
        )?.c,
      ).toBeNull();
      await db.exec(
        `update cron.job set active = true where jobname = 'agsus_robo_sincronizar_selecao'`,
      );
      await db.exec(tarefa?.command ?? "");
      expect((await estadoDoCron(db)).agsus_robo_sincronizar_selecao).toBe(
        false,
      );
    });
  });

  it(
    "aplicar com chave desligada e tarefa ativa: a migration desliga a tarefa e deixa no histórico",
    async () => {
      const db = await bancoDeHoje({
        chaves: { paineis: "N" },
        tarefas: {},
      });
      await rodarArquivo(db, MIGRATION);
      const cron = await estadoDoCron(db);
      expect(cron.agsus_analises_cache_do_painel).toBe(false);
      expect(cron.agsus_aprovados_cache_por_area).toBe(false);
      expect(cron.agsus_entrevistas_cache_do_painel).toBe(false);
      expect(
        await uma(
          db,
          `select "CO_CHAVE", "DS_TAREFAS" from public."TH_CHAVE_AUTOMACAO" order by "CO_EVENTO" desc limit 1`,
        ),
      ).toEqual({
        CO_CHAVE: "paineis",
        DS_TAREFAS: [
          "agsus_analises_cache_do_painel",
          "agsus_aprovados_cache_por_area",
          "agsus_entrevistas_cache_do_painel",
        ],
      });
    },
    LONGO,
  );

  describe("a migration recusa o estado que não conhece, sem aplicar nada", () => {
    const naoAplicou = async (db: Banco, antes: Record<string, string>) => {
      expect(
        await uma(db, `select to_regclass('public."TB_ROBO_WORKFLOW"') as t`),
      ).toEqual({ t: null });
      expect(await corposDasFuncoes(db)).toEqual(antes);
      expect(
        (await constraintsDe(db, "TL_DISPARO_ROBO")).some((c) =>
          c.startsWith("CK_DISPROBO_NOWORKFLOW"),
        ),
      ).toBe(true);
    };

    it(
      "chave ligada com tarefa parada: pede decisão e diz qual tarefa",
      async () => {
        const db = await bancoDeHoje({
          tarefas: { agsus_fila_estatisticas: false },
        });
        const antes = await corposDasFuncoes(db);
        const erro = await erroDe(rodarArquivo(db, MIGRATION));
        expect(erro?.mensagem).toContain(
          "agsus_fila_estatisticas (chave manutencao)",
        );
        await db.exec("rollback");
        await naoAplicou(db, antes);
        expect((await estadoDoCron(db)).agsus_fila_estatisticas).toBe(false);
      },
      LONGO,
    );

    it(
      "função mudada depois de 20261103213000 (md5 diferente)",
      async () => {
        const db = await bancoDeHoje();
        await db.exec(`create or replace function private."FC_CHAVE_DO_WORKFLOW"(p_workflow text)
        returns text language sql immutable set search_path to '' as $function$ select null::text $function$;`);
        const antes = await corposDasFuncoes(db);
        const erro = await erroDe(rodarArquivo(db, MIGRATION));
        expect(erro?.mensagem).toContain("mudou depois de 20261103213000");
        await db.exec("rollback");
        await naoAplicou(db, antes);
      },
      LONGO,
    );

    it(
      "pedido no log com workflow fora do catálogo",
      async () => {
        const db = await bancoDeHoje();
        await db.exec(`alter table public."TL_DISPARO_ROBO" drop constraint "CK_DISPROBO_NOWORKFLOW";
        insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "TP_SITUACAO") values ('antigo.yml', 'MANUAL', 'FALHOU');
        alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" <> '') not valid;`);
        const erro = await erroDe(rodarArquivo(db, MIGRATION));
        expect(erro?.mensagem).toContain("antigo.yml");
        await db.exec("rollback");
        expect(
          await uma(db, `select to_regclass('public."TB_ROBO_WORKFLOW"') as t`),
        ).toEqual({ t: null });
      },
      LONGO,
    );

    it(
      "aplicada de novo",
      async () => {
        const db = await bancoDeHoje();
        await rodarArquivo(db, MIGRATION);
        const erro = await erroDe(rodarArquivo(db, MIGRATION));
        expect(erro?.mensagem).toContain("já foi aplicada");
        await db.exec("rollback");
      },
      LONGO,
    );
  });

  describe("o rollback", () => {
    it(
      "recusa banco sem a migration",
      async () => {
        const db = await bancoDeHoje();
        expect((await erroDe(rodarArquivo(db, ROLLBACK)))?.mensagem).toContain(
          "não está aplicada",
        );
        await db.exec("rollback");
      },
      LONGO,
    );

    it(
      "recusa pedido de workflow que o CHECK de antes não aceitaria, sem desfazer nada",
      async () => {
        const db = await bancoDeHoje();
        await rodarArquivo(db, MIGRATION);
        await db.exec(`insert into public."TB_ROBO_WORKFLOW" ("NO_WORKFLOW", "NO_ROBO", "DS_INPUT_ACEITO", "ST_DISPARAVEL", "ST_REGISTRO_EXTERNO")
        values ('robo-novo.yml', 'Robô novo', '{modo}', 'S', 'N')`);
        await db.query(
          `select private."FC_DISPARAR_ROBO"('robo-novo.yml', '{}'::jsonb)`,
        );
        const antes = await corposDasFuncoes(db);
        expect((await erroDe(rodarArquivo(db, ROLLBACK)))?.mensagem).toContain(
          "robo-novo.yml",
        );
        await db.exec("rollback");
        expect(await corposDasFuncoes(db)).toEqual(antes);
        expect(
          await uma(
            db,
            `select count(*)::int as n from public."TB_ROBO_WORKFLOW"`,
          ),
        ).toEqual({ n: 12 });
      },
      LONGO,
    );

    it(
      "mantém o que a chave decidiu (tarefa desligada) e o histórico; depois, a migration aplica de novo",
      async () => {
        const db = await bancoDeHoje({ chaves: { manutencao: "N" } });
        await rodarArquivo(db, MIGRATION);
        const historico = await uma(
          db,
          `select count(*)::int as n from public."TH_CHAVE_AUTOMACAO"`,
        );
        await rodarArquivo(db, ROLLBACK);
        expect((await estadoDoCron(db)).agsus_fila_estatisticas).toBe(false);
        expect(
          await uma(
            db,
            `select count(*)::int as n from public."TH_CHAVE_AUTOMACAO"`,
          ),
        ).toEqual(historico);
        expect(
          (await estadoDoCron(db)).agsus_alinhar_chaves_da_automacao,
        ).toBeUndefined();
        await rodarArquivo(db, MIGRATION);
        expect(
          await uma(
            db,
            `select count(*)::int as n from public."TB_ROBO_WORKFLOW"`,
          ),
        ).toEqual({ n: 11 });
      },
      LONGO,
    );
  });

  it(
    "obter_catalogo_dos_robos: só o administrador global; nomes dos workflows e das tarefas",
    async () => {
      const db = await bancoDeHoje();
      await rodarArquivo(db, MIGRATION);
      await entrar(db, null);
      expect(
        (await erroDe(db.query(`select public.obter_catalogo_dos_robos()`)))
          ?.codigo,
      ).toBe("28000");
      await entrar(db, USUARIO_COMUM, false);
      expect(
        (await erroDe(db.query(`select public.obter_catalogo_dos_robos()`)))
          ?.codigo,
      ).toBe("42501");
      await entrar(db, USUARIO_MASTER, true);
      const r = await uma<{ c: { workflows: Linha[]; tarefas: Linha[] } }>(
        db,
        `select public.obter_catalogo_dos_robos() as c`,
      );
      expect(r?.c.workflows).toHaveLength(11);
      expect(r?.c.workflows).toContainEqual({
        workflow: "conferencias.yml",
        nome: "Conferências",
        chave: "conferencias",
        disparavel: true,
      });
      expect(r?.c.tarefas).toContainEqual({
        tarefa: "agsus_robo_inscricoes_",
        prefixo: true,
        rotulo: "Agenda das inscrições: pedir o robô da Empregare",
        chave: "robo_de_inscricoes",
        workflow: "robo-empregare.yml",
      });
      expect(r?.c.tarefas).toHaveLength(17);
      // A fixture dos testes da tela é a resposta de verdade do banco.
      expect(r?.c).toEqual(CATALOGO_DOS_ROBOS);
    },
    LONGO,
  );

  describe("o ensaio", () => {
    it(
      "passa no banco de hoje e não deixa nada",
      async () => {
        const db = await bancoDeHoje();
        const antes = {
          funcoes: await corposDasFuncoes(db),
          log: await uma(
            db,
            `select count(*)::int as n from public."TL_DISPARO_ROBO"`,
          ),
          rede: await uma(db, `select count(*)::int as n from net."PEDIDO"`),
          cron: await estadoDoCron(db),
        };
        await rodarArquivo(db, ENSAIO);
        expect({
          funcoes: await corposDasFuncoes(db),
          log: await uma(
            db,
            `select count(*)::int as n from public."TL_DISPARO_ROBO"`,
          ),
          rede: await uma(db, `select count(*)::int as n from net."PEDIDO"`),
          cron: await estadoDoCron(db),
        }).toEqual(antes);
        // Nenhum pedido foi ao pg_net (o ensaio força SEM_TOKEN).
        expect(antes.rede).toEqual({ n: 0 });
        expect(
          await uma(db, `select to_regclass('public."TB_ROBO_WORKFLOW"') as t`),
        ).toEqual({ t: null });
      },
      LONGO,
    );

    it(
      "reprova uma regressão: sem um input no catálogo, as respostas mudam e o ensaio para",
      async () => {
        const db = await bancoDeHoje();
        const quebrado = ENSAIO.replace("'{modo,listas}'", "'{modo}'");
        expect(quebrado).not.toBe(ENSAIO);
        const erro = await erroDe(rodarArquivo(db, quebrado));
        expect(erro?.mensagem).toContain("Respostas mudaram com a migration");
        expect(erro?.mensagem).toContain("classificacao.yml");
        await db.exec("rollback");
      },
      LONGO,
    );

    it(
      "reprova uma regressão: workflow sem registro externo",
      async () => {
        const db = await bancoDeHoje();
        const quebrado = ENSAIO.replace(
          "('leitura-de-arquivos.yml', 'Leitura dos arquivos', null, '{}', 'N', 'S')",
          "('leitura-de-arquivos.yml', 'Leitura dos arquivos', null, '{}', 'N', 'N')",
        );
        expect(quebrado).not.toBe(ENSAIO);
        expect((await erroDe(rodarArquivo(db, quebrado)))?.mensagem).toContain(
          "externo:leitura-de-arquivos.yml",
        );
        await db.exec("rollback");
      },
      LONGO,
    );
  });
});
