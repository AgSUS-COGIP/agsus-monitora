import { describe, expect, it } from "vitest";
import {
  modeloDeReferencia,
  normalizarModelo,
} from "../src/lib/modelo-de-convocacao.js";
import {
  montarConvocacaoDaVaga,
  montarListaDeConvocacao,
  ordenarPorClassificacao,
  resumirConvocacao,
  sequenciaDeConvocacao,
} from "../src/lib/lista-convocacao-rules.js";

/*
  A MECÂNICA do cálculo: ordenação, sequência, preenchimento e agrupamento. As
  cláusulas de cada edital estão em `lista-convocacao-regras-do-edital.test.js`.
*/
const MODELO = normalizarModelo(modeloDeReferencia("lei-15142-2025"));

/*
  Candidatos falsos com o mínimo que o cálculo lê. A nota decresce com o índice
  para que a ordem geral seja a ordem de escrita — assim o esperado de cada
  teste se lê sem contas.
*/
let sequencial = 0;
const candidato = (nome, modalidade, extra = {}) => {
  sequencial += 1;
  return {
    candidato_id: `c${sequencial}`,
    nome,
    modalidade,
    nota: 100 - sequencial,
    classificacao: sequencial,
    cargo: "ENFERMEIRO",
    codigo_vaga: "VG-001",
    edital_id: "1",
    edital: "53/2025",
    lista_ativa: true,
    ...extra,
  };
};

const nomes = (linhas) => linhas.map((linha) => linha.candidato.nome);
const categorias = (linhas) => linhas.map((linha) => linha.categoria);
const convocar = (candidatos, quadro, modelo = MODELO) =>
  montarConvocacaoDaVaga({ candidatos, quadro, modelo });

describe("sequenciaDeConvocacao", () => {
  it("intercala a reserva entre as vagas de ampla", () => {
    expect(
      sequenciaDeConvocacao({ ampla: 2, pretos_pardos: 1 }, MODELO),
    ).toEqual(["ampla", "pretos_pardos", "ampla"]);
  });

  it("espalha cada categoria em vez de a empilhar no fim", () => {
    expect(
      sequenciaDeConvocacao({ ampla: 4, pretos_pardos: 2 }, MODELO),
    ).toEqual([
      "ampla",
      "pretos_pardos",
      "ampla",
      "ampla",
      "pretos_pardos",
      "ampla",
    ]);
  });

  it("devolve ciclo vazio quando a vaga não tem vaga imediata", () => {
    expect(sequenciaDeConvocacao({}, MODELO)).toEqual([]);
    expect(sequenciaDeConvocacao({ ampla: 0, pcd: 0 }, MODELO)).toEqual([]);
  });

  it("é estável: a mesma configuração dá sempre a mesma ordem", () => {
    const quadro = { ampla: 3, pretos_pardos: 1, quilombola: 1, pcd: 1 };
    expect(sequenciaDeConvocacao(quadro, MODELO)).toEqual(
      sequenciaDeConvocacao(quadro, MODELO),
    );
  });
});

describe("ordenarPorClassificacao", () => {
  /*
    O motivo de a nota mandar: a coluna `classificacao` do XLSX costuma vir por
    modalidade, e aí o 1º da ampla e o 1º da cota chegam ambos como "1".
  */
  it("usa a nota e não a classificação por modalidade", () => {
    const linhas = [
      { nome: "ANA", nota: 93.5, classificacao: 1 },
      { nome: "MARIA", nota: 95.5, classificacao: 1 },
      { nome: "CARLOS", nota: 92, classificacao: 2 },
      { nome: "JOÃO", nota: 94, classificacao: 1 },
    ];
    expect(ordenarPorClassificacao(linhas).map((linha) => linha.nome)).toEqual([
      "MARIA",
      "JOÃO",
      "ANA",
      "CARLOS",
    ]);
  });

  it("desempata nota igual pela classificação e depois pelo nome", () => {
    const linhas = [
      { nome: "ZILDA", nota: 90, classificacao: 2 },
      { nome: "BRUNO", nota: 90, classificacao: 1 },
      { nome: "ALICE", nota: 90, classificacao: 2 },
    ];
    expect(ordenarPorClassificacao(linhas).map((linha) => linha.nome)).toEqual([
      "BRUNO",
      "ALICE",
      "ZILDA",
    ]);
  });
});

describe("montarConvocacaoDaVaga", () => {
  it("chama pela sequência, e não pela classificação", () => {
    const { linhas } = convocar(
      [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("CARLOS", "Ampla Concorrência"),
        candidato("JOÃO", '" pretos e pardos"'),
      ],
      { ampla: 2, pretos_pardos: 1 },
    );
    expect(nomes(linhas)).toEqual(["MARIA", "JOÃO", "CARLOS"]);
    expect(categorias(linhas)).toEqual(["ampla", "pretos_pardos", "ampla"]);
  });

  /*
    A regra central: quem é chamado pela ampla não gasta a vaga da reserva. JOÃO
    tem a 1ª nota e entra pela ampla; a vaga de pretos e pardos continua de pé e
    cabe a PEDRO.
  */
  it("não gasta a vaga de reserva quando o cotista entra pela ampla", () => {
    const { linhas } = convocar(
      [
        candidato("JOÃO", '"Pretos e Pardos"'),
        candidato("MARIA", "Ampla Concorrência"),
        candidato("PEDRO", '"Pretos e Pardos"'),
      ],
      { ampla: 2, pretos_pardos: 1 },
    );
    expect(nomes(linhas)).toEqual(["JOÃO", "PEDRO", "MARIA"]);
    expect(categorias(linhas)).toEqual(["ampla", "pretos_pardos", "ampla"]);
  });

  it("pula desistente e documentação rejeitada sem gastar a vaga", () => {
    const resultado = convocar(
      [
        candidato("MARIA", "Ampla Concorrência", { status: "Desistente" }),
        candidato("CARLOS", "Ampla Concorrência"),
        candidato("PAULO", "Ampla Concorrência", {
          status: "Documentação Rejeitada",
        }),
        candidato("RITA", "Ampla Concorrência"),
      ],
      { ampla: 2 },
    );
    expect(nomes(resultado.linhas)).toEqual(["CARLOS", "RITA"]);
    expect(resultado.linhas.every((linha) => linha.imediata)).toBe(true);
    expect(nomes(resultado.foraDaFila)).toEqual(["MARIA", "PAULO"]);
  });

  it("mantém na fila quem está contratado ou em migração", () => {
    const { linhas, foraDaFila } = convocar(
      [
        candidato("MARIA", "Ampla Concorrência", { status: "Contratado" }),
        candidato("CARLOS", "Ampla Concorrência", { status: "Migração" }),
      ],
      { ampla: 2 },
    );
    expect(nomes(linhas)).toEqual(["MARIA", "CARLOS"]);
    expect(foraDaFila).toEqual([]);
  });

  it("segue o mesmo ciclo depois das vagas imediatas, para ordenar a reserva", () => {
    const { linhas, totalImediatas } = convocar(
      [
        candidato("A", "Ampla Concorrência"),
        candidato("B", "Ampla Concorrência"),
        candidato("C", '"Indígena"'),
        candidato("D", "Ampla Concorrência"),
      ],
      { ampla: 1, indigena: 1 },
    );
    expect(totalImediatas).toBe(2);
    expect(nomes(linhas)).toEqual(["A", "C", "B", "D"]);
    expect(linhas.map((linha) => linha.imediata)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("trata vaga sem vaga imediata como cadastro de reserva na ordem geral", () => {
    const { linhas, totalImediatas } = convocar(
      [candidato("A", '"Indígena"'), candidato("B", "Ampla Concorrência")],
      {},
    );
    expect(totalImediatas).toBe(0);
    expect(nomes(linhas)).toEqual(["A", "B"]);
    expect(linhas.every((linha) => !linha.imediata)).toBe(true);
  });

  it("sem proporcionalidade devolve a ordem de classificação, sem categorias", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("JOÃO", '"Pretos e Pardos"'),
        candidato("MARIA", "Ampla Concorrência"),
        candidato("PEDRO", '"Pretos e Pardos"'),
      ],
      quadro: { ampla: 2, pretos_pardos: 1 },
      modelo: MODELO,
      proporcionalidade: false,
    });
    expect(nomes(linhas)).toEqual(["JOÃO", "MARIA", "PEDRO"]);
    expect(categorias(linhas)).toEqual([null, null, null]);
  });

  it("não deixa candidato de fora nem o repete", () => {
    const { linhas } = convocar(
      [
        candidato("A", '"Indígena"'),
        candidato("B", '"Quilombola"'),
        candidato("C", "Ampla"),
        candidato("D", "PCD"),
        candidato("E", '"pretos e pardos"'),
        candidato("F", ""),
      ],
      { ampla: 1, pretos_pardos: 1, quilombola: 1, indigena: 1, pcd: 1 },
    );
    expect(linhas).toHaveLength(6);
    expect(new Set(nomes(linhas)).size).toBe(6);
  });
});

describe("montarListaDeConvocacao", () => {
  const configuracao =
    (quadro, modelo = MODELO) =>
    () => ({ quadro, modelo, proporcionalidade: true });

  it("separa uma convocação por vaga do edital", () => {
    const grupos = montarListaDeConvocacao(
      [
        candidato("A", "Ampla", { codigo_vaga: "VG-001", cargo: "ENFERMEIRO" }),
        candidato("B", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
        candidato("C", "Ampla", { codigo_vaga: "VG-001", cargo: "ENFERMEIRO" }),
      ],
      configuracao({ ampla: 1 }),
    );
    expect(grupos).toHaveLength(2);
    expect(grupos.map((grupo) => grupo.codigoVaga)).toEqual([
      "VG-001",
      "VG-002",
    ]);
    expect(grupos[0].linhas).toHaveLength(2);
  });

  /*
    Sub judice entra pela inclusão manual, que não pede código de vaga. Deixá-lo
    numa vaga só dele daria uma convocação de uma pessoa, à parte da do cargo.
  */
  it("anexa o sub judice sem código à única vaga do seu cargo", () => {
    const grupos = montarListaDeConvocacao(
      [
        candidato("A", "Ampla", { codigo_vaga: "VG-001", cargo: "ENFERMEIRO" }),
        candidato("SUB", null, {
          codigo_vaga: null,
          cargo: "ENFERMEIRO",
          sub_judice: true,
        }),
      ],
      configuracao({ ampla: 1 }),
    );
    expect(grupos).toHaveLength(1);
    expect(nomes(grupos[0].linhas)).toEqual(["A", "SUB"]);
  });

  it("aplica a configuração devolvida para cada vaga", () => {
    const grupos = montarListaDeConvocacao(
      [
        candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
        candidato("B", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
      ],
      (_edital, codigo) => ({
        quadro: codigo === "VG-001" ? { ampla: 1 } : {},
        modelo: MODELO,
        proporcionalidade: true,
      }),
    );
    const porCodigo = Object.fromEntries(
      grupos.map((grupo) => [grupo.codigoVaga, grupo]),
    );
    expect(porCodigo["VG-001"].totalImediatas).toBe(1);
    expect(porCodigo["VG-002"].totalImediatas).toBe(0);
  });
});

describe("resumirConvocacao", () => {
  it("conta vagas imediatas, reserva e quem saiu da fila", () => {
    const grupos = montarListaDeConvocacao(
      [
        candidato("A", "Ampla"),
        candidato("B", "Ampla"),
        candidato("C", "Ampla", { status: "Desistente" }),
      ],
      () => ({ quadro: { ampla: 1 }, modelo: MODELO, proporcionalidade: true }),
    );
    expect(resumirConvocacao(grupos)).toMatchObject({
      vagas: 1,
      imediatas: 1,
      convocaveis: 1,
      reserva: 1,
      foraDaFila: 1,
    });
  });
});

/*
  FIM DE FILA — o candidato que, convocado, pede posicionamento no final da
  lista em vez de desistir (edital FCC 125, item 13.7).

  É o oposto de Desistente, e a diferença é o ponto: continua na fila, e em
  todas as filas em que estava, só que depois de todos os outros.
*/
describe("status Fim de Fila", () => {
  it("manda para o fim da ordem geral, sem sair dela", () => {
    const { linhas, foraDaFila } = convocar(
      [
        candidato("ANA", "Ampla", { status: "Fim de Fila" }),
        candidato("BRUNO", "Ampla"),
        candidato("CARLA", "Ampla"),
      ],
      { ampla: 3 },
    );
    expect(nomes(linhas)).toEqual(["BRUNO", "CARLA", "ANA"]);
    // Não é desistência: continua numerada e ocupando vaga.
    expect(foraDaFila).toEqual([]);
    expect(linhas.at(-1).posicao).toBe(3);
    expect(linhas.at(-1).imediata).toBe(true);
  });

  /*
    A fila da cota é um recorte da ordem geral, então cair para o fim ali leva
    a pessoa para o fim da sua reserva também — sem código próprio para isso.
  */
  it("cai para o fim também dentro da própria reserva", () => {
    const { linhas } = convocar(
      [
        candidato("ANA", '"Pretos e Pardos"', { status: "Fim de Fila" }),
        candidato("BRUNO", "Ampla"),
        candidato("PEDRO", '"Pretos e Pardos"'),
      ],
      { ampla: 1, pretos_pardos: 1 },
    );
    const reservada = linhas.find(
      (linha) => linha.categoria === "pretos_pardos",
    );
    expect(reservada.candidato.nome).toBe("PEDRO");
    expect(nomes(linhas).at(-1)).toBe("ANA");
  });

  it("entre dois que pediram fim de fila, a ordem normal continua a valer", () => {
    const { linhas } = convocar(
      [
        candidato("ANA", "Ampla", { status: "Fim de Fila" }),
        candidato("BRUNO", "Ampla", { status: "Fim de Fila" }),
        candidato("CARLA", "Ampla"),
      ],
      { ampla: 3 },
    );
    // ANA tem nota maior que BRUNO, e mantém a frente entre os dois.
    expect(nomes(linhas)).toEqual(["CARLA", "ANA", "BRUNO"]);
  });

  it("desistente sai da fila; fim de fila não", () => {
    const { linhas, foraDaFila } = convocar(
      [
        candidato("ANA", "Ampla", { status: "Desistente" }),
        candidato("BRUNO", "Ampla", { status: "Fim de Fila" }),
        candidato("CARLA", "Ampla"),
      ],
      { ampla: 2 },
    );
    expect(nomes(foraDaFila)).toEqual(["ANA"]);
    expect(nomes(linhas)).toEqual(["CARLA", "BRUNO"]);
  });
});
