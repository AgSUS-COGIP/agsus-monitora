import { describe, expect, it } from "vitest";
import {
  csvDosCasos,
  destinoDoCaso,
  linhaDoVinculo,
  normalizarCaso,
  ondeDoCaso,
  quemDoCaso,
} from "../src/lib/avisos-de-conferencia.ts";
import { filtrosDeEntrevistas } from "../src/lib/filtro-da-aya.js";
import {
  filterApprovedCandidates,
  nomeDosCandidatosFiltrados,
} from "../src/lib/lista-aprovados-rules.js";

/*
  Casos dos avisos dos outros módulos (20261007240000): aprovados,
  entrevistas, listas, ajustes e vagas vêm resolvidos pela leitura — quem é,
  onde, situação, as vagas da pessoa — e cada um leva à tela do módulo.
  UUID interno nunca aparece.
*/

const UUID_DO_APROVADO = "b44c58f2-41de-448e-b6c6-88932524fa19";
const UUID_DA_OUTRA_VAGA = "b44c58f2-41de-448e-b6c6-88932524fa20";

const aprovado = (extra) => ({
  aviso_id: "av1",
  conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
  ordem: 1,
  tipo: "candidato_aprovado",
  resolucao: "ok",
  aprovado_id: UUID_DO_APROVADO,
  edital_id: "e1",
  codigo: "4512",
  nome: "Maria Fictícia",
  edital: "Edital 12/2025",
  codigo_vaga: "1777",
  nome_vaga: "Enfermeiro",
  status: "Contratado",
  data_convocacao: "2026-01-10",
  data_contratacao: "2026-02-03T13:00:00+00:00",
  referencia: null,
  detalhe: { vagas: 2 },
  vinculos: [
    {
      id: UUID_DO_APROVADO,
      edital: "Edital 12/2025",
      codigo_vaga: "1777",
      nome_vaga: "Enfermeiro",
      status: "Contratado",
      data_contratacao: "2026-02-03T13:00:00+00:00",
    },
    {
      id: UUID_DA_OUTRA_VAGA,
      edital: "Edital 40/2026",
      codigo_vaga: "1900",
      nome_vaga: "Técnico de enfermagem",
      status: "Contratado",
      data_contratacao: "2026-05-20T13:00:00+00:00",
    },
  ],
  fora_do_acesso: 1,
  ...extra,
});

describe("caso de aprovado (Contratado em duas vagas)", () => {
  it("quem, onde, situação, motivo e as vagas da pessoa — sem UUID", () => {
    const caso = normalizarCaso(aprovado());
    expect(quemDoCaso(caso)).toBe("4512 · Maria Fictícia");
    expect(ondeDoCaso(caso)).toBe(
      "Edital 12/2025 · 1777 · Enfermeiro · Contratado em 03/02/2026",
    );
    expect(caso.motivo).toBe("Contratado em 2 vagas");
    expect(caso.vinculos.map(linhaDoVinculo)).toEqual([
      "Edital 12/2025 · 1777 · Enfermeiro · Contratado em 03/02/2026",
      "Edital 40/2026 · 1900 · Técnico de enfermagem · Contratado em 20/05/2026",
    ]);
    expect(caso.foraDoAcesso).toBe(1);
    const tudo = [quemDoCaso(caso), ondeDoCaso(caso), caso.motivo].join(" ");
    expect(tudo).not.toMatch(/b44c58f2/);
  });

  it("leva à Lista de aprovados só com as vagas da pessoa", () => {
    expect(destinoDoCaso(normalizarCaso(aprovado()))).toEqual({
      view: "approved",
      filtro: {
        candidatos: [UUID_DO_APROVADO, UUID_DA_OUTRA_VAGA],
        nome: "Maria Fictícia",
      },
    });
  });

  it("convocado sem desfecho: a data da convocação", () => {
    const caso = normalizarCaso(
      aprovado({
        conferencia: "APROVADOS_CONVOCADO_SEM_DESFECHO",
        status: "Convocado",
        detalhe: { convocado_em: "2026-09-01" },
        vinculos: null,
      }),
    );
    expect(caso.motivo).toBe("Convocado em 01/09/2026, sem desfecho");
    expect(ondeDoCaso(caso)).toContain("Convocado em 10/01/2026");
  });

  it("registro removido e fora do acesso: o rótulo, nunca o UUID", () => {
    const removido = normalizarCaso({
      aviso_id: "av1",
      conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
      ordem: 2,
      tipo: "candidato_aprovado",
      resolucao: "removido",
      referencia: UUID_DO_APROVADO,
    });
    expect(quemDoCaso(removido)).toBe("Registro removido");
    expect(removido.referencia).toBe("");
    expect(destinoDoCaso(removido)).toBeNull();
    const semAcesso = normalizarCaso({
      aviso_id: "av1",
      conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
      ordem: 3,
      resolucao: "sem_acesso",
    });
    expect(quemDoCaso(semAcesso)).toBe("Sem acesso");
    // Caso antigo que só trouxe a referência UUID (leitura sem resolver).
    expect(quemDoCaso(normalizarCaso({ referencia: UUID_DO_APROVADO }))).toBe(
      "Sem identificação",
    );
  });

  it("CSV: nome, situação, vagas da pessoa; sem UUID na referência", () => {
    const csv = csvDosCasos([
      normalizarCaso(aprovado({ referencia: UUID_DO_APROVADO })),
      normalizarCaso({
        conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
        ordem: 2,
        resolucao: "removido",
      }),
    ]);
    const [, linha, removido] = csv.split("\n");
    expect(linha).toContain(
      "4512;Maria Fictícia;Edital 12/2025;1777 · Enfermeiro;;Contratado em 03/02/2026;",
    );
    expect(linha).toContain(
      "Edital 40/2026 · 1900 · Técnico de enfermagem · Contratado em 20/05/2026",
    );
    expect(csv).not.toMatch(/b44c58f2/);
    expect(removido).toContain(";Registro removido;");
  });
});

describe("casos de entrevista, classificação e cargas", () => {
  it("entrevista: parecer e nota; leva a Entrevistas com a busca e a entrevista", () => {
    const caso = normalizarCaso({
      aviso_id: "av2",
      conferencia: "ENTREVISTA_NOTA_FORA_DA_ESCALA",
      ordem: 1,
      tipo: "entrevista",
      resolucao: "ok",
      entrevista_id: "en1",
      codigo: "C77",
      nome: "João Fictício",
      edital: "Edital 101/2026",
      codigo_vaga: "177979",
      nome_vaga: "Enfermeiro",
      status: "APTO",
      nota: 21,
      detalhe: { nota: 12, maxima: 10 },
    });
    expect(quemDoCaso(caso)).toBe("C77 · João Fictício");
    expect(ondeDoCaso(caso)).toBe(
      "Edital 101/2026 · 177979 · Enfermeiro · Apto · nota 21",
    );
    expect(caso.motivo).toBe("Nota 12 · máxima 10");
    expect(destinoDoCaso(caso)).toEqual({
      view: "entrevistas",
      filtro: { busca: "João Fictício", entrevista: "en1" },
    });
  });

  it("lista, vaga e ajuste: rótulos legíveis", () => {
    const lista = normalizarCaso({
      conferencia: "CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA",
      tipo: "lista_classificacao",
      resolucao: "ok",
      edital_id: "e1",
      edital: "Edital 101/2026",
      lista: { tipo: "FINAL", gerada_em: "2026-10-01T10:00:00+00:00" },
    });
    expect(quemDoCaso(lista)).toBe("Lista final");
    expect(lista.motivo).toBe("Gerada em 01/10/2026");
    expect(destinoDoCaso(lista)).toEqual({
      view: "classificacao",
      filtro: {},
    });

    const vaga = normalizarCaso({
      conferencia: "CLASSIFICACAO_VAGA_SEM_QUADRO",
      tipo: "vaga",
      resolucao: "ok",
      edital: "Edital 101/2026",
      codigo_vaga: "180001",
      nome_vaga: "Médico",
      referencia: "180001",
    });
    expect(quemDoCaso(vaga)).toBe("Vaga 180001 · Médico");
    expect(ondeDoCaso(vaga)).toBe("Edital 101/2026");
    expect(
      quemDoCaso(
        normalizarCaso({ tipo: "vaga", resolucao: "ok", referencia: "x" }),
      ),
    ).toBe("Vaga sem código");

    const carga = normalizarCaso({
      conferencia: "CARGA_VARIACAO_BRUSCA",
      tipo: "vaga_empregare",
      resolucao: "ok",
      codigo_vaga: "177979",
      detalhe: { antes: 1200, depois: 300 },
    });
    expect(carga.motivo).toBe("De 1.200 para 300 candidatos");
    expect(destinoDoCaso(carga)).toBeNull();
  });
});

describe("as telas recebem o caso", () => {
  const linhas = [
    { candidato_id: UUID_DO_APROVADO, nome: "Maria Fictícia", edital_id: "e1" },
    {
      candidato_id: UUID_DA_OUTRA_VAGA,
      nome: "Maria Fictícia",
      edital_id: "e2",
    },
    { candidato_id: "outro", nome: "Outra Pessoa", edital_id: "e1" },
  ];

  it("Lista de aprovados: só os registros do caso", () => {
    expect(
      filterApprovedCandidates(linhas, {
        candidatos: [UUID_DO_APROVADO, UUID_DA_OUTRA_VAGA],
      }).map((l) => l.candidato_id),
    ).toEqual([UUID_DO_APROVADO, UUID_DA_OUTRA_VAGA]);
    expect(filterApprovedCandidates(linhas, { candidatos: [] })).toHaveLength(
      3,
    );
    expect(nomeDosCandidatosFiltrados(linhas, [UUID_DA_OUTRA_VAGA])).toBe(
      "Maria Fictícia",
    );
    expect(nomeDosCandidatosFiltrados(linhas, ["sumiu"])).toBe("");
  });

  it("Entrevistas: a busca do caso entra nos filtros", () => {
    expect(
      filtrosDeEntrevistas({ busca: "", edital: "" }, { busca: " João " }, {})
        .busca,
    ).toBe("João");
    expect(
      filtrosDeEntrevistas({ busca: "x", edital: "" }, { metrica: "aptos" }, {})
        .busca,
    ).toBe("x");
  });
});
