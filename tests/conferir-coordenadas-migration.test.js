import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da conferência das coordenadas do mapa (ainda não aplicada: os
  ensaios begin…rollback estão em supabase/ensaios/). Aqui, as invariantes
  estáticas: nomenclatura MAD, RLS sem acesso direto, RPCs SECURITY DEFINER
  com search_path vazio e checagem de admin global, contrato de RPC, ensaios
  com o mesmo corpo, rollbacks e a carga das pendências.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261002160000_conferir_coordenadas_mapa.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CARGA_NOME = "20261002-pendencias-das-coordenadas-do-mapa.sql";
const CARGA = ler(`supabase/correcoes/${CARGA_NOME}`);
const CARGA_ENSAIO = ler(`supabase/ensaios/${CARGA_NOME}`);
const CARGA_ROLLBACK = ler(`supabase/rollback/${CARGA_NOME}`);

const RPCS = {
  salvar_coordenada_mapa_saude_indigena: [
    "p_alvo",
    "p_latitude",
    "p_longitude",
    "p_latitude_anterior",
    "p_longitude_anterior",
    "p_motivo",
    "p_conferido",
  ],
  desfazer_coordenada_mapa_saude_indigena: ["p_historico", "p_motivo"],
  listar_historico_coordenada_mapa_saude_indigena: ["p_alvo", "p_limite"],
  listar_pendencias_coordenada_mapa_saude_indigena: [],
};

const corpoDaFuncao = (nome) => {
  const inicio = MIGRATION.indexOf(`create function public.${nome}(`);
  expect(inicio, nome).toBeGreaterThan(-1);
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

describe("migration da conferência das coordenadas", () => {
  it("vem depois da última migration da main e não reescreve as já aplicadas", () => {
    expect(NOME.slice(0, 14) > "20261002150500").toBe(true);
    expect(MIGRATION).not.toMatch(/create or replace function public\./);
  });

  it("tabela nova no padrão MAD: maiúsculas entre aspas, constraints nomeadas, COMMENT em tudo", () => {
    const inicio = MIGRATION.indexOf(
      'create table private."TB_PENDENCIA_COORDENADA_MAPA" (',
    );
    const bloco = MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
    const colunas = [...bloco.matchAll(/^ {2}"([A-Z_]+)" /gm)].map((m) => m[1]);
    expect(colunas.length).toBeGreaterThan(10);
    for (const coluna of colunas) {
      expect(coluna).toMatch(/^(CO|NO|DS|TP|ST|DT)_[A-Z_]+$/);
      expect(coluna.length).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(
        `comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."${coluna}"`,
      );
    }
    for (const restricao of bloco.matchAll(/constraint "([A-Z_]+)"/g))
      expect(restricao[1]).toMatch(/^(PK|UK|CK|FK)_/);
    expect(bloco).not.toMatch(/^\s+(primary key|unique|check)\b/m);
    expect(MIGRATION).toContain(
      'alter table private."TB_PENDENCIA_COORDENADA_MAPA" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on private."TB_PENDENCIA_COORDENADA_MAPA" from public, anon, authenticated;',
    );
  });

  it("histórico: renomeia para MAD, nomeia a PK e comenta as colunas novas", () => {
    for (const [antigo, novo] of [
      ["ID_HISTORICO", "CO_SEQ_HISTORICO"],
      ["ID_USUARIO", "CO_USUARIO"],
      ["DH_ALTERACAO", "DT_ALTERACAO"],
      ["JS_ALVO", "DS_ALVO"],
      ["NU_LATITUDE_ANTERIOR", "CG_LATITUDE_ANTERIOR"],
      ["NU_LATITUDE", "CG_LATITUDE"],
    ]) {
      expect(MIGRATION).toContain(`rename column "${antigo}" to "${novo}";`);
      expect(ROLLBACK).toContain(`rename column "${novo}" to "${antigo}";`);
    }
    expect(MIGRATION).toContain('"PK_TH_COORD_MAPA_SAUDE_INDIG"');
    for (const coluna of [
      "TP_ACAO",
      "ST_CONFERIDO_ANTERIOR",
      "ST_CONFERIDO",
      "CO_HISTORICO_DESFEITO",
    ])
      expect(MIGRATION).toContain(
        `comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."${coluna}"`,
      );
    expect(MIGRATION).toContain('add constraint "UK_THCOORD_DESFEITO"');
  });

  it("RPCs: SECURITY DEFINER, search_path vazio, só admin global, grants e contrato", () => {
    for (const [nome, argumentos] of Object.entries(RPCS)) {
      const corpo = corpoDaFuncao(nome);
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
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_APLICAR_COORDENADA_MAPA"',
    );
  });

  it("o corpo único mantém limites do Brasil, motivo, identidade e concorrência", () => {
    const inicio = MIGRATION.indexOf(
      'create function private."FC_APLICAR_COORDENADA_MAPA"(',
    );
    const corpo = MIGRATION.slice(inicio, MIGRATION.indexOf("\n$$;", inicio));
    expect(corpo).toContain("p_latitude between -34.9 and 6.4");
    expect(corpo).toContain("p_longitude between -74.2 and -32");
    expect(corpo).toContain("length(btrim(p_motivo)) not between 10 and 1000");
    expect(corpo).toContain("v_lat is distinct from p_latitude_anterior");
    expect(corpo).toContain("errcode = '40001'");
    expect(corpo).toContain("Este ponto já foi conferido.");
    expect(corpo).toContain(
      'insert into private."TH_COORDENADA_MAPA_SAUDE_INDIG"',
    );
  });

  it("ensaio com o mesmo corpo, conferências e rollback", () => {
    expect(ENSAIO).toContain(corpoEntre(MIGRATION, "begin;", "commit;"));
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("ENSAIO OK");
    expect(
      (ENSAIO.match(/raise exception 'FALHOU/g) || []).length,
    ).toBeGreaterThan(20);
    expect(ROLLBACK).toMatch(/^begin;$/m);
    expect(ROLLBACK).toMatch(/^commit;$/m);
    expect(ROLLBACK).toContain(
      'drop table if exists private."TB_PENDENCIA_COORDENADA_MAPA";',
    );
  });
});

describe("carga das pendências", () => {
  const linhas = CARGA.split("\n").filter((l) =>
    /^ {2}\('(lmap|rede_cnes)', /.test(l),
  );

  it("248 pontos (92 polos + 156 UBSI), sem repetir e com motivo do CHECK", () => {
    expect(linhas).toHaveLength(248);
    expect(
      linhas.filter((l) => l.startsWith("  ('lmap', 'polo'")),
    ).toHaveLength(92);
    expect(
      linhas.filter((l) => l.startsWith("  ('rede_cnes', 'u'")),
    ).toHaveLength(156);
    const chaves = linhas.map((l) => l.split("', '").slice(0, 4).join("|"));
    expect(new Set(chaves).size).toBe(248);
    const motivosDoCheck = MIGRATION.match(
      /constraint "CK_PENDCOORD_MOTIVO" check \("TP_MOTIVO" in \(([^)]*)\)\)/,
    )[1];
    for (const l of linhas) {
      const texto = "'(?:[^']|'')*'";
      const campos = [...Array(5).fill(texto), `(?:null|${texto})`];
      const motivo = l.match(
        new RegExp(`^ {2}[(]${campos.join(", ")}, '([A-Z_]+)', `),
      )[1];
      expect(motivosDoCheck).toContain(`'${motivo}'`);
    }
  });

  it("candidatos enxutos, idempotente, ensaio com o mesmo corpo e rollback", () => {
    expect(CARGA).toContain(
      'on conflict on constraint "UK_PENDCOORD_PONTO" do nothing;',
    );
    expect(CARGA).not.toMatch(/"d":|distancia/);
    expect(CARGA).toMatch(/^begin;$/m);
    expect(CARGA).toMatch(/^commit;$/m);
    const corpo = corpoEntre(
      CARGA,
      "-- ═══ CORPO DA CARGA (início) ═══",
      "-- ═══ CORPO DA CARGA (fim) ═══",
    );
    expect(corpo.length).toBeGreaterThan(1000);
    expect(CARGA_ENSAIO).toContain(corpo);
    expect(CARGA_ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(CARGA_ENSAIO).not.toMatch(/^commit;/m);
    expect(CARGA_ENSAIO).toContain("ENSAIO OK");
    expect(CARGA_ROLLBACK).toContain(
      'delete from private."TB_PENDENCIA_COORDENADA_MAPA" where "ST_CONFERIDO" = \'N\';',
    );
  });
});
