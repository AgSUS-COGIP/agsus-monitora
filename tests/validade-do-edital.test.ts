import { describe, expect, it } from "vitest";
import {
  VALIDADE_NAO_LIDA,
  VALIDADE_NOVA,
  errosDaValidade,
  prazoDaValidade,
  somarMesesComoNoBanco,
  validadeDoBanco,
  validadeParaSalvar,
  validadeValida,
  vencimentoDoEdital,
} from "../src/lib/validade-do-edital.ts";
import type { ValidadeDoFormulario } from "../src/lib/validade-do-edital.ts";
import { editalParaSalvar } from "../src/lib/editais-do-nucleo.ts";
import { estadoComparavel } from "../src/lib/rascunho-do-edital.ts";

/*
  Cartão #57: validade do processo seletivo no formulário do edital. As
  contas espelham private."FC_VENCIMENTO_DO_EDITAL" (data_fim + make_interval
  em meses, em dobro se prorrogado; NULL sem data ou sem prazo) e a regra de
  FC_INATIVAR_LISTAS_VENCIDAS (vencido = último dia antes de hoje em Brasília).
  Os resultados esperados são os do PostgreSQL para as mesmas somas.
*/

const validade = (
  anos: string,
  meses: string,
  prorrogado: ValidadeDoFormulario["prorrogado"] = "nao",
  lida = true,
): ValidadeDoFormulario => ({ anos, meses, prorrogado, lida });

describe("somarMesesComoNoBanco (date + interval 'N months' do PostgreSQL)", () => {
  it("fim de mês: 31/01 + 1 mês cai no último dia de fevereiro", () => {
    expect(somarMesesComoNoBanco("2027-01-31", 1)).toBe("2027-02-28");
    expect(somarMesesComoNoBanco("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMesesComoNoBanco("2026-03-31", 1)).toBe("2026-04-30");
    expect(somarMesesComoNoBanco("2026-01-30", 1)).toBe("2026-02-28");
  });

  it("bissexto: 29/02 + 1 ano cai em 28/02; + 4 anos volta a 29/02", () => {
    expect(somarMesesComoNoBanco("2028-02-29", 12)).toBe("2029-02-28");
    expect(somarMesesComoNoBanco("2028-02-29", 48)).toBe("2032-02-29");
  });

  it("vira o ano e aceita o prazo máximo em dobro (240 meses)", () => {
    expect(somarMesesComoNoBanco("2026-11-15", 2)).toBe("2027-01-15");
    expect(somarMesesComoNoBanco("2026-12-31", 14)).toBe("2028-02-29");
    expect(somarMesesComoNoBanco("2026-11-11", 240)).toBe("2046-11-11");
  });

  it("data ilegível ou impossível: null", () => {
    for (const data of ["", "11/11/2026", "2026-02-30", "2026-13-01", "abc"])
      expect(somarMesesComoNoBanco(data, 1)).toBeNull();
    expect(somarMesesComoNoBanco("2026-01-01", 1.5)).toBeNull();
    // Timestamp: vale o dia (como data_fim::date).
    expect(somarMesesComoNoBanco("2026-01-31T00:00:00", 1)).toBe("2026-02-28");
  });
});

describe("vencimentoDoEdital (FC_VENCIMENTO_DO_EDITAL)", () => {
  it("limites: 0 ano e 0 mês não vence; 10 anos e 11 meses somam", () => {
    expect(vencimentoDoEdital("2026-11-11", 0, 0, false)).toBeNull();
    expect(vencimentoDoEdital("2026-11-11", 0, 0, true)).toBeNull();
    expect(vencimentoDoEdital("2026-11-11", 10, 0, false)).toBe("2036-11-11");
    expect(vencimentoDoEdital("2026-11-11", 0, 11, false)).toBe("2027-10-11");
    expect(vencimentoDoEdital("2026-11-11", 10, 11, false)).toBe("2037-10-11");
  });

  it("prorrogado conta em dobro", () => {
    expect(vencimentoDoEdital("2026-11-11", 2, 0, true)).toBe("2030-11-11");
    expect(vencimentoDoEdital("2026-01-31", 0, 1, true)).toBe("2026-03-31");
    expect(vencimentoDoEdital("2026-11-11", 10, 11, true)).toBe("2048-09-11");
  });

  it("sem data de encerramento: null", () => {
    expect(vencimentoDoEdital(null, 2, 0, false)).toBeNull();
    expect(vencimentoDoEdital("", 2, 0, false)).toBeNull();
  });
});

describe("prazoDaValidade (o que o formulário mostra)", () => {
  it("vigente até o último dia; vencido no dia seguinte, em Brasília", () => {
    const v = validade("1", "0");
    // Último dia 11/11/2027. 23h30 de 11/11 em Brasília = 02h30 de 12/11 em UTC.
    const ultimoDiaQuaseMeiaNoite = new Date("2027-11-12T02:30:00Z");
    expect(
      prazoDaValidade(v, "2026-11-11", ultimoDiaQuaseMeiaNoite),
    ).toMatchObject({ tipo: "vigente", vencimento: "2027-11-11" });
    // 00h30 de 12/11 em Brasília (03h30 UTC): venceu.
    const diaSeguinte = new Date("2027-11-12T03:30:00Z");
    const vencido = prazoDaValidade(v, "2026-11-11", diaSeguinte);
    expect(vencido).toMatchObject({
      tipo: "vencido",
      vencimento: "2027-11-11",
    });
    expect(vencido.texto).toBe(
      "Venceu em 11/11/2027: ao salvar, a lista de aprovados vigente fica inativa.",
    );
  });

  it("perto da meia-noite UTC, vale o dia de Brasília (não o UTC)", () => {
    // 21h de 10/11 em Brasília = 00h de 11/11 em UTC: ainda é 10/11, último dia.
    const agora = new Date("2026-11-11T00:00:00Z");
    expect(
      prazoDaValidade(validade("0", "1"), "2026-10-10", agora),
    ).toMatchObject({ tipo: "vigente", vencimento: "2026-11-10" });
  });

  it("textos: válida até, sem prazo, sem data e incompleto", () => {
    const hoje = new Date("2026-11-11T15:00:00Z");
    expect(prazoDaValidade(validade("2", "0"), "2026-11-11", hoje).texto).toBe(
      "Válida até 11/11/2028.",
    );
    expect(prazoDaValidade(validade("0", "0"), "2026-11-11", hoje)).toEqual({
      tipo: "nao-vence",
      texto: "Sem prazo: a lista não vence.",
    });
    expect(prazoDaValidade(validade("2", "0"), "", hoje).tipo).toBe("sem-data");
    expect(
      prazoDaValidade(validade("2", "", "", false), "2026-11-11", hoje).tipo,
    ).toBe("incompleto");
  });
});

describe("validação dos campos", () => {
  it("aceita 0 e 10 anos, 0 e 11 meses", () => {
    for (const [anos, meses] of [
      ["0", "0"],
      ["10", "0"],
      ["0", "11"],
      ["10", "11"],
    ])
      expect(validadeValida(validade(anos!, meses!))).toBe(true);
  });

  it("recusa 11 anos, 12 meses, negativo, decimal e texto, com mensagem", () => {
    expect(errosDaValidade(validade("11", "0")).anos).toBe(
      "Use um número inteiro de 0 a 10 anos.",
    );
    expect(errosDaValidade(validade("0", "12")).meses).toBe(
      "Use um número inteiro de 0 a 11 meses.",
    );
    expect(errosDaValidade(validade("-1", "0")).anos).not.toBe("");
    expect(errosDaValidade(validade("1.5", "0")).anos).not.toBe("");
    expect(errosDaValidade(validade("dois", "0")).anos).not.toBe("");
  });

  it("validade lida exige os três; não lida aceita vazio", () => {
    expect(errosDaValidade(validade("", "", ""))).toEqual({
      anos: "Informe os anos (0 a 10).",
      meses: "Informe os meses (0 a 11).",
      prorrogado: "Diga se o prazo foi prorrogado.",
    });
    expect(validadeValida(VALIDADE_NAO_LIDA)).toBe(true);
    expect(validadeValida({ ...VALIDADE_NAO_LIDA, meses: "12" })).toBe(false);
  });
});

describe("ida e volta com o banco", () => {
  it("lê os três campos do monitoramento de get_monitoramento_cronograma", () => {
    expect(
      validadeDoBanco({
        nu_anos_validade: 2,
        nu_meses_validade: 6,
        st_prorrogado: true,
      }),
    ).toEqual({ anos: "2", meses: "6", prorrogado: "sim", lida: true });
    expect(
      validadeDoBanco({
        nu_anos_validade: 0,
        nu_meses_validade: 0,
        st_prorrogado: false,
      }),
    ).toEqual(VALIDADE_NOVA);
  });

  it("RPC de antes da migration (sem os campos): não lida", () => {
    expect(validadeDoBanco({ cronograma_automatico: true })).toEqual(
      VALIDADE_NAO_LIDA,
    );
    expect(validadeDoBanco(null)).toEqual(VALIDADE_NAO_LIDA);
    expect(
      validadeDoBanco({ nu_anos_validade: 1, nu_meses_validade: 0 }),
    ).toEqual(VALIDADE_NAO_LIDA);
  });

  it("payload: lida manda as três; não lida só o que foi preenchido", () => {
    expect(validadeParaSalvar(validade("10", "11", "sim"))).toEqual({
      nu_anos_validade: 10,
      nu_meses_validade: 11,
      st_prorrogado: true,
    });
    expect(validadeParaSalvar(validade("0", "0", "nao"))).toEqual({
      nu_anos_validade: 0,
      nu_meses_validade: 0,
      st_prorrogado: false,
    });
    expect(validadeParaSalvar(VALIDADE_NAO_LIDA)).toEqual({});
    expect(validadeParaSalvar({ ...VALIDADE_NAO_LIDA, anos: "3" })).toEqual({
      nu_anos_validade: 3,
    });
    // Valor inválido nunca vai (a tela bloqueia o Salvar antes).
    expect(validadeParaSalvar(validade("12", "0", "nao"))).toEqual({
      nu_meses_validade: 0,
      st_prorrogado: false,
    });
    expect(validadeParaSalvar(null)).toEqual({});
  });

  it("editalParaSalvar leva as chaves no p_payload de salvar_monitoramento_com_cronograma_v2", () => {
    const formulario = { id: "e1", edital: "900/2099" } as Parameters<
      typeof editalParaSalvar
    >[0];
    const previa = { status: "", etapa: "" };
    const comValidade = editalParaSalvar(
      formulario,
      null,
      { automatico: false, etapas: [], validade: validade("2", "3", "sim") },
      previa,
    );
    expect(comValidade).toMatchObject({
      nu_anos_validade: 2,
      nu_meses_validade: 3,
      st_prorrogado: true,
    });
    const semLeitura = editalParaSalvar(
      formulario,
      null,
      { automatico: false, etapas: [], validade: VALIDADE_NAO_LIDA },
      previa,
    );
    expect("nu_anos_validade" in semLeitura).toBe(false);
    expect("nu_meses_validade" in semLeitura).toBe(false);
    expect("st_prorrogado" in semLeitura).toBe(false);
  });

  it("mexer na validade conta como alteração do formulário (rascunho)", () => {
    const antes = estadoComparavel({}, { validade: validade("1", "0") });
    const depois = estadoComparavel({}, { validade: validade("2", "0") });
    expect(depois).not.toBe(antes);
  });
});
