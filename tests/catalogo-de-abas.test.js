import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ABAS_DO_MENU,
  AREAS_DO_SISTEMA,
  abasDoCatalogo,
  montarArvoreDoMenu,
  paginasDaArea,
} from "../src/lib/menu-lateral.ts";
import { RESOURCES } from "../src/lib/permissoes-recursos.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";
import {
  abasDoMenu,
  carregarCatalogoDeAbas,
  consultaDoCatalogoDeAbas,
} from "../src/modules/catalogo-de-abas.ts";

/*
  Etapa 1 do "tudo vira aba": as abas de cada área saem do código para o banco
  (TB_ABA × RL_ABA_AREA, lidas por `listar_abas_do_menu`), e nada muda na tela.

  A prova tem três pontas:
  - o seed da migration é o catálogo do código (`ABAS_DO_MENU`);
  - a resposta real da função, capturada no ensaio da migration
    (`fixtures/listar-abas-do-menu.json`), é o que o seed produz;
  - a árvore do menu, com o catálogo do banco ou com o do código, é a de antes
    desta mudança (`fixtures/menu-lateral-antes-do-catalogo.json`, gerada com o
    código antigo) em toda combinação de permissão e área.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = ler(
  "supabase/migrations/20260929110000_catalogo_de_abas.sql",
);
/*
  Abas que entraram depois, cada uma na migration dela (o mesmo formato de
  insert): o seed do catálogo é a soma de todas.
*/
const MIGRATIONS_DO_SEED = [
  MIGRATION,
  ler("supabase/migrations/20260929120000_recursos.sql"),
];
/*
  Entrevistas (20260929235000_entrevistas.sql): a aba entra em TB_ABA
  desligada — 20260930090000_liga_aba_entrevistas.sql só a liga (ST_ATIVO) —,
  em todas as áreas (insert ... select de TB_AREA) e Recursos passa à ordem 7
  (update). O seed modela o estado depois das duas.
*/
const MIGRATION_DAS_ENTREVISTAS = ler(
  "supabase/migrations/20260929235000_entrevistas.sql",
);
const MIGRATION_QUE_LIGA_AS_ENTREVISTAS = ler(
  "supabase/migrations/20260930090000_liga_aba_entrevistas.sql",
);
/*
  Seleção (20261001090000_selecao.sql): o mesmo formato das Entrevistas — entra
  desligada, em todas as áreas, e 20261001090500_liga_aba_selecao.sql a liga.
*/
const MIGRATION_DA_SELECAO = ler(
  "supabase/migrations/20261001090000_selecao.sql",
);
const MIGRATION_QUE_LIGA_A_SELECAO = ler(
  "supabase/migrations/20261001090500_liga_aba_selecao.sql",
);
/*
  Classificação (20261002150000_classificacao.sql): o mesmo formato — entra
  desligada, em todas as áreas, empurra Aprovados (8) e Seleção (9), e
  20261002150500_liga_aba_classificacao.sql a liga.
*/
const MIGRATION_DA_CLASSIFICACAO = ler(
  "supabase/migrations/20261002150000_classificacao.sql",
);
const MIGRATION_QUE_LIGA_A_CLASSIFICACAO = ler(
  "supabase/migrations/20261002150500_liga_aba_classificacao.sql",
);
/*
  Avaliação documental (20261006090000_avaliacao_documental_permissao_e_menu.sql):
  o mesmo formato — entra desligada, em todas as áreas, na ordem 5, empurra
  Recursos, Entrevistas, Classificação, Aprovados e Seleção, e troca o rótulo
  de Análises para "Painel das análises" (update de "NO_ABA");
  20261006090500_liga_aba_avaliacao_documental.sql a liga.
*/
const MIGRATION_DA_AVALIACAO = ler(
  "supabase/migrations/20261006090000_avaliacao_documental_permissao_e_menu.sql",
);
const MIGRATION_QUE_LIGA_A_AVALIACAO = ler(
  "supabase/migrations/20261006090500_liga_aba_avaliacao_documental.sql",
);
/*
  Conduzir entrevistas (20261008130000_conduzir_entrevistas_no_menu.sql): o
  mesmo formato — entra desligada, em todas as áreas, na ordem 8, empurra
  Classificação, Aprovados e Seleção, e troca o rótulo de Entrevistas para
  "Painel de entrevistas"; 20261008130500_liga_aba_conduzir_entrevistas.sql a
  liga.
*/
const MIGRATION_DE_CONDUZIR = ler(
  "supabase/migrations/20261008130000_conduzir_entrevistas_no_menu.sql",
);
const MIGRATION_QUE_LIGA_CONDUZIR = ler(
  "supabase/migrations/20261008130500_liga_aba_conduzir_entrevistas.sql",
);
/*
  Analisar recursos (20261009230000_analisar_recursos_no_menu.sql): entra
  desligada, na ordem 7, nas áreas do painel de recursos (que estão nas três),
  empurra Painel de entrevistas, Conduzir entrevistas, Classificação,
  Aprovados e Seleção, e troca o rótulo de Recursos para "Painel de
  recursos"; 20261009230500_liga_aba_analisar_recursos.sql a liga.
*/
const MIGRATION_DE_ANALISAR = ler(
  "supabase/migrations/20261009230000_analisar_recursos_no_menu.sql",
);
const MIGRATION_QUE_LIGA_ANALISAR = ler(
  "supabase/migrations/20261009230500_liga_aba_analisar_recursos.sql",
);
/* A ordem por etapa do processo: só updates de "NU_ORDEM", aplicados por último. */
const MIGRATION_DA_ORDEM = ler(
  "supabase/migrations/20261001160000_ordem_do_menu_por_etapa.sql",
);
const MIGRATION_DA_PRE = ler(
  "supabase/migrations/20261028100644_entrada_propria_pre_classificacao.sql",
);
const ROLLBACK_DA_PRE = ler(
  "supabase/rollback/20261028100644_entrada_propria_pre_classificacao.sql",
);
const ENSAIO_DA_PRE = ler(
  "supabase/ensaios/20261028100644_entrada_propria_pre_classificacao.sql",
);
/*
  Menu reorganizado e Pré-classificação vira Triagem
  (20261029150000_menu_reorganizado_e_triagem.sql): só troca rótulo, ícone e
  ordem das abas (`(codigo, rotulo_antigo, icone_antigo, ordem_antiga,
  rotulo_novo, icone_novo, ordem_nova)`), aplicado por último no seed e na
  resposta do ensaio anterior. A resposta real da função no ensaio desta
  migration fica em `fixtures/listar-abas-do-menu-triagem.json`.
*/
const MIGRATION_DO_MENU = ler(
  "supabase/migrations/20261029150000_menu_reorganizado_e_triagem.sql",
);
const MENU_NOVO = new Map(
  [
    ...MIGRATION_DO_MENU.matchAll(
      /\('([^']+)', '([^']+)', '([^']+)', (\d+), '([^']+)', '([^']+)', (\d+)\)/g,
    ),
  ].map(
    ([
      ,
      codigo,
      rotuloAntigo,
      iconeAntigo,
      ordemAntiga,
      rotulo,
      icone,
      ordem,
    ]) => [
      codigo,
      {
        antes: [rotuloAntigo, iconeAntigo, Number(ordemAntiga)],
        depois: { rotulo, icone, ordem: Number(ordem) },
      },
    ],
  ),
);
function comMenuNovo(resposta) {
  return resposta
    .map((aba) => {
      const troca = MENU_NOVO.get(aba.co_aba);
      if (!troca) return aba;
      const { rotulo, icone, ordem } = troca.depois;
      return {
        ...aba,
        no_aba: rotulo,
        ds_icone: icone,
        nu_ordem: ordem,
        areas: aba.areas.map((area) => ({
          ...area,
          nu_ordem: ordem,
          ds_icone: icone,
        })),
      };
    })
    .sort((a, b) => a.nu_ordem - b.nu_ordem);
}
const RESPOSTA_DO_ENSAIO = comMenuNovo(
  JSON.parse(ler("tests/fixtures/listar-abas-do-menu-pre-classificacao.json")),
);
const RESPOSTA_DO_ENSAIO_DO_MENU = JSON.parse(
  ler("tests/fixtures/listar-abas-do-menu-triagem.json"),
);
const ARVORES_DE_ANTES = JSON.parse(
  ler("tests/fixtures/menu-lateral-antes-do-catalogo.json"),
);

/* As linhas dos `insert into public."<tabela>" (...) values (...), (...);` do seed. */
function linhasDoInsert(tabela) {
  const linhas = MIGRATIONS_DO_SEED.flatMap((sql) =>
    sql.includes(`insert into public."${tabela}"`)
      ? linhasDoInsertEm(sql, tabela)
      : [],
  );
  expect(linhas.length, tabela).toBeGreaterThan(0);
  return linhas;
}

function linhasDoInsertEm(sql, tabela) {
  const inicio = sql.indexOf(`insert into public."${tabela}"`);
  const insert = sql
    .slice(inicio, sql.indexOf(";", inicio))
    .split(/\bon conflict\b/i)[0];
  const [cabecalho, valores] = insert.split(/\)\s*values\s*/);
  const colunas = [...cabecalho.matchAll(/"([A-Z_]+)"/g)]
    .map((m) => m[1])
    .filter((nome) => nome !== tabela);
  const valor = (bruto) => {
    const v = bruto.trim();
    if (v === "null") return null;
    if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
    return Number(v);
  };
  return [...valores.matchAll(/\(([^()]*)\)/g)].map((m) =>
    Object.fromEntries(
      m[1]
        .match(/'(?:[^']|'')*'|[^,]+/g)
        .map((bruto, i) => [colunas[i], valor(bruto)]),
    ),
  );
}

function abasDoSeed() {
  const abas = [
    ...linhasDoInsert("TB_ABA"),
    ...linhasDoInsertEm(MIGRATION_DAS_ENTREVISTAS, "TB_ABA"),
    ...linhasDoInsertEm(MIGRATION_DA_SELECAO, "TB_ABA"),
    ...linhasDoInsertEm(MIGRATION_DA_CLASSIFICACAO, "TB_ABA"),
    ...linhasDoInsertEm(MIGRATION_DA_AVALIACAO, "TB_ABA"),
    ...linhasDoInsertEm(MIGRATION_DE_CONDUZIR, "TB_ABA"),
    ...linhasDoInsertEm(MIGRATION_DE_ANALISAR, "TB_ABA"),
    ...linhasDoInsertEm(MIGRATION_DA_PRE, "TB_ABA"),
  ];
  for (const sql of [
    MIGRATION_DAS_ENTREVISTAS,
    MIGRATION_DA_ORDEM,
    MIGRATION_DA_CLASSIFICACAO,
    MIGRATION_DA_AVALIACAO,
    MIGRATION_DE_CONDUZIR,
    MIGRATION_DE_ANALISAR,
  ])
    for (const [, ordem, aba] of sql.matchAll(
      /update public\."TB_ABA" set "NU_ORDEM" = (\d+)[^;]*where "CO_ABA" = '([^']+)'/g,
    ))
      abas.find((linha) => linha.CO_ABA === aba).NU_ORDEM = Number(ordem);
  for (const sql of [
    MIGRATION_DA_AVALIACAO,
    MIGRATION_DE_CONDUZIR,
    MIGRATION_DE_ANALISAR,
  ])
    for (const [, rotulo, aba] of sql.matchAll(
      /update public."TB_ABA" set "NO_ABA" = '([^']+)'[^;]*where "CO_ABA" = '([^']+)'/g,
    ))
      abas.find((linha) => linha.CO_ABA === aba).NO_ABA = rotulo;
  for (const [, codigo, antiga, nova] of MIGRATION_DA_PRE.matchAll(
    /\('([^']+)', (\d+), (\d+)\)/g,
  )) {
    const aba = abas.find((linha) => linha.CO_ABA === codigo);
    if (aba && aba.NU_ORDEM === Number(antiga)) aba.NU_ORDEM = Number(nova);
  }
  const selecao = abas.find((linha) => linha.CO_ABA === "selecao");
  if (selecao?.NO_ABA === "Seleção") selecao.NO_ABA = "Painel da Seleção";
  for (const aba of abas) {
    const troca = MENU_NOVO.get(aba.CO_ABA);
    if (!troca) continue;
    expect([aba.NO_ABA, aba.DS_ICONE, aba.NU_ORDEM], aba.CO_ABA).toEqual(
      troca.antes,
    );
    aba.NO_ABA = troca.depois.rotulo;
    aba.DS_ICONE = troca.depois.icone;
    aba.NU_ORDEM = troca.depois.ordem;
  }
  return abas;
}

function ligacoesDoSeed() {
  expect(MIGRATION_DAS_ENTREVISTAS).toContain(
    `select 'entrevistas', a."CO_AREA", 'S' from public."TB_AREA" a`,
  );
  expect(MIGRATION_QUE_LIGA_AS_ENTREVISTAS).toContain(
    `set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas'`,
  );
  expect(MIGRATION_DA_SELECAO).toContain(
    `select 'selecao', a."CO_AREA", 'S' from public."TB_AREA" a`,
  );
  expect(MIGRATION_QUE_LIGA_A_SELECAO).toContain(
    `set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao'`,
  );
  expect(MIGRATION_DA_CLASSIFICACAO).toContain(
    `select 'classificacao', a."CO_AREA", 'S' from public."TB_AREA" a`,
  );
  expect(MIGRATION_QUE_LIGA_A_CLASSIFICACAO).toContain(
    `set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao'`,
  );
  expect(MIGRATION_DA_AVALIACAO).toContain(
    `select 'avaliacao-documental', a."CO_AREA", 'S' from public."TB_AREA" a`,
  );
  expect(MIGRATION_QUE_LIGA_A_AVALIACAO).toContain(
    `set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'avaliacao-documental'`,
  );
  expect(MIGRATION_DE_CONDUZIR).toContain(
    `select 'conduzir-entrevistas', a."CO_AREA", 'S' from public."TB_AREA" a`,
  );
  expect(MIGRATION_QUE_LIGA_CONDUZIR).toContain(
    `set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'conduzir-entrevistas'`,
  );
  expect(MIGRATION_DE_ANALISAR).toContain(
    `select 'analisar-recursos', r."CO_AREA", r."ST_ATIVO" from public."RL_ABA_AREA" r where r."CO_ABA" = 'recursos'`,
  );
  expect(MIGRATION_QUE_LIGA_ANALISAR).toContain(
    `set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analisar-recursos'`,
  );
  expect(MIGRATION_DA_PRE).toContain(
    `select 'pre-classificacao', a."CO_AREA", 'S'`,
  );
  expect(MIGRATION_DA_PRE).toContain("'avaliacao_documental'");
  expect(MIGRATION_DA_PRE).toContain(
    "'pre-classificacao', 'Pré-classificação', 'list-ordered', 6",
  );
  return [
    ...linhasDoInsert("RL_ABA_AREA"),
    ...[
      "entrevistas",
      "selecao",
      "classificacao",
      "avaliacao-documental",
      "conduzir-entrevistas",
      // As áreas do painel de recursos (as três no seed).
      "analisar-recursos",
      "pre-classificacao",
    ].flatMap((aba) =>
      AREAS_DO_SISTEMA.map((area) => ({ CO_ABA: aba, CO_AREA: area.id })),
    ),
  ];
}

/* O que `listar_abas_do_menu` devolve para o seed (a mesma regra do SQL). */
function respostaDoSeed() {
  const abas = abasDoSeed();
  const ligacoes = ligacoesDoSeed();
  const ordemDaArea = (co) =>
    AREAS_DO_SISTEMA.findIndex((area) => area.id === co);
  return abas
    .sort((a, b) => a.NU_ORDEM - b.NU_ORDEM)
    .map((aba) => ({
      co_aba: aba.CO_ABA,
      no_aba: aba.NO_ABA,
      ds_icone: aba.DS_ICONE,
      nu_ordem: aba.NU_ORDEM,
      co_view: aba.CO_VIEW,
      co_recurso: aba.CO_RECURSO,
      tp_aba: aba.TP_ABA,
      areas: ligacoes
        .filter((r) => r.CO_ABA === aba.CO_ABA)
        .sort((a, b) => ordemDaArea(a.CO_AREA) - ordemDaArea(b.CO_AREA))
        .map((r) => ({
          co_area: r.CO_AREA,
          nu_ordem: r.NU_ORDEM ?? aba.NU_ORDEM,
          co_view: r.CO_VIEW ?? aba.CO_VIEW,
          ds_icone: r.DS_ICONE ?? aba.DS_ICONE,
        })),
    }));
}

const camposDaAba = ({ id, rotulo, icone, ordem, view, recurso, tipo }) => ({
  id,
  rotulo,
  icone,
  ordem,
  view,
  recurso,
  tipo,
});
const paginasPorArea = (abas) =>
  Object.fromEntries(
    AREAS_DO_SISTEMA.map((area) => [area.id, paginasDaArea(abas, area.id)]),
  );

describe("proteções da migração da Pré-classificação", () => {
  it("fecha corretamente os blocos PL/pgSQL no deploy e no rollback", () => {
    for (const sql of [MIGRATION_DA_PRE, ROLLBACK_DA_PRE]) {
      const inicio = "do " + "$" + "$";
      const fim = "\n" + "$" + "$" + ";\n";
      expect(sql.split(inicio)).toHaveLength(2);
      expect(sql.split(fim)).toHaveLength(2);
      expect(sql).not.toContain("\n" + "$" + ";\n");
    }
  });

  it("ensaia exatamente o corpo do SQL sem persistir alterações", () => {
    const inicio = MIGRATION_DA_PRE.indexOf("\nbegin;\n") + 1;
    const fim = MIGRATION_DA_PRE.lastIndexOf("\ncommit;");
    const corpo = MIGRATION_DA_PRE.slice(inicio, fim);
    expect(ENSAIO_DA_PRE).toContain(corpo);
    for (const etapa of ["E1", "E2", "E3", "E4"])
      expect(ENSAIO_DA_PRE).toContain("FALHOU " + etapa);
    expect(ENSAIO_DA_PRE.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("recusa colisão, ordem personalizada e rollback com a entrada ativa", () => {
    expect(MIGRATION_DA_PRE).toContain(
      "A aba pre-classificacao já existe: conferir antes de aplicar.",
    );
    expect(MIGRATION_DA_PRE).toContain(
      "Ordem do catálogo personalizada ou incompleta",
    );
    expect(ROLLBACK_DA_PRE).toContain(
      "Desative a Pré-classificação e confira a entrada antes do rollback.",
    );
    expect(ROLLBACK_DA_PRE).toContain("Ordem alterada desde a migration");
  });
});

describe("o seed da migration é o catálogo do código", () => {
  const doBanco = abasDoCatalogo(respostaDoSeed());

  it("as mesmas abas, com os mesmos campos", () => {
    // A Triagem (código técnico pre-classificacao) já está ligada no banco
    // (#597) e entra também no catálogo do código.
    expect(doBanco.map(camposDaAba)).toEqual(ABAS_DO_MENU.map(camposDaAba));
    expect(doBanco.find((aba) => aba.id === "pre-classificacao")).toMatchObject(
      {
        id: "pre-classificacao",
        rotulo: "Triagem",
        icone: "list-checks",
        view: "pre-classificacao",
        ordem: 8,
        recurso: "avaliacao_documental",
      },
    );
  });

  it("as mesmas páginas em cada área (view, rótulo, ícone e ordem)", () => {
    expect(paginasPorArea(doBanco)).toEqual(paginasPorArea(ABAS_DO_MENU));
  });

  it("a resposta real do ensaio do menu novo é o catálogo do código", () => {
    expect(abasDoCatalogo(RESPOSTA_DO_ENSAIO_DO_MENU).map(camposDaAba)).toEqual(
      ABAS_DO_MENU.map(camposDaAba),
    );
  });

  it("a resposta real da função, no ensaio, é a que o seed produz", () => {
    expect(RESPOSTA_DO_ENSAIO).toEqual(respostaDoSeed());
  });

  it("o recurso de cada aba é um recurso de permissão que existe", () => {
    const recursos = new Set(RESOURCES.map(([id]) => id));
    expect(ABAS_DO_MENU.filter((aba) => !recursos.has(aba.recurso))).toEqual(
      [],
    );
  });

  it("toda view do catálogo é uma tela que o front desenha", () => {
    const telas = new Set([
      "dashboard",
      "nucleo",
      "calendario",
      "approved",
      "analises",
      "avaliacao-documental",
      "pre-classificacao",
      "entrevistas",
      "conduzir-entrevistas",
      "recursos",
      "analisar-recursos",
      "selecao",
      "classificacao",
    ]);
    const views = Object.values(paginasPorArea(ABAS_DO_MENU)).flatMap(
      (paginas) => paginas.map((pagina) => pagina.view),
    );
    expect(views.filter((view) => !telas.has(view))).toEqual([]);
  });
});

/*
  As mesmas entradas que geraram a fixture com o código de antes: um painel,
  uma seção de configuração, e as permissões como o `buildNav` as calcula.
*/
const PERMISSOES = {
  admin: {
    dashboard: true,
    nucleo: true,
    calendario: true,
    approved: true,
    analises: true,
    config: true,
  },
  usuario: {
    dashboard: true,
    nucleo: true,
    calendario: true,
    approved: true,
    analises: false,
    config: false,
  },
  "so-editais": { nucleo: true, approved: true },
  "sem-permissao": {},
};
const AREAS = {
  todas: ["saude-indigena", "sede", "projetos"],
  si: ["saude-indigena"],
  sede: ["sede"],
  projetos: ["projetos"],
  "sede-e-projetos": ["sede", "projetos"],
  "contexto-antigo": undefined,
};
const COMBINACOES = Object.entries(PERMISSOES).flatMap(([p, permitidas]) =>
  Object.entries(AREAS).map(([a, areas]) => [`${p} × ${a}`, permitidas, areas]),
);

const resumo = (arvore) =>
  arvore.map(
    (grupo) =>
      `${grupo.id}: ${grupo.itens
        .map((i) =>
          [i.view, i.rotulo, i.icone, i.area ?? i.secao ?? ""].join("|"),
        )
        .join(" · ")}`,
  );
const arvore = (permitidas, areas, abas) =>
  montarArvoreDoMenu({
    permitidas,
    paineis: [{ codigo: "recursos", titulo: "Recursos" }],
    secoesDeConfiguracao: [{ id: "acessos", rotulo: "Acessos" }],
    areas,
    abas,
  });

/*
  A fixture guarda a árvore de cada combinação (permissão × área). Foi gerada
  com o código de antes do catálogo e regenerada no menu reorganizado de
  29/10 (blocos Acompanhar/Processo seletivo, nova ordem): com o catálogo do
  banco ou com o do código, a árvore é a mesma.
*/
describe("a árvore é a mesma com o catálogo do banco ou do código", () => {
  it("a fixture cobre todas as combinações", () => {
    expect(Object.keys(ARVORES_DE_ANTES).sort()).toEqual(
      COMBINACOES.map(([nome]) => nome).sort(),
    );
  });

  const doBanco = abasDoCatalogo(RESPOSTA_DO_ENSAIO);

  it.each(COMBINACOES)("%s", (nome, permitidas, areas) => {
    const antes = ARVORES_DE_ANTES[nome];
    expect(resumo(arvore(permitidas, areas))).toEqual(antes);
    expect(resumo(arvore(permitidas, areas, doBanco))).toEqual(antes);
    expect(arvore(permitidas, areas, doBanco)).toEqual(
      arvore(permitidas, areas),
    );
  });
});

describe("a árvore segue o catálogo do banco quando ele chega", () => {
  it("aba fora de uma área some só dela; troca de ordem e ícone vale", () => {
    const resposta = structuredClone(RESPOSTA_DO_ENSAIO);
    const analises = resposta.find((aba) => aba.co_aba === "analises");
    analises.areas = analises.areas.filter((a) => a.co_area !== "sede");
    const editais = resposta.find((aba) => aba.co_aba === "editais");
    Object.assign(
      editais.areas.find((a) => a.co_area === "projetos"),
      { nu_ordem: 99, ds_icone: "folder" },
    );
    const grupos = Object.fromEntries(
      arvore(PERMISSOES.admin, AREAS.todas, abasDoCatalogo(resposta)).map(
        (g) => [g.id, g.itens],
      ),
    );
    expect(grupos.sede.map((i) => i.view)).not.toContain("analises");
    expect(grupos["saude-indigena"].map((i) => i.view)).toContain("analises");
    expect(grupos.projetos.at(-1)).toEqual({
      view: "nucleo",
      rotulo: "Editais",
      bloco: "processo",
      icone: "folder",
      area: "projetos",
    });
  });
});

describe("resposta estranha vira o catálogo do código", () => {
  it.each([
    ["nula", null],
    ["objeto", { co_aba: "editais" }],
    ["lista vazia", []],
    ["só linhas sem código, rótulo ou view", [{ co_aba: "x" }, null, 7]],
  ])("%s: abasDoCatalogo devolve null", (_, dados) => {
    expect(abasDoCatalogo(dados)).toBeNull();
  });

  it("linha incompleta sai; área sem código também", () => {
    const abas = abasDoCatalogo([
      { co_aba: "x", no_aba: "X" },
      {
        co_aba: "editais",
        no_aba: "Editais",
        ds_icone: "file-text",
        nu_ordem: 2,
        co_view: "nucleo",
        areas: [{ co_area: "sede" }, { nu_ordem: 1 }],
      },
    ]);
    expect(abas.map((aba) => aba.id)).toEqual(["editais"]);
    expect(paginasDaArea(abas, "sede")).toEqual([
      {
        view: "nucleo",
        rotulo: "Editais",
        icone: "file-text",
        bloco: "processo",
      },
    ]);
  });

  it("montarArvoreDoMenu sem catálogo (ou vazio) usa o do código", () => {
    const esperado = arvore(PERMISSOES.admin, AREAS.todas, ABAS_DO_MENU);
    expect(arvore(PERMISSOES.admin, AREAS.todas, null)).toEqual(esperado);
    expect(arvore(PERMISSOES.admin, AREAS.todas, [])).toEqual(esperado);
  });
});

describe("carga do catálogo na sessão", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await carregarCatalogoDeAbas({ consulta: Promise.resolve(null) });
  });

  it("pede listar_abas_do_menu, sem argumentos", async () => {
    const sb = { rpc: vi.fn(() => Promise.resolve({ data: [], error: null })) };
    await consultaDoCatalogoDeAbas(sb);
    expect(sb.rpc).toHaveBeenCalledWith("listar_abas_do_menu");
  });

  it("consulta que rejeita vira resposta com erro, sem lançar", async () => {
    const erro = new Error("rede");
    const sb = { rpc: () => Promise.reject(erro) };
    await expect(consultaDoCatalogoDeAbas(sb)).resolves.toEqual({
      data: null,
      error: erro,
    });
    await expect(consultaDoCatalogoDeAbas(null)).resolves.toEqual({
      data: null,
      error: null,
    });
  });

  it("com o catálogo do banco, o menu passa a vir dele", async () => {
    const usou = await carregarCatalogoDeAbas({
      consulta: Promise.resolve({ data: RESPOSTA_DO_ENSAIO, error: null }),
    });
    expect(usou).toBe(true);
    expect(abasDoMenu()).not.toBe(ABAS_DO_MENU);
    expect(abasDoMenu().map((aba) => aba.id)).toEqual(
      ABAS_DO_MENU.map((aba) => aba.id),
    );
  });

  it.each([
    [
      "função ainda não publicada",
      { data: null, error: { code: "PGRST202" } },
      false,
    ],
    ["erro do banco", { data: null, error: { code: "42501" } }, true],
    ["resposta vazia", { data: [], error: null }, false],
  ])("%s: volta ao catálogo do código", async (_, resposta, avisa) => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await carregarCatalogoDeAbas({
      consulta: Promise.resolve({ data: RESPOSTA_DO_ENSAIO, error: null }),
    });
    const usou = await carregarCatalogoDeAbas({
      consulta: Promise.resolve(resposta),
    });
    expect(usou).toBe(false);
    expect(abasDoMenu()).toBe(ABAS_DO_MENU);
    expect(aviso).toHaveBeenCalledTimes(avisa ? 1 : 0);
  });

  it("consulta que rejeita também volta ao catálogo do código", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const usou = await carregarCatalogoDeAbas({
      consulta: Promise.reject(new Error("rede")),
    });
    expect(usou).toBe(false);
    expect(abasDoMenu()).toBe(ABAS_DO_MENU);
  });
});

describe("contrato e acesso da função", () => {
  it("está no contrato, sem argumentos e sem derrubar a verificação", () => {
    expect(CONTRATO_RPC.listar_abas_do_menu).toMatchObject({
      argumentos: [],
      critica: false,
    });
  });

  it("autenticado lê; anônimo não lê nem executa; ninguém escreve", () => {
    expect(MIGRATION).toContain(
      "create function public.listar_abas_do_menu()\nreturns json",
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.listar_abas_do_menu() from public, anon;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.listar_abas_do_menu() to authenticated, service_role;",
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TB_ABA", public."RL_ABA_AREA" from public, anon, authenticated;',
    );
    expect(MIGRATION).toContain(
      'grant select on public."TB_ABA", public."RL_ABA_AREA" to authenticated;',
    );
    expect(MIGRATION).not.toMatch(/grant (insert|update|delete|all)/i);
  });

  it("o rollback desfaz tudo o que a migration cria", () => {
    const rollback = ler(
      "supabase/rollback/20260929110000_catalogo_de_abas.sql",
    );
    expect(rollback).toContain(
      "drop function if exists public.listar_abas_do_menu();",
    );
    expect(rollback).toContain('drop table if exists public."RL_ABA_AREA";');
    expect(rollback).toContain('drop table if exists public."TB_ABA";');
  });
});

/*
  Selo "BETA": campo opcional só do front por enquanto (`ABAS_DO_MENU`), fora
  da comparação seed × código. Quando o banco mandar `ds_selo` ou `beta`, vale
  o do banco; sem eles, o do código.
*/
describe("selo beta das abas", () => {
  const recursosDe = (abas) =>
    abas.find((aba) => aba.id === "analisar-recursos");

  it("no fallback, somente as abas já publicadas no banco são beta", () => {
    const beta = [
      "entrevistas",
      "selecao",
      "pre-classificacao",
      "avaliacao-documental",
      "analisar-recursos",
      "conduzir-entrevistas",
      "classificacao",
    ];
    expect(ABAS_DO_MENU.filter((aba) => aba.beta).map((aba) => aba.id)).toEqual(
      beta,
    );
    expect(
      ABAS_DO_MENU.filter((aba) => !beta.includes(aba.id)).some((aba) =>
        Object.hasOwn(aba, "beta"),
      ),
    ).toBe(false);
  });

  it("o banco de hoje (sem ds_selo) herda o selo do código", () => {
    expect(recursosDe(abasDoCatalogo(RESPOSTA_DO_ENSAIO)).beta).toBe(true);
    expect(
      paginasDaArea(abasDoCatalogo(RESPOSTA_DO_ENSAIO), "sede").find(
        (pagina) => pagina.view === "analisar-recursos",
      ),
    ).toEqual({
      view: "analisar-recursos",
      rotulo: "Recursos",
      icone: "gavel",
      bloco: "processo",
      beta: true,
    });
  });

  it("ds_selo ou beta do banco valem sobre o código", () => {
    const comSelo = (campos) =>
      abasDoCatalogo(
        RESPOSTA_DO_ENSAIO.map((aba) => ({
          ...aba,
          ...(aba.co_aba === "analisar-recursos" ? campos : {}),
          ...(aba.co_aba === "editais" ? { ds_selo: "BETA" } : {}),
        })),
      );
    expect(recursosDe(comSelo({ ds_selo: null })).beta).toBeUndefined();
    expect(recursosDe(comSelo({ beta: false })).beta).toBeUndefined();
    expect(comSelo({}).find((aba) => aba.id === "editais").beta).toBe(true);
  });

  it("o item do menu leva o selo da página beta", () => {
    const itens = montarArvoreDoMenu({
      permitidas: { nucleo: true, "analisar-recursos": true },
    })[0].itens;
    expect(itens.find((i) => i.view === "analisar-recursos").beta).toBe(true);
    expect(
      Object.hasOwn(
        itens.find((i) => i.view === "nucleo"),
        "beta",
      ),
    ).toBe(false);
  });
});
