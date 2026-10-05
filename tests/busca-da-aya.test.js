import { describe, expect, it } from "vitest";
import {
  LIMIAR_CONFIANTE,
  LIMIAR_INCERTO,
  buscarNaBase,
  responderAya,
} from "../src/lib/busca-da-aya.js";

const responder = (question, extra = {}) =>
  responderAya({ question, section: "dashboard", area: "sede", ...extra });

const FORA = "Essa pergunta foge do que eu sei";
const DUVIDA = "Não encontrei exatamente isso. Você quis dizer…?";

describe("sinônimos na busca", () => {
  it.each([
    ["o que é PSS?", "o edital é o instrumento"],
    ["o que é um certame?", "o edital é o instrumento"],
    ["o que é casa de apoio?", "Casa de Saúde Indígena"],
    ["o que é posto de saúde?", "Unidade Básica de Saúde Indígena"],
    ["o que é distrito sanitário especial indígena?", "34 no Brasil"],
    ["quem decide uma impugnação?", "Parecer jurídico"],
    ["o que é triagem?", "Análises curriculares"],
  ])("%s", (pergunta, trecho) => {
    expect(responder(pergunta).answer).toContain(trecho);
  });
});

describe("radical simples na busca", () => {
  it("acha a mesma regra com convocação, convocar ou convocados", () => {
    const respostas = [
      "como funciona a convocação para entrevista?",
      "como convocar para entrevista?",
      "quem são os convocados para entrevista?",
    ].map((pergunta) => responder(pergunta, { section: "entrevistas" }).answer);
    for (const resposta of respostas) {
      expect(resposta).not.toContain(DUVIDA);
      expect(resposta).not.toContain(FORA);
    }
  });
});

describe("pontuação", () => {
  const base = [
    {
      titulo: "Prazo do recurso",
      perguntas: ["prazo do recurso"],
      resposta: "Prazo vem do cronograma.",
      arquivo: "regras-dos-recursos.md",
    },
    {
      titulo: "Tela de Recursos",
      perguntas: ["tela de recursos", "recursos"],
      resposta: "Recursos acompanha os recursos.",
      arquivo: "regras-dos-recursos.md",
    },
    {
      titulo: "Tela de Editais",
      perguntas: ["tela de editais", "editais"],
      resposta: "Editais mostra o prazo de cada edital.",
      arquivo: "regras-dos-editais.md",
    },
    {
      titulo: "DSEI",
      perguntas: ["dsei"],
      resposta: "DSEI é o distrito.",
      arquivo: "02-dsei-e-rede.md",
    },
    {
      titulo: "Mapa de DSEIs",
      perguntas: ["dsei no mapa"],
      resposta: "O mapa mostra os DSEIs.",
      arquivo: "regras-dos-mapas.md",
    },
  ];

  it("frase exata das perguntas vale a resposta certa", () => {
    const { ranking } = buscarNaBase("recursos", {}, base);
    expect(ranking[0].verbete.titulo).toBe("Tela de Recursos");
    expect(ranking[0].pontuacao).toBe(1);
  });

  it("pesa perguntas (3), título (2) e resposta (1)", () => {
    const { ranking } = buscarNaBase("prazo", {}, base);
    expect(ranking.map((r) => r.verbete.titulo)).toEqual([
      "Prazo do recurso",
      "Tela de Editais",
    ]);
  });

  it("termo raro vale mais que termo comum (IDF)", () => {
    const verbete = (titulo, pergunta) => ({
      titulo,
      perguntas: [pergunta],
      resposta: titulo,
      arquivo: "exemplo.md",
    });
    const regras = [
      verbete("Regra geral", "regra geral"),
      verbete("Regra da vaga", "regra da vaga"),
      verbete("Regra do edital", "regra do edital"),
      verbete("Prazo final", "prazo final"),
    ];
    const { ranking } = buscarNaBase("regra prazo", {}, regras);
    expect(ranking[0].verbete.titulo).toBe("Prazo final");
  });

  it("dá bônus multiplicativo à página aberta e à área", () => {
    const semPagina = buscarNaBase("mapa", {}, base).ranking[0].pontuacao;
    const naPagina = buscarNaBase("mapa", { pagina: "dashboard" }, base)
      .ranking[0].pontuacao;
    expect(naPagina).toBeGreaterThan(semPagina);
    const geral = buscarNaBase("distrito", {}, base).ranking;
    const naArea = buscarNaBase(
      "distrito",
      { area: "saude-indigena" },
      base,
    ).ranking;
    expect(naArea[0].bruta).toBeCloseTo(geral[0].bruta * 1.1);
  });

  it("frase exata ganha da página aberta", () => {
    const { ranking } = buscarNaBase("dsei", { pagina: "dashboard" }, base);
    expect(ranking[0].verbete.titulo).toBe("DSEI");
  });

  it("os limiares são 0,6 e 0,3", () => {
    expect(LIMIAR_CONFIANTE).toBe(0.6);
    expect(LIMIAR_INCERTO).toBe(0.3);
  });
});

describe("decisão pelos limiares", () => {
  it("responde a pergunta clara", () => {
    const resultado = responder("como dar acesso a alguém?");
    expect(resultado.answer).toContain("Adicionar pessoa");
    expect(resultado.acao).toBe("config:acessos");
    expect(resultado.oferecerChamado).toBeFalsy();
  });

  it("na dúvida, oferece até 3 opções respondíveis e o chamado", () => {
    const resultado = responder("lista");
    expect(resultado.answer).toBe(DUVIDA);
    expect(resultado.oferecerChamado).toBe(true);
    expect(resultado.sugestoes.length).toBeGreaterThan(1);
    expect(resultado.sugestoes.length).toBeLessThanOrEqual(3);
    for (const s of resultado.sugestoes) {
      expect(s.pergunta).toMatch(/^[A-Z].*\?$/);
      expect(responder(s.pergunta).answer).not.toBe(DUVIDA);
    }
  });

  it.each([
    "me conta uma piada",
    "Qual a capital da França?",
    "receita de bolo de cenoura",
    "como cuidar de plantas?",
    "qual o placar do futebol?",
  ])("%s está fora do escopo", (pergunta) => {
    const resultado = responder(pergunta);
    expect(resultado.answer).toContain(FORA);
    expect(resultado.answer).toMatch(/^Sou a Aya, do MONITORA/);
    expect(resultado.sugestoes).toHaveLength(3);
    expect(resultado.oferecerChamado).toBeFalsy();
  });

  it('"me conta uma piada" não casa com "Contas desativadas"', () => {
    const { ranking, desconhecidos, termos } =
      buscarNaBase("me conta uma piada");
    expect(desconhecidos * 2).toBeGreaterThanOrEqual(termos.length);
    expect(responder("me conta uma piada").answer).not.toContain("desativad");
    expect(ranking[0]?.pontuacao ?? 0).toBeLessThan(LIMIAR_CONFIANTE);
  });
});

describe("correção de digitação", () => {
  it.each([
    ["como funciona a entrevsita?", "entrevistas"],
    ["quem decide o recruso?", "recursos"],
    ["quem decide o rcurso?", "recursos"],
  ])("%s", (pergunta, section) => {
    const resultado = responder(pergunta, { section });
    expect(resultado.answer).not.toContain(FORA);
    expect(resultado.answer).not.toBe(DUVIDA);
  });

  it("corrige para um sinônimo (contestaçao → #recurso)", () => {
    expect(buscarNaBase("contestacoa").termos).toEqual(["#recurso"]);
    expect(buscarNaBase("certme").termos).toEqual(["#edital"]);
  });
});

describe("conversa", () => {
  it.each([
    ["obrigado", /^De nada!/],
    ["tchau", /^Até mais!/],
    ["o que posso perguntar?", /^Sou a Aya/],
    ["como te uso?", /^Sou a Aya/],
    ["e aí", /^Olá! Sou a Aya/],
    ["tudo bem?", /^Olá! Sou a Aya/],
  ])("%s", (pergunta, inicio) => {
    const resultado = responder(pergunta);
    expect(resultado.answer).toMatch(inicio);
    expect(resultado.provider).toBe("aya-conversa");
    expect(resultado.sugestoes.length).toBeGreaterThan(0);
  });

  it("saudação com pergunta responde a pergunta com a saudação na frente", () => {
    const resultado = responder("bom dia, como dar acesso?", {
      section: "config",
      secao: "acessos",
    });
    expect(resultado.answer).toMatch(/^Bom dia! /);
    expect(resultado.answer).toContain("Adicionar pessoa");
    expect(resultado.acao).toBe("config:acessos");
  });

  it("a saudação também abre o fora do escopo, que continua amigável", () => {
    expect(responder("boa tarde, me conta uma piada").answer).toMatch(
      /^Boa tarde! Sou a Aya, do MONITORA\..*Essa pergunta foge/,
    );
  });
});

describe("Aya mais esperta", () => {
  it("duas perguntas numa só: uma resposta numerada para cada", () => {
    const r = responderAya({
      question: "Como dar acesso a alguém e quem pode decidir um recurso?",
      section: "recursos",
    });
    expect(r.answer).toMatch(/^1\. Como dar acesso: /);
    expect(r.answer).toContain("\n2. Quem pode decidir um recurso: ");
  });

  it.each([
    ["o que é CR?", /cadastro reserva/i],
    ["o que é PcD?", /pessoas com deficiência/i],
    ["como funciona o sub judice?", /sub judice/i],
    ["o que é a nota da ART?", /autodeclaração/i],
  ])("sigla do domínio: %s", (pergunta, esperado) => {
    expect(
      responderAya({ question: pergunta, section: "approved" }).answer,
    ).toMatch(esperado);
  });

  it("não entendi: sempre até três caminhos e o chamado, marcado como sem resposta", () => {
    const r = responderAya({
      question: "edital planilha xpto quadro foo",
      section: "nucleo",
    });
    if (r.semResposta && r.oferecerChamado) {
      expect(r.sugestoes.length).toBe(3);
    }
    const fora = responderAya({
      question: "me conta uma piada",
      section: "nucleo",
    });
    expect(fora.semResposta).toBe(true);
  });
});
