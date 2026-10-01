import { describe, expect, it } from "vitest";
import {
  acaoDaAya,
  blocosDoTexto,
  caracteresRevelados,
  duracaoDaRevelacao,
  paginaDaAya,
  SECOES_DA_AYA,
  VIEWS_DA_AYA,
} from "../src/lib/aya-paginas.js";
import {
  ABAS_DO_MENU,
  AREAS_DO_SISTEMA,
  nomeDaArea,
} from "../src/lib/menu-lateral.js";
import { SECOES } from "../src/modules/config-secoes.js";
import {
  acaoDaResposta,
  curatedAnswerForQuestion,
} from "../src/modules/aya-knowledge.js";
import { VERBETES_AYA } from "../src/modules/aya-conhecimento-gerado.js";

/*
  A interface não tem texto explicativo: quem explica é a Aya. Estes testes
  garantem que nenhuma página do menu nem seção de Configurações fica sem
  verbete, e que nenhuma sugestão do painel cai no "não sei".
*/

const AREAS = AREAS_DO_SISTEMA.map((area) => area.id);

describe("um verbete por página e por seção", () => {
  it("a Aya conhece as mesmas páginas do menu, na mesma ordem", () => {
    expect(VIEWS_DA_AYA).toEqual(ABAS_DO_MENU.map((aba) => aba.view));
  });

  it("a Aya conhece as mesmas seções de Configurações", () => {
    expect(Object.keys(SECOES_DA_AYA)).toEqual(SECOES.map((s) => s.id));
    for (const secao of SECOES)
      expect(SECOES_DA_AYA[secao.id].nome).toBe(secao.rotulo);
  });

  it.each(ABAS_DO_MENU.map((aba) => [aba.rotulo]))(
    "responde para que serve a página %s",
    (rotulo) => {
      const resposta = curatedAnswerForQuestion(`Para que serve ${rotulo}?`);
      expect(resposta).not.toBe("");
      expect(resposta).toContain(rotulo);
    },
  );

  it.each(SECOES.map((secao) => [secao.rotulo]))(
    "responde para que serve a seção %s",
    (rotulo) => {
      const resposta = curatedAnswerForQuestion(`Para que serve ${rotulo}?`);
      expect(resposta).not.toBe("");
      expect(resposta).toContain(rotulo);
    },
  );
});

describe("sugestões do painel", () => {
  const todas = [
    ...VIEWS_DA_AYA.flatMap((view) =>
      AREAS.map((area) =>
        paginaDaAya({ view, area, nomeDaArea: nomeDaArea(area) }),
      ),
    ),
    ...SECOES.map((secao) => paginaDaAya({ view: "config", secao: secao.id })),
    paginaDaAya({ view: "config" }),
    paginaDaAya({ view: "panel:externo", titulo: "Painel" }),
  ];

  it("toda página tem de 2 a 5 sugestões", () => {
    for (const pagina of todas) {
      expect(pagina.sugestoes.length).toBeGreaterThanOrEqual(2);
      expect(pagina.sugestoes.length).toBeLessThanOrEqual(5);
    }
  });

  it("toda sugestão tem resposta direta num verbete", () => {
    const semResposta = todas
      .flatMap((pagina) => pagina.sugestoes)
      .filter((s) => !curatedAnswerForQuestion(s.pergunta))
      .map((s) => s.pergunta);
    expect(semResposta).toEqual([]);
  });

  it("o rótulo do botão é curto e diferente da pergunta enviada", () => {
    for (const s of todas.flatMap((pagina) => pagina.sugestoes)) {
      expect(s.rotulo.length).toBeLessThanOrEqual(24);
      expect(s.pergunta).not.toBe(s.rotulo);
    }
  });
});

describe("página e área atuais", () => {
  it("põe a área no nome das páginas do menu", () => {
    expect(
      paginaDaAya({ view: "recursos", area: "sede", nomeDaArea: "SEDE" }).nome,
    ).toBe("Recursos · SEDE");
  });

  it("a Visão geral de cada área fala do mapa certo", () => {
    const si = paginaDaAya({
      view: "dashboard",
      area: "saude-indigena",
      nomeDaArea: "Saúde Indígena",
    });
    const projetos = paginaDaAya({
      view: "dashboard",
      area: "projetos",
      nomeDaArea: "Projetos",
    });
    const sede = paginaDaAya({
      view: "dashboard",
      area: "sede",
      nomeDaArea: "SEDE",
    });
    expect(si.intro).toContain("DSEIs");
    expect(projetos.intro).toContain("projetos");
    expect(projetos.intro).not.toContain("DSEI");
    expect(sede.intro).not.toContain("mapa");
    expect(sede.intro).not.toContain("Saúde Indígena");
    expect(sede.nome).toBe("Visão geral · SEDE");
  });

  it("dá a seção de Configurações e a página genérica", () => {
    expect(paginaDaAya({ view: "config", secao: "acessos" }).nome).toBe(
      "Configurações › Acessos",
    );
    expect(paginaDaAya({ view: "panel:x", titulo: "Painel X" }).nome).toBe(
      "Painel X",
    );
  });

  it("Recursos explica o parecer jurídico", () => {
    expect(paginaDaAya({ view: "recursos" }).intro).toBe(
      "Posso explicar o fluxo do parecer jurídico, os prazos e os indicadores desta tela.",
    );
  });
});

describe("ações das respostas", () => {
  it("só navega dentro do app", () => {
    expect(acaoDaAya("recursos")).toMatchObject({
      rotulo: "Abrir Recursos",
      view: "recursos",
    });
    expect(acaoDaAya("config:acessos")).toMatchObject({
      rotulo: "Ir para Configurações › Acessos",
      view: "config",
      secao: "acessos",
    });
    expect(acaoDaAya("https://exemplo.com")).toBeNull();
  });

  it("todo `abrir` dos verbetes é uma ação conhecida", () => {
    for (const verbete of VERBETES_AYA.filter((v) => v.abrir))
      expect(acaoDaAya(verbete.abrir)).not.toBeNull();
  });

  it("a resposta direta traz a ação do verbete", () => {
    const resposta = curatedAnswerForQuestion("Como dar acesso a alguém?");
    expect(acaoDaResposta(resposta)).toBe("config:acessos");
    expect(acaoDaResposta("texto da IA")).toBe("");
  });
});

describe("texto da resposta", () => {
  it("vira parágrafos e listas, sem HTML", () => {
    expect(
      blocosDoTexto("Primeiro.\ncontinua\n\n- um\n- dois\n\n1. a\n2) b"),
    ).toEqual([
      { tipo: "paragrafo", itens: ["Primeiro. continua"] },
      { tipo: "lista", itens: ["um", "dois"] },
      { tipo: "numerada", itens: ["a", "b"] },
    ]);
    expect(blocosDoTexto("<b>oi</b>")).toEqual([
      { tipo: "paragrafo", itens: ["<b>oi</b>"] },
    ]);
  });

  it("revela aos poucos, de 650 ms a 3,4 s", () => {
    expect(duracaoDaRevelacao("")).toBe(0);
    expect(duracaoDaRevelacao("abc")).toBe(650);
    expect(duracaoDaRevelacao("x".repeat(1000))).toBe(3400);
    expect(caracteresRevelados("abcdef", 0)).toBe(1);
    expect(caracteresRevelados("abcdef", 10000)).toBe(6);
  });
});
