import { describe, expect, it } from "vitest";
import {
  modeloDeReferencia,
  normalizarModelo,
} from "../src/lib/modelo-de-convocacao.js";
import {
  arredondarVaga,
  derivarQuadro,
  montarConvocacaoDaVaga,
  reservasEfetivas,
  sequenciaDeConvocacao,
} from "../src/lib/lista-convocacao-rules.js";

/*
  AS CLÁUSULAS DOS EDITAIS, UMA A UMA.

  Cada teste afirma uma regra publicada, com o número do item ao lado, e é por
  aqui que se confere a implementação contra o PDF. Ficam à parte dos testes de
  mecânica (`lista-convocacao-rules.test.js`) porque servem a outro leitor: quem
  quer saber se o sistema obedece ao edital, não como o laço está escrito.

  Oito editais da AgSUS foram lidos. Cinco têm regras idênticas e cabem no
  primeiro modelo de referência; os outros três é que justificam o modelo ser
  configurável, e cada um deles tem o seu bloco aqui.
*/

const LEI_15142 = normalizarModelo(modeloDeReferencia("lei-15142-2025"));
const PORTARIA_5801 = normalizarModelo(
  modeloDeReferencia("portaria-5801-trans"),
);
const FCC_POSICOES = normalizarModelo(
  modeloDeReferencia("etnico-racial-posicoes"),
);

/*
  91/2026 não está no catálogo de referência porque é o caso singular: PCD com
  arredondamento e cascata próprios, mínimo de duas vagas e acumulação. Montá-lo
  aqui, a partir do modelo comum, mostra exatamente o que o edital muda.
*/
const EDITAL_91 = normalizarModelo({
  ...modeloDeReferencia("lei-15142-2025"),
  cotaMultipla: "acumula_com_acumulavel",
  categorias: modeloDeReferencia("lei-15142-2025").categorias.map(
    (categoria) => {
      if (categoria.ampla) return categoria;
      // Item 5.3: a reserva só se aplica havendo duas ou mais vagas.
      if (categoria.id === "pcd")
        return {
          ...categoria,
          arredondamento: "sempre_acima",
          teto: 20,
          minimo: 2,
          acumulavel: true,
          cascata: ["indigena"],
        };
      return { ...categoria, minimo: 2 };
    },
  ),
});

let sequencial = 0;
const candidato = (nome, modalidade, extra = {}) => {
  sequencial += 1;
  return {
    candidato_id: `c${sequencial}`,
    nome,
    modalidade,
    nota: 100 - sequencial,
    classificacao: sequencial,
    ...extra,
  };
};

const nomes = (linhas) => linhas.map((linha) => linha.candidato.nome);
const categorias = (linhas) => linhas.map((linha) => linha.categoria);
const posicoesDe = (ciclo, id) =>
  ciclo.map((c, i) => (c === id ? i + 1 : null)).filter(Boolean);

describe("arredondamento (96/2025 item 5.2.1.1; 91/2026 item 4.2)", () => {
  it("por omissão, fração de 0,5 sobe e abaixo disso desce", () => {
    expect(arredondarVaga(2.5)).toBe(3);
    expect(arredondarVaga(2.49)).toBe(2);
    expect(arredondarVaga(0.49)).toBe(0);
    expect(arredondarVaga(0)).toBe(0);
  });

  it("no modo do 91/2026, qualquer fração sobe", () => {
    expect(arredondarVaga(0.15, "sempre_acima")).toBe(1);
    expect(arredondarVaga(2.1, "sempre_acima")).toBe(3);
  });
});

describe("Lei 15.142/2025 — 96/2025, 30/2026, 93/2026, Cebraspe e FGV", () => {
  /* 25% negros, 3% indígenas, 2% quilombolas (5.2.1) e 5% PCD (5.1.1). */
  it("aplica os percentuais e deixa o resto para a ampla", () => {
    expect(derivarQuadro(10, LEI_15142)).toEqual({
      ampla: 6,
      pretos_pardos: 3,
      indigena: 0,
      quilombola: 0,
      pcd: 1,
    });
  });

  it("com poucas vagas, só a reserva maior alcança uma vaga", () => {
    expect(derivarQuadro(3, LEI_15142)).toMatchObject({
      ampla: 2,
      pretos_pardos: 1,
      pcd: 0,
    });
    expect(derivarQuadro(1, LEI_15142)).toMatchObject({
      ampla: 1,
      pretos_pardos: 0,
    });
  });

  /*
    A cláusula mais importante do conjunto, e a que aparece em TODOS os editais
    lidos — com numeração diferente em cada um, o que a torna fácil de perder de
    vista: 5.2.3.1.3 no 96/2025, no 97/2025 e no Cebraspe; 5.7.15 no 30/2026;
    5.8.4 no 93/2026; 7.4.2 no da FGV.

    "Optantes pela reserva aprovados dentro do número de vagas oferecido para
    ampla concorrência NÃO serão computados para efeito de preenchimento das
    vagas reservadas."

    Por ser universal, é código e não configuração do modelo. E cai de graça do
    desenho: a vaga é uma posição na sequência, então ocupar uma posição de
    ampla deixa as de reserva intactas. JOÃO entra pela ampla e a vaga de negros
    passa a PEDRO.
  */
  it("não computa na reserva quem entrou pela ampla", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("JOÃO", '"Pretos e Pardos"'),
        candidato("MARIA", "Ampla Concorrência"),
        candidato("PEDRO", '"Pretos e Pardos"'),
      ],
      quadro: { ampla: 2, pretos_pardos: 1 },
      modelo: LEI_15142,
    });
    expect(nomes(linhas)).toEqual(["JOÃO", "PEDRO", "MARIA"]);
    expect(categorias(linhas)).toEqual(["ampla", "pretos_pardos", "ampla"]);
  });

  /* 5.2.3.2: quem concorre a mais de uma reserva vai só na de maior percentual. */
  it("põe o cotista múltiplo só na reserva de maior percentual", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("ANA", '"pretos e pardos" e "quilombola"'),
        candidato("BRUNO", "Ampla Concorrência"),
        candidato("CLARA", '"quilombola"'),
      ],
      quadro: { pretos_pardos: 1, quilombola: 1 },
      modelo: LEI_15142,
    });
    expect(nomes(linhas).slice(0, 2)).toEqual(["ANA", "CLARA"]);
    expect(categorias(linhas).slice(0, 2)).toEqual([
      "pretos_pardos",
      "quilombola",
    ]);
    expect(linhas[0].reservasEfetivas).toEqual(["pretos_pardos"]);
    // A tela continua a mostrar as duas reservas declaradas.
    expect(linhas[0].reservas).toEqual(["pretos_pardos", "quilombola"]);
  });

  /* 5.2.3.2.2: percentuais iguais, decide a melhor posição relativa. */
  it("com percentual empatado, vale a melhor posição relativa", () => {
    const empatado = normalizarModelo({
      ...modeloDeReferencia("lei-15142-2025"),
      categorias: modeloDeReferencia("lei-15142-2025").categorias.map(
        (categoria) =>
          categoria.id === "indigena"
            ? { ...categoria, percentual: 2 }
            : categoria,
      ),
    });
    const posicoes = new Map([
      ["quilombola", 3],
      ["indigena", 1],
    ]);
    expect(
      reservasEfetivas(["quilombola", "indigena"], empatado, posicoes),
    ).toEqual(["indigena"]);
  });

  /* 5.2.5.1: sem quilombolas, a vaga vai para os indígenas. */
  it("passa a vaga de quilombola para o indígena", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("IARA", '"Indígena"'),
      ],
      quadro: { quilombola: 1, ampla: 1 },
      modelo: LEI_15142,
    });
    const vaga = linhas.find((l) => l.categoriaReservada === "quilombola");
    expect(vaga.candidato.nome).toBe("IARA");
    expect(vaga.categoria).toBe("indigena");
  });

  /* 5.2.5.2: sem indígenas, a vaga vai para os quilombolas. */
  it("passa a vaga de indígena para o quilombola", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("JOANA", '"Quilombola"'),
      ],
      quadro: { indigena: 1, ampla: 1 },
      modelo: LEI_15142,
    });
    const vaga = linhas.find((l) => l.categoriaReservada === "indigena");
    expect(vaga.candidato.nome).toBe("JOANA");
    expect(vaga.categoria).toBe("quilombola");
  });

  /* 5.2.5.3: faltando os dois, vai para os negros e, por último, para a ampla. */
  it("faltando indígena e quilombola, a vaga vai para os negros", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("PEDRO", '"Pretos e Pardos"'),
      ],
      quadro: { quilombola: 1, ampla: 1 },
      modelo: LEI_15142,
    });
    const vaga = linhas.find((l) => l.categoriaReservada === "quilombola");
    expect(vaga.candidato.nome).toBe("PEDRO");
    expect(vaga.categoria).toBe("pretos_pardos");
  });

  it("sem nenhum cotista, a vaga reverte para a ampla", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("CARLOS", "Ampla Concorrência"),
      ],
      quadro: { quilombola: 1, ampla: 1 },
      modelo: LEI_15142,
    });
    expect(categorias(linhas)).toEqual(["ampla", "ampla"]);
    expect(linhas[1].categoriaReservada).toBe("quilombola");
  });

  /* A reserva de PCD não tem cascata própria neste modelo. */
  it("a reserva de PCD reverte direto para a ampla", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("IARA", '"Indígena"'),
      ],
      quadro: { pcd: 1, ampla: 1 },
      modelo: LEI_15142,
    });
    expect(linhas.find((l) => l.categoriaReservada === "pcd").categoria).toBe(
      "ampla",
    );
  });
});

describe("Portaria GM/MS 5.801/2024 — edital 97/2025", () => {
  /*
    O edital acrescenta uma reserva que nenhum outro tem (5.2.1 alínea d) e
    muda todos os percentuais: 30/5/5/5 e 10% de PCD.
  */
  it("reserva também para candidatos trans", () => {
    expect(derivarQuadro(20, PORTARIA_5801)).toEqual({
      ampla: 9,
      pretos_pardos: 6,
      indigena: 1,
      quilombola: 1,
      trans: 1,
      pcd: 2,
    });
  });

  it("chama o candidato trans pela reserva própria", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("LUA", "Pessoa Trans"),
      ],
      quadro: { ampla: 1, trans: 1 },
      modelo: PORTARIA_5801,
    });
    const vaga = linhas.find((l) => l.categoria === "trans");
    expect(vaga.candidato.nome).toBe("LUA");
    expect(vaga.categoriaReservada).toBeNull();
  });
});

describe("FCC 125 — posições publicadas no edital", () => {
  /*
    6.1.2: "aos candidatos de grupo étnico-racial serão destinadas... a 3ª, a
    8ª, a 13ª, a 18ª, a 23ª... seguindo intervalos de cinco vagas".
    5.2.2: PCD ocupa "a 5ª, 21ª, 41ª, 61ª, 81ª... de vinte em vinte".
  */
  it("põe a cota nas posições que o edital publica", () => {
    const quadro = derivarQuadro(25, FCC_POSICOES);
    const ciclo = sequenciaDeConvocacao(quadro, FCC_POSICOES);
    expect(posicoesDe(ciclo, "etnico_racial")).toEqual([3, 8, 13, 18, 23]);
    expect(posicoesDe(ciclo, "pcd")).toEqual([5]);
  });

  it("continua a série pelo intervalo do edital quando há vagas para tanto", () => {
    const ciclo = sequenciaDeConvocacao(
      { ampla: 95, pcd: 5, etnico_racial: 0 },
      FCC_POSICOES,
    );
    expect(posicoesDe(ciclo, "pcd")).toEqual([5, 21, 41, 61, 81]);
  });

  /* 6.1: negros e indígenas concorrem à MESMA reserva neste edital. */
  it("trata negros e indígenas como uma cota só", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("A", "Ampla"),
        candidato("B", "Ampla"),
        candidato("IARA", '"Indígena"'),
      ],
      quadro: { ampla: 2, etnico_racial: 1 },
      modelo: FCC_POSICOES,
    });
    const vaga = linhas.find((l) => l.categoria === "etnico_racial");
    expect(vaga.candidato.nome).toBe("IARA");
  });

  /* 6.1.3: esgotada a lista específica, passa-se à de ampla concorrência. */
  it("reverte para a ampla quando a lista específica se esgota", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [candidato("A", "Ampla"), candidato("B", "Ampla")],
      quadro: { ampla: 1, etnico_racial: 1 },
      modelo: FCC_POSICOES,
    });
    expect(categorias(linhas)).toEqual(["ampla", "ampla"]);
  });
});

describe("Edital 91/2026 — DSEI Alagoas e Sergipe", () => {
  /*
    5.3: a reserva só se aplica havendo duas ou mais vagas.

    O caso que isola o mínimo é o PCD: com 1 vaga, 5% dá 0,05, e o
    arredondamento "sempre para cima" deste edital levaria a 1. É o mínimo, e
    só ele, que o mantém em zero.
  */
  it("não aplica reserva abaixo do mínimo de vagas", () => {
    expect(derivarQuadro(1, EDITAL_91)).toMatchObject({
      ampla: 1,
      pretos_pardos: 0,
      pcd: 0,
    });
    expect(derivarQuadro(2, EDITAL_91)).toMatchObject({
      pretos_pardos: 1,
      pcd: 0,
    });
  });

  /*
    4.2: o PCD arredonda sempre para cima, "desde que a reserva não exceda o
    limite de 20% das vagas". Com 3 vagas, uma de PCD seria 33% — o teto corta.
    Com 5, uma é exatamente 20% e passa.
  */
  it("arredonda o PCD para cima, mas respeita o teto de 20%", () => {
    expect(derivarQuadro(3, EDITAL_91).pcd).toBe(0);
    expect(derivarQuadro(5, EDITAL_91).pcd).toBe(1);
  });

  /* 4.1.1: sem PCD, a vaga vai para as pessoas indígenas — e não para a ampla. */
  it("manda a vaga de PCD vazia para os indígenas", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("IARA", '"Indígena"'),
      ],
      quadro: { pcd: 1, ampla: 1 },
      modelo: EDITAL_91,
    });
    const vaga = linhas.find((l) => l.categoriaReservada === "pcd");
    expect(vaga.candidato.nome).toBe("IARA");
    expect(vaga.categoria).toBe("indigena");
  });

  /*
    5.13: pode concorrer em mais de uma reserva desde que uma delas seja a de
    PCD. Quem declara PCD e indígena guarda as DUAS — o que o modelo comum não
    faria.
  */
  it("deixa acumular a reserva de PCD com outra", () => {
    const efetivas = reservasEfetivas(
      ["pcd", "indigena"],
      EDITAL_91,
      new Map(),
    );
    expect(efetivas).toEqual(expect.arrayContaining(["pcd", "indigena"]));
    expect(efetivas).toHaveLength(2);
  });

  it("no modelo comum, a mesma pessoa ficaria só numa reserva", () => {
    expect(reservasEfetivas(["pcd", "indigena"], LEI_15142, new Map())).toEqual(
      ["pcd"],
    );
  });
});

/*
  RESERVA ÚNICA DE 30% — editais 65/2025 (DSEI Mato Grosso do Sul), 05/2026
  (MFC) e 63/2025.

  A mesma Lei 15.142/2025 dos outros, mas estes não publicam a repartição
  25/3/2: abrem UMA lista de reserva de 30% e chamam por ela. É a razão de as
  categorias serem dado — não há como escrever cinco delas no código e servir a
  um edital que tem duas.
*/
describe("Lei 15.142/2025 com reserva única — 65/2025, 05/2026 e 63/2025", () => {
  const RESERVA_UNICA = normalizarModelo(
    modeloDeReferencia("lei-15142-reserva-unica"),
  );

  it("reserva 30% numa cota só, e 5% para PCD", () => {
    expect(derivarQuadro(10, RESERVA_UNICA)).toEqual({
      ampla: 6,
      ppiq: 3,
      pcd: 1,
    });
  });

  it("põe pretos, quilombolas e indígenas na mesma fila", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("ANA", "Ampla"),
        candidato("BENTO", "Ampla"),
        candidato("IARA", '"Indígena"'),
        candidato("JOANA", '"Quilombola"'),
      ],
      quadro: { ampla: 2, ppiq: 2 },
      modelo: RESERVA_UNICA,
    });
    const reservadas = linhas.filter((linha) => linha.categoria === "ppiq");
    expect(nomes(reservadas)).toEqual(["IARA", "JOANA"]);
  });

  /* Sem repartição, não há cascata: a reserva vazia vai direto para a ampla. */
  it("reverte para a ampla quando a reserva única fica sem candidato", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [candidato("ANA", "Ampla"), candidato("BENTO", "Ampla")],
      quadro: { ampla: 1, ppiq: 1 },
      modelo: RESERVA_UNICA,
    });
    expect(categorias(linhas)).toEqual(["ampla", "ampla"]);
    expect(linhas[1].categoriaReservada).toBe("ppiq");
  });
});

/*
  EDITAL SEM RESERVA — 03/2025, DSEI Alto Rio Solimões.

  Não tem cota nenhuma: a ação afirmativa entra como PONTUAÇÃO na avaliação
  ("ser pessoa preta/parda ou pessoa com deficiência: 20 pontos"), e não como
  vaga reservada. Quando a lista chega aqui, a nota já embute isso e a
  convocação é a classificação pura.

  Vale como teste porque é o extremo do modelo configurável: zero reservas tem
  de sair uma ordem correta, e não um erro.
*/
describe("Edital sem reserva de vagas — 03/2025 Alto Rio Solimões", () => {
  const SEM_RESERVA = normalizarModelo({
    nome: "Sem reserva de vagas",
    categorias: [
      {
        id: "ampla",
        rotulo: "Ampla concorrência",
        sigla: "AC",
        ampla: true,
        termos: ["ampla*", "geral*"],
      },
    ],
  });

  it("dá todas as vagas imediatas à ampla", () => {
    expect(derivarQuadro(7, SEM_RESERVA)).toEqual({ ampla: 7 });
  });

  it("convoca pela classificação, mesmo quem declarou cota", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("ANA", "Ampla"),
        candidato("IARA", '"Indígena"'),
        candidato("BENTO", "Ampla"),
      ],
      quadro: derivarQuadro(3, SEM_RESERVA),
      modelo: SEM_RESERVA,
    });
    expect(nomes(linhas)).toEqual(["ANA", "IARA", "BENTO"]);
    expect(categorias(linhas)).toEqual(["ampla", "ampla", "ampla"]);
    expect(linhas.every((linha) => linha.categoriaReservada === null)).toBe(
      true,
    );
  });
});

/*
  105/2026 (DSEI Litoral Sul) e 110/2026 (DSEI Porto Velho) repetem o 91/2026
  em tudo — teto de 20% no PCD, mínimo de duas vagas, acumulação com PCD —
  MENOS num ponto: o item 4.1.1 manda a vaga de PCD vazia para a AMPLA, e não
  para os indígenas. Um campo de diferença entre dois editais quase gémeos, que
  é o argumento de a cascata ser configurável por categoria.
*/
describe("105/2026 e 110/2026 — o mesmo do 91/2026, menos a cascata do PCD", () => {
  const LITORAL_SUL = normalizarModelo({
    ...EDITAL_91,
    categorias: EDITAL_91.categorias.map((categoria) =>
      categoria.id === "pcd" ? { ...categoria, cascata: [] } : categoria,
    ),
  });

  it("manda a vaga de PCD vazia para a ampla", () => {
    const candidatos = [
      candidato("MARIA", "Ampla Concorrência"),
      candidato("IARA", '"Indígena"'),
    ];
    const naLitoral = montarConvocacaoDaVaga({
      candidatos,
      quadro: { pcd: 1, ampla: 1 },
      modelo: LITORAL_SUL,
    });
    expect(
      naLitoral.linhas.find((l) => l.categoriaReservada === "pcd").categoria,
    ).toBe("ampla");

    // O 91/2026, com a mesma gente, dá a vaga à indígena.
    const noNoventaEUm = montarConvocacaoDaVaga({
      candidatos,
      quadro: { pcd: 1, ampla: 1 },
      modelo: EDITAL_91,
    });
    expect(
      noNoventaEUm.linhas.find((l) => l.categoriaReservada === "pcd").categoria,
    ).toBe("indigena");
  });
});

/*
  EDITAL DA FGV — o que obrigou o mínimo a ser POR CATEGORIA.

  Mesmos percentuais da Lei 15.142/2025, mas com dois mínimos diferentes no
  mesmo edital: 6.5 exige CINCO vagas no cargo para haver reserva de PCD, e
  7.1.3 exige DUAS para as raciais. Um mínimo único no modelo não representaria
  isto — daria reserva de PCD numa vaga de três, contra o edital.

  E dois arredondamentos: 6.4 manda o PCD para o inteiro seguinte sempre
  (Decreto 9.508 §3), enquanto 7.1.1 aplica a regra dos 0,5 às raciais.
*/
describe("FGV — mínimos e arredondamentos diferentes no mesmo edital", () => {
  const FGV = normalizarModelo(modeloDeReferencia("fgv-minimos-por-cargo"));

  it("com 3 vagas, vale a reserva racial e não a de PCD", () => {
    expect(derivarQuadro(3, FGV)).toMatchObject({
      ampla: 2,
      pretos_pardos: 1,
      pcd: 0,
    });
  });

  it("a partir de 5 vagas, a reserva de PCD entra", () => {
    expect(derivarQuadro(4, FGV).pcd).toBe(0);
    expect(derivarQuadro(5, FGV).pcd).toBe(1);
  });

  /* 6.4: qualquer fração sobe. 5 x 5% = 0,25, e ainda assim dá uma vaga. */
  it("o PCD arredonda sempre para cima, ao contrário das raciais", () => {
    expect(derivarQuadro(5, FGV)).toMatchObject({
      pcd: 1,
      // 5 x 3% = 0,15 e 5 x 2% = 0,10 descem, pela regra dos 0,5.
      indigena: 0,
      quilombola: 0,
    });
  });

  it("com 1 vaga não há reserva nenhuma", () => {
    expect(derivarQuadro(1, FGV)).toMatchObject({
      ampla: 1,
      pretos_pardos: 0,
      pcd: 0,
    });
  });

  /* 7.13: a reserva vazia vai direto para a ampla — a FGV não tem cascata. */
  it("reverte direto para a ampla, sem cascata entre as cotas", () => {
    const { linhas } = montarConvocacaoDaVaga({
      candidatos: [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("IARA", '"Indígena"'),
      ],
      quadro: { quilombola: 1, ampla: 1 },
      modelo: FGV,
    });
    const vaga = linhas.find((l) => l.categoriaReservada === "quilombola");
    expect(vaga.categoria).toBe("ampla");
    /*
      IARA é indígena, e num modelo com cascata a vaga de quilombola teria ido
      para ela COMO indígena. Aqui vai como ampla, "preenchida pelas demais
      pessoas candidatas aprovadas, observada a ordem de classificação geral" —
      MARIA já tinha tomado a 1ª posição, também pela ampla.
    */
    expect(vaga.candidato.nome).toBe("IARA");
    expect(linhas[0].candidato.nome).toBe("MARIA");
  });
});
