import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TravaDasInscricoes } from "../../src/modulos/avaliacao-documental/trava-das-inscricoes.tsx";
import {
  erroDoMotivo,
  lerTrava,
  mostrarTrava,
  textoDoEvento,
} from "../../src/lib/avaliacao-documental/trava-das-inscricoes.ts";
import { clicar, digitar, esperar } from "./interacoes.js";

/*
  Cartão "Inscrições congeladas" da aba Triagem (migration
  20261020170000): congelado, todos veem (quem, quando, motivo); a
  coordenação/administrador congela ou libera com motivo; liberado e sem
  permissão, não aparece; banco sem a migration, não aparece. RPC falsa.
*/

const EDITAL = "bcecfb08-88ef-4e06-8401-bcad6bf88fd0";
const CONGELADO = {
  congelado: true,
  motivo: "Inscrições encerradas em 14/10/2026.",
  em: "2026-10-20T19:00:00Z",
  por: "Gestão da Informação",
  pode_alterar: true,
  historico: [
    {
      tipo: "CONGELAR",
      motivo: "Inscrições encerradas em 14/10/2026.",
      em: "2026-10-20T19:00:00Z",
      por: "Gestão da Informação",
    },
  ],
};
const LIBERADO = { congelado: false, pode_alterar: true, historico: [] };

let raiz;
let alvo;
async function montar(rpc) {
  alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
  await esperar(async () => {
    raiz.render(createElement(TravaDasInscricoes, { editalId: EDITAL, rpc }));
  });
  await esperar();
  return alvo;
}
afterEach(() => {
  act(() => raiz?.unmount());
  alvo?.remove();
});

describe("regras da trava", () => {
  it("lê a resposta do banco com segurança e diz quando mostrar", () => {
    const t = lerTrava(CONGELADO);
    expect(t.congelado).toBe(true);
    expect(t.em).toBeInstanceOf(Date);
    expect(t.historico).toHaveLength(1);
    expect(mostrarTrava(t)).toBe(true);
    expect(
      mostrarTrava(lerTrava({ congelado: false, pode_alterar: false })),
    ).toBe(false);
    expect(mostrarTrava(lerTrava(null))).toBe(false);
    expect(lerTrava({ historico: [{ tipo: "USO" }, "x"] }).historico).toEqual(
      [],
    );
  });

  it("motivo de 10 a 500 caracteres e o evento em texto", () => {
    expect(erroDoMotivo("curto")).toContain("10 a 500");
    expect(erroDoMotivo("Motivo suficiente")).toBe("");
    expect(textoDoEvento(lerTrava(CONGELADO).historico[0])).toMatch(
      /^Congelou em \d\d\/\d\d por Gestão da Informação: Inscrições encerradas/,
    );
  });
});

describe("cartão Inscrições congeladas", () => {
  it("congelado: mostra a trava e libera com motivo", async () => {
    const rpc = vi.fn(async (nome, args) => {
      if (nome === "obter_congelamento_inscricoes") return CONGELADO;
      if (nome === "alterar_congelamento_inscricoes")
        return { ...LIBERADO, historico: [] };
      throw new Error(nome + JSON.stringify(args));
    });
    const el = await montar(rpc);
    expect(rpc).toHaveBeenCalledWith("obter_congelamento_inscricoes", {
      p_edital: EDITAL,
    });
    const cartao = el.querySelector('[data-trava="congelada"]');
    expect(cartao).not.toBeNull();
    expect(cartao.textContent).toContain("Inscrições congeladas");
    expect(cartao.textContent).toContain("por Gestão da Informação");
    expect(cartao.textContent).toContain("Histórico (1)");

    await clicar(el.querySelector('[data-acao="abrir-liberar"]'));
    const confirmar = el.querySelector('[data-acao="liberar"]');
    expect(confirmar.disabled).toBe(true);
    await digitar(el.querySelector('[data-campo="motivo-da-trava"]'), "curto");
    expect(el.textContent).toContain("Informe o motivo (10 a 500 caracteres).");
    await digitar(
      el.querySelector('[data-campo="motivo-da-trava"]'),
      "Coordenação autorizou nova carga",
    );
    expect(el.querySelector('[data-acao="liberar"]').disabled).toBe(false);
    await clicar(el.querySelector('[data-acao="liberar"]'));
    await esperar();
    expect(rpc).toHaveBeenLastCalledWith("alterar_congelamento_inscricoes", {
      p_edital: EDITAL,
      p_congelar: false,
      p_motivo: "Coordenação autorizou nova carga",
    });
    expect(el.querySelector('[data-trava="liberada"]')).not.toBeNull();
    expect(el.querySelector('[data-acao="abrir-congelar"]')).not.toBeNull();
  });

  it("liberado: a coordenação congela; o erro do banco aparece", async () => {
    const rpc = vi.fn(async (nome) => {
      if (nome === "obter_congelamento_inscricoes") return LIBERADO;
      throw {
        code: "42501",
        message:
          "Só a coordenação da avaliação do edital ou o administrador global congela ou libera as inscrições.",
      };
    });
    const el = await montar(rpc);
    expect(el.textContent).not.toContain("desde");
    await clicar(el.querySelector('[data-acao="abrir-congelar"]'));
    expect(el.textContent).toContain("deixam de mexer neste edital");
    await digitar(
      el.querySelector('[data-campo="motivo-da-trava"]'),
      "Inscrições encerradas",
    );
    await clicar(el.querySelector('[data-acao="congelar"]'));
    await esperar();
    expect(el.querySelector('[role="alert"]').textContent).toContain(
      "Só a coordenação",
    );
  });

  it("liberado e sem permissão, ou sem a migration: não aparece", async () => {
    let el = await montar(
      vi.fn(async () => ({ congelado: false, pode_alterar: false })),
    );
    expect(el.querySelector("[data-trava]")).toBeNull();
    act(() => raiz.unmount());
    alvo.remove();
    el = await montar(
      vi.fn(async () => {
        throw { code: "PGRST202", message: "Could not find the function" };
      }),
    );
    expect(el.querySelector("[data-trava]")).toBeNull();
  });

  it("congelado e sem permissão: só leitura, sem botões", async () => {
    const el = await montar(
      vi.fn(async () => ({ ...CONGELADO, pode_alterar: false })),
    );
    expect(el.querySelector('[data-trava="congelada"]')).not.toBeNull();
    expect(el.querySelector("button")).toBeNull();
  });
});
