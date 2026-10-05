import { readFileSync } from "node:fs";
import { fonteDoApp } from "./fonte-do-app.js";
import { describe, expect, it } from "vitest";
import {
  CONTRATO_RPC,
  RPCS_CRITICAS,
  contratoDe,
} from "../src/lib/rpc-contrato.js";

const app = fonteDoApp();
const acessos = readFileSync("src/modulos/acessos/estado.js", "utf8");

describe("contrato de RPC", () => {
  it("declara as funções de administração de acesso como críticas", () => {
    for (const nome of [
      "aprovar_solicitacao_acesso",
      "recusar_solicitacao_acesso",
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
    decisão ficava em dois lugares. Hoje a decisão é do Acessos em React
    (src/modulos/acessos/estado.js).
  */
  it("recusar solicitação passa por RPC, não por escrita direta", () => {
    const inicio = acessos.indexOf("function recusar(");
    expect(inicio).toBeGreaterThan(-1);
    const fn = acessos.slice(inicio, inicio + 900);
    expect(fn).toContain("rpc(RPC_RECUSAR");
    expect(acessos).toContain(
      'const RPC_RECUSAR = "recusar_solicitacao_acesso"',
    );
    expect(acessos).not.toMatch(
      /\.from\(\s*["']TB_SOLICITACAO_ACESSO["']\s*\)/,
    );
  });

  it("nenhuma decisão de acesso é gravada direto na tabela", () => {
    const decisoes = [
      /status:\s*"recusado"/,
      /status:\s*"aprovado"/,
      /avaliado_por:/,
    ];
    for (const fonte of [app, acessos]) {
      for (const padrao of decisoes) {
        expect(
          fonte,
          `campo de decisão escrito no cliente: ${padrao}`,
        ).not.toMatch(padrao);
      }
    }
  });
});
