import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261010100000: na lista do robô da leitura dos arquivos, o já lido
  com extrator de outra versão vem primeiro, e p_so_relidos traz só o já lido
  (nunca anexo novo). Invariantes estáticas: o corpo é o de 20261009220000 com
  só o filtro dos pendentes e a ordem mudados, a assinatura de 5 argumentos sai,
  grants só para o service_role, rollback com o corpo de antes, ensaio com o
  mesmo corpo, e o robô e o workflow passam o argumento novo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261010100000_leitura_relidos_primeiro.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTES = ler(
  "supabase/migrations/20261009220000_leitura_dos_arquivos.sql",
);
const ROBO = ler("scripts/robo-empregare/leitura_de_arquivos.py");
const WORKFLOW = ler(".github/workflows/leitura-de-arquivos.yml");

const VELHA =
  "public.listar_anexos_para_leitura(text[], text, boolean, integer, text)";
const NOVA =
  "public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean)";
const funcao = (texto) => {
  const inicio = texto.indexOf(
    "create function public.listar_anexos_para_leitura(",
  );
  expect(inicio).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

describe("leitura dos arquivos — relidos primeiro e p_so_relidos", () => {
  it("troca a assinatura, com grants só para o service_role", () => {
    expect(MIGRATION).toContain(`drop function if exists ${VELHA};`);
    expect(MIGRATION).toContain("p_so_relidos boolean default false");
    expect(MIGRATION).toContain(
      `revoke all on function ${NOVA} from public, anon, authenticated;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${NOVA} to service_role;`,
    );
    expect(MIGRATION).toContain(`comment on function ${NOVA} is`);
    expect(MIGRATION).toMatch(/security definer\nset search_path to ''/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("muda só o filtro dos pendentes e a ordem (o resto é o corpo de antes)", () => {
    const nova = funcao(MIGRATION);
    expect(nova).toContain(
      "and (not coalesce(p_so_relidos, false) or situacao is not null)",
    );
    expect(nova).toContain(
      "order by coalesce(pd.situacao <> 'ERRO' and pd.versao <> p_versao, false) desc,",
    );
    // Desfazendo as quatro mudanças, sobra exatamente o corpo de 20261009220000.
    const desfeita = nova
      .replace(
        "p_sal text,\n                                                   p_so_relidos boolean default false)",
        "p_sal text)",
      )
      .replace(
        "where (coalesce(p_forcar, false) or situacao is null or versao <> p_versao or situacao = 'ERRO')\n" +
          "         -- Só relidos: o que já foi lido (com outra versão, com erro ou, com p_forcar, todos); nunca o novo.\n" +
          "         and (not coalesce(p_so_relidos, false) or situacao is not null)",
        "where coalesce(p_forcar, false) or situacao is null or versao <> p_versao or situacao = 'ERRO'",
      )
      .replace(
        "-- Primeiro o já lido com extrator de outra versão (a releitura troca o dado antigo), depois quem\n" +
          "      -- tem ficha, o que nunca foi lido e, por último, erro.",
        "-- Primeiro quem tem ficha, depois o que nunca foi lido, versão antiga e, por último, erro.",
      )
      .replace(
        "order by coalesce(pd.situacao <> 'ERRO' and pd.versao <> p_versao, false) desc,\n                                  pd.com_ficha desc,",
        "order by pd.com_ficha desc,",
      );
    expect(desfeita).toBe(funcao(ANTES));
  });

  it("rollback volta o corpo de antes e o ensaio usa o corpo da migration", () => {
    expect(ROLLBACK).toContain(`drop function if exists ${NOVA};`);
    expect(funcao(ROLLBACK)).toBe(funcao(ANTES));
    expect(ROLLBACK).toContain(
      `grant execute on function ${VELHA} to service_role;`,
    );
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("begin;\n") + "begin;\n".length,
      MIGRATION.lastIndexOf("commit;"),
    ).trim();
    const noEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("═══ CORPO DA MIGRATION (início) ═══\n") +
        "═══ CORPO DA MIGRATION (início) ═══\n".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    ).trim();
    expect(noEnsaio).toBe(corpo);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    for (const e of ["E1 ok", "E2 ok", "E3 ok", "E4 ok"])
      expect(ENSAIO).toContain(e);
  });

  it("o robô e o workflow passam p_so_relidos", () => {
    expect(ROBO).toContain('"p_so_relidos"');
    expect(ROBO).toContain('"--so-relidos"');
    expect(WORKFLOW).toMatch(/so_relidos:\n\s+description:/);
    expect(WORKFLOW).toContain(
      "SO_RELIDOS: ${{ inputs.so_relidos && 'sim' || 'nao' }}",
    );
  });
});
