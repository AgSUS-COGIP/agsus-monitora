import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Invariantes da migration 20261014130000 (gravar a vaga e abrir as fichas sem
  estourar os 8 s do service_role): gravar_pre_classificacao_vaga lê o p_linhas
  uma vez e usa a linha do quadro que o job leu (conferida); FC_FICHAS_INICIADAS
  e FC_ABRIR_FICHAS em comandos de conjunto. O refazer do 114/2026 estourou o
  tempo na vaga 182514 (run 38560938212).
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014130000_gravar_pre_classificacao_rapido.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const JOB = ler("scripts/pre_classificacao/pre_classificacao.py");

const funcao = (texto, nome) => {
  const re = new RegExp(
    `create (or replace )?function ${nome.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&")}\\(`,
    "i",
  );
  const inicio = texto.search(re);
  expect(inicio).toBeGreaterThanOrEqual(0);
  const corpo = texto.slice(inicio);
  const delim = corpo.match(/as (\$[a-z]*\$)/i)[1];
  const abre = corpo.indexOf(delim);
  return corpo.slice(
    0,
    corpo.indexOf(delim, abre + delim.length) + delim.length,
  );
};

describe("a migration", () => {
  it("transação com lock_timeout, sem mudar assinaturas", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout = '10s';");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).not.toMatch(/drop function/i);
    expect(MIGRATION).not.toMatch(/\r/);
  });

  it("gravar lê o p_linhas uma vez", () => {
    const nova = funcao(MIGRATION, "public.gravar_pre_classificacao_vaga");
    expect(nova).toContain(
      "create temporary table t_linhas_vaga on commit drop as",
    );
    expect(nova).toContain("drop table if exists pg_temp.t_linhas_vaga;");
    expect(nova).toContain("analyze pg_temp.t_linhas_vaga;");
    // só a leitura que monta a tabela usa o JSON
    expect(nova.match(/FC_LINHAS_PRE_CLASSIF"\(p_linhas\)/g)).toHaveLength(1);
    expect(nova.match(/pg_temp\.t_linhas_vaga/g).length).toBeGreaterThan(20);
    // as conferências de antes continuam
    for (const motivo of [
      "'inscrito repetido'",
      "'inscrito que não é da vaga'",
      "'faltam inscritos já pré-classificados'",
      "'posições não vão de 1 a N sem repetir'",
      "'decisão da coordenação não aplicada'",
      "quem já tem ficha não muda",
      "quem está no lote só sai eliminado (AM-5.5)",
      "a nota declarada congelada não muda",
      'v_iniciadas := private."FC_FICHAS_INICIADAS"(p_edital);',
    ])
      expect(nova).toContain(motivo);
  });

  it("gravar usa o quadro do job, conferido, e lê no banco só sem a chave", () => {
    const nova = funcao(MIGRATION, "public.gravar_pre_classificacao_vaga");
    expect(nova).toContain("if p_resumo ? 'quadro' then");
    expect(nova).toContain(
      "(p_resumo ? 'quadro' and jsonb_typeof(p_resumo -> 'quadro') not in ('string', 'null'))",
    );
    expect(nova).toContain(
      `q."CO_QUADRO_VAGA" = v_quadro_id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'`,
    );
    expect(nova).toContain("a linha do quadro não é do edital");
    const semChave = nova.slice(nova.indexOf("  else\n    v_quadro :="));
    expect(semChave).toContain(
      'v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);',
    );
    expect(nova.match(/FC_QUADRO_DA_VAGA_EMPREGARE/g)).toHaveLength(2); // o comentário e a chamada sem a chave
  });

  it("fichas iniciadas numa consulta de conjunto, com a mesma definição", () => {
    const nova = funcao(MIGRATION, 'private."FC_FICHAS_INICIADAS"');
    expect(nova).not.toContain('private."FC_FICHA_INICIADA"(f)');
    expect(nova).toContain(
      "filter (where h.\"TP_ACAO\" not in ('CRIAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'REFAZER_LOTE', 'REINICIAR'))",
    );
    expect(nova).toContain("filter (where h.\"TP_ACAO\" = 'REINICIAR'), 0)");
    expect(nova).toContain("h.ultima_acao > h.reinicio");
    for (const campo of [
      "CO_USUARIO_RESPONSAVEL",
      "DT_ATRIBUICAO",
      "CO_USUARIO_RESERVA",
      "DS_LANCAMENTO",
      "DS_RESULTADO",
      "DS_PARECER",
      "TP_RESULTADO",
      "VL_NOTA_APURADA",
      "VL_NOTA_FINAL",
      "CO_USUARIO_RASCUNHO",
      "CO_USUARIO_CONCLUSAO",
    ])
      expect(nova).toContain(`f."${campo}" is not null`);
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_FICHAS_INICIADAS"(uuid) from public, anon, authenticated, service_role;',
    );
  });

  it("abrir as fichas em comandos de conjunto, com o histórico no mesmo comando", () => {
    const nova = funcao(MIGRATION, 'private."FC_ABRIR_FICHAS"');
    expect(nova).not.toContain('private."FC_LOTE_REFEITO_EM"');
    // só a atribuição (poucas) segue ficha a ficha
    expect(nova.match(/perform private."FC_HISTORICO_FICHA"/g)).toHaveLength(1);
    expect(nova.match(/\bfor v_item in\b/g)).toHaveLength(1);
    for (const trecho of [
      "saiu as (",
      "voltou as (",
      "nova as (",
      "historico as (",
      "'REFAZER_LOTE' else 'SAIR_LOTE' end as acao",
      "'Lote refeito em ' || to_char(t.\"DT_INICIO\" at time zone 'America/Sao_Paulo', 'DD/MM')",
      "'VOLTAR_LOTE', 'FORA_LOTE'",
      "'CRIAR', null",
      "pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0))",
      "'Atribuição recusada: só a ficha aberta agora, uma vez'",
    ])
      expect(nova).toContain(trecho);
  });
});

describe("o rollback", () => {
  it("volta as três funções de antes", () => {
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    expect(funcao(ROLLBACK, "public.gravar_pre_classificacao_vaga")).toContain(
      'v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);',
    );
    expect(funcao(ROLLBACK, 'private."FC_FICHAS_INICIADAS"')).toContain(
      'private."FC_FICHA_INICIADA"(f)',
    );
    expect(funcao(ROLLBACK, 'private."FC_ABRIR_FICHAS"')).toContain(
      'private."FC_LOTE_REFEITO_EM"(p."CO_EXECUCAO")',
    );
  });
});

describe("o ensaio e o job", () => {
  it("o ensaio mede e confere sem gravar", () => {
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).toContain("set local statement_timeout = '8s';");
    expect(ENSAIO).toContain("ENSAIO 1: FC_FICHAS_INICIADAS difere");
    expect(ENSAIO).toContain("ENSAIO 2: gravar a vaga % levou mais de 3 s");
    expect(ENSAIO).toContain("ENSAIO 2: quadro de outro edital foi aceito");
    expect(ENSAIO).toContain("ENSAIO 3: abrir as fichas levou mais de 3 s");
  });

  it("o job manda a linha do quadro lida com a vaga e só abre as fichas no fim", () => {
    expect(JOB).toContain('r["quadro"] = (vaga.get("quadro") or {}).get("id")');
    expect(JOB).toContain('if "quadro" in resultado_da_vaga:');
    expect(JOB).toContain('if resultado["situacao"] == "PROCESSADO":');
  });
});
