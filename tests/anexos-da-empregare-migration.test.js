import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration dos anexos da Empregare (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Invariantes estáticas: tabela MAD
  com RLS e sem grant, RPCs do robô só para o service_role, a ficha como única
  leitura dos links para pessoas, o mesmo formato de link no banco, no robô e
  na tela, rollback com o corpo de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008160000_anexos_da_empregare.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261007160000_link_do_candidato_na_empregare.sql",
);
const ROBO = ler("scripts/robo-empregare/anexos_empregare.py");
const TELA = ler("src/lib/avaliacao-documental/link-do-anexo.ts");

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const OBTER =
  "create or replace function public.obter_ficha_analise(p_ficha uuid)";

describe("robô da Empregare: anexos do questionário", () => {
  it("tabela no padrão MAD, com RLS, sem grant e comentada", () => {
    for (const trecho of [
      'create table public."TB_EMPREGARE_ANEXO"',
      'constraint "PK_TB_EMPREGARE_ANEXO" primary key ("CO_EMPREGARE_ANEXO")',
      'constraint "UK_EMPREGANEXO_CANDPERGUNTA" unique ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA")',
      'constraint "FK_EMPREGCAND_EMPREGANEXO"',
      'constraint "FK_SYNCEMPREG_EMPREGANEXO"',
      "constraint \"CK_EMPREGANEXO_TPLINK\" check (\"TP_LINK\" in ('ARQUIVO', 'QUESTIONARIO'))",
      'create index "IN_FKEMPREGANEXO_COSYNC"',
      'alter table public."TB_EMPREGARE_ANEXO" enable row level security;',
      'revoke all on public."TB_EMPREGARE_ANEXO" from public, anon, authenticated;',
      'comment on table public."TB_EMPREGARE_ANEXO" is',
      'comment on column public."TB_EMPREGARE_ANEXO"."DS_LINK" is',
    ])
      expect(MIGRATION).toContain(trecho);
    expect(MIGRATION).not.toMatch(/grant [^;]* on (table )?public\."TB_/i);
  });

  it("RPCs do robô só para o service_role; gravar exige a execução em andamento", () => {
    for (const assinatura of [
      "public.gravar_anexos_empregare(text, text, jsonb)",
      "public.anexos_capturados_empregare(text, integer)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to service_role;`,
      );
    }
    const gravar = corpoDaFuncao(
      MIGRATION,
      "create function public.gravar_anexos_empregare(",
    );
    expect(gravar).toContain(
      'perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);',
    );
    expect(gravar).toContain('on c."CO_VAGA" = p_vaga');
    expect(gravar).toContain('x."CO_SYNC" is distinct from p_sync');
    // A consulta do robô devolve só códigos, nunca links.
    const capturados = corpoDaFuncao(
      MIGRATION,
      "create function public.anexos_capturados_empregare(",
    );
    expect(capturados).not.toContain("DS_LINK");
  });

  it("a ficha devolve os anexos e mantém o resto de antes", () => {
    const agora = corpoDaFuncao(MIGRATION, OBTER);
    const antes = corpoDaFuncao(ANTERIOR, OBTER);
    expect(agora).toContain("'anexos', coalesce((");
    expect(agora).toContain('from public."TB_EMPREGARE_ANEXO" a');
    expect(agora).toContain('v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);');
    const semAnexos = agora.replace(
      /,\n\s*'anexos', coalesce\(\([\s\S]*?'\[\]'::json\)\)/,
      ")",
    );
    const normalizar = (t) =>
      t
        .replace(/--[^\n]*\n/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
    expect(normalizar(semAnexos)).toBe(normalizar(antes));
  });

  it("o mesmo formato de link no banco, no robô e na tela", () => {
    expect(MIGRATION).toContain(
      "'^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[^[:space:]\"''<>`\\\\]*$'",
    );
    expect(MIGRATION).toContain(
      "'^https://corporate\\.empregare\\.com/[A-Za-z0-9_.~=&%|+/:?#-]*$'",
    );
    expect(ROBO).toContain(
      'LINK_DO_ARQUIVO = re.compile(r"^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[^\\s\\"\'<>`\\\\]*$")',
    );
    expect(ROBO).toContain(
      'LINK_DA_PAGINA = re.compile(r"^https://corporate\\.empregare\\.com/[A-Za-z0-9_.~=&%|+/:?#-]*$")',
    );
    expect(TELA).toContain(
      "/^https:\\/\\/[A-Za-z0-9.-]+(:[0-9]{1,5})?\\/[^\\s\"'<>`\\\\]*$/;",
    );
    expect(TELA).toContain(
      "/^https:\\/\\/corporate\\.empregare\\.com\\/[A-Za-z0-9_.~=&%|+/:?#-]*$/",
    );
  });

  it("rollback volta a ficha ao corpo de 20261007160000 e apaga o que entrou", () => {
    expect(corpoDaFuncao(ROLLBACK, OBTER)).toBe(corpoDaFuncao(ANTERIOR, OBTER));
    for (const trecho of [
      "drop function if exists public.anexos_capturados_empregare(text, integer);",
      "drop function if exists public.gravar_anexos_empregare(text, text, jsonb);",
      'drop table if exists public."TB_EMPREGARE_ANEXO";',
    ])
      expect(ROLLBACK).toContain(trecho);
  });

  it("o ensaio aplica o mesmo corpo da migration e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + "\nbegin;\n".length,
      MIGRATION.lastIndexOf("\ncommit;"),
    ).trim();
    const noEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (início) ═══") +
        "-- ═══ CORPO DA MIGRATION (início) ═══".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    ).trim();
    expect(noEnsaio).toBe(corpo);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });
});
