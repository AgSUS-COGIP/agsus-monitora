import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration dos casos dos avisos de conferência (20261007120000; o ensaio
  begin…rollback está em supabase/ensaios/). Invariantes estáticas: tabela no
  padrão MAD sem acesso direto, casos sem dado pessoal, leitura com sessão e
  com as mesmas checagens dos avisos, nome só de análise visível, sem CPF,
  rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007120000_casos_dos_avisos_de_conferencia.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const TABELA = "TB_CASO_AVISO_CONFERENCIA";
const LEITURA =
  "listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)";

const corpoDaFuncao = (cabeca) => {
  const inicio = MIGRATION.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

describe("casos dos avisos: tabela no padrão MAD", () => {
  it("prefixos, colunas comentadas, constraints nomeadas e RLS sem grant", () => {
    const inicio = MIGRATION.indexOf(`create table public."${TABELA}" (`);
    expect(inicio).toBeGreaterThan(-1);
    const bloco = MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
    expect(bloco).toContain(`constraint "PK_${TABELA}" primary key`);
    const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map((m) => m[1]);
    expect(colunas).toHaveLength(6);
    for (const coluna of colunas) {
      expect(coluna).toMatch(/^(CO|DS|NU)_[A-Z_]+$/);
      expect(MIGRATION).toContain(
        `comment on column public."${TABELA}"."${coluna}" is`,
      );
    }
    for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g)) {
      expect(nome.length, nome).toBeLessThanOrEqual(30);
      expect(nome).toMatch(/^(PK|FK|CK)_/);
      if (!nome.startsWith("PK_"))
        expect(MIGRATION).toContain(
          `comment on constraint "${nome}" on public."${TABELA}"`,
        );
    }
    expect(bloco).toContain("on delete cascade");
    expect(bloco).toContain(`"NU_CASO" between 1 and 5000`);
    expect(MIGRATION).toContain(
      `alter table public."${TABELA}" enable row level security;`,
    );
    expect(MIGRATION).toContain(
      `revoke all on public."${TABELA}" from public, anon, authenticated;`,
    );
    expect(MIGRATION).not.toMatch(/grant [^;]*on public\."T[BLH]_/i);
    expect(MIGRATION).toContain(
      'comment on index public."IN_ANALISECURR_IDORIGEM" is',
    );
  });

  it("casos sem dado pessoal: códigos de identificador, detalhe sem @ nem 11 dígitos", () => {
    const gravar = corpoDaFuncao(
      "create or replace function public.gravar_avisos_conferencia(",
    );
    expect(gravar).toContain("jsonb_array_length(v_casos) > 5000");
    expect(gravar).toContain("(c ->> 'codigo') ~ '[0-9]{11}'");
    expect(gravar).toContain("(d.value #>> '{}') ~ '[0-9]{11}'");
    expect(gravar).toContain('delete from public."TB_CASO_AVISO_CONFERENCIA"');
    // A validação dos exemplos e do resumo continua.
    expect(gravar).toContain("(e #>> '{}') ~ '[0-9]{11}'");
    expect(gravar).toContain('private."FC_TEXTO_SEGURO_DO_AVISO"(v_resumo)');
    expect(MIGRATION).toContain(
      "grant execute on function public.gravar_avisos_conferencia(text, jsonb) to service_role;",
    );
  });
});

describe("casos dos avisos: leitura", () => {
  it("SECURITY DEFINER, search_path vazio, sessão, quem vê o aviso, no contrato", () => {
    const corpo = corpoDaFuncao(
      "create function public.listar_casos_aviso_conferencia(",
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
    expect(corpo).toContain("least(greatest(coalesce(p_limite, 50), 1), 1000)");
    // Sem CPF (nem o hash) e sem e-mail na saída.
    expect(corpo).not.toMatch(/cpf|email/i);
    expect(MIGRATION).toContain(
      `revoke all on function public.${LEITURA} from public, anon;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function public.${LEITURA} to authenticated;`,
    );
    expect(CONTRATO_RPC.listar_casos_aviso_conferencia.argumentos).toEqual([
      "p_aviso",
      "p_busca",
      "p_area",
      "p_modulo",
      "p_limite",
      "p_deslocamento",
    ]);
  });

  it("nome da análise só com a área e o recorte de coordenação de quem lê", () => {
    const ver = corpoDaFuncao(
      'create function private."FC_PODE_VER_ANALISE_DO_AVISO"',
    );
    expect(ver).toContain("private.is_master()");
    expect(ver).toContain('private."FC_PODE_AREA"(p_area)');
    expect(ver).toContain('private."FC_EDITAIS_VISIVEIS"() is null');
    expect(ver).toContain('private."FC_EDITAIS_NORM_VISIVEIS"()');
    expect(ver).toContain('private."FC_UNIDADES_NORM_VISIVEIS"()');
  });

  it("funções privadas sem execução pública e no rollback", () => {
    const privadas = [
      ...MIGRATION.matchAll(/create function private\."([A-Z_]+)"\(([^)]*)\)/g),
    ];
    expect(privadas).toHaveLength(2);
    for (const [, nome, assinatura] of privadas) {
      const tipos = assinatura
        .split(",")
        .filter((a) => a.trim())
        .map((a) => a.trim().split(" ").pop())
        .join(", ");
      expect(MIGRATION).toContain(
        `revoke all on function private."${nome}"(${tipos}) from public, anon, authenticated;`,
      );
      expect(ROLLBACK).toContain(
        `drop function if exists private."${nome}"(${tipos});`,
      );
    }
  });
});

describe("rollback e ensaio dos casos", () => {
  it("rollback derruba a leitura, a tabela e o índice e volta a gravação antiga", () => {
    expect(ROLLBACK).toContain(`drop function if exists public.${LEITURA};`);
    expect(ROLLBACK).toContain(`drop table if exists public."${TABELA}";`);
    expect(ROLLBACK).toContain(
      'drop index if exists public."IN_ANALISECURR_IDORIGEM";',
    );
    expect(ROLLBACK).toContain(
      "create or replace function public.gravar_avisos_conferencia(",
    );
    expect(ROLLBACK).not.toContain("v_casos");
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
    expect(ENSAIO).toContain("'Ensaio Admin', 'admin', true");
    for (const marca of [
      "FALHOU E2: aceitou nome no código do caso",
      "FALHOU E2: aceitou CPF no detalhe",
      "FALHOU E4: quem não tem a área leu os casos",
      "FALHOU E4: busca pelo nome sem acento",
    ])
      expect(ENSAIO).toContain(marca);
  });
});
