import { describe, expect, it } from "vitest";
import {
  bancasDoPerfil,
  copiaParaOCampo,
  validadeDaCopia,
} from "../src/lib/conducao-para-o-campo.ts";

/*
  O que a condução guarda no aparelho: quem avalia leva só a sua banca; quem
  não tem banca no edital leva o edital inteiro; o cálculo da convocação não
  vai. Dados fictícios.
*/

const EDITAL = {
  edital: { id: "E1" },
  meu_perfil: "p-ana",
  avaliadores: [
    { perfil: "p-ana", banca: 2, ativo: true },
    { perfil: "p-ana", banca: 3, ativo: false },
    { perfil: "p-bia", banca: 1, ativo: true },
  ],
  convocados: [
    { id: "c1", banca: 1 },
    { id: "c2", banca: 2 },
    { id: "c3", banca: null },
  ],
};
const AGENDA = { itens: [{ banca: 1 }, { banca: 2 }] };

describe("o que a condução leva para o campo", () => {
  it("as bancas de quem está na tela são as ativas do seu perfil", () => {
    expect([...bancasDoPerfil(EDITAL)]).toEqual([2]);
    expect(bancasDoPerfil({ ...EDITAL, meu_perfil: "p-cid" }).size).toBe(0);
    expect(bancasDoPerfil(null).size).toBe(0);
  });

  it("quem avalia leva só os convocados e os horários da sua banca, sem o cálculo", () => {
    const copia = copiaParaOCampo({
      resposta: EDITAL,
      previsao: { situacao: "PREVISTA" },
      agenda: AGENDA,
    });
    expect(copia.soDaBanca).toBe(true);
    expect(copia.resposta).toMatchObject({ convocados: [{ id: "c2" }] });
    expect(copia.agenda).toEqual({ itens: [{ banca: 2 }] });
    expect(copia.calculo).toBeNull();
    expect(copia.formato).toBe(1);
  });

  it("quem não tem banca no edital (coordenação) leva o edital inteiro", () => {
    const resposta = { ...EDITAL, meu_perfil: "p-cid" };
    const copia = copiaParaOCampo({ resposta, previsao: null, agenda: AGENDA });
    expect(copia.soDaBanca).toBe(false);
    expect(copia.resposta).toBe(resposta);
    expect(copia.agenda).toBe(AGENDA);
    expect(copia.calculo).toBeNull();
  });

  it("diz até quando a cópia fica no aparelho (48 h)", () => {
    expect(
      validadeDaCopia(Date.UTC(2026, 10, 17, 13, 14), "America/Sao_Paulo"),
    ).toBe("19/11, 10:14");
  });
});
