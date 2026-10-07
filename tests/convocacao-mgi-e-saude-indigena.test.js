import { describe, expect, it } from "vitest";
import {
  modeloDeReferencia,
  normalizarModelo,
} from "../src/lib/modelo-de-convocacao.js";
import {
  derivarQuadro,
  montarConvocacaoDaVaga,
  sequenciaDeConvocacao,
} from "../src/lib/lista-convocacao-rules.js";
import {
  comDistribuicao,
  previaDaConvocacao,
  resumoDasRegrasDaCategoria,
} from "../src/lib/configuracao-de-convocacao.js";
import { LEI_15142_ESPALHADA } from "./modelos-de-convocacao-antigos.js";

/*
  A ordem do simulador de reserva de vagas do MGI e o modelo da Saúde Indígena
  (edital 91/2026, DSEI Alagoas e Sergipe), mais a prévia da ordem de chamada.
*/
const MGI = normalizarModelo(modeloDeReferencia("mgi-simulador"));
const SAUDE_INDIGENA = normalizarModelo(
  modeloDeReferencia("saude-indigena-91-2026"),
);
const SAUDE_INDIGENA_2026 = normalizarModelo(
  modeloDeReferencia("saude-indigena-2026"),
);
const SEM_TROCA = normalizarModelo(
  modeloDeReferencia("saude-indigena-2026-sem-troca"),
);
const CEBRASPE = normalizarModelo(modeloDeReferencia("cebraspe-lei-15142"));
const RESERVA_UNICA = normalizarModelo(
  modeloDeReferencia("lei-15142-reserva-unica"),
);

const posicoesDe = (sequencia, id) =>
  sequencia.flatMap((categoria, indice) =>
    categoria === id ? [indice + 1] : [],
  );

describe("ordem do simulador do MGI", () => {
  const candidato = (nome, modalidade, nota) => ({
    candidato_id: nome,
    nome,
    modalidade,
    nota,
    classificacao: 101 - nota,
    cargo: "ANALISTA",
    codigo_vaga: "VG-MGI",
    edital_id: "1",
    edital: "FGV",
    lista_ativa: true,
  });

  it("continua a série MGI no cadastro reserva quando há só 1 vaga imediata", () => {
    const { linhas, totalImediatas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("AC-1", "Ampla concorrência", 100),
        candidato("AC-2", "Ampla concorrência", 99),
        candidato("PP-1", "Pretos e pardos", 98),
        candidato("AC-3", "Ampla concorrência", 97),
        candidato("PCD-1", "PCD", 96),
        candidato("PP-2", "Pretos e pardos", 95),
        candidato("AC-4", "Ampla concorrência", 94),
        candidato("AC-5", "Ampla concorrência", 93),
      ],
      quadro: { ampla: 1 },
      modelo: MGI,
      proporcionalidade: true,
    });

    expect(totalImediatas).toBe(1);
    expect(linhas.map((linha) => linha.categoria)).toEqual([
      "ampla",
      "pretos_pardos",
      "ampla",
      "ampla",
      "pcd",
      "pretos_pardos",
      "ampla",
      "ampla",
    ]);
    expect(linhas.map((linha) => linha.imediata)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("aplica a série MGI também quando não há vaga imediata", () => {
    const { linhas, totalImediatas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("AC-1", "Ampla concorrência", 100),
        candidato("PP-1", "Pretos e pardos", 99),
        candidato("AC-2", "Ampla concorrência", 98),
        candidato("AC-3", "Ampla concorrência", 97),
        candidato("PCD-1", "PCD", 96),
        candidato("PP-2", "Pretos e pardos", 95),
      ],
      quadro: {},
      modelo: MGI,
      proporcionalidade: true,
    });

    expect(totalImediatas).toBe(0);
    expect(linhas.map((linha) => linha.categoria)).toEqual([
      "ampla",
      "pretos_pardos",
      "ampla",
      "ampla",
      "pcd",
      "pretos_pardos",
    ]);
    expect(linhas.every((linha) => !linha.imediata)).toBe(true);
  });

  it("segue a série MGI na reserva mesmo com os mínimos da FGV (2 racial, 5 PCD)", () => {
    const referencia = modeloDeReferencia("mgi-simulador");
    const FGV = normalizarModelo({
      ...referencia,
      categorias: referencia.categorias.map((categoria) =>
        categoria.id === "pcd"
          ? { ...categoria, minimo: 5 }
          : categoria.ampla
            ? categoria
            : { ...categoria, minimo: 2 },
      ),
    });
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("AC-1", "Ampla concorrência", 100),
        candidato("AC-2", "Ampla concorrência", 99),
        candidato("AC-3", "Ampla concorrência", 98),
        candidato("AC-4", "Ampla concorrência", 97),
        candidato("PP-1", "Pretos e pardos", 96),
        candidato("PCD-1", "PCD", 95),
        candidato("PP-2", "Pretos e pardos", 94),
      ],
      quadro: derivarQuadro(1, FGV),
      modelo: FGV,
      proporcionalidade: true,
    });

    expect(linhas.map((linha) => linha.candidato.nome)).toEqual([
      "AC-1",
      "PP-1",
      "AC-2",
      "AC-3",
      "PCD-1",
      "PP-2",
      "AC-4",
    ]);
  });

  it("nas imediatas respeita o quadro manual e na reserva segue a série", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("AC-1", "Ampla concorrência", 100),
        candidato("AC-2", "Ampla concorrência", 99),
        candidato("PP-1", "Pretos e pardos", 98),
        candidato("PP-2", "Pretos e pardos", 97),
      ],
      quadro: { pretos_pardos: 1 },
      modelo: MGI,
      proporcionalidade: true,
    });

    expect(linhas.map((linha) => linha.categoria)).toEqual([
      "pretos_pardos",
      "pretos_pardos",
      "ampla",
      "ampla",
    ]);
    expect(linhas[0].imediata).toBe(true);
  });

  /* A simulação de 100 vagas que o simulador publica (PcD 5, PN 25, PI 3, PQ 2). */
  it("reproduz posição por posição a simulação de 100 vagas", () => {
    const quadro = derivarQuadro(100, MGI);
    expect(quadro).toEqual({
      ampla: 65,
      pretos_pardos: 25,
      indigena: 3,
      quilombola: 2,
      pcd: 5,
    });
    const sequencia = sequenciaDeConvocacao(quadro, MGI);
    expect(posicoesDe(sequencia, "pcd")).toEqual([5, 21, 41, 61, 81]);
    expect(posicoesDe(sequencia, "pretos_pardos")).toEqual(
      Array.from({ length: 25 }, (_, k) => 2 + 4 * k),
    );
    // A 50ª é de pretos e pardos: a 2ª indígena fica com a livre anterior.
    expect(posicoesDe(sequencia, "indigena")).toEqual([17, 49, 84]);
    expect(posicoesDe(sequencia, "quilombola")).toEqual([25, 75]);
  });

  /* O passo vem do percentual, e não do total: 45 vagas continuam de 4 em 4. */
  it("numa vaga de 45, o 5º é PCD e pretos e pardos seguem de 4 em 4", () => {
    const quadro = {
      ampla: 30,
      pretos_pardos: 11,
      indigena: 1,
      quilombola: 1,
      pcd: 2,
    };
    const sequencia = sequenciaDeConvocacao(quadro, MGI);
    expect(sequencia).toHaveLength(45);
    expect(posicoesDe(sequencia, "pcd")).toEqual([5, 21]);
    expect(posicoesDe(sequencia, "pretos_pardos")).toEqual([
      2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42,
    ]);
    expect(posicoesDe(sequencia, "indigena")).toEqual([17]);
    expect(posicoesDe(sequencia, "quilombola")).toEqual([25]);
  });

  /*
    Em qualquer total, a 1ª PCD é a 5ª (STF), a 1ª indígena a 17ª e a 1ª
    quilombola a 25ª — quando o total chega a ter vaga para elas.
  */
  it("a 1ª PCD é sempre a 5ª, a 1ª indígena a 17ª e a 1ª quilombola a 25ª", () => {
    for (const modelo of [
      MGI,
      SAUDE_INDIGENA,
      SAUDE_INDIGENA_2026,
      SEM_TROCA,
      CEBRASPE,
    ])
      for (let total = 1; total <= 300; total += 1) {
        const quadro = derivarQuadro(total, modelo);
        const sequencia = sequenciaDeConvocacao(quadro, modelo);
        const primeira = (id) => posicoesDe(sequencia, id)[0] ?? null;
        expect(primeira("pcd")).toBe(quadro.pcd ? 5 : null);
        expect(primeira("indigena")).toBe(quadro.indigena ? 17 : null);
        expect(primeira("quilombola")).toBe(quadro.quilombola ? 25 : null);
        if (total < 17) expect(quadro.indigena).toBe(0);
        if (total < 25) expect(quadro.quilombola).toBe(0);
      }
  });

  /* Posição calculada além do total vai para a última livre. */
  it("cota que passaria do total fica na última posição livre", () => {
    const sequencia = sequenciaDeConvocacao({ ampla: 3, pcd: 1 }, MGI);
    expect(sequencia).toEqual(["ampla", "ampla", "ampla", "pcd"]);
  });

  it("trocar para a ordem do MGI dá à PCD a série 5ª, 21ª, de 20 em 20", () => {
    const antigo = normalizarModelo(LEI_15142_ESPALHADA);
    const pcd = comDistribuicao(antigo, "serie_mgi").categorias.find(
      (categoria) => categoria.id === "pcd",
    );
    expect(pcd.posicoes).toEqual([5, 21]);
    expect(pcd.intervalo).toBe(20);
    // Posições já informadas não são trocadas, e as outras cotas não mudam.
    const pp = comDistribuicao(antigo, "serie_mgi").categorias.find(
      (categoria) => categoria.id === "pretos_pardos",
    );
    expect(pp.posicoes).toEqual([]);
    expect(
      comDistribuicao(antigo, "proporcional").categorias.find(
        (categoria) => categoria.id === "pcd",
      ).posicoes,
    ).toEqual([]);
  });
});

describe("modelo da Saúde Indígena (91/2026)", () => {
  const categoria = (id) =>
    SAUDE_INDIGENA.categorias.find((item) => item.id === id);

  it("segue as cascatas do edital: PCD vazia vai para os indígenas", () => {
    expect(categoria("pcd").cascata).toEqual(["indigena"]); // 4.1.1
    expect(categoria("quilombola").cascata).toEqual([
      "indigena",
      "pretos_pardos",
    ]); // 5.2.1 e 5.2.3
    expect(categoria("indigena").cascata).toEqual([
      "quilombola",
      "pretos_pardos",
    ]); // 5.2.2 e 5.2.3
    expect(categoria("pretos_pardos").cascata).toEqual([]); // 5.2.4
  });

  it("PCD arredonda para cima até 20%, e cota racial só com 2 vagas ou mais", () => {
    expect(derivarQuadro(1, SAUDE_INDIGENA)).toMatchObject({
      ampla: 1,
      pretos_pardos: 0,
      pcd: 0,
    });
    // 5.3: com 2 vagas a reserva vale (25% de 2 = 0,5 sobe para 1).
    expect(derivarQuadro(2, SAUDE_INDIGENA).pretos_pardos).toBe(1);
    // 4.2: 5% de 4 subiria para 1, mas 20% de 4 é 0,8 — o limite corta.
    expect(derivarQuadro(4, SAUDE_INDIGENA).pcd).toBe(0);
    expect(derivarQuadro(5, SAUDE_INDIGENA).pcd).toBe(1);
  });

  /* 5.13: PCD soma com outra cota. */
  it("quem declara PCD e indígena guarda as duas reservas", () => {
    expect(SAUDE_INDIGENA.cotaMultipla).toBe("acumula_com_acumulavel");
    expect(categoria("pcd").acumulavel).toBe(true);
  });

  it("a PCD sem candidato vai para o próximo indígena, e não para a ampla", () => {
    const candidato = (nome, modalidade, nota) => ({
      candidato_id: nome,
      nome,
      modalidade,
      nota,
      cargo: "ENFERMEIRO",
      codigo_vaga: "VG-1",
      lista_ativa: true,
    });
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("ANA", "Ampla concorrência", 90),
        candidato("BIA", "Pretos e pardos", 85),
        candidato("CAU", "Ampla concorrência", 80),
        candidato("DUDA", "Ampla concorrência", 75),
        candidato("EDU", "Indígena", 60),
      ],
      quadro: { ampla: 3, pretos_pardos: 1, pcd: 1 },
      modelo: SAUDE_INDIGENA,
      proporcionalidade: true,
    });
    const quinta = linhas.find((linha) => linha.posicao === 5);
    expect(quinta?.candidato.nome).toBe("EDU");
  });
});

/*
  Editais 108/2026 (Alto Rio Negro), 112/2026 (Alto Rio Purus) e 117/2026
  (Xingu): a reserva é a mesma nos três. Difere do 91/2026 na PCD vazia (4.1.1)
  e em quem declara duas cotas (5.13).
*/
describe("modelo da Saúde Indígena (108, 112 e 117/2026)", () => {
  const categoria = (id) =>
    SAUDE_INDIGENA_2026.categorias.find((item) => item.id === id);
  const candidato = (nome, modalidade, nota) => ({
    candidato_id: nome,
    nome,
    modalidade,
    nota,
    cargo: "ENFERMEIRO",
    codigo_vaga: "VG-1",
    lista_ativa: true,
  });

  it("segue as cascatas do edital: PCD vazia vai para a ampla", () => {
    expect(categoria("pcd").cascata).toEqual([]); // 4.1.1
    expect(categoria("quilombola").cascata).toEqual([
      "indigena",
      "pretos_pardos",
    ]); // 5.2.1, 5.2.3 e 5.2.5
    expect(categoria("indigena").cascata).toEqual([
      "quilombola",
      "pretos_pardos",
    ]); // 5.2.2, 5.2.3 e 5.2.5
    expect(categoria("pretos_pardos").cascata).toEqual([]); // 5.2.4
  });

  it("quem declara duas cotas é classificado na de maior percentual", () => {
    expect(SAUDE_INDIGENA_2026.cotaMultipla).toBe("maior_percentual"); // 5.13.1
    expect(categoria("pcd").acumulavel).toBe(false);
  });

  it("reserva só com 2 vagas ou mais, e PCD até 20%", () => {
    expect(derivarQuadro(1, SAUDE_INDIGENA_2026)).toMatchObject({
      ampla: 1,
      pretos_pardos: 0,
      pcd: 0,
    }); // 5.3
    expect(derivarQuadro(2, SAUDE_INDIGENA_2026).pretos_pardos).toBe(1);
    expect(derivarQuadro(4, SAUDE_INDIGENA_2026).pcd).toBe(0); // 4.2
    expect(derivarQuadro(5, SAUDE_INDIGENA_2026).pcd).toBe(1);
  });

  it("a PCD sem candidato vai para o próximo da ampla, e não para o indígena", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("ANA", "Ampla concorrência", 90),
        candidato("BIA", "Pretos e pardos", 85),
        candidato("CAU", "Ampla concorrência", 80),
        candidato("DUDA", "Ampla concorrência", 75),
        candidato("EDU", "Indígena", 60),
        candidato("FABI", "Ampla concorrência", 55),
      ],
      quadro: { ampla: 3, pretos_pardos: 1, pcd: 1 },
      modelo: SAUDE_INDIGENA_2026,
      proporcionalidade: true,
    });
    const quinta = linhas.find((linha) => linha.posicao === 5);
    // EDU (60) tem nota maior que FABI (55): a vaga vai para a ampla, pela nota.
    expect(quinta?.candidato.nome).toBe("EDU");
    expect(quinta?.categoria).toBe("ampla");
  });
});

describe("prévia da ordem de chamada", () => {
  it("diz onde entra a 1ª vaga de cada cota", () => {
    const previa = previaDaConvocacao(45, MGI);
    expect(previa.vagas).toBe(45);
    expect(previa.posicoes[4]).toMatchObject({
      posicao: 5,
      sigla: "PCD",
      reserva: true,
    });
    const primeira = Object.fromEntries(
      previa.primeiras.map((item) => [item.sigla, item.posicao]),
    );
    expect(primeira).toEqual({ PP: 2, IND: 17, QUI: 25, PCD: 5 });
  });

  it("cota abaixo do mínimo aparece sem posição", () => {
    const previa = previaDaConvocacao(1, SAUDE_INDIGENA);
    expect(previa.posicoes).toHaveLength(1);
    expect(previa.primeiras.every((item) => item.posicao === null)).toBe(true);
  });

  it("resume as regras da cota numa frase", () => {
    const pcd = SAUDE_INDIGENA.categorias.find((item) => item.id === "pcd");
    expect(resumoDasRegrasDaCategoria(pcd)).toBe(
      "Arredonda sempre para cima · no máximo 20% das vagas · só com 2 vagas ou mais · posições 5ª, 21ª e depois de 20 em 20",
    );
    const pp = SAUDE_INDIGENA.categorias.find(
      (item) => item.id === "pretos_pardos",
    );
    expect(resumoDasRegrasDaCategoria(pp)).toBe(
      "Fração de 0,5 sobe · sem limite máximo · só com 2 vagas ou mais",
    );
  });
});

/* A leitura dos 109 editais da AgSUS (02/10/2026): os modelos que eles pedem. */
describe("modelos lidos dos editais", () => {
  const categoria = (modelo, id) =>
    modelo.categorias.find((item) => item.id === id);

  /* 34 e 39 a 70/2026: a reserva vazia vai direto para a ampla (5.10). */
  it("sem troca entre cotas: nenhuma cascata, reserva só com 2 vagas", () => {
    for (const id of ["pretos_pardos", "indigena", "quilombola", "pcd"])
      expect(categoria(SEM_TROCA, id).cascata).toEqual([]);
    expect(SEM_TROCA.cotaMultipla).toBe("maior_percentual");
    expect(derivarQuadro(1, SEM_TROCA).pretos_pardos).toBe(0);
    expect(derivarQuadro(2, SEM_TROCA).pretos_pardos).toBe(1);
    expect(derivarQuadro(4, SEM_TROCA).pcd).toBe(0);
  });

  /* 96/2025, 04/2026, 30/2026 e 93/2026: a fração de 0,5 sobe também na PCD. */
  it("padrão Cebraspe: PCD pela regra do 0,5, sem mínimo nem limite", () => {
    expect(derivarQuadro(9, CEBRASPE).pcd).toBe(0); // 0,45 desce
    expect(derivarQuadro(10, CEBRASPE).pcd).toBe(1); // 0,5 sobe
    expect(derivarQuadro(2, CEBRASPE).pretos_pardos).toBe(1);
    expect(categoria(CEBRASPE, "quilombola").cascata).toEqual([
      "indigena",
      "pretos_pardos",
    ]);
    expect(categoria(CEBRASPE, "pcd").cascata).toEqual([]);
  });

  /* Editais DSEI de 2025: 30% numa lista só; PCD sobe sempre, com 2 vagas ou mais. */
  it("reserva única: 30% numa lista e PCD arredondando para cima", () => {
    expect(derivarQuadro(1, RESERVA_UNICA)).toMatchObject({
      ampla: 1,
      ppiq: 0,
      pcd: 0,
    }); // 4.2 e 5.3
    expect(derivarQuadro(2, RESERVA_UNICA)).toMatchObject({
      ampla: 0,
      ppiq: 1,
      pcd: 1,
    }); // 5% de 2 = 0,1 sobe para 1; 30% de 2 = 0,6 sobe para 1
    expect(derivarQuadro(10, RESERVA_UNICA)).toMatchObject({
      ampla: 6,
      ppiq: 3,
      pcd: 1,
    });
    const sequencia = sequenciaDeConvocacao(
      derivarQuadro(10, RESERVA_UNICA),
      RESERVA_UNICA,
    );
    expect(posicoesDe(sequencia, "pcd")).toEqual([5]);
  });

  it("o catálogo tem um modelo para cada regra encontrada", () => {
    expect(
      [
        "mgi-simulador",
        "saude-indigena-2026",
        "saude-indigena-91-2026",
        "saude-indigena-2026-sem-troca",
        "cebraspe-lei-15142",
        "portaria-5801-trans",
        "lei-15142-reserva-unica",
        "etnico-racial-posicoes",
      ].every((id) => modeloDeReferencia(id)),
    ).toBe(true);
  });
});
