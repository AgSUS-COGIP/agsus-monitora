import { describe, expect, it } from "vitest";
import {
  argumentosDaPagina,
  contarPorVaga,
  linhasDaPreInteira,
  paginaDaResposta,
  resumoDaPreInteira,
} from "../../src/lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import {
  declaradasCongeladas,
  lotesAPublicar,
} from "../../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts";

/*
  A triagem em páginas: a leitura de reserva (banco sem
  listar_pre_classificacao) tem de dar as mesmas linhas, na mesma ordem, que o
  banco (CLASSIFICADOS: no lote e depois fora do lote, pela posição;
  ELIMINADOS: pelo código; PODE_INCLUIR: fora do lote e eliminados que não
  saíram da Empregare), e o mesmo resumo (lotes e congeladas).
*/
const c = (codigo, vaga, situacao, extra = {}) => ({
  id: `id-${codigo}`,
  codigo,
  nome: `Pessoa ${codigo}`,
  vaga,
  situacao,
  ...extra,
});
const DADOS = {
  pode_coordenar: true,
  pode_registrar_lista: true,
  pode_publicar_lista: false,
  regra: { versao: 3 },
  regra_classificacao: null,
  em_andamento: false,
  ultima_execucao: null,
  listas: [],
  vagas: [{ codigo: "10" }, { codigo: "20" }],
  candidatos: [
    c("300", "10", "RANQUEADO", { posicao: 3 }),
    c("100", "10", "NO_LOTE", { posicao: 1, lote: 1 }),
    c("900", "10", "ELIMINADO", { motivo_codigo: "SAIU_DA_EMPREGARE" }),
    c("200", "10", "ANALISADO", {
      posicao: 2,
      lote: 1,
      declarada_congelada: 9,
      congelada_em: "2026-10-20T10:00:00Z",
    }),
    c("150", "10", "ELIMINADO", { motivo_codigo: "NOTA" }),
    c("400", "10", "RANQUEADO", { posicao: null }),
    c("Ágata", "20", "ELIMINADO", { nome: "Ágata Souza" }),
    c("500", "20", "NO_LOTE", {
      posicao: 1,
      lote: 2,
      declarada_congelada: 7,
      congelada_em: "2026-10-19T10:00:00Z",
    }),
  ],
};
const codigos = (linhas) => linhas.map((l) => l.codigo);

describe("linhasDaPreInteira", () => {
  it("CLASSIFICADOS: no lote e depois fora do lote, pela posição (sem posição no fim)", () => {
    expect(
      codigos(
        linhasDaPreInteira(DADOS, { vaga: "10", grupo: "CLASSIFICADOS" }),
      ),
    ).toEqual(["100", "200", "300", "400"]);
  });

  it("ELIMINADOS pelo código; PODE_INCLUIR sem quem saiu da Empregare", () => {
    expect(
      codigos(linhasDaPreInteira(DADOS, { vaga: "10", grupo: "ELIMINADOS" })),
    ).toEqual(["150", "900"]);
    expect(
      codigos(linhasDaPreInteira(DADOS, { vaga: "10", grupo: "PODE_INCLUIR" })),
    ).toEqual(["300", "400", "150"]);
  });

  it("busca no edital todo, sem acento, por código ou nome; conta por vaga", () => {
    const achados = linhasDaPreInteira(DADOS, {
      vaga: null,
      grupo: "ELIMINADOS",
      busca: "agata",
    });
    expect(codigos(achados)).toEqual(["Ágata"]);
    expect(contarPorVaga(achados)).toEqual({ 20: 1 });
  });
});

describe("resumoDaPreInteira", () => {
  it("tira os inscritos e traz lotes, congeladas e fora do lote por vaga", () => {
    const resumo = resumoDaPreInteira(DADOS);
    expect(resumo.candidatos).toBeUndefined();
    expect(resumo.lotes).toEqual([
      { lote: 1, quantidade: 2 },
      { lote: 2, quantidade: 1 },
    ]);
    expect(resumo.congeladas).toEqual({
      quantidade: 2,
      em: "2026-10-19T10:00:00Z",
    });
    expect(resumo.vagas.map((v) => v.fora_do_lote)).toEqual([2, 0]);
  });

  it("os contadores da tela dão o mesmo com o resumo e com a leitura inteira", () => {
    const resumo = resumoDaPreInteira(DADOS);
    expect(lotesAPublicar(resumo)).toEqual(lotesAPublicar(DADOS));
    expect(declaradasCongeladas(resumo)).toEqual(declaradasCongeladas(DADOS));
  });
});

describe("a página do banco", () => {
  it("lê a resposta (total, cursor e quantos por vaga)", () => {
    expect(
      paginaDaResposta({
        candidatos: [{ id: "a" }],
        proximo: { vaga: "10", grupo: 0, posicao: 1, codigo: "1" },
        total: "120",
        por_vaga: { 10: 3, 20: "4" },
      }),
    ).toEqual({
      linhas: [{ id: "a" }],
      proximo: { vaga: "10", grupo: 0, posicao: 1, codigo: "1" },
      total: 120,
      porVaga: { 10: 3, 20: 4 },
    });
    expect(paginaDaResposta(null)).toEqual({
      linhas: [],
      proximo: null,
      total: 0,
      porVaga: {},
    });
  });

  it("monta os argumentos (busca vazia vira nulo)", () => {
    expect(
      argumentosDaPagina(
        "e1",
        { vaga: "10", grupo: "ELIMINADOS", busca: "  " },
        null,
        50,
      ),
    ).toEqual({
      p_edital: "e1",
      p_vaga: "10",
      p_grupo: "ELIMINADOS",
      p_busca: null,
      p_apos: null,
      p_limite: 50,
    });
  });
});
