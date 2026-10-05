import { describe, expect, it } from "vitest";
import {
  SINONIMOS,
  distancia,
  palavrasDe,
  radical,
  singular,
  termosDe,
  toleranciaPara,
} from "../src/lib/termos-da-aya.js";

describe("sinônimos em grupos", () => {
  it("tem os 26 grupos do domínio, com as siglas do processo seletivo", () => {
    expect(Object.keys(SINONIMOS)).toEqual([
      "edital",
      "vaga",
      "candidato",
      "aprovado",
      "recurso",
      "entrevista",
      "analise",
      "acesso",
      "dsei",
      "polo",
      "ubsi",
      "casai",
      "cronograma",
      "convocacao",
      "contratacao",
      "chamado",
      "indicador",
      "parecer",
      "art",
      "lote",
      "reserva",
      "ampla",
      "negro",
      "cotaindigena",
      "pcd",
      "subjudice",
    ]);
  });

  it.each([
    ["edital", "PSS", "certame", "processo seletivo", "processos seletivos"],
    ["vaga", "cargo", "cargos", "vagas"],
    ["cadastro reserva", "CR", "cadastro de reserva"],
    ["negro", "PP", "pretos e pardos", "cota racial"],
    ["pcd", "PcD", "pessoa com deficiência", "pessoas com deficiência"],
    ["subjudice", "sub judice", "decisão judicial", "liminar"],
    ["art", "ART", "nota da ART", "autodeclaração"],
    ["candidato", "inscrito", "inscritos", "candidatas"],
    ["aprovado", "classificado", "aprovadas", "classificados"],
    ["recurso", "contestação", "impugnação", "contestar", "recorrer"],
    ["entrevista", "banca", "entrevistador"],
    ["análise", "triagem", "currículo", "análise curricular"],
    ["acesso", "permissão", "login", "permissões"],
    ["DSEI", "distrito", "distrito sanitário especial indígena", "DSEIs"],
    ["polo base", "polos base", "polo"],
    ["UBSI", "posto", "posto de saúde", "unidade básica de saúde indígena"],
    ["CASAI", "casa de apoio", "CASAIs", "casa de saúde indígena"],
    ["cronograma", "calendário", "calendários"],
    ["convocação", "convocar", "convocados"],
    ["contratação", "admissão", "contratados"],
    ["chamado", "suporte", "ticket"],
    ["indicador", "KPI", "KPIs", "métrica"],
    ["parecer", "jurídico", "parecer jurídico"],
  ])("%s e as variações viram um conceito só", (...formas) => {
    const conceitos = formas.map((forma) => termosDe(forma));
    for (const termos of conceitos) expect(termos).toEqual(conceitos[0]);
    expect(conceitos[0][0]).toMatch(/^#/);
  });

  it("vale para expressões de várias palavras no meio da frase", () => {
    expect(termosDe("como abrir um processo seletivo novo")).toEqual([
      "abr",
      "#edital",
      "nov",
    ]);
    expect(termosDe("onde fica a casa de apoio")).toEqual(["#casai"]);
    // "posto de trabalho" é vaga; "posto" sozinho é UBSI.
    expect(termosDe("posto de trabalho")).toEqual(["#vaga"]);
    expect(termosDe("posto")).toEqual(["#ubsi"]);
  });

  it("compara no singular: aprovado não é aprovação", () => {
    expect(termosDe("aprovados")).toEqual(["#aprovado"]);
    expect(termosDe("aprovação")).not.toEqual(["#aprovado"]);
    expect(termosDe("classificação")).not.toEqual(["#aprovado"]);
  });
});

describe("radical simples", () => {
  it("tira plural e sufixos comuns", () => {
    expect(singular("editais")).toBe("edital");
    expect(singular("convocacoes")).toBe("convocacao");
    expect(singular("casais")).toBe("casai");
    expect(singular("dseis")).toBe("dsei");
    expect(singular("pss")).toBe("pss");
    expect(radical("desativadas")).toBe(radical("desativar"));
    expect(radical("publicado")).toBe(radical("publicar"));
    expect(radical("prazos")).toBe("praz");
  });

  it("convocação, convocar e convocados dão no mesmo termo", () => {
    const termos = ["convocação", "convocar", "convocados", "convocadas"].map(
      (p) => termosDe(p),
    );
    for (const t of termos) expect(t).toEqual(termos[0]);
  });

  it("tira stopwords, mas guarda não, sem e quem", () => {
    expect(palavrasDe("Como é que eu faço para ver o edital?")).toEqual([
      "ver",
      "edital",
    ]);
    expect(palavrasDe("não contratados sem inscritos")).toEqual([
      "nao",
      "contratado",
      "sem",
      "inscrito",
    ]);
    expect(palavrasDe("quem decide")).toEqual(["quem", "decide"]);
  });
});

describe("distância de digitação", () => {
  it("conta a transposição como um erro só", () => {
    expect(distancia("entrevsita", "entrevista")).toBe(1);
    expect(distancia("rcurso", "recurso")).toBe(1);
    expect(distancia("recruso", "recurso")).toBe(1);
    expect(distancia("edital", "edital")).toBe(0);
  });

  it("para cedo quando passa do teto", () => {
    expect(distancia("abc", "xyzuvw", 1)).toBe(2);
  });

  it("aceita mais erros em palavras longas", () => {
    expect(toleranciaPara("pss")).toBe(0);
    expect(toleranciaPara("prazo")).toBe(1);
    expect(toleranciaPara("entrevista")).toBe(2);
  });
});
