import { describe, expect, it } from "vitest";
import {
  conflitosDaPublicacao,
  linhasDasSecoes,
  normalizarValoresCarregados,
} from "../../src/lib/publicacao-de-configuracoes.ts";
import {
  linhasDosPaineisAlterados,
  normalizarPaineis,
} from "../../src/lib/paineis-externos-das-configuracoes.ts";

/*
  22/10: publicar Configurações mandava todas as chaves e todos os painéis com
  os valores de quando a tela carregou, e desfazia o que outro administrador
  tivesse mudado nesse meio-tempo. Agora vai só o que a pessoa mudou (painel
  a partir do que está no banco) e a revisão avisa do conflito.
*/

const PAINEL = {
  id: "p1",
  codigo: "recursos",
  titulo: "Recursos",
  url: "https://script.google.com/a",
  ativo: true,
  em_manutencao: false,
};

describe("publicação só do que mudou", () => {
  it("linhasDasSecoes com chaves manda só essas (e ignora chave fora das seções)", () => {
    const valores = new Map([
      ["page_title", "Novo"],
      ["page_subtitle", "Antigo"],
    ]);
    const linhas = linhasDasSecoes(valores, ["page_title", "nao_existe"]);
    expect(linhas.map((l) => l.chave)).toEqual(["page_title"]);
    expect(linhas[0].valor).toBe("Novo");
  });

  it("painel alterado parte do banco: o campo não mexido fica como outra pessoa deixou", () => {
    const banco = [
      { ...PAINEL, titulo: "Recursos (novo nome)" },
      { ...PAINEL, id: "p2", codigo: "outro" },
    ];
    const linhas = linhasDosPaineisAlterados(
      banco,
      new Map([["p1", { em_manutencao: true }]]),
    );
    expect(linhas).toEqual([
      {
        id: "p1",
        titulo: "Recursos (novo nome)",
        url: PAINEL.url,
        ativo: true,
        em_manutencao: true,
      },
    ]);
  });

  it("conflito: outro administrador mudou a mesma chave ou o mesmo campo do painel", () => {
    const carregados = normalizarValoresCarregados({ page_title: "A" });
    const retrato = {
      configuracoes: [{ chave: "page_title", valor: "B" }],
      paineis: [{ ...PAINEL, url: "https://script.google.com/b" }],
    };
    const conflitos = conflitosDaPublicacao(retrato, {
      carregados,
      rascunho: new Map([["page_title", "C"]]),
      paineisCarregados: normalizarPaineis([PAINEL]),
      rascunhoDosPaineis: new Map([
        ["p1", { url: "https://script.google.com/c", ativo: false }],
      ]),
    });
    expect(conflitos.map((c) => [c.entity, c.field])).toEqual([
      ["Configuração", "Valor"],
      ["Painel", "URL"],
    ]);
  });

  it("sem mudança no banco, sem conflito", () => {
    const carregados = normalizarValoresCarregados({ page_title: "A" });
    expect(
      conflitosDaPublicacao(
        {
          configuracoes: [{ chave: "page_title", valor: "A" }],
          paineis: [PAINEL],
        },
        {
          carregados,
          rascunho: new Map([["page_title", "C"]]),
          paineisCarregados: normalizarPaineis([PAINEL]),
          rascunhoDosPaineis: new Map([["p1", { ativo: false }]]),
        },
      ),
    ).toEqual([]);
  });
});
