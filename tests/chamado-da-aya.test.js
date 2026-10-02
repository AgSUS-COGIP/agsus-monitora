import { describe, expect, it } from "vitest";
import {
  dataDeBrasilia,
  EMAIL_DO_SUPORTE_PADRAO,
  emailDoSuporte,
  emailValido,
  LIMITE_DO_CORPO,
  montarChamado,
  pedeSuporte,
  semDadosPessoais,
} from "../src/lib/chamado-da-aya.js";
import {
  camposDaSecao,
  errosDasSecoes,
  normalizarValoresCarregados,
} from "../src/lib/publicacao-de-configuracoes.js";

/*
  "Abrir chamado" da Aya: um mailto: para o suporte, com assunto e corpo em
  texto puro, dentro do limite prático do mailto e sem dados pessoais de
  terceiros.
*/

const QUANDO = new Date("2026-10-01T17:05:00Z"); // 14:05 em Brasília

const base = {
  email: "suporte@agenciasus.org.br",
  pergunta: "Quem pode decidir um recurso?",
  resposta: "Só quem tem a permissão Parecer jurídico.",
  pagina: "Recursos",
  area: "SEDE",
  registro: "Edital 101/2026",
  versao: "MONITORA Web V2.9.35",
  quando: QUANDO,
};

describe("montagem do chamado", () => {
  it("assunto com página e área; corpo com pergunta, resposta e contexto", () => {
    const chamado = montarChamado(base);
    expect(chamado.para).toBe("suporte@agenciasus.org.br");
    expect(chamado.assunto).toBe("MONITORA · Chamado · Recursos · SEDE");
    expect(chamado.corpo).toContain("Pergunta: Quem pode decidir um recurso?");
    expect(chamado.corpo).toContain(
      "Resposta da Aya: Só quem tem a permissão Parecer jurídico.",
    );
    expect(chamado.corpo).toContain("Página: Recursos");
    expect(chamado.corpo).toContain("Área: SEDE");
    expect(chamado.corpo).toContain("Registro aberto: Edital 101/2026");
    expect(chamado.corpo).toContain("Data e hora (Brasília): 01/10/2026 14:05");
    expect(chamado.corpo).toContain("Versão: MONITORA Web V2.9.35");
    expect(chamado.corpo).toContain(
      "Descreva aqui o problema e anexe prints, se quiser:",
    );
    expect(chamado.corpo).not.toContain("Seção de Configurações");
  });

  it("codifica o mailto com CRLF (%0D%0A)", () => {
    const { href, assunto, corpo } = montarChamado(base);
    expect(href.startsWith("mailto:suporte@agenciasus.org.br?subject=")).toBe(
      true,
    );
    expect(href).toContain(`subject=${encodeURIComponent(assunto)}`);
    expect(href).toContain(`&body=${encodeURIComponent(corpo)}`);
    expect(href).toContain("%0D%0A");
    expect(corpo).toContain("\r\n");
    expect(href).not.toMatch(/[\s<>"]/);
  });

  it("leva a seção de Configurações quando houver", () => {
    const { corpo } = montarChamado({
      ...base,
      pagina: "Configurações › Acessos",
      area: "",
      secao: "Acessos",
    });
    expect(corpo).toContain("Seção de Configurações: Acessos");
    expect(corpo).toContain("Área: não informada");
  });

  it("corta a resposta com reticências para caber no limite", () => {
    const { corpo } = montarChamado({
      ...base,
      resposta: "ação é ".repeat(800),
    });
    expect(encodeURIComponent(corpo).length).toBeLessThanOrEqual(
      LIMITE_DO_CORPO,
    );
    expect(corpo).toMatch(/Resposta da Aya: .+…/);
    expect(corpo).toContain("Pergunta: Quem pode decidir um recurso?");
    expect(corpo).toContain("Versão: MONITORA Web V2.9.35");
  });

  it("corta também a pergunta, se só a resposta não bastar", () => {
    const { corpo } = montarChamado({
      ...base,
      pergunta: "pergunta ".repeat(500),
      resposta: "resposta ".repeat(500),
    });
    expect(encodeURIComponent(corpo).length).toBeLessThanOrEqual(
      LIMITE_DO_CORPO,
    );
    expect(corpo).toContain("Página: Recursos");
  });

  it("não leva e-mail nem CPF de terceiros", () => {
    const { corpo, href } = montarChamado({
      ...base,
      pergunta:
        "O candidato joao.silva@gmail.com, CPF 123.456.789-09, não aparece",
      resposta: "Confira 98765432100 na planilha.",
    });
    expect(corpo).not.toContain("joao.silva@gmail.com");
    expect(corpo).not.toContain("123.456.789-09");
    expect(corpo).not.toContain("98765432100");
    expect(corpo).toContain("[e-mail omitido]");
    expect(corpo).toContain("[CPF omitido]");
    expect(href).not.toContain("gmail");
    expect(corpo.toLowerCase()).not.toMatch(/token|bearer|senha/);
  });

  it("usa o endereço padrão quando o configurado é inválido", () => {
    expect(montarChamado({ ...base, email: "sem arroba" }).para).toBe(
      EMAIL_DO_SUPORTE_PADRAO,
    );
    expect(emailDoSuporte("")).toBe("dados.recursoshumanos@agenciasus.org.br");
  });
});

describe("peças do chamado", () => {
  it("valida e-mail", () => {
    expect(emailValido("dados.recursoshumanos@agenciasus.org.br")).toBe(true);
    expect(emailValido("nome@dominio")).toBe(false);
    expect(emailValido("nome @agenciasus.org.br")).toBe(false);
    expect(emailValido("")).toBe(false);
  });

  it("reconhece o pedido de suporte", () => {
    expect(pedeSuporte("Quero falar com o suporte")).toBe(true);
    expect(pedeSuporte("preciso abrir um chamado")).toBe(true);
    expect(pedeSuporte("Quem pode decidir um recurso?")).toBe(false);
  });

  it("formata a data de Brasília e mascara dados", () => {
    expect(dataDeBrasilia(QUANDO)).toBe("01/10/2026 14:05");
    expect(semDadosPessoais("a@b.com 111.222.333-44")).toBe(
      "[e-mail omitido] [CPF omitido]",
    );
  });
});

describe("e-mail do suporte em Configurações › Operação", () => {
  it("é um campo de Operação, com o padrão e validação de e-mail", () => {
    const campo = camposDaSecao("operacao").get("support_email");
    expect(campo).toMatchObject({ rotulo: "E-mail do suporte", tipo: "email" });
    const valores = normalizarValoresCarregados({});
    expect(valores.get("support_email")).toBe(EMAIL_DO_SUPORTE_PADRAO);
    valores.set("support_email", "invalido");
    expect(errosDasSecoes(valores).get("support_email")).toContain(
      "e-mail válido",
    );
    valores.set("support_email", "suporte@agenciasus.org.br");
    expect(errosDasSecoes(valores).has("support_email")).toBe(false);
  });
});
