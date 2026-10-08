import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration das respostas do questionário na Empregare (ainda não aplicada: o
  ensaio begin…rollback está em supabase/ensaios/). Invariantes estáticas:
  colunas MAD com CK, RPC do robô só para o service_role, a ficha como única
  leitura para pessoas, o mesmo link no banco, no robô e na tela, rollback
  com o corpo de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008160000_respostas_do_questionario_na_empregare.sql";
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

describe("robô da Empregare: respostas do questionário", () => {
  it("colunas no padrão MAD, com CK e comentário, sem grant", () => {
    for (const trecho of [
      'add column "CO_RESPOSTA_QUESTIONARIO" varchar(20)',
      'add column "DT_CAPTURA_RESPOSTA" timestamptz',
      'add constraint "CK_EMPREGCAND_CORESPOSTAQUEST" check (\n    "CO_RESPOSTA_QUESTIONARIO" is null or "CO_RESPOSTA_QUESTIONARIO" ~ \'^[0-9]{1,20}$\')',
      'comment on column public."TB_EMPREGARE_CANDIDATO"."CO_RESPOSTA_QUESTIONARIO" is',
      'comment on column public."TB_EMPREGARE_CANDIDATO"."DT_CAPTURA_RESPOSTA" is',
    ])
      expect(MIGRATION).toContain(trecho);
    expect(MIGRATION).not.toMatch(/grant [^;]* on (table )?public\."TB_/i);
  });

  it("RPC do robô só para o service_role, com a execução em andamento e só candidatos da vaga", () => {
    const assinatura = "public.gravar_respostas_empregare(text, text, jsonb)";
    expect(MIGRATION).toContain(
      `revoke all on function ${assinatura} from public, anon, authenticated;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${assinatura} to service_role;`,
    );
    const gravar = corpoDaFuncao(
      MIGRATION,
      "create function public.gravar_respostas_empregare(",
    );
    expect(gravar).toContain(
      'perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);',
    );
    expect(gravar).toContain(
      'where c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = r.codigo',
    );
    expect(gravar).toContain("btrim(x.resposta) ~ '^[0-9]{1,20}$'");
  });

  it("a ficha devolve o link das respostas e mantém o resto de antes", () => {
    const agora = corpoDaFuncao(MIGRATION, OBTER);
    const antes = corpoDaFuncao(ANTERIOR, OBTER);
    expect(agora).toContain(
      "then 'https://corporate.empregare.com/empresa/questionarios/imprimir/'\n                                                       || c.\"CO_RESPOSTA_QUESTIONARIO\" || '|' end)",
    );
    expect(agora).toContain('v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);');
    const semRespostas = agora.replace(
      /,\n\s*'resposta_questionario'[\s\S]*?\|\| '\|' end\)/,
      ")",
    );
    const normalizar = (t) =>
      t
        .replace(/--[^\n]*\n/g, "\n")
        .replace(/comment on function[\s\S]*$/, "")
        .replace(/\s+/g, " ")
        .trim();
    expect(normalizar(semRespostas)).toBe(normalizar(antes));
  });

  it("o mesmo link das respostas no banco, no robô e na tela", () => {
    expect(ROBO).toContain(
      'return f"{URL_BASE}/empresa/questionarios/imprimir/{r}|" if RESPOSTA.match(r) else None',
    );
    expect(ROBO).toContain('RESPOSTA = re.compile(r"^[0-9]{1,20}$")');
    expect(TELA).toContain(
      "/^https:\\/\\/corporate\\.empregare\\.com\\/empresa\\/questionarios\\/imprimir\\/[0-9]{1,20}\\|",
    );
  });

  it("rollback volta a ficha ao corpo de 20261007160000 e apaga o que entrou", () => {
    expect(corpoDaFuncao(ROLLBACK, OBTER)).toBe(corpoDaFuncao(ANTERIOR, OBTER));
    for (const trecho of [
      "drop function if exists public.gravar_respostas_empregare(text, text, jsonb);",
      'drop column if exists "CO_RESPOSTA_QUESTIONARIO";',
      'drop column if exists "DT_CAPTURA_RESPOSTA",',
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
