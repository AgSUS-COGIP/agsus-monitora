import { describe, expect, it } from "vitest";
import {
  chaveDaLocalidade,
  localidadeDoCargo,
  naLocalidade,
  opcoesDeLocalidade,
} from "../../src/lib/aprovados/localidade-da-vaga.ts";
import { filterApprovedCandidates } from "../../src/lib/aprovados/lista-aprovados-rules.ts";
import { lerRegimeEJornada } from "../../src/lib/aprovados/exportacao/resumo-por-cargo-e-status.ts";

/* Textos de cargo como vêm das listas (sem dado pessoal). */
describe("localidadeDoCargo", () => {
  it.each([
    ["Enfermeiro - Pacaraima/RR", "Pacaraima/RR"],
    ["TÉCNICO DE ENFERMAGEM - PACARAIMA/RR - PPIQ", "PACARAIMA/RR"],
    [
      "Técnico de Enfermagem - Polo Base Brasilândia - DSEI Mato Grosso do Sul - Cadastro Reserva",
      "Polo Base Brasilândia",
    ],
    [
      "Nutricionista - Cadastro Reserva - DSEI GUAMÁ TOCANTINS - CASAI PARAGOMINAS -",
      "CASAI PARAGOMINAS",
    ],
    [
      "Engenheiro Civil - Cadastro Reserva - CAMPO GRANDE/MS - DSEI/SEDE",
      "CAMPO GRANDE/MS",
    ],
    [
      "Auxiliar Administrativo - Abrangência do DSEI - DSEI Manaus - Cadastro Reserva",
      "Abrangência do DSEI",
    ],
    ["Técnico de Enfermagem - Açucena/MG - (1 vaga)", "Açucena/MG"],
    [
      "Auxiliar de Saúde Bucal (ASB) - PB Chapecó - 1 vaga AC + CR",
      "PB Chapecó",
    ],
    [
      "AGENTE DE REGIÃO/DISTRITO - DISTRITAL DE CACOAL - AMPLA CONCORRÊNCIA",
      "DISTRITAL DE CACOAL",
    ],
    [
      "ASSISTENTE DE REGIÃO/DISTRITO - QUALQUER ÁREA DE FORMAÇÃO - DISTRITAL DE ALTAMIRA - PPIQ",
      "DISTRITAL DE ALTAMIRA",
    ],
    ["CARGO 1: ASSISTENTE ADMINISTRATIVO DE CCE - CEARÁ", "CEARÁ"],
    [
      "Cargo 1: Médico - UBS móvel Palhoça/SC - Projeto Agora tem Especialistas - Cadastro Reserva",
      "UBS móvel Palhoça/SC",
    ],
    ["Técnico Químico - BAURU/SP/", "BAURU/SP"],
  ])("%s → %s", (cargo, localidade) => {
    expect(localidadeDoCargo(cargo)).toBe(localidade);
  });

  it.each([
    "Analista Especializado de Saúde Indígena",
    "Analista de Gestão - Área de Formação: Direito",
    "Médico de Família e Comunidade (MFC) - Teletrabalho - 40h - Ampla Concorrência",
    "Agente de Combate a Endemias (ACE) - Cadastro Reserva - DSEI MÉDIO RIO PURUS -",
    "Técnico em Saneamento - DSEI Yanomami 25 vagas - (15 AC + 2 PCD + CR)",
    "",
  ])("sem localidade: %s", (cargo) => {
    expect(localidadeDoCargo(cargo)).toBe("");
  });
});

describe("opções e filtro", () => {
  const candidatos = [
    {
      candidato_id: "1",
      edital_id: "e1",
      nome: "A",
      cargo: "Enfermeiro - Pacaraima/RR",
    },
    {
      candidato_id: "2",
      edital_id: "e1",
      nome: "B",
      cargo: "Enfermeiro - Boa Vista/RR",
    },
    {
      candidato_id: "3",
      edital_id: "e2",
      nome: "C",
      cargo: "TÉCNICO DE ENFERMAGEM - PACARAIMA/RR - PPIQ",
    },
    {
      candidato_id: "4",
      edital_id: "e2",
      nome: "D",
      cargo: "Assistente Social",
    },
  ];

  it("uma opção por lugar (sem repetir a grafia), em ordem", () => {
    expect(opcoesDeLocalidade(candidatos)).toEqual([
      "Boa Vista/RR",
      "Pacaraima/RR",
    ]);
    expect(chaveDaLocalidade("PACARAIMA/RR")).toBe(
      chaveDaLocalidade("Pacaraima/RR"),
    );
  });

  it("com uma localidade só não há o que filtrar", () => {
    expect(opcoesDeLocalidade(candidatos, ["e2"])).toEqual([]);
  });

  it("filtra pela chave: as duas grafias de Pacaraima entram, sem localidade fica fora", () => {
    expect(
      filterApprovedCandidates(candidatos, {
        localidade: ["Pacaraima/RR"],
      }).map((c) => c.candidato_id),
    ).toEqual(["1", "3"]);
    expect(naLocalidade("Assistente Social", [])).toBe(true);
    expect(naLocalidade("Assistente Social", ["Pacaraima/RR"])).toBe(false);
  });
});

describe("jornada colada ao nome do cargo", () => {
  it.each([
    ["Assistente Social 30h", "Assistente Social", "30h"],
    ["Cirurgião Dentista (40h)", "Cirurgião Dentista", "40h"],
    ["Médico 40h - Abrangência do DSEI", "Médico - Abrangência do DSEI", "40h"],
    ["Médico de Família - Teletrabalho - 20h", "Médico de Família", "20h"],
    ["Enfermeiro", "Enfermeiro", null],
  ])("%s", (cargo, cargoBase, jornada) => {
    const lido = lerRegimeEJornada(cargo);
    expect(lido.cargoBase).toBe(cargoBase);
    expect(lido.jornada).toBe(jornada);
  });
});
