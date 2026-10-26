import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { espelhoDaFichaGravada } from "../../src/lib/avaliacao-documental/espelho-da-ficha-gravada.ts";
import {
  calcularFicha,
  declaradaDaFicha,
  regraDaFicha,
} from "../../src/lib/avaliacao-documental/ficha.ts";
import {
  espelhoDoDetalhe,
  TEXTOS_DO_ESPELHO_NO_PAINEL,
} from "../../src/lib/espelho-do-painel-de-analises.ts";
import { mesclarDetalhe } from "../../src/lib/lista-do-painel-de-analises.ts";
import { GavetaDaAnalise } from "../../src/modulos/analises/gaveta.tsx";

/*
  A gaveta do Painel das análises com o espelho de nota (migration
  20261020150000: get_analise_detalhe_do_painel manda "espelho" na linha da
  ficha concluída). Os números e textos da gaveta têm de ser OS MESMOS do
  espelho de nota da mesma ficha (espelhoDaFichaGravada, a montagem dos
  espelhos em massa); a linha da planilha segue como antes.
*/

const f114 = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
    "utf8",
  ),
);
const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";
const DOCUMENTAL = { nota_minima: 15 };
const EDITAL = { id: "e-114", rotulo: "114/2026", area: "projetos" };

const ELIMINADO = {
  nivel: "medio",
  modalidade: "AC",
  vaga: "182513",
  cargo: MOTORISTA,
  blocos: {
    IDENTIDADE: { situacao: "CONFORME" },
    ESCOLARIDADE: { situacao: "CONFORME" },
    REQUISITO_DO_CARGO: {
      situacao: "NAO_CONFORME",
      motivos: ["OUTRO"],
      motivo_livre: "CNH enviada cortada, sem a data de validade visível.",
    },
  },
  titulos: [],
  cursos: [{ horas: 60, aceito: true }],
  vinculos: [],
};

const COM_PONTOS = {
  nivel: "medio",
  modalidade: "AC",
  vaga: "182513",
  cargo: MOTORISTA,
  blocos: {
    IDENTIDADE: { situacao: "CONFORME" },
    ESCOLARIDADE: { situacao: "CONFORME" },
    REQUISITO_DO_CARGO: { situacao: "CONFORME" },
    CURSOS: {
      situacao: "CONFORME",
      nota_ajustada: 1,
      justificativas: ["OUTRO"],
      motivo_livre: "Certificado de 40 h sem assinatura da instituição.",
    },
    EXPERIENCIA: { situacao: "CONFORME" },
  },
  titulos: [],
  cursos: [
    { horas: 120, aceito: true },
    { horas: 20, aceito: false, motivo: "Sem carga" },
  ],
  vinculos: [
    {
      categoria: f114.regra.blocos.find((b) => b.tipo === "VINCULOS")
        .categorias[0].codigo,
      inicio: "2019-01-01",
      fim: "2024-12-31",
      aceito: true,
    },
  ],
};

/** A ficha concluída como obter_espelhos_de_nota a devolve (com nome e código). */
function fichaDoBanco(lancamento) {
  const regra = regraDaFicha(structuredClone(f114.regra), lancamento);
  const avaliacao = calcularFicha(regra, lancamento, DOCUMENTAL);
  const declarada = declaradaDaFicha(
    regra,
    f114.vagas["182528"].respostas,
    lancamento.nivel,
  );
  return {
    id: "f-1",
    codigo: "7001",
    nome: "Maria Exemplo",
    vaga: "182513",
    cargo: MOTORISTA,
    modalidade: "AC",
    posicao: 3,
    art: 40,
    resultado: avaliacao.resultado,
    nota_final: avaliacao.nota_final,
    regra: "r1:1",
    declarada: { ...declarada.parciais },
    lancamento: structuredClone(lancamento),
  };
}

/** O "espelho" do detalhe (a mesma ficha, sem nome, código, cargo nem modalidade). */
function detalheComEspelho(ficha) {
  return {
    id: "a-1",
    area: "projetos",
    chave_natural: "monitora|e-114|c-1",
    analise: "Parecer da ficha.",
    nota_final_ajustada: ficha.nota_final,
    pontuacao_escolaridade: 0,
    pontuacao_cursos_aperfeicoamento: 1,
    pontuacao_experiencia_profissional: 20,
    espelho: {
      schema_version: 1,
      ficha: {
        id: ficha.id,
        vaga: ficha.vaga,
        art: ficha.art,
        resultado: ficha.resultado,
        nota_final: ficha.nota_final,
        regra: ficha.regra,
        declarada: ficha.declarada,
        lancamento: ficha.lancamento,
      },
      regra: structuredClone(f114.regra),
      documental: DOCUMENTAL,
      edital: EDITAL,
    },
  };
}

const LINHA = {
  __chave: "a-1",
  __busca: "",
  __buscaDaFila: "",
  id: "a-1",
  candidato: "Maria Exemplo",
  status_consolidado: "Aprovado",
  responsavel_analise: "Avaliadora",
  edital: "114/2026",
  codigo_vaga: "182513",
  etapa: "Análise curricular",
  modalidade_concorrencia: "Ampla concorrência",
};

let raiz;
let caixa;
afterEach(() => {
  act(() => raiz?.unmount());
  caixa?.remove();
  raiz = null;
});

function abrir(dados) {
  caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  act(() =>
    raiz.render(
      createElement(GavetaDaAnalise, {
        linha: { ...LINHA },
        detalhe: { situacao: "pronto", dados },
        area: "projetos",
        aoFechar() {},
        aoTentarDeNovo() {},
      }),
    ),
  );
  return document.getElementById("analisesGaveta");
}

const textos = (raizDaBusca, seletor) =>
  [...raizDaBusca.querySelectorAll(seletor)].map((n) => n.textContent.trim());
const kvs = (secao) =>
  [...secao.querySelectorAll(".ui-kv")].map((kv) => [
    kv.querySelector(".ui-kv-rotulo").textContent,
    kv.querySelector(".ui-kv-valor").textContent,
  ]);

describe("gaveta com a ficha do sistema", () => {
  const ficha = fichaDoBanco(COM_PONTOS);
  // O espelho de nota da mesma ficha (padrão do espelho e o da gaveta).
  const espelhoDeNota = espelhoDaFichaGravada(
    ficha,
    structuredClone(f114.regra),
    DOCUMENTAL,
    EDITAL,
  );

  it("declarada × após a análise × teto idênticos ao espelho de nota", () => {
    const gaveta = abrir(detalheComEspelho(ficha));
    const secao = gaveta.querySelector('[data-section="espelho"]');
    expect(secao).not.toBeNull();

    // Notas: os mesmos valores do espelho, com os rótulos da gaveta.
    expect(kvs(secao)).toEqual([
      ["Nota autodeclarada (antes da análise)", espelhoDeNota.notas[0].valor],
      ["Nota consolidada (após a análise)", espelhoDeNota.notas[1].valor],
    ]);

    // Critérios: as mesmas linhas, colunas e números do quadro do espelho.
    expect(textos(secao, "thead th")).toEqual([
      "Critério",
      "Declarada",
      "Após análise",
      "Teto",
    ]);
    const linhas = [...secao.querySelectorAll("tbody tr:not([data-nota])")].map(
      (tr) => textos(tr, "td"),
    );
    expect(linhas).toEqual(
      espelhoDeNota.criterios.map((c) => [
        c.rotulo,
        c.declarada,
        c.apurada,
        c.teto,
      ]),
    );
    expect(linhas.length).toBeGreaterThan(1);

    // As justificativas: só no critério que mudou, com o texto do espelho.
    const mudaram = espelhoDeNota.criterios.filter(
      (c) => c.declarada !== c.apurada,
    );
    expect(mudaram.length).toBeGreaterThan(0);
    expect(textos(secao, "tr[data-nota] li")).toEqual(
      mudaram.flatMap((c) => c.justificativas),
    );
    expect(textos(secao, "tr[data-mudou] td:first-child")).toEqual(
      mudaram.map((c) => c.rotulo),
    );
    expect(secao.textContent).toContain(
      "Certificado de 40 h sem assinatura da instituição.",
    );

    // Sem repetir a nota final e a pontuação por critério da linha.
    const rotulos = textos(gaveta, ".ui-kv-rotulo");
    expect(rotulos).not.toContain("Nota final");
    expect(rotulos).not.toContain("Escolaridade");
    expect(rotulos).not.toContain("Cursos");
    expect(rotulos).toContain("Modalidade");
    // Logo depois da situação.
    expect(textos(gaveta, ".ui-secao-topo span").slice(0, 2)).toEqual([
      "Situação da análise",
      "Nota antes e após a análise",
    ]);
  });

  it("espelhoDoDetalhe dá os mesmos números com os textos da gaveta", () => {
    const painel = espelhoDoDetalhe(detalheComEspelho(ficha));
    const comTextosDaGaveta = espelhoDaFichaGravada(
      ficha,
      structuredClone(f114.regra),
      DOCUMENTAL,
      EDITAL,
      TEXTOS_DO_ESPELHO_NO_PAINEL,
    );
    expect(painel.notas).toEqual(comTextosDaGaveta.notas);
    expect(painel.notas.map((n) => n.valor)).toEqual(
      espelhoDeNota.notas.map((n) => n.valor),
    );
    expect(
      painel.criterios.map(({ mudou: _m, justificativas: _j, ...c }) => c),
    ).toEqual(espelhoDeNota.criterios.map(({ justificativas: _j, ...c }) => c));
  });

  it("o espelho fica no detalhe: não vai para a linha", () => {
    const linha = { ...LINHA };
    mesclarDetalhe(linha, detalheComEspelho(ficha));
    expect(linha).not.toHaveProperty("espelho");
    expect(linha.analise).toBe("Parecer da ficha.");
  });
});

describe("linha da planilha", () => {
  it("sem espelho, a gaveta segue como antes (nota final e composição)", () => {
    const gaveta = abrir({
      id: "a-1",
      area: "projetos",
      chave_natural: "planilha|x",
      analise: "Parecer da planilha.",
      nota_final_ajustada: 42,
      pontuacao_escolaridade: 10,
      pontuacao_cursos_aperfeicoamento: 2,
      pontuacao_experiencia_profissional: 30,
      espelho: null,
    });
    expect(gaveta.querySelector('[data-section="espelho"]')).toBeNull();
    expect(gaveta.querySelector("table")).toBeNull();
    expect(kvs(gaveta.querySelector('[data-section="result"]'))).toEqual([
      ["Nota final", "42"],
      ["Modalidade", "Ampla concorrência"],
    ]);
    expect(kvs(gaveta.querySelector('[data-section="score"]'))).toEqual([
      ["Escolaridade", "10"],
      ["Cursos", "2"],
      ["Experiência profissional", "30"],
    ]);
  });

  it("espelho que não se monta: volta à gaveta de antes", () => {
    expect(espelhoDoDetalhe({ espelho: { ficha: {} } })).toBeNull();
    expect(espelhoDoDetalhe(null)).toBeNull();
  });
});

describe("eliminado", () => {
  const ficha = fichaDoBanco(ELIMINADO);
  const espelhoDeNota = espelhoDaFichaGravada(
    ficha,
    structuredClone(f114.regra),
    DOCUMENTAL,
    EDITAL,
  );

  it("sem a declarada nem critérios: só a consolidada (Não se aplica) e os motivos", () => {
    expect(espelhoDeNota.modelo).toBe("ELIMINADO");
    const gaveta = abrir(detalheComEspelho(ficha));
    const secao = gaveta.querySelector('[data-section="espelho"]');
    expect(kvs(secao)).toEqual([
      ["Nota consolidada (após a análise)", espelhoDeNota.notas[0].valor],
    ]);
    expect(espelhoDeNota.notas[0].valor).toMatch(/^Não se aplica/);
    expect(secao.textContent).not.toContain("Nota autodeclarada");
    expect(secao.querySelector("table")).toBeNull();
    expect(textos(secao, ".ui-lista-de-motivos li")).toEqual(
      espelhoDeNota.justificativas,
    );
    expect(secao.textContent).toContain("CNH enviada cortada");
  });
});
