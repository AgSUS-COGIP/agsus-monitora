import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration das coordenadas do mapa de Projetos (ainda não aplicada: os
  ensaios begin…rollback estão em supabase/ensaios/). Aqui, as invariantes
  estáticas: nomenclatura MAD, RLS sem acesso direto, RPCs SECURITY DEFINER
  com search_path vazio e checagem de admin global, concorrência com
  tolerância, contrato de RPC, ensaios com o mesmo corpo, rollbacks e a carga
  das coordenadas e pendências. O editor da Saúde Indígena não é tocado.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261002190000_coordenadas_mapa_projetos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CARGA_NOME = "20261002-pendencias-das-coordenadas-dos-projetos.sql";
const CARGA = ler(`supabase/correcoes/${CARGA_NOME}`);
const CARGA_ENSAIO = ler(`supabase/ensaios/${CARGA_NOME}`);
const CARGA_ROLLBACK = ler(`supabase/rollback/${CARGA_NOME}`);
const MUNICIPIOS_DO_FRONT = ler("src/lib/coordenadas-dos-municipios.js");

const RPCS = {
  salvar_coordenada_mapa_projetos: [
    "p_lugar",
    "p_latitude",
    "p_longitude",
    "p_latitude_anterior",
    "p_longitude_anterior",
    "p_motivo",
    "p_conferido",
  ],
  desfazer_coordenada_mapa_projetos: ["p_historico", "p_motivo"],
  listar_historico_coordenada_mapa_projetos: ["p_lugar", "p_limite"],
  listar_pendencias_coordenada_mapa_projetos: [],
};

const TABELAS = [
  ["public", "TB_COORDENADA_LOCAL_VAGA"],
  ["private", "TB_PENDENCIA_COORDENADA_LOCAL"],
  ["private", "TH_COORDENADA_LOCAL_VAGA"],
];

const blocoDaTabela = (schema, tabela) => {
  const inicio = MIGRATION.indexOf(`create table ${schema}."${tabela}" (`);
  expect(inicio, tabela).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
};
const corpoDaFuncao = (cabecalho) => {
  const inicio = MIGRATION.indexOf(cabecalho);
  expect(inicio, cabecalho).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("\n$$;", inicio));
};
const corpoEntre = (texto, abre, fecha) =>
  texto
    .split("\n")
    .slice(
      texto.split("\n").indexOf(abre) + 1,
      texto.split("\n").lastIndexOf(fecha),
    )
    .join("\n")
    .trim();

describe("migration das coordenadas do mapa de Projetos", () => {
  it("vem depois da conferência da Saúde Indígena e não mexe no editor dela", () => {
    expect(NOME.slice(0, 14) > "20261002160000").toBe(true);
    expect(MIGRATION).not.toMatch(/TH_COORDENADA_MAPA_SAUDE_INDIG/);
    expect(MIGRATION).not.toMatch(/TB_PENDENCIA_COORDENADA_MAPA"/);
    expect(MIGRATION).not.toMatch(/_mapa_saude_indigena\(/);
    // A única função substituída é a RPC do mapa de Projetos (mesma assinatura).
    expect(
      [...MIGRATION.matchAll(/create or replace function ([\w.]+)/g)].map(
        (m) => m[1],
      ),
    ).toEqual(["public.listar_municipios_das_vagas_da_area"]);
  });

  it("tabelas no padrão MAD: maiúsculas entre aspas, constraints nomeadas, RLS e COMMENT em tudo", () => {
    for (const [schema, tabela] of TABELAS) {
      expect(tabela.length).toBeLessThanOrEqual(30);
      const bloco = blocoDaTabela(schema, tabela);
      const colunas = [...bloco.matchAll(/^ {2}"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      expect(colunas.length, tabela).toBeGreaterThan(8);
      for (const coluna of colunas) {
        expect(coluna).toMatch(/^(CO|NO|DS|SG|CG|TP|ST|DT)_[A-Z_]+$/);
        expect(coluna.length).toBeLessThanOrEqual(30);
        expect(MIGRATION).toContain(
          `comment on column ${schema}."${tabela}"."${coluna}"`,
        );
      }
      for (const restricao of bloco.matchAll(/constraint "([A-Z_]+)"/g))
        expect(restricao[1]).toMatch(/^(PK|UK|CK|FK)_/);
      expect(bloco).not.toMatch(/^\s+(primary key|unique|check)\b/m);
      expect(MIGRATION).toContain(
        `alter table ${schema}."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on ${schema}."${tabela}" from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(`comment on table ${schema}."${tabela}" is`);
      expect(ROLLBACK).toContain(`drop table if exists ${schema}."${tabela}";`);
    }
    expect(MIGRATION).not.toMatch(/create policy/i);
  });

  it("explica por que o histórico e as pendências são tabelas irmãs", () => {
    expect(MIGRATION).toMatch(/Por que tabelas irmãs/);
  });

  it("RPCs: SECURITY DEFINER, search_path vazio, só admin global, grants e contrato", () => {
    for (const [nome, argumentos] of Object.entries(RPCS)) {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo, nome).toMatch(/security definer\s+set search_path = ''/);
      expect(corpo, nome).toContain(
        "if auth.uid() is null or not private.is_master() then",
      );
      expect(corpo, nome).toContain("errcode = '42501'");
      expect(MIGRATION).toMatch(
        new RegExp(
          `revoke all on function public\\.${nome}\\([^)]*\\) from public, anon;`,
        ),
      );
      expect(MIGRATION).toMatch(
        new RegExp(
          `grant execute on function public\\.${nome}\\([^)]*\\) to authenticated;`,
        ),
      );
      expect(MIGRATION).toMatch(
        new RegExp(`comment on function public\\.${nome}\\(`),
      );
      expect(CONTRATO_RPC[nome]?.argumentos, nome).toEqual(argumentos);
      for (const argumento of argumentos) expect(corpo).toContain(argumento);
      expect(ROLLBACK).toContain(`drop function if exists public.${nome}(`);
    }
    for (const privada of [
      'private."FC_APLICAR_COORDENADA_LOCAL"',
      'private."FC_LUGARES_VAGA_PROJETO"',
    ]) {
      expect(MIGRATION).toContain(`revoke all on function ${privada}(`);
      expect(MIGRATION).toContain(`comment on function ${privada}(`);
      expect(ROLLBACK).toContain(`drop function if exists ${privada}(`);
    }
    expect(CONTRATO_RPC.listar_municipios_das_vagas_da_area.argumentos).toEqual(
      ["p_area"],
    );
  });

  it("o corpo único mantém limites do Brasil, motivo, lugar existente e concorrência com tolerância", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_APLICAR_COORDENADA_LOCAL"(',
    );
    expect(corpo).toMatch(/set search_path = ''/);
    expect(corpo).toContain("p_latitude between -34.9 and 6.4");
    expect(corpo).toContain("p_longitude between -74.2 and -32");
    expect(corpo).toContain("length(btrim(p_motivo)) not between 10 and 1000");
    expect(corpo).toContain("v_tolerancia constant double precision := 1e-9;");
    expect(corpo).toContain("abs(v_lat - p_latitude_anterior) > v_tolerancia");
    expect(corpo).toContain("(v_lat is null) <> (p_latitude_anterior is null)");
    expect(corpo).toContain("errcode = '40001'");
    expect(corpo).toContain("pg_advisory_xact_lock");
    expect(corpo).toContain('from private."FC_LUGARES_VAGA_PROJETO"() f');
    expect(corpo).toContain("Este lugar já foi conferido.");
    expect(corpo).toContain('insert into private."TH_COORDENADA_LOCAL_VAGA"');
    const desfazer = corpoDaFuncao(
      "create function public.desfazer_coordenada_mapa_projetos(",
    );
    expect(desfazer).toContain("Um desfazer não se desfaz");
    expect(desfazer).toContain('h."CO_SEQ_HISTORICO" > v."CO_SEQ_HISTORICO"');
  });

  it("a RPC do mapa devolve lugar e coordenada do banco, sem perder os campos de antes", () => {
    const corpo = corpoDaFuncao(
      "create or replace function public.listar_municipios_das_vagas_da_area(",
    );
    for (const campo of [
      "lugar",
      "latitude",
      "longitude",
      "coordenada_origem",
      "municipio_uf",
      "codigo_ibge",
      "nivel",
      "vagas_edital",
      "editais",
    ])
      expect(corpo).toContain(`'${campo}',`);
    expect(corpo).toContain(
      'left join public."TB_COORDENADA_LOCAL_VAGA" c on c."DS_CHAVE_LUGAR" = k.chave',
    );
    // As análises da área também pela coluna "CO_AREA" (antes só pelo grupo).
    expect(corpo).toContain(
      'where (ac."CO_AREA" = v_area or ac.grupo_norm = any (v_grupos_norm))',
    );
    expect(ROLLBACK).toContain(
      "create or replace function public.listar_municipios_das_vagas_da_area(",
    );
    expect(ROLLBACK).not.toContain('TB_COORDENADA_LOCAL_VAGA" c on');
  });

  it("ensaio com o mesmo corpo, conferências com tolerância e rollback", () => {
    expect(ENSAIO).toContain(corpoEntre(MIGRATION, "begin;", "commit;"));
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("ENSAIO OK");
    expect(
      (ENSAIO.match(/raise exception 'FALHOU/g) || []).length,
    ).toBeGreaterThan(25);
    expect(ENSAIO).toMatch(/abs\([^)]*\) > 1e-9/);
    expect(ENSAIO).toMatch(/^select h\."TP_ACAO"/m);
    expect(ROLLBACK).toMatch(/^begin;$/m);
    expect(ROLLBACK).toMatch(/^commit;$/m);
  });
});

describe("carga das coordenadas e pendências de Projetos", () => {
  const corpo = corpoEntre(
    CARGA,
    "-- ═══ CORPO DA CARGA (início) ═══",
    "-- ═══ CORPO DA CARGA (fim) ═══",
  );

  it("as sedes e os centros das UFs são os mesmos do front", () => {
    const sedesDoFront = [
      ...MUNICIPIOS_DO_FRONT.matchAll(
        /^\s*\["([^"]+)", "([A-Z]{2})", (\d{7}), (-?[\d.]+), (-?[\d.]+)\],/gm,
      ),
    ];
    expect(sedesDoFront.length).toBeGreaterThan(40);
    for (const [, municipio, uf, ibge, lat, lon] of sedesDoFront)
      expect(CARGA).toContain(
        `  (${ibge}, '${municipio.replace(/'/g, "''")}', '${uf}', ${lat}, ${lon})`,
      );
    const ufsDoFront = [
      ...MUNICIPIOS_DO_FRONT.matchAll(
        /^\s*([A-Z]{2}): \["([^"]+)", (-?[\d.]+), (-?[\d.]+)\],/gm,
      ),
    ];
    expect(ufsDoFront).toHaveLength(27);
    for (const [, uf, nome, lat, lon] of ufsDoFront)
      expect(CARGA).toContain(`  ('${uf}', '${nome}', ${lat}, ${lon})`);
  });

  it("calculada por SQL, idempotente, sem CTE entre statements, motivos do CHECK", () => {
    expect(corpo).toContain('from private."FC_LUGARES_VAGA_PROJETO"() f');
    expect(corpo).toContain(
      'on conflict on constraint "UK_COORDLOCAL_LUGAR" do nothing;',
    );
    expect(corpo).toContain(
      'on conflict on constraint "UK_PENDLOCAL_LUGAR" do update',
    );
    expect(corpo).toContain(
      `where private."TB_PENDENCIA_COORDENADA_LOCAL"."ST_CONFERIDO" = 'N';`,
    );
    expect(corpo).toContain("when c.origem = 'MANUAL' then null");
    // Cada statement com o próprio dado: tabelas temporárias, nenhum WITH no nível de topo.
    expect(corpo).not.toMatch(/^with\b/im);
    expect(corpo).toMatch(/create temp table tmp_lugar on commit drop as/);
    const motivosDoCheck = MIGRATION.match(
      /constraint "CK_PENDLOCAL_MOTIVO" check \("TP_MOTIVO" in \(([^)]*)\)\)/,
    )[1];
    const motivosDaCarga = [
      ...corpo.matchAll(/then '([A-Z_]+)'/g),
      ...corpo.matchAll(/else '(SEDE_MUNICIPAL)'/g),
    ].map((m) => m[1]);
    expect(new Set(motivosDaCarga)).toEqual(
      new Set([
        "MUNICIPIO_DIVERGE",
        "SEM_COORDENADA",
        "FORA_DO_BRASIL",
        "LUGAR_DIVERGE",
        "ESCRITORIO_SO_UF",
        "SO_UF",
        "SEDE_MUNICIPAL",
        "CENTRO_UF",
      ]),
    );
    for (const motivo of motivosDaCarga.filter((m) => m !== "CENTRO_UF"))
      expect(motivosDoCheck).toContain(`'${motivo}'`);
  });

  it("ensaio com o mesmo corpo, tolerância na comparação e rollback", () => {
    expect(corpo.length).toBeGreaterThan(3000);
    expect(CARGA).toMatch(/^begin;$/m);
    expect(CARGA).toMatch(/^commit;$/m);
    expect(CARGA_ENSAIO).toContain(corpo);
    expect(CARGA_ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(CARGA_ENSAIO).not.toMatch(/^commit;/m);
    expect(CARGA_ENSAIO).toContain("ENSAIO OK");
    expect(CARGA_ENSAIO).toMatch(/abs\([^)]*\) > 1e-6/);
    expect(CARGA_ENSAIO).toMatch(/^select 'pendencia' as tabela/m);
    expect(CARGA_ROLLBACK).toContain(
      `delete from private."TB_PENDENCIA_COORDENADA_LOCAL" where "ST_CONFERIDO" = 'N';`,
    );
    expect(CARGA_ROLLBACK).toContain(
      `delete from public."TB_COORDENADA_LOCAL_VAGA" where "TP_ORIGEM" in ('SEDE_IBGE', 'CENTRO_UF');`,
    );
  });
});
