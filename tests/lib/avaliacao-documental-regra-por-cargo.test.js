import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calcularFicha,
  composicaoDaNota,
  lancamentoInicial,
  pendenciasDaFicha,
  regraDaFicha,
} from "../../src/lib/avaliacao-documental/ficha.js";
import { calcularAvaliacao } from "../../src/lib/avaliacao-documental/pontuacao.js";
import { validarRegraAnalise } from "../../src/lib/avaliacao-documental/regra.js";
import {
  avisosDoTituloUnico,
  cargoCasa,
  diferencaDaVaga,
  diferencaNova,
  faltasDoCargo,
  lancadoComExtra,
  lancadoComRequisito,
  pontosDosExtras,
  regraDaVaga,
  resumoDaDiferenca,
  seletorDoCargo,
  textoDoCargo,
  validarPorCargo,
} from "../../src/lib/avaliacao-documental/regra-por-cargo.ts";

/*
  Diferenças por cargo da regra (regra-por-cargo.ts): quem vale para a vaga,
  a regra da vaga (cargo > nível > padrão), os extras e requisitos na ficha,
  o aviso do 8.2.7 e a validação. A conta com o 114/2026 está nos casos
  dourados ("por cargo: …"), que o Python também roda.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const REGRA = CASOS.regras["E114-POR-CARGO"];
const CORRECAO = readFileSync(
  "supabase/correcoes/20261013-edital-114-regra-por-cargo.sql",
  "utf8",
).replace(/\r\n/g, "\n");
const DOCUMENTAL = { nota_minima: 10, nota_minima_por_nivel: {} };
const bloco = (regra, codigo) => regra.blocos.find((b) => b.codigo === codigo);

describe("quem vale para a vaga", () => {
  it("compara o cargo sem acento e por palavras inteiras", () => {
    expect(
      textoDoCargo("CARGO 15: MOTORISTA - Categoria D (Nível Médio)"),
    ).toBe("cargo 15 motorista categoria d nivel medio");
    expect(cargoCasa("CARGO 15 MOTORISTA - Categoria D", "CARGO 15")).toBe(
      true,
    );
    expect(cargoCasa("CARGO 15 MOTORISTA - Categoria D", "CARGO 1")).toBe(
      false,
    );
    expect(cargoCasa("Técnico de Laboratório", "tecnico de laboratorio")).toBe(
      true,
    );
    expect(cargoCasa("", "CARGO 1")).toBe(false);
  });

  it("o código da vaga vale antes do nome do cargo", () => {
    expect(diferencaDaVaga(REGRA, { vaga: "182567" })?.codigo).toBe(
      "MOTORISTA_D",
    );
    // A vaga do cargo 14 com um nome de cargo 15: vale a vaga.
    expect(
      diferencaDaVaga(REGRA, { vaga: "182513", cargo: "CARGO 15" })?.codigo,
    ).toBe("MOTORISTA_B");
    expect(
      diferencaDaVaga(REGRA, { vaga: "1", cargo: "CARGO 1: QUÍMICO" })?.codigo,
    ).toBe("ANALISE_DA_AGUA");
    expect(diferencaDaVaga(REGRA, { vaga: "1", cargo: "Outro" })).toBeNull();
    expect(diferencaDaVaga({ blocos: [] }, { vaga: "182567" })).toBeNull();
  });

  it("o seletor curto de um cargo do quadro", () => {
    expect(
      seletorDoCargo("CARGO 15: MOTORISTA - Categoria D (Nível Médio)"),
    ).toBe("CARGO 15");
    expect(seletorDoCargo("Cargo nº 3 - Biólogo")).toBe("CARGO 3");
    expect(seletorDoCargo("Agente Indígena de Saúde (Nível Médio)")).toBe(
      "Agente Indígena de Saúde",
    );
  });
});

describe("a regra da vaga", () => {
  it("Motorista D: cursos com teto 15, faixas do médio e o UMCQA; o cargo vence o nível", () => {
    const r = regraDaVaga(REGRA, { vaga: "182528", nivel: "superior" });
    const cursos = bloco(r, "CURSOS");
    expect(cursos.teto).toBe(15);
    expect(cursos.faixas.map((f) => f.pontos)).toEqual([2, 4, 6]);
    expect(cursos.extras[0]).toMatchObject({ codigo: "UMCQA", pontos: 5 });
    expect(cursos.por_nivel).toBeUndefined();
    expect(r.cargo).toEqual({
      codigo: "MOTORISTA_D",
      rotulo: "Cargo 15 — Motorista categoria D",
    });
    const req = bloco(r, "REQUISITO_DO_CARGO");
    expect(req.requisitos.map((q) => q.codigo)).toEqual([
      "CNH_D",
      "DIRECAO_DEFENSIVA",
    ]);
    expect(req.motivos.find((m) => m.codigo === "CNH_D")).toEqual({
      codigo: "CNH_D",
      texto: "Não apresentou CNH categoria D vigente (Anexo I).",
      item_edital: "2 e Anexo I",
      efeito: "ELIMINA",
    });
    expect(bloco(r, "EXPERIENCIA").area).toMatch(/^Condução de veículos/);
    // Os blocos que o cargo não muda ficam iguais.
    expect(bloco(r, "FORMACAO")).toBe(bloco(REGRA, "FORMACAO"));
  });

  it("aplicar de novo não muda nada; sem diferença, a própria regra", () => {
    const uma = regraDaVaga(REGRA, { vaga: "182528", nivel: "medio" });
    expect(regraDaVaga(uma, { vaga: "182528", nivel: "medio" })).toBe(uma);
    expect(
      regraDaFicha(uma, { vaga: "182528", nivel: "medio" }).blocos,
    ).toEqual(uma.blocos);
    expect(regraDaVaga(REGRA, { vaga: "1", cargo: "Outro" })).toBe(REGRA);
  });

  it("teto null na diferença tira o teto", () => {
    const regra = {
      ...REGRA,
      por_cargo: [
        {
          codigo: "SEM_TETO",
          rotulo: "x",
          vagas: ["1"],
          blocos: { CURSOS: { teto: null } },
        },
      ],
    };
    expect(
      bloco(regraDaVaga(regra, { vaga: "1", nivel: "medio" }), "CURSOS").teto,
    ).toBeNull();
  });
});

describe("a ficha do Motorista D", () => {
  const base = () =>
    lancamentoInicial({
      regra: REGRA,
      respostas: {},
      modalidade: "AC",
      cargo: "CARGO 15: MOTORISTA - Categoria D (Nível Médio)",
      vaga: 182528,
      documental: DOCUMENTAL,
      gravado: { vaga: "999", cargo: "gravado antes", nivel: "medio" },
    });

  it("o lançamento leva a vaga e o cargo da ficha (o gravado não vence)", () => {
    const l = base();
    expect(l.vaga).toBe("182528");
    expect(l.cargo).toBe("CARGO 15: MOTORISTA - Categoria D (Nível Médio)");
  });

  it("composição com o teto do cargo (Cursos 0/15) e o UMCQA somando até o teto", () => {
    const l = base();
    l.blocos.CURSOS = { situacao: "CONFORME", edita_nota: true };
    const antes = composicaoDaNota(
      REGRA,
      l,
      calcularFicha(REGRA, l, DOCUMENTAL),
      null,
    );
    expect(antes.find((p) => p.parcial === "CURSOS")).toMatchObject({
      apurado: 0,
      teto: 15,
    });
    const com = {
      ...l,
      blocos: {
        ...l.blocos,
        CURSOS: lancadoComExtra(l.blocos.CURSOS, "UMCQA", true),
      },
    };
    com.cursos = [{ nome: "A", horas: 61, aceito: true }];
    expect(calcularFicha(REGRA, com, DOCUMENTAL).parciais.CURSOS).toBe(9);
    expect(
      pontosDosExtras(
        bloco(regraDaFicha(REGRA, com), "CURSOS"),
        com.blocos.CURSOS,
      ),
    ).toBe(5);
  });

  it("pede cada requisito do cargo e o extra na pontuação pelos itens", () => {
    const l = base();
    l.blocos.REQUISITO_DO_CARGO = { situacao: "CONFORME" };
    l.blocos.CURSOS = { situacao: "CONFORME", edita_nota: true };
    const faltas = pendenciasDaFicha(
      REGRA,
      l,
      calcularFicha(REGRA, l, DOCUMENTAL),
      null,
    )
      .filter((p) => ["requisito", "extra"].includes(p.tipo))
      .map((p) => [p.bloco, p.tipo]);
    expect(faltas).toEqual([
      ["REQUISITO_DO_CARGO", "requisito"],
      ["CURSOS", "extra"],
    ]);
    // Com a nota ajustada (Confere com o declarado), o extra não conta.
    expect(
      faltasDoCargo(bloco(regraDaFicha(REGRA, l), "CURSOS"), {
        situacao: "CONFORME",
        nota_ajustada: 10,
      }),
    ).toEqual([]);
  });

  it("um requisito Não confere vira o motivo que elimina", () => {
    const r = regraDaFicha(REGRA, base());
    const req = bloco(r, "REQUISITO_DO_CARGO");
    let lancado = lancadoComRequisito(req, {}, "CNH_D", true);
    expect(lancado).toMatchObject({ situacao: null, motivos: [] });
    lancado = lancadoComRequisito(req, lancado, "DIRECAO_DEFENSIVA", true);
    expect(lancado).toMatchObject({ situacao: "CONFORME", motivos: [] });
    lancado = lancadoComRequisito(req, lancado, "CNH_D", false);
    expect(lancado).toMatchObject({
      situacao: "NAO_CONFORME",
      motivos: ["CNH_D"],
    });
    const l = { ...base(), blocos: { REQUISITO_DO_CARGO: lancado } };
    const a = calcularAvaliacao(REGRA, l, { notaMinima: 10 });
    expect(a.resultado).toBe("INAPTO_REQUISITO");
    expect(a.eliminatorios[0]).toBe(
      "Item 2 e Anexo I: Não apresentou CNH categoria D vigente (Anexo I).",
    );
    // Outro motivo do bloco fica; desmarcar o requisito tira só o dele.
    const comOutro = { ...lancado, motivos: ["SEM_CNH", "CNH_D"] };
    expect(lancadoComRequisito(req, comOutro, "CNH_D", null)).toMatchObject({
      situacao: "NAO_CONFORME",
      motivos: ["SEM_CNH"],
    });
  });

  it("8.2.7: o curso de direção defensiva lançado para pontuar é avisado", () => {
    const l = base();
    l.blocos.REQUISITO_DO_CARGO = {
      situacao: "CONFORME",
      requisitos: { CNH_D: true, DIRECAO_DEFENSIVA: true },
    };
    const r = regraDaFicha(REGRA, l);
    const cursos = bloco(r, "CURSOS");
    const comNome = avisosDoTituloUnico(
      r,
      cursos,
      [{ nome: "Curso de Direção Defensiva", horas: 50 }],
      l,
    );
    expect(comNome).toHaveLength(1);
    expect(comNome[0].texto).toMatch(
      /^Item 8\.2\.7: "Curso de Direção Defensiva" parece ser o requisito "Curso de direção defensiva"/,
    );
    const semNome = avisosDoTituloUnico(
      r,
      cursos,
      [{ nome: "Mecânica", horas: 50 }],
      l,
    );
    expect(semNome.map((a) => a.texto)).toEqual([
      'Item 8.2.7: "Curso de direção defensiva" já valeu como requisito do cargo e não pontua aqui.',
    ]);
    expect(
      avisosDoTituloUnico(
        r,
        cursos,
        [{ nome: "Direção defensiva", aceito: false }],
        l,
      ),
    ).toEqual([]);
    expect(
      avisosDoTituloUnico(
        r,
        bloco(r, "FORMACAO"),
        [{ nome: "Direção defensiva" }],
        l,
      ),
    ).toEqual([]);
  });
});

describe("validação", () => {
  it("a regra do 114 com as diferenças é válida e é a mesma da correção", () => {
    expect(validarRegraAnalise(REGRA)).toEqual([]);
    const literal = CORRECAO.match(
      /\$por_cargo\$\n([\s\S]*?)\n\$por_cargo\$/,
    )[1];
    expect(JSON.parse(literal)).toEqual(REGRA.por_cargo);
  });

  it("recusa o que não faz sentido", () => {
    const erros = validarPorCargo({
      blocos: REGRA.blocos,
      por_cargo: [
        { codigo: "a", rotulo: "", vagas: ["x"], blocos: {} },
        {
          codigo: "B1",
          rotulo: "B",
          vagas: ["182528"],
          blocos: { COTA_PP: { teto: 1 } },
        },
        {
          codigo: "B2",
          rotulo: "C",
          vagas: ["182528"],
          cargos: [],
          blocos: {
            CURSOS: {
              teto: 200,
              extras: [{ codigo: "X", rotulo: "", pontos: -1 }],
            },
          },
        },
        { codigo: "B3", rotulo: "D", blocos: { EXPERIENCIA: { area: "" } } },
      ],
    });
    expect(erros).toEqual(
      expect.arrayContaining([
        "Diferença por cargo 1: código em maiúsculas (2 a 30, letras, dígitos, _).",
        "Diferença por cargo 1 (nome): obrigatório.",
        "Diferença por cargo 1: vagas com o código da Empregare (só dígitos, até 200).",
        "Diferença por cargo 1: diga o que muda em ao menos um bloco.",
        "Diferença por cargo 2 (B), COTA_PP: este tipo de bloco não muda por cargo.",
        "Diferença por cargo 3 (C): a vaga 182528 já está na diferença 2.",
        "Diferença por cargo 3 (C), CURSOS: teto entre 0 e 100.",
        "Diferença por cargo 3 (C), CURSOS, extra 1: código em maiúsculas (2 a 30, letras, dígitos, _).",
        "Diferença por cargo 4 (D): diga as vagas ou o cargo.",
        "Diferença por cargo 4 (D), EXPERIENCIA (área exigida): obrigatório.",
      ]),
    );
    expect(validarPorCargo({ blocos: [] })).toEqual([]);
  });

  it("uma diferença nova e o resumo de uma linha", () => {
    expect(diferencaNova([{ codigo: "CARGO_2" }])).toEqual({
      codigo: "CARGO_3",
      rotulo: "",
      vagas: [],
      cargos: [],
      blocos: {},
    });
    const motorista = REGRA.por_cargo.find((d) => d.codigo === "MOTORISTA_D");
    expect(resumoDaDiferenca(motorista, REGRA.blocos)).toBe(
      "Cursos de aperfeiçoamento na área da vaga: teto 15, 3 faixas, +1 extra · Requisito específico do cargo: 2 requisitos · Experiência na área: área exigida",
    );
  });
});

describe("resumo, comparação e o que falta para salvar", () => {
  it("o resumo de uma página traz as diferenças por cargo", async () => {
    const { resumoDaRegra } =
      await import("../../src/lib/avaliacao-documental/resumo-da-regra.ts");
    const secao = resumoDaRegra(REGRA).secoes.find(
      (s) => s.titulo === "Diferenças por cargo",
    );
    expect(secao.itens).toHaveLength(9);
    expect(secao.itens.at(-1)).toContain(
      "Cargo 15 — Motorista categoria D (CARGO 15; vagas 182528, 182567) — Cursos: 40 a 60 h: 2 pontos",
    );
    expect(secao.itens.at(-1)).toContain("+5 por Certificado de capacitação");
    expect(secao.itens.every((t) => !t.endsWith(".."))).toBe(true);
  });

  it("a comparação de versões diz cada diferença que entrou ou saiu", async () => {
    const { diferencasEntreRegras, fraseDaDiferenca } =
      await import("../../src/lib/avaliacao-documental/comparar-regras.ts");
    const sem = { ...REGRA };
    delete sem.por_cargo;
    expect(diferencasEntreRegras(sem, REGRA).map(fraseDaDiferenca)).toContain(
      'Entrou: Diferenças por cargo › diferença "Cargo 15 — Motorista categoria D"',
    );
    const outra = structuredClone(REGRA);
    outra.por_cargo.at(-1).blocos.CURSOS.teto = 14;
    expect(diferencasEntreRegras(REGRA, outra).map(fraseDaDiferenca)).toEqual([
      'Diferenças por cargo › diferença "Cargo 15 — Motorista categoria D" › blocos › CURSOS › teto: 15 → 14',
    ]);
    expect(diferencasEntreRegras(REGRA, sem).map(fraseDaDiferenca)).toContain(
      'Saiu: Diferenças por cargo › diferença "Cargos 1 a 4 — Análise da Água"',
    );
  });

  it("o erro de uma diferença leva ao passo 2, na seção", async () => {
    const { lugarDoErro } =
      await import("../../src/lib/avaliacao-documental/pendencias-do-salvar.ts");
    expect(
      lugarDoErro("Diferença por cargo 2 (B): diga as vagas ou o cargo."),
    ).toEqual({
      passo: "cardapio",
      alvo: "[data-tour='avd-diferencas-por-cargo']",
    });
  });
});
