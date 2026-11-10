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
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import {
  abasDoMenu,
  carregarCatalogoDeAbas,
  consultaDoCatalogoDeAbas,
} from "../src/modules/catalogo-de-abas.ts";

/*
  Etapa 1 do "tudo vira aba": as abas de cada área saem do código para o banco
  (TB_ABA × RL_ABA_AREA, lidas por `listar_abas_do_menu`), e nada muda na tela.

  A prova tem duas pontas (as migrations saíram do repositório; vale a resposta real):
  - a resposta real da função, capturada no ensaio do menu
    (`fixtures/listar-abas-do-menu-triagem.json`), é o catálogo do código (`ABAS_DO_MENU`);
  - a árvore do menu, com o catálogo do banco ou com o do código, é a de antes
    desta mudança (`fixtures/menu-lateral-antes-do-catalogo.json`, gerada com o
    código antigo) em toda combinação de permissão e área.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const RESPOSTA_DO_ENSAIO_DO_MENU = JSON.parse(
  ler("tests/fixtures/listar-abas-do-menu-triagem.json"),
);
/*
  A resposta de `listar_abas_do_menu` com todas as áreas: a do ensaio da Pré-classificação com
  as trocas do menu reorganizado (20261029150000) já aplicadas, gravada quando as migrations
  saíram do repositório.
*/
const RESPOSTA_DO_ENSAIO = JSON.parse(
  ler("tests/fixtures/listar-abas-do-menu-completo.json"),
);
const ARVORES_DE_ANTES = JSON.parse(
  ler("tests/fixtures/menu-lateral-antes-do-catalogo.json"),
);

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

describe("o catálogo do banco é o do código", () => {
  const doBanco = abasDoCatalogo(RESPOSTA_DO_ENSAIO);

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
