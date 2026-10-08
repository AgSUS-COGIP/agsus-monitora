import { describe, expect, it } from "vitest";
import {
  AREA_DOS_PAINEIS,
  AREAS_DO_MENU,
  ABAS_DO_MENU,
  AREAS_DO_SISTEMA,
  FLUTUANTE_FECHADO,
  areaAberta,
  areasDoUsuario,
  destinoAoTrocarDeArea,
  ehAreaDoSistema,
  iconesDoCatalogo,
  itemAtivoDaArvore,
  montarArvoreDoMenu,
  navegacaoTransborda,
  nomeDaArea,
  posicaoDoPainelFlutuante,
  proximoFlutuante,
  recortarArvorePorArea,
} from "../src/lib/menu-lateral.ts";
import { SECOES } from "../src/modulos/configuracoes/secoes.js";
import { NOMES_DE_ICONES } from "../src/modules/icones.js";

const TUDO = {
  dashboard: true,
  nucleo: true,
  calendario: true,
  approved: true,
  analises: true,
  config: true,
};
const PAINEIS = [
  { codigo: "recursos", titulo: "Recursos" },
  { codigo: "sem-titulo", titulo: "  " },
  { codigo: "", titulo: "Sem código" },
];
const TODAS = ["saude-indigena", "sede", "projetos"];

const porGrupo = (arvore) =>
  Object.fromEntries(arvore.map((grupo) => [grupo.id, grupo.itens]));

/*
  O menu tem um grupo por área do usuário (Saúde Indígena, SEDE, Projetos),
  cada um com as mesmas páginas de edital, e depois Painéis e Administração.
*/
describe("o catálogo", () => {
  it("são as três áreas, Painéis e Administração, nessa ordem", () => {
    expect(AREAS_DO_MENU.map((area) => area.rotulo)).toEqual([
      "Saúde Indígena",
      "SEDE",
      "Projetos",
      "Painéis",
      "Administração",
    ]);
    expect(AREAS_DO_SISTEMA.map((area) => area.icone)).toEqual([
      "heart-pulse",
      "building-2",
      "folder-kanban",
    ]);
    expect(new Set(AREAS_DO_MENU.map((area) => area.id)).size).toBe(
      AREAS_DO_MENU.length,
    );
  });

  it("toda aba só aponta para áreas que existem", () => {
    const areas = new Set(AREAS_DO_SISTEMA.map((area) => area.id));
    const usadas = ABAS_DO_MENU.flatMap((aba) =>
      aba.areas.map((item) => item.area),
    );
    expect(usadas.every((area) => areas.has(area))).toBe(true);
    expect(AREAS_DO_MENU.some((area) => area.id === AREA_DOS_PAINEIS)).toBe(
      true,
    );
  });

  it("todo ícone que o catálogo pede existe no registro Lucide", () => {
    const registrados = new Set(NOMES_DE_ICONES);
    expect(iconesDoCatalogo().filter((nome) => !registrados.has(nome))).toEqual(
      [],
    );
  });

  it("as áreas do usuário: só as conhecidas, na ordem do catálogo; sem nada, Saúde Indígena", () => {
    expect(areasDoUsuario(["projetos", "x", "saude-indigena"])).toEqual([
      "saude-indigena",
      "projetos",
    ]);
    expect(areasDoUsuario(undefined)).toEqual(["saude-indigena"]);
    expect(areasDoUsuario([])).toEqual(["saude-indigena"]);
    expect(nomeDaArea("sede")).toBe("SEDE");
    expect(nomeDaArea("nenhuma")).toBe("");
  });
});

describe("a árvore do menu segue o perfil e as áreas", () => {
  it("quem só tem Saúde Indígena vê um grupo de área, com Análises dentro", () => {
    const arvore = montarArvoreDoMenu({
      permitidas: TUDO,
      paineis: PAINEIS,
      secoesDeConfiguracao: SECOES,
      areas: ["saude-indigena"],
    });
    const grupos = porGrupo(arvore);

    expect(arvore.map((grupo) => grupo.id)).toEqual([
      "saude-indigena",
      "paineis",
      "administracao",
    ]);
    expect(grupos["saude-indigena"].map((item) => item.rotulo)).toEqual([
      "Visão geral",
      "Editais",
      "Cronograma",
      "Painel das análises",
      "Lista de aprovados",
    ]);
    expect(grupos["saude-indigena"].at(-1)).toEqual({
      view: "approved",
      rotulo: "Lista de aprovados",
      icone: "user-round-check",
      area: "saude-indigena",
    });
    expect(
      grupos["saude-indigena"].every((item) => item.area === "saude-indigena"),
    ).toBe(true);
    // Os painéis externos vão para Painéis, sem área.
    expect(grupos.paineis).toEqual([
      {
        view: "panel:recursos",
        rotulo: "Recursos",
        icone: "square-arrow-out-up-right",
      },
      {
        view: "panel:sem-titulo",
        rotulo: "sem-titulo",
        icone: "square-arrow-out-up-right",
      },
    ]);
    expect(grupos.administracao.map((item) => item.secao)).toEqual(
      SECOES.map((secao) => secao.id),
    );
    expect(grupos.administracao.every((item) => item.view === "config")).toBe(
      true,
    );
  });

  it("o admin vê as três áreas, todas com a mesma Visão geral e com Análises", () => {
    const grupos = porGrupo(
      montarArvoreDoMenu({
        permitidas: TUDO,
        paineis: PAINEIS,
        areas: TODAS,
      }),
    );
    expect(Object.keys(grupos)).toEqual([
      "saude-indigena",
      "sede",
      "projetos",
      "paineis",
    ]);
    // A Visão geral é a mesma página (`dashboard`, ícone `map`) nas três.
    for (const area of ["saude-indigena", "sede", "projetos"]) {
      expect(grupos[area][0].icone).toBe("map");
      expect(grupos[area].map((item) => item.view)).toEqual([
        "dashboard",
        "nucleo",
        "calendario",
        "analises",
        "approved",
      ]);
      expect(grupos[area][0].rotulo).toBe("Visão geral");
      expect(grupos[area].at(-1).rotulo).toBe("Lista de aprovados");
      expect(grupos[area].every((item) => item.area === area)).toBe(true);
    }
    // A mesma página, uma vez em cada área; Painéis só tem os externos.
    expect(grupos.paineis.map((item) => item.view)).toEqual([
      "panel:recursos",
      "panel:sem-titulo",
    ]);
  });

  it("sem áreas no contexto (contrato antigo), vale a Saúde Indígena", () => {
    const arvore = montarArvoreDoMenu({ permitidas: { nucleo: true } });
    expect(arvore.map((grupo) => grupo.id)).toEqual(["saude-indigena"]);
  });

  it("quem só tem a SEDE vê Análises na SEDE", () => {
    const grupos = porGrupo(
      montarArvoreDoMenu({
        permitidas: { nucleo: true, analises: true },
        areas: ["sede"],
      }),
    );
    expect(Object.keys(grupos)).toEqual(["sede"]);
    expect(grupos.sede.map((item) => item.view)).toEqual([
      "nucleo",
      "analises",
    ]);
  });

  it("Análises só com o recurso analises; os painéis externos não a trazem", () => {
    const grupos = porGrupo(
      montarArvoreDoMenu({
        permitidas: { nucleo: true },
        paineis: [{ codigo: "analises", titulo: "Analises" }],
        areas: ["sede"],
      }),
    );
    expect(grupos.sede.map((item) => item.view)).toEqual(["nucleo"]);
    // O painel antigo não tem mais lugar especial: se chegasse, seria um
    // painel comum (o legado o tira antes, em `semOPainelAntigoDeAnalises`).
    expect(grupos.paineis.map((item) => item.view)).toEqual(["panel:analises"]);
  });

  it("grupo sem página permitida não aparece", () => {
    const arvore = montarArvoreDoMenu({
      permitidas: { nucleo: true },
      secoesDeConfiguracao: SECOES,
    });
    expect(arvore.map((grupo) => grupo.id)).toEqual(["saude-indigena"]);
    expect(montarArvoreDoMenu({ permitidas: {} })).toEqual([]);
    expect(montarArvoreDoMenu()).toEqual([]);
  });
});

describe("a página aberta no menu", () => {
  const arvore = montarArvoreDoMenu({
    permitidas: TUDO,
    paineis: PAINEIS,
    secoesDeConfiguracao: SECOES,
    areas: TODAS,
  });

  it("acha o item da área atual e o grupo dele", () => {
    const ativo = itemAtivoDaArvore(
      arvore,
      "calendario",
      null,
      "saude-indigena",
    );
    expect(ativo.area).toBe("saude-indigena");
    expect(ativo.item.rotulo).toBe("Cronograma");
  });

  it("Editais da SEDE ativo não acende Editais da Saúde Indígena", () => {
    const ativo = itemAtivoDaArvore(arvore, "nucleo", null, "sede");
    expect(ativo.area).toBe("sede");
    expect(ativo.item.area).toBe("sede");
    expect(itemAtivoDaArvore(arvore, "nucleo", null, "projetos").area).toBe(
      "projetos",
    );
  });

  it("a Visão geral acende na área atual; painel acende em Painéis", () => {
    expect(itemAtivoDaArvore(arvore, "dashboard", null, "sede").area).toBe(
      "sede",
    );
    expect(itemAtivoDaArvore(arvore, "dashboard", null, "projetos").area).toBe(
      "projetos",
    );
    expect(
      itemAtivoDaArvore(arvore, "panel:sem-titulo", null, "sede").area,
    ).toBe("paineis");
  });

  it("em Configurações, a seção aberta; sem seção que bata, a primeira", () => {
    expect(itemAtivoDaArvore(arvore, "config", "aparencia").item.secao).toBe(
      "aparencia",
    );
    expect(itemAtivoDaArvore(arvore, "config", "nenhuma").item.secao).toBe(
      "marca",
    );
  });

  it("página fora do menu não marca nada", () => {
    expect(itemAtivoDaArvore(arvore, "sem-acesso")).toBeNull();
    expect(itemAtivoDaArvore([], "dashboard")).toBeNull();
  });
});

/*
  As áreas nascem abertas. Guarda-se a lista das fechadas, então uma área nova
  no catálogo aparece aberta sem ninguém a ter aberto antes.
*/
describe("áreas abertas por padrão", () => {
  it("só a área que a pessoa fechou fica fechada", () => {
    const fechadas = new Set(["administracao"]);
    expect(areaAberta(fechadas, "sede")).toBe(true);
    expect(areaAberta(fechadas, "administracao")).toBe(false);
    expect(areaAberta(new Set(), "area-nova")).toBe(true);
  });
});

describe("transbordo da navegação recolhida", () => {
  it("rola só quando o conteúdo passa do espaço, com folga de subpixel", () => {
    expect(navegacaoTransborda(400, 560)).toBe(false);
    expect(navegacaoTransborda(560, 560)).toBe(false);
    expect(navegacaoTransborda(560.6, 560)).toBe(false);
    expect(navegacaoTransborda(720, 560)).toBe(true);
  });
});

describe("posição do painel flutuante da barra recolhida", () => {
  it("centra a pílula do nome no ícone", () => {
    expect(
      posicaoDoPainelFlutuante({
        topoDoGatilho: 100,
        alturaDoGatilho: 36,
        alturaDoPainel: 200,
        alturaDaJanela: 900,
      }),
    ).toBe(104);
  });

  it("sobe até caber quando o painel passaria do pé da janela", () => {
    expect(
      posicaoDoPainelFlutuante({
        topoDoGatilho: 700,
        alturaDoGatilho: 36,
        alturaDoPainel: 300,
        alturaDaJanela: 800,
      }),
    ).toBe(492);
  });

  it("nunca passa da margem do topo", () => {
    expect(
      posicaoDoPainelFlutuante({
        topoDoGatilho: 20,
        alturaDoGatilho: 36,
        alturaDoPainel: 900,
        alturaDaJanela: 600,
      }),
    ).toBe(8);
  });
});

/*
  O painel flutuante tem estado próprio porque `:hover` e `:focus-within` não
  bastam: o `Esc` não fecharia (o foco volta ao ícone, dentro da área), um
  clique prenderia o painel aberto e hover e foco abririam dois painéis.
*/
describe("estado do painel flutuante", () => {
  const passo = (estado, tipo, area) =>
    proximoFlutuante(estado, { tipo, area });

  it("abre ao apontar e fecha ao desapontar", () => {
    const aberto = passo(FLUTUANTE_FECHADO, "apontar", "sede");
    expect(aberto).toMatchObject({
      aberta: "sede",
      origem: "ponteiro",
    });
    expect(passo(aberto, "desapontar", "sede").aberta).toBeNull();
  });

  it("só um painel por vez: apontar outra área troca", () => {
    const um = passo(FLUTUANTE_FECHADO, "apontar", "sede");
    expect(passo(um, "apontar", "administracao").aberta).toBe("administracao");
  });

  it("aberto pelo foco, não fecha quando o ponteiro sai", () => {
    const pelaMao = passo(FLUTUANTE_FECHADO, "apontar", "sede");
    const focado = passo(pelaMao, "focar", "sede");
    expect(focado.origem).toBe("foco");
    expect(passo(focado, "desapontar", "sede").aberta).toBe("sede");
    expect(passo(focado, "desfocar", "sede").aberta).toBeNull();
  });

  it("o clique fixa; o segundo clique fecha e não deixa o foco reabrir", () => {
    const fixado = passo(FLUTUANTE_FECHADO, "alternar", "sede");
    expect(fixado).toMatchObject({ aberta: "sede", origem: "clique" });
    expect(passo(fixado, "desapontar", "sede").aberta).toBe("sede");

    const fechado = passo(fixado, "alternar", "sede");
    expect(fechado).toMatchObject({ aberta: null, suprimida: "sede" });
    expect(passo(fechado, "focar", "sede").aberta).toBeNull();
  });

  it("Esc dispensa: o foco devolvido ao ícone não reabre até sair da área", () => {
    const aberto = passo(FLUTUANTE_FECHADO, "focar", "sede");
    const dispensado = passo(aberto, "dispensar", "sede");
    expect(dispensado).toMatchObject({
      aberta: null,
      suprimida: "sede",
    });
    expect(passo(dispensado, "focar", "sede").aberta).toBeNull();

    const saiu = passo(dispensado, "desfocar", "sede");
    expect(saiu.suprimida).toBeNull();
    expect(passo(saiu, "focar", "sede").aberta).toBe("sede");
  });

  it("clique fora, rolagem ou troca da barra fecham tudo", () => {
    const aberto = passo(FLUTUANTE_FECHADO, "alternar", "administracao");
    expect(passo(aberto, "fechar")).toEqual(FLUTUANTE_FECHADO);
  });

  it("evento desconhecido não muda nada", () => {
    const aberto = passo(FLUTUANTE_FECHADO, "apontar", "sede");
    expect(passo(aberto, "piscar", "sede")).toBe(aberto);
  });
});

describe("Visão geral da SEDE e de Projetos", () => {
  it("segue a permissão da Visão geral: sem ela, SEDE e Projetos não a mostram", () => {
    const grupos = porGrupo(
      montarArvoreDoMenu({
        permitidas: { nucleo: true, dashboard: false },
        areas: ["sede", "projetos"],
      }),
    );
    expect(grupos.sede.map((item) => item.view)).toEqual(["nucleo"]);
    expect(grupos.projetos.map((item) => item.view)).toEqual(["nucleo"]);
  });

  it("acende o item da área atual", () => {
    const arvore = montarArvoreDoMenu({
      permitidas: { dashboard: true, nucleo: true },
      areas: TODAS,
    });
    const ativo = itemAtivoDaArvore(arvore, "dashboard", null, "projetos");
    expect(ativo.area).toBe("projetos");
  });
});

/*
  Seletor de área: a árvore segue com todas as áreas; a barra desenha só a
  atual. Trocar de área mantém a página, se a área nova a tem. As páginas vêm
  da árvore: o teste não supõe qual view é a Visão geral de cada área.
*/
describe("seletor de área", () => {
  const arvore = montarArvoreDoMenu({
    permitidas: TUDO,
    paineis: [{ codigo: "bi", titulo: "BI" }],
    secoesDeConfiguracao: SECOES,
    areas: TODAS,
  });
  const itens = porGrupo(arvore);

  it("só as áreas do sistema entram no seletor", () => {
    expect(ehAreaDoSistema("sede")).toBe(true);
    expect(ehAreaDoSistema("administracao")).toBe(false);
    expect(ehAreaDoSistema(AREA_DOS_PAINEIS)).toBe(false);
  });

  it("recorta a área atual e deixa Painéis e Administração embaixo", () => {
    const recorte = recortarArvorePorArea(arvore, "sede");
    expect(recorte.comSeletor).toBe(true);
    expect(recorte.areas.map((g) => g.id)).toEqual(TODAS);
    expect(recorte.grupoAtual.id).toBe("sede");
    expect(recorte.demais.map((g) => g.id)).toEqual([
      AREA_DOS_PAINEIS,
      "administracao",
    ]);
  });

  it("área atual fora das do usuário cai na primeira; uma área só, sem seletor", () => {
    expect(recortarArvorePorArea(arvore, "outra").grupoAtual.id).toBe(
      "saude-indigena",
    );
    const umaSo = montarArvoreDoMenu({ permitidas: TUDO, areas: ["sede"] });
    expect(recortarArvorePorArea(umaSo, "sede").comSeletor).toBe(false);
    expect(recortarArvorePorArea([], "sede")).toEqual({
      areas: [],
      grupoAtual: null,
      demais: [],
      comSeletor: false,
    });
  });

  it("trocar de área mantém a página; sem ela, a primeira da área", () => {
    expect(destinoAoTrocarDeArea(arvore, "projetos", "calendario").view).toBe(
      "calendario",
    );
    expect(destinoAoTrocarDeArea(arvore, "projetos", "calendario").area).toBe(
      "projetos",
    );
    // Hoje toda aba existe nas três áreas; sem a página na área nova, a primeira.
    const semVisaoGeral = arvore.map((grupo) =>
      grupo.id === "sede"
        ? {
            ...grupo,
            itens: grupo.itens.filter((item) => item.view !== "dashboard"),
          }
        : grupo,
    );
    expect(destinoAoTrocarDeArea(semVisaoGeral, "sede", "dashboard")).toBe(
      semVisaoGeral.find((grupo) => grupo.id === "sede").itens[0],
    );
    expect(destinoAoTrocarDeArea(arvore, "sede", "config")).toBe(itens.sede[0]);
    expect(destinoAoTrocarDeArea(arvore, "inexistente", "nucleo")).toBeNull();
  });
});
