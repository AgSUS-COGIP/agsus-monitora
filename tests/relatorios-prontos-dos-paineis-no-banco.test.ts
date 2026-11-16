// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type Banco,
  bancoComRelatoriosProntos,
  corpoDaFuncao,
  entrar,
  erroDe,
  rollbackDosLimites,
  rollbackDosProntos,
  RPCS_ANTIGAS,
  rpcsAntigas,
  salvarDeAntes,
  uma,
  USUARIO_ADMIN,
} from "./apoio/banco-dos-paineis.ts";

/*
  Relatórios prontos dos Painéis (migration 20261116160000) num Postgres de
  verdade (PGlite): o resultado calculado fica guardado por área e relatório,
  a leitura pagina e aplica o recorte da coordenação, o Sincronizar recalcula
  no máximo uma vez por minuto, a troca de fonte recalcula na mesma transação
  e o cálculo de todos (o cron de hora em hora) segue quando um falha. O
  cálculo em si é imitado (as tabelas dos editais não existem aqui).
*/

const LONGO = 60_000;
const SI = "saude-indigena";
const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "aaaaaaaa-0000-0000-0000-00000000000b";
const C = "aaaaaaaa-0000-0000-0000-00000000000c";
const POR_CARGO = "editais-por-cargo";
const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

const FONTE_DE_TESTE = `
create table public.fonte_vaga (edital uuid, vaga text, qt integer);
insert into public.fonte_vaga values ('${A}', '1', 7);
create view painel."VW_VAGA_TESTE" as
  select edital as "CO_MONITORAMENTO", vaga as "CO_VAGA", qt as "QT_VAGA" from public.fonte_vaga;
comment on view painel."VW_VAGA_TESTE" is 'Fonte de teste';
comment on column painel."VW_VAGA_TESTE"."QT_VAGA" is 'Vagas de teste';
`;

type Pagina = {
  schema_version: number;
  calculado_em: string;
  total: number;
  pagina: number;
  por_pagina: number | null;
  linhas: { edital_id: string; posicao: number }[];
  fontes: Record<string, { padrao: boolean }>;
  avisos: string[];
};

let db: Banco;
/*
  A primeira chamada monta o molde do banco (lenta com a suíte em carga):
  fica aqui, com prazo próprio, fora do prazo de 10 s do beforeEach.
*/
beforeAll(() => bancoComRelatoriosProntos(), 60_000);
beforeEach(async () => {
  db = await bancoComRelatoriosProntos();
  await db.exec(FONTE_DE_TESTE);
  // 120 linhas em Editais por cargo da Saúde indígena: 40 de cada edital, na ordem A, B, C.
  await db.query(
    `insert into public.linha_de_teste (area, relatorio, n, linha)
     select $1, $2, n, jsonb_build_object(
              'edital_id', (array[$3, $4, $5])[(n - 1) / 40 + 1],
              'codigo_vaga', n::text, 'vagas_imediatas', n, 'inscritos', 0, 'aprovados', 0,
              'posicao', n)
       from generate_series(1, 120) n`,
    [SI, POR_CARGO, A, B, C],
  );
  await entrar(db, {
    uid: USUARIO_ADMIN,
    nivel: 3,
    areas: [SI, "sede", "projetos"],
  });
}, LONGO);

async function ler(pagina: number | null, porPagina: number | null) {
  const r = await uma<{ j: Pagina }>(
    db,
    `select public.ler_relatorio_do_painel($1, $2, $3, $4) as j`,
    [SI, POR_CARGO, pagina, porPagina],
  );
  return r!.j;
}
async function sincronizar() {
  const r = await uma<{ j: { calculado_em: string; recalculado: boolean } }>(
    db,
    `select public.sincronizar_relatorio_do_painel($1, $2) as j`,
    [SI, POR_CARGO],
  );
  return r!.j;
}
const envelhecer = () =>
  db.exec(
    `update public."TB_CALCULO_RELATORIO_PAINEL" set "DT_CALCULO" = "DT_CALCULO" - interval '2 minutes'`,
  );

describe("leitura paginada", () => {
  it(
    "lê a página pedida, na ordem do cálculo, com o total",
    async () => {
      const p = await ler(2, 50);
      expect(p.schema_version).toBe(4);
      expect(p.linhas).toHaveLength(50);
      expect(p.linhas[0]?.posicao).toBe(51);
      expect(p.total).toBe(120);
      expect(p.pagina).toBe(2);
      expect(p.por_pagina).toBe(50);
      expect(p.calculado_em).toEqual(expect.any(String));
    },
    LONGO,
  );

  it(
    "sem tamanho de página, devolve todas as linhas",
    async () => {
      const p = await ler(1, null);
      expect(p.linhas).toHaveLength(120);
      expect(p.por_pagina).toBeNull();
    },
    LONGO,
  );

  it(
    "tamanho de página fora de 25/50/100 é recusado",
    async () => {
      expect((await erroDe(ler(1, 10)))?.codigo).toBe("22023");
    },
    LONGO,
  );

  it(
    "o recorte da coordenação vale na página, no total e no download",
    async () => {
      await entrar(db, {
        uid: USUARIO_ADMIN,
        nivel: 3,
        areas: [SI],
        editais: [A],
      });
      const p = await ler(1, 50);
      expect(p.total).toBe(40);
      expect(p.linhas.every((l) => l.edital_id === A)).toBe(true);
      const tudo = await ler(1, null);
      expect(tudo.linhas).toHaveLength(40);
      expect(tudo.linhas.every((l) => l.edital_id === A)).toBe(true);
    },
    LONGO,
  );

  it(
    "página além da última volta para a última",
    async () => {
      const p = await ler(9, 50);
      expect(p.pagina).toBe(3);
      expect(p.linhas).toHaveLength(20);
    },
    LONGO,
  );

  it(
    "sem cálculo, a primeira leitura calcula",
    async () => {
      expect(
        await uma(
          db,
          `select count(*)::int as n from public."TB_CALCULO_RELATORIO_PAINEL"`,
        ),
      ).toEqual({ n: 0 });
      expect((await ler(1, 50)).total).toBe(120);
      expect(
        await uma(
          db,
          `select "QT_LINHA" as n from public."TB_CALCULO_RELATORIO_PAINEL"
            where "CO_AREA" = $1 and "CO_RELATORIO" = $2`,
          [SI, POR_CARGO],
        ),
      ).toEqual({ n: 120 });
    },
    LONGO,
  );

  it(
    "sem acesso à área, leitura e sincronizar são recusados",
    async () => {
      await entrar(db, { uid: USUARIO_ADMIN, nivel: 0, areas: [SI] });
      expect((await erroDe(ler(1, 50)))?.codigo).toBe("42501");
      expect((await erroDe(sincronizar()))?.codigo).toBe("42501");
    },
    LONGO,
  );

  it(
    "a API não lê as tabelas prontas",
    async () => {
      await ler(1, 50);
      await db.exec("set role authenticated");
      const erro = await erroDe(
        db.query(`select count(*) from public."TB_LINHA_RELATORIO_PAINEL"`),
      );
      await db.exec("reset role");
      expect(erro?.codigo).toBe("42501");
    },
    LONGO,
  );
});

describe("recálculo", () => {
  it(
    "sincronizar recalcula, mas não duas vezes no mesmo minuto",
    async () => {
      await ler(1, 50);
      await db.exec(
        `insert into public.linha_de_teste values ('${SI}', '${POR_CARGO}', 121,
           jsonb_build_object('edital_id', '${C}', 'posicao', 121))`,
      );
      expect((await ler(1, 50)).total).toBe(120);
      await envelhecer();
      expect((await sincronizar()).recalculado).toBe(true);
      expect((await ler(1, 50)).total).toBe(121);
      expect((await sincronizar()).recalculado).toBe(false);
      await envelhecer();
      expect((await sincronizar()).recalculado).toBe(true);
    },
    LONGO,
  );

  it(
    "troca de fonte recalcula na mesma transação",
    async () => {
      await db.query(
        `select public.salvar_fonte_da_coluna($1, $2, 'vagas_imediatas', 'VW_VAGA_TESTE', 'QT_VAGA', 'Conferir a fonte nova.')`,
        [SI, POR_CARGO],
      );
      expect(
        await uma(
          db,
          `select "DS_FONTES" -> 'vagas_imediatas' ->> 'padrao' as padrao
             from public."TB_CALCULO_RELATORIO_PAINEL" where "CO_AREA" = $1 and "CO_RELATORIO" = $2`,
          [SI, POR_CARGO],
        ),
      ).toEqual({ padrao: "false" });
      expect((await ler(1, 50)).fontes.vagas_imediatas?.padrao).toBe(false);
    },
    LONGO,
  );

  it(
    "troca de fonte com recálculo que falha é desfeita",
    async () => {
      await db.query(`select set_config('teste.falhar', $1, false)`, [SI]);
      const erro = await erroDe(
        db.query(
          `select public.salvar_fonte_da_coluna($1, $2, 'vagas_imediatas', 'VW_VAGA_TESTE', 'QT_VAGA', 'Conferir a fonte nova.')`,
          [SI, POR_CARGO],
        ),
      );
      expect(erro?.mensagem).toContain("Falha de teste");
      expect(
        await uma(
          db,
          `select (select count(*) from public."TB_FONTE_COLUNA_PAINEL")::int as escolhas,
                  (select count(*) from public."TH_FONTE_COLUNA_PAINEL")::int as historico`,
        ),
      ).toEqual({ escolhas: 0, historico: 0 });
    },
    LONGO,
  );

  it(
    "o cálculo de todos segue quando um falha",
    async () => {
      await db.query(`select set_config('teste.falhar', 'sede', false)`);
      expect(
        await uma(db, `select private."FC_CALCULAR_PAINEIS"() as n`),
      ).toEqual({ n: 6 });
      expect(
        await uma(
          db,
          `select count(*) filter (where "CO_AREA" = 'sede')::int as sede,
                  count(*)::int as todos
             from public."TB_CALCULO_RELATORIO_PAINEL"`,
        ),
      ).toEqual({ sede: 0, todos: 6 });
    },
    LONGO,
  );
});

describe("limites de tempo (20261116170000)", () => {
  const RPCS = [
    "public.ler_relatorio_do_painel(text, text, integer, integer)",
    "public.sincronizar_relatorio_do_painel(text, text)",
    "public.salvar_fonte_da_coluna(text, text, text, text, text, text)",
  ];
  const config = (assinatura: string) =>
    uma<{ c: string[] | null }>(
      db,
      `select proconfig as c from pg_proc where oid = to_regprocedure($1)`,
      [assinatura],
    );

  it(
    "as RPCs que recalculam esperam o cron e calculam sem cair no limite do papel",
    async () => {
      for (const rpc of RPCS)
        expect((await config(rpc))?.c).toEqual(
          expect.arrayContaining(["statement_timeout=30s", "lock_timeout=15s"]),
        );
    },
    LONGO,
  );

  it(
    "o rollback tira os limites e mantém o resto",
    async () => {
      await db.exec(rollbackDosLimites());
      for (const rpc of RPCS)
        expect((await config(rpc))?.c ?? []).toEqual(['search_path=""']);
      const erro = await erroDe(db.exec(rollbackDosLimites()));
      await db.exec("rollback");
      expect(erro?.mensagem).toMatch(/não está aplicada/);
    },
    LONGO,
  );
});

describe("rollback", () => {
  it(
    "o rollback volta ao banco de antes",
    async () => {
      await ler(1, 50);
      await db.exec(rollbackDosLimites());
      await db.exec(rollbackDosProntos());
      expect(
        await uma(
          db,
          `select to_regclass('public."TB_LINHA_RELATORIO_PAINEL"') as linhas,
                  to_regclass('public."TB_CALCULO_RELATORIO_PAINEL"') as calculo,
                  to_regprocedure('public.ler_relatorio_do_painel(text, text, integer, integer)') as ler,
                  to_regprocedure('private."FC_CALCULAR_PAINEIS"()') as todos`,
        ),
      ).toEqual({ linhas: null, calculo: null, ler: null, todos: null });
      const antigas = rpcsAntigas();
      for (const [i, nome] of RPCS_ANTIGAS.entries()) {
        expect(
          await uma(
            db,
            `select md5(prosrc) as m from pg_proc where oid = to_regprocedure($1)`,
            [`public.${nome}(text)`],
          ),
        ).toEqual({ m: md5(corpoDaFuncao(antigas[i]!)) });
      }
      expect(
        await uma(
          db,
          `select md5(prosrc) as m from pg_proc
            where oid = to_regprocedure('public.salvar_fonte_da_coluna(text, text, text, text, text, text)')`,
        ),
      ).toEqual({ m: md5(corpoDaFuncao(salvarDeAntes())) });
    },
    LONGO,
  );

  it(
    "o rollback aborta se a migration não estiver aplicada",
    async () => {
      await db.exec(rollbackDosLimites());
      await db.exec(rollbackDosProntos());
      const erro = await erroDe(db.exec(rollbackDosProntos()));
      await db.exec("rollback");
      expect(erro?.mensagem).toMatch(/não está aplicada/);
    },
    LONGO,
  );
});
