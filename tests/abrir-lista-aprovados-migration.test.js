import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A abertura da Lista de aprovados numa chamada (diagnóstico de desempenho,
  29/10/2026): uma função que junta as RPCs de leitura da página, cada parte
  com a permissão e o erro de sempre.
*/
const NOME = "20261029133000_abrir_lista_aprovados_numa_chamada.sql";
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const sql = ler(`supabase/migrations/${NOME}`);
const codigo = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

describe(NOME, () => {
  it("numa transação, só acrescenta (sem drop nem alteração de dados)", () => {
    expect(sql.trim()).toMatch(/^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/);
    expect(codigo).not.toMatch(/\bdrop\b/i);
    expect(codigo).not.toMatch(
      /\b(insert|update|delete)\b\s+(into|public|from)/i,
    );
  });

  it("o pacote vem do instantâneo, pela RPC de sempre, com a versão da tela", () => {
    expect(codigo).toContain(
      "public.listar_candidatos_aprovados_compacto(v_area, p_versao)",
    );
    expect(codigo).toContain('private."TA_CANDIDATO_APROVADO_AREA"');
  });

  it("cada parte tem a permissão de sempre e o erro vai para erros.<parte>", () => {
    for (const parte of [
      "pacote",
      "listas",
      "configuracao",
      "anexos",
      "convocacoes",
      "pendencias",
    ])
      expect(codigo).toContain(
        `jsonb_build_object('${parte}', jsonb_build_object('code', sqlstate, 'message', sqlerrm))`,
      );
    expect(codigo).toMatch(
      /private\.pode_recurso\('aprovados'\) or private\.pode_recurso\('importacao', 2\)/,
    );
    expect(codigo).toMatch(/private\.pode_recurso\('aprovados', 1\)/);
    expect(
      codigo.match(/private\."FC_EDITAIS_VISIVEIS"\(\)\) is null/g),
    ).toHaveLength(2);
    expect(codigo).toContain("public.listar_modelos_convocacao()");
    expect(codigo).toContain("public.listar_configuracao_convocacao()");
    expect(codigo).toContain("public.listar_convocacoes_aprovados(v_area)");
    expect(codigo).toContain(
      "public.listar_pendencias_do_edital(v_area, null)",
    );
  });

  it("as colunas das listas e dos anexos são as das RPCs de antes", () => {
    for (const coluna of [
      "lista_id",
      "edital_id",
      "edital",
      "unidade",
      "ativo",
      "arquivo_nome",
      "arquivo_path",
      "importado_em",
      "total_candidatos",
      "importado_por_email",
      "importado_por_nome",
      "origem",
      "lista_classificacao_id",
      "anexo_id",
      "candidato_id",
      "tamanho",
      "incluido_em",
    ])
      expect(codigo).toContain(`'${coluna}',`);
  });

  it("só para quem entrou; ensaio termina em rollback; rollback derruba a função", () => {
    expect(codigo).toMatch(
      /revoke all on function public\.abrir_lista_aprovados\(text, text, boolean\) from public, anon;/,
    );
    expect(codigo).toMatch(
      /grant execute on function public\.abrir_lista_aprovados\(text, text, boolean\) to authenticated;/,
    );
    expect(ler(`supabase/ensaios/${NOME}`).trim()).toMatch(/rollback;$/);
    expect(ler(`supabase/rollback/${NOME}`)).toContain(
      "drop function if exists public.abrir_lista_aprovados(text, text, boolean);",
    );
    expect(CONTRATO_RPC.abrir_lista_aprovados.argumentos).toEqual([
      "p_area",
      "p_versao",
      "p_com_candidatos",
    ]);
  });
});
