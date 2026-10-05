import { describe, expect, it } from "vitest";
import {
  contagensDaLimpeza,
  ESCOLHAS_DE_PRAZO,
  escolhaDoPrazo,
  mensagemDeErroDaRetencao,
  normalizarRetencao,
  oQueOZerarApaga,
  quantasApagaria,
  rotuloDaLimpeza,
  rotuloDoPrazo,
  textoDaConfirmacaoDoPrazo,
  validarMotivo,
  validarPrazo,
  validarZerar,
} from "../src/lib/retencao-do-chat.js";

/*
  Regras da seção Configurações › Mensagens (chat): os códigos CR-n.m são os
  critérios de aceite de docs/historias-de-usuario/chat.md.
*/

describe("prazo de retenção", () => {
  it("CR-1.1: as escolhas são para sempre, 30, 90, 180, 365 e outro prazo", () => {
    expect(ESCOLHAS_DE_PRAZO.map((e) => e.valor)).toEqual([
      "sempre",
      "30",
      "90",
      "180",
      "365",
      "outro",
    ]);
    expect(ESCOLHAS_DE_PRAZO[0].rotulo).toBe("Guardar para sempre");
    expect(rotuloDoPrazo(365)).toBe("365 dias (1 ano)");
    expect(rotuloDoPrazo(1)).toBe("1 dia");
  });

  it("CR-1.2: o valor livre vai de 7 a 3.650 dias, só inteiro", () => {
    expect(validarPrazo("sempre")).toEqual({ ok: true, dias: null, erro: "" });
    expect(validarPrazo("90").dias).toBe(90);
    expect(validarPrazo("outro", " 7 ").dias).toBe(7);
    expect(validarPrazo("outro", "3650").dias).toBe(3650);
    for (const ruim of ["6", "3651", "", "10.5", "-30", "abc", "1e3"])
      expect(validarPrazo("outro", ruim).ok, ruim).toBe(false);
    expect(validarPrazo("outro", "6").erro).toBe(
      "O prazo vai de 7 a 3.650 dias.",
    );
    expect(validarPrazo("45").ok).toBe(false);
  });

  it("a escolha da tela para o prazo salvo", () => {
    expect(escolhaDoPrazo(null)).toBe("sempre");
    expect(escolhaDoPrazo(180)).toBe("180");
    expect(escolhaDoPrazo(45)).toBe("outro");
  });

  it("CR-1.3: quantas o prazo apagaria, pelas idades em dias", () => {
    const idades = [
      { dias: 10, mensagens: 4 },
      { dias: 30, mensagens: 2 },
      { dias: 400, mensagens: 5 },
    ];
    expect(quantasApagaria(idades, 30)).toBe(7);
    expect(quantasApagaria(idades, 31)).toBe(5);
    expect(quantasApagaria(idades, 7)).toBe(11);
    expect(quantasApagaria(idades, null)).toBe(0);
    expect(quantasApagaria(null, 30)).toBe(0);
  });

  it("CR-1.4: a confirmação só aparece quando o prazo apaga algo", () => {
    expect(textoDaConfirmacaoDoPrazo(30, 1234)).toBe(
      "Isto apaga 1.234 mensagens com mais de 30 dias; não dá para desfazer.",
    );
    expect(textoDaConfirmacaoDoPrazo(90, 1)).toBe(
      "Isto apaga 1 mensagem com mais de 90 dias; não dá para desfazer.",
    );
    expect(textoDaConfirmacaoDoPrazo(30, 0)).toBeNull();
    expect(textoDaConfirmacaoDoPrazo(null, 10)).toBeNull();
  });

  it("o motivo tem de 3 a 500 caracteres, sem os espaços das pontas", () => {
    expect(validarMotivo("  ab ").ok).toBe(false);
    expect(validarMotivo(" LGPD ").motivo).toBe("LGPD");
    expect(validarMotivo("x".repeat(501)).ok).toBe(false);
    expect(validarMotivo("x".repeat(500)).ok).toBe(true);
  });
});

describe("zerar mensagens", () => {
  it("CR-2.2: exige exatamente ZERAR e o motivo", () => {
    expect(validarZerar({ confirmacao: "ZERAR", motivo: "Fim do teste" })).toEqual({
      ok: true,
      motivo: "Fim do teste",
      erros: {},
    });
    for (const palavra of ["zerar", " ZERAR", "ZERAR ", "", undefined])
      expect(
        validarZerar({ confirmacao: palavra, motivo: "Fim do teste" }).erros
          .confirmacao,
      ).toBe("Digite ZERAR para confirmar.");
    expect(validarZerar({ confirmacao: "ZERAR", motivo: "a" }).erros.motivo).toBe(
      "Informe o motivo.",
    );
  });

  it("CR-2.1: mostra antes o que vai ser apagado", () => {
    const dados = { mensagens: 1200, reacoes: 1, conversasSemParticipante: 3 };
    expect(oQueOZerarApaga(dados)).toEqual(["1.200 mensagens", "1 reação"]);
    expect(oQueOZerarApaga(dados, true)).toEqual([
      "1.200 mensagens",
      "1 reação",
      "3 conversas sem participante ativo",
    ]);
  });
});

describe("leitura do banco e histórico", () => {
  it("normaliza a resposta de obter_retencao_chat", () => {
    const dados = normalizarRetencao({
      dias: 30,
      atualizado_em: "2026-10-05T12:00:00Z",
      atualizado_por: "admin@agenciasus.org.br",
      mensagens: "12",
      reacoes: 3,
      conversas: 4,
      conversas_sem_participante: 1,
      mais_antiga: "2026-01-02T03:04:05Z",
      idades: [
        { dias: 40, mensagens: 2 },
        { dias: 50, mensagens: 0 },
      ],
      historico: [
        {
          id: "h1",
          tipo: "PRAZO",
          origem: "AGENDA",
          dias: 30,
          corte: "2026-09-05T06:15:00Z",
          mensagens: 2,
          reacoes: 1,
          conversas: 0,
          motivo: null,
          email: null,
          nome: null,
          em: "2026-10-05T06:15:00Z",
        },
      ],
    });
    expect(dados.dias).toBe(30);
    expect(dados.mensagens).toBe(12);
    expect(dados.maisAntiga.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(dados.idades).toEqual([{ dias: 40, mensagens: 2 }]);
    expect(dados.historico[0]).toMatchObject({
      tipo: "PRAZO",
      origem: "AGENDA",
      quem: "",
      motivo: "",
    });
    expect(normalizarRetencao(null)).toMatchObject({
      dias: null,
      mensagens: 0,
      historico: [],
    });
  });

  it("CR-3.1: nomes e contagens das limpezas no histórico", () => {
    const base = { mensagens: 12, reacoes: 3, conversas: 0 };
    expect(rotuloDaLimpeza({ ...base, tipo: "ZERAR", dias: null })).toBe(
      "Zerar mensagens",
    );
    expect(
      rotuloDaLimpeza({ ...base, tipo: "PRAZO", origem: "AGENDA", dias: 30 }),
    ).toBe("Prazo de 30 dias (limpeza diária)");
    expect(
      rotuloDaLimpeza({ ...base, tipo: "PRAZO", origem: "ADMIN", dias: null }),
    ).toBe("Prazo: guardar para sempre");
    expect(contagensDaLimpeza(base)).toBe("12 mensagens · 3 reações");
    expect(contagensDaLimpeza({ mensagens: 1, reacoes: 0, conversas: 2 })).toBe(
      "1 mensagem · 2 conversas",
    );
  });

  it("erros do banco em português", () => {
    expect(mensagemDeErroDaRetencao({ code: "42501" })).toBe(
      "Só o administrador global cuida da retenção das mensagens.",
    );
    expect(mensagemDeErroDaRetencao({ code: "PGRST202" })).toContain(
      "20261005190000",
    );
    expect(mensagemDeErroDaRetencao({ message: "Digite ZERAR para confirmar" })).toBe(
      "Digite ZERAR para confirmar",
    );
  });
});
