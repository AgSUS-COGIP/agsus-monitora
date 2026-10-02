import { describe, expect, it, vi } from "vitest";
import { buscarNaBase, responderAya } from "../src/lib/busca-da-aya.js";
import { montarChamado } from "../src/lib/chamado-da-aya.js";

const responder = (question, extra = {}) =>
  responderAya({ question, section: "recursos", area: "sede", ...extra });

describe("Aya sem máquina, sessão de IA ou túnel", () => {
  it("responde saudações e ajuda com sugestões da tela sem nenhuma requisição", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    try {
      for (const pergunta of [
        "oi",
        "oii",
        "ajuda",
        "obrigado",
        "o que você faz?",
      ]) {
        const resultado = responder(pergunta);
        expect(resultado.answer).toContain("parecer jurídico");
        expect(resultado.sugestoes.length).toBeLessThanOrEqual(3);
      }
      expect(responder("Quem pode decidir um recurso?").answer).toContain(
        "Jurídico",
      );
      expect(
        responder("pergunta do MONITORA que não conheço").oferecerChamado,
      ).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it("encontra a regra com sinônimo, sem acento e com erro de digitação", () => {
    for (const pergunta of [
      "quem decide uma contestação?",
      "quem pode decidir um recuro?",
      "quem decide um recurso",
      "quem decide uma contestacao",
    ]) {
      expect(responder(pergunta).answer).toContain("Parecer jurídico");
    }
    expect(responder("como funciona o processo seletivo?").answer).toContain(
      "edital",
    );
    expect(responder("O que é triagem?").answer).toContain("Análises");
  });

  it("não inventa número nem transforma uma pergunta factual em definição", () => {
    expect(responder("quantos recursos aparecem aqui?").oferecerChamado).toBe(
      true,
    );
    const resultado = responder("quantos DSEIs aparecem?", {
      section: "dashboard",
      context: {
        territories: ["DSEI Xavante", "DSEI Manaus"],
        activeFilters: ["UF AM"],
      },
    });
    expect(resultado.answer).toContain("2 DSEIs");
    expect(resultado.answer).toContain("recorte");
    expect(
      responder("quantos DSEIs aparecem?", {
        context: {
          territories: ["Manaus", "Brasília"],
          mapSummary: "2 pontos",
        },
      }).answer,
    ).not.toContain("2 DSEIs");
    expect(
      responder("Como funcionam os filtros?", {
        section: "dashboard",
        context: { activeFilters: ["UF AM"] },
      }).answer,
    ).not.toMatch(/^Os filtros ativos/);
  });

  it("orienta perguntas fora do sistema e oferece temas da página", () => {
    for (const pergunta of [
      "qual a previsão do tempo?",
      "qual o placar de futebol?",
      "como cuidar de plantas?",
      "Qual a capital da França?",
    ]) {
      const resultado = responder(pergunta);
      expect(resultado.answer).toContain("Essa pergunta foge");
      expect(resultado.sources).toEqual([]);
      expect(resultado.sugestoes).toHaveLength(3);
    }
  });

  it("oferece no máximo três perguntas distintas na dúvida, cada uma respondível", () => {
    const resultado = responder("prazo");
    expect(resultado.answer).toContain("Não encontrei exatamente isso");
    expect(resultado.oferecerChamado).toBe(true);
    expect(resultado.sugestoes.length).toBeLessThanOrEqual(3);
    expect(new Set(resultado.sugestoes.map((s) => s.pergunta)).size).toBe(
      resultado.sugestoes.length,
    );
    for (const s of resultado.sugestoes)
      expect(responder(s.pergunta).answer).not.toContain(
        "Não encontrei exatamente isso",
      );
  });

  it("prefere a página atual sem transformar empate em certeza", () => {
    const verbetes = [
      {
        titulo: "Indicadores dos editais",
        perguntas: ["indicadores"],
        resposta: "Editais",
        arquivo: "regras-dos-editais.md",
      },
      {
        titulo: "Indicadores dos recursos",
        perguntas: ["indicadores"],
        resposta: "Recursos",
        arquivo: "regras-dos-recursos.md",
      },
    ];
    expect(
      buscarNaBase("indicadores", "recursos", verbetes)[0].verbete.resposta,
    ).toBe("Recursos");
  });

  it("abre Gmail com conteúdo codificado e mantém alternativa mailto", () => {
    const chamado = montarChamado({
      email: "suporte@agenciasus.org.br",
      pergunta: "Como usar A&B?",
      resposta: "Use o menu.",
      pagina: "Recursos",
    });
    const url = new URL(chamado.href);
    expect(url.origin).toBe("https://mail.google.com");
    expect(url.searchParams.get("to")).toBe(chamado.para);
    expect(url.searchParams.get("su")).toBe(chamado.assunto);
    expect(url.searchParams.get("body")).toBe(chamado.corpo);
    expect(chamado.mailto).toMatch(
      /^mailto:suporte@agenciasus.org.br\?subject=/,
    );
  });
});
