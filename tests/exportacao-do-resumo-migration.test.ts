import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";

/*
  Migration 20261111210000 (exportação do Resumo por cargo e status), já
  aplicada: o registro da exportação ganhou p_conteudo (LISTA ou RESUMO), e o
  contrato do front o declara.
*/

describe("migration 20261111210000", () => {
  it("o contrato declara p_conteudo", () => {
    expect(CONTRATO_RPC.registrar_exportacao_aprovados?.argumentos).toContain(
      "p_conteudo",
    );
  });
});
