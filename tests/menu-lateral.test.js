import { describe, expect, it } from "vitest";
import {
  AREA_DOS_PAINEIS,
  AREAS_DO_MENU,
  FLUTUANTE_FECHADO,
  PAGINAS_DO_MENU,
  areaAberta,
  areaDoPainel,
  eLinkDireto,
  iconesDoCatalogo,
  itemAtivoDaArvore,
  montarArvoreDoMenu,
  navegacaoTransborda,
  posicaoDoPainelFlutuante,
  proximoFlutuante,
} from "../src/lib/menu-lateral.js";
import { SECOES } from "../src/modules/config-secoes.js";
import { NOMES_DE_ICONES } from "../src/modules/icones.js";

const TUDO = {
  dashboard: true,
  nucleo: true,
  calendario: true,
  approved: true,
  config: true,
};
const PAINEIS = [
  { codigo: "analises", titulo: "Análises" },
  { codigo: "sem-titulo", titulo: "  " },
  { codigo: "", titulo: "Sem código" },
];

/*
  O menu lateral deixou de ser uma lista em três grupos fixos e passou a ser
  organizado em áreas do sistema. O sistema vai ganhar áreas: cada uma é um
  ícone no trilho recolhido, e as páginas dela abrem no painel.
*/
describe("o catálogo de áreas", () => {
  it("são Saúde indígena, Recrutamento e seleção e Administração, nessa ordem", () => {
    expect(AREAS_DO_MENU.map((area) => area.rotulo)).toEqual([
      "Saúde indígena",
      "Recrutamento e seleção",
      "Administração",
    ]);
    expect(new Set(AREAS_DO_MENU.map((area) => area.id)).size).toBe(
      AREAS_DO_MENU.length,
    );
  });

  it("toda página aponta para uma área que existe", () => {
    const areas = new Set(AREAS_DO_MENU.map((area) => area.id));
    expect(PAGINAS_DO_MENU.every((pagina) => areas.has(pagina.area))).toBe(
      true,
    );
    expect(areas.has(AREA_DOS_PAINEIS)).toBe(true);
  });

  it("todo ícone que o catálogo pede existe no registro Lucide", () => {
    const registrados = new Set(NOMES_DE_ICONES);
    expect(iconesDoCatalogo().filter((nome) => !registrados.has(nome))).toEqual(
      [],
    );
  });
});

describe("a árvore do menu segue o que o perfil pode ver", () => {
  it("com tudo permitido, distribui as páginas pelas áreas", () => {
    const arvore = montarArvoreDoMenu({
      permitidas: TUDO,
      paineis: PAINEIS,
      secoesDeConfiguracao: SECOES,
    });
    const porArea = Object.fromEntries(
      arvore.map((area) => [area.id, area.itens]),
    );

    expect(arvore.map((area) => area.id)).toEqual([
      "saude-indigena",
      "recrutamento",
      "administracao",
    ]);
    expect(porArea["saude-indigena"].map((item) => item.view)).toEqual([
      "dashboard",
    ]);
    expect(porArea.recrutamento.map((item) => item.rotulo)).toEqual([
      "Editais",
      "Cronograma",
      "Lista de aprovados",
      "Análises",
      "sem-titulo",
    ]);
    expect(porArea.recrutamento.at(-2).view).toBe("panel:analises");
    expect(porArea.administracao.map((item) => item.secao)).toEqual(
      SECOES.map((secao) => secao.id),
    );
    expect(porArea.administracao.every((item) => item.view === "config")).toBe(
      true,
    );
  });

  it("área sem página permitida não aparece", () => {
    const arvore = montarArvoreDoMenu({
      permitidas: { nucleo: true },
      secoesDeConfiguracao: SECOES,
    });
    expect(arvore.map((area) => area.id)).toEqual(["recrutamento"]);
    expect(montarArvoreDoMenu({ permitidas: {} })).toEqual([]);
    expect(montarArvoreDoMenu()).toEqual([]);
  });

  /*
    Link direto é propriedade do catálogo: Saúde indígena é uma página só. Uma
    área que o perfil reduziu a um item continua submenu, com o nome da página
    à vista — senão "Recrutamento e seleção" abriria o Cronograma sem dizer.
  */
  it("só a área de página única vira link direto", () => {
    const [saude] = montarArvoreDoMenu({ permitidas: { dashboard: true } });
    expect(eLinkDireto(saude)).toBe(true);

    const [recrutamento] = montarArvoreDoMenu({
      permitidas: { calendario: true },
    });
    expect(recrutamento.itens).toHaveLength(1);
    expect(eLinkDireto(recrutamento)).toBe(false);
  });

  it("painel sem área registrada vai para Recrutamento e seleção", () => {
    expect(areaDoPainel("analises")).toBe("recrutamento");
    expect(areaDoPainel("qualquer-outro")).toBe(AREA_DOS_PAINEIS);
    expect(areaDoPainel(undefined)).toBe(AREA_DOS_PAINEIS);
  });
});

describe("a página aberta no menu", () => {
  const arvore = montarArvoreDoMenu({
    permitidas: TUDO,
    paineis: PAINEIS,
    secoesDeConfiguracao: SECOES,
  });

  it("acha o item e a área dele", () => {
    const ativo = itemAtivoDaArvore(arvore, "calendario");
    expect(ativo.area).toBe("recrutamento");
    expect(ativo.item.rotulo).toBe("Cronograma");
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
    expect(areaAberta(fechadas, "recrutamento")).toBe(true);
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
    const aberto = passo(FLUTUANTE_FECHADO, "apontar", "recrutamento");
    expect(aberto).toMatchObject({
      aberta: "recrutamento",
      origem: "ponteiro",
    });
    expect(passo(aberto, "desapontar", "recrutamento").aberta).toBeNull();
  });

  it("só um painel por vez: apontar outra área troca", () => {
    const um = passo(FLUTUANTE_FECHADO, "apontar", "recrutamento");
    expect(passo(um, "apontar", "administracao").aberta).toBe("administracao");
  });

  it("aberto pelo foco, não fecha quando o ponteiro sai", () => {
    const pelaMao = passo(FLUTUANTE_FECHADO, "apontar", "recrutamento");
    const focado = passo(pelaMao, "focar", "recrutamento");
    expect(focado.origem).toBe("foco");
    expect(passo(focado, "desapontar", "recrutamento").aberta).toBe(
      "recrutamento",
    );
    expect(passo(focado, "desfocar", "recrutamento").aberta).toBeNull();
  });

  it("o clique fixa; o segundo clique fecha e não deixa o foco reabrir", () => {
    const fixado = passo(FLUTUANTE_FECHADO, "alternar", "recrutamento");
    expect(fixado).toMatchObject({ aberta: "recrutamento", origem: "clique" });
    expect(passo(fixado, "desapontar", "recrutamento").aberta).toBe(
      "recrutamento",
    );

    const fechado = passo(fixado, "alternar", "recrutamento");
    expect(fechado).toMatchObject({ aberta: null, suprimida: "recrutamento" });
    expect(passo(fechado, "focar", "recrutamento").aberta).toBeNull();
  });

  it("Esc dispensa: o foco devolvido ao ícone não reabre até sair da área", () => {
    const aberto = passo(FLUTUANTE_FECHADO, "focar", "recrutamento");
    const dispensado = passo(aberto, "dispensar", "recrutamento");
    expect(dispensado).toMatchObject({
      aberta: null,
      suprimida: "recrutamento",
    });
    expect(passo(dispensado, "focar", "recrutamento").aberta).toBeNull();

    const saiu = passo(dispensado, "desfocar", "recrutamento");
    expect(saiu.suprimida).toBeNull();
    expect(passo(saiu, "focar", "recrutamento").aberta).toBe("recrutamento");
  });

  it("clique fora, rolagem ou troca da barra fecham tudo", () => {
    const aberto = passo(FLUTUANTE_FECHADO, "alternar", "administracao");
    expect(passo(aberto, "fechar")).toEqual(FLUTUANTE_FECHADO);
  });

  it("evento desconhecido não muda nada", () => {
    const aberto = passo(FLUTUANTE_FECHADO, "apontar", "recrutamento");
    expect(passo(aberto, "piscar", "recrutamento")).toBe(aberto);
  });
});
