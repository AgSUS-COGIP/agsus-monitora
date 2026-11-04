import { describe, expect, it } from "vitest";
import {
  LIMITE_POR_BLOCO,
  chaveDoVisto,
  horaEmBrasilia,
  lerResumoDoDia,
  ondeDoItem,
  primeiroNome,
  quandoDoItem,
  recortarBloco,
  saudacao,
  semDemanda,
  tituloDoResumo,
  totalDoResumo,
} from "../src/lib/resumo-do-dia.ts";

const BRUTO = {
  data: "2026-09-15",
  perfil: "p1",
  nome: "Ana Souza",
  responsavel: true,
  editais: ["e1", 2, null],
  demandas: ["d1"],
  hoje: [
    {
      tipo: "etapa",
      id: "c1",
      titulo: "Prazo de recurso",
      edital: "10/2026",
      unidade: "DSEI X",
      marco: "inicio",
      data: "2026-09-15",
    },
    { tipo: "etapa", id: "", titulo: "sem id", data: "2026-09-15" },
  ],
  proximos: [],
  atrasadas: [
    {
      tipo: "demanda",
      id: "d1",
      titulo: "Relatório",
      data_fim: "2026-09-10",
      marco: "fim",
      data: "2026-09-10",
      pode_concluir: true,
    },
  ],
};

describe("leitura do resumo do dia", () => {
  it("lê a resposta, descarta itens sem id e dá a cor do tipo", () => {
    const resumo = lerResumoDoDia(BRUTO);
    expect(resumo).toMatchObject({
      perfil: "p1",
      responsavel: true,
      editais: ["e1", "2"],
      mostrarAoEntrar: true,
    });
    expect(resumo.hoje).toHaveLength(1);
    expect(resumo.hoje[0]).toMatchObject({
      cor: "rosa",
      rotuloDoTipo: "Recursos",
    });
    expect(resumo.atrasadas[0]).toMatchObject({
      cor: "demanda",
      rotuloDoTipo: "Demanda interna",
      podeConcluir: true,
    });
    expect(totalDoResumo(resumo)).toBe(2);
    expect(lerResumoDoDia({})).toBeNull();
    expect(
      lerResumoDoDia({ ...BRUTO, mostrar_ao_entrar: false }).mostrarAoEntrar,
    ).toBe(false);
  });

  it("textos de cada linha", () => {
    const resumo = lerResumoDoDia(BRUTO);
    expect(quandoDoItem(resumo.hoje[0], "hoje")).toBe("começa 15/09");
    expect(quandoDoItem(resumo.atrasadas[0], "atrasadas")).toBe("venceu 10/09");
    expect(ondeDoItem(resumo.hoje[0])).toBe("10/2026 · DSEI X");
    expect(ondeDoItem(resumo.atrasadas[0])).toBe("Demanda interna");
  });

  it("concluir tira a demanda de todos os blocos", () => {
    const resumo = semDemanda(lerResumoDoDia(BRUTO), "d1");
    expect(resumo.atrasadas).toEqual([]);
    expect(totalDoResumo(resumo)).toBe(1);
  });

  it("até cinco por bloco e 'e mais N'", () => {
    const lista = Array.from(
      { length: 8 },
      () => lerResumoDoDia(BRUTO).hoje[0],
    );
    expect(recortarBloco(lista).visiveis).toHaveLength(LIMITE_POR_BLOCO);
    expect(recortarBloco(lista).mais).toBe(3);
    expect(recortarBloco(lista.slice(0, 2)).mais).toBe(0);
  });
});

describe("saudação pela hora de Brasília", () => {
  it("bom dia, boa tarde, boa noite", () => {
    expect(horaEmBrasilia(new Date("2026-09-15T13:00:00Z"))).toBe(10);
    expect(saudacao(new Date("2026-09-15T13:00:00Z"))).toBe("Bom dia");
    expect(saudacao(new Date("2026-09-15T17:00:00Z"))).toBe("Boa tarde");
    expect(saudacao(new Date("2026-09-15T23:30:00Z"))).toBe("Boa noite");
    // 01h UTC ainda é noite do dia anterior em Brasília.
    expect(saudacao(new Date("2026-09-16T01:00:00Z"))).toBe("Boa noite");
  });

  it("título com o primeiro nome", () => {
    expect(primeiroNome("  Ana Maria Souza ")).toBe("Ana");
    expect(tituloDoResumo("Ana Souza", new Date("2026-09-15T13:00:00Z"))).toBe(
      "Bom dia, Ana — seus editais hoje",
    );
    expect(tituloDoResumo("", new Date("2026-09-15T17:00:00Z"))).toBe(
      "Boa tarde — seus editais hoje",
    );
  });

  it("visto por pessoa e dia", () => {
    expect(chaveDoVisto("p1", "2026-09-15")).toBe(
      "agsus:resumo-do-dia:visto:p1:2026-09-15",
    );
  });
});
