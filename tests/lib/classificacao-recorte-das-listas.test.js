import { describe, expect, it } from "vitest";
import {
  chaveDoRecorte,
  filtrosAtivosDoRecorte,
  normalizarRecorte,
  pessoasDoRecorte,
  recortarResultado,
  RECORTE_VAZIO,
} from "../../src/lib/classificacao/dados.ts";

/*
  O recorte das listas da Classificação (dados.ts): busca pelo nome ou pelo
  código, situação, o recorte guardado na sessão e quantas pessoas ele mostra.
*/

const linha = (analiseId, nome, situacao) => ({
  analiseId,
  nome,
  nota: 10,
  posicao: 1,
  empatados: 1,
  modalidades: ["AC"],
  situacao,
  vagaPor: null,
});
const vaga = (chave, campos) => ({
  chave,
  codigo: chave,
  cargo: "",
  lotacao: "",
  cabecalho: chave,
  total: 1,
  vagasPorModalidade: null,
  cadastroReserva: false,
  origemDasVagas: null,
  limiteConvocacao: null,
  geral: [],
  porModalidade: {},
  eliminados: [],
  aguardando: [],
  ...campos,
});
const RESULTADO = {
  vagas: [
    vaga("v1", {
      geral: [linha("a1", "Ana Lima", "VAGA"), linha("a2", "Bia Souza", "CR")],
      eliminados: [
        { analiseId: "a3", nome: "Caio Reis", motivo: "NOTA", detalhe: "" },
      ],
    }),
    vaga("v2", {
      geral: [linha("a4", "Davi Melo", "CR")],
      aguardando: [{ analiseId: "a5", nome: "Eva Dias", situacao: "Pendente" }],
    }),
  ],
};
const CODIGOS = new Map([
  ["a1", "7001"],
  ["a4", "7004"],
]);
const nomes = (vagas) =>
  vagas.flatMap((v) => [
    ...v.linhas.map((l) => l.nome),
    ...v.eliminadosFiltrados.map((e) => e.nome),
    ...v.aguardandoFiltrados.map((a) => a.nome),
  ]);

describe("recorte das listas da Classificação", () => {
  it("sem filtro, tudo; a busca acha pelo nome (sem acento) ou pelo código", () => {
    expect(nomes(recortarResultado(RESULTADO))).toHaveLength(5);
    const pelaBusca = (busca) =>
      nomes(recortarResultado(RESULTADO, { ...RECORTE_VAZIO, busca }, CODIGOS));
    expect(pelaBusca("7004")).toEqual(["Davi Melo"]);
    expect(pelaBusca("SOUZA")).toEqual(["Bia Souza"]);
    // Sem o mapa de códigos, o código não acha ninguém.
    expect(
      nomes(recortarResultado(RESULTADO, { ...RECORTE_VAZIO, busca: "7004" })),
    ).toEqual([]);
  });

  it("a situação recorta as linhas, os eliminados ou quem aguarda; vaga vazia sai", () => {
    const pela = (situacao) =>
      recortarResultado(RESULTADO, { ...RECORTE_VAZIO, situacao }, CODIGOS);
    expect(nomes(pela("CR"))).toEqual(["Bia Souza", "Davi Melo"]);
    expect(nomes(pela("LISTA"))).toEqual([
      "Ana Lima",
      "Bia Souza",
      "Davi Melo",
    ]);
    expect(pela("ELIMINADOS").map((v) => v.chave)).toEqual(["v1"]);
    expect(nomes(pela("ELIMINADOS"))).toEqual(["Caio Reis"]);
    expect(nomes(pela("AGUARDANDO"))).toEqual(["Eva Dias"]);
    expect(pessoasDoRecorte(pela(""))).toBe(5);
    expect(pessoasDoRecorte(pela("CR"))).toBe(2);
  });

  it("conta a situação entre os filtros; o guardado volta no formato de agora", () => {
    expect(filtrosAtivosDoRecorte(RECORTE_VAZIO)).toBe(0);
    expect(
      filtrosAtivosDoRecorte({ ...RECORTE_VAZIO, situacao: "ELIMINADOS" }),
    ).toBe(1);
    expect(normalizarRecorte({ situacao: "QUALQUER", lista: "" })).toEqual(
      RECORTE_VAZIO,
    );
    expect(
      normalizarRecorte({
        vaga: "v1",
        lista: "PP",
        busca: "ana",
        situacao: "CR",
      }),
    ).toEqual({ vaga: "v1", lista: "PP", busca: "ana", situacao: "CR" });
    expect(chaveDoRecorte("e83")).toBe("monitora:classificacao:recorte:e83");
    expect(chaveDoRecorte("")).toBe("");
  });
});
