import { describe, expect, it } from "vitest";
import {
  modeloDeReferencia,
  lerModalidade,
  lerTermos,
  modeloEmBranco,
  normalizarModelo,
  normalizarTexto,
} from "../src/lib/modelo-de-convocacao.js";

const padrao = normalizarModelo(modeloDeReferencia("lei-15142-2025"));
const comTrans = normalizarModelo(modeloDeReferencia("portaria-5801-trans"));
const etnicoRacial = normalizarModelo(modeloDeReferencia("etnico-racial-posicoes"));

const reservas = (valor, modelo = padrao) =>
  lerModalidade(valor, modelo).reservas;

describe("normalizarTexto", () => {
  it("tira acento, caixa e pontuação, deixando palavras", () => {
    expect(normalizarTexto('  "Ampla Concorrência" ')).toBe(
      "ampla concorrencia",
    );
    expect(normalizarTexto("PRETOS/PARDOS")).toBe("pretos pardos");
  });
});

describe("lerModalidade", () => {
  it("reconhece a ampla escrita das formas que chegam", () => {
    [
      "Ampla Concorrência",
      '"Ampla Concorrência"',
      " AMPLA ",
      "ac",
      "Geral",
    ].forEach((valor) => {
      expect(lerModalidade(valor, padrao).reconhecida).toBe(true);
      expect(reservas(valor)).toEqual([]);
    });
  });

  it("atravessa aspas, espaços e caixa", () => {
    expect(reservas(' " Indígena" ')).toEqual(["indigena"]);
    expect(reservas('"QUILOMBOLA"')).toEqual(["quilombola"]);
    expect(reservas("pessoa com deficiência")).toEqual(["pcd"]);
    expect(reservas("PcD")).toEqual(["pcd"]);
  });

  /*
    Dividir a célula por um separador era o caminho óbvio e está errado: " e "
    partiria "pretos e pardos" ao meio, e o separador varia de edital para
    edital. Os termos são testados contra a célula inteira.
  */
  it("não se deixa partir por 'pretos e pardos'", () => {
    expect(reservas("Pretos e Pardos")).toEqual(["pretos_pardos"]);
    expect(reservas('"pretos e pardos"')).toEqual(["pretos_pardos"]);
    expect(reservas("Pretos, Pardos")).toEqual(["pretos_pardos"]);
  });

  it("ignora o separador entre as cotas, seja ele qual for", () => {
    const duas = ["pretos_pardos", "quilombola"];
    expect(reservas('"pretos e pardos", "quilombola"')).toEqual(duas);
    expect(reservas('"pretos e pardos","quilombola"')).toEqual(duas);
    expect(reservas('" pretos e pardos" e "quilombola"')).toEqual(duas);
    expect(reservas("Pretos e Pardos; Quilombola")).toEqual(duas);
    expect(reservas("Pretos e Pardos / Quilombola")).toEqual(duas);
    expect(reservas("Ampla Concorrência, Pretos e Pardos, Quilombola")).toEqual(
      duas,
    );
  });

  it("marca como não reconhecida a célula vazia ou com termo inesperado", () => {
    expect(lerModalidade("", padrao).reconhecida).toBe(false);
    expect(lerModalidade(null, padrao).reconhecida).toBe(false);
    expect(lerModalidade("reserva técnica", padrao).reconhecida).toBe(false);
    expect(reservas("reserva técnica")).toEqual([]);
  });

  /*
    A razão de os termos serem dado e não código: o 97/2025 tem uma reserva que
    nenhum outro edital tem, e o da FCC junta duas numa só. Nenhum dos dois
    caberia num conjunto fixo de categorias.
  */
  it("reconhece a cota trans no modelo que a declara — e não no que não declara", () => {
    expect(reservas("Pessoa Trans", comTrans)).toEqual(["trans"]);
    expect(lerModalidade("Pessoa Trans", padrao).reconhecida).toBe(false);
  });

  it("junta negros e indígenas numa cota só no modelo da FCC", () => {
    expect(reservas('"Indígena"', etnicoRacial)).toEqual(["etnico_racial"]);
    expect(reservas('"Pretos e Pardos"', etnicoRacial)).toEqual([
      "etnico_racial",
    ]);
  });
});

describe("termos", () => {
  it("aceita lista ou texto separado por ponto e vírgula", () => {
    expect(lerTermos("preto*; pardo*")).toEqual(["preto*", "pardo*"]);
    expect(lerTermos(["preto*", "pardo*"])).toEqual(["preto*", "pardo*"]);
    expect(lerTermos("")).toEqual([]);
  });

  /*
    O asterisco é o que separa "casa com a palavra" de "casa com as flexões", e
    existe para quem configura não precisar de saber o que é uma regex.
  */
  it("o asterisco alcança as flexões; sem ele, só a palavra inteira", () => {
    const modelo = normalizarModelo({
      categorias: [
        {
          id: "ampla",
          rotulo: "Ampla",
          sigla: "AC",
          ampla: true,
          termos: ["ampla"],
        },
        {
          id: "teste",
          rotulo: "Teste",
          sigla: "T",
          percentual: 10,
          termos: ["preto*"],
        },
        {
          id: "curto",
          rotulo: "Curto",
          sigla: "C",
          percentual: 5,
          termos: ["ac"],
        },
      ],
    });
    expect(lerModalidade("pretos", modelo).reservas).toEqual(["teste"]);
    expect(lerModalidade("acesso", modelo).reservas).toEqual([]);
    expect(lerModalidade("ac", modelo).reservas).toEqual(["curto"]);
  });
});

describe("normalizarModelo", () => {
  it("garante exatamente uma categoria de ampla", () => {
    const semAmpla = normalizarModelo({
      categorias: [{ id: "pcd", rotulo: "PCD", sigla: "PCD", percentual: 5 }],
    });
    expect(semAmpla.categorias.filter((c) => c.ampla)).toHaveLength(1);

    const duasAmplas = normalizarModelo({
      categorias: [
        { id: "a", rotulo: "A", sigla: "A", ampla: true },
        { id: "b", rotulo: "B", sigla: "B", ampla: true },
      ],
    });
    expect(duasAmplas.categorias.filter((c) => c.ampla)).toHaveLength(1);
  });

  it("zera o percentual da ampla, que é o resto e não uma fatia", () => {
    const modelo = normalizarModelo({
      categorias: [
        { id: "ampla", rotulo: "A", sigla: "AC", ampla: true, percentual: 70 },
      ],
    });
    expect(modelo.categorias[0].percentual).toBe(0);
  });

  /* Cascata apontando para categoria apagada deixaria a vaga sem destino. */
  it("descarta cascata que aponta para categoria inexistente ou para si mesma", () => {
    const modelo = normalizarModelo({
      categorias: [
        { id: "ampla", rotulo: "A", sigla: "AC", ampla: true },
        {
          id: "quilombola",
          rotulo: "Q",
          sigla: "QUI",
          percentual: 2,
          cascata: ["indigena", "quilombola", "inexistente"],
        },
        { id: "indigena", rotulo: "I", sigla: "IND", percentual: 3 },
      ],
    });
    const quilombola = modelo.categorias.find((c) => c.id === "quilombola");
    expect(quilombola.cascata).toEqual(["indigena"]);
  });

  it("dá um modelo em branco utilizável, só com a ampla", () => {
    const modelo = modeloEmBranco();
    expect(modelo.categorias).toHaveLength(1);
    expect(modelo.categorias[0].ampla).toBe(true);
  });
});
