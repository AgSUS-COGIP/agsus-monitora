import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  documentoDosEspelhos,
  montarEspelho,
  paginaDoEspelho,
} from "../../src/lib/avaliacao-documental/espelho-de-nota.ts";
import {
  argumentosDaPagina,
  avisoDoTamanho,
  codigosSemEspelho,
  estimativaDosEspelhos,
  FICHAS_POR_PAGINA,
  lerCodigos,
  ordenarParaOsEspelhos,
} from "../../src/lib/avaliacao-documental/espelhos-em-massa.ts";
import {
  calcularFicha,
  declaradaDaFicha,
  regraDaFicha,
} from "../../src/lib/avaliacao-documental/ficha.ts";
import {
  entradaDoEspelho,
  espelhoDaFichaGravada,
} from "../../src/lib/avaliacao-documental/espelho-da-ficha-gravada.ts";
import { abrirEspelhosEmMassa } from "../../src/modulos/avaliacao-documental/ficha/espelho-de-nota.ts";
import {
  lerFichasDosEspelhos,
  montarEspelhosLidos,
  RPC_ESPELHOS_DE_NOTA,
} from "../../src/modulos/avaliacao-documental/espelhos-em-massa.tsx";

/*
  Espelhos de nota em massa: escolha, ordem, códigos sem espelho, a leitura em
  páginas e, principalmente, que cada espelho sai IGUAL ao do botão da ficha
  (a mesma montagem, com o lançamento enxuto que obter_espelhos_de_nota devolve).
*/

const f114 = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
    "utf8",
  ),
);
const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";
const DOCUMENTAL = { nota_minima: 15 };
const EDITAL = { rotulo: "114/2026", area: "projetos" };

const ELIMINADO = {
  nivel: "medio",
  modalidade: "AC",
  vaga: "182513",
  cargo: MOTORISTA,
  blocos: {
    IDENTIDADE: { situacao: "CONFORME", observacao: "RG antigo, legível." },
    ESCOLARIDADE: { situacao: "CONFORME" },
    REQUISITO_DO_CARGO: {
      situacao: "NAO_CONFORME",
      motivos: ["OUTRO"],
      motivo_livre: "CNH enviada cortada, sem a data de validade visível.",
    },
  },
  titulos: [],
  cursos: [{ nome: "Direção defensiva", horas: 60, aceito: true }],
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
      observacao: "Enviou os certificados num único PDF.",
    },
    EXPERIENCIA: { situacao: "CONFORME" },
  },
  titulos: [],
  cursos: [
    { nome: "Primeiros socorros", horas: 120, aceito: true },
    { nome: "Curso recusado", horas: 20, aceito: false, motivo: "Sem carga" },
  ],
  vinculos: [
    {
      empregador: "Transportes Exemplo",
      categoria: f114.regra.blocos.find((b) => b.tipo === "VINCULOS")
        .categorias[0].codigo,
      inicio: "2019-01-01",
      fim: "2024-12-31",
      aceito: true,
    },
  ],
  observacoes: "Candidato(a) atendeu a todos os requisitos.",
};

/* O que private."FC_LANCAMENTO_DO_ESPELHO" tira do lançamento (sem empregador nem nome de curso). */
function lancamentoEnxuto(l) {
  return {
    ...l,
    ...(Array.isArray(l.vinculos)
      ? { vinculos: l.vinculos.map(({ empregador: _e, ...v }) => v) }
      : {}),
    ...(Array.isArray(l.cursos)
      ? { cursos: l.cursos.map(({ nome: _n, ...c }) => c) }
      : {}),
  };
}

/* O espelho do botão da ficha (estado-da-ficha.ts + entradaDoEspelho). */
function espelhoIndividual(lancamento, ficha) {
  const regra = regraDaFicha(structuredClone(f114.regra), lancamento);
  const avaliacao = calcularFicha(regra, lancamento, DOCUMENTAL);
  const declarada = declaradaDaFicha(
    regra,
    f114.vagas["182528"].respostas,
    lancamento.nivel,
  );
  const espelho = montarEspelho(
    entradaDoEspelho(
      { regra, lancamento, avaliacao, declarada, dados: { edital: EDITAL } },
      {
        ...ficha,
        tp_resultado: avaliacao.resultado,
        nota_final: avaliacao.nota_final,
      },
    ),
  );
  return { espelho, avaliacao, declarada };
}

/* A linha de obter_espelhos_de_nota da mesma ficha (declarada como gravada na conclusão). */
function linhaDoBanco(lancamento, individual, extra = {}) {
  return {
    id: "f-1",
    codigo: "7001",
    nome: "Maria Exemplo",
    vaga: "182513",
    cargo: MOTORISTA,
    modalidade: "AC",
    posicao: 3,
    art: 40,
    resultado: individual.avaliacao.resultado,
    nota_final: individual.avaliacao.nota_final,
    regra: "r1:1",
    declarada: { ...individual.declarada.parciais },
    lancamento: lancamentoEnxuto(structuredClone(lancamento)),
    ...extra,
  };
}

const FICHA = {
  nome: "Maria Exemplo",
  codigo: "7001",
  modalidade: "AC",
  vaga: "182513",
  cargo: MOTORISTA,
  art: 40,
};

describe("a montagem é a mesma do espelho individual", () => {
  for (const [nome, lancamento] of [
    ["eliminado", ELIMINADO],
    ["com pontos", COM_PONTOS],
  ])
    it(`${nome}: espelho e página idênticos`, () => {
      const individual = espelhoIndividual(lancamento, FICHA);
      const emMassa = espelhoDaFichaGravada(
        linhaDoBanco(lancamento, individual),
        structuredClone(f114.regra),
        DOCUMENTAL,
        EDITAL,
      );
      expect(emMassa).toEqual(individual.espelho);
      expect(paginaDoEspelho(emMassa)).toBe(
        paginaDoEspelho(individual.espelho),
      );
    });

  it("a folha do documento em massa é a mesma da página individual", () => {
    const { espelho } = espelhoIndividual(COM_PONTOS, FICHA);
    const pagina = paginaDoEspelho(espelho);
    const folha = pagina.slice(
      pagina.indexOf('<div class="folha"'),
      pagina.lastIndexOf("</body>"),
    );
    const doc = documentoDosEspelhos([espelho, espelho, espelho]);
    expect(doc.split(folha)).toHaveLength(4);
    expect(doc.match(/<div class="folha"/g)).toHaveLength(3);
    // Um por página, sem o cabeçalho/rodapé do navegador.
    expect(doc).toContain(
      ".folha + .folha { break-before: page; page-break-before: always; }",
    );
    expect(doc).toContain("@page { size: A4; margin: 0; }");
    expect(doc).not.toContain("<script");
  });

  it("abrirEspelhosEmMassa manda um documento só para a impressão", () => {
    const { espelho } = espelhoIndividual(ELIMINADO, FICHA);
    const imprimir = vi.fn();
    abrirEspelhosEmMassa([espelho, espelho], {
      imprimir,
      cabecalho: () => "AGÊNCIA DE TESTE",
      titulo: "Espelhos de nota - vaga 182513",
    });
    expect(imprimir).toHaveBeenCalledTimes(1);
    const html = imprimir.mock.calls[0][0];
    expect(html).toContain("<title>Espelhos de nota - vaga 182513</title>");
    expect(html.match(/AGÊNCIA DE TESTE/g)).toHaveLength(2);
  });
});

describe("lerCodigos", () => {
  it("separa por vírgula, ponto e vírgula, espaço e linha, sem repetir, na ordem", () => {
    expect(lerCodigos("123, 456;789\n 123\r\n\t1011  ")).toEqual([
      "123",
      "456",
      "789",
      "1011",
    ]);
    expect(lerCodigos("")).toEqual([]);
    expect(lerCodigos(null)).toEqual([]);
  });
});

const f = (id, vaga, resultado, nota_final, nome, posicao = null) => ({
  id,
  codigo: id,
  nome,
  vaga,
  resultado,
  nota_final,
  posicao,
});

describe("ordenarParaOsEspelhos", () => {
  const fichas = [
    f("1", "182513", "INAPTO_REQUISITO", 0, "Zeca"),
    f("2", "182513", "APTO", 30, "Bia", 2),
    f("3", "182421", "APTO", 10, "Caio"),
    f("4", "182513", "APTO", 30, "Ana", 1),
    f("5", "182513", "INAPTO_NOTA", 12, "Davi"),
    f("6", "182513", "INAPTO_REQUISITO", 0, "Ágata"),
    f("7", "182513", "APTO", 45, "Rui"),
  ];

  it("por vaga; aptos pela nota (empate pela posição), inaptos pela nota, eliminados pelo nome", () => {
    expect(ordenarParaOsEspelhos(fichas).map((x) => x.id)).toEqual([
      "3",
      "7",
      "4",
      "2",
      "5",
      "6",
      "1",
    ]);
  });

  it("com a lista colada, a ordem colada", () => {
    expect(
      ordenarParaOsEspelhos(fichas, ["5", "1", "7"])
        .slice(0, 3)
        .map((x) => x.id),
    ).toEqual(["5", "1", "7"]);
  });

  it("não muda a lista recebida", () => {
    const copia = [...fichas];
    ordenarParaOsEspelhos(fichas);
    expect(fichas).toEqual(copia);
  });
});

describe("codigosSemEspelho", () => {
  it("separa os sem ficha no edital dos com ficha não concluída", () => {
    const r = codigosSemEspelho(
      ["1", "2", "3", "4"],
      [f("1", "v", "APTO", 1, "A")],
      [
        { codigo: 3, situacao: "EM_ANALISE" },
        { codigo: "4", situacao: "FORA_LOTE" },
      ],
    );
    expect(r.naoEncontrados).toEqual(["2"]);
    expect(r.naoConcluidos).toEqual([
      { codigo: "3", situacao: "em análise" },
      { codigo: "4", situacao: "fora do lote" },
    ]);
  });
});

describe("escolha, estimativa e aviso", () => {
  const fila = [
    { vaga: "1", ficha: { situacao: "CONCLUIDA", resultado: "APTO" } },
    { vaga: "1", ficha: { situacao: "CONCLUIDA", resultado: "INAPTO_NOTA" } },
    {
      vaga: "2",
      ficha: { situacao: "CONCLUIDA", resultado: "INAPTO_REQUISITO" },
    },
    { vaga: "2", ficha: { situacao: "EM_ANALISE" } },
    { vaga: "2", ficha: null },
  ];

  it("estima pelos concluídos da fila, por vaga e filtro", () => {
    const est = (e) => estimativaDosEspelhos(fila, e);
    expect(est({ modo: "filtro", vaga: "", filtro: "TODOS" })).toBe(3);
    expect(est({ modo: "filtro", vaga: "", filtro: "APTOS" })).toBe(1);
    expect(est({ modo: "filtro", vaga: "", filtro: "INAPTOS" })).toBe(2);
    expect(est({ modo: "filtro", vaga: "2", filtro: "TODOS" })).toBe(1);
    expect(est({ modo: "codigos", codigos: ["a", "b"] })).toBe(2);
  });

  it("argumentos: vaga e filtro, ou só os códigos", () => {
    expect(
      argumentosDaPagina(
        "e1",
        { modo: "filtro", vaga: "9", filtro: "APTOS" },
        null,
        [],
      ),
    ).toEqual({
      p_edital: "e1",
      p_vagas: ["9"],
      p_filtro: "APTOS",
      p_codigos: null,
      p_apos: null,
      p_limite: FICHAS_POR_PAGINA,
      p_regras: null,
    });
    expect(
      argumentosDaPagina("e1", { modo: "codigos", codigos: ["1"] }, "x", [
        "r:1",
      ]),
    ).toMatchObject({
      p_vagas: null,
      p_filtro: "TODOS",
      p_codigos: ["1"],
      p_apos: "x",
      p_regras: ["r:1"],
    });
    expect(FICHAS_POR_PAGINA).toBe(200);
  });

  it("avisa acima de 500", () => {
    expect(avisoDoTamanho(500)).toBe("");
    expect(avisoDoTamanho(1234)).toMatch(
      /^Vai gerar 1\.234 páginas; pode demorar/,
    );
  });
});

describe("leitura em páginas", () => {
  const individual = espelhoIndividual(COM_PONTOS, FICHA);
  const linha = (id, extra) =>
    linhaDoBanco(COM_PONTOS, individual, { id, ...extra });

  it("segue o proximo, manda as regras já lidas e junta tudo", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        edital: EDITAL,
        documental: DOCUMENTAL,
        regras: { "r1:1": structuredClone(f114.regra) },
        fichas: [linha("a", { codigo: "1", nome: "Bia" })],
        nao_concluidos: [{ codigo: "9", situacao: "PENDENTE" }],
        proximo: "a",
      })
      .mockResolvedValueOnce({
        edital: EDITAL,
        documental: DOCUMENTAL,
        regras: {},
        fichas: [linha("b", { codigo: "2", nome: "Ana" })],
        proximo: null,
      });
    const progresso = [];
    const lidas = await lerFichasDosEspelhos({
      rpc,
      editalId: "e1",
      escolha: { modo: "codigos", codigos: ["2", "1", "9", "8"] },
      aoProgredir: (n) => progresso.push(n),
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][0]).toBe(RPC_ESPELHOS_DE_NOTA);
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_apos: "a",
      p_regras: ["r1:1"],
    });
    expect(progresso).toEqual([1, 2]);
    const espelhos = montarEspelhosLidos(lidas, ["2", "1", "9", "8"]);
    expect(espelhos.map((e) => e.candidato)).toEqual(["Ana", "Bia"]);
    expect(espelhos[0].criterios).toEqual(individual.espelho.criterios);
    expect(
      codigosSemEspelho(
        ["2", "1", "9", "8"],
        lidas.fichas,
        lidas.naoConcluidos,
      ),
    ).toEqual({
      naoEncontrados: ["8"],
      naoConcluidos: [{ codigo: "9", situacao: "pendente" }],
    });
  });

  it("cancelar para depois da página em curso", async () => {
    let cancelado = false;
    const rpc = vi.fn(async () => {
      cancelado = true;
      return { fichas: [linha("a")], regras: {}, proximo: "a" };
    });
    const lidas = await lerFichasDosEspelhos({
      rpc,
      editalId: "e1",
      escolha: { modo: "filtro", vaga: "", filtro: "TODOS" },
      cancelado: () => cancelado,
    });
    expect(lidas).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
