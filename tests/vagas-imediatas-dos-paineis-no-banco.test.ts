// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type Banco,
  bancoComRelatoriosProntos,
  uma,
} from "./apoio/banco-dos-paineis.ts";

/*
  Vagas imediatas de Painéis › Editais por cargo (migration 20261116180000, já
  aplicada; o SQL em tests/fixtures/sql-do-banco/) num Postgres de verdade
  (PGlite), com o cálculo de verdade
  (private."FC_LINHAS_POR_CARGO_DO_PAINEL") lendo tabelas mínimas dos editais,
  da Seleção, do quadro de vagas, da convocação e dos locais das vagas.

  A ordem: quadro de vagas do edital (ligado pelo nome da vaga) > convocação
  (vaga ou padrão do edital, abaixo de 10000) > local da vaga (um só casa com
  o cargo) > número no título da vaga ("Cadastro Reserva" = 0).

  Imitação: private."FC_QUADRO_DA_VAGA" (a ligação de verdade compara
  palavras do cargo e da lotação) liga a vaga à linha do quadro cujo cargo
  aparece no nome da vaga, quando só uma aparece.
*/

const LONGO = 60_000;
const SI = "saude-indigena";
const NOME = "20261116180000_vagas_imediatas_dos_paineis_pelo_quadro.sql";
const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
const migration = () => ler(`tests/fixtures/sql-do-banco/${NOME}`);

const COM_QUADRO = "bbbbbbbb-0000-0000-0000-000000000001";
const SEM_QUADRO = "bbbbbbbb-0000-0000-0000-000000000002";
const COM_LOCAIS = "bbbbbbbb-0000-0000-0000-000000000003";

const TABELAS_DOS_EDITAIS = `
create function private."FC_EH_TREINAMENTO"(p_marca text) returns boolean
language sql immutable as $$ select coalesce(p_marca, 'N') = 'S' $$;

create function private."FC_TEXTO_BUSCA_RECURSO"(p_texto text) returns text
language sql immutable as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_texto, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'),
    '\\s+', ' ', 'g'))
$$;

create table public."TB_MONITORAMENTO_INDIGENA" (
  id uuid primary key, edital text, unidade text, inscritos integer,
  "CO_AREA" text, ativo boolean default true, "ST_TREINAMENTO" text default 'N');
create table public."TB_SELECAO_VAGA" (
  "CO_SELECAO_VAGA" uuid primary key default gen_random_uuid(), "CO_MONITORAMENTO" uuid,
  "CO_VAGA" text, "NO_CARGO" text, "NO_UNIDADE" text, "QT_INSCRITO" integer,
  "DS_CHAVE_ORIGEM" text default 'chave', "DS_VAGA_PLANILHA" text default '',
  "ST_REGISTRO_ATIVO" text default 'S');
create table public."TB_LISTA_APROVADO" (id uuid primary key, edital_id text, vigente boolean, ativo boolean);
create table public."TB_CANDIDATO_APROVADO" (lista_id uuid, codigo_vaga text, cargo text, removido_em timestamptz);
create table public."TB_ENTREVISTA" ("CO_AREA" text, "CO_VAGA" text, "NO_CARGO" text);
create table public."TB_QUADRO_VAGA_EDITAL" (
  "CO_QUADRO_VAGA" uuid primary key default gen_random_uuid(), "CO_MONITORAMENTO" uuid,
  "NO_CARGO" text, "QT_VAGA_IMEDIATA" integer, "ST_REGISTRO_ATIVO" text default 'S');
create table public."TB_VAGA_IMEDIATA" ("CO_EDITAL" text, "CO_VAGA" text, "QT_VAGA_IMEDIATA" integer);
create table public."TB_CONVOCACAO_EDITAL" ("CO_EDITAL" text, "QT_PADRAO_IMEDIATA" integer);
create table public."TB_LOCAL_VAGA_EDITAL" (
  "CO_MONITORAMENTO" uuid, "NO_CARGO" text, "QT_VAGA" integer, "ST_REGISTRO_ATIVO" text default 'S');

create function private."FC_QUADRO_DA_VAGA"(p_edital uuid, p_nome_vaga text) returns uuid
language sql stable as $$
  select case when count(*) = 1 then min(q."CO_QUADRO_VAGA"::text)::uuid end
    from public."TB_QUADRO_VAGA_EDITAL" q
   where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'
     and position(lower(q."NO_CARGO") in lower(p_nome_vaga)) > 0
$$;
`;

const DADOS = `
insert into public."TB_MONITORAMENTO_INDIGENA" (id, edital, unidade, inscritos, "CO_AREA") values
  ('${COM_QUADRO}', '01/2099', 'DSEI Teste', 10, '${SI}'),
  ('${SEM_QUADRO}', '02/2099', 'DSEI Teste', 10, '${SI}'),
  ('${COM_LOCAIS}', '03/2099', 'DSEI Teste', 10, '${SI}');

insert into public."TB_SELECAO_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "NO_CARGO", "QT_INSCRITO") values
  -- quadro (3) ganha do título (2)
  ('${COM_QUADRO}', '101', 'Enfermeiro - Polo Base A - 2 vagas (2 AC)', 5),
  -- no quadro, sem número no título
  ('${COM_QUADRO}', '102', 'Psicólogo - Polo Base A', 5),
  -- quadro só cadastro reserva: 0
  ('${COM_QUADRO}', '103', 'Nutricionista - Polo Base A', 5),
  -- fora do quadro, com convocação da vaga
  ('${COM_QUADRO}', '104', 'Médico - Polo Base A', 5),
  -- fora do quadro: o padrão da convocação do edital
  ('${COM_QUADRO}', '105', 'Dentista - Polo Base A', 5),
  -- sem quadro: convocação "chamar todos" (10000) não vale; cai no título
  ('${SEM_QUADRO}', '201', 'Agente - Polo B - 4 vagas', 5),
  -- sem quadro e sem nada: vazio
  ('${SEM_QUADRO}', '202', 'Assistente - Polo B', 5),
  -- sem quadro: título com Cadastro Reserva
  ('${SEM_QUADRO}', '203', 'Motorista - Cadastro Reserva', 5),
  -- locais: um só casa com o cargo
  ('${COM_LOCAIS}', '301', 'Agente de Projeto - Escritório X', 5),
  -- locais: dois casam (ambíguo) — vazio
  ('${COM_LOCAIS}', '302', 'Assistente de Projeto - Escritório X', 5);

insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NO_CARGO", "QT_VAGA_IMEDIATA") values
  ('${COM_QUADRO}', 'Enfermeiro', 3),
  ('${COM_QUADRO}', 'Psicólogo', 1),
  ('${COM_QUADRO}', 'Nutricionista', 0);
insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NO_CARGO", "QT_VAGA_IMEDIATA", "ST_REGISTRO_ATIVO") values
  ('${COM_QUADRO}', 'Médico', 9, 'N');

insert into public."TB_VAGA_IMEDIATA" values
  ('${COM_QUADRO}', '104', 7),
  ('${SEM_QUADRO}', '201', 10000);
insert into public."TB_CONVOCACAO_EDITAL" values
  ('${COM_QUADRO}', 2),
  ('${SEM_QUADRO}', 10000);

insert into public."TB_LOCAL_VAGA_EDITAL" ("CO_MONITORAMENTO", "NO_CARGO", "QT_VAGA") values
  ('${COM_LOCAIS}', 'Agente de Projeto', 6),
  ('${COM_LOCAIS}', 'Assistente de Projeto', 4),
  ('${COM_LOCAIS}', 'Assistente', 2),
  ('${COM_LOCAIS}', null, 40);
`;

type Linha = { codigo_vaga: string | null; vagas_imediatas: number | null };

let db: Banco;
beforeAll(() => bancoComRelatoriosProntos(), 60_000);
beforeEach(async () => {
  db = await bancoComRelatoriosProntos();
  await db.exec(TABELAS_DOS_EDITAIS);
  await db.exec(DADOS);
}, LONGO);

async function vagasPorCodigo() {
  const r = await uma<{ j: { linhas: Linha[] } }>(
    db,
    `select private."FC_LINHAS_POR_CARGO_DO_PAINEL"($1) as j`,
    [SI],
  );
  return Object.fromEntries(
    (r?.j.linhas ?? []).map((l) => [l.codigo_vaga, l.vagas_imediatas]),
  );
}

describe("depois da migration", () => {
  it(
    "quadro > convocação > local > título",
    async () => {
      await db.exec(migration());
      expect(await vagasPorCodigo()).toEqual({
        "101": 3, // quadro ganha do título
        "102": 1, // quadro
        "103": 0, // quadro só com cadastro reserva
        "104": 7, // linha do quadro desativada: convocação da vaga
        "105": 2, // padrão da convocação do edital
        "201": 4, // 10000 é "chamar todos": título
        "202": null, // nada
        "203": 0, // título com Cadastro Reserva
        "301": 6, // um local só casa com o cargo
        "302": null, // dois locais casam: ambíguo
      });
    },
    LONGO,
  );

  it(
    "renomeia a coluna no catálogo e recalcula o relatório",
    async () => {
      await db.exec(migration());
      const c = await uma<{ no_rotulo: string; ds_padrao: string }>(
        db,
        `select no_rotulo, ds_padrao from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() where nu_ordem = 4`,
      );
      expect(c?.no_rotulo).toBe("Vagas imediatas");
      expect(c?.ds_padrao).toContain("quadro de vagas do edital");
      const k = await uma<{ n: number }>(
        db,
        `select count(*)::integer as n from public."TB_CALCULO_RELATORIO_PAINEL" where "CO_RELATORIO" = 'editais-por-cargo'`,
      );
      expect(k?.n).toBe(3);
    },
    LONGO,
  );
});
