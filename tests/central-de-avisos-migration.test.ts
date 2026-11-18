import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";

/*
  A MIGRATION DA CENTRAL DE AVISOS (20261118140000), enquanto pendente

  Tratamento, responsável, prazo, evidência e histórico dos avisos das conferências. O comportamento
  foi ensaiado no banco (supabase/ensaios/, com um ciclo da conferência: corrigido e achado de novo
  volta para em análise; não achado fica rechecado sem problema). Aqui, o texto: a guarda parte dos
  corpos do retrato, nada apaga o motivo de quem tratou, as RPCs novas batem com o contrato e o
  rollback devolve os corpos e comentários do retrato, letra por letra. Aplicada a migration (e
  regerado o retrato), este teste sai junto com ela.
*/
const NOME = "20261118140000_central_de_avisos_das_conferencias.sql";
const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r/g, "");
const RETRATO = ler("supabase/esquema-atual.sql");
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const TROCADAS = [
  "public.gravar_avisos_conferencia(",
  "public.finalizar_conferencia(",
  'private."FC_FECHAR_CASOS_DO_AVISO"(',
  "public.listar_avisos_conferencia(",
  "public.listar_casos_aviso_conferencia(",
] as const;

function definicao(texto: string, funcao: string, inicio = "CREATE FUNCTION") {
  const i = texto.indexOf(`${inicio} ${funcao}`);
  expect(i, `${inicio} ${funcao}`).toBeGreaterThanOrEqual(0);
  const resto = texto.slice(i);
  const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
  const tag = achado?.[1];
  if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
  const ini = achado.index + achado[0].length;
  const fim = resto.indexOf(tag, ini);
  return {
    inteira: resto.slice(0, fim + tag.length),
    corpo: resto.slice(ini, fim),
  };
}

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

describe("migration da central de avisos", () => {
  it("a guarda parte do md5 (sem retorno de carro) dos corpos do retrato", () => {
    expect(MIGRATION).toContain("md5(replace((select prosrc");
    for (const f of [...TROCADAS, "public.ignorar_aviso_conferencia("]) {
      expect(MIGRATION, f).toContain(
        `is distinct from '${md5(definicao(RETRATO, f).corpo)}'`,
      );
    }
  });

  it("nada apaga o motivo: as colunas do ignorar saem só depois de irem para o histórico", () => {
    const migrado = MIGRATION.indexOf("'MIGRADO'");
    const sai = MIGRATION.indexOf('drop column "DS_MOTIVO_IGNORADO"');
    expect(migrado).toBeGreaterThan(0);
    expect(sai).toBeGreaterThan(migrado);
    for (const f of TROCADAS) {
      const { corpo } = definicao(MIGRATION, f, "CREATE OR REPLACE FUNCTION");
      expect(corpo, f).not.toMatch(/IGNORADO|DS_MOTIVO_IGNORADO/);
    }
    // O robô não apaga o tratamento dispensado ao resolver.
    const { corpo } = definicao(
      MIGRATION,
      "public.finalizar_conferencia(",
      "CREATE OR REPLACE FUNCTION",
    );
    expect(corpo).toContain(
      "case when x.antes = 'DISPENSADO' then 'DISPENSADO' else 'RECHECADO_SEM_PROBLEMA' end",
    );
    expect(corpo).toContain("'NAO_ACHADO'");
  });

  it("as RPCs novas batem com o contrato e só authenticated executa", () => {
    const novas: Record<string, string[]> = {
      tratar_aviso_conferencia: ["p_id", "p_tratamento", "p_motivo"],
      atribuir_aviso_conferencia: ["p_id", "p_responsavel", "p_prazo"],
      listar_responsaveis_aviso_conferencia: ["p_id"],
      incluir_evidencia_aviso_conferencia: [
        "p_id",
        "p_tipo",
        "p_descricao",
        "p_url",
        "p_chave_caso",
      ],
      retirar_evidencia_aviso_conferencia: ["p_evidencia", "p_motivo"],
      listar_historico_aviso_conferencia: ["p_id"],
    };
    for (const [nome, argumentos] of Object.entries(novas)) {
      expect(CONTRATO_RPC[nome]?.argumentos, nome).toEqual(argumentos);
      const criacao = new RegExp(
        `create function public\\.${nome}\\(([^)]*)\\)`,
      ).exec(MIGRATION);
      expect(criacao, nome).not.toBeNull();
      const nomes = (criacao?.[1] ?? "")
        .split(",")
        .map((p) => p.trim().split(/\s+/)[0]);
      expect(nomes, nome).toEqual(argumentos);
      expect(MIGRATION).toMatch(
        new RegExp(
          `grant execute on function public\\.${nome}\\(.*\\) to authenticated;`,
        ),
      );
      expect(MIGRATION).toMatch(
        new RegExp(
          `revoke all on function public\\.${nome}\\(.*\\) from public;`,
        ),
      );
    }
    expect(CONTRATO_RPC).not.toHaveProperty("ignorar_aviso_conferencia");
    expect(MIGRATION).toContain(
      "drop function public.ignorar_aviso_conferencia(uuid, text);",
    );
  });

  it("tabelas novas com RLS e sem policy; a marca da lista conta as duas", () => {
    for (const tabela of [
      "TH_AVISO_CONFERENCIA",
      "TB_EVIDENCIA_AVISO_CONFERENCIA",
    ]) {
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).not.toMatch(
        new RegExp(`create policy[^;]*"${tabela}"`, "i"),
      );
    }
    expect(MIGRATION).toContain(
      'select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();',
    );
  });

  it("o rollback devolve corpos e comentários do retrato, letra por letra, e a ignorar_aviso_conferencia", () => {
    for (const f of [...TROCADAS, "public.ignorar_aviso_conferencia("]) {
      const { inteira } = definicao(RETRATO, f);
      const esperado = f.startsWith("public.ignorar")
        ? inteira
        : inteira.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION");
      expect(ROLLBACK, f).toContain(esperado);
    }
    for (const restricao of [
      "CK_AVISOCONF_IGNORADO",
      "CK_AVISOCONF_QT",
      "CK_AVISOCONF_TPSITUACAO",
    ]) {
      const antes = new RegExp(
        `CONSTRAINT "${restricao}" (CHECK \\(.*\\)),?\\n`,
      ).exec(RETRATO)?.[1];
      expect(antes, restricao).toBeTruthy();
      expect(ROLLBACK).toContain(`add constraint "${restricao}" ${antes}`);
    }
  });

  it("rollback e ensaio conferem o md5 do corpo novo; o ensaio termina em rollback", () => {
    for (const f of TROCADAS) {
      const { corpo } = definicao(MIGRATION, f, "CREATE OR REPLACE FUNCTION");
      expect(ROLLBACK, f).toContain(`is distinct from '${md5(corpo)}'`);
    }
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });
});
