import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOTIVOS_DA_REABERTURA } from "../src/lib/avaliacao-documental/motivos-da-reabertura.ts";
import { VOGAIS } from "../src/lib/avaliacao-documental/qualidade-do-motivo.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261021110000 (ainda não aplicada; ensaio begin…rollback em
  supabase/ensaios/): reabrir_ficha com o código do motivo de uma lista fixa
  e complemento; texto mínimo nos motivos livres da fila. Aqui, as
  invariantes estáticas: a lista do banco é a do front, a chamada antiga
  (texto livre) é recusada com 22023, as três funções da fila só ganham a
  checagem do texto, o rollback devolve as definições anteriores e o ensaio
  leva o mesmo corpo e termina em rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261021110000_motivos_da_reabertura.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

/** O corpo de `CREATE OR REPLACE FUNCTION <nome>` até o $function$; de fechamento. */
const funcao = (sql, nome) => {
  const ini = sql.toLowerCase().indexOf(`function ${nome.toLowerCase()}(`);
  if (ini < 0) return "";
  const fim = sql.indexOf("$function$;", sql.indexOf("$function$", ini) + 10);
  return sql.slice(ini, fim);
};
const semMotivo = (corpo) =>
  corpo
    .split("\n")
    .filter(
      (l) =>
        !/FC_MOTIVO_PARECE_TEXTO|Informe o motivo|v_motivo is null or length/.test(
          l,
        ),
    )
    .join("\n");

describe("motivos da reabertura (migration)", () => {
  it("transação única, sem \\r, sem tabela nova", () => {
    expect(MIGRATION).not.toContain("\r");
    expect(MIGRATION).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(MIGRATION).not.toMatch(/create table|alter table/i);
    expect(MIGRATION.match(/^drop /gim)).toEqual(["drop "]);
    expect(MIGRATION).toContain(
      "drop function if exists public.reabrir_ficha(uuid, integer, text);",
    );
  });

  it("a lista do banco (FC_MOTIVO_REABERTURA) é a do front, na mesma ordem", () => {
    const corpo = funcao(MIGRATION, 'private."FC_MOTIVO_REABERTURA"');
    const doBanco = [...corpo.matchAll(/when '([A-Z_]+)' then '([^']+)'/g)].map(
      ([, codigo, rotulo]) => ({ codigo, rotulo }),
    );
    expect(doBanco).toEqual(
      MOTIVOS_DA_REABERTURA.map(({ codigo, rotulo }) => ({ codigo, rotulo })),
    );
  });

  it("o texto mínimo do banco usa as mesmas vogais e limites do front", () => {
    const corpo = funcao(MIGRATION, 'private."FC_MOTIVO_PARECE_TEXTO"');
    expect(corpo).toContain(`'[^${VOGAIS}]'`);
    expect(corpo).toContain("'([[:alpha:]])\\1{3,}'");
    expect(corpo).toContain("length(w) >= 2");
    expect(corpo).toContain("length(w) <= 3");
    expect(corpo).toContain("* 5 >= length(w)");
    expect(corpo).toContain("count(distinct w)");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_MOTIVO_PARECE_TEXTO"(text, integer) from public, anon, authenticated;',
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_MOTIVO_REABERTURA"(text) from public, anon, authenticated;',
    );
  });

  it("reabrir_ficha: código da lista (texto livre antigo recusado com 22023), Outro e complemento", () => {
    const corpo = funcao(MIGRATION, "public.reabrir_ficha");
    expect(corpo).toContain("p_complemento text DEFAULT NULL::text");
    expect(corpo).toMatch(
      /if v_rotulo is null then\n\s+raise exception 'Escolha o motivo da reabertura na lista\. Se a lista não aparece, recarregue a página\.' using errcode = '22023';/,
    );
    expect(corpo).toContain(
      "if length(coalesce(v_complemento, '')) < 15 or not private.\"FC_MOTIVO_PARECE_TEXTO\"(v_complemento, 3) then",
    );
    expect(corpo).toContain(
      'elsif v_complemento is not null and not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 1) then',
    );
    expect(corpo).toContain("> 500 then");
    // Rótulo legível no motivo, código nas alterações (lista: CK_THFICHA_CONTEUDO).
    expect(corpo).toContain("v_rotulo || coalesce(' — ' || v_complemento, '')");
    expect(corpo).toContain(
      "jsonb_build_array(jsonb_build_object('campo', 'motivo_reabertura'",
    );
    // O resto como antes: coordenação, situação, conflito de versão.
    expect(corpo).toContain(
      'perform private."FC_EXIGIR_COORD_FICHAS"(v_f."CO_MONITORAMENTO");',
    );
    expect(corpo).toContain("using errcode = 'PT409'");
    expect(MIGRATION).toContain(
      "revoke all on function public.reabrir_ficha(uuid, integer, text, text) from public, anon;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.reabrir_ficha(uuid, integer, text, text) to authenticated;",
    );
    expect(CONTRATO_RPC.reabrir_ficha.argumentos).toEqual([
      "p_ficha",
      "p_versao",
      "p_motivo",
      "p_complemento",
    ]);
  });

  it("fila: distribuir, liberar e revisão só ganham o texto mínimo (2 palavras)", () => {
    for (const nome of [
      "public.distribuir_fichas",
      "public.liberar_reserva",
      "public.mandar_fichas_revisao",
    ]) {
      const nova = funcao(MIGRATION, nome);
      const anterior = funcao(ROLLBACK, nome);
      expect(nova, nome).toContain(
        'private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 2)',
      );
      expect(nova, nome).toContain("com pelo menos 2 palavras");
      expect(anterior, nome).not.toContain("FC_MOTIVO_PARECE_TEXTO");
      expect(semMotivo(nova), nome).toBe(semMotivo(anterior));
    }
  });

  it("rollback devolve a reabertura livre e tira as funções novas", () => {
    expect(ROLLBACK).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(ROLLBACK).toContain(
      "drop function if exists public.reabrir_ficha(uuid, integer, text, text);",
    );
    const antiga = funcao(ROLLBACK, "public.reabrir_ficha");
    expect(antiga).toContain("(p_ficha uuid, p_versao integer, p_motivo text)");
    expect(antiga).toContain(
      "if length(v_motivo) not between 10 and 2000 then",
    );
    expect(ROLLBACK).toContain(
      "grant execute on function public.reabrir_ficha(uuid, integer, text) to authenticated;",
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_MOTIVO_REABERTURA"(text);',
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_MOTIVO_PARECE_TEXTO"(text, integer);',
    );
  });

  it("o ensaio leva o mesmo corpo, testa a chamada antiga e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + 8,
      MIGRATION.lastIndexOf("\ncommit;"),
    );
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO).toContain(
      "('chamada antiga', 'Correção da experiência', null::text)",
    );
    expect(ENSAIO).toContain("exception when sqlstate '22023' then");
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    expect(ENSAIO.trimEnd()).toMatch(/\nrollback;$/);
  });
});
