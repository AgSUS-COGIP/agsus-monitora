// @vitest-environment node
/*
  O vínculo da vaga com a linha do quadro (migration 20261118120000) num Postgres de verdade
  (PGlite): o banco de hoje (corpos copiados do retrato de produção), a migration, as RPCs da
  fila, quem consulta o vínculo, o ensaio e o rollback.
*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Banco,
  bancoDeHoje,
  criarAnalise,
  criarEdital,
  criarVagaDaSelecao,
  EDITAL,
  EDITAL_CANCELADO,
  EDITAL_SEM_CODIGO,
  ensaio,
  entrar,
  gravarQuadro,
  migration,
  rollback,
  vinculos,
} from "./apoio/banco-do-vinculo-do-quadro.ts";
import { moldeDeBanco } from "./apoio/molde-de-banco.ts";

const EDITAL_EXTERNO = "aaaaaaaa-0000-0000-0000-000000000004";

/*
  O edital 105/2026: o mesmo cargo em duas lotações (nome cortado), um cargo com "40h" que o
  nome não traz, a lotação que contradiz a linha e uma vaga só da Empregare, pelo "CARGO N".
*/
const QUADRO = [
  { cargo: "Enfermeiro", lotacao: "Polo Base Alfa" },
  { cargo: "Enfermeiro", lotacao: "Polo Base Beta" },
  { cargo: "Médico", lotacao: "Polo Base Alfa" },
  { cargo: "Cirurgião Dentista 40h", lotacao: "Polo Base Gama" },
  { cargo: "CARGO 7 - Técnico de Enfermagem", lotacao: "Polo Base Alfa" },
];

type Linhas = { l1: string; l2: string; l3: string; l4: string; l5: string };
let linhas: Linhas;

async function dados(db: Banco): Promise<void> {
  await criarEdital(db, EDITAL, "105/2026");
  await criarEdital(db, EDITAL_SEM_CODIGO, "99/2026");
  await criarEdital(db, EDITAL_CANCELADO, "88/2026", "Cancelado");
  await criarEdital(db, EDITAL_EXTERNO, "77/2026");
  const [l1, l2, l3, l4, l5] = await gravarQuadro(db, EDITAL, QUADRO);
  linhas = { l1: l1!, l2: l2!, l3: l3!, l4: l4!, l5: l5! };
  for (const e of [EDITAL_SEM_CODIGO, EDITAL_CANCELADO, EDITAL_EXTERNO])
    await gravarQuadro(db, e, [{ cargo: "Enfermeiro" }]);
  await criarVagaDaSelecao(
    db,
    EDITAL_EXTERNO,
    null,
    "Enfermeiro (banca externa)",
  );

  await criarAnalise(db, "105/2026", "1001", "Enfermeiro - Polo Base Alfa");
  await criarAnalise(db, "105/2026", "1002", "Enfermeiro");
  await criarAnalise(db, "105/2026", "1003", "Médico");
  await criarAnalise(
    db,
    "105/2026",
    "1004",
    "Cirurgião Dentista - Polo Base Gama",
  );
  await criarAnalise(db, "105/2026", "1005", "Médico - Polo Base Zeta");
  await db.query(
    `insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "NO_ARQUIVO")
     values ('2001', $1, 'Candidatos da vaga 2001 - CARGO 07 - TEC ENF em Excel')`,
    [EDITAL],
  );
}

const bancoAntesComDados = moldeDeBanco(async () => {
  const db = await bancoDeHoje();
  await dados(db);
  return db;
});
const bancoMigrado = moldeDeBanco(async () => {
  const db = await bancoAntesComDados();
  await db.exec(migration());
  return db;
});

async function erroDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return String((e as { code?: string }).code ?? e);
  }
  return "sem erro";
}

const gravar = (
  db: Banco,
  vaga: string,
  acao: string,
  quadro: string | null = null,
) =>
  db.query(`select public.gravar_vinculo_do_quadro($1, $2, $3, $4)`, [
    EDITAL,
    vaga,
    acao,
    quadro,
  ]);

const FUNCOES_TROCADAS = [
  `private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text)`,
  `private."FC_QUADRO_DA_VAGA_EMPREGARE"(uuid, text)`,
  `public.obter_quadro_de_vagas(uuid)`,
  `public.salvar_quadro_de_vagas(uuid, jsonb)`,
  `public.conferencia_ler_listas_e_quadros()`,
];

async function retratoDasFuncoes(db: Banco): Promise<Record<string, unknown>> {
  const saida: Record<string, unknown> = {};
  for (const f of FUNCOES_TROCADAS) {
    const { rows } = await db.query<{ src: string; doc: string }>(
      `select p.prosrc as src, obj_description(p.oid, 'pg_proc') as doc from pg_proc p where p.oid = to_regprocedure($1)`,
      [f],
    );
    saida[f] = rows[0];
  }
  return saida;
}

describe("a migration sobre o banco de hoje", () => {
  it("a guarda md5 reconhece os corpos copiados do retrato", async () => {
    const db = await bancoAntesComDados();
    const sql = migration();
    for (const f of [
      ...FUNCOES_TROCADAS,
      `private."FC_QUADRO_DA_VAGA"(uuid, text)`,
      `private."FC_TOKENS_VAGA"(text)`,
    ]) {
      const { rows } = await db.query<{ md5: string }>(
        `select md5(prosrc) as md5 from pg_proc where oid = to_regprocedure($1)`,
        [f],
      );
      expect(sql, f).toContain(`'${rows[0]!.md5}'`);
    }
  });

  it("recusa aplicar de novo", async () => {
    const db = await bancoMigrado();
    await expect(db.exec(migration())).rejects.toThrow(/já foi aplicada/);
  });

  it("recusa quando uma função do quadro mudou", async () => {
    const db = await bancoAntesComDados();
    await db.exec(`create or replace function private."FC_QUADRO_DA_VAGA"(p_edital uuid, p_nome_vaga text) returns uuid
                   language sql stable set search_path to '' as $$ select null::uuid $$`);
    await expect(db.exec(migration())).rejects.toThrow(
      /mudou desde 17\/11\/2026/,
    );
  });

  it("agenda a rodada diária e a põe no catálogo das tarefas", async () => {
    const db = await bancoMigrado();
    const { rows } = await db.query<{ jobname: string; command: string }>(
      `select jobname, command from cron.job`,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        jobname: "agsus_vinculos_do_quadro",
        command: expect.stringContaining(`FC_PREENCHER_TODOS_VINCULOS_QUADRO`),
      }),
    ]);
    const t = await db.query(
      `select 1 from public."TB_TAREFA_AGENDADA" where "NO_TAREFA" = 'agsus_vinculos_do_quadro'`,
    );
    expect(t.rows).toHaveLength(1);
  });
});

describe("o preenchimento automático", () => {
  it("separa confirmadas, ambíguas (com as candidatas) e ausentes", async () => {
    const db = await bancoMigrado();
    const { l1, l2, l3, l5 } = linhas;
    expect(await vinculos(db, EDITAL)).toEqual([
      {
        vaga: "1001",
        situacao: "CONFIRMADO",
        origem: "AUTOMATICO",
        regra: "NOME",
        quadro: l1,
        candidatas: [],
        pendencia: null,
      },
      {
        vaga: "1002",
        situacao: "AMBIGUO",
        origem: "AUTOMATICO",
        regra: "NOME",
        quadro: null,
        candidatas: [l1, l2],
        pendencia: null,
      },
      {
        vaga: "1003",
        situacao: "CONFIRMADO",
        origem: "AUTOMATICO",
        regra: "NOME",
        quadro: l3,
        candidatas: [],
        pendencia: null,
      },
      // "Cirurgião Dentista 40h": o cargo do quadro não está no nome.
      {
        vaga: "1004",
        situacao: "AUSENTE",
        origem: "AUTOMATICO",
        regra: "NOME",
        quadro: null,
        candidatas: [],
        pendencia: null,
      },
      // A lotação do nome contradiz a única linha do cargo: candidata, não vínculo.
      {
        vaga: "1005",
        situacao: "AMBIGUO",
        origem: "AUTOMATICO",
        regra: "NOME",
        quadro: null,
        candidatas: [l3],
        pendencia: null,
      },
      // Só na Empregare: o "CARGO 07" do título.
      {
        vaga: "2001",
        situacao: "CONFIRMADO",
        origem: "AUTOMATICO",
        regra: "TITULO",
        quadro: l5,
        candidatas: [],
        pendencia: null,
      },
    ]);
  });

  it("não inventa vaga nos editais sem código", async () => {
    const db = await bancoMigrado();
    for (const e of [EDITAL_SEM_CODIGO, EDITAL_CANCELADO, EDITAL_EXTERNO])
      expect(await vinculos(db, e)).toEqual([]);
  });

  it("confirma exatamente o que FC_QUADRO_DA_VAGA devolve (casos guardados do banco)", async () => {
    const db = await bancoMigrado();
    const casos = JSON.parse(
      readFileSync("tests/fixtures/quadro-da-vaga/casos-do-banco.json", "utf8"),
    ) as {
      quadros: { id: string; cargo: string; lotacao: string | null }[];
      casos: [string, string | null][];
    };
    const edital = "bbbbbbbb-0000-0000-0000-000000000001";
    await criarEdital(db, edital, "500/2026");
    for (const [i, q] of casos.quadros.entries())
      await db.query(
        `insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_QUADRO_VAGA", "CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO")
         values ($1, $2, $3, $4, $5)`,
        [q.id, edital, i + 1, q.cargo, q.lotacao],
      );
    for (const [nome, esperado] of casos.casos) {
      const { rows } = await db.query<{
        hoje: string | null;
        v: { situacao: string; quadro: string | null; candidatas: string[] };
      }>(
        `select private."FC_QUADRO_DA_VAGA"($1, $2) as hoje, private."FC_CANDIDATAS_DO_QUADRO"($1, $2) as v`,
        [edital, nome],
      );
      const { hoje, v } = rows[0]!;
      expect(hoje, nome).toBe(esperado);
      expect(v.quadro, nome).toBe(esperado);
      expect(v.situacao === "CONFIRMADO", nome).toBe(esperado !== null);
      if (v.situacao === "AMBIGUO")
        expect(v.candidatas.length, nome).toBeGreaterThan(0);
    }
  });

  it("a vaga só da Seleção casa pelo título da planilha (NO_CARGO, não o código)", async () => {
    const db = await bancoMigrado();
    await entrar(db, 2);
    await criarVagaDaSelecao(
      db,
      EDITAL,
      "3001",
      "Médico - Polo Base Alfa - 1 vaga",
    );
    await db.query(`select public.atualizar_vinculos_do_quadro($1)`, [EDITAL]);
    const { rows } = await db.query<{ nome: string }>(
      `select "NO_VAGA" as nome from public."TA_VAGA_QUADRO_EDITAL" where "CO_VAGA" = '3001'`,
    );
    expect(rows).toEqual([{ nome: "Médico - Polo Base Alfa - 1 vaga" }]);
    expect(
      (await vinculos(db, EDITAL)).find((v) => v.vaga === "3001"),
    ).toMatchObject({
      situacao: "CONFIRMADO",
      regra: "NOME",
      quadro: linhas.l3,
    });
  });

  it("a vaga que sai do edital sai do vínculo, com histórico", async () => {
    const db = await bancoMigrado();
    await entrar(db, 2);
    await db.query(
      `update public."TB_ANALISE_CURRICULAR" set ativo = false where codigo_vaga = '1003'`,
    );
    await db.query(`select public.atualizar_vinculos_do_quadro($1)`, [EDITAL]);
    expect((await vinculos(db, EDITAL)).map((v) => v.vaga)).toEqual([
      "1001",
      "1002",
      "1004",
      "1005",
      "2001",
    ]);
    const h = await db.query(
      `select 1 from public."TH_VAGA_QUADRO_EDITAL" where "CO_VAGA" = '1003' and "TP_EVENTO" = 'REMOCAO'`,
    );
    expect(h.rows).toHaveLength(1);
  });

  it("atualizar pela tela mantém o achado pelo título (que fica para a rodada diária)", async () => {
    const db = await bancoMigrado();
    await entrar(db, 2);
    await db.query(`select public.atualizar_vinculos_do_quadro($1)`, [EDITAL]);
    expect(
      (await vinculos(db, EDITAL)).find((v) => v.vaga === "2001"),
    ).toMatchObject({ situacao: "CONFIRMADO", regra: "TITULO" });
  });
});

describe("a fila: gravar_vinculo_do_quadro", () => {
  it("só Núcleo ou Calendário com edição", async () => {
    const db = await bancoMigrado();
    await entrar(db, 1);
    expect(await erroDe(gravar(db, "1002", "CONFIRMAR", linhas.l2))).toBe(
      "42501",
    );
  });

  it("recusa linha de outro edital, vaga que não é do edital e ação desconhecida", async () => {
    const db = await bancoMigrado();
    await entrar(db, 2);
    const outra = await db.query<{ id: string }>(
      `select "CO_QUADRO_VAGA" as id from public."TB_QUADRO_VAGA_EDITAL" where "CO_MONITORAMENTO" = $1`,
      [EDITAL_EXTERNO],
    );
    expect(
      await erroDe(gravar(db, "1002", "CONFIRMAR", outra.rows[0]!.id)),
    ).toBe("22023");
    expect(await erroDe(gravar(db, "9999", "SEM_LINHA"))).toBe("22023");
    expect(await erroDe(gravar(db, "1002", "APAGAR"))).toBe("22023");
  });

  it("confirmar, marcar sem linha e devolver à regra, com quem e quando", async () => {
    const db = await bancoMigrado();
    await entrar(db, 2);
    await gravar(db, "1002", "CONFIRMAR", linhas.l2);
    await gravar(db, "1004", "SEM_LINHA");
    let v = await vinculos(db, EDITAL);
    expect(v.find((x) => x.vaga === "1002")).toMatchObject({
      situacao: "CONFIRMADO",
      origem: "MANUAL",
      quadro: linhas.l2,
    });
    expect(v.find((x) => x.vaga === "1004")).toMatchObject({
      situacao: "AUSENTE",
      origem: "MANUAL",
      pendencia: null,
    });

    const { rows } = await db.query<{
      obter: { vinculos: Record<string, unknown>[]; pode_editar: boolean };
    }>(`select public.obter_quadro_de_vagas($1)::jsonb as obter`, [EDITAL]);
    expect(rows[0]!.obter.pode_editar).toBe(true);
    expect(
      rows[0]!.obter.vinculos.find((x) => x["vaga"] === "1002"),
    ).toMatchObject({
      situacao: "CONFIRMADO",
      origem: "MANUAL",
      cargo: "Enfermeiro",
      cargo_quadro: "Enfermeiro",
      lotacao_quadro: "Polo Base Beta",
      confirmado_por: "Pessoa da Equipe",
    });

    // A rodada automática não mexe no que a equipe decidiu.
    await db.query(`select private."FC_PREENCHER_TODOS_VINCULOS_QUADRO"()`);
    v = await vinculos(db, EDITAL);
    expect(v.find((x) => x.vaga === "1002")).toMatchObject({
      origem: "MANUAL",
      quadro: linhas.l2,
    });

    await gravar(db, "1002", "AUTOMATICO");
    v = await vinculos(db, EDITAL);
    expect(v.find((x) => x.vaga === "1002")).toMatchObject({
      situacao: "AMBIGUO",
      origem: "AUTOMATICO",
    });
    const h = await db.query<{ evento: string; usuario: string | null }>(
      `select "TP_EVENTO" as evento, "CO_USUARIO"::text as usuario from public."TH_VAGA_QUADRO_EDITAL"
        where "CO_VAGA" = '1002' order by "SQ_HISTORICO"`,
    );
    expect(h.rows.map((r) => r.evento)).toEqual([
      "PREENCHIMENTO",
      "CONFIRMACAO",
      "RETORNO_AUTOMATICO",
    ]);
  });
});

describe("a reimportação do quadro", () => {
  it("passa o vínculo para a linha de mesmo cargo e lotação; o manual cuja linha saiu fica com pendência", async () => {
    const db = await bancoMigrado();
    await entrar(db, 2);
    await gravar(db, "1002", "CONFIRMAR", linhas.l2);
    await gravar(db, "1004", "CONFIRMAR", linhas.l4);
    await db.query(`select public.salvar_quadro_de_vagas($1, $2)`, [
      EDITAL,
      JSON.stringify({
        linhas: [
          { cargo: "ENFERMEIRO", lotacao: "Polo base Alfa." },
          { cargo: "Enfermeiro", lotacao: "Polo Base Beta" },
          { cargo: "Médico", lotacao: "Polo Base Alfa" },
          { cargo: "Odontólogo", lotacao: "Polo Base Gama" },
          {
            cargo: "CARGO 7 - Técnico de Enfermagem",
            lotacao: "Polo Base Alfa",
          },
        ],
      }),
    ]);
    const novas = await db.query<{ id: string }>(
      `select "CO_QUADRO_VAGA" as id from public."TB_QUADRO_VAGA_EDITAL"
        where "CO_MONITORAMENTO" = $1 and "ST_REGISTRO_ATIVO" = 'S' order by "NU_ORDEM"`,
      [EDITAL],
    );
    const [n1, n2, n3, , n5] = novas.rows.map((r) => r.id);
    const v = await vinculos(db, EDITAL);
    expect(v.find((x) => x.vaga === "1001")).toMatchObject({
      situacao: "CONFIRMADO",
      origem: "AUTOMATICO",
      quadro: n1,
    });
    expect(v.find((x) => x.vaga === "1002")).toMatchObject({
      situacao: "CONFIRMADO",
      origem: "MANUAL",
      quadro: n2,
    });
    expect(v.find((x) => x.vaga === "1003")).toMatchObject({
      situacao: "CONFIRMADO",
      quadro: n3,
    });
    expect(v.find((x) => x.vaga === "2001")).toMatchObject({
      situacao: "CONFIRMADO",
      regra: "TITULO",
      quadro: n5,
    });
    const sumiu = v.find((x) => x.vaga === "1004");
    expect(sumiu).toMatchObject({
      situacao: "AUSENTE",
      origem: "MANUAL",
      quadro: null,
    });
    expect(sumiu?.pendencia).toMatch(
      /^A linha escolhida \(Cirurgião Dentista 40h — Polo Base Gama\) saiu do quadro em \d\d\/\d\d\/\d{4}\.$/,
    );

    const h = await db.query<{ vaga: string }>(
      `select "CO_VAGA" as vaga from public."TH_VAGA_QUADRO_EDITAL" where "TP_EVENTO" = 'REIMPORTACAO' order by 1`,
    );
    expect(h.rows.map((r) => r.vaga)).toEqual([
      "1001",
      "1002",
      "1003",
      "1004",
      "2001",
    ]);
  });
});

describe("quem consulta o vínculo", () => {
  async function quadroDaClassificacao(
    db: Banco,
  ): Promise<Record<string, string | null>> {
    const { rows } = await db.query<{
      dados: { candidatos: { vaga: string; quadro: string | null }[] };
    }>(
      `select private."FC_DADOS_CLASSIFICACAO_EDITAL"($1, 'saude-indigena')::jsonb as dados`,
      [EDITAL],
    );
    return Object.fromEntries(
      rows[0]!.dados.candidatos.map((c) => [c.vaga, c.quadro]),
    );
  }

  it("a Classificação usa a linha confirmada e respeita o 'sem linha'", async () => {
    const db = await bancoMigrado();
    expect(await quadroDaClassificacao(db)).toEqual({
      "1001": linhas.l1,
      "1002": null,
      "1003": linhas.l3,
      "1004": null,
      "1005": null,
    });
    await entrar(db, 2);
    await gravar(db, "1002", "CONFIRMAR", linhas.l2);
    await gravar(db, "1001", "SEM_LINHA");
    expect(await quadroDaClassificacao(db)).toMatchObject({
      "1001": null,
      "1002": linhas.l2,
      "1003": linhas.l3,
    });
  });

  it("a Classificação de hoje e a migrada dão o mesmo quadro sem decisão da equipe", async () => {
    const antes = await bancoAntesComDados();
    const depois = await bancoMigrado();
    const ler = async (db: Banco) =>
      (
        await db.query(
          `select private."FC_DADOS_CLASSIFICACAO_EDITAL"($1, 'saude-indigena')::jsonb -> 'candidatos' as c`,
          [EDITAL],
        )
      ).rows;
    expect(await ler(depois)).toEqual(await ler(antes));
  });

  it("a pré-classificação (FC_QUADRO_DA_VAGA_EMPREGARE) consulta o vínculo antes da regra", async () => {
    const db = await bancoMigrado();
    // Função sql que devolve uma linha composta: sem linha do quadro, vem uma linha toda nula (como hoje).
    const linha = async (vaga: string) =>
      (
        await db.query<{ id: string | null }>(
          `select "CO_QUADRO_VAGA" as id from private."FC_QUADRO_DA_VAGA_EMPREGARE"($1, $2)`,
          [EDITAL, vaga],
        )
      ).rows
        .map((r) => r.id)
        .filter((id) => id !== null);
    expect(await linha("1002")).toEqual([]);
    expect(await linha("2001")).toEqual([linhas.l5]);
    await entrar(db, 2);
    await gravar(db, "1002", "CONFIRMAR", linhas.l2);
    await gravar(db, "2001", "SEM_LINHA");
    expect(await linha("1002")).toEqual([linhas.l2]);
    expect(await linha("2001")).toEqual([]);
  });

  it("a conferência recebe os vínculos com as candidatas", async () => {
    const db = await bancoMigrado();
    const { rows } = await db.query<{
      v: { vaga: string; situacao: string; candidatas: { id: string }[] }[];
    }>(`select public.conferencia_ler_listas_e_quadros() -> 'vinculos' as v`);
    const ambigua = rows[0]!.v.find((x) => x.vaga === "1002");
    expect(ambigua).toMatchObject({ situacao: "AMBIGUO" });
    expect(ambigua?.candidatas.map((c) => c.id)).toEqual([
      linhas.l1,
      linhas.l2,
    ]);
  });

  it("o edital sem vaga com código diz por quê", async () => {
    const db = await bancoMigrado();
    await entrar(db, 1);
    const situacao = async (e: string) =>
      (
        await db.query<{ s: string }>(
          `select public.obter_quadro_de_vagas($1)::jsonb ->> 'vagas_do_edital' as s`,
          [e],
        )
      ).rows[0]!.s;
    expect(await situacao(EDITAL)).toBe("COM_CODIGO");
    expect(await situacao(EDITAL_CANCELADO)).toBe("NAO_SE_APLICA");
    expect(await situacao(EDITAL_EXTERNO)).toBe("EXTERNO");
    expect(await situacao(EDITAL_SEM_CODIGO)).toBe("PENDENTE_INTEGRACAO");
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio roda sobre o banco de hoje e não grava nada", async () => {
    const db = await bancoAntesComDados();
    await db.exec(ensaio());
    expect(
      (
        await db.query(
          `select to_regclass('public."TA_VAGA_QUADRO_EDITAL"') as t`,
        )
      ).rows,
    ).toEqual([{ t: null }]);
  });

  it("o rollback devolve as funções letra por letra e tira o que a migration criou", async () => {
    const antes = await bancoAntesComDados();
    const db = await bancoMigrado();
    await db.exec(rollback());
    expect(await retratoDasFuncoes(db)).toEqual(await retratoDasFuncoes(antes));
    const { rows } = await db.query(
      `select to_regclass('public."TA_VAGA_QUADRO_EDITAL"') as ta, to_regclass('public."TH_VAGA_QUADRO_EDITAL"') as th,
              (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where p.proname in ('FC_CHAVE_LINHA_QUADRO', 'FC_CANDIDATAS_DO_QUADRO', 'FC_VAGAS_PARA_O_QUADRO',
                                    'FC_VINCULO_AUTOMATICO_QUADRO', 'FC_GRAVAR_VINCULO_QUADRO', 'FC_PREENCHER_VINCULOS_QUADRO',
                                    'FC_PREENCHER_TODOS_VINCULOS_QUADRO', 'FC_QUADRO_DA_VAGA_VINCULADA', 'FC_EXIGIR_EDITAR_QUADRO',
                                    'gravar_vinculo_do_quadro', 'atualizar_vinculos_do_quadro')) as funcoes,
              (select count(*)::int from cron.job) as tarefas,
              (select count(*)::int from public."TB_TAREFA_AGENDADA") as catalogo`,
    );
    expect(rows).toEqual([
      { ta: null, th: null, funcoes: 0, tarefas: 0, catalogo: 0 },
    ]);
    // E a migration aplica de novo.
    await db.exec(migration());
  });

  it("o rollback para quando há decisão da equipe, até confirmarem a perda", async () => {
    const db = await bancoMigrado();
    await entrar(db, 2);
    await gravar(db, "1002", "CONFIRMAR", linhas.l2);
    await expect(db.exec(rollback())).rejects.toThrow(/decididos pela equipe/);
    await db.exec(`rollback`);
    await db.exec(
      rollback().replace(
        "set local lock_timeout = '5s';",
        "set local lock_timeout = '5s';\nselect set_config('agsus.rollback_perde_manuais', 'sim', true);",
      ),
    );
    expect(
      (
        await db.query(
          `select to_regclass('public."TA_VAGA_QUADRO_EDITAL"') as t`,
        )
      ).rows,
    ).toEqual([{ t: null }]);
  });
});
