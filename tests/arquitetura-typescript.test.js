import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporarios = [];

afterEach(() => {
  for (const pasta of temporarios.splice(0)) {
    if (
      dirname(resolve(pasta)) !== resolve(tmpdir()) ||
      !basename(pasta).startsWith("monitora-arquitetura-ts-")
    ) {
      throw new Error("Diretório temporário fora da área de teste");
    }
    rmSync(pasta, { recursive: true, force: true });
  }
});

function verificar(script, extensao, fonte, contrato = {}) {
  const pasta = mkdtempSync(join(tmpdir(), "monitora-arquitetura-ts-"));
  temporarios.push(pasta);
  mkdirSync(join(pasta, "src/lib"), { recursive: true });
  writeFileSync(join(pasta, "package.json"), '{"type":"module"}');
  writeFileSync(
    join(pasta, "src/lib/rpc-contrato.js"),
    `export const CONTRATO_RPC = ${JSON.stringify(contrato)};`,
  );
  writeFileSync(join(pasta, `src/tela.${extensao}`), fonte);
  const resultado = spawnSync(process.execPath, [resolve(script)], {
    cwd: pasta,
    encoding: "utf8",
  });
  if (resultado.error) throw resultado.error;
  return {
    codigo: resultado.status,
    saida: resultado.stdout + resultado.stderr,
  };
}

describe("arquitetura nos arquivos migrados", () => {
  it.each(["ts", "tsx"])("recusa RPC fora do contrato em %s", (extensao) => {
    const resultado = verificar(
      "scripts/check-rpc-contract.mjs",
      extensao,
      'cliente.rpc("rpc_sem_contrato");',
    );
    expect(resultado.codigo).toBe(1);
    expect(resultado.saida).toContain('RPC "rpc_sem_contrato"');
  });

  it.each(["ts", "tsx"])("reconhece RPC declarada usada em %s", (extensao) => {
    const resultado = verificar(
      "scripts/check-rpc-contract.mjs",
      extensao,
      'cliente.rpc("listar_dados");',
      { listar_dados: {} },
    );
    expect(resultado.codigo).toBe(0);
    expect(resultado.saida).toContain("1 função(ões)");
  });

  it.each(["jsx", "tsx"])(
    "recusa cliente de autenticação avulso em %s",
    (extensao) => {
      const resultado = verificar(
        "scripts/check-supabase-auth-architecture.mjs",
        extensao,
        'import { createClient } from "@supabase/supabase-js";',
      );
      expect(resultado.codigo).toBe(1);
      expect(resultado.saida).toContain(
        "cliente Supabase fora de lib/supabaseClient.js",
      );
    },
  );
});
