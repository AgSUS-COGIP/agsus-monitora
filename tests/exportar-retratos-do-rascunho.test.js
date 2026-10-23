// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  CORRECAO,
  consultaDoLote,
  exportar,
  extrairRegra,
  lerExportacao,
  linhaDaCorrecao,
} from "../scripts/exportar-retratos-do-rascunho.mjs";

/*
  Exportação dos retratos antes da compactação (scripts/exportar-retratos-do-rascunho.mjs),
  com dados falsos: a regra vem da correção, os lotes andam pela chave, o
  arquivo é JSONL compactado com o sha256 e a linha que a correção exige.
*/
const pastas = [];
const pasta = () => {
  const p = mkdtempSync(join(tmpdir(), "retratos-"));
  pastas.push(p);
  return p;
};
afterEach(() => {
  while (pastas.length) rmSync(pastas.pop(), { recursive: true, force: true });
});

const FICHA_A = "11111111-1111-1111-1111-111111111111";
const FICHA_B = "22222222-2222-2222-2222-222222222222";
const linhaFalsa = (id, ficha) =>
  JSON.stringify({
    CO_HISTORICO_FICHA: id,
    CO_FICHA_ANALISE: ficha,
    NU_VERSAO: id + 10,
    TP_ACAO: "SALVAR",
    DT_REGISTRO: "2026-10-20T13:00:00+00:00",
    CO_USUARIO: "33333333-3333-3333-3333-333333333333",
    DS_RETRATO: { lancamento: { blocos: [id] }, resultado: { nota_final: id } },
  });

/** Banco falso: responde ao SQL do lote com as linhas de chave > depoisDe. */
function bancoFalso(ids) {
  const consultas = [];
  const consultar = async (sql) => {
    consultas.push(sql);
    const depois = Number(sql.match(/"CO_HISTORICO_FICHA" > (\d+)/)[1]);
    const limite = Number(sql.match(/limit (\d+)\s*$/)[1]);
    return ids
      .filter((id) => id > depois)
      .slice(0, limite)
      .map((id) => linhaFalsa(id, id % 2 ? FICHA_A : FICHA_B));
  };
  return { consultar, consultas };
}

describe("exportação dos retratos do rascunho", () => {
  it("lê a regra da própria correção (SELECT sem ponto e vírgula)", () => {
    const regra = extrairRegra(readFileSync(CORRECAO, "utf8"));
    expect(regra).toMatch(/^select x\.id/);
    expect(regra).toContain("x.proxima is distinct from 'CONCLUIR'");
    expect(regra).not.toContain(";");
    expect(() => extrairRegra("select 1")).toThrow(/Regra não encontrada/);
  });

  it("monta o lote só com SELECT, pela chave e com limite", () => {
    const sql = consultaDoLote("select 1 as id", 42, 500);
    expect(sql).toMatch(/^select json_build_object\(/);
    expect(sql).toContain('h."CO_HISTORICO_FICHA" > 42');
    expect(sql).toContain("select 1 as id");
    expect(sql).toMatch(/order by h\."CO_HISTORICO_FICHA"\n limit 500$/);
    expect(sql).not.toMatch(/\b(update|delete|insert|alter|drop)\b/i);
    for (const c of [
      "CO_FICHA_ANALISE",
      "NU_VERSAO",
      "TP_ACAO",
      "DT_REGISTRO",
      "CO_USUARIO",
      "DS_RETRATO",
    ])
      expect(sql).toContain(`'${c}', h."${c}"`);
    expect(() => consultaDoLote("select 1", "1; drop", 10)).toThrow();
    expect(() => consultaDoLote("select 1", 0, 0)).toThrow();
  });

  it("exporta em lotes pela chave para JSONL.gz e devolve linhas, tamanho e sha256", async () => {
    const ids = [3, 5, 8, 13, 21, 34, 55];
    const { consultar, consultas } = bancoFalso(ids);
    const saida = join(pasta(), "retratos.jsonl.gz");
    const r = await exportar({
      consultar,
      regra: "select 1 as id",
      saida,
      lote: 3,
    });

    expect(r.linhas).toBe(7);
    expect(consultas.map((s) => s.match(/> (\d+)/)[1])).toEqual([
      "0",
      "8",
      "34",
    ]);
    const bruto = readFileSync(saida);
    expect(r.bytes).toBe(bruto.length);
    expect(r.sha256).toBe(createHash("sha256").update(bruto).digest("hex"));
    const linhas = gunzipSync(bruto).toString("utf8").trimEnd().split("\n");
    expect(linhas.map((l) => JSON.parse(l).CO_HISTORICO_FICHA)).toEqual(ids);
    expect(linhaDaCorrecao(r)).toBe(
      `set monitora.exportacao_retratos = '7:${r.sha256}';`,
    );
  });

  it("para no lote exato e recusa lote fora de ordem", async () => {
    const { consultar, consultas } = bancoFalso([1, 2, 3, 4]);
    const r = await exportar({
      consultar,
      regra: "select 1 as id",
      saida: join(pasta(), "a.jsonl.gz"),
      lote: 2,
    });
    expect(r.linhas).toBe(4);
    expect(consultas).toHaveLength(3);
    await expect(
      exportar({
        consultar: async () => [linhaFalsa(5, FICHA_A), linhaFalsa(4, FICHA_A)],
        regra: "select 1 as id",
        saida: join(pasta(), "b.jsonl.gz"),
        lote: 10,
      }),
    ).rejects.toThrow(/fora de ordem/);
    expect(existsSync(join(pastas.at(-1), "b.jsonl.gz"))).toBe(false);
  });

  it("lê o arquivo de volta e filtra uma ficha (para consulta)", async () => {
    const { consultar } = bancoFalso([1, 2, 3, 4, 5]);
    const saida = join(pasta(), "c.jsonl.gz");
    await exportar({ consultar, regra: "select 1 as id", saida });
    expect(await lerExportacao(saida)).toHaveLength(5);
    const daFicha = await lerExportacao(saida, { ficha: FICHA_A });
    expect(daFicha.map((l) => l.CO_HISTORICO_FICHA)).toEqual([1, 3, 5]);
    expect(daFicha[1].DS_RETRATO.resultado.nota_final).toBe(3);
  });
});
