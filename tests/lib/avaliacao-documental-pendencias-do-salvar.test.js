import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { regraNormalizada } from "../../src/lib/avaliacao-documental/assistente-da-regra.ts";
import {
  lugarDoErro,
  pendenciasDoSalvar,
} from "../../src/lib/avaliacao-documental/pendencias-do-salvar.ts";

/*
  "Salvar como versão N" diz o que falta: cada item leva ao passo e ao campo.
  Os que impedem desabilitam o botão; os outros são para conferir.
*/
const ler = (arquivo) =>
  JSON.parse(
    readFileSync(`tests/fixtures/avaliacao-documental/${arquivo}`, "utf8"),
  );
const PROJ = regraNormalizada(
  ler("casos-de-pontuacao.json").regras["PROJ26-CURRICULAR"],
);
const VAGAS = ler("colunas-da-empregare-93-2026.json");

const base = {
  regra: PROJ,
  erros: [],
  mudou: true,
  temVigente: true,
  motivo: "Ajuste do edital retificado",
  motivoObrigatorio: true,
};
const impedem = (lista) => lista.filter((p) => p.impede);

describe("pendências do salvar", () => {
  it("sem mudança em relação à vigente", () => {
    const lista = pendenciasDoSalvar({ ...base, mudou: false, motivo: "" });
    expect(impedem(lista).map((p) => p.texto)).toEqual([
      "Nenhuma mudança em relação à versão vigente",
    ]);
  });

  it("motivo curto leva ao campo do motivo", () => {
    const [p] = impedem(pendenciasDoSalvar({ ...base, motivo: "curto" }));
    expect(p).toMatchObject({
      texto: "Escreva o motivo da alteração (mín. 10 caracteres)",
      passo: "conferir",
      alvo: "[data-campo='motivo'] input",
    });
    // A primeira versão (sem vigente) não pede motivo.
    expect(
      impedem(
        pendenciasDoSalvar({
          ...base,
          temVigente: false,
          motivoObrigatorio: false,
          motivo: "",
        }),
      ),
    ).toEqual([]);
  });

  it("nome inválido e erros da regra, cada um no seu passo", () => {
    const lista = impedem(
      pendenciasDoSalvar({
        ...base,
        erroDoNome: "De 3 a 80 caracteres.",
        erros: [
          "Bloco 2 (ESCOLARIDADE): título obrigatório.",
          "Nota declarada 1: pontos de cada resposta (0 a 100, até 50 respostas).",
          "Classificação: Critério repetido: IDOSO_60.",
          "Desempate da Provisória: IDOSO, EXPERIENCIA_DECLARADA, MAIOR_IDADE, MAIS_VELHO ou CANDIDATURA, sem repetir.",
        ],
      }),
    );
    expect(lista.map((p) => p.passo)).toEqual([
      "conferir",
      "cardapio",
      "perguntas",
      "nota",
      "nota",
    ]);
    expect(lista[0].texto).toBe("Nome da versão: de 3 a 80 caracteres");
    expect(lista[1].alvo).toBe('[data-cartao="bloco:ESCOLARIDADE"]');
  });

  it("para conferir (não impede): pergunta sem ligação e requisito sem item do edital", () => {
    const regra = structuredClone(PROJ);
    const id = regra.blocos.find((b) => b.codigo === "IDENTIDADE");
    id.perguntas = ["Pergunta que não existe na carga"];
    delete id.item_edital;
    const lista = pendenciasDoSalvar({ ...base, regra, vagas: VAGAS });
    expect(impedem(lista)).toEqual([]);
    const textos = lista.map((p) => p.texto);
    expect(textos).toContain(
      `Pergunta de “${id.titulo}” sem ligação com a Empregare`,
    );
    expect(textos).toContain(`Requisito “${id.titulo}” sem item do edital`);
    const pergunta = lista.find((p) => p.texto.startsWith("Pergunta de"));
    expect(pergunta).toMatchObject({
      passo: "perguntas",
      alvo: '[data-ligacao="bloco:IDENTIDADE:0"]',
    });
  });

  it("erro sem lugar conhecido vai ao cardápio", () => {
    expect(lugarDoErro("Regra grande demais.")).toEqual({ passo: "cardapio" });
  });
});
