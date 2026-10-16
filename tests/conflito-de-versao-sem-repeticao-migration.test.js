import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Conflito de versão sem repetição no PostgREST (20261016160000): as funções
  trocam `errcode = '40001'` (o PostgREST repete a transação) por
  `errcode = 'PT409'` (HTTP 409, sem repetição). A migration foi gerada de
  pg_get_functiondef do banco novo; o ensaio (begin…rollback) conferiu o
  SQLSTATE antes/depois e que corpo, dono, grants, comentário, SET e SECURITY
  DEFINER só mudam no errcode. Invariantes estáticas abaixo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261016160000_conflito_de_versao_sem_repeticao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const definicoes = (texto) =>
  texto.split(/\n(?=CREATE OR REPLACE FUNCTION )/).slice(1);
const nomeDe = (definicao) =>
  definicao.match(/^CREATE OR REPLACE FUNCTION ([^(]+)\(/)[1];
const sem = (texto, de, para) => texto.split(de).join(para);
const ANTIGO = "errcode = '40001'";
const NOVO = "errcode = 'PT409'";

describe("migration 20261016160000 (conflito de versão: 40001 → PT409)", () => {
  const funcoes = definicoes(MIGRATION);
  const voltas = definicoes(ROLLBACK);

  it("reaplica as 30 funções, todas com PT409 e nenhuma com 40001", () => {
    expect(funcoes).toHaveLength(30);
    expect(new Set(funcoes.map(nomeDe)).size).toBe(30);
    for (const f of funcoes) {
      expect(f).toContain(NOVO);
      expect(f).not.toContain("40001");
    }
    expect(MIGRATION.split(NOVO).length - 1).toBe(39);
  });

  it("inclui as do laço visto em produção e as privadas", () => {
    const nomes = funcoes.map(nomeDe);
    for (const n of [
      "public.salvar_matriz_acessos",
      'private."FC_EXIGIR_GRAVAR_FICHA"',
      "public.concluir_ficha",
      "public.renovar_reserva",
      'private."FC_APLICAR_COORDENADA_MAPA"',
    ])
      expect(nomes).toContain(n);
  });

  it("só o errcode muda: o rollback é a mesma definição com 40001", () => {
    expect(voltas.map(nomeDe)).toEqual(funcoes.map(nomeDe));
    funcoes.forEach((f, i) => {
      expect(sem(f, NOVO, ANTIGO)).toBe(voltas[i]);
    });
    expect(ROLLBACK).not.toContain("PT409");
  });

  it("mantém SECURITY DEFINER e search_path vazio de cada função", () => {
    for (const f of funcoes) expect(f).toContain("SET search_path TO ''");
    expect(funcoes.filter((f) => /SECURITY DEFINER/.test(f))).toHaveLength(28);
  });

  it("não mexe em grants nem comentários (CREATE OR REPLACE os mantém)", () => {
    expect(MIGRATION).not.toMatch(
      /^\s*(grant|revoke|comment on|alter function|drop function)\b/im,
    );
  });

  it("o ensaio aplica a migration e confere o SQLSTATE antes e depois", () => {
    expect(ENSAIO).toContain(`\ir ../migrations/${NOME}`);
    expect(ENSAIO).toMatch(/^begin;/m);
    expect(ENSAIO.trimEnd()).toMatch(/rollback;$/);
    expect(ENSAIO).toContain("FC_EXIGIR_GRAVAR_FICHA");
  });
});
