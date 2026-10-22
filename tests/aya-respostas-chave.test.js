import { describe, expect, it } from "vitest";
import { responderAya } from "../src/lib/busca-da-aya.js";

/*
  Perguntas-chave sobre as regras que saíram das telas. A resposta é direta
  (verbete de docs/aya, pela busca) e tem de dizer a regra certa.
*/
const resposta = (pergunta) => responderAya({ question: pergunta }).answer;

describe("respostas sobre as regras do sistema", () => {
  it("quem pode decidir um recurso", () => {
    for (const pergunta of [
      "Quem pode decidir um recurso?",
      "quem decide o recurso?",
      "Quem pode deferir?",
    ]) {
      const texto = resposta(pergunta);
      expect(texto).toContain("Parecer jurídico");
      expect(texto).toContain("Jurídico");
    }
    expect(resposta("Quem pode decidir um recurso?")).toContain("não decide");
  });

  it("por que um edital não aparece em Conduzir entrevistas", () => {
    const texto = resposta(
      "Por que um edital não aparece em Conduzir entrevistas?",
    );
    expect(texto).toContain("7 dias");
    expect(texto).toContain("15 dias");
    expect(texto).toContain("administrador global");
    expect(texto).toContain("sem parecer");
  });

  it("de onde vêm os KPIs da Visão geral", () => {
    const texto = resposta("De onde vêm os KPIs da Visão geral?");
    expect(texto).toContain("10h de Brasília");
    expect(texto).toContain("Seleção");
    expect(texto).toContain("cadastro do edital");
  });

  it("como dar acesso a alguém", () => {
    const texto = resposta("Como dar acesso a alguém?");
    expect(texto).toContain("Adicionar pessoa");
    expect(texto).toContain("O link sozinho não dá acesso");
    expect(texto).toContain("e-mail convidado");
  });

  it("vagas imediatas: quadro do edital, depois a Convocação, depois a regra (sem número manual)", () => {
    const texto = resposta("De onde vêm as vagas imediatas?");
    expect(texto).toContain("não se digitam mais à mão");
    const quadro = texto.indexOf("quadro de vagas do edital");
    const convocacao = texto.indexOf("Lista de aprovados › Convocação");
    const regra = texto.indexOf("percentuais da regra");
    expect(quadro).toBeGreaterThan(-1);
    expect(quadro).toBeLessThan(convocacao);
    expect(convocacao).toBeLessThan(regra);
  });

  it("escopo das análises e manutenção de abas", () => {
    expect(resposta("O que é o escopo Ativo, Inativo e Todos?")).toContain(
      "editais encerrados",
    );
    expect(
      resposta("O que acontece quando uma aba fica em manutenção?"),
    ).toContain("tela de manutenção");
  });

  it("aceita a pergunta com ou sem acento", () => {
    expect(resposta("O que é parecer juridico?")).toBe(
      resposta("O que é parecer jurídico?"),
    );
    expect(resposta("O que é parecer jurídico?")).toContain("parecer jurídico");
  });

  it("não sequestra pergunta factual sobre a tela", () => {
    expect(resposta("quantos recursos aparecem aqui?")).toContain(
      "Não encontrei esse número",
    );
    expect(resposta("quantas vagas ociosas o DSEI tem?")).toContain(
      "Não encontrei esse número",
    );
  });
});
