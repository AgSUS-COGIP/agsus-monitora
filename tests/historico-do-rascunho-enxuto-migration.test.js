import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Histórico do rascunho enxuto (20261023090000; aplicar só depois de
  22/10/2026): o SALVAR da ficha vai ao histórico só com o que mudou, sem o
  retrato inteiro; CONCLUIR continua com o retrato obrigatório. A correção
  20261023-compactar-retratos-do-rascunho tira o retrato dos SALVAR antigos,
  menos o último de cada ficha e o último antes de cada CONCLUIR, com o
  gatilho de imutabilidade desligado só dentro da transação. Os ensaios
  begin…rollback rodaram no banco em 21/10/2026; aqui, as invariantes
  estáticas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261023090000_historico_do_rascunho_enxuto.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler("supabase/migrations/20261013130000_regra_por_cargo.sql");
const CORRECAO_NOME = "20261023-compactar-retratos-do-rascunho.sql";
const CORRECAO = ler(`supabase/correcoes/${CORRECAO_NOME}`);
const ENSAIO_CORRECAO = ler(`supabase/ensaios/${CORRECAO_NOME}`);
const CONTA_DO_SETOR = "a01afddb-f64b-47d9-80e8-476a1ed14e43";

const corpoDaTransacao = (texto) =>
  texto.slice(
    texto.indexOf("\nbegin;\n") + "\nbegin;\n".length,
    texto.lastIndexOf("\ncommit;\n") + 1,
  );
const entreMarcadores = (texto, nome) =>
  texto.slice(
    texto.indexOf(`-- >>> ${nome}\n`) + `-- >>> ${nome}\n`.length,
    texto.indexOf(`-- <<< ${nome}\n`),
  );
const funcao = (texto) => {
  const ini = texto.indexOf(
    "CREATE OR REPLACE FUNCTION public.salvar_rascunho_ficha(",
  );
  return texto.slice(ini, texto.indexOf("$function$;", ini) + 11);
};
const restricao = (texto) => {
  const ini = texto.indexOf('add constraint "CK_THFICHA_CONTEUDO"');
  return texto.slice(ini, texto.indexOf(";", ini));
};

describe("migration 20261023090000 (SALVAR sem retrato)", () => {
  it("o SALVAR passa null no retrato e nada mais muda na função vigente", () => {
    const nova = funcao(MIGRATION);
    const antiga = funcao(ANTERIOR);
    expect(nova).toContain(
      'FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, \'SALVAR\', v_f."TP_SITUACAO", null, v_uid, v_alt, null);',
    );
    expect(nova).not.toContain("jsonb_build_object('lancamento'");
    const semComentario = (f) =>
      f
        .split("\n")
        .filter((l) => !/^\s*--/.test(l))
        .join("\n");
    const normalizar = (f) =>
      semComentario(f).replace(
        /perform private\."FC_HISTORICO_CONTEUDO_FICHA"\([\s\S]*?\);/,
        "HISTORICO",
      );
    expect(normalizar(nova)).toBe(normalizar(antiga));
  });

  it("mantém SECURITY DEFINER, search_path vazio e não mexe em grants", () => {
    const nova = funcao(MIGRATION);
    expect(nova).toContain("SECURITY DEFINER");
    expect(nova).toContain("SET search_path TO ''");
    expect(MIGRATION).not.toMatch(/^\s*(grant|revoke|drop function)\b/im);
  });

  it("o retrato fica obrigatório só no CONCLUIR, NOT VALID e validado fora da transação", () => {
    const ck = restricao(MIGRATION);
    expect(ck).toContain(
      `("TP_ACAO" <> 'CONCLUIR' or "DS_RETRATO" is not null)`,
    );
    expect(ck).not.toContain("SALVAR");
    expect(ck).toMatch(/\) not valid$/);
    const depois = MIGRATION.slice(MIGRATION.lastIndexOf("\ncommit;\n"));
    expect(depois).toContain(
      'alter table public."TH_FICHA_ANALISE" validate constraint "CK_THFICHA_CONTEUDO";',
    );
    expect(MIGRATION).toContain("set local lock_timeout");
  });

  it("o rollback devolve a função anterior e a regra antiga (NOT VALID)", () => {
    expect(funcao(ROLLBACK)).toBe(funcao(ANTERIOR));
    const ck = restricao(ROLLBACK);
    expect(ck).toContain(
      `("TP_ACAO" not in ('SALVAR', 'CONCLUIR') or "DS_RETRATO" is not null)`,
    );
    expect(ck).toMatch(/\) not valid$/);
    expect(ROLLBACK).not.toContain("validate constraint");
  });

  it("o ensaio roda o corpo idêntico da migration e termina em rollback", () => {
    const corpo = corpoDaTransacao(MIGRATION);
    const validar = MIGRATION.match(
      /^alter table .* validate constraint .*;$/m,
    )[0];
    expect(entreMarcadores(ENSAIO, "migration")).toBe(`${corpo}${validar}\n`);
    expect(ENSAIO).toMatch(/^begin;$/m);
    expect(ENSAIO.trimEnd()).toMatch(/rollback;$/);
    expect(ENSAIO).not.toMatch(/^commit;$/m);
    for (const e of ["E1", "E2", "E3", "E4"]) expect(ENSAIO).toContain(e);
  });

  it("o contrato da RPC fala do SALVAR leve", () => {
    expect(CONTRATO_RPC.salvar_rascunho_ficha.argumentos).toEqual([
      "p_ficha",
      "p_versao",
      "p_lancamento",
      "p_resultado",
      "p_parecer",
    ]);
    expect(CONTRATO_RPC.salvar_rascunho_ficha.resumo).toContain(
      "sem o retrato",
    );
  });
});

describe("correção 20261023-compactar-retratos-do-rascunho", () => {
  it("exige a migration aplicada e a conta do setor como admin global ativo", () => {
    expect(CORRECAO).toContain("Aplique antes a migration 20261023090000");
    expect(CORRECAO).toContain(`p.user_id = '${CONTA_DO_SETOR}'`);
    expect(CORRECAO).toContain('a."ST_ADMIN_GLOBAL"');
  });

  it("desliga só o gatilho do histórico, dentro da transação, e religa antes do commit", () => {
    const corpo = corpoDaTransacao(CORRECAO);
    const desliga = corpo.indexOf(
      'alter table public."TH_FICHA_ANALISE" disable trigger "TG_THFICHA_IMUTAVEL";',
    );
    const atualiza = corpo.indexOf('set "DS_RETRATO" = null');
    const religa = corpo.indexOf(
      'alter table public."TH_FICHA_ANALISE" enable trigger "TG_THFICHA_IMUTAVEL";',
    );
    expect(desliga).toBeGreaterThan(0);
    expect(atualiza).toBeGreaterThan(desliga);
    expect(religa).toBeGreaterThan(atualiza);
    expect(CORRECAO).not.toMatch(/session_replication_role/);
    expect(CORRECAO).not.toMatch(/disable trigger all/i);
    expect(CORRECAO.match(/disable trigger/g)).toHaveLength(1);
    expect(corpo).toContain(
      "O gatilho TG_THFICHA_IMUTAVEL não voltou a ficar ligado.",
    );
  });

  it("só tira retrato de SALVAR (nunca apaga linha nem toca outras colunas)", () => {
    expect(CORRECAO).not.toMatch(/delete from public\."TH_FICHA_ANALISE"/i);
    const update = CORRECAO.slice(
      CORRECAO.indexOf('update public."TH_FICHA_ANALISE" h'),
      CORRECAO.indexOf("returning 1"),
    );
    expect(update).toMatch(/set "DS_RETRATO" = null\n/);
    expect(update).toContain(`h."TP_ACAO" = 'SALVAR'`);
    expect(update).toContain("compactar_sai");
  });

  it("sai todo SALVAR com retrato menos o último da ficha e o último antes de cada CONCLUIR", () => {
    const regra = entreMarcadores(CORRECAO, "regra");
    expect(regra).toContain(`x.proxima is distinct from 'CONCLUIR'`);
    expect(regra).toContain("x.ordem <> 1");
    expect(regra).not.toContain(";");
  });

  it("exige a exportação com a mesma contagem antes de compactar", () => {
    const corpo = corpoDaTransacao(CORRECAO);
    const confere = corpo.indexOf(
      "current_setting('monitora.exportacao_retratos', true)",
    );
    expect(confere).toBeGreaterThan(
      corpo.indexOf("create temporary table compactar_sai"),
    );
    expect(confere).toBeLessThan(corpo.indexOf("disable trigger"));
    expect(corpo).toContain("'^[0-9]+:[0-9a-f]{64}$'");
    expect(corpo).toContain(
      "split_part(v_exportacao, ':', 1)::integer <> v_sai",
    );
    expect(corpo).toContain(
      "Saíram retratos em número diferente do exportado.",
    );
    expect(CORRECAO).toContain("scripts/exportar-retratos-do-rascunho.mjs");
    expect(CORRECAO).toContain("sha256 %s");
  });

  it("assina no comentário de DS_RETRATO e só da primeira vez", () => {
    expect(CORRECAO).toMatch(
      /comment on column public\."TH_FICHA_ANALISE"\."DS_RETRATO"/,
    );
    expect(CORRECAO).toContain(
      `conta do setor Gestão da Informação de Pessoal (${CONTA_DO_SETOR})`,
    );
    expect(CORRECAO).toContain("if r.compactadas = 0 then");
  });

  it("explica o VACUUM FULL fora do expediente", () => {
    expect(CORRECAO).toContain(
      'vacuum (full, analyze, verbose) public."TH_FICHA_ANALISE";',
    );
    expect(CORRECAO).toMatch(/FORA DO EXPEDIENTE/);
  });

  it("o ensaio usa a mesma lista e a mesma conferência e termina em rollback", () => {
    const lista = CORRECAO.slice(
      CORRECAO.indexOf("create temporary table compactar_sai"),
      CORRECAO.indexOf(
        "\n",
        CORRECAO.indexOf("create unique index on compactar_sai"),
      ) + 1,
    );
    expect(entreMarcadores(ENSAIO_CORRECAO, "lista do que sai")).toBe(lista);
    const ini = CORRECAO.indexOf("-- A exportação foi feita");
    const conferencia = CORRECAO.slice(ini, CORRECAO.indexOf("$$;\n", ini) + 4);
    expect(entreMarcadores(ENSAIO_CORRECAO, "conferência da exportação")).toBe(
      conferencia,
    );
    for (const c of ["C0", "C1", "C2", "C3"])
      expect(ENSAIO_CORRECAO).toContain(c);
    expect(entreMarcadores(ENSAIO_CORRECAO, "migration")).toBe(
      corpoDaTransacao(MIGRATION).replace(
        /^set local lock_timeout = '3s';\n/m,
        "",
      ),
    );
    expect(ENSAIO_CORRECAO.trimEnd()).toMatch(/rollback;$/);
    expect(ENSAIO_CORRECAO).not.toMatch(/^commit;$/m);
  });
});
