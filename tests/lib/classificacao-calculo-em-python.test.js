import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculoLido,
  caminhoSeguro,
  diferencasDosRetratos,
  esperaOJob,
  respostaDoPedido,
  textoDoPedidoParado,
} from "../../src/lib/classificacao/calculo-em-python.ts";
import { convocacaoDoEdital } from "../../src/lib/classificacao/convocacao-do-edital.ts";
import { retratoDaClassificacao } from "../../src/lib/classificacao/dados-do-estado.ts";
import { instantaneoDaLista } from "../../src/lib/classificacao/exportacao.ts";
import { classificar } from "../../src/lib/classificacao/motor.ts";

/*
  A lista calculada pelo Python (etapa 2b, src/lib/classificacao/calculo-em-python.ts):
  a leitura das respostas e a conferência do retrato do Python com o da tela.
  O retrato do Python chega do jsonb com as chaves em outra ordem e 3.0 como 3;
  isso não é diferença. Os casos dourados (tests/fixtures/classificacao/casos-do-motor.json,
  `retrato`, conferidos também pelo pytest) dão 0 diferença.
*/
const P = "aaaaaaaa-1111-4111-8111-111111111111";
const DOURADO = JSON.parse(
  readFileSync("tests/fixtures/classificacao/casos-do-motor.json", "utf8"),
);

/* As chaves em outra ordem, como o jsonb devolve. */
function embaralhar(valor) {
  if (Array.isArray(valor)) return valor.map(embaralhar);
  if (valor && typeof valor === "object")
    return Object.fromEntries(
      Object.entries(valor)
        .reverse()
        .map(([k, v]) => [k, embaralhar(v)]),
    );
  return valor;
}

describe("as respostas do banco", () => {
  it("chave desligada (ou resposta vazia): sem pedido, o Gerar segue como antes", () => {
    expect(respostaDoPedido({ ligada: false })).toBeNull();
    expect(respostaDoPedido(null)).toBeNull();
    expect(respostaDoPedido(undefined)).toBeNull();
  });

  it("chave ligada: o pedido, com a situação e a mensagem; fora do formato, erro", () => {
    expect(
      respostaDoPedido({
        ligada: true,
        pedido: P,
        situacao: "SEM_DISPARO",
        mensagem: " O pedido ao GitHub não saiu (SEM_TOKEN). ",
      }),
    ).toEqual({
      pedido: P,
      situacao: "SEM_DISPARO",
      mensagem: "O pedido ao GitHub não saiu (SEM_TOKEN).",
    });
    expect(() =>
      respostaDoPedido({ ligada: true, pedido: "x", situacao: "PEDIDO" }),
    ).toThrow(/fora do formato/);
    expect(() =>
      respostaDoPedido({ ligada: true, pedido: P, situacao: "OUTRA" }),
    ).toThrow(/fora do formato/);
  });

  it("o pedido lido: o retrato só quando vem objeto; quem ainda espera o job", () => {
    const lido = calculoLido({
      pedido: P,
      situacao: "PRONTO",
      retrato: { tipo: "FINAL" },
    });
    expect(lido.retrato).toEqual({ tipo: "FINAL" });
    expect(
      calculoLido({ pedido: P, situacao: "PRONTO", retrato: null }).retrato,
    ).toBeNull();
    expect(() => calculoLido(null)).toThrow();
    expect(["PEDIDO", "CALCULANDO"].every(esperaOJob)).toBe(true);
    expect(
      ["PRONTO", "FALHOU", "NAO_CONFERE", "SEM_DISPARO"].some(esperaOJob),
    ).toBe(false);
  });

  it("o pedido parado diz o motivo (a mensagem do banco primeiro)", () => {
    expect(
      textoDoPedidoParado({ pedido: P, situacao: "FALHOU", mensagem: "" }),
    ).toBe("O cálculo em Python falhou.");
    expect(
      textoDoPedidoParado({
        pedido: P,
        situacao: "FALHOU",
        mensagem:
          "A regra do edital mudou desde o pedido; gere a lista de novo.",
      }),
    ).toContain("mudou desde o pedido");
  });
});

describe("a conferência: retrato do Python × retrato da tela", () => {
  it("ordem das chaves, 3.0 × 3 e campos undefined não são diferença", () => {
    const tela = { tipo: "FINAL", vagas: [{ total: 3, nome: undefined }] };
    const python = JSON.parse('{"vagas":[{"total":3.0}],"tipo":"FINAL"}');
    expect(diferencasDosRetratos(tela, python)).toEqual({
      total: 0,
      caminhos: [],
    });
  });

  it("acha valor, campo e posição de lista diferentes, com o caminho e sem o valor", () => {
    const tela = {
      vagas: [{ geral: [{ posicao: 1, nome: "Ana" }], listas: { PP: [] } }],
      totais: { elegiveis: 1 },
    };
    const python = {
      vagas: [
        {
          geral: [
            { posicao: 2, nome: "Ana" },
            { posicao: 3, nome: "Bia" },
          ],
          listas: { PP: [], PCD: [] },
        },
      ],
      totais: {},
    };
    const { total, caminhos } = diferencasDosRetratos(tela, python);
    expect(total).toBe(4);
    expect(caminhos).toEqual([
      "totais.elegiveis",
      "vagas[0].geral[0].posicao",
      "vagas[0].geral[1]",
      "vagas[0].listas.PCD",
    ]);
    expect(caminhos.join(" ")).not.toMatch(/Ana|Bia/);
  });

  it("guarda só os primeiros caminhos e só os seguros", () => {
    const tela = { x: Array.from({ length: 30 }, (_, i) => i) };
    const python = { x: Array.from({ length: 30 }, (_, i) => i + 1) };
    const { total, caminhos } = diferencasDosRetratos(tela, python);
    expect(total).toBe(30);
    expect(caminhos).toHaveLength(20);
    expect(caminhos.every(caminhoSeguro)).toBe(true);
    // Uma chave com espaço ou acento vira _ (o caminho nunca leva o valor).
    expect(
      diferencasDosRetratos({ "Pessoa com deficiência": 1 }, {}).caminhos,
    ).toEqual(["Pessoa_com_defici_ncia"]);
    expect(caminhoSeguro("vagas[0].nome=Fulana")).toBe(false);
    expect(caminhoSeguro("x.12345678901")).toBe(false);
  });

  it.each(DOURADO.casos.map((c, i) => [c.nome, c, i]))(
    "caso dourado: o retrato da tela é o do Python (%s)",
    (_nome, caso, i) => {
      const entrada = DOURADO.editais[caso.edital];
      const bruta = entrada.convocacao;
      const resultado = classificar({
        tipo: caso.tipo,
        ...entrada,
        convocacao: bruta
          ? convocacaoDoEdital(
              { configuracoes: bruta.configuracoes, modelos: bruta.modelos },
              bruta.edital_id,
            )
          : null,
      });
      const tela = retratoDaClassificacao(
        instantaneoDaLista(resultado, {
          edital: caso.editalDoRetrato,
          regra: entrada.regra,
          versao: Math.floor(i / 4) + 1,
        }),
      );
      expect(diferencasDosRetratos(tela, embaralhar(caso.retrato)).total).toBe(
        0,
      );
    },
  );
});
