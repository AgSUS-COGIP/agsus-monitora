import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONTRATO_RPC,
  RPCS_CRITICAS,
  contratoDe,
} from "../src/lib/rpc-contrato.js";

const app = readFileSync("src/modules/legacy-app.js", "utf8");

describe("contrato de RPC", () => {
  it("declara as funções de administração de acesso como críticas", () => {
    for (const nome of [
      "aprovar_solicitacao_acesso",
      "recusar_solicitacao_acesso",
      "atualizar_acesso_usuario",
      "desativar_acesso_usuario",
    ]) {
      expect(RPCS_CRITICAS, `${nome} deveria ser crítica`).toContain(nome);
    }
  });

  /*
    Auditoria e presença nunca podem derrubar a interface: se falharem, a pessoa
    continua trabalhando. Marcá-las como críticas faria o build cair por um
    registo de log.
  */
  it("não trata auditoria e presença como críticas", () => {
    expect(contratoDe("registrar_evento_acesso").critica).toBe(false);
    expect(contratoDe("registrar_presenca_monitora").critica).toBe(false);
    expect(contratoDe("listar_presenca_online_monitora").critica).toBe(false);
  });

  it("descreve cada função declarada", () => {
    for (const [nome, c] of Object.entries(CONTRATO_RPC)) {
      expect(c.resumo, `${nome} sem resumo`).toBeTruthy();
      expect(
        Array.isArray(c.argumentos),
        `${nome} sem lista de argumentos`,
      ).toBe(true);
    }
  });
});

describe("fronteira de dados na administração de acesso", () => {
  /*
    Esta é a regressão que motivou a mudança: aprovar, atualizar e desativar já
    passavam por RPC, mas recusar gravava direto na tabela — escolhendo no
    navegador `status`, `avaliado_por` e `avaliado_em`. A autorização da mesma
    decisão ficava em dois lugares.
  */
  it("recusar solicitação passa por RPC, não por escrita direta", () => {
    const fn = app.slice(
      app.indexOf("async function denyAccessRequest(id) {"),
      app.indexOf("async function denyAccessRequest(id) {") + 900,
    );
    expect(fn).toContain("RPC_DENY_ACCESS_REQUEST");
    expect(fn).not.toMatch(/\.from\("TB_SOLICITACAO_ACESSO"\)/);
  });

  it("nenhuma decisão de acesso é gravada direto na tabela", () => {
    const decisoes = [
      /status:\s*"recusado"/,
      /status:\s*"aprovado"/,
      /avaliado_por:/,
    ];
    for (const padrao of decisoes) {
      expect(app, `campo de decisão escrito no cliente: ${padrao}`).not.toMatch(
        padrao,
      );
    }
  });
});
