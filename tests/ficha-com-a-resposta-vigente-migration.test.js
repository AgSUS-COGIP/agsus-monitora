import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration da ficha com a resposta vigente do questionário (ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/). Invariantes
  estáticas: a vigente é a mais nova com pergunta lida numa função privada (MAD), a ficha
  devolve respostas e anexos só dela e os outros envios à parte (o resto igual
  a 20261009190000), rollback com o corpo de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009210000_ficha_com_a_resposta_vigente.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261009190000_sugestoes_da_ficha.sql",
);
const TELA = ler("src/lib/avaliacao-documental/anexo-na-empregare.ts");

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const OBTER =
  "create or replace function public.obter_ficha_analise(p_ficha uuid)";
const VIGENTE = 'private."FC_RESPOSTA_VIGENTE_EMPREGARE"(uuid)';

describe("ficha com a resposta vigente do questionário", () => {
  it("a vigente é a mais nova com pergunta lida (a vazia só sem outra), numa função privada comentada e sem grant", () => {
    const funcao = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_RESPOSTA_VIGENTE_EMPREGARE"(p_candidato uuid)',
    );
    expect(funcao).toContain("set search_path to ''");
    expect(funcao).toContain(
      'order by (r."QT_PERGUNTA" > 0) desc, r."CO_RESPOSTA_QUESTIONARIO"::numeric desc',
    );
    expect(funcao).toContain("limit 1;");
    expect(MIGRATION).toContain(`comment on function ${VIGENTE} is`);
    expect(MIGRATION).toContain(
      `revoke all on function ${VIGENTE} from public, anon, authenticated;`,
    );
    expect(MIGRATION).not.toMatch(/grant [^;]*FC_RESPOSTA_VIGENTE_EMPREGARE/i);
  });

  it("a ficha devolve só a vigente e os outros envios à parte; o resto igual a 20261009190000", () => {
    const agora = corpoDaFuncao(MIGRATION, OBTER);
    const antes = corpoDaFuncao(ANTERIOR, OBTER);
    expect(agora).toContain(
      'v_envio := private."FC_RESPOSTA_VIGENTE_EMPREGARE"(v_f."CO_EMPREGARE_CANDIDATO");',
    );
    expect(
      agora.match(/where r\."CO_EMPREGARE_RESPOSTA" = v_envio\)/g),
    ).toHaveLength(2);
    expect(agora).toContain("'envios_anteriores', coalesce((");
    expect(agora).toContain(
      'r."CO_EMPREGARE_RESPOSTA" is distinct from v_envio',
    );
    expect(agora).toContain('r."QT_PERGUNTA" > 0');
    expect(agora).toContain('v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);');
    // Sem as mudanças, o corpo é o de antes.
    const desfeito = agora
      .replace("\n  v_envio uuid;", "")
      .replace(/\n {2}v_envio := [^\n]*/, "")
      .replace(
        /-- Links da Empregare[^\n]*\n\s*-- do questionário[^\n]*/,
        "-- Links da Empregare (dado restrito, só aqui): o do candidato, o das candidaturas, os das respostas e dos anexos.",
      )
      .replace(
        /where r\."CO_EMPREGARE_RESPOSTA" = v_envio\), '\[\]'::json\),\n\s*-- As outras respostas[\s\S]*?and r\."QT_PERGUNTA" > 0\), '\[\]'::json\)\)/,
        `where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"), '[]'::json))`,
      )
      .replace(
        `where r."CO_EMPREGARE_RESPOSTA" = v_envio), '[]'::json),`,
        `where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"), '[]'::json),`,
      );
    expect(desfeito).toBe(antes);
    // A tela lê o que a RPC devolve.
    expect(TELA).toContain("envios_anteriores");
    expect(TELA).toContain("link_impressao");
  });

  it("rollback volta a ficha ao corpo de 20261009190000 e apaga a função", () => {
    expect(corpoDaFuncao(ROLLBACK, OBTER)).toBe(corpoDaFuncao(ANTERIOR, OBTER));
    expect(ROLLBACK).toContain(`drop function if exists ${VIGENTE};`);
    expect(ROLLBACK.indexOf(OBTER)).toBeLessThan(
      ROLLBACK.indexOf("drop function if exists"),
    );
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
    expect(ENSAIO).toContain("'6452621'");
    expect(ENSAIO).toContain(
      "E4: a resposta vazia aparece nos envios anteriores",
    );
  });
});
