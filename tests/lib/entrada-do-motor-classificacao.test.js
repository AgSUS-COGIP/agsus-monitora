import { describe, expect, it } from "vitest";
import {
  classificar,
  prepararCandidatos,
} from "../../src/lib/classificacao/motor.ts";
import { convocacaoDoEdital } from "../../src/lib/classificacao/convocacao-do-edital.ts";

const candidato = {
  analise_id: "a1",
  nome: "Ana",
  vaga: "123",
  nota_documental: "12,5",
};
const regra = {
  etapas: { entrevista: false },
  documental: { situacoes_aptas: [] },
};
const entrada = () => ({
  tipo: "CONVOCACAO",
  regra,
  candidatos: [{ ...candidato }],
});
const convocacao = () =>
  convocacaoDoEdital(
    {
      configuracoes: [
        { edital_id: "e1", modelo_id: "m1", padrao_imediata: 1, vagas: [] },
      ],
      modelos: [
        {
          modelo_id: "m1",
          nome: "Ampla",
          categorias: [{ id: "ac", rotulo: "Ampla", sigla: "AC", ampla: true }],
        },
      ],
    },
    "e1",
  );

describe("fronteira do motor da classificação", () => {
  it("recusa uma ordem de desempate malformada", () => {
    expect(() =>
      classificar({
        ...entrada(),
        desempates: [{ chave: "grupo", ordem: "a1" }],
      }),
    ).toThrow(/Ordem de desempate inválida/);
  });
  it("convocação sem limite mantém null e inclui o candidato", () => {
    const resultado = classificar(entrada());
    expect(resultado.vagas[0].limiteConvocacao).toEqual({
      limite: null,
      origem: "sem limite na regra",
    });
    expect(resultado.vagas[0].geral[0]).toMatchObject({
      analiseId: "a1",
      nota: 12.5,
      situacao: "CONVOCADO",
    });
  });
  it("preparar e classificar preservam os dados brutos da análise", () => {
    const bruto = Object.freeze({ ...candidato });
    expect(prepararCandidatos([bruto])[0].notaDocumental).toBe(12.5);
    classificar({ ...entrada(), candidatos: [bruto] });
    expect(bruto).toEqual(candidato);
  });
  it("configuração normalizada mantém a distribuição da convocação", () => {
    expect(
      classificar({ ...entrada(), convocacao: convocacao() }).vagas[0],
    ).toMatchObject({
      total: 1,
      vagasPorModalidade: { AC: 1 },
      origemDasVagas: "CONVOCACAO",
    });
  });
  it.each([{}, { configs: {} }, { ...convocacao(), modelos: {} }])(
    "recusa estruturas incompletas de convocação",
    (convocacao) => {
      expect(() => classificar({ ...entrada(), convocacao })).toThrow(
        /convocação inválida/,
      );
    },
  );
  it("recusa um modelo com categoria incompleta antes de gerar a lista", () => {
    const conv = convocacao();
    conv.modelo.categorias = [null];
    expect(() => classificar({ ...entrada(), convocacao: conv })).toThrow(
      /convocação inválida/,
    );
  });
});
