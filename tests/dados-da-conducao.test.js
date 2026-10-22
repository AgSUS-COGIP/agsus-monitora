import { describe, expect, it } from "vitest";
import {
  agendaDaConducao,
  codigoDaFalhaDaConducao,
  dadosDoEditalDaConducao,
  roteirosDaConducao,
} from "../src/lib/dados-da-conducao.ts";

describe("dados externos de Conduzir entrevistas", () => {
  it("preserva os campos antigos do roteiro e os retratos da Classificação", () => {
    const roteiro = {
      id: "r1",
      nome: "Roteiro",
      competencias: [{ id: "c1", nome: "Escuta", minimo: 2 }],
      convocacao_padrao: { multiplo_imediatas: 5, excecoes: [] },
      desempate: ["critério antigo"],
      renomeacoes: [{ de: null, para: "Novo nome" }],
    };
    expect(roteirosDaConducao([roteiro])).toEqual([roteiro]);
    const retrato = {
      vagas: [{ chave: "V1", linhas: [{ analise_id: "a1" }] }],
    };
    const resultado = dadosDoEditalDaConducao({
      edital: { id: "e1" },
      lista_convocacao: { lista: { id: "l1" }, retrato },
      configuracao: { roteiro },
      avaliadores: [],
      convocados: [],
      versao: 3,
    });
    expect(resultado.lista_convocacao.retrato).toBe(retrato);
    expect(resultado.configuracao.roteiro).toBe(roteiro);
    expect(resultado.versao).toBe(3);
  });
  it("filtra roteiros incompatíveis antes de chegarem ao editor", () => {
    expect(
      roteirosDaConducao([
        null,
        7,
        { id: 3 },
        { id: "r1", competencias: {} },
        { id: "r2", niveis: [null] },
        { id: "r3", desempate: [4] },
        { id: "r4" },
      ]),
    ).toEqual([{ id: "r4" }]);
  });
  it("não interpreta texto como permissão e ignora membros e convocados inválidos", () => {
    const dados = dadosDoEditalDaConducao({
      edital: { id: "e1" },
      pode_editar: "true",
      admin_global: "false",
      avaliadores: [null, { id: "a1", competencias: {} }, { id: "a2" }],
      convocados: [
        4,
        { id: "c1", observacoes: [null] },
        {
          id: "c2",
          avaliacoes: [
            { competencia: "x1", aspectos: [{ aspecto: "p1", nota: 4 }] },
          ],
        },
      ],
    });
    expect(dados.pode_editar).toBe(false);
    expect(dados.admin_global).toBe(false);
    expect(dados.avaliadores.map((a) => a.id)).toEqual(["a2"]);
    expect(dados.convocados.map((c) => c.id)).toEqual(["c2"]);
  });
  it("recusa respostas sem identificador textual de edital", () => {
    for (const valor of [null, [], "edital", {}, { edital: { id: 7 } }])
      expect(dadosDoEditalDaConducao(valor)).toBeNull();
  });
  it("não aceita listas e identificadores malformados na agenda e convocação", () => {
    const dados = dadosDoEditalDaConducao({
      edital: { id: "e1" },
      lista_convocacao: { lista: { id: 7 } },
      avaliadores: {},
      convocados: "lista",
    });
    expect(dados.lista_convocacao.lista).toBeNull();
    expect(dados.avaliadores).toEqual([]);
    expect(dados.convocados).toEqual([]);
    expect(
      agendaDaConducao({
        itens: [null, { analise_id: {} }, { analise_id: "a1", banca: 1 }],
      }).itens,
    ).toEqual([{ analise_id: "a1", banca: 1 }]);
    expect(agendaDaConducao([])).toBeNull();
  });
  it("só usa códigos textuais de falha", () => {
    expect(codigoDaFalhaDaConducao({ code: "42501" })).toBe("42501");
    for (const erro of [null, "42501", { code: 42501 }, new Error("falha")])
      expect(codigoDaFalhaDaConducao(erro)).toBe("");
  });
});
