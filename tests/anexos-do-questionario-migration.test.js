import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration dos anexos do questionário na Empregare (ainda não aplicada: o
  ensaio begin…rollback está em supabase/ensaios/). Invariantes estáticas:
  tabelas MAD com RLS e sem grant, RPC do robô só para o service_role, a ficha
  como única leitura dos links para pessoas, o mesmo formato de link no banco,
  no robô e na tela, rollback com o corpo de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008160000_anexos_do_questionario_na_empregare.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261007160000_link_do_candidato_na_empregare.sql",
);
const ROBO = ler("scripts/robo-empregare/anexos_empregare.py");
const TELA = ler("src/lib/avaliacao-documental/anexo-na-empregare.ts");

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const OBTER =
  "create or replace function public.obter_ficha_analise(p_ficha uuid)";
const ARQUIVO = "GetViewerLogArquivo\\?[A-Za-z0-9_.~=&%|+/:-]+$";
const IMPRESSAO = "PrintResult\\?[A-Za-z0-9_.~=&%|+/:-]+$";

describe("robô da Empregare: anexos do questionário", () => {
  it("tabelas no padrão MAD, com RLS, sem grant e comentadas", () => {
    for (const trecho of [
      'create table public."TB_EMPREGARE_RESPOSTA"',
      'create table public."TB_EMPREGARE_ANEXO"',
      'constraint "UK_EMPREGRESP_CANDRESPOSTA" unique ("CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO")',
      'constraint "UK_EMPREGANEXO_RESPPERGARQ" unique ("CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO")',
      'constraint "FK_EMPREGCAND_EMPREGRESP"',
      'constraint "FK_EMPREGRESP_EMPREGANEXO"',
      'constraint "CK_EMPREGANEXO_TPLINK" check ("TP_LINK" in (\'ARQUIVO_EMPREGARE\'))',
      'create index "IN_FKEMPREGRESP_COSYNC"',
      'alter table public."TB_EMPREGARE_RESPOSTA" enable row level security;',
      'alter table public."TB_EMPREGARE_ANEXO" enable row level security;',
      'revoke all on public."TB_EMPREGARE_RESPOSTA", public."TB_EMPREGARE_ANEXO" from public, anon, authenticated;',
      'comment on column public."TB_EMPREGARE_ANEXO"."DS_LINK" is',
      'comment on column public."TB_EMPREGARE_ANEXO"."DS_COLUNA" is',
    ])
      expect(MIGRATION).toContain(trecho);
    expect(MIGRATION).not.toMatch(/grant [^;]* on (table )?public\."TB_/i);
  });

  it("RPC do robô só para o service_role, com a execução em andamento e só candidatos da vaga", () => {
    const assinatura = "public.gravar_anexos_empregare(text, text, jsonb)";
    expect(MIGRATION).toContain(
      `revoke all on function ${assinatura} from public, anon, authenticated;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${assinatura} to service_role;`,
    );
    const gravar = corpoDaFuncao(
      MIGRATION,
      "create function public.gravar_anexos_empregare(",
    );
    expect(gravar).toContain(
      'perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);',
    );
    expect(gravar).toContain(
      'where c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = btrim(v_r ->> \'codigo\')',
    );
    expect(gravar).toContain(
      'delete from public."TB_EMPREGARE_ANEXO" a where a."CO_EMPREGARE_RESPOSTA" = v_resp;',
    );
  });

  it("a ficha devolve respostas e anexos e mantém o resto de antes", () => {
    const agora = corpoDaFuncao(MIGRATION, OBTER);
    const antes = corpoDaFuncao(ANTERIOR, OBTER);
    expect(agora).toContain("'respostas', coalesce((");
    expect(agora).toContain("'anexos', coalesce((");
    expect(agora).toContain('v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);');
    const semAnexos = agora.replace(
      /,\n\s*'respostas', coalesce\(\([\s\S]*?'\[\]'::json\),\n\s*'anexos', coalesce\(\([\s\S]*?'\[\]'::json\)\)/,
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
    for (const fim of [ARQUIVO, IMPRESSAO]) {
      expect(MIGRATION).toContain(fim);
      expect(ROBO).toContain(fim);
    }
    expect(TELA).toContain(
      "\\/Company\\/VacancyTests\\/GetViewerLogArquivo\\?[A-Za-z0-9_.~=&%|+/:-]+$/",
    );
    expect(TELA).toContain(
      "\\/Company\\/VacancyTests\\/PrintResult\\?[A-Za-z0-9_.~=&%|+/:-]+$/",
    );
  });

  it("rollback volta a ficha ao corpo de 20261007160000 e apaga o que entrou", () => {
    expect(corpoDaFuncao(ROLLBACK, OBTER)).toBe(corpoDaFuncao(ANTERIOR, OBTER));
    for (const trecho of [
      "drop function if exists public.gravar_anexos_empregare(text, text, jsonb);",
      'drop table if exists public."TB_EMPREGARE_ANEXO";',
      'drop table if exists public."TB_EMPREGARE_RESPOSTA";',
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
