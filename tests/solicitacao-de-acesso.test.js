import { describe, expect, it } from "vitest";
import {
  JUSTIFICATIVA_MINIMA,
  SITUACOES,
  TEXTO_DESATIVADA,
  TITULO_DESATIVADA,
  argumentosDaSolicitacao,
  contaDesativadaNaResposta,
  diaEMes,
  situacaoDaSolicitacao,
  telaDaSolicitacao,
  validarSolicitacao,
} from "../src/lib/solicitacao-de-acesso.js";

/*
  Tela "Solicitar acesso". Em 30/09, uma conta DESATIVADA com um pedido
  aprovado meses antes via "Solicitação aprovada. Recarregue a página para
  entrar." — errado. Cada situação agora tem texto e formulário próprios.
*/

const PENDENTE = {
  status: "pendente",
  created_at: "2026-09-29T13:00:00Z",
  coordenacao_nome: "Norte",
  nome: "Ana",
  setor: "COGIP",
  justificativa: "Acompanho os editais da região norte.",
};

describe("situação do pedido de acesso", () => {
  it("sem pedido: formulário para enviar", () => {
    expect(situacaoDaSolicitacao({ solicitacao: null })).toBe(
      SITUACOES.SEM_PEDIDO,
    );
    expect(telaDaSolicitacao({})).toMatchObject({
      formulario: "editavel",
      acao: "enviar",
      texto: "",
    });
  });

  it("pendente: data do pedido, aguardando, formulário só leitura", () => {
    const tela = telaDaSolicitacao({ solicitacao: PENDENTE });
    expect(tela.situacao).toBe(SITUACOES.PENDENTE);
    expect(tela.texto).toBe(
      "Pedido enviado em 29/09 para a coordenação Norte, aguardando um administrador.",
    );
    expect(tela).toMatchObject({ formulario: "leitura", acao: null });
  });

  it("recusado: mostra a observação e deixa pedir de novo", () => {
    const tela = telaDaSolicitacao({
      solicitacao: {
        status: "recusado",
        avaliado_em: "2026-09-30T12:00:00Z",
        observacao_admin: "Use o e-mail institucional.",
      },
    });
    expect(tela.texto).toBe(
      "Pedido recusado em 30/09. Observação: Use o e-mail institucional. Você pode enviar um novo pedido.",
    );
    expect(tela).toMatchObject({ formulario: "editavel", acao: "enviar" });
  });

  it("conta desativada: vence qualquer pedido, sem 'aprovada' e sem formulário", () => {
    for (const status of ["aprovado", "pendente", "recusado", null]) {
      const tela = telaDaSolicitacao({
        solicitacao: status ? { status } : null,
        contaDesativada: true,
      });
      expect(tela.situacao).toBe(SITUACOES.DESATIVADA);
      expect(tela.titulo).toBe("Seu acesso ao MONITORA foi desativado.");
      expect(tela.titulo).toBe(TITULO_DESATIVADA);
      expect(tela.texto).toBe(TEXTO_DESATIVADA);
      expect(tela.ilustracao).toBe("triste");
      expect(tela.texto).not.toMatch(/aprovad/i);
      expect(tela).toMatchObject({ formulario: "oculto", acao: null });
    }
  });

  it("aprovado sem perfil ativo = acesso tirado depois (desativada)", () => {
    expect(situacaoDaSolicitacao({ solicitacao: { status: "aprovado" } })).toBe(
      SITUACOES.DESATIVADA,
    );
  });

  it("aprovado e com perfil ativo: botão 'Entrar agora', não texto de recarregar", () => {
    const tela = telaDaSolicitacao({
      solicitacao: { status: "aprovado" },
      perfilAtivo: true,
    });
    expect(tela).toMatchObject({
      situacao: SITUACOES.LIBERADO,
      acao: "entrar",
      formulario: "oculto",
    });
    expect(tela.texto).not.toMatch(/recarregue/i);
  });

  it("garantir_acesso_basico: 'existente' (ou o campo novo) marca a conta desativada", () => {
    expect(
      contaDesativadaNaResposta({ criado: false, motivo: "existente" }),
    ).toBe(true);
    expect(contaDesativadaNaResposta({ conta_desativada: true })).toBe(true);
    expect(
      contaDesativadaNaResposta({ criado: false, motivo: "dominio" }),
    ).toBe(false);
    expect(contaDesativadaNaResposta({ criado: true })).toBe(false);
    expect(contaDesativadaNaResposta(null)).toBe(false);
  });

  it("dia e mês no fuso de Brasília", () => {
    expect(diaEMes("2026-09-30T02:00:00Z")).toBe("29/09");
    expect(diaEMes("")).toBe("");
    expect(diaEMes("x")).toBe("");
  });
});

describe("validação do pedido", () => {
  const valido = {
    nome: "Ana",
    setor: "COGIP",
    coordenacao: "",
    justificativa: "Acompanho os editais da região norte.",
  };

  it("válido não tem erro", () => {
    expect(validarSolicitacao(valido)).toEqual({});
    expect(
      validarSolicitacao({ ...valido, setor: "", coordenacao: "norte" }),
    ).toEqual({});
  });

  it("cada campo diz o que falta", () => {
    const erros = validarSolicitacao({
      nome: " ",
      setor: "",
      coordenacao: "",
      justificativa: "curta",
    });
    expect(erros.nome).toBe("Informe seu nome.");
    expect(erros.setor).toBe(
      "Informe sua área / setor ou escolha a coordenação.",
    );
    expect(erros.justificativa).toBe(
      `Escreva ao menos ${JUSTIFICATIVA_MINIMA} caracteres (faltam ${JUSTIFICATIVA_MINIMA - 5}).`,
    );
    expect(
      validarSolicitacao({ ...valido, justificativa: "" }).justificativa,
    ).toBe("Explique por que precisa do acesso.");
    expect(
      validarSolicitacao({ ...valido, justificativa: "x".repeat(2001) })
        .justificativa,
    ).toMatch(/no máximo 2000/);
  });

  it("argumentos vazios viram null", () => {
    expect(
      argumentosDaSolicitacao({
        nome: " Ana ",
        setor: "",
        justificativa: "x",
        coordenacao: "",
      }),
    ).toEqual({
      p_nome: "Ana",
      p_setor: null,
      p_justificativa: "x",
      p_coordenacao: null,
    });
  });
});
