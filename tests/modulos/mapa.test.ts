// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { esquecerFiltrosDasTelas } from "../../src/app/filtros-no-endereco.ts";
import type { DseiDoMapa } from "../../src/lib/mapas/mapa-saude-indigena/tipos.ts";
import type { PropsDoMapaComSigepsi } from "../../src/modulos/mapa-saude-indigena/mapa-com-sigepsi.tsx";
import { criarMapa } from "../../src/modulos/mapa/mapa.tsx";
import { criarEstadoDaVisaoGeral } from "../../src/modulos/visao-geral/estado.ts";
import type { DadosDoMonitoramento } from "../../src/modulos/visao-geral/tipos.ts";

/*
  A aba Mapa (src/modulos/mapa/mapa.tsx): o mapa dos DSEIs numa página
  própria, com o DSEI aberto no endereço (`/saude-indigena/mapa/<dsei>`). O
  mapa de verdade (Leaflet + SIGEPSI) tem os próprios testes; aqui ele é
  trocado por um falso que mostra o que recebeu.
*/

const visto = vi.hoisted(() => ({
  props: null as PropsDoMapaComSigepsi | null,
}));
vi.mock("../../src/modulos/mapa-saude-indigena/mapa-com-sigepsi.tsx", () => ({
  MapaSaudeIndigenaComSigepsi: (props: PropsDoMapaComSigepsi) => {
    visto.props = props;
    return h("div", { "data-mapa-falso": props.dseiSelecionado ?? "" });
  },
}));

const LINHAS = [
  { id: 1, unidade: "DSEI Yanomami", CO_AREA: "saude-indigena" },
  { id: 2, unidade: "DSEI Xingu", CO_AREA: "saude-indigena" },
  { id: 3, unidade: "SEDE", CO_AREA: "sede" },
];

function dadosFalsos(areaAtual = "saude-indigena"): DadosDoMonitoramento {
  return {
    obter: () => ({ linhas: LINHAS, areaAtual, carregado: true }),
    assinar: () => () => {},
  };
}

const props = () => {
  if (!visto.props) throw new Error("o mapa não foi desenhado");
  return visto.props;
};
const url = () => location.pathname + location.search;
const dsei = (k: string): DseiDoMapa => ({ k, n: k }) as DseiDoMapa;

let raiz: Root | null = null;
async function abrir({
  area = "saude-indigena",
  leaflet = async () => {},
}: { area?: string; leaflet?: () => Promise<void> } = {}) {
  const estado = criarEstadoDaVisaoGeral({
    dados: dadosFalsos(area),
    armazenamento: null,
    aberta: false,
  });
  estado.definirLidaPeloMapa(true);
  const irPara = vi.fn();
  const mapa = criarMapa({
    estado,
    supabase: null,
    leaflet,
    irPara,
    comAcompanhamento: true,
  });
  const caixa = document.createElement("div");
  document.body.append(caixa);
  const nova = createRoot(caixa);
  raiz = nova;
  await act(async () => nova.render(mapa.conteudo));
  return { estado, mapa, irPara, caixa };
}

beforeEach(() => {
  visto.props = null;
  esquecerFiltrosDasTelas();
  history.replaceState(null, "", "/saude-indigena/mapa");
});
afterEach(async () => {
  const montada = raiz;
  if (montada) await act(async () => montada.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

describe("a aba Mapa", () => {
  it("desenha o mapa com as linhas da área inteira, sem DSEI aberto", async () => {
    await abrir();
    expect(props().dseiSelecionado).toBeNull();
    expect(props().filtroAtivo).toBe(false);
    expect((props().linhas || []).map((l) => l.unidade)).toEqual([
      "DSEI Yanomami",
      "DSEI Xingu",
    ]);
  });

  it("o link com o DSEI abre o mapa já nele", async () => {
    history.replaceState(null, "", "/saude-indigena/mapa/yanomami");
    await abrir();
    expect(props().dseiSelecionado).toBe("YANOMAMI");
  });

  it("abrir um DSEI muda o endereço; voltar ao Brasil e o voltar do navegador saem dele", async () => {
    await abrir();
    const comprimento = history.length;
    await act(async () => props().aoEscolherDsei?.(dsei("ALTO RIO NEGRO")));
    expect(url()).toBe("/saude-indigena/mapa/alto-rio-negro");
    expect(history.length).toBe(comprimento + 1);
    expect(props().dseiSelecionado).toBe("ALTO RIO NEGRO");

    await act(async () => props().aoSairDoDsei?.());
    expect(url()).toBe("/saude-indigena/mapa");
    expect(props().dseiSelecionado).toBeNull();

    // O voltar do navegador para o endereço com o DSEI reabre o DSEI.
    await act(async () => {
      history.replaceState(null, "", "/saude-indigena/mapa/xingu");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(props().dseiSelecionado).toBe("XINGU");
  });

  it("cada abertura relê o DSEI do endereço (o link do cartão da Visão geral)", async () => {
    const { mapa } = await abrir();
    history.replaceState(null, "", "/saude-indigena/mapa/xingu");
    await act(async () => mapa.render());
    expect(props().dseiSelecionado).toBe("XINGU");
    // Endereço de outra tela não mexe no DSEI.
    history.replaceState(null, "", "/saude-indigena/editais");
    await act(async () => mapa.render());
    expect(props().dseiSelecionado).toBe("XINGU");
  });

  it("a CASAI nacional leva à Visão geral com a busca por ela", async () => {
    const { estado, irPara } = await abrir();
    await act(async () => props().aoFiltrarPorBusca?.("CASAI Brasília"));
    expect(estado.obter().busca).toBe("CASAI Brasília");
    expect(irPara).toHaveBeenCalledWith("dashboard");
  });

  it("fora da Saúde Indígena não há mapa", async () => {
    const { caixa } = await abrir({ area: "sede" });
    expect(visto.props).toBeNull();
    expect(caixa.textContent).toContain("Saúde Indígena");
  });

  it("sem o Leaflet, o aviso com Tentar novamente", async () => {
    const leaflet = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("sem rede"))
      .mockResolvedValue(undefined);
    const { caixa } = await abrir({ leaflet });
    expect(visto.props).toBeNull();
    const botao = [...caixa.querySelectorAll("button")].find((b) =>
      /tentar/i.test(b.textContent || ""),
    );
    expect(botao).toBeDefined();
    await act(async () => botao?.click());
    expect(leaflet).toHaveBeenCalledTimes(2);
    expect(visto.props).not.toBeNull();
  });
});
