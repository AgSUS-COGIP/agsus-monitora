import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration que resolve os casos dos avisos de todos os módulos
  (20261007240000; o ensaio begin…rollback está em supabase/ensaios/).
  Invariantes estáticas: coluna e índices no padrão MAD, gravação com o tipo
  conhecido, leitura com a permissão do módulo sobre o registro, sem UUID na
  referência, sem CPF, rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007240000_casos_dos_avisos_resolvidos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const TABELA = "TB_CASO_AVISO_CONFERENCIA";
const LEITURA =
  "listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)";
const TIPOS = [
  "candidato_aprovado",
  "entrevista",
  "lista_classificacao",
  "ajuste_recurso",
  "vaga",
  "vaga_empregare",
];

const corpoDaFuncao = (cabeca) => {
  const inicio = MIGRATION.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

describe("casos resolvidos: estrutura no padrão MAD", () => {
  it("coluna TP_REFERENCIA comentada, check nomeado e índices comentados", () => {
    expect(MIGRATION).toContain(
      `alter table public."${TABELA}"\n  add column "TP_REFERENCIA" varchar(30)`,
    );
    expect(MIGRATION).toContain(
      `comment on column public."${TABELA}"."TP_REFERENCIA" is`,
    );
    expect(MIGRATION).toContain(
      `comment on constraint "CK_CASOAVISO_TPREFERENCIA" on public."${TABELA}" is`,
    );
    for (const tipo of TIPOS) expect(MIGRATION).toContain(`'${tipo}'`);
    for (const indice of [
      "IN_ANALISECURR_IDORIGEMTRIM",
      "IN_CANDAPROVADO_NOMENORM",
    ]) {
      expect(indice.length).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on index public."${indice}" is`);
      expect(ROLLBACK).toContain(`drop index if exists public."${indice}";`);
    }
    expect(MIGRATION).not.toMatch(/grant [^;]*on public\."T[BLH]_/i);
  });

  it("funções privadas: search_path vazio, sem execução pública e no rollback", () => {
    const privadas = [
      ...MIGRATION.matchAll(/create function private\."([A-Z_]+)"\(([^)]*)\)/g),
    ];
    expect(privadas.map((p) => p[1])).toEqual([
      "FC_PESSOA_DO_APROVADO",
      "FC_REFERENCIA_DO_CASO",
      "FC_VINCULOS_DO_APROVADO",
    ]);
    for (const [, nome, assinatura] of privadas) {
      const tipos = assinatura
        .split(",")
        .filter((a) => a.trim())
        .map((a) => a.trim().split(/\s+/).pop())
        .join(", ");
      expect(MIGRATION).toContain(
        `revoke all on function private."${nome}"(${tipos}) from public, anon, authenticated;`,
      );
      expect(ROLLBACK).toContain(
        `drop function if exists private."${nome}"(${tipos});`,
      );
      expect(MIGRATION).toContain(`comment on function private."${nome}"(`);
    }
  });
});

describe("casos resolvidos: gravação", () => {
  it("aceita só tipo conhecido e grava TP_REFERENCIA; continua sem dado pessoal", () => {
    const gravar = corpoDaFuncao(
      "create or replace function public.gravar_avisos_conferencia(",
    );
    expect(gravar).toContain(
      "(c ? 'tipo' and jsonb_typeof(c -> 'tipo') <> 'null'",
    );
    for (const tipo of TIPOS) expect(gravar).toContain(`'${tipo}'`);
    expect(gravar).toContain('"TP_REFERENCIA", "DS_DETALHE")');
    expect(gravar).toContain("nullif(x.caso ->> 'tipo', '')");
    expect(gravar).toContain("(c ->> 'codigo') ~ '[0-9]{11}'");
    expect(gravar).toContain("(d.value #>> '{}') ~ '[0-9]{11}'");
    expect(gravar).toContain('private."FC_TEXTO_SEGURO_DO_AVISO"(v_resumo)');
    expect(MIGRATION).toContain(
      "grant execute on function public.gravar_avisos_conferencia(text, jsonb) to service_role;",
    );
  });
});

describe("casos resolvidos: leitura", () => {
  it("cada registro com a permissão do módulo sobre a área e o edital dele", () => {
    const ref = corpoDaFuncao(
      'create function private."FC_REFERENCIA_DO_CASO"(',
    );
    expect(ref).toContain("security definer");
    expect(ref).toContain("set search_path to ''");
    expect(ref).toContain(
      `private."FC_PODE_VER_AVISO"('aprovados', r.area, r.edital_id)`,
    );
    expect(ref).toContain(
      `private."FC_PODE_VER_AVISO"('entrevistas', r.area, r.edital_id)`,
    );
    expect(ref).toContain(
      `private."FC_PODE_VER_AVISO"('classificacao', r.area, r.edital_id)`,
    );
    expect(ref).toContain(
      `private."FC_PODE_VER_AVISO"('cargas', r.area, r.edital_id)`,
    );
    // Fora do acesso ou removido: só o tipo e a resolução, sem dado.
    expect(ref).toContain(
      "jsonb_build_object('tipo', v_tipo, 'resolucao', 'sem_acesso')",
    );
    expect(ref).toContain(
      "jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido')",
    );
    const vinculos = corpoDaFuncao(
      'create function private."FC_VINCULOS_DO_APROVADO"(',
    );
    expect(vinculos).toContain(
      `private."FC_PODE_VER_AVISO"('aprovados', d.area, d.edital_id) as pode`,
    );
    expect(vinculos).toContain("filter (where v.pode)");
    expect(vinculos).toContain("'fora', count(*) filter (where not v.pode)");
  });

  it("SECURITY DEFINER, sessão, quem vê o aviso; sem UUID na referência e sem CPF", () => {
    const corpo = corpoDaFuncao(
      "create or replace function public.listar_casos_aviso_conferencia(",
    );
    expect(corpo).toContain("security definer");
    expect(corpo).toContain("set search_path to ''");
    expect(corpo).toContain("if auth.uid() is null then");
    expect(corpo).toContain(
      'private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")',
    );
    expect(corpo).toContain(
      'private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)',
    );
    expect(corpo).toContain('private."FC_REFERENCIA_DO_CASO"(');
    expect(corpo).toContain('private."FC_VINCULOS_DO_APROVADO"(');
    // A função de resolução não é repetida por referência (CTE materializada).
    expect(corpo).toContain("casos as materialized (");
    expect(corpo).toContain("pagina as materialized (");
    expect(corpo).toMatch(
      /then null else c\.referencia_do_caso end as referencia/,
    );
    expect(corpo).not.toMatch(/cpf|email/i);
    expect(MIGRATION).toContain(
      `revoke all on function public.${LEITURA} from public, anon;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function public.${LEITURA} to authenticated;`,
    );
  });
});

describe("rollback e ensaio", () => {
  it("rollback volta as duas funções de 20261007120000 e tira a coluna", () => {
    expect(ROLLBACK).toContain(
      `alter table public."${TABELA}" drop column if exists "TP_REFERENCIA";`,
    );
    expect(ROLLBACK).toContain(
      "create or replace function public.gravar_avisos_conferencia(",
    );
    expect(ROLLBACK).toContain(
      "create or replace function public.listar_casos_aviso_conferencia(",
    );
    expect(ROLLBACK).not.toContain('TP_REFERENCIA", "DS_DETALHE")');
    expect(ROLLBACK).not.toContain('FC_REFERENCIA_DO_CASO"(av.');
  });

  it("o ensaio tem o mesmo corpo da migration, entre begin e rollback", () => {
    expect(
      corpoDaMigration(
        ENSAIO,
        "-- ═══ CORPO DA MIGRATION (início) ═══\n",
        "-- ═══ CORPO DA MIGRATION (fim) ═══",
      ),
    ).toBe(corpoDaMigration(MIGRATION, "\nbegin;\n", "\ncommit;"));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    for (const marca of [
      "FALHOU E2: aceitou tipo desconhecido",
      "FALHOU E4: referência UUID na saída",
      "FALHOU E4: o UUID que não existe devia sair removido",
      "FALHOU E4: caso sem acesso com nome",
      "FALHOU E5: referência UUID no aviso real",
    ])
      expect(ENSAIO).toContain(marca);
  });
});
