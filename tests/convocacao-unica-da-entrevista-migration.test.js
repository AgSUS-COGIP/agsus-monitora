import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da convocação única para a entrevista (ainda não aplicada: o
  ensaio begin…rollback está em supabase/ensaios/). Aqui, as invariantes
  estáticas: a convocação de Entrevistas sai da lista CONVOCACAO vigente da
  Classificação (nada de ranking próprio, vagas digitadas ou regra própria),
  RPCs SECURITY DEFINER com search_path vazio e o porteiro de sempre, nada
  apagado, contrato de RPC, rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005150000_convocacao_unica_da_entrevista.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDaFuncao = (cabeca, texto = MIGRATION) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();
const argumentosDe = (corpo) =>
  corpo
    .slice(corpo.indexOf("(") + 1, corpo.indexOf(")"))
    .split(",")
    .map((a) => a.trim().split(" ")[0]);

const RPCS = {
  obter_entrevistas_do_edital: {
    cabeca: "create or replace function public.obter_entrevistas_do_edital(",
    assinatura: "uuid",
    minimo: 1,
  },
  configurar_entrevista_edital: {
    cabeca: "create or replace function public.configurar_entrevista_edital(",
    assinatura: "uuid, jsonb",
    minimo: 2,
  },
  convocar_para_entrevista: {
    cabeca: "create function public.convocar_para_entrevista(",
    assinatura: "uuid, uuid, uuid[]",
    minimo: 2,
  },
};

describe("migration da convocação única: as RPCs", () => {
  it.each(Object.entries(RPCS))(
    "%s: SECURITY DEFINER, search_path vazio, porteiro das entrevistas no nível certo, comentário e contrato",
    (nome, { cabeca, assinatura, minimo }) => {
      const corpo = corpoDaFuncao(cabeca);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain(
        `private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, ${minimo})`,
      );
      expect(MIGRATION).toContain(
        `comment on function public.${nome}(${assinatura}) is`,
      );
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(argumentosDe(corpo));
    },
  );

  it("a convocação de dois argumentos sai; a nova só para authenticated", () => {
    expect(MIGRATION).toContain(
      "drop function public.convocar_para_entrevista(uuid, uuid[]);",
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.convocar_para_entrevista(uuid, uuid, uuid[]) from public, anon;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.convocar_para_entrevista(uuid, uuid, uuid[]) to authenticated, service_role;",
    );
  });

  it("convocar exige a lista vigente (40001), recusa quem está fora dela e a falta de lista (23514), uma por vez", () => {
    const corpo = corpoDaFuncao(RPCS.convocar_para_entrevista.cabeca);
    expect(corpo).toContain('private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital)');
    expect(corpo).toContain(
      "'A lista de convocação mudou na Classificação; recarregue' using errcode = '40001'",
    );
    expect(corpo).toContain(
      "'Gere a lista de convocação na Classificação antes de convocar' using errcode = '23514'",
    );
    expect(corpo).toContain('private."FC_CONVOCADOS_DA_LISTA"(v_vigente)');
    expect(corpo).toContain(
      "fora da lista de convocação vigente da Classificação', v_fora using errcode = '23514'",
    );
    expect(corpo).toContain("pg_advisory_xact_lock");
    // Nada é apagado: a convocação só insere ou reativa.
    expect(corpo).not.toMatch(/\bdelete\b/i);
  });

  it("os convocados da lista são a geral e as listas por modalidade (sem os eliminados)", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_CONVOCADOS_DA_LISTA"',
    );
    expect(corpo).toContain("v.vaga -> 'geral'");
    expect(corpo).toContain("v.vaga -> 'listas'");
    expect(corpo).not.toContain("eliminados");
  });

  it("o edital para conduzir traz a lista e a regra da Classificação, sem ranking próprio nem vagas digitadas", () => {
    const corpo = corpoDaFuncao(RPCS.obter_entrevistas_do_edital.cabeca);
    for (const chave of [
      "'lista_convocacao'",
      "'regra_classificacao'",
      "'pode_gerar_lista'",
      "'convocados'",
      "'avaliadores'",
    ])
      expect(corpo).toContain(chave);
    expect(corpo).not.toContain("'candidatos'");
    expect(corpo).not.toContain("'vagas'");
    expect(corpo).not.toContain("row_number()");
    expect(corpo).not.toContain("TB_ENTREVISTA_VAGA");
    expect(corpo).not.toContain('"DS_CONVOCACAO"');
  });

  it("a configuração não grava mais a regra de convocação nem as vagas imediatas", () => {
    const corpo = corpoDaFuncao(RPCS.configurar_entrevista_edital.cabeca);
    expect(corpo).not.toContain("TB_ENTREVISTA_VAGA");
    expect(corpo).not.toContain('"DS_CONVOCACAO" =');
    expect(corpo).not.toContain("p_dados -> 'convocacao'");
  });

  it("funções privadas sem execução pública e com comentário", () => {
    const privadas = [
      ...MIGRATION.matchAll(/create function private\."([A-Z_]+)"\(([^)]*)\)/g),
    ];
    expect(privadas).toHaveLength(2);
    for (const [, nome, assinatura] of privadas) {
      const tipos = assinatura
        .split(",")
        .map((a) => a.trim().split(" ").pop())
        .join(", ");
      expect(MIGRATION).toContain(
        `revoke all on function private."${nome}"(${tipos}) from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `comment on function private."${nome}"(${tipos}) is`,
      );
      expect(ROLLBACK).toContain(
        `drop function if exists private."${nome}"(${tipos});`,
      );
    }
  });

  it("nada é apagado: sem drop table nem delete; o que ficou sem uso ganha comentário", () => {
    expect(MIGRATION).not.toMatch(/drop table|delete from|truncate/i);
    expect(MIGRATION).toContain('comment on table public."TB_ENTREVISTA_VAGA" is');
    expect(MIGRATION).toContain(
      'comment on column public."TB_ENTREVISTA_EDITAL"."DS_CONVOCACAO" is',
    );
    expect(MIGRATION).toContain(
      'comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_CONVOCACAO_PADRAO" is',
    );
  });
});

describe("rollback e ensaio da convocação única", () => {
  it("o rollback volta a convocação de dois argumentos, o ranking próprio e a configuração antiga", () => {
    expect(ROLLBACK).toContain(
      "drop function if exists public.convocar_para_entrevista(uuid, uuid, uuid[]);",
    );
    expect(ROLLBACK).toContain(
      "create function public.convocar_para_entrevista(p_edital uuid, p_analises uuid[])",
    );
    expect(
      corpoDaFuncao(
        "create or replace function public.obter_entrevistas_do_edital(",
        ROLLBACK,
      ),
    ).toContain("'candidatos'");
    expect(
      corpoDaFuncao(
        "create or replace function public.configurar_entrevista_edital(",
        ROLLBACK,
      ),
    ).toContain("TB_ENTREVISTA_VAGA");
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("o ensaio tem o mesmo corpo da migration, entre begin e rollback", () => {
    const daMigration = corpoDaMigration(MIGRATION, "\nbegin;\n", "\ncommit;");
    const doEnsaio = corpoDaMigration(
      ENSAIO,
      "-- ═══ CORPO DA MIGRATION (início) ═══\n",
      "-- ═══ CORPO DA MIGRATION (fim) ═══",
    );
    expect(doEnsaio).toBe(daMigration);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("confere leitor, sem área, lista errada, fora da lista e lista nova; volta o papel antes de ler as tabelas e do resumo", () => {
    for (const marca of [
      "FALHOU E3: leitor convocou",
      "FALHOU E3: sem a área leu o edital",
      "FALHOU E3: convocou com outra lista",
      "FALHOU E3: convocou quem está fora da lista",
      "FALHOU E4: gravou vagas imediatas digitadas",
      "FALHOU E5: convocou pela lista antiga",
      "FALHOU E5: lista vigente ou convocados depois da lista nova",
    ])
      expect(ENSAIO).toContain(marca);
    const papel = ENSAIO.indexOf("set local role authenticated;");
    const volta = ENSAIO.indexOf("reset role;");
    const e4 = ENSAIO.indexOf("-- E4.");
    const resumo = ENSAIO.indexOf("'ENSAIO OK' as resultado");
    expect(papel).toBeGreaterThan(-1);
    expect(volta).toBeGreaterThan(papel);
    expect(e4).toBeGreaterThan(volta);
    expect(resumo).toBeGreaterThan(ENSAIO.lastIndexOf("reset role;"));
  });
});
