import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Leituras por versão com marca barata (20261029170000): as sete RPCs
  `*_se_mudou` tiram a marca (versão das fontes, gravada por gatilho) ANTES de
  montar o payload. O ensaio no banco confere payload, permissão e que toda
  fonte muda a marca; aqui, o que dá para conferir no arquivo — e a trava para
  quem mudar depois uma função que essas leituras chamam.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261029170000_marca_barata_das_leituras_por_versao.sql";
const migration = ler(`supabase/migrations/${NOME}`);
const ensaio = ler(`supabase/ensaios/${NOME}`);
const rollback = ler(`supabase/rollback/${NOME}`);

const RPCS = [
  [
    "get_analises_dashboard_payload_v2_se_mudou",
    "get_analises_dashboard_payload_v2",
  ],
  ["get_entrevistas_da_area_se_mudou", "get_entrevistas_da_area"],
  ["get_selecao_da_area_se_mudou", "get_selecao_da_area"],
  [
    "listar_acompanhamento_da_visao_geral_se_mudou",
    "listar_acompanhamento_da_visao_geral",
  ],
  ["obter_regra_analise_se_mudou", "obter_regra_analise"],
  ["obter_classificacao_do_edital_se_mudou", "obter_classificacao_do_edital"],
  ["listar_avisos_conferencia_se_mudou", "listar_avisos_conferencia"],
];

/*
  O fecho do código das leituras (private."FC_FONTES_PELO_CODIGO" das funções
  de TD_LEITURA_POR_MARCA, no banco em 29/10/2026): funções e views que, se
  mudarem, podem passar a ler uma tabela nova. Quem mudar uma delas roda
  private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"() na mesma migration.
*/
const FECHO = [
  "FC_AJUSTE_PONTUACAO_JSON",
  "FC_ANALISE_EH_TREINAMENTO",
  "FC_AREAS_DO_PERFIL",
  "FC_AREAS_USUARIO",
  "FC_CACHE_DESATUALIZADO",
  "FC_CONFERENCIA_RECURSO",
  "FC_COORDENACAO_USUARIO",
  "FC_DADOS_CLASSIFICACAO_EDITAL",
  "FC_DESEMPATE_CLASSIFICACAO_JSON",
  "FC_EDITAIS_DA_COORDENACAO",
  "FC_EDITAIS_NORM_VISIVEIS",
  "FC_EDITAIS_VISIVEIS",
  "FC_EDITAL_EH_TREINAMENTO",
  "FC_EH_TREINAMENTO",
  "FC_EM_OUTRA_LISTA",
  "FC_ENTREVISTAS_VIGENTES",
  "FC_EXIGIR_AREA_EDITAL",
  "FC_EXIGIR_AVALIACAO_EDITAL",
  "FC_EXIGIR_CLASSIFICACAO_EDITAL",
  "FC_GESTOR_DO_EDITAL",
  "FC_GRUPOS_ANALISES_DA_AREA",
  "FC_JANELA_AVALIACAO_DOCUMENTAL",
  "FC_LISTA_CLASSIFICACAO_JSON",
  "FC_MONTAR_ENTREVISTAS_AREA",
  "FC_MONTAR_PAINEL_ANALISE",
  "FC_NIVEL_AVALIACAO_DO_PERFIL",
  "FC_NIVEL_DO_GRUPO",
  "FC_NIVEL_EFETIVO",
  "FC_NOME_USUARIO",
  "FC_NUMERO_EDITAL",
  "FC_PAPEL_AVALIACAO",
  "FC_PERFIL_VE_EDITAL",
  "FC_PODE_AREA",
  "FC_PODE_IGNORAR_AVISO",
  "FC_PODE_VER_AVISO",
  "FC_PODE_VER_EDITAL",
  "FC_QUADRO_DA_VAGA",
  "FC_RANK_NIVEL",
  "FC_REGRA_ANALISE_JSON",
  "FC_REGRA_CLASSIFICACAO_JSON",
  "FC_RENOMEACOES_JSON",
  "FC_TEXTO_BUSCA_RECURSO",
  "FC_TOKENS_VAGA",
  "FC_UNIDADES_NORM_VISIVEIS",
  "analises_norm_key",
  "atualizar_cache_painel_analises",
  "current_profile",
  "get_analises_dashboard_payload_v2",
  "get_entrevistas_da_area",
  "get_selecao_da_area",
  "is_master",
  "listar_acompanhamento_da_visao_geral",
  "listar_avisos_conferencia",
  "nivel_recurso",
  "obter_classificacao_do_edital",
  "obter_regra_analise",
  "pode_recurso",
  "VW_ANALISES_DASHBOARD_BASE_TODOS",
];

describe(NOME, () => {
  it("numa transação, com a guarda das sete RPCs de antes", () => {
    expect(migration.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
    expect(migration).toContain(
      "RPC(s) diferente(s) da que esta migration conhece",
    );
    expect(migration).not.toMatch(/\bdrop\s+(table|function|trigger)\b/i);
  });

  it.each(RPCS)(
    "%s tira a marca antes de montar e devolve inalterado sem montar",
    (rpc, base) => {
      const inicio = migration.indexOf(
        `create or replace function public.${rpc}(`,
      );
      expect(inicio).toBeGreaterThan(0);
      const corpo = migration.slice(
        inicio,
        migration.indexOf("$function$;", inicio),
      );
      const marca = corpo.indexOf('private."FC_MARCA_DA_RPC"(');
      const inalterado = corpo.indexOf("'inalterado', true");
      const montagem = corpo.lastIndexOf(`public.${base}(`);
      expect(marca).toBeGreaterThan(0);
      expect(inalterado).toBeGreaterThan(marca);
      expect(montagem).toBeGreaterThan(inalterado);
      // Sem fontes registradas, volta ao md5 do payload (o de antes).
      expect(corpo).toMatch(
        /if v_marca is null then\s+return private\."FC_SE_MUDOU(_EM_COLUNAS)?"\(/,
      );
    },
  );

  it("não mexe na pré-classificação nem nas funções de versão de antes", () => {
    expect(migration).not.toContain(
      "function public.obter_pre_classificacao_se_mudou(",
    );
    expect(migration).not.toContain('function private."FC_SE_MUDOU"(');
    expect(migration).not.toContain(
      'function private."FC_SE_MUDOU_EM_COLUNAS"(',
    );
    for (const [, base] of RPCS) {
      expect(migration).not.toContain(
        `create or replace function public.${base}(`,
      );
    }
  });

  it("o gatilho é por comando, conta truncate e vale com replica; só insere", () => {
    expect(migration).toContain(
      "after insert or update or delete or truncate on %I.%I '",
    );
    expect(migration).toContain(
      "'for each statement execute function private.\"FC_TG_VERSAO_FONTE\"()'",
    );
    expect(migration).toContain('enable always trigger "TG_VERSAO_FONTE"');
    const gatilho = migration.slice(
      migration.indexOf(
        'create or replace function private."FC_TG_VERSAO_FONTE"()',
      ),
      migration.indexOf(
        'revoke all on function private."FC_TG_VERSAO_FONTE"()',
      ),
    );
    expect(gatilho).toContain('insert into private."TL_VERSAO_FONTE"');
    expect(gatilho).not.toMatch(/\bupdate\s+private\."TL_VERSAO_FONTE"/);
  });

  it("a marca leva quem lê e a versão de cada fonte", () => {
    const marca = migration.slice(
      migration.indexOf(
        'create or replace function private."FC_MARCA_DA_LEITURA"',
      ),
      migration.indexOf('revoke all on function private."FC_MARCA_DA_LEITURA"'),
    );
    for (const parte of [
      "auth.uid()",
      "auth.jwt()",
      "auth.role()",
      "pg_relation_filenode",
      '"QT_ALTERACAO"',
    ]) {
      expect(marca).toContain(parte);
    }
  });

  it("as nove leituras registradas e os gatilhos postos no fim", () => {
    for (const leitura of [
      "analises_painel",
      "analises_pacote",
      "entrevistas_area",
      "entrevistas_pacote",
      "selecao_area",
      "acompanhamento_visao_geral",
      "regra_analise",
      "classificacao_edital",
      "avisos_conferencia",
    ]) {
      expect(migration).toContain(`('${leitura}', array[`);
    }
    expect(migration).toMatch(
      /select private\."FC_ATUALIZAR_FONTES_DAS_LEITURAS"\(\);\s+notify pgrst/,
    );
  });

  it("ensaio termina em rollback; rollback volta as sete e tira gatilhos e tabelas", () => {
    expect(ensaio.trim()).toMatch(/rollback;$/);
    expect(ensaio).toContain(
      "FC_ATUALIZAR_FONTES_DAS_LEITURAS(p_gatilhos => false)",
    );
    for (const etapa of ["E1", "E2", "E3", "E4", "E5", "E6", "E7"]) {
      expect(ensaio).toContain(`-- ${etapa}.`);
    }
    for (const [rpc] of RPCS) {
      expect(rollback).toContain(`create or replace function public.${rpc}(`);
    }
    expect(rollback).toContain('drop trigger if exists "TG_VERSAO_FONTE"');
    expect(rollback).toContain(
      'drop table if exists private."TL_VERSAO_FONTE"',
    );
    expect(rollback).not.toMatch(/FC_MARCA_DA_RPC"\('/);
  });
});

describe("quem muda o fecho das leituras recalcula as fontes", () => {
  const depois = readdirSync("supabase/migrations").filter(
    (f) => /^\d{14}_.*\.sql$/.test(f) && f.slice(0, 14) > NOME.slice(0, 14),
  );

  it.each(depois.length ? depois : ["(nenhuma)"])("%s", (arquivo) => {
    if (arquivo === "(nenhuma)") return;
    const sql = ler(`supabase/migrations/${arquivo}`);
    const mexe = FECHO.filter((nome) =>
      new RegExp(
        `create\\s+(or\\s+replace\\s+)?(function|view|materialized\\s+view)\\s+(public|private)\\.("${nome}"|${nome})(?![A-Za-z0-9_])`,
        "i",
      ).test(sql),
    );
    if (mexe.length) {
      expect(sql, `${arquivo} muda ${mexe.join(", ")}`).toContain(
        'private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(',
      );
    }
  });
});
