import { afterEach, describe, expect, it } from "vitest";
import {
  CHAVE_DO_DONO,
  VALIDADE_DO_CACHE_MS,
  criarCacheDePayload,
  registroVencido,
} from "../src/lib/carga/cache-de-payload";
import { rotuloDaCopia } from "../src/lib/carga/rotulo-da-copia.ts";
import type { ArmazenamentoDoCache } from "../src/lib/carga/cache-de-payload";
import { armazenamentoDePayload } from "../src/modules/cache-de-payload-indexeddb.ts";
import { apagarCopiasVencidas } from "../src/app/varredura-das-copias.ts";
import { indexedDBFalso } from "./indexeddb-falso.js";

/*
  As cópias de payload no aparelho levam nomes e notas de candidatos: valem
  48 h e, vencidas, saem do aparelho (na leitura e na varredura da abertura).
*/

const HORA = 60 * 60 * 1000;

const TIPO = Object.freeze({
  nome: "teste",
  chave: ({ area }: { area: string }) => `teste:${area}`,
  esquema: () => 1,
  esquemas: Object.freeze([1]),
  valido: (payload: unknown) => Boolean(payload),
});

function emMemoria() {
  const dados = new Map<string, unknown>();
  const armazenamento: ArmazenamentoDoCache = {
    ler: async (chave) => structuredClone(dados.get(chave) ?? null),
    guardar: async (chave, valor) => {
      dados.set(chave, structuredClone(valor));
    },
    apagarTudo: async () => dados.clear(),
    apagar: async (chave) => dados.delete(chave),
  };
  return { dados, armazenamento };
}

const U1 = { usuarioId: "u1", area: "sede" };

describe("cópias de payload no aparelho", () => {
  const indexedDBDeAntes = globalThis.indexedDB;
  afterEach(() => {
    Object.assign(globalThis, { indexedDB: indexedDBDeAntes });
  });

  it("valem 48 h", () => {
    expect(VALIDADE_DO_CACHE_MS).toBe(48 * HORA);
    expect(registroVencido({ guardadoEm: 0 }, 48 * HORA)).toBe(false);
    expect(registroVencido({ guardadoEm: 0 }, 48 * HORA + 1)).toBe(true);
    expect(registroVencido({ guardadoEm: "lixo" }, 1)).toBe(true);
    // O registro do dono (o id do usuário, um texto) não vence.
    expect(registroVencido("u1", 99 * HORA)).toBe(false);
  });

  it("diz a data da cópia: dia, mês e hora, sem o ano", () => {
    const guardadoEm = Date.UTC(2026, 10, 17, 13, 14);
    expect(rotuloDaCopia(guardadoEm, "America/Sao_Paulo")).toBe(
      "Dados de 17/11, 10:14",
    );
    expect(rotuloDaCopia(guardadoEm, "America/Manaus")).toBe(
      "Dados de 17/11, 09:14",
    );
    expect(rotuloDaCopia(0)).toBe("");
    expect(rotuloDaCopia("lixo")).toBe("");
  });

  it("devolve a cópia com a hora em que foi guardada", async () => {
    let agora = 10 * HORA;
    const { armazenamento } = emMemoria();
    const cache = criarCacheDePayload({
      armazenamento,
      versao: "v1",
      tipo: TIPO,
      relogio: () => agora,
    });
    await cache.guardar(U1, { linhas: [1] });
    agora += 3 * HORA;
    expect(await cache.lerComData(U1)).toEqual({
      payload: { linhas: [1] },
      guardadoEm: 10 * HORA,
    });
    expect(await cache.ler(U1)).toEqual({ linhas: [1] });
  });

  it("a cópia vencida sai do aparelho na leitura", async () => {
    let agora = 0;
    const { dados, armazenamento } = emMemoria();
    const cache = criarCacheDePayload({
      armazenamento,
      versao: "v1",
      tipo: TIPO,
      relogio: () => agora,
    });
    await cache.guardar(U1, { linhas: [1] });
    expect(dados.has("teste:sede")).toBe(true);
    agora = 48 * HORA + 1;
    expect(await cache.lerComData(U1)).toBeNull();
    expect(dados.has("teste:sede")).toBe(false);
    expect(dados.get(CHAVE_DO_DONO)).toBe("u1");
  });

  it("a varredura da abertura apaga as vencidas de todas as telas e deixa as outras", async () => {
    const falso = indexedDBFalso();
    Object.assign(globalThis, { indexedDB: falso });
    await armazenamentoDePayload.guardar(CHAVE_DO_DONO, "u1");
    await armazenamentoDePayload.guardar("aprovados:sede", { guardadoEm: 0 });
    await armazenamentoDePayload.guardar("entrevistas:sede", {
      guardadoEm: 40 * HORA,
    });

    expect(await apagarCopiasVencidas(50 * HORA)).toBe(1);
    expect(await armazenamentoDePayload.ler("aprovados:sede")).toBeNull();
    expect(await armazenamentoDePayload.ler("entrevistas:sede")).toEqual({
      guardadoEm: 40 * HORA,
    });
    expect(await armazenamentoDePayload.ler(CHAVE_DO_DONO)).toBe("u1");
  });

  it("a varredura não cria o banco que não existe e nunca lança", async () => {
    const falso = indexedDBFalso();
    Object.assign(globalThis, { indexedDB: falso });
    expect(await apagarCopiasVencidas(1)).toBe(0);
    expect(falso.bancos.size).toBe(0);

    Object.assign(globalThis, { indexedDB: undefined });
    expect(await apagarCopiasVencidas(1)).toBe(0);
  });
});
