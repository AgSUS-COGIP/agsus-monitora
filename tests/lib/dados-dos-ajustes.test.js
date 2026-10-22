import { describe, expect, it } from "vitest";
import {
  normalizarDadosDosAjustes,
  normalizarDadosParaPrevia,
  normalizarPreviaDoAjuste,
} from "../../src/lib/classificacao/dados-dos-ajustes.ts";
import { classificarEdital } from "../../src/lib/classificacao/ajustes.ts";
const versao = {
  id: "aj1",
  versao: 1,
  situacao: "PROPOSTO",
  lista: "PRELIMINAR",
  itens: [{ codigo: "FORMACAO", anterior: 3, novo: 7 }],
};
describe("dados do ajuste de pontuação", () => {
  it("conserva versões válidas e metadados adicionais sem liberar permissões não booleanas", () => {
    const d = normalizarDadosDosAjustes({
      ajustes: [versao],
      recurso_id: "r1",
      pode_propor: true,
      pode_aprovar: "true",
      pode_cancelar: 1,
    });
    expect(d.erro).toBeUndefined();
    expect(d.recurso_id).toBe("r1");
    expect(d.ajustes[0]).toMatchObject(versao);
    expect([d.pode_propor, d.pode_aprovar, d.pode_cancelar]).toEqual([
      true,
      false,
      false,
    ]);
  });
  it("sinaliza versões e itens inválidos sem permitir uma aprovação com itens descartados", () => {
    for (const ajustes of [
      {},
      [null],
      [{ ...versao, versao: Infinity }],
      [{ ...versao, situacao: "inventada" }],
      [{ ...versao, itens: [{ codigo: "FORMACAO", novo: "texto" }] }],
      [{ ...versao, itens: [null] }],
    ]) {
      expect(normalizarDadosDosAjustes({ ajustes }).erro).toContain(
        "versões do ajuste recebidas são inválidas",
      );
    }
  });
  it("preserva a configuração e todos os campos da Classificação para o motor", () => {
    const configuracao = {
      etapas: { documental: true },
      composicao: { componentes: [] },
    };
    const dados = {
      regra: { versao: 3, configuracao },
      candidatos: [{ analise_id: "a1", campo_extra: { valor: 1 } }],
      extra: { valor: 2 },
    };
    const d = normalizarDadosParaPrevia(dados);
    expect(d.erro).toBeUndefined();
    expect(d.regra.configuracao).toBe(configuracao);
    expect(d.candidatos).toEqual(dados.candidatos);
    expect(d.extra).toEqual(dados.extra);
  });
  it("recusa coleções malformadas antes de calcular uma lista", () => {
    for (const candidatos of [{}, "texto", [null], [[]]]) {
      expect(normalizarDadosParaPrevia({ candidatos }).erro).toContain(
        "dados da classificação recebidos são inválidos",
      );
      expect(() => classificarEdital({ candidatos }, "FINAL")).toThrow(
        "dados da classificação recebidos são inválidos",
      );
    }
    expect(normalizarDadosParaPrevia({ convocacao: [] }).erro).toBeTruthy();
    expect(
      normalizarDadosParaPrevia({ regra: { configuracao: [] } }).erro,
    ).toBeTruthy();
  });
  it("protege os campos exibidos das prévias e ignora elementos de afetados inválidos", () => {
    expect(
      normalizarPreviaDoAjuste({
        tipo: "FINAL",
        antes: { naLista: true, nota: Infinity },
        depois: { naLista: true, posicao: {} },
        afetados: [null, { nome: {}, antes: "1", depois: 2 }],
        mudou: "true",
      }),
    ).toMatchObject({
      antes: { nota: null },
      depois: { posicao: null },
      afetados: [{ nome: "", antes: null, depois: 2 }],
      mudou: false,
    });
    expect(normalizarPreviaDoAjuste({ antes: {} })).toBeNull();
  });
});
