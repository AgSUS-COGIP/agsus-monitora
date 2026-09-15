import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("src/modules/legacy-app.js", "utf8");
const start = source.indexOf("async function saveMapaConfigToSupabase(");
const end = source.indexOf("async function loadMapaConfig(", start);

describe("persistência da importação CNES", () => {
  it("salva somente a rede importada, preservando o cadastro dos DSEIs", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const LMAP = Object.freeze({ dsei: [{ n: "Cadastro existente" }] });
    const REDE_CNES = { rede: { X: [] }, nac: [] };
    await runInNewContext(
      `${source.slice(start, end)}; saveMapaConfigToSupabase({silent: true})`,
      {
        sb: { from: () => ({ upsert }) },
        can: () => true,
        LMAP,
        REDE_CNES,
        MAPA_CONFIG_TABLE: "mapa_saude_indigena_config",
        mapConfigLoadOk: false,
      },
    );
    expect(upsert).toHaveBeenCalledOnce();
    const [rows, options] = upsert.mock.calls[0];
    expect(rows.map((row) => row.chave)).toEqual(["rede_cnes"]);
    expect(rows[0].payload).toBe(REDE_CNES);
    expect(options).toEqual({ onConflict: "chave" });
    expect(LMAP.dsei[0].n).toBe("Cadastro existente");
  });
});
