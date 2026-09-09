import { beforeEach, describe, expect, it } from "vitest";
import {
  SAIDA_DESCONHECIDA,
  SAIDA_EXPIRADA,
  SAIDA_MANUAL,
  SAIDA_REVOGADA,
  causaDaSaida,
  declararSaida,
  encerrarTransicaoDeSaida,
  mensagemDaSaida,
  reivindicarSaida,
  reiniciarEstadoDeSaidaParaTestes,
  saidaJaAplicada,
} from "../src/lib/estado-de-saida.js";

beforeEach(() => reiniciarEstadoDeSaidaParaTestes());

describe("causa da saída", () => {
  it("começa desconhecida", () => {
    expect(causaDaSaida()).toBe(SAIDA_DESCONHECIDA);
  });

  it("saída voluntária não produz mensagem", () => {
    declararSaida(SAIDA_MANUAL);
    expect(mensagemDaSaida()).toBe("");
  });

  it("expiração e revogação produzem mensagens distintas", () => {
    declararSaida(SAIDA_EXPIRADA);
    const expirada = mensagemDaSaida();
    declararSaida(SAIDA_REVOGADA);
    const revogada = mensagemDaSaida();
    expect(expirada).toContain("Sessão encerrada");
    expect(revogada).not.toBe(expirada);
    expect(revogada).toBeTruthy();
  });

  it("causa inválida cai em desconhecida, nunca em manual", () => {
    declararSaida("qualquer-coisa");
    expect(causaDaSaida()).toBe(SAIDA_DESCONHECIDA);
  });

  /*
    `unknown` não é `expired`. Um `SIGNED_OUT` pode vir de outra aba, da
    sincronização do cliente, de um `signOut` local ou do arranque depois de uma
    saída — nada disso é expiração, e anunciá-la transforma um sucesso em falha
    aparente. Só a causa declarada com prova fala.
  */
  it("causa desconhecida é silêncio, nunca expiração", () => {
    declararSaida(SAIDA_DESCONHECIDA);
    expect(mensagemDaSaida()).toBe("");
    declararSaida("valor-que-nao-existe");
    expect(mensagemDaSaida()).toBe("");
  });

  it("somente expired produz a mensagem de expiração", () => {
    const comMensagemDeExpiracao = [
      SAIDA_MANUAL,
      SAIDA_EXPIRADA,
      SAIDA_REVOGADA,
      SAIDA_DESCONHECIDA,
    ].filter((causa) => mensagemDaSaida(causa).includes("Sessão encerrada"));
    expect(comMensagemDeExpiracao).toEqual([SAIDA_EXPIRADA]);
  });
});

describe("dono único da transição", () => {
  it("só a primeira reivindicação vence", () => {
    expect(reivindicarSaida()).toBe(true);
    expect(reivindicarSaida()).toBe(false);
    expect(reivindicarSaida()).toBe(false);
    expect(saidaJaAplicada()).toBe(true);
  });

  /*
    A regressão observada em produção: sair pelo botão, confirmar uma vez, e
    ainda assim ver o alerta amarelo "Sessão encerrada".

    A causa era um booleano consumido no primeiro `SIGNED_OUT`. Um segundo evento
    encontrava-o já em `false` e era lido como expiração. Aqui simula-se
    exatamente isso: vários eventos após uma saída manual.
  */
  it("vários SIGNED_OUT após saída manual não viram expiração", () => {
    declararSaida(SAIDA_MANUAL);

    const mensagens = [];
    for (let i = 0; i < 5; i += 1) {
      // Cada evento consulta a causa; só o primeiro aplica a transição.
      const aplicou = reivindicarSaida();
      mensagens.push({ aplicou, mensagem: mensagemDaSaida() });
    }

    expect(mensagens[0].aplicou).toBe(true);
    expect(mensagens.slice(1).every((m) => m.aplicou === false)).toBe(true);
    for (const { mensagem } of mensagens) {
      expect(mensagem).toBe("");
      expect(mensagem).not.toContain("Sessão encerrada");
    }
  });

  it("a causa manual sobrevive à transição inteira", () => {
    declararSaida(SAIDA_MANUAL);
    reivindicarSaida();
    expect(causaDaSaida()).toBe(SAIDA_MANUAL);
    expect(mensagemDaSaida()).toBe("");
  });

  it("entrar encerra a transição e devolve o estado ao início", () => {
    declararSaida(SAIDA_MANUAL);
    reivindicarSaida();
    encerrarTransicaoDeSaida();
    expect(causaDaSaida()).toBe(SAIDA_DESCONHECIDA);
    expect(saidaJaAplicada()).toBe(false);
  });

  /*
    Depois de entrar de novo, uma expiração real precisa voltar a ser
    distinguível — senão a correção de um bug criaria outro, silenciando avisos
    legítimos.
  */
  it("expiração real continua distinguível depois de uma saída manual", () => {
    declararSaida(SAIDA_MANUAL);
    reivindicarSaida();
    encerrarTransicaoDeSaida();

    declararSaida(SAIDA_EXPIRADA);
    expect(reivindicarSaida()).toBe(true);
    expect(mensagemDaSaida()).toContain("Sessão encerrada");
  });
});
