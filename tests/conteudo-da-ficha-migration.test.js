import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da Avaliação documental, fase F4 (o conteúdo da ficha), ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/ (rodado no
  Supabase real). Aqui, as invariantes estáticas: padrão MAD das colunas e
  constraints novas, RPCs SECURITY DEFINER com search_path vazio e grant só a
  authenticated, o banco não refaz a conta (revalida), respostas só das
  perguntas da regra, contrato de RPC, ensaio com o corpo idêntico e rollback
  completo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007130000_conteudo_da_ficha.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

const TELA = {
  obter_ficha_analise: 'FC_EXIGIR_VER_FICHA"(v_f)',
  salvar_rascunho_ficha: 'FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao)',
  concluir_ficha: 'FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao)',
  reabrir_ficha: 'FC_EXIGIR_COORD_FICHAS"(v_f."CO_MONITORAMENTO")',
  registrar_acesso_ficha: 'FC_EXIGIR_VER_FICHA"(v_f)',
};

const corpoDaFuncao = (cabeca, texto = MIGRATION) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(
    inicio,
    texto.indexOf("$function$;", texto.indexOf("as $function$", inicio)) + 11,
  );
};

describe("nomenclatura MAD (20261007110000)", () => {
  it("colunas novas com prefixo, até 30 caracteres e comentadas", () => {
    for (const [tabela, trecho] of [
      ["TB_FICHA_ANALISE", 'alter table public."TB_FICHA_ANALISE"\n'],
      ["TH_FICHA_ANALISE", 'alter table public."TH_FICHA_ANALISE"\n'],
    ]) {
      const inicio = MIGRATION.indexOf(trecho);
      const bloco = MIGRATION.slice(inicio, MIGRATION.indexOf(";", inicio));
      const colunas = [...bloco.matchAll(/add column "([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(colunas.length).toBeGreaterThan(3);
      for (const coluna of colunas) {
        expect(coluna).toMatch(/^(CO|NO|DS|TP|ST|NU|QT|VL|DT)_[A-Z_]+$/);
        expect(coluna.length).toBeLessThanOrEqual(30);
        expect(MIGRATION, `${tabela}.${coluna}`).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      for (const [, c] of bloco.matchAll(/add constraint "([^"]+)"/g)) {
        expect(c).toMatch(/^(FK|CK|UK)_[A-Z_]+$/);
        expect(c.length, c).toBeLessThanOrEqual(30);
        expect(MIGRATION, c).toContain(
          `comment on constraint "${c}" on public."${tabela}" is`,
        );
      }
    }
  });

  it("índices e funções privadas no padrão, comentados e fechados", () => {
    for (const [, nome] of MIGRATION.matchAll(/create index "([^"]+)"/g)) {
      expect(nome).toMatch(/^IN_[A-Z_]+$/);
      expect(nome.length).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on index public."${nome}" is`);
    }
    const funcoes = [
      ...MIGRATION.matchAll(/create function private\."([^"]+)"/g),
    ].map((m) => m[1]);
    expect(funcoes.length).toBeGreaterThan(10);
    for (const nome of funcoes) {
      expect(nome).toMatch(/^FC_[A-Z0-9_]+$/);
      expect(nome.length, nome).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on function private."${nome}"(`);
      expect(MIGRATION).toContain(`revoke all on function private."${nome}"(`);
      expect(corpoDaFuncao(`create function private."${nome}"(`)).toContain(
        "set search_path to ''",
      );
    }
  });
});

describe("acesso e regras da ficha", () => {
  it("sem grant direto em tabela, sem policy nem hard delete", () => {
    expect(MIGRATION).not.toMatch(/grant [^;]* on public\."(TB|TH|TL)_/i);
    expect(MIGRATION).not.toMatch(/create policy/i);
    expect(MIGRATION).not.toMatch(/\bdelete from\b/i);
  });

  it.each(Object.entries(TELA))(
    "%s: definer, search_path vazio, porteiro, grant só a authenticated e no contrato",
    (nome, porteiro) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain(porteiro);
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
      const args = [
        ...corpo.slice(0, corpo.indexOf(")")).matchAll(/\b(p_[a-z_]+)\b/g),
      ].map((m) => m[1]);
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(args);
    },
  );

  it("gravar exige reserva (55P03), versão (40001) e análise", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_EXIGIR_GRAVAR_FICHA"(',
    );
    expect(corpo).toContain("errcode = '55P03'");
    expect(corpo).toContain("errcode = '40001'");
    expect(corpo).toContain(`"TP_SITUACAO" <> 'EM_ANALISE'`);
  });

  it("concluir confere a versão da regra, a conferência e as pendências (justificativa)", () => {
    const corpo = corpoDaFuncao("create function public.concluir_ficha(");
    expect(corpo).toContain("p_versao_regra is distinct from v_regra.p_versao");
    expect(corpo).toContain("v_regra.p_situacao <> 'CONFERIDA'");
    expect(corpo).toContain('FC_PENDENCIAS_FICHA"');
    expect(
      corpoDaFuncao('create function private."FC_PENDENCIAS_FICHA"('),
    ).toContain("nota diferente da declarada sem justificativa");
  });

  it("o banco não refaz a conta de pontos: revalida estrutura e coerência", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_VALIDAR_RESULTADO_FICHA"(',
    );
    expect(corpo).toContain("A nota apurada não é a soma das parciais.");
    expect(corpo).toContain(
      "Há bloco eliminatório: o resultado é Inapto por requisito.",
    );
    expect(MIGRATION).not.toMatch(/range_agg|daterange/);
  });

  it("as respostas são só das perguntas ligadas à regra, nunca o cadastro", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_RESPOSTAS_DA_FICHA"(',
    );
    expect(corpo).toContain("k.key ~* '^\\s*pergunta'");
    expect(corpo).toContain("'{provisoria,nota_declarada}'");
    for (const cabeca of [
      "create function public.obter_ficha_analise(",
      "create or replace function public.obter_fila_avaliacao(",
    ]) {
      const c = corpoDaFuncao(cabeca);
      expect(c).not.toContain('"NU_CPF"');
      expect(c).not.toContain('"DS_EMAIL"');
      expect(c).not.toContain('"NU_TELEFONE"');
    }
  });

  it("a fila mostra ao analista só as vagas dele e traz resultado e nota", () => {
    const corpo = corpoDaFuncao(
      "create or replace function public.obter_fila_avaliacao(",
    );
    expect(corpo).toContain(
      `v_so_minhas_vagas boolean := coalesce(v_papel, '') = 'ANALISTA'`,
    );
    expect(corpo).toContain("'resultado', case when");
    expect(corpo).toContain("'nota_final', case when");
  });

  it("AM-2.3: salvar a regra devolve as fichas concluídas com versão anterior", () => {
    const corpo = corpoDaFuncao(
      "create or replace function public.salvar_regra_analise(",
    );
    expect(corpo).toContain(`"NU_VERSAO_REGRA" < v_nova`);
    expect(
      corpoDaFuncao('create function private."FC_REGRA_VIGENTE_FICHA"('),
    ).toContain(
      `case when f."TP_SITUACAO" = 'CONCLUIDA' then f."NU_VERSAO_REGRA" else r."NU_VERSAO_VIGENTE" end`,
    );
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio traz o corpo sem mudança e termina em rollback", () => {
    const linhas = MIGRATION.split("\n");
    const corpo = linhas
      .slice(linhas.indexOf("begin;") + 1, linhas.lastIndexOf("commit;"))
      .join("\n");
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("ENSAIO OK");
    expect(ENSAIO).toContain("raise exception 'FALHOU");
    expect(ENSAIO.indexOf("reset role;")).toBeGreaterThan(
      ENSAIO.indexOf("set local role authenticated;"),
    );
  });

  it("o rollback desfaz as RPCs, as funções, as colunas e devolve as funções antigas", () => {
    for (const nome of Object.keys(TELA))
      expect(ROLLBACK).toContain(`drop function if exists public.${nome}(`);
    for (const [, nome] of MIGRATION.matchAll(
      /create function private\."([^"]+)"/g,
    ))
      expect(ROLLBACK).toContain(`drop function if exists private."${nome}"(`);
    for (const [, coluna] of MIGRATION.matchAll(/add column "([^"]+)"/g))
      expect(ROLLBACK).toContain(`drop column if exists "${coluna}"`);
    expect(ROLLBACK).toContain(
      "create or replace function public.obter_fila_avaliacao(p_edital uuid)",
    );
    expect(ROLLBACK).toContain(
      "create or replace function public.salvar_regra_analise(",
    );
    expect(ROLLBACK).not.toContain("v_so_minhas_vagas");
  });
});
