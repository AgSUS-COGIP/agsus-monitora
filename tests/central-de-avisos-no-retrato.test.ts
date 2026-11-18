import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";

/*
  A CENTRAL DE AVISOS NO BANCO (migration 20261118140000, aplicada em 18/11/2026)

  Pelo retrato do banco (supabase/esquema-atual.sql): o tratamento separado da situação, o histórico
  que só cresce, as evidências, as RPCs da tela (as mesmas do contrato) e a rechecagem que não apaga
  o motivo de quem tratou. O comportamento foi ensaiado no banco antes da aplicação.
*/
const RETRATO = readFileSync("supabase/esquema-atual.sql", "utf8").replace(
  /\r/g,
  "",
);

function corpo(funcao: string) {
  const i = RETRATO.indexOf(`CREATE FUNCTION ${funcao}`);
  expect(i, funcao).toBeGreaterThanOrEqual(0);
  const resto = RETRATO.slice(i);
  const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
  const tag = achado?.[1];
  if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
  const ini = achado.index + achado[0].length;
  return resto.slice(ini, resto.indexOf(tag, ini));
}

describe("central de avisos no retrato do banco", () => {
  it("tratamento, responsável e prazo no aviso; histórico e evidência em tabelas próprias", () => {
    const aviso = RETRATO.slice(
      RETRATO.indexOf('CREATE TABLE public."TB_AVISO_CONFERENCIA" ('),
    );
    const colunas = aviso.slice(0, aviso.indexOf("\n);"));
    for (const coluna of [
      '"TP_TRATAMENTO"',
      '"CO_USUARIO_RESPONSAVEL"',
      '"DT_PRAZO"',
      '"QT_OCORRENCIA_DISPENSADA"',
    ])
      expect(colunas).toContain(coluna);
    expect(colunas).not.toContain("IGNORADO");
    expect(RETRATO).toContain('CREATE TABLE public."TH_AVISO_CONFERENCIA" (');
    expect(RETRATO).toContain(
      'CREATE TABLE public."TB_EVIDENCIA_AVISO_CONFERENCIA" (',
    );
  });

  it("as RPCs da tela existem com os argumentos do contrato; a de ignorar saiu", () => {
    for (const nome of [
      "tratar_aviso_conferencia",
      "atribuir_aviso_conferencia",
      "listar_responsaveis_aviso_conferencia",
      "incluir_evidencia_aviso_conferencia",
      "retirar_evidencia_aviso_conferencia",
      "listar_historico_aviso_conferencia",
    ]) {
      const assinatura = new RegExp(
        `CREATE FUNCTION public\\.${nome}\\(([^)]*)\\)`,
      ).exec(RETRATO)?.[1];
      expect(assinatura, nome).toBeDefined();
      const argumentos = (assinatura ?? "")
        .split(",")
        .map((p) => p.trim().split(/\s+/)[0]);
      expect(argumentos, nome).toEqual(CONTRATO_RPC[nome]?.argumentos);
    }
    expect(RETRATO).not.toContain(
      "CREATE FUNCTION public.ignorar_aviso_conferencia(",
    );
  });

  it("a rechecagem resolve sem apagar o motivo e grava o histórico", () => {
    const finalizar = corpo("public.finalizar_conferencia(");
    expect(finalizar).toContain("'RECHECADO_SEM_PROBLEMA'");
    expect(finalizar).toContain("'NAO_ACHADO'");
    const gravar = corpo("public.gravar_avisos_conferencia(");
    expect(gravar).toContain("'RECHECADO_COM_PROBLEMA'");
    expect(gravar).toContain('"QT_OCORRENCIA_DISPENSADA"');
  });
});
