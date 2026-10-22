import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da integridade das listas, dos contratados que acompanham a lista
  e do recurso pelo número do edital (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Aqui, as invariantes estáticas:
  as RPCs conferem os candidatos e atualizam contratados, a busca do recurso
  pelo número do edital, funções privadas fechadas, assinaturas iguais,
  rollback com os corpos anteriores e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261006070000_integridade_das_listas_e_kpis.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDaFuncao = (cabeca, texto = MIGRATION) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
// Só o miolo (entre os $function$), para comparar com a migration de origem.
const miolo = (cabeca, texto) => {
  const corpo = corpoDaFuncao(cabeca, texto);
  return corpo
    .slice(corpo.indexOf("$function$") + "$function$".length)
    .replace(/\s+/g, " ")
    .trim();
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();
const argumentosDe = (corpo) =>
  corpo
    .slice(corpo.indexOf("(") + 1, corpo.indexOf(")"))
    .split(",")
    .map((a) => a.trim().split(" ")[0])
    .filter(Boolean);

const RPCS = {
  registrar_lista_classificacao:
    "20261002170000_classificacao_lista_da_entrevista.sql",
  publicar_lista_aprovados_da_classificacao:
    "20261005160000_lista_de_aprovados_da_classificacao.sql",
  alterar_status_candidato_aprovado:
    "20261005180000_convocado_e_carta_de_convocacao.sql",
  marcar_candidatos_convocados:
    "20261005180000_convocado_e_carta_de_convocacao.sql",
  salvar_recurso_candidato: "20261001170000_recursos_parecer_juridico.sql",
  buscar_candidatos_recurso:
    "20260929190200_recorte_por_coordenacao_nos_recursos.sql",
};
const cabecaDe = (nome) => `create or replace function public.${nome}(`;

describe("migration da integridade das listas: as RPCs", () => {
  it.each(Object.keys(RPCS))(
    "%s: SECURITY DEFINER, search_path vazio e a mesma assinatura do contrato",
    (nome) => {
      const corpo = corpoDaFuncao(cabecaDe(nome));
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(argumentosDe(corpo));
    },
  );

  it("nenhuma RPC sai nem muda de assinatura", () => {
    expect(MIGRATION).not.toMatch(/drop function/i);
    expect(MIGRATION).not.toMatch(/drop table|delete from|truncate public/i);
  });

  it("registrar e publicar conferem os candidatos do retrato", () => {
    expect(corpoDaFuncao(cabecaDe("registrar_lista_classificacao"))).toContain(
      'perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital, p_resultado);',
    );
    expect(
      corpoDaFuncao(cabecaDe("publicar_lista_aprovados_da_classificacao")),
    ).toContain(
      'perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(v_l."CO_MONITORAMENTO", v_l."DS_RESULTADO");',
    );
  });

  it("a conferência: análise ativa, da área e do número do edital; posição inteira >= 1; nota de 0 a 1000; sem repetir; 22023", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"',
    );
    expect(corpo).toContain("a.ativo");
    expect(corpo).toContain('a."CO_AREA" = v_m."CO_AREA"');
    expect(corpo).toContain(
      'private."FC_ANALISE_DO_EDITAL"(a.edital, v_m.edital)',
    );
    expect(corpo).toContain("not between 0 and 1000");
    expect(corpo).toContain("< 1");
    expect(corpo).toContain("trunc(");
    expect(corpo).toContain("having count(*) > 1");
    expect(corpo.match(/errcode = '22023'/g)?.length).toBeGreaterThanOrEqual(4);
    const criterio = corpoDaFuncao(
      'create function private."FC_ANALISE_DO_EDITAL"',
    );
    expect(criterio).toContain('private."FC_NUMERO_EDITAL"(p_edital)');
  });

  it("status, convocação e publicação atualizam contratados do edital, de forma leve", () => {
    for (const nome of [
      "alterar_status_candidato_aprovado",
      "marcar_candidatos_convocados",
      "publicar_lista_aprovados_da_classificacao",
    ])
      expect(corpoDaFuncao(cabecaDe(nome))).toContain(
        'private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(',
      );
    const leve = corpoDaFuncao(
      'create function private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"',
    );
    expect(leve).toContain("m.id = p_edital");
    expect(leve).toContain("l.edital_id = p_edital::text");
    expect(leve).toContain("('Contratado', 'Migração')");
    expect(leve).toContain("m.contratados is distinct from n.qt");
    expect(leve).not.toMatch(/advisory|TB_ANALISE_CURRICULAR|TB_SELECAO_VAGA/);
    // O recálculo em lote fica como está.
    expect(MIGRATION).not.toContain(
      'FC_ATUALIZAR_KPIS_PELA_SELECAO"()\nreturns',
    );
  });

  it("o recurso acha a análise pelo número do edital, não pelo texto idêntico", () => {
    for (const nome of [
      "salvar_recurso_candidato",
      "buscar_candidatos_recurso",
    ]) {
      const corpo = corpoDaFuncao(cabecaDe(nome));
      expect(corpo).toContain(
        'private."FC_ANALISE_DO_EDITAL"(a.edital, v_edital)',
      );
      expect(corpo).not.toContain("a.edital = v_edital");
      expect(corpo).toContain('a."CO_AREA" = v_area');
    }
  });

  it("funções privadas sem execução pública, com comentário e apagadas no rollback", () => {
    const privadas = [
      ...MIGRATION.matchAll(/create function private\."([A-Z_]+)"\(([^)]*)\)/g),
    ];
    expect(privadas.map((p) => p[1])).toEqual([
      "FC_ANALISE_DO_EDITAL",
      "FC_EXIGIR_CANDIDATOS_DO_EDITAL",
      "FC_ATUALIZAR_CONTRATADOS_DO_EDITAL",
    ]);
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
});

describe("rollback e ensaio da integridade das listas", () => {
  it.each(Object.entries(RPCS))(
    "o rollback volta %s ao corpo de %s",
    (nome, origem) => {
      const anterior = ler(`supabase/migrations/${origem}`);
      const cabecaAnterior = [
        `create or replace function public.${nome}(`,
        `create function public.${nome}(`,
      ].find((c) => anterior.includes(c));
      const ultima = anterior.lastIndexOf(cabecaAnterior);
      expect(miolo(cabecaDe(nome), ROLLBACK)).toBe(
        miolo(cabecaAnterior, anterior.slice(ultima)),
      );
    },
  );

  it("o rollback é uma transação e não deixa as novas chamadas", () => {
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    expect(ROLLBACK).not.toContain('FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_');
    expect(ROLLBACK).not.toContain('FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v_');
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
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });

  it("o ensaio reproduz a sonda, o caminho normal, contratados na hora e o recurso; volta o papel antes de ler as tabelas", () => {
    for (const marca of [
      "FALHOU E3: lista inválida registrada",
      "FALHOU E3: eliminado de outra área registrado",
      "FALHOU E3: publicação normal",
      "FALHOU E3: buscar_candidatos_recurso não achou a análise pelo número do edital",
      "FALHOU E3: recurso aceitou análise de outro número de edital",
      "FALHOU E5: o KPI de contratados do edital não acompanhou o status (sem pg_cron)",
      "FALHOU E6: publicou lista gravada com análise de outra área",
    ])
      expect(ENSAIO).toContain(marca);
    expect(ENSAIO).toContain("'nota', 999");
    const e4 = ENSAIO.indexOf("-- E4.");
    expect(e4).toBeGreaterThan(ENSAIO.indexOf("reset role;"));
    expect(ENSAIO.indexOf("'ENSAIO OK' as resultado")).toBeGreaterThan(
      ENSAIO.lastIndexOf("reset role;"),
    );
  });
});
