import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ESPERA_DO_RELATORIO_MS,
  estadoDoRelatorio,
  lerDesempateDaLista,
  lerRespostaDoDesempate,
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

  it("monta as planilhas Candidatos e Pares com o nome e a inscrição do relatório", () => {
    const d = lerDesempateDaLista(DOURADO);
    const primeiro = d.relatorio.vagas[0].grupos[0].candidatos[0];
    expect(primeiro.nome).toBeTruthy();
    const [candidatos, pares] = planilhasDoDesempate(d);
    expect(candidatos.nome).toBe("Candidatos");
    expect(candidatos.linhas[0]).toContain("Decidido por");
    expect(candidatos.linhas[0]).toContain("60+");
    expect(candidatos.linhas.flat()).toContain(primeiro.nome);
    expect(candidatos.linhas.flat()).toContain(primeiro.codigo);
    expect(pares.linhas.flat()).toContain(primeiro.nome);
    expect(d.texto).toContain(`${primeiro.nome} (insc. ${primeiro.codigo})`);
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

  it("lê o preparo junto do relatório (migration 20261023170000)", () => {
    const pedido = "2026-10-23T14:00:00Z";
    const so = lerRespostaDoDesempate({
      lista_id: "l1",
      preparo: { situacao: "PEDIDO", pedido_em: pedido },
    });
    expect(so).toEqual({
      preparo: { situacao: "PEDIDO", pedidoEm: pedido },
      desempate: null,
    });
    const pronta = lerRespostaDoDesempate({
      ...DOURADO,
      preparo: { situacao: "PRONTO", pedido_em: pedido },
    });
    expect(pronta.preparo?.situacao).toBe("PRONTO");
    expect(pronta.desempate?.listaId).toBe("lista-ficticia-final");
    expect(lerRespostaDoDesempate(null)).toEqual({
      preparo: null,
      desempate: null,
    });
    expect(
      lerRespostaDoDesempate({ preparo: { situacao: "OUTRA" } }).preparo,
    ).toBeNull();
  });

  it("o estado do relatório: pronto, preparando (até a espera), não confere, falhou ou nada", () => {
    const agora = Date.parse("2026-10-23T14:05:00Z");
    const com = (situacao, pedidoEm = "2026-10-23T14:00:00Z") => ({
      preparo: { situacao, pedidoEm },
      desempate: null,
    });
    expect(estadoDoRelatorio(null, agora)).toBe("nada");
    expect(estadoDoRelatorio({ preparo: null, desempate: null }, agora)).toBe(
      "nada",
    );
    expect(
      estadoDoRelatorio(
        { ...com("PEDIDO"), desempate: lerDesempateDaLista(DOURADO) },
        agora,
      ),
    ).toBe("pronto");
    expect(estadoDoRelatorio(com("PEDIDO"), agora)).toBe("preparando");
    expect(estadoDoRelatorio(com("PREPARANDO"), agora)).toBe("preparando");
    const velho = new Date(agora - ESPERA_DO_RELATORIO_MS).toISOString();
    expect(estadoDoRelatorio(com("PEDIDO", velho), agora)).toBe("falhou");
    expect(estadoDoRelatorio(com("NAO_CONFERE"), agora)).toBe("nao_confere");
    expect(estadoDoRelatorio(com("FALHOU"), agora)).toBe("falhou");
    expect(estadoDoRelatorio(com("SEM_DISPARO"), agora)).toBe("falhou");
    expect(estadoDoRelatorio(com("DESLIGADA"), agora)).toBe("nada");
    // Relatório lido mas preparo sem relatório legível (versão nova): nada.
    expect(estadoDoRelatorio(com("PRONTO"), agora)).toBe("nada");
  });
});
