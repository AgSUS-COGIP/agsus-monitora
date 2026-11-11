// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  categoriaDoVinculo,
  lerRegimeEJornada,
  linhasPlanasDoResumo,
  montarResumoPorCargoEStatus,
  reconcilia,
  situacoesNaFila,
  type CandidatoDoResumo,
  type ContagemDoResumo,
} from "../../src/lib/resumo-por-cargo-e-status.ts";
import { normalizarModelo } from "../../src/lib/modelo-de-convocacao.ts";
import { quadroVazio } from "../../src/lib/lista-convocacao-rules.ts";

/*
  Dados fictícios. A fixture grande reproduz os SUBTOTAIS da imagem de
  referência da CORES (Edital 05/2026) com cargo e edital inventados: só para
  conferir a conta, nada disso fica no produto.
*/

const EDITAL = "ed-1";
const RESERVA = "Cadastro de reserva";

let proximoId = 1;
function vinculos(
  cargo: string,
  codigoVaga: string,
  modalidade: string,
  q: {
    contratado?: number;
    voluntaria?: number;
    tacita?: number;
    reserva?: number;
  },
  situacoes: Map<string, string>,
): CandidatoDoResumo[] {
  const linhas: CandidatoDoResumo[] = [];
  const mais = (
    n: number,
    extra: Partial<CandidatoDoResumo>,
    fila?: string,
  ) => {
    for (let i = 0; i < n; i += 1) {
      const id = `c-${proximoId++}`;
      if (fila) situacoes.set(id, fila);
      linhas.push({
        candidato_id: id,
        edital_id: EDITAL,
        edital: "Edital fictício 01/2099",
        cargo,
        codigo_vaga: codigoVaga,
        modalidade,
        lista_ativa: true,
        status: "",
        ...extra,
      });
    }
  };
  mais(q.contratado ?? 0, { status: "Contratado" }, "Já chamado");
  mais(q.voluntaria ?? 0, {
    status: "Desistente",
    desistencia_subtipo: "VOLUNTARIA",
  });
  mais(q.tacita ?? 0, { status: "Desistente", desistencia_subtipo: "TACITA" });
  mais(q.reserva ?? 0, {}, RESERVA);
  return linhas;
}

function fixtureDaImagem() {
  const situacoes = new Map<string, string>();
  const AC = "Ampla Concorrência";
  const PCD = "Exclusiva p/ PcD";
  const PPIQ = "Exclusiva p/ PPIQ";
  const cargo = (resto: string) => `Cargo Fictício (CF) - ${resto}`;
  const candidatos = [
    ...vinculos(
      cargo("Presencial - 40h"),
      "901",
      AC,
      { contratado: 3, voluntaria: 7, tacita: 1, reserva: 9 },
      situacoes,
    ),
    ...vinculos(
      cargo("Presencial - 40h"),
      "901",
      PCD,
      { reserva: 1 },
      situacoes,
    ),
    ...vinculos(
      cargo("Presencial - 40h"),
      "901",
      PPIQ,
      { contratado: 2, voluntaria: 2 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 20h"),
      "902",
      PCD,
      { contratado: 1, reserva: 26 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 20h"),
      "902",
      AC,
      { contratado: 7, voluntaria: 2, reserva: 943 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 20h"),
      "902",
      PPIQ,
      { contratado: 3, voluntaria: 2, reserva: 95 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 30h"),
      "903",
      PCD,
      { reserva: 3 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 30h"),
      "903",
      AC,
      { reserva: 78 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 30h"),
      "903",
      PPIQ,
      { reserva: 5 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 40h"),
      "904",
      PCD,
      { contratado: 3, reserva: 12 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 40h"),
      "904",
      AC,
      { contratado: 25, voluntaria: 6, reserva: 283 },
      situacoes,
    ),
    ...vinculos(
      cargo("Teletrabalho - 40h"),
      "904",
      PPIQ,
      { contratado: 13, voluntaria: 3, reserva: 37 },
      situacoes,
    ),
  ];
  return { candidatos, situacoes };
}

const numeros = (c: ContagemDoResumo) => [
  c.aprovados,
  c.contratado,
  c.desistenciaVoluntaria,
  c.desistenciaTacita,
  c.reserva,
];

describe("lerRegimeEJornada: regra explícita sobre o texto do cargo", () => {
  it("tira regime e jornada dos trechos separados por hífen", () => {
    expect(lerRegimeEJornada("Médico de Família - Teletrabalho - 20h")).toEqual(
      {
        cargoBase: "Médico de Família",
        regime: "Teletrabalho",
        jornada: "20h",
      },
    );
  });
  it("aceita meia-risca, 'horas', 'Híbrido' sem acento e ordem trocada", () => {
    expect(lerRegimeEJornada("Analista – 40 horas semanais – hibrido")).toEqual(
      {
        cargoBase: "Analista",
        regime: "Híbrido",
        jornada: "40h",
      },
    );
  });
  it("não arranca regime de dentro de um nome (só trecho inteiro)", () => {
    expect(lerRegimeEJornada("Apoio presencial ao DSEI")).toEqual({
      cargoBase: "Apoio presencial ao DSEI",
      regime: null,
      jornada: null,
    });
  });
  it("cargo vazio fica vazio, sem regime nem jornada", () => {
    expect(lerRegimeEJornada("")).toEqual({
      cargoBase: "",
      regime: null,
      jornada: null,
    });
  });
});

describe("categoriaDoVinculo", () => {
  const base: CandidatoDoResumo = { candidato_id: "x", status: "" };
  it("Contratado e Migração são contratados; Contratado em outra lista não", () => {
    expect(
      categoriaDoVinculo({ ...base, status: "Contratado" }, undefined)
        .categoria,
    ).toBe("contratado");
    expect(
      categoriaDoVinculo({ ...base, status: "Migração" }, undefined).categoria,
    ).toBe("contratado");
    expect(
      categoriaDoVinculo(
        { ...base, status: "Contratado", contratacao_situacao: "OUTRA_LISTA" },
        undefined,
      ),
    ).toEqual({ categoria: "outras", motivo: "contratadoEmOutraLista" });
  });
  it("desistência só ganha subtipo com registro explícito", () => {
    expect(
      categoriaDoVinculo({ ...base, status: "Desistente" }, RESERVA).categoria,
    ).toBe("desistenciaSemSubtipo");
    expect(
      categoriaDoVinculo(
        { ...base, status: "Desistente", desistencia_subtipo: "tacita" },
        undefined,
      ).categoria,
    ).toBe("desistenciaTacita");
  });
  it("reserva vem da fila, nunca de 'sem status'", () => {
    expect(categoriaDoVinculo(base, RESERVA).categoria).toBe("reserva");
    expect(categoriaDoVinculo(base, "A convocar")).toEqual({
      categoria: "outras",
      motivo: "aConvocar",
    });
    expect(categoriaDoVinculo(base, undefined)).toEqual({
      categoria: "outras",
      motivo: "naoClassificado",
    });
    expect(
      categoriaDoVinculo({ ...base, status: "Convocado" }, RESERVA),
    ).toEqual({
      categoria: "outras",
      motivo: "convocado",
    });
    expect(
      categoriaDoVinculo(
        { ...base, status: "Documentação Rejeitada" },
        undefined,
      ),
    ).toEqual({
      categoria: "outras",
      motivo: "documentacaoRejeitada",
    });
  });
});

describe("montarResumoPorCargoEStatus", () => {
  it("reproduz os subtotais e o total da imagem de referência", () => {
    const { candidatos, situacoes } = fixtureDaImagem();
    const resumo = montarResumoPorCargoEStatus({ candidatos, situacoes });
    expect(resumo.editais).toHaveLength(1);
    const grupos = resumo.editais[0]!.grupos;
    expect(grupos.map((g) => g.rotulo)).toEqual([
      "Cargo Fictício (CF) · Presencial · 40h",
      "Cargo Fictício (CF) · Teletrabalho · 20h",
      "Cargo Fictício (CF) · Teletrabalho · 30h",
      "Cargo Fictício (CF) · Teletrabalho · 40h",
    ]);
    expect(grupos.map((g) => numeros(g.subtotal))).toEqual([
      [25, 5, 9, 1, 10],
      [1079, 11, 4, 0, 1064],
      [86, 0, 0, 0, 86],
      [382, 41, 9, 0, 332],
    ]);
    expect(numeros(resumo.total)).toEqual([1572, 57, 22, 1, 1492]);
    expect(grupos.every((g) => g.linhas.length === 3)).toBe(true);
    expect(reconcilia(resumo.total)).toBe(true);
    expect(resumo.subtipoRegistrado).toBe(true);
    expect(resumo.faltas).toEqual({
      semRegime: 0,
      semJornada: 0,
      semCodigoDaVaga: 0,
      semModalidade: 0,
    });
  });

  it("vagas distintas do mesmo cargo e modalidade ficam em linhas separadas (A)", () => {
    const situacoes = new Map<string, string>();
    const candidatos = [
      ...vinculos(
        "Enfermeiro - Presencial - 40h",
        "11",
        "Ampla",
        { reserva: 2 },
        situacoes,
      ),
      ...vinculos(
        "Enfermeiro - Presencial - 40h",
        "12",
        "Ampla",
        { reserva: 3 },
        situacoes,
      ),
    ];
    const resumo = montarResumoPorCargoEStatus({ candidatos, situacoes });
    const grupo = resumo.editais[0]!.grupos[0]!;
    expect(
      grupo.linhas.map((l) => [l.codigoVaga, l.contagem.aprovados]),
    ).toEqual([
      ["11", 2],
      ["12", 3],
    ]);
    expect(grupo.subtotal.aprovados).toBe(5);
  });

  it("não conta duas vezes o mesmo vínculo nem junta pessoas por nome (C)", () => {
    const comum = {
      edital_id: EDITAL,
      cargo: "Agente - 40h",
      codigo_vaga: "1",
      modalidade: "AC",
      lista_ativa: true,
    };
    const candidatos: CandidatoDoResumo[] = [
      {
        ...comum,
        candidato_id: "a",
        nome: "Pessoa Fictícia",
        status: "Contratado",
      },
      {
        ...comum,
        candidato_id: "a",
        nome: "Pessoa Fictícia",
        status: "Contratado",
      },
      {
        ...comum,
        candidato_id: "b",
        nome: "Pessoa Fictícia",
        status: "Contratado",
      },
    ];
    const resumo = montarResumoPorCargoEStatus({
      candidatos,
      situacoes: new Map(),
    });
    expect(resumo.total.aprovados).toBe(2);
    expect(resumo.total.contratado).toBe(2);
  });

  it("cota e ampla da mesma pessoa: contratada por uma linha, a outra vai a Outras (C, E)", () => {
    const comum = {
      edital_id: EDITAL,
      cargo: "Agente - 40h",
      codigo_vaga: "1",
      lista_ativa: true,
    };
    const candidatos: CandidatoDoResumo[] = [
      { ...comum, candidato_id: "a1", modalidade: "AC", status: "Contratado" },
      {
        ...comum,
        candidato_id: "a2",
        modalidade: "PcD",
        status: "Contratado",
        contratacao_situacao: "OUTRA_LISTA",
      },
    ];
    const resumo = montarResumoPorCargoEStatus({
      candidatos,
      situacoes: new Map(),
    });
    expect(resumo.total.aprovados).toBe(2);
    expect(resumo.total.contratado).toBe(1);
    expect(resumo.total.motivos.contratadoEmOutraLista).toBe(1);
    expect(reconcilia(resumo.total)).toBe(true);
  });

  it("lista inativa fica fora e é contada à parte; Migração conta e vai à parte", () => {
    const comum = {
      edital_id: EDITAL,
      cargo: "Agente",
      codigo_vaga: "",
      modalidade: "",
      status: "",
    };
    const candidatos: CandidatoDoResumo[] = [
      { ...comum, candidato_id: "1", lista_ativa: false },
      {
        ...comum,
        candidato_id: "2",
        lista_ativa: true,
        status: "Migração",
        sub_judice: true,
      },
      { ...comum, candidato_id: "3", lista_ativa: true, status: "Desistente" },
    ];
    const resumo = montarResumoPorCargoEStatus({
      candidatos,
      situacoes: new Map(),
    });
    expect(resumo.foraDaListaAtiva).toBe(1);
    expect(resumo.total.aprovados).toBe(2);
    expect(resumo.total.contratado).toBe(1);
    expect(resumo.total.migracao).toBe(1);
    expect(resumo.total.subJudice).toBe(1);
    expect(resumo.total.desistenciaSemSubtipo).toBe(1);
    expect(resumo.subtipoRegistrado).toBe(false);
    expect(resumo.faltas).toEqual({
      semRegime: 2,
      semJornada: 2,
      semCodigoDaVaga: 2,
      semModalidade: 2,
    });
    expect(resumo.editais[0]!.grupos[0]!.rotulo).toBe(
      "Agente · Regime não informado · Jornada não informado",
    );
  });

  it("os ids de cada coluna abrem o mesmo recorte do número (F)", () => {
    const { candidatos, situacoes } = fixtureDaImagem();
    const resumo = montarResumoPorCargoEStatus({ candidatos, situacoes });
    for (const edital of resumo.editais)
      for (const grupo of edital.grupos) {
        expect(grupo.ids.reserva).toHaveLength(grupo.subtotal.reserva);
        for (const linha of grupo.linhas)
          expect(linha.ids.contratado).toHaveLength(linha.contagem.contratado);
      }
    expect(resumo.ids.aprovados).toHaveLength(resumo.total.aprovados);
  });

  it("linhas planas: vagas, subtotal por grupo, edital (com mais de um) e total", () => {
    const situacoes = new Map<string, string>();
    const candidatos = [
      ...vinculos("A - 20h", "1", "AC", { reserva: 1 }, situacoes),
      ...vinculos("A - 20h", "1", "AC", { reserva: 1 }, situacoes).map((c) => ({
        ...c,
        edital_id: "ed-2",
      })),
    ];
    const resumo = montarResumoPorCargoEStatus({
      candidatos,
      situacoes,
      rotulosDosEditais: new Map([
        [EDITAL, "Edital 01"],
        ["ed-2", "Edital 02"],
      ]),
    });
    expect(
      linhasPlanasDoResumo(resumo).map((l) => `${l.nivel}:${l.edital}`),
    ).toEqual([
      "Vaga:Edital 01",
      "Subtotal:Edital 01",
      "Edital:Edital 01",
      "Vaga:Edital 02",
      "Subtotal:Edital 02",
      "Edital:Edital 02",
      "Total:",
    ]);
  });
});

describe("situacoesNaFila: a mesma conta da aba Convocação", () => {
  it("sem vagas imediatas, quem não tem status fica no cadastro de reserva", () => {
    const modelo = normalizarModelo(null);
    const candidatos = [1, 2, 3].map((i) => ({
      candidato_id: String(i),
      edital_id: EDITAL,
      cargo: "Agente - 40h",
      codigo_vaga: "7",
      modalidade: "Ampla Concorrência",
      classificacao: i,
      nota: 10 - i,
      status: i === 1 ? "Contratado" : i === 2 ? "Desistente" : "",
      lista_ativa: true,
    }));
    const situacoes = situacoesNaFila(candidatos, () => ({
      proporcionalidade: true,
      quadro: quadroVazio(modelo),
      modelo,
    }));
    expect(situacoes.get("3")).toBe(RESERVA);
    expect(situacoes.get("2")).toBe("Fora da fila");
    expect(situacoes.get("1")).toBe("Já chamado");
  });
});
