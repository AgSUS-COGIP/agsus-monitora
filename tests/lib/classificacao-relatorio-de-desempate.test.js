import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  lerDesempateDaLista,
  nomesDoRetrato,
  paginaDoDesempate,
  planilhasDoDesempate,
  textoDoValor,
  VERSAO_DO_RELATORIO,
} from "../../src/lib/classificacao/relatorio-de-desempate.ts";

/*
  A leitura do relatório de desempate na tela (src/lib/classificacao/
  relatorio-de-desempate.ts). O relatório dourado é o que o Python gera hoje
  (python/monitora/classificacao/desempate.py) para o edital fictício dos casos
  dourados — o pytest (tests/python/test_classificacao_desempate.py) confere
  que o arquivo continua igual ao que o Python gera; aqui, que a tela o lê.
*/
const DOURADO = JSON.parse(
  readFileSync(
    "tests/fixtures/classificacao/relatorio-de-desempate.json",
    "utf8",
  ),
);

describe("relatório de desempate na tela", () => {
  it("lê a resposta de obter_desempate_da_lista gerada pelo Python", () => {
    const d = lerDesempateDaLista(DOURADO);
    expect(d).not.toBeNull();
    expect(d.listaId).toBe("lista-ficticia-final");
    expect(d.relatorio.versao).toBe(VERSAO_DO_RELATORIO);
    expect(d.relatorio.vagas.length).toBeGreaterThan(0);
    expect(d.grupos).toBe(
      d.relatorio.vagas.reduce((s, v) => s + v.grupos.length, 0),
    );
    expect(d.texto).toContain("RELATÓRIO DE DESEMPATE");
  });

  it("sem relatório, versão desconhecida ou resposta malformada: null (o botão não aparece)", () => {
    expect(lerDesempateDaLista(null)).toBeNull();
    expect(
      lerDesempateDaLista({
        ...DOURADO,
        relatorio: { ...DOURADO.relatorio, versao: 99 },
      }),
    ).toBeNull();
    const quebrado = structuredClone(DOURADO);
    quebrado.relatorio.vagas[0].grupos[0].candidatos[0] = { codigo: "x" };
    expect(lerDesempateDaLista(quebrado)).toBeNull();
    expect(lerDesempateDaLista({ ...DOURADO, lista_id: 5 })).toBeNull();
  });

  it("monta as planilhas Candidatos e Pares com o nome do retrato", () => {
    const d = lerDesempateDaLista(DOURADO);
    const primeiro = d.relatorio.vagas[0].grupos[0].candidatos[0];
    const nomes = new Map([[primeiro.analiseId, "Pessoa Fictícia"]]);
    const [candidatos, pares] = planilhasDoDesempate(d, nomes);
    expect(candidatos.nome).toBe("Candidatos");
    expect(candidatos.linhas[0]).toContain("Decidido por");
    expect(candidatos.linhas[0]).toContain("60+");
    expect(candidatos.linhas.flat()).toContain("Pessoa Fictícia");
    expect(pares.nome).toBe("Pares");
    const porIdade = pares.linhas.find((l) =>
      String(l[6]).includes("hora da certidão"),
    );
    expect(porIdade?.[5]).toBe("idade");
    expect(
      pares.linhas.some((l) => String(l[7]).includes("sorteio registrado")),
    ).toBe(true);
    expect(pares.linhas.some((l) => String(l[7]).includes("pendente"))).toBe(
      true,
    );
  });

  it("o valor de cada critério como texto, sem data de nascimento", () => {
    expect(textoDoValor(true, "IDOSO_60")).toBe("sim");
    expect(textoDoValor(null, "EXP_SAUDE_INDIGENA")).toBe("sem dado");
    expect(textoDoValor(1500, "EXP_PROFISSIONAL_TEMPO")).toBe("1500 dias");
    expect(textoDoValor(2.5, "PONTUACAO_ETNICA")).toBe("2,50");
    expect(
      textoDoValor({ ordemDeIdade: 1, certidao: false }, "MAIOR_IDADE"),
    ).toBe("1º mais velho do grupo, sem certidão");
  });

  it("a página do PDF escapa o texto", () => {
    const d = lerDesempateDaLista({ ...DOURADO, texto: "<b>insc. 1</b>" });
    const html = paginaDoDesempate(d, "Relatório de desempate");
    expect(html).toContain("&lt;b&gt;insc. 1&lt;/b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("os nomes vêm do retrato da lista (geral e modalidades)", () => {
    const nomes = nomesDoRetrato({
      vagas: [
        {
          geral: [{ analise_id: "a", nome: "Ana Fictícia" }],
          listas: { PCD: [{ analise_id: "b", nome: "Bia Fictícia" }] },
        },
      ],
    });
    expect([...nomes]).toEqual([
      ["a", "Ana Fictícia"],
      ["b", "Bia Fictícia"],
    ]);
  });
});
