// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type Banco,
  bancoDosPaineis,
  entrar,
  erroDe,
  uma,
  USUARIO_ADMIN,
  USUARIO_LEITOR,
} from "./apoio/banco-dos-paineis.ts";

/*
  Fontes das colunas dos Painéis (migration 20261113220000, já aplicada; o SQL
  em tests/fixtures/sql-do-banco/) num Postgres de verdade (PGlite): o catálogo
  de fontes lido do próprio banco, a troca de valores por área com SQL montado
  só a partir do catálogo, as guardas contra nome forjado, chave repetida e
  fonte que sumiu, e as RPCs de listar e salvar.
*/

const LONGO = 60_000;
const EDITAL = "aaaaaaaa-0000-0000-0000-000000000001";
const EDITAL_2 = "aaaaaaaa-0000-0000-0000-000000000002";
const SI = "saude-indigena";

const FONTES_DE_TESTE = `
create table public.fonte_vaga (edital uuid, vaga text, qt integer, qt_texto text, quando timestamptz);
insert into public.fonte_vaga values
  ('${EDITAL}', '100', 7, 'sete', '2026-11-13 02:30:00+00'),
  ('${EDITAL}', '200', 3, 'tres', null);

create view painel."VW_VAGA_TESTE" as
  select edital as "CO_MONITORAMENTO", vaga as "CO_VAGA", qt as "QT_VAGA",
         qt_texto as "DS_VAGA", quando as "DT_REGISTRO"
    from public.fonte_vaga;
comment on view painel."VW_VAGA_TESTE" is 'Fonte de teste';
comment on column painel."VW_VAGA_TESTE"."QT_VAGA" is 'Vagas de teste';
comment on column painel."VW_VAGA_TESTE"."DS_VAGA" is 'Texto de teste';

create view painel."VW_VAGA_SEM_COMENTARIO" as
  select edital as "CO_MONITORAMENTO", vaga as "CO_VAGA", qt as "QT_VAGA" from public.fonte_vaga;
comment on column painel."VW_VAGA_SEM_COMENTARIO"."QT_VAGA" is 'Visão sem comentário';

create view painel."VW_EDITAL_TESTE" as
  select edital as "CO_MONITORAMENTO", sum(qt)::integer as "QT_TOTAL", max(quando) as "DT_REGISTRO"
    from public.fonte_vaga group by edital;
comment on view painel."VW_EDITAL_TESTE" is 'Fonte de edital de teste';
comment on column painel."VW_EDITAL_TESTE"."QT_TOTAL" is 'Total de teste';
comment on column painel."VW_EDITAL_TESTE"."DT_REGISTRO" is 'Registro de teste';

create view public."VW_VAGA_FORA" as
  select edital as "CO_MONITORAMENTO", vaga as "CO_VAGA", qt as "QT_VAGA" from public.fonte_vaga;
comment on view public."VW_VAGA_FORA" is 'Fora do schema painel';
comment on column public."VW_VAGA_FORA"."QT_VAGA" is 'Fora';
`;

const LINHAS_POR_VAGA = [
  {
    edital_id: EDITAL,
    codigo_vaga: "100",
    vagas_imediatas: 2,
    inscritos: 10,
    aprovados: 1,
  },
  {
    edital_id: EDITAL,
    codigo_vaga: "200",
    vagas_imediatas: null,
    inscritos: 20,
    aprovados: 0,
  },
  {
    edital_id: EDITAL,
    codigo_vaga: null,
    vagas_imediatas: 5,
    inscritos: 30,
    aprovados: null,
  },
  {
    edital_id: EDITAL_2,
    codigo_vaga: "100",
    vagas_imediatas: 4,
    inscritos: 40,
    aprovados: 2,
  },
];

type Fonte = {
  padrao: boolean;
  visao: string | null;
  coluna: string | null;
  rotulo: string;
};
type Aplicado = {
  linhas: Record<string, unknown>[];
  fontes: Record<string, Fonte>;
  avisos: string[];
};
type Fontes = {
  pode_editar: boolean;
  colunas: {
    coluna: string;
    rotulo: string;
    tipo: string;
    padrao: string;
    escolha: { visao: string; coluna: string } | null;
    opcoes: {
      visao: string;
      rotulo: string;
      colunas: { coluna: string; rotulo: string }[];
    }[];
  }[];
  historico: {
    em: string;
    nome: string;
    coluna: string;
    antes: string;
    depois: string;
    motivo: string;
  }[];
};

let db: Banco;
/*
  A primeira chamada monta o molde do banco (lenta com a suíte em carga):
  fica aqui, com prazo próprio, fora do prazo de 10 s do beforeEach.
*/
beforeAll(() => bancoDosPaineis(), 60_000);
beforeEach(async () => {
  db = await bancoDosPaineis();
  await db.exec(FONTES_DE_TESTE);
  await entrar(db, {
    uid: USUARIO_ADMIN,
    nivel: 3,
    areas: [SI, "sede", "projetos"],
  });
}, LONGO);

async function aplicar(area: string, relatorio: string, linhas: unknown[]) {
  const r = await uma<{ j: Aplicado }>(
    db,
    `select private."FC_APLICAR_FONTES_DO_PAINEL"($1, $2, $3::jsonb) as j`,
    [area, relatorio, JSON.stringify(linhas)],
  );
  return r!.j;
}
async function listar(area: string, relatorio: string) {
  const r = await uma<{ j: Fontes }>(
    db,
    `select public.listar_fontes_do_painel($1, $2) as j`,
    [area, relatorio],
  );
  return r!.j;
}
function salvar(
  area: string,
  relatorio: string,
  coluna: string,
  visao: string | null,
  colunaDaVisao: string | null,
  motivo = "Troca para conferir a fonte nova.",
) {
  return db.query<{ j: Fontes }>(
    `select public.salvar_fonte_da_coluna($1, $2, $3, $4, $5, $6) as j`,
    [area, relatorio, coluna, visao, colunaDaVisao, motivo],
  );
}
const coluna = (a: Aplicado, campo: string) => a.linhas.map((l) => l[campo]);

describe("catálogo de fontes", () => {
  it("lista só visões do grão, com comentário e tipo compatível", async () => {
    const r = await db.query(
      `select * from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('editais-por-cargo', 'vagas_imediatas')`,
    );
    expect(r.rows).toEqual([
      {
        no_visao: "VW_VAGA_TESTE",
        ds_rotulo_visao: "Fonte de teste",
        no_coluna: "QT_VAGA",
        ds_rotulo_coluna: "Vagas de teste",
      },
    ]);
    const datas = await db.query(
      `select no_visao, no_coluna from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('resumo-dos-editais', 'data_divulgacao')`,
    );
    expect(datas.rows).toEqual([
      { no_visao: "VW_EDITAL_TESTE", no_coluna: "DT_REGISTRO" },
    ]);
    const nada = await db.query(
      `select * from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('aprovados', 'status')`,
    );
    expect(nada.rows).toEqual([]);
  });

  it("as 11 colunas editáveis, com o grão de cada relatório", async () => {
    const r = await db.query<{
      co_relatorio: string;
      tp_grao: string;
      co_coluna: string;
      tp_coluna: string;
    }>(
      `select co_relatorio, tp_grao, co_coluna, tp_coluna from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"()`,
    );
    expect(
      r.rows.map(
        (c) => `${c.co_relatorio}/${c.tp_grao}/${c.co_coluna}/${c.tp_coluna}`,
      ),
    ).toEqual([
      "resumo-dos-editais/EDITAL/vagas_imediatas/inteiro",
      "resumo-dos-editais/EDITAL/data_divulgacao/data",
      "resumo-dos-editais/EDITAL/data_final/data",
      "editais-por-cargo/VAGA/vagas_imediatas/inteiro",
      "editais-por-cargo/VAGA/inscritos/inteiro",
      "editais-por-cargo/VAGA/aprovados/inteiro",
      "aprovados/APROVADO/nota/decimal",
      "aprovados/APROVADO/classificacao/inteiro",
      "aprovados/APROVADO/status/texto",
      "aprovados/APROVADO/matricula/texto",
      "aprovados/APROVADO/data_contratacao/data",
    ]);
  });

  it("o schema painel não é alcançável pela API", async () => {
    const r = await uma<{ anon: boolean; logado: boolean }>(
      db,
      `select has_schema_privilege('anon', 'painel', 'USAGE') as anon,
              has_schema_privilege('authenticated', 'painel', 'USAGE') as logado`,
    );
    expect(r).toEqual({ anon: false, logado: false });
  });
});

describe("aplicar as fontes", () => {
  it(
    "sem configuração, aplicar devolve as linhas iguais e fontes padrão",
    async () => {
      const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
      expect(a.linhas).toEqual(LINHAS_POR_VAGA);
      expect(a.avisos).toEqual([]);
      // jsonb guarda as chaves do objeto na ordem dele (mais curtas primeiro).
      expect(Object.keys(a.fontes).sort()).toEqual([
        "aprovados",
        "inscritos",
        "vagas_imediatas",
      ]);
      expect(a.fontes.vagas_imediatas).toEqual({
        padrao: true,
        visao: null,
        coluna: null,
        rotulo: expect.stringMatching(/^Padrão/),
      });
    },
    LONGO,
  );

  it(
    "troca só a coluna escolhida e só na área escolhida",
    async () => {
      await salvar(
        SI,
        "editais-por-cargo",
        "vagas_imediatas",
        "VW_VAGA_TESTE",
        "QT_VAGA",
      );
      const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
      expect(coluna(a, "vagas_imediatas")).toEqual([7, 3, null, null]);
      expect(coluna(a, "inscritos")).toEqual([10, 20, 30, 40]);
      expect(a.fontes.vagas_imediatas).toEqual({
        padrao: false,
        visao: "VW_VAGA_TESTE",
        coluna: "QT_VAGA",
        rotulo: "Fonte de teste › Vagas de teste",
      });
      expect(a.fontes.inscritos?.padrao).toBe(true);
    },
    LONGO,
  );

  it(
    "a escolha de uma área não muda a outra",
    async () => {
      await salvar(
        SI,
        "editais-por-cargo",
        "vagas_imediatas",
        "VW_VAGA_TESTE",
        "QT_VAGA",
      );
      const sede = await aplicar("sede", "editais-por-cargo", LINHAS_POR_VAGA);
      expect(sede.linhas).toEqual(LINHAS_POR_VAGA);
      expect(sede.fontes.vagas_imediatas?.padrao).toBe(true);
    },
    LONGO,
  );

  it(
    "chave repetida esvazia a célula e avisa",
    async () => {
      await salvar(
        SI,
        "editais-por-cargo",
        "vagas_imediatas",
        "VW_VAGA_TESTE",
        "QT_VAGA",
      );
      await db.exec(
        `insert into public.fonte_vaga values ('${EDITAL}', '100', 9, 'nove', null)`,
      );
      const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
      expect(a.linhas).toHaveLength(LINHAS_POR_VAGA.length);
      expect(coluna(a, "vagas_imediatas")).toEqual([null, 3, null, null]);
      expect(a.avisos).toEqual([
        expect.stringMatching(/1 chave repetida.*Vagas imediatas/),
      ]);
    },
    LONGO,
  );

  it(
    "recusa nome fora do catálogo",
    async () => {
      const forjada = 'VW_VAGA_TESTE"; drop table public.fonte_vaga; --';
      await db.query(
        `insert into public."TB_FONTE_COLUNA_PAINEL"
           ("CO_AREA", "CO_RELATORIO", "CO_COLUNA", "NO_VISAO", "NO_COLUNA_VISAO", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
         values ($1, 'editais-por-cargo', 'vagas_imediatas', $2, 'QT_VAGA', 'Linha forjada no teste.', $3),
                ($1, 'editais-por-cargo', 'inscritos', 'VW_VAGA_FORA', 'QT_VAGA', 'Visão fora do schema.', $3)`,
        [SI, forjada, USUARIO_ADMIN],
      );
      const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
      expect(coluna(a, "vagas_imediatas")).toEqual([null, null, null, null]);
      expect(coluna(a, "inscritos")).toEqual([null, null, null, null]);
      expect(a.avisos).toHaveLength(2);
      expect(a.avisos.every((t) => /não está disponível/.test(t))).toBe(true);
      expect(
        await uma(
          db,
          `select to_regclass('public.fonte_vaga') is not null as existe`,
        ),
      ).toEqual({
        existe: true,
      });
    },
    LONGO,
  );

  it(
    "fonte que sumiu deixa a coluna vazia e avisa",
    async () => {
      await salvar(
        SI,
        "editais-por-cargo",
        "vagas_imediatas",
        "VW_VAGA_TESTE",
        "QT_VAGA",
      );
      await db.exec(`drop view painel."VW_VAGA_TESTE"`);
      const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
      expect(coluna(a, "vagas_imediatas")).toEqual([null, null, null, null]);
      expect(a.avisos).toEqual([expect.stringMatching(/não está disponível/)]);
    },
    LONGO,
  );

  it(
    "data timestamptz sai na data de Brasília",
    async () => {
      await salvar(
        SI,
        "resumo-dos-editais",
        "data_divulgacao",
        "VW_EDITAL_TESTE",
        "DT_REGISTRO",
      );
      const a = await aplicar(SI, "resumo-dos-editais", [
        { edital_id: EDITAL, data_divulgacao: "2026-01-01" },
      ]);
      expect(coluna(a, "data_divulgacao")).toEqual(["2026-11-12"]);
    },
    LONGO,
  );
});

describe("listar e salvar", () => {
  it(
    "salvar exige Administrador em Painéis e a área",
    async () => {
      await entrar(db, { uid: USUARIO_LEITOR, nivel: 1, areas: [SI] });
      expect(
        (
          await erroDe(
            salvar(
              SI,
              "editais-por-cargo",
              "vagas_imediatas",
              "VW_VAGA_TESTE",
              "QT_VAGA",
            ),
          )
        )?.codigo,
      ).toBe("42501");
      await entrar(db, { uid: USUARIO_ADMIN, nivel: 3, areas: ["sede"] });
      expect(
        (
          await erroDe(
            salvar(
              SI,
              "editais-por-cargo",
              "vagas_imediatas",
              "VW_VAGA_TESTE",
              "QT_VAGA",
            ),
          )
        )?.codigo,
      ).toBe("42501");
    },
    LONGO,
  );

  it(
    "salvar recusa coluna fixa, fonte fora das opções, motivo curto e troca sem mudança",
    async () => {
      const codigo = async (p: Promise<unknown>) => (await erroDe(p))?.codigo;
      expect(await codigo(salvar(SI, "aprovados", "nome", null, null))).toBe(
        "22023",
      );
      expect(
        await codigo(
          salvar(
            SI,
            "editais-por-cargo",
            "vagas_imediatas",
            "VW_VAGA_SEM_COMENTARIO",
            "QT_VAGA",
          ),
        ),
      ).toBe("22023");
      expect(
        await codigo(
          salvar(
            SI,
            "editais-por-cargo",
            "vagas_imediatas",
            "VW_VAGA_TESTE",
            "QT_VAGA",
            "ok",
          ),
        ),
      ).toBe("22023");
      expect(
        await codigo(
          salvar(SI, "editais-por-cargo", "vagas_imediatas", null, null),
        ),
      ).toBe("22023");
    },
    LONGO,
  );

  it(
    "salvar grava o histórico com o nome e p_visao nulo volta ao padrão",
    async () => {
      const salvo = (
        await salvar(
          SI,
          "editais-por-cargo",
          "vagas_imediatas",
          "VW_VAGA_TESTE",
          "QT_VAGA",
        )
      ).rows[0]!.j;
      const vagas = salvo.colunas.find((c) => c.coluna === "vagas_imediatas")!;
      expect(vagas.escolha).toEqual({
        visao: "VW_VAGA_TESTE",
        coluna: "QT_VAGA",
      });
      expect(salvo.historico[0]).toMatchObject({
        nome: "Pessoa Administradora",
        coluna: "Vagas imediatas (título da vaga)",
        antes: expect.stringMatching(/^Padrão/),
        depois: "Fonte de teste › Vagas de teste",
        motivo: "Troca para conferir a fonte nova.",
      });
      const voltou = (
        await salvar(
          SI,
          "editais-por-cargo",
          "vagas_imediatas",
          null,
          null,
          "Voltar ao padrão.",
        )
      ).rows[0]!.j;
      expect(
        voltou.colunas.find((c) => c.coluna === "vagas_imediatas")!.escolha,
      ).toBeNull();
      expect(voltou.historico).toHaveLength(2);
      expect(voltou.historico[0]!.depois).toMatch(/^Padrão/);
      const a = await aplicar(SI, "editais-por-cargo", LINHAS_POR_VAGA);
      expect(a.linhas).toEqual(LINHAS_POR_VAGA);
    },
    LONGO,
  );

  it(
    "listar mostra as opções a quem lê e só deixa editar o Administrador",
    async () => {
      await entrar(db, { uid: USUARIO_LEITOR, nivel: 1, areas: [SI] });
      const f = await listar(SI, "editais-por-cargo");
      expect(f.pode_editar).toBe(false);
      expect(f.colunas.map((c) => c.coluna)).toEqual([
        "vagas_imediatas",
        "inscritos",
        "aprovados",
      ]);
      expect(f.colunas[0]!.opcoes).toEqual([
        {
          visao: "VW_VAGA_TESTE",
          rotulo: "Fonte de teste",
          colunas: [{ coluna: "QT_VAGA", rotulo: "Vagas de teste" }],
        },
      ]);
      await entrar(db, { uid: USUARIO_LEITOR, nivel: 0, areas: [SI] });
      expect((await erroDe(listar(SI, "editais-por-cargo")))?.codigo).toBe(
        "42501",
      );
      await entrar(db, { uid: USUARIO_ADMIN, nivel: 3, areas: [SI] });
      expect((await listar(SI, "editais-por-cargo")).pode_editar).toBe(true);
      expect((await erroDe(listar(SI, "outro")))?.codigo).toBe("22023");
    },
    LONGO,
  );
});
