import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ABAS_DO_MENU,
  AREAS_DO_SISTEMA,
  abasDoCatalogo,
  montarArvoreDoMenu,
  paginasDaArea,
} from "../src/lib/menu-lateral.js";
import { RESOURCES } from "../src/lib/permissoes-recursos.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";
import {
  abasDoMenu,
  carregarCatalogoDeAbas,
  consultaDoCatalogoDeAbas,
} from "../src/modules/catalogo-de-abas.js";

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
const RESPOSTA_DO_ENSAIO = JSON.parse(
  ler("tests/fixtures/listar-abas-do-menu.json"),
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
  const insert = sql.slice(inicio, sql.indexOf(";", inicio));
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

/* O que `listar_abas_do_menu` devolve para o seed (a mesma regra do SQL). */
function respostaDoSeed() {
  const abas = linhasDoInsert("TB_ABA");
  const ligacoes = linhasDoInsert("RL_ABA_AREA");
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

describe("o seed da migration é o catálogo do código", () => {
  const doBanco = abasDoCatalogo(respostaDoSeed());

  it("as mesmas abas, com os mesmos campos", () => {
    expect(doBanco.map(camposDaAba)).toEqual(ABAS_DO_MENU.map(camposDaAba));
  });

  it("as mesmas páginas em cada área (view, rótulo, ícone e ordem)", () => {
    expect(paginasPorArea(doBanco)).toEqual(paginasPorArea(ABAS_DO_MENU));
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
      "recursos",
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

describe("nenhuma mudança visível: a árvore é a de antes", () => {
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
      { nu_ordem: 9, ds_icone: "folder" },
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
      { view: "nucleo", rotulo: "Editais", icone: "file-text" },
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
  const recursosDe = (abas) => abas.find((aba) => aba.id === "recursos");

  it("no código, só Recursos é beta; as outras nem têm o campo", () => {
    expect(ABAS_DO_MENU.filter((aba) => aba.beta).map((aba) => aba.id)).toEqual(
      ["recursos"],
    );
    expect(
      ABAS_DO_MENU.filter((aba) => aba.id !== "recursos").some((aba) =>
        Object.hasOwn(aba, "beta"),
      ),
    ).toBe(false);
  });

  it("o banco de hoje (sem ds_selo) herda o selo do código", () => {
    expect(recursosDe(abasDoCatalogo(RESPOSTA_DO_ENSAIO)).beta).toBe(true);
    expect(
      paginasDaArea(abasDoCatalogo(RESPOSTA_DO_ENSAIO), "sede").at(-1),
    ).toEqual({
      view: "recursos",
      rotulo: "Recursos",
      icone: "scale",
      beta: true,
    });
  });

  it("ds_selo ou beta do banco valem sobre o código", () => {
    const comSelo = (campos) =>
      abasDoCatalogo(
        RESPOSTA_DO_ENSAIO.map((aba) => ({
          ...aba,
          ...(aba.co_aba === "recursos" ? campos : {}),
          ...(aba.co_aba === "editais" ? { ds_selo: "BETA" } : {}),
        })),
      );
    expect(recursosDe(comSelo({ ds_selo: null })).beta).toBeUndefined();
    expect(recursosDe(comSelo({ beta: false })).beta).toBeUndefined();
    expect(comSelo({}).find((aba) => aba.id === "editais").beta).toBe(true);
  });

  it("o item do menu leva o selo da página beta", () => {
    const itens = montarArvoreDoMenu({
      permitidas: { nucleo: true, recursos: true },
    })[0].itens;
    expect(itens.find((i) => i.view === "recursos").beta).toBe(true);
    expect(
      Object.hasOwn(
        itens.find((i) => i.view === "nucleo"),
        "beta",
      ),
    ).toBe(false);
  });
});
