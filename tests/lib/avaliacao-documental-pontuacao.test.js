import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  anosMesesDias,
  calcularAvaliacao,
  diasDosIntervalos,
  faixaDoCurso,
  numeroDoParecer,
  preencherModelo,
} from "../../src/lib/avaliacao-documental/pontuacao.js";
import {
  calcularNotaDeclarada,
  colunaDaPergunta,
  divergeDaArt,
  lerArt,
} from "../../src/lib/avaliacao-documental/nota-declarada.js";

/*
  A conta da avaliação documental (src/lib/avaliacao-documental/). Os casos
  dourados ficam em tests/fixtures/avaliacao-documental/casos-de-pontuacao.json,
  para o banco (F4) e a base Python conferirem o mesmo número.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);

describe("casos dourados", () => {
  it.each(CASOS.casos.map((c) => [c.nome, c]))("%s", (_nome, caso) => {
    const r = calcularAvaliacao(
      CASOS.regras[caso.regra],
      caso.candidato,
      caso.opcoes,
    );
    expect(r.resultado).toBe(caso.esperado.resultado);
    expect(r.nota_final).toBe(caso.esperado.nota_final);
    expect(r.nota_apurada).toBe(caso.esperado.nota_apurada);
    expect(r.parciais).toEqual(caso.esperado.parciais);
    expect(r.eliminatorios).toEqual(caso.esperado.eliminatorios);
    expect(r.encaminhamentos).toEqual(caso.esperado.encaminhamentos);
    expect(r.parecer).toBe(caso.esperado.parecer);
    if (caso.esperado.experiencia)
      expect(r.experiencia).toMatchObject(caso.esperado.experiencia);
  });

  it.each(CASOS.nota_declarada.map((c) => [c.nome, c]))(
    "nota declarada: %s",
    (_nome, caso) => {
      expect(
        calcularNotaDeclarada(CASOS.regras[caso.regra], caso.respostas),
      ).toEqual(caso.esperado);
    },
  );
});

describe("AM-2.6: cada edital pontua com os seus pesos", () => {
  it("o mesmo indígena morador de aldeia vale 12 no 28/2026 e 14 no 100/2026", () => {
    const candidato = {
      nivel: "superior",
      indigena: true,
      mora_aldeia: true,
      aldeia_na_lista: true,
      vinculos: [
        { categoria: "SAUDE_GERAL", inicio: "2024-01-01", fim: "2024-12-31" },
        { categoria: "AREA", inicio: "2024-01-01", fim: "2024-12-31" },
      ],
    };
    expect(
      calcularAvaliacao(CASOS.regras["SI26-INTERIOR-SUL"], candidato).parciais
        .ETNICO,
    ).toBe(12);
    expect(
      calcularAvaliacao(CASOS.regras["SI26-100"], candidato).parciais.ETNICO,
    ).toBe(14);
  });

  it("mudar o peso na regra muda a nota (nada fixo no código)", () => {
    const regra = structuredClone(CASOS.regras["SI26-INTERIOR-SUL"]);
    regra.blocos.find((b) => b.codigo === "ETNICO").indigena = 9;
    regra.blocos.find((b) => b.codigo === "ETNICO").teto = null;
    const r = calcularAvaliacao(regra, {
      nivel: "superior",
      indigena: true,
      mora_aldeia: true,
      aldeia_na_lista: true,
      vinculos: [
        { categoria: "SAUDE_GERAL", inicio: "2024-01-01", fim: "2024-12-31" },
      ],
    });
    expect(r.parciais.ETNICO).toBe(14);
  });

  it("o modelo de Projetos não tem critério étnico", () => {
    const r = calcularAvaliacao(CASOS.regras["PROJ26-CURRICULAR"], {
      nivel: "superior",
      indigena: true,
      mora_aldeia: true,
    });
    expect(Object.keys(r.parciais)).not.toContain("ETNICO");
  });
});

describe("vínculos e tempo", () => {
  it("AM-10.1: sobreposição conta uma vez; dia seguinte emenda; sem unir, soma", () => {
    const intervalos = [
      { inicio: "2020-01-01", fim: "2020-01-31" },
      { inicio: "2020-01-15", fim: "2020-02-10" },
      { inicio: "2020-02-11", fim: "2020-02-20" },
    ];
    expect(diasDosIntervalos(intervalos)).toBe(51);
    expect(diasDosIntervalos(intervalos, { unir: false })).toBe(31 + 27 + 10);
    expect(diasDosIntervalos(intervalos, { limite: "2020-01-31" })).toBe(31);
  });

  it("datas inválidas ou fim antes do início não contam", () => {
    expect(
      diasDosIntervalos([
        { inicio: "2020-02-30", fim: "2020-03-10" },
        { inicio: "2020-05-10", fim: "2020-05-01" },
      ]),
    ).toBe(0);
  });

  it("AM-10.5: anos de 365, meses de 30", () => {
    expect(anosMesesDias(912)).toEqual({ anos: 2, meses: 6, dias: 2 });
    expect(anosMesesDias(0)).toEqual({ anos: 0, meses: 0, dias: 0 });
  });

  it("AM-10.2: 55 meses a 0,2 com teto 10 vale 10", () => {
    const regra = CASOS.regras["SI26-INTERIOR-SUL"];
    const r = calcularAvaliacao(regra, {
      nivel: "superior",
      vinculos: [
        { categoria: "SAUDE_GERAL", inicio: "2019-01-01", fim: "2023-07-24" },
      ],
    });
    expect(r.experiencia.meses).toBe(55);
    expect(r.parciais.EXPERIENCIA).toBe(10);
  });

  it("AM-10.6: indígena sem experiência e 800 h de estágio = 4 meses", () => {
    const r = calcularAvaliacao(CASOS.regras["SI26-INTERIOR-SUL"], {
      nivel: "superior",
      indigena: true,
      estagio_horas: 800,
    });
    expect(r.experiencia.meses_estagio).toBe(4);
    expect(r.parciais.EXPERIENCIA).toBe(0.8);
  });

  it("estágio não conta para quem já tem experiência", () => {
    const r = calcularAvaliacao(CASOS.regras["SI26-INTERIOR-SUL"], {
      nivel: "superior",
      indigena: true,
      estagio_horas: 800,
      vinculos: [
        { categoria: "SAUDE_GERAL", inicio: "2024-01-01", fim: "2024-03-31" },
      ],
    });
    expect(r.experiencia.meses_estagio).toBe(0);
    expect(r.experiencia.meses_considerados).toBe(3);
  });

  it("faixa do curso pela carga horária", () => {
    const faixas = CASOS.regras["PROJ26-CURRICULAR"].blocos.find(
      (b) => b.codigo === "CURSOS",
    ).faixas;
    expect(faixaDoCurso(faixas, 39)).toBeNull();
    expect(faixaDoCurso(faixas, 60).pontos).toBe(1);
    expect(faixaDoCurso(faixas, 61).pontos).toBe(2);
    expect(faixaDoCurso(faixas, 500).pontos).toBe(3);
  });
});

describe("blocos, efeitos e parecer", () => {
  const regra = CASOS.regras["SI26-100"];
  const base = {
    nivel: "superior",
    vinculos: [{ categoria: "AREA", inicio: "2020-01-01", fim: "2022-12-31" }],
  };

  it("AM-7.6: graduação não conforme com motivo elimina, nota 0 e o parecer lista o motivo", () => {
    const r = calcularAvaliacao(regra, {
      ...base,
      blocos: {
        GRADUACAO: { situacao: "NAO_CONFORME", motivos: ["DIPLOMA_SEM_VERSO"] },
      },
    });
    expect(r.resultado).toBe("INAPTO_REQUISITO");
    expect(r.nota_final).toBe(0);
    expect(r.parecer).toContain("INABILITADO(A)");
    expect(r.parecer).toContain("Item 8.11.2: Diploma sem o verso.");
  });

  it("AM-7.5: bloco de cota de outra modalidade não se aplica", () => {
    const r = calcularAvaliacao(regra, { ...base, modalidade: "AC" });
    expect(r.blocos.find((b) => b.codigo === "COTA_PP").situacao).toBe(
      "NAO_SE_APLICA",
    );
  });

  it("AM-7.7: PcD conforme encaminha à perícia; incompleta segue na ampla", () => {
    expect(
      calcularAvaliacao(regra, { ...base, modalidade: "PCD" }).encaminhamentos,
    ).toEqual(["ENCAMINHA_PERICIA"]);
    expect(
      calcularAvaliacao(regra, {
        ...base,
        modalidade: "PCD",
        blocos: { COTA_PCD: { situacao: "NAO_ENVIADO" } },
      }).encaminhamentos,
    ).toEqual(["SEGUE_AMPLA"]);
  });

  it("AM-8.2: motivo Aldeia fora tira só a aldeia; AM-8.3: Não conforme zera sem eliminar", () => {
    const indigena = {
      ...base,
      indigena: true,
      mora_aldeia: true,
      aldeia_na_lista: true,
    };
    expect(
      calcularAvaliacao(regra, {
        ...indigena,
        blocos: {
          ETNICO: { situacao: "NAO_CONFORME", motivos: ["ALDEIA_FORA"] },
        },
      }).parciais.ETNICO,
    ).toBe(8);
    const zerado = calcularAvaliacao(regra, {
      ...indigena,
      blocos: { ETNICO: { situacao: "NAO_CONFORME" } },
    });
    expect(zerado.parciais.ETNICO).toBe(0);
    expect(zerado.resultado).toBe("APTO");
  });

  it("AM-9.1: títulos não cumulativos valem o maior; recusado não conta", () => {
    const r = calcularAvaliacao(regra, {
      ...base,
      titulos: [
        { titulo: "ESPECIALIZACAO", aceito: true },
        { titulo: "MESTRADO", aceito: true },
        { titulo: "DOUTORADO", aceito: false },
      ],
    });
    expect(r.parciais.FORMACAO).toBe(2);
  });

  it("nota mínima por nível vale antes da geral", () => {
    const r = calcularAvaliacao(regra, base, {
      notaMinima: 1,
      notaMinimaPorNivel: { superior: 10 },
    });
    expect(r.nota_minima).toBe(10);
    expect(r.resultado).toBe("INAPTO_NOTA");
    expect(r.parecer).toContain("nota mínima de 10,00 pontos (item 8.5)");
  });

  it("motivo livre e observações entram no parecer", () => {
    const r = calcularAvaliacao(regra, {
      ...base,
      blocos: {
        EXPERIENCIA: {
          situacao: "NAO_CONFORME",
          motivos: ["SEM_DATA_TERMINO"],
          motivo_livre: "Declaração sem carimbo do órgão.",
        },
      },
      observacoes_prontas: ["EXP_DIMINUIDA"],
      observacoes: "Conferido na Empregare.",
    });
    expect(r.observacoes).toEqual([
      "Item 8.14 a: Vínculo sem data de término.",
      "Item 8.14: Declaração sem carimbo do órgão.",
      "Nota de experiência profissional diminuída em decorrência do tempo de serviço comprovado pelo candidato(a).",
      "Conferido na Empregare.",
    ]);
    expect(r.parecer).toContain("Observações da análise:\n- Item 8.14 a");
  });

  it("modelo do parecer: campo desconhecido fica; número com vírgula", () => {
    expect(preencherModelo("{nota} e {outro}", { nota: "1,0" })).toBe(
      "1,0 e {outro}",
    );
    expect(numeroDoParecer(7.25, 1)).toBe("7,3");
    expect(numeroDoParecer(12, 2)).toBe("12,00");
  });
});

describe("nota declarada e ART", () => {
  it("acha a pergunta pelo começo do nome, sem acento nem caixa; P1 não casa com P15", () => {
    const respostas = {
      "Pergunta 15 - Formação": "x",
      "PERGUNTA 1 - Identidade": "Anexo",
    };
    expect(colunaDaPergunta(respostas, "pergunta 1 -")).toBe(
      "PERGUNTA 1 - Identidade",
    );
    expect(colunaDaPergunta(respostas, "Pergunta 15 -")).toBe(
      "Pergunta 15 - Formação",
    );
    expect(colunaDaPergunta(respostas, "Pergunta 2 -")).toBeNull();
  });

  it("faixa em meses × pontos por mês, com teto", () => {
    const regra = {
      provisoria: {
        nota_declarada: [
          {
            parcial: "EXPERIENCIA",
            pergunta: "Pergunta 17 -",
            tipo: "FAIXA_EM_MESES",
            meses: { "Acima de 60 meses": 61, "De 6 a 12 meses": 6 },
            pontos_por_mes: 0.2,
            teto: 10,
          },
        ],
      },
    };
    expect(
      calcularNotaDeclarada(regra, { "Pergunta 17 - Exp": "Acima de 60 meses" })
        .total,
    ).toBe(10);
    expect(
      calcularNotaDeclarada(regra, { "Pergunta 17 - Exp": "De 6 a 12 meses" })
        .total,
    ).toBe(1.2);
  });

  it("AM-4.3: ART lida do texto x/30 e divergência pela tolerância", () => {
    expect(lerArt("6,0/30,0")).toBe(6);
    expect(lerArt("12.5/30")).toBe(12.5);
    expect(lerArt("x/30")).toBeNull();
    expect(divergeDaArt(6, 6)).toBe(false);
    expect(divergeDaArt(6, 7)).toBe(true);
    expect(divergeDaArt(6, 7, 1)).toBe(false);
    expect(divergeDaArt(null, 7)).toBe(false);
  });
});
