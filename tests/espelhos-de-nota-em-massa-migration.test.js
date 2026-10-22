import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Invariantes da migration 20261015180000 (espelhos de nota em massa): a RPC
  enxuta e paginada, só para quem coordena o edital, sem gravar nada; ensaio e
  rollback ao lado.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261015180000_espelhos_de_nota_em_massa.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ASSINATURA =
  "public.obter_espelhos_de_nota(uuid, text[], text, text[], text, integer, text[])";

function corpoDa(nome) {
  const inicio = MIGRATION.search(
    new RegExp(
      `create or replace function (public|private)\\.("?)${nome}\\2\\(`,
      "i",
    ),
  );
  if (inicio < 0) throw new Error(`função ${nome} não está no arquivo`);
  const resto = MIGRATION.slice(inicio);
  return resto.slice(0, resto.search(/\n\$function\$;\n/));
}

describe("a migration", () => {
  const rpc = corpoDa("obter_espelhos_de_nota");

  it("transação com lock_timeout", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("SECURITY DEFINER, search_path vazio, só leitura (stable) e só quem coordena", () => {
    expect(rpc).toMatch(/security definer/);
    expect(rpc).toMatch(/set search_path = ''/);
    expect(rpc).toMatch(/\nstable\n/);
    expect(rpc).toContain(`private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3)`);
    expect(rpc).toMatch(
      /private\."FC_PAPEL_AVALIACAO"\(p_edital\) is distinct from 'COORDENADOR'[\s\S]*?errcode = '42501'/,
    );
    expect(rpc).not.toMatch(/\b(insert|update|delete)\b/i);
  });

  it("só fichas concluídas, páginas de até 200 pela chave e só as regras que faltam", () => {
    expect(rpc).toContain(`f."TP_SITUACAO" = 'CONCLUIDA'`);
    expect(rpc).toContain("least(greatest(coalesce(p_limite, 200), 1), 200)");
    expect(rpc).toContain(`f."CO_FICHA_ANALISE" > v_apos`);
    expect(rpc).toContain(`order by f."CO_FICHA_ANALISE"`);
    expect(rpc).toContain("not (r.chave = any (p_regras))");
    expect(rpc).toContain(
      "'proximo', case when v_n = v_limite then v_ultimo end",
    );
  });

  it("devolve só o necessário: lançamento enxuto, sem parecer, histórico, respostas ou anexos", () => {
    expect(rpc).toContain(
      `private."FC_LANCAMENTO_DO_ESPELHO"(p."DS_LANCAMENTO")`,
    );
    expect(rpc).toContain(`p."DS_RESULTADO" -> 'declarada'`);
    expect(rpc).not.toMatch(
      /DS_PARECER|TH_FICHA_ANALISE|FC_RESPOSTAS_DA_FICHA|TB_EMPREGARE_ANEXO|NU_CPF/,
    );
    const enxuto = corpoDa("FC_LANCAMENTO_DO_ESPELHO");
    expect(enxuto).toContain("v - 'empregador'");
    expect(enxuto).toContain("c - 'nome'");
  });

  it("filtros TODOS/APTOS/INAPTOS, vagas e códigos (até 5.000)", () => {
    expect(rpc).toContain("v_filtro not in ('TODOS', 'APTOS', 'INAPTOS')");
    expect(rpc).toContain(`f."CO_VAGA" = any (p_vagas)`);
    expect(rpc).toContain("cardinality(v_codigos) > 5000");
    expect(rpc).toContain("'nao_concluidos', v_nao_concluidos");
  });

  it("grant só para authenticated; o auxiliar fica fechado", () => {
    expect(MIGRATION).toContain(
      `revoke all on function ${ASSINATURA} from public, anon;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${ASSINATURA} to authenticated;`,
    );
    expect(MIGRATION).toContain(
      `revoke all on function private."FC_LANCAMENTO_DO_ESPELHO"(jsonb) from public, anon, authenticated;`,
    );
  });

  it("o contrato do front declara os mesmos parâmetros", () => {
    expect(CONTRATO_RPC.obter_espelhos_de_nota.argumentos).toEqual([
      "p_edital",
      "p_vagas",
      "p_filtro",
      "p_codigos",
      "p_apos",
      "p_limite",
      "p_regras",
    ]);
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio usa fichas fictícias e mede as páginas", () => {
    expect(ENSAIO).toContain("session_replication_role = replica");
    expect(ENSAIO).toContain("Fictício");
    expect(ENSAIO).toContain("clock_timestamp()");
    expect(ENSAIO).not.toMatch(/\ncommit;/);
  });

  it("o rollback derruba as duas funções", () => {
    expect(ROLLBACK).toContain(`drop function if exists ${ASSINATURA};`);
    expect(ROLLBACK).toContain(
      `drop function if exists private."FC_LANCAMENTO_DO_ESPELHO"(jsonb);`,
    );
  });
});
