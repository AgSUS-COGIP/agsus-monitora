import { describe, expect, it } from "vitest";
import {
  compararEditais,
  editalParaSalvar,
  formularioDoEdital,
  indexarResumo,
  indicadoresDoResumo,
  opcoesDeUnidade,
  passaNoFiltroOperacional,
  resumoDoEdital,
  unidadesDisponiveis,
} from "../src/lib/editais-do-nucleo.js";
import { UNIDADES_CORES } from "../src/lib/responsavel-do-edital.js";

const CATALOGO = [
  {
    id_unidade: "U1",
    sigla: "MAO",
    nome_oficial: "DSEI Manaus",
    tipo: "DSEI",
    uf_sede: "am",
  },
  {
    id_unidade: "U2",
    sigla: "SP",
    nome_oficial: "CASAI São Paulo",
    tipo: "CASAI",
    uf_sede: "sp",
  },
];

describe("fila do Núcleo", () => {
  it("risco alto primeiro; no mesmo risco, mais vagas ociosas primeiro", () => {
    const linhas = [
      { id: "a", risco: "Baixo", vagas_ociosas: 9 },
      { id: "b", risco: "Alto", vagas_ociosas: 1 },
      { id: "c", risco: "Médio", vagas_ociosas: 2 },
      { id: "d", risco: "Médio", vagas_ociosas: 5 },
      { id: "e", risco: "", vagas_ociosas: 50 },
    ];
    expect(linhas.sort(compararEditais).map((l) => l.id)).toEqual([
      "b",
      "d",
      "c",
      "a",
      "e",
    ]);
  });
});

describe("unidades do formulário", () => {
  it("o catálogo é completado pelas unidades que só existem nos editais", () => {
    const unidades = unidadesDisponiveis(CATALOGO, [
      { unidade: "DSEI Manaus" },
      { unidade: "CASAI Antiga", uf: "rr" },
    ]);
    expect(unidades.map((u) => u.nome_oficial)).toEqual([
      "CASAI Antiga",
      "CASAI São Paulo",
      "DSEI Manaus",
    ]);
  });

  it("o CORES tem as suas próprias unidades, sem UF", () => {
    expect(
      opcoesDeUnidade("CORES", CATALOGO, []).map((u) => u.nome_oficial),
    ).toEqual(UNIDADES_CORES);
  });

  it("acha a unidade pelo id e, na falta dele, pelo nome sem acento", () => {
    expect(formularioDoEdital({ id_unidade: "U2" }, CATALOGO, []).unidade).toBe(
      "U2",
    );
    const pelo = formularioDoEdital(
      { unidade: "casai sao paulo" },
      CATALOGO,
      [],
    );
    expect(pelo).toMatchObject({ unidade: "U2", idUnidade: "U2", uf: "SP" });
  });

  it("responsável antigo, com nome de pessoa, abre vazio", () => {
    expect(
      formularioDoEdital({ responsavel: "Maria" }, CATALOGO, []).responsavel,
    ).toBe("");
  });

  /*
    Edital do CORES com unidade que não está na lista: o select abre vazio, e
    salvar sem escolher tem de falhar na validação — e não gravar o texto do
    placeholder como unidade, como acontecia antes.
  */
  it("sem unidade escolhida, o payload vai sem unidade", () => {
    const formulario = formularioDoEdital(
      { edital: "1/2026", responsavel: "CORES", unidade: "Inexistente" },
      CATALOGO,
      [],
    );
    expect(formulario.unidade).toBe("");
    const edital = editalParaSalvar(
      formulario,
      null,
      { automatico: false, etapas: [] },
      { status: "", etapa: "" },
    );
    expect(edital.unidade).toBe("");
  });
});

describe("resumo e filtro operacional", () => {
  const resumo = [
    {
      id: "1",
      unidade: "DSEI",
      edital: "01",
      alerta_tipo: "incompleto",
      status: "Planejado",
    },
    {
      id: "2",
      unidade: "DSEI",
      edital: "01",
      alerta_tipo: "proxima_3d",
      status: "Em andamento",
    },
    {
      id: "3",
      unidade: "CASAI",
      edital: "02",
      alerta_tipo: "ok",
      status: "Concluído",
    },
  ];

  it("o id distingue dois registros com o mesmo edital e unidade", () => {
    const indice = indexarResumo(resumo);
    expect(
      resumoDoEdital(indice, { id: "2", unidade: "DSEI", edital: "01" })
        .alerta_tipo,
    ).toBe("proxima_3d");
    // Sem id no resumo, cai no nome — sem acento nem caixa.
    expect(
      resumoDoEdital(indice, { id: "9", unidade: "casai", edital: "02" }).id,
    ).toBe("3");
  });

  it("conta os indicadores", () => {
    const valores = Object.fromEntries(
      indicadoresDoResumo(resumo).map((cartao) => [cartao.key, cartao.value]),
    );
    expect(valores).toEqual({
      todos: 3,
      andamento: 2,
      sem_cronograma: 0,
      incompleto: 1,
      proxima: 1,
      excepcional: 0,
    });
  });

  it("sem resumo, a linha só aparece sem filtro", () => {
    expect(passaNoFiltroOperacional(null, "todos")).toBe(true);
    expect(passaNoFiltroOperacional(null, "incompleto")).toBe(false);
    expect(passaNoFiltroOperacional(resumo[1], "proxima")).toBe(true);
  });
});
