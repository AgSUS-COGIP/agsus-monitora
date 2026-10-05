import { describe, expect, it } from "vitest";
import {
  aplicarReacaoDaLinha,
  depoisDaLimpeza,
  inserirNoCursor,
  LIMITE_DO_TEXTO,
  mensagemDaLinha,
  REACOES_RAPIDAS,
  reacoesComAlternancia,
  resumoDasReacoes,
} from "../src/lib/chat.js";

/*
  Regras puras da v1.1 do chat (src/lib/chat.js): o que aparece depois de
  "Limpar conversa", as reações rápidas (alternar, Realtime, resumo para
  desenhar) e o emoji inserido no cursor.
*/

const EU = "eu";
const ANA = "ana";
const BIA = "bia";

describe("depoisDaLimpeza", () => {
  const limpa = "2026-10-05T12:00:00.000Z";
  it("sem limpeza, tudo aparece", () => {
    expect(depoisDaLimpeza({ criada_em: "2020-01-01T00:00:00Z" }, null)).toBe(
      true,
    );
  });
  it("só aparece o que foi enviado depois da limpeza", () => {
    expect(depoisDaLimpeza({ criada_em: "2026-10-05T11:59:59Z" }, limpa)).toBe(
      false,
    );
    expect(depoisDaLimpeza({ criada_em: limpa }, limpa)).toBe(false);
    expect(
      depoisDaLimpeza({ criada_em: "2026-10-05T12:00:00.001Z" }, limpa),
    ).toBe(true);
  });
  it("a mensagem pendente ou que falhou (na tela) sempre aparece; nula, nunca", () => {
    expect(
      depoisDaLimpeza({ criada_em: "2026-01-01", pendente: true }, limpa),
    ).toBe(true);
    expect(
      depoisDaLimpeza({ criada_em: "2026-01-01", falhou: true }, limpa),
    ).toBe(true);
    expect(depoisDaLimpeza(null, limpa)).toBe(false);
  });
});

describe("reações", () => {
  it("as rápidas são seis, na ordem da tela", () => {
    expect(REACOES_RAPIDAS).toEqual(["👍", "✅", "❤️", "😂", "👀", "🙏"]);
  });

  it("alternar põe, junta e tira, na ordem das rápidas, sem mudar a lista recebida", () => {
    const inicio = [{ emoji: "🙏", usuarios: [ANA] }];
    const comJoinha = reacoesComAlternancia(inicio, "👍", EU);
    expect(comJoinha).toEqual([
      { emoji: "👍", usuarios: [EU] },
      { emoji: "🙏", usuarios: [ANA] },
    ]);
    expect(inicio).toEqual([{ emoji: "🙏", usuarios: [ANA] }]);
    const juntos = reacoesComAlternancia(comJoinha, "👍", ANA);
    expect(juntos[0].usuarios).toEqual([EU, ANA]);
    const semMim = reacoesComAlternancia(juntos, "👍", EU);
    expect(semMim[0]).toEqual({ emoji: "👍", usuarios: [ANA] });
    expect(reacoesComAlternancia(semMim, "👍", ANA)).toEqual([
      { emoji: "🙏", usuarios: [ANA] },
    ]);
  });

  it("com ativa explícita, repetir não muda (o Realtime pode chegar depois da resposta)", () => {
    const uma = reacoesComAlternancia([], "✅", EU, true);
    expect(reacoesComAlternancia(uma, "✅", EU, true)).toEqual(uma);
    expect(reacoesComAlternancia([], "✅", EU, false)).toEqual([]);
  });

  it("aplicarReacaoDaLinha muda só a mensagem da linha; outra mensagem ou linha incompleta devolve a mesma lista", () => {
    const mensagens = [
      { id: "m1", reacoes: [] },
      { id: "m2", reacoes: [{ emoji: "👀", usuarios: [EU] }] },
    ];
    const linha = {
      CO_MENSAGEM: "m2",
      CO_USUARIO: ANA,
      DS_EMOJI: "👀",
      ST_REGISTRO_ATIVO: "S",
    };
    const depois = aplicarReacaoDaLinha(mensagens, linha);
    expect(depois[0]).toBe(mensagens[0]);
    expect(depois[1].reacoes).toEqual([{ emoji: "👀", usuarios: [EU, ANA] }]);
    const tirada = aplicarReacaoDaLinha(depois, {
      ...linha,
      ST_REGISTRO_ATIVO: "N",
    });
    expect(tirada[1].reacoes).toEqual([{ emoji: "👀", usuarios: [EU] }]);
    expect(
      aplicarReacaoDaLinha(mensagens, { ...linha, CO_MENSAGEM: "m9" }),
    ).toBe(mensagens);
    expect(aplicarReacaoDaLinha(mensagens, { CO_MENSAGEM: "m1" })).toBe(
      mensagens,
    );
  });

  it("resumo para desenhar: contagem, se é minha e quem reagiu (Você por último)", () => {
    const nomes = { [ANA]: "Ana Souza", [BIA]: "Bia Lima" };
    const resumo = resumoDasReacoes(
      [
        { emoji: "🙏", usuarios: [BIA] },
        { emoji: "👍", usuarios: [EU, ANA] },
        { emoji: "😂", usuarios: [] },
      ],
      EU,
      (id) => nomes[id],
    );
    expect(resumo).toEqual([
      { emoji: "👍", total: 2, minha: true, quem: "Ana Souza, Você" },
      { emoji: "🙏", total: 1, minha: false, quem: "Bia Lima" },
    ]);
    expect(resumoDasReacoes(undefined, EU)).toEqual([]);
  });

  it("mensagem apagada pelo Realtime fica sem reações; a não apagada mantém as que já estavam na tela", () => {
    const linha = {
      CO_MENSAGEM: "m1",
      CO_CONVERSA: "c1",
      CO_USUARIO_AUTOR: ANA,
      DS_TEXTO: "",
      DT_CRIACAO: "2026-10-05T12:00:00Z",
      ST_APAGADA: "S",
    };
    expect(mensagemDaLinha(linha).reacoes).toEqual([]);
    expect(
      "reacoes" in
        mensagemDaLinha({ ...linha, ST_APAGADA: "N", DS_TEXTO: "a" }),
    ).toBe(false);
  });
});

describe("inserirNoCursor", () => {
  it("põe o emoji no cursor e devolve o cursor depois dele", () => {
    expect(inserirNoCursor("Oi tudo", 2, 2, "👍")).toEqual({
      texto: "Oi👍 tudo",
      cursor: 4,
    });
  });
  it("troca a seleção pelo emoji", () => {
    expect(inserirNoCursor("Oi tudo bem", 3, 7, "🙂")).toEqual({
      texto: "Oi 🙂 bem",
      cursor: 5,
    });
  });
  it("cursor fora do texto vai para a ponta; sem cursor, o começo", () => {
    expect(inserirNoCursor("ok", 99, 99, "✅").texto).toBe("ok✅");
    expect(inserirNoCursor("ok", undefined, undefined, "✅").texto).toBe(
      "✅ok",
    );
  });
  it("passaria do limite: não muda", () => {
    const cheio = "x".repeat(LIMITE_DO_TEXTO);
    expect(inserirNoCursor(cheio, 10, 10, "👍")).toEqual({
      texto: cheio,
      cursor: 10,
    });
  });
});
