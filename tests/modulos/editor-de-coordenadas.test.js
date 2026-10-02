import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorDeCoordenadas } from "../../src/modulos/mapa-saude-indigena/editor-de-coordenadas.jsx";
import { MapaSaudeIndigena } from "../../src/modulos/mapa-saude-indigena/mapa-saude-indigena.jsx";
import { clicar, digitar, escolher } from "../componentes/interacoes.js";
import { criarLeafletFalso } from "./leaflet-falso.js";

const lmap = {
  dsei: [
    {
      k: "A",
      n: "Distrito A",
      lat: -10,
      lon: -50,
      ufs: ["MT"],
      polos: [{ n: "Polo A", lat: -11, lon: -51 }],
    },
  ],
};
const admin = { ativo: true, perfil: "admin", admin_global: true };
let host, raiz, leaflet, mapa, props;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  raiz = createRoot(host);
  leaflet = criarLeafletFalso();
  mapa = leaflet.L.map(document.createElement("div"), {});
  const original = leaflet.L.marker;
  leaflet.L.marker = (...args) => {
    const pin = original(...args);
    pin.getLatLng = () => ({ lat: pin.latlng[0], lng: pin.latlng[1] });
    return pin;
  };
  props = {
    L: leaflet.L,
    mapa,
    lmap,
    redeCnes: {},
    dsei: "A",
    perfil: admin,
    supabase: {
      rpc: vi
        .fn()
        .mockResolvedValue({ data: { lmap, rede_cnes: {} }, error: null }),
    },
    aoAtualizarMapa: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => raiz.unmount());
  host.remove();
  delete globalThis.L;
});
async function renderizar(atual = props) {
  await act(async () => raiz.render(createElement(EditorDeCoordenadas, atual)));
}
const botao = (texto) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === texto);
async function selecionarPolo() {
  await escolher(
    host.querySelector("select"),
    host.querySelectorAll("option")[2].value,
  );
}

describe("edição administrativa de coordenadas", () => {
  it("oculta edição de não-admin e retira pin ao perder permissão", async () => {
    await renderizar({
      ...props,
      perfil: { perfil: "admin", admin_global: false },
    });
    expect(host.textContent).toBe("");
    await renderizar();
    await selecionarPolo();
    expect([...mapa.camadas].filter((c) => c.opcoes.draggable)).toHaveLength(1);
    await renderizar({ ...props, perfil: { perfil: "usuario" } });
    expect(host.textContent).toBe("");
    expect([...mapa.camadas].filter((c) => c.opcoes.draggable)).toHaveLength(0);
  });
  it("arrasta só pin de prévia, desfaz sem RPC e exige confirmação antes de salvar", async () => {
    await renderizar();
    await selecionarPolo();
    const pin = [...mapa.camadas].find((c) => c.opcoes.draggable);
    await act(async () => {
      pin.setLatLng([-12, -52]);
      pin.fire("dragend");
    });
    expect(lmap.dsei[0].polos[0].lat).toBe(-11);
    expect(host.querySelectorAll("input")[0].value).toBe("-12.000000");
    await clicar(botao("Desfazer prévia"));
    expect(pin.latlng).toEqual([-11, -51]);
    expect(props.supabase.rpc).not.toHaveBeenCalled();
    await digitar(host.querySelectorAll("input")[0], "-12,5");
    await digitar(
      host.querySelector("textarea"),
      "Ajuste conforme fonte oficial",
    );
    await clicar(botao("Salvar coordenada"));
    expect(props.supabase.rpc).not.toHaveBeenCalled();
    await clicar(botao("Confirmar correção"));
    expect(props.supabase.rpc).toHaveBeenCalledWith(
      "salvar_coordenada_mapa_saude_indigena",
      expect.objectContaining({
        p_latitude: -12.5,
        p_longitude: -51,
        p_latitude_anterior: -11,
        p_longitude_anterior: -51,
        p_alvo: expect.objectContaining({
          tipo: "polo",
          indice: 0,
          nome: "Polo A",
        }),
      }),
    );
    expect(props.aoAtualizarMapa).toHaveBeenCalledWith({ lmap, rede_cnes: {} });
  });
  it("preserva prévia e comunica conflito sem anunciar sucesso", async () => {
    props.supabase.rpc.mockResolvedValue({
      error: {
        message: "Coordenada alterada por outra pessoa. Atualize o mapa.",
      },
    });
    await renderizar();
    await selecionarPolo();
    await digitar(host.querySelectorAll("input")[0], "-12");
    await digitar(
      host.querySelector("textarea"),
      "Nova fonte oficial consultada",
    );
    await clicar(botao("Salvar coordenada"));
    await clicar(botao("Confirmar correção"));
    expect(host.querySelector('[role="alert"]').textContent).toContain(
      "outra pessoa",
    );
    expect(props.aoAtualizarMapa).not.toHaveBeenCalled();
    expect(host.querySelectorAll("input")[0].value).toBe("-12");
  });
  it("mostra entrada Coordenadas apenas para admin nos mapas nacional e do distrito", async () => {
    globalThis.L = leaflet.L;
    const renderMapa = async (perfil, dseiSelecionado) =>
      act(async () =>
        raiz.render(
          createElement(MapaSaudeIndigena, {
            lmap,
            redeCnes: {},
            perfil,
            dseiSelecionado,
          }),
        ),
      );
    await renderMapa({ perfil: "usuario" }, "A");
    expect(botao("Coordenadas")).toBeUndefined();
    await renderMapa(admin, "A");
    expect(host.querySelector(".mapa-si-painel--dsei").textContent).toContain(
      "Coordenadas",
    );
    await renderMapa(admin, null);
    expect(
      host.querySelector(".mapa-si-painel--nacional").textContent,
    ).toContain("Coordenadas");
  });
});
