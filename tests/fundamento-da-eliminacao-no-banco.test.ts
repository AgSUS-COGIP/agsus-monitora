// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Banco,
  bancoDeHoje,
  EDITAL,
  ENSAIO,
  entrar,
  erroDe,
  funcaoDoRetrato,
  MIGRATION,
  novaVersaoDaRegra,
  REGRA,
  retratoDaTriagem,
  ROLLBACK,
  rpc,
} from "./apoio/banco-do-fundamento.ts";

/*
  Migration 20261110215930 (issue #593): o fundamento normativo das eliminações da
  Triagem é escolhido e conferido SÓ pelo gestor ou coordenador do edital, ou pelo
  administrador global; nada é presumido; a conferência é auditada e imutável; o
  comunicado (conferir_eliminados_pre_classificacao) leva o item só quando conferido; e
  nada da Triagem gravada muda. Postgres de verdade (PGlite), dados fictícios.
*/

const LONGO = 120_000;
const FONTE = "Edital nº 114/2026, texto publicado, conferido na íntegra";
const JUSTIFICATIVA = "Retificação após conferir o texto publicado do edital";

type Fundamento = {
  situacao: string;
  item_edital: string;
  versao_regra: number;
  fonte: string;
} | null;
type Conferencia = {
  ok: boolean;
  sem_mudanca: boolean;
  fundamento: Fundamento;
};
type Candidato = {
  codigo: string;
  situacao: string;
  motivo_codigo: string | null;
  fundamento: Fundamento;
};
type Quadro = {
  pode_conferir: boolean;
  regra: { versao: number; situacao: string; item_da_nota: string | null };
  motivos: {
    codigo: string;
    eliminados: number;
    item_na_regra: string | null;
    fundamento: Fundamento;
  }[];
  fora_da_regra: { codigo: string; eliminados: number }[];
  fora_do_lote_por_nota: number;
  historico: {
    motivo_codigo: string;
    item_edital: string;
    papel: string;
    por: string;
    justificativa: string | null;
  }[];
};

const conferir = (
  db: Banco,
  motivo: string,
  item: string,
  { versao = 1, fonte = FONTE, justificativa = null as string | null } = {},
) =>
  rpc<Conferencia>(
    db,
    `public.conferir_fundamento_da_eliminacao($1, $2, $3, $4, $5, $6)`,
    [EDITAL, motivo, versao, item, fonte, justificativa],
  );
const quadro = (db: Banco) =>
  rpc<Quadro>(db, `public.obter_fundamentos_da_eliminacao($1)`, [EDITAL]);
const comunicados = async (db: Banco) =>
  (
    await rpc<{ candidatos: Candidato[] }>(
      db,
      `public.conferir_eliminados_pre_classificacao($1, $2)`,
      [
        EDITAL,
        [
          "101|9001",
          "101|9002",
          "101|9003",
          "101|9004",
          "101|9005",
          "101|9006",
        ],
      ],
    )
  ).candidatos;
const porCodigo = (lista: Candidato[], codigo: string) =>
  lista.find((c) => c.codigo === codigo);

async function migrado(): Promise<Banco> {
  const db = await bancoDeHoje();
  await db.exec(MIGRATION);
  return db;
}

describe("fundamento da eliminação: migration", () => {
  it(
    "aplica sobre o retrato de hoje (guarda md5) sem criar fundamento nem mudar a Triagem",
    async () => {
      const db = await bancoDeHoje();
      const antes = await retratoDaTriagem(db);
      await db.exec(MIGRATION);
      expect(await retratoDaTriagem(db)).toBe(antes);
      const n = await db.query<{ n: number }>(
        `select count(*)::int as n from public."TH_FUNDAMENTO_ELIMINACAO"`,
      );
      expect(n.rows[0]?.n).toBe(0);
      await entrar(db, "gestor");
      for (const c of await comunicados(db)) expect(c.fundamento).toBeNull();
    },
    LONGO,
  );

  it(
    "recusa um banco cuja conferência dos eliminados mudou depois do retrato, sem aplicar nada",
    async () => {
      const db = await bancoDeHoje();
      await db.exec(
        funcaoDoRetrato("public.conferir_eliminados_pre_classificacao")
          .replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION")
          .replace("No máximo 10.000 por vez.", "No máximo 10 mil por vez."),
      );
      const erro = await erroDe(db.exec(MIGRATION));
      expect(erro?.mensagem).toMatch(/mudou depois do retrato/);
      await db.exec("rollback");
      const t = await db.query(
        `select to_regclass('public."TH_FUNDAMENTO_ELIMINACAO"') as t`,
      );
      expect(t.rows[0]).toEqual({ t: null });
    },
    LONGO,
  );

  it(
    "o ensaio traz o corpo da migration igual ao arquivo, roda e termina em rollback",
    async () => {
      const corpo = MIGRATION.slice(
        MIGRATION.indexOf("\nbegin;\n") + 8,
        MIGRATION.lastIndexOf("\ncommit;\n") + 1,
      );
      expect(ENSAIO).toContain(
        `-- >>> corpo da migration\n${corpo}-- <<< corpo da migration`,
      );
      expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
      const db = await bancoDeHoje();
      await db.exec(ENSAIO);
      const t = await db.query(
        `select to_regclass('public."TH_FUNDAMENTO_ELIMINACAO"') as t`,
      );
      expect(t.rows[0]).toEqual({ t: null });
    },
    LONGO,
  );

  it(
    "o ensaio percorre o Edital 114/2026 até a conferência simulada chegar ao comunicado",
    async () => {
      const marco = "114/2026: conferência simulada ok";
      expect(ENSAIO).toContain(`raise notice '${marco}`);
      const db = await bancoDeHoje();
      const erro = await erroDe(
        db.exec(
          ENSAIO.replace(
            `raise notice '${marco}`,
            `raise exception 'CHEGOU: ${marco}`,
          ),
        ),
      );
      expect(erro?.mensagem).toMatch(
        /^CHEGOU: 114\/2026: conferência simulada ok/,
      );
    },
    LONGO,
  );
});

describe("fundamento da eliminação: quem confere", () => {
  let db: Banco;
  beforeAll(async () => {
    db = await migrado();
  }, LONGO);

  it("sem sessão, ninguém confere", async () => {
    await entrar(db, null);
    expect((await erroDe(conferir(db, "QUESTIONARIO", "6.4")))?.codigo).toBe(
      "42501",
    );
  });

  it.each([
    ["analista do edital", "analista"],
    [
      "coordenador só na equipe da avaliação (sem ser gestor)",
      "coordenadorDaEquipe",
    ],
    ["gestor que não vê o edital", "gestorDeOutraArea"],
    [
      "gestor sem nível de administrador na Avaliação documental",
      "gestorSemNivel",
    ],
  ] as const)("%s não confere (42501)", async (_, pessoa) => {
    await entrar(db, pessoa);
    const erro = await erroDe(conferir(db, "QUESTIONARIO", "6.4"));
    expect(erro?.codigo).toBe("42501");
    expect(erro?.mensagem).toMatch(/gestor ou o coordenador do edital/);
  });

  it.each([
    ["gestor do edital", "gestor", "QUESTIONARIO", "EDITAL_GESTOR"],
    ["coordenador do edital", "coordenador", "CANCELADO", "COORDENADOR"],
    ["administrador global", "admin", "REPROVADO_EMPREGARE", "ADMIN_GLOBAL"],
  ] as const)(
    "%s confere, e a auditoria guarda papel, responsável, regra e fonte",
    async (_, pessoa, motivo, papel) => {
      await entrar(db, pessoa);
      const r = await conferir(db, motivo, "6.4");
      expect(r.ok).toBe(true);
      expect(r.fundamento).toMatchObject({
        situacao: "CONFERIDO",
        item_edital: "6.4",
        versao_regra: 1,
        fonte: FONTE,
      });
      const linha = await db.query<Record<string, unknown>>(
        `select "TP_PAPEL", "CO_USUARIO"::text as usuario, "NU_VERSAO_REGRA", "DS_HASH_REGRA", "DS_FONTE",
              "DS_REGRA_MOTIVO" ->> 'codigo' as codigo, "DT_CONFERENCIA" is not null as quando
         from public."TH_FUNDAMENTO_ELIMINACAO" where "CO_MOTIVO_ELIMINACAO" = $1`,
        [motivo],
      );
      expect(linha.rows).toHaveLength(1);
      expect(linha.rows[0]).toMatchObject({
        TP_PAPEL: papel,
        NU_VERSAO_REGRA: 1,
        DS_HASH_REGRA: "1".padStart(64, "0"),
        DS_FONTE: FONTE,
        codigo: motivo,
        quando: true,
      });
    },
  );

  it("o quadro: analista não lê; coordenador da equipe lê sem poder conferir; gestor pode", async () => {
    await entrar(db, "analista");
    expect((await erroDe(quadro(db)))?.codigo).toBe("42501");
    await entrar(db, "coordenadorDaEquipe");
    expect((await quadro(db)).pode_conferir).toBe(false);
    await entrar(db, "gestor");
    const q = await quadro(db);
    expect(q.pode_conferir).toBe(true);
    expect(q.regra).toEqual({
      versao: 1,
      situacao: "CONFERIDA",
      item_da_nota: "8.2.6",
    });
    expect(q.motivos.map((m) => [m.codigo, m.eliminados])).toEqual([
      ["CANCELADO", 1],
      ["QUESTIONARIO", 1],
      ["REPROVADO_EMPREGARE", 1],
      ["TERMO", 0],
    ]);
    expect(q.motivos.find((m) => m.codigo === "TERMO")).toMatchObject({
      item_na_regra: "5.7.5",
      fundamento: null,
    });
    expect(q.fora_da_regra).toEqual([
      {
        codigo: "SAIU_DA_EMPREGARE",
        motivo: "Saiu do arquivo da Empregare",
        eliminados: 1,
      },
    ]);
    // Fora do lote pela nota não é eliminado nem recebe comunicado de eliminação.
    expect(q.fora_do_lote_por_nota).toBe(1);
    expect(q.historico.map((h) => h.papel).sort()).toEqual([
      "ADMIN_GLOBAL",
      "COORDENADOR",
      "EDITAL_GESTOR",
    ]);
    expect(q.historico[0]?.por).toMatch(/^Pessoa /);
  });
});

describe("fundamento da eliminação: o que se confere", () => {
  let db: Banco;
  beforeAll(async () => {
    db = await migrado();
    await entrar(db, "gestor");
  }, LONGO);

  it.each([
    [
      "versão da regra diferente da vigente",
      { motivo: "QUESTIONARIO", item: "6.4", versao: 2 },
      "40001",
      /mudou/,
    ],
    [
      "motivo fora da regra (SAIU_DA_EMPREGARE)",
      { motivo: "SAIU_DA_EMPREGARE", item: "6.4" },
      "22023",
      /não está na regra/,
    ],
    [
      "item fora do formato oficial",
      { motivo: "QUESTIONARIO", item: "item 6" },
      "22023",
      /item do edital/,
    ],
    [
      "fonte curta",
      { motivo: "QUESTIONARIO", item: "6.4", fonte: "edital" },
      "22023",
      /fonte/,
    ],
    [
      "item da nota mínima do lote (8.2.6) sem justificativa",
      { motivo: "QUESTIONARIO", item: "8.2.6" },
      "22023",
      /nota mínima do lote/,
    ],
  ] as const)("recusa %s", async (_, c, codigo, mensagem) => {
    const erro = await erroDe(
      conferir(db, c.motivo, c.item, {
        versao: "versao" in c ? c.versao : 1,
        fonte: "fonte" in c ? c.fonte : FONTE,
      }),
    );
    expect(erro?.codigo).toBe(codigo);
    expect(erro?.mensagem).toMatch(mensagem);
  });

  it("o item da nota só com justificativa expressa, registrada", async () => {
    const r = await conferir(db, "TERMO", "8.2.6", {
      justificativa: "O texto oficial agrupa o termo no subitem da nota mínima",
    });
    expect(r.fundamento?.item_edital).toBe("8.2.6");
  });

  it("retificar exige justificativa; a conferência anterior fica como estava", async () => {
    await conferir(db, "QUESTIONARIO", "6.4");
    expect((await conferir(db, "QUESTIONARIO", "6.4")).sem_mudanca).toBe(true);
    const erro = await erroDe(conferir(db, "QUESTIONARIO", "6.5"));
    expect(erro?.mensagem).toMatch(/Para retificar, justifique/);
    const r = await conferir(db, "QUESTIONARIO", "6.5", {
      justificativa: JUSTIFICATIVA,
    });
    expect(r.fundamento?.item_edital).toBe("6.5");
    const linhas = await db.query<{
      item: string;
      justificativa: string | null;
    }>(
      `select "DS_ITEM_EDITAL" as item, "DS_JUSTIFICATIVA" as justificativa
         from public."TH_FUNDAMENTO_ELIMINACAO" where "CO_MOTIVO_ELIMINACAO" = 'QUESTIONARIO' order by "CO_HISTORICO"`,
    );
    expect(linhas.rows).toEqual([
      { item: "6.4", justificativa: null },
      { item: "6.5", justificativa: JUSTIFICATIVA },
    ]);
  });

  it("a conferência gravada não se altera nem se apaga", async () => {
    for (const sql of [
      `update public."TH_FUNDAMENTO_ELIMINACAO" set "DS_ITEM_EDITAL" = '1.1'`,
      `delete from public."TH_FUNDAMENTO_ELIMINACAO"`,
    ]) {
      const erro = await erroDe(db.query(sql));
      expect(erro?.codigo).toBe("42501");
    }
  });
});

describe("fundamento da eliminação: até o comunicado", () => {
  let db: Banco;
  let antes: string;
  beforeAll(async () => {
    db = await migrado();
    antes = await retratoDaTriagem(db);
    await entrar(db, "coordenador");
    await conferir(db, "QUESTIONARIO", "6.4");
  }, LONGO);

  it("só o motivo conferido leva fundamento; fora do lote pela nota e sem conferência, não", async () => {
    const lista = await comunicados(db);
    expect(porCodigo(lista, "9001")?.fundamento).toMatchObject({
      situacao: "CONFERIDO",
      item_edital: "6.4",
      versao_regra: 1,
    });
    expect(porCodigo(lista, "9002")?.fundamento).toBeNull(); // CANCELADO sem conferência
    expect(porCodigo(lista, "9004")).toMatchObject({
      situacao: "RANQUEADO",
      fundamento: null,
    });
    expect(porCodigo(lista, "9006")?.fundamento).toBeNull(); // fora da regra
    expect(await retratoDaTriagem(db)).toBe(antes);
  });

  it("regra nova com o mesmo motivo mantém o fundamento; motivo mudado pede reconferência", async () => {
    await novaVersaoDaRegra(db, 2, {
      ...REGRA,
      lote: { ...REGRA.lote, multiplo: 4 },
    });
    expect(
      porCodigo(await comunicados(db), "9001")?.fundamento?.item_edital,
    ).toBe("6.4");

    const mudada = structuredClone(REGRA);
    const questionario = mudada.requisitos.eliminacao_automatica.find(
      (e) => e.codigo === "QUESTIONARIO",
    );
    if (questionario) questionario.motivo = "Não concluiu o questionário";
    await novaVersaoDaRegra(db, 3, mudada);
    expect(porCodigo(await comunicados(db), "9001")?.fundamento).toBeNull();
    const q = await quadro(db);
    expect(
      q.motivos.find((m) => m.codigo === "QUESTIONARIO")?.fundamento?.situacao,
    ).toBe("RECONFERIR");

    // Reconfere na versão 3: mesmo item, sem justificativa (não é retificação).
    expect(
      (await conferir(db, "QUESTIONARIO", "6.4", { versao: 3 })).fundamento
        ?.situacao,
    ).toBe("CONFERIDO");

    // Regra a conferir: ninguém confere e o comunicado não traz fundamento.
    await novaVersaoDaRegra(db, 4, mudada, "CONFERIR");
    expect(porCodigo(await comunicados(db), "9001")?.fundamento).toBeNull();
    expect(
      (await erroDe(conferir(db, "CANCELADO", "6.4", { versao: 4 })))?.mensagem,
    ).toMatch(/Confira a regra da Triagem/);
    expect(await retratoDaTriagem(db)).toBe(antes);
  });
});

describe("fundamento da eliminação: rollback", () => {
  it(
    "com conferências gravadas, só roda com a exportação declarada; volta a conferência dos eliminados de antes",
    async () => {
      const db = await bancoDeHoje();
      const md5 = `select md5(prosrc) as m from pg_proc where oid = to_regprocedure('public.conferir_eliminados_pre_classificacao(uuid, text[])')`;
      const corpoDeAntes = (await db.query<{ m: string }>(md5)).rows[0]?.m;
      await db.exec(MIGRATION);
      await entrar(db, "admin");
      await conferir(db, "QUESTIONARIO", "6.4");

      const erro = await erroDe(db.exec(ROLLBACK));
      expect(erro?.mensagem).toMatch(/Exporte TH_FUNDAMENTO_ELIMINACAO/);
      await db.exec("rollback");

      await db.exec(`set agsus.descartar_fundamentos_exportados = 'sim'`);
      await db.exec(ROLLBACK);
      expect((await db.query<{ m: string }>(md5)).rows[0]?.m).toBe(
        corpoDeAntes,
      );
      const restos = await db.query(
        `select to_regclass('public."TH_FUNDAMENTO_ELIMINACAO"') as t,
                to_regprocedure('public.conferir_fundamento_da_eliminacao(uuid, text, integer, text, text, text)') as c,
                to_regprocedure('public.obter_fundamentos_da_eliminacao(uuid)') as o,
                to_regprocedure('private."FC_FUNDAMENTO_DA_ELIMINACAO"(uuid, text)') as f`,
      );
      expect(restos.rows[0]).toEqual({ t: null, c: null, o: null, f: null });
      // E a migration volta a aplicar (a guarda reconhece o corpo de antes).
      await db.exec(MIGRATION);
    },
    LONGO,
  );
});
