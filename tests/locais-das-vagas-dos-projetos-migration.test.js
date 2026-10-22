import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Os locais das vagas dos editais de Projetos (migration 20261001180000):
  a tabela TB_LOCAL_VAGA_EDITAL, a nova versão de
  listar_municipios_das_vagas_da_area, o rollback, o SQL de dados com os
  locais lidos dos PDFs e o ensaio. Aqui ficam as invariantes que não podem se
  perder numa edição — o banco não é consultado.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = ler(
  "supabase/migrations/20261001180000_locais_das_vagas_dos_projetos.sql",
);
const ROLLBACK = ler(
  "supabase/rollback/20261001180000_locais_das_vagas_dos_projetos.sql",
);
const ANTERIOR = ler(
  "supabase/migrations/20260929090000_municipios_das_vagas_da_area.sql",
);
const DADOS = ler(
  "supabase/correcoes/20261001-locais-das-vagas-dos-projetos.sql",
);
const ENSAIO = ler(
  "supabase/ensaios/20261001180000_locais_das_vagas_dos_projetos.sql",
);

const semComentarios = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

describe("a tabela segue a MAD e não é exposta", () => {
  it("identificadores maiúsculos entre aspas, prefixos e constraints nomeadas", () => {
    expect(MIGRATION).toContain('create table public."TB_LOCAL_VAGA_EDITAL"');
    for (const coluna of [
      '"CO_LOCAL_VAGA" uuid not null',
      '"CO_MONITORAMENTO" uuid not null',
      '"CO_MUNICIPIO_IBGE" integer',
      '"NO_MUNICIPIO" varchar(100)',
      '"SG_UF" varchar(2) not null',
      '"QT_VAGA" integer',
      "\"ST_CADASTRO_RESERVA\" varchar(1) not null default 'N'",
      "\"TP_ORIGEM\" varchar(10) not null default 'PDF'",
      "\"ST_REGISTRO_ATIVO\" varchar(1) not null default 'S'",
    ])
      expect(MIGRATION).toContain(coluna);
    expect(MIGRATION).toContain(
      'constraint "PK_TB_LOCAL_VAGA_EDITAL" primary key ("CO_LOCAL_VAGA")',
    );
    expect(MIGRATION).toMatch(
      /constraint "FK_MONITORAMENTO_LOCALVAGA" foreign key \("CO_MONITORAMENTO"\)\s+references public\."TB_MONITORAMENTO_INDIGENA" \(id\)/,
    );
    expect(MIGRATION).toContain(
      "\"TP_ORIGEM\" in ('PDF', 'NOME_VAGA', 'MANUAL')",
    );
    expect(MIGRATION).toContain("\"ST_REGISTRO_ATIVO\" in ('S', 'N')");
    expect(MIGRATION).toContain('create unique index "UK_LOCALVAGA_LOCAL"');
    // Toda constraint tem nome; nenhum nome passa de 30 caracteres.
    const nomes = [
      ...MIGRATION.matchAll(/(?:constraint|index) "([A-Z_]+)"/g),
    ].map((achado) => achado[1]);
    expect(nomes.length).toBeGreaterThan(8);
    for (const nome of nomes) {
      expect(nome, nome).toMatch(/^(PK|FK|CK|UK|IN)_/);
      expect(nome.length, nome).toBeLessThanOrEqual(30);
    }
    const colunas = [
      ...MIGRATION.matchAll(
        /^\s+"([A-Z_]+)" (?:uuid|integer|varchar|timestamptz)/gm,
      ),
    ].map((achado) => achado[1]);
    for (const coluna of colunas)
      expect(coluna.length, coluna).toBeLessThanOrEqual(30);
  });

  it("COMMENT ON na tabela e em todas as colunas", () => {
    expect(MIGRATION).toContain(
      'comment on table public."TB_LOCAL_VAGA_EDITAL" is',
    );
    const colunas = [
      ...MIGRATION.matchAll(
        /^\s+"([A-Z_]+)" (?:uuid|integer|varchar|timestamptz)/gm,
      ),
    ].map((achado) => achado[1]);
    expect(colunas).toHaveLength(16);
    for (const coluna of colunas)
      expect(MIGRATION, coluna).toContain(
        `comment on column public."TB_LOCAL_VAGA_EDITAL"."${coluna}" is`,
      );
  });

  it("RLS ligada, sem policy e sem acesso de anon/authenticated", () => {
    expect(MIGRATION).toContain(
      'alter table public."TB_LOCAL_VAGA_EDITAL" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TB_LOCAL_VAGA_EDITAL" from anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(/create policy/i);
  });
});

describe("a nova versão da RPC", () => {
  const corpo = MIGRATION.slice(
    MIGRATION.indexOf("create or replace function"),
    MIGRATION.indexOf("$function$;"),
  );

  it("mesma assinatura, mesma permissão e mesmo recorte das análises", () => {
    expect(corpo).toContain(
      "create or replace function public.listar_municipios_das_vagas_da_area(p_area text)",
    );
    expect(corpo).toContain("security definer");
    expect(corpo).toContain("private.pode_recurso('dashboard')");
    expect(corpo).toContain('private."FC_GRUPOS_ANALISES_DA_AREA"(p_area)');
    expect(corpo).toContain("ac.ativo is true");
    expect(corpo).toContain("coalesce(e.ativo, true) is true");
    expect(MIGRATION).toContain(
      "revoke all on function public.listar_municipios_das_vagas_da_area(text) from public, anon;",
    );
    expect(CONTRATO_RPC.listar_municipios_das_vagas_da_area.argumentos).toEqual(
      ["p_area"],
    );
  });

  it("une os locais da tabela e o UBS móvel do nome da vaga", () => {
    expect(corpo).toContain('from public."TB_LOCAL_VAGA_EDITAL" l');
    expect(corpo).toContain("l.\"ST_REGISTRO_ATIVO\" = 'S'");
    expect(corpo).toContain('m."CO_AREA" = v_area');
    expect(corpo).toContain("'UBS m[óo]vel ([^/]+)/([A-Z]{2})'");
  });

  it("os campos de antes continuam e os novos entram", () => {
    for (const campo of [
      "municipio_uf",
      "municipio",
      "uf",
      "vagas",
      "candidatos",
      "aprovados",
      "reprovados",
    ]) {
      expect(ANTERIOR, campo).toContain(`'${campo}'`);
      expect(corpo, campo).toContain(`'${campo}'`);
    }
    for (const campo of [
      "codigo_ibge",
      "nivel",
      "vagas_edital",
      "cadastro_reserva",
      "projetos",
      "editais",
      "projeto",
      "edital",
      "origens",
      "lotacoes",
    ])
      expect(corpo, campo).toContain(`'${campo}'`);
  });
});

describe("rollback", () => {
  it("volta a RPC à versão anterior e apaga a tabela", () => {
    const funcao = (sql) =>
      sql.slice(
        sql.indexOf("create or replace function"),
        sql.indexOf("grant execute"),
      );
    expect(funcao(ROLLBACK)).toBe(funcao(ANTERIOR));
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_LOCAL_VAGA_EDITAL";',
    );
    expect(ROLLBACK.trim().endsWith("commit;")).toBe(true);
  });
});

describe("SQL de dados com os locais dos PDFs", () => {
  const linhas = [
    ...DADOS.matchAll(
      /^ {2}\('([^']+)', '([^']+)', (\d{7}|null), (?:'([^']+)'|null), '([A-Z]{2})', /gm,
    ),
  ];

  it("cada linha traz o PDF oficial e a página como prova", () => {
    expect(linhas.length).toBeGreaterThan(100);
    const valores = DADOS.slice(
      DADOS.indexOf("as (values"),
      DADOS.indexOf("\n),\nedital as"),
    );
    const tuplas = valores
      .split("\n")
      .filter((linha) => linha.startsWith("  ('"));
    expect(tuplas).toHaveLength(linhas.length);
    for (const tupla of tuplas) {
      expect(tupla).toMatch(/'https:\/\/agenciasus\.org\.br\/[^']+\.pdf'/);
    }
    // Comentário com a página acima de cada linha.
    const comentarios = DADOS.match(/^ {2}-- .+: p\. .+$/gm) ?? [];
    expect(comentarios).toHaveLength(tuplas.length);
  });

  it("todos os projetos de Projetos estão no levantamento", () => {
    const porProjeto = new Map();
    for (const [, numero, palavra] of linhas) {
      porProjeto.set(
        palavra,
        new Set([...(porProjeto.get(palavra) ?? []), numero]),
      );
    }
    expect([...porProjeto.keys()].sort()).toEqual([
      "caminhoneiro",
      "cce",
      "escritorio",
      "fronteira",
      "mfc",
      "rio doce",
    ]);
    expect([...porProjeto.get("escritorio")].sort()).toEqual([
      "62/2025",
      "93/2026",
    ]);
    expect([...porProjeto.get("caminhoneiro")].sort()).toEqual([
      "30/2026",
      "96/2025",
    ]);
  });

  it("município do IBGE na UF certa; só UF sem município", () => {
    const UF_DO_CODIGO = {
      11: "RO",
      12: "AC",
      13: "AM",
      14: "RR",
      15: "PA",
      16: "AP",
      17: "TO",
      21: "MA",
      22: "PI",
      23: "CE",
      24: "RN",
      25: "PB",
      26: "PE",
      27: "AL",
      28: "SE",
      29: "BA",
      31: "MG",
      32: "ES",
      33: "RJ",
      35: "SP",
      41: "PR",
      42: "SC",
      43: "RS",
      50: "MS",
      51: "MT",
      52: "GO",
      53: "DF",
    };
    for (const [, , , codigo, municipio, uf] of linhas) {
      if (codigo === "null") {
        expect(municipio, uf).toBeUndefined();
        continue;
      }
      expect(UF_DO_CODIGO[codigo.slice(0, 2)], municipio).toBe(uf);
    }
  });

  it("o Escritório Distrital e Regional 62/2025 soma as 179 vagas do edital", () => {
    const vagas = [
      ...DADOS.matchAll(
        /^ {2}\('62\/2025', 'escritorio', (?:\d{7}|null), (?:'[^']+'|null), '[A-Z]{2}', (?:'[^']+'|null), (?:'[^']+'|null), (\d+|null)/gm,
      ),
    ].reduce(
      (soma, achado) => soma + Number(achado[1] === "null" ? 0 : achado[1]),
      0,
    );
    expect(vagas).toBe(179);
  });

  it("idempotente, só na área Projetos e numa transação", () => {
    const sql = semComentarios(DADOS);
    expect(sql).toContain("where not exists (");
    expect(sql).toContain("m.\"CO_AREA\" = 'projetos'");
    expect(sql).toContain('private."FC_NUMERO_EDITAL"(m.edital) = d.numero');
    expect(sql.trim().startsWith("begin;")).toBe(true);
    expect(sql.trim().endsWith("commit;")).toBe(true);
  });
});

describe("ensaio", () => {
  it("roda migration e dados numa transação e desfaz no fim", () => {
    const sql = semComentarios(ENSAIO);
    expect(sql.trim().startsWith("begin;")).toBe(true);
    expect(sql.trim().endsWith("rollback;")).toBe(true);
    expect(sql).not.toMatch(/^commit;/m);
    expect(sql).toContain('create table public."TB_LOCAL_VAGA_EDITAL"');
    expect(sql).toContain('insert into public."TB_LOCAL_VAGA_EDITAL"');
    expect(sql).toContain(
      "public.listar_municipios_das_vagas_da_area('projetos')",
    );
  });
});
