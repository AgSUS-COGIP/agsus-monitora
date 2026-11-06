import { act, createElement as h, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buscaComFiltros,
  esquecerFiltrosDasTelas,
  filtrosDaBusca,
  filtrosGuardadosDaTela,
  guardarFiltrosDaTela,
  mudouOQueEmpilha,
  normalizarFiltros,
} from "../../src/app/filtros-no-endereco.ts";
import type {
  EsquemaDosFiltros,
  ValoresDosFiltros,
} from "../../src/app/filtros-no-endereco.ts";
import type { MudarFiltros } from "../../src/app/usar-filtros-na-url.ts";
import { definido } from "../definido.ts";
import {
  TelaNaUrl,
  usarEditalNaUrl,
  usarFiltrosNaUrl,
  usarLojaNaUrl,
} from "../../src/app/usar-filtros-na-url.ts";
import { caminhoDoDestino, destinoDoCaminho } from "../../src/lib/rotas.ts";
import "../componentes/interacoes.ts";

/*
  Os filtros das telas da seleção na URL (Triagem, Avaliação documental,
  Classificação): link copiado abre filtrado, voltar/avançar do navegador
  volta aos filtros, a busca por nome/CPF nunca vai à URL.
*/

const TRIAGEM = "/projetos/triagem";
type CampoDaTriagem = "aba" | "situacao" | "busca";
const ESQUEMA: EsquemaDosFiltros<CampoDaTriagem> = Object.freeze({
  aba: {
    padrao: "resumo",
    aceita: (v: string) => ["resumo", "pessoas", "vagas"].includes(v),
    empilha: true,
  },
  situacao: { padrao: "TODAS" },
  busca: { padrao: "", naUrl: false },
});

const url = () => location.pathname + location.search;
const voltarPara = async (endereco: string) => {
  await act(async () => {
    history.replaceState(null, "", endereco);
    dispatchEvent(new PopStateEvent("popstate"));
  });
};

let raiz: Root | null = null;
async function montar(elemento: ReactElement, tela = "pre-classificacao") {
  const caixa = document.createElement("div");
  document.body.append(caixa);
  const novaRaiz = createRoot(caixa);
  raiz = novaRaiz;
  await act(async () =>
    novaRaiz.render(h(TelaNaUrl.Provider, { value: tela }, elemento)),
  );
}

beforeEach(() => {
  esquecerFiltrosDasTelas();
  sessionStorage.clear();
  history.replaceState(null, "", TRIAGEM);
});
afterEach(async () => {
  const montada = raiz;
  if (montada) await act(async () => montada.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

describe("regras dos filtros no endereço", () => {
  it("lê só os da URL, recusa o inválido e diz quando não há nenhum", () => {
    expect(filtrosDaBusca(ESQUEMA, "?outro=1")).toBeNull();
    expect(filtrosDaBusca(ESQUEMA, "?aba=xyz&busca=Maria")).toEqual({
      aba: "resumo",
      situacao: "TODAS",
    });
    expect(filtrosDaBusca(ESQUEMA, "?aba=pessoas&situacao=ELIMINADOS")).toEqual(
      { aba: "pessoas", situacao: "ELIMINADOS" },
    );
  });

  it("escreve sem o padrão e sem a busca; `manter` leva o resto embora", () => {
    expect(
      buscaComFiltros("?edital=e1&vaga=7", ESQUEMA, {
        aba: "resumo",
        situacao: "ELIMINADOS",
        busca: "123.456.789-00",
      }),
    ).toBe("?edital=e1&vaga=7&situacao=ELIMINADOS");
    expect(
      buscaComFiltros("?edital=e1&vaga=7&visao=x", ESQUEMA, { aba: "vagas" }, [
        "edital",
      ]),
    ).toBe("?edital=e1&visao=x&aba=vagas");
    expect(buscaComFiltros("?aba=pessoas", ESQUEMA, { aba: "resumo" })).toBe(
      "",
    );
  });

  it("normaliza o guardado e sabe o que empilha", () => {
    expect(normalizarFiltros(ESQUEMA, { aba: "nada", busca: 5 })).toEqual({
      aba: "resumo",
      situacao: "TODAS",
      busca: "",
    });
    const antes = { aba: "resumo", situacao: "TODAS", busca: "" };
    expect(mudouOQueEmpilha(ESQUEMA, antes, { situacao: "X" })).toBe(false);
    expect(mudouOQueEmpilha(ESQUEMA, antes, { aba: "vagas" })).toBe(true);
  });

  it("a rota leva os filtros, sem a visão", () => {
    const destino = destinoDoCaminho(TRIAGEM, "?visao=v&edital=e1&aba=vagas");
    expect(destino).toMatchObject({
      view: "pre-classificacao",
      visao: "v",
      filtros: "edital=e1&aba=vagas",
    });
    expect(
      caminhoDoDestino({
        view: "pre-classificacao",
        area: "projetos",
        filtros: "edital=e1",
      }),
    ).toBe(`${TRIAGEM}?edital=e1`);
    guardarFiltrosDaTela("classificacao", "?visao=v&aba=agenda");
    expect(filtrosGuardadosDaTela("classificacao")).toBe("aba=agenda");
  });
});

describe("usarFiltrosNaUrl", () => {
  let filtros: ValoresDosFiltros<CampoDaTriagem>;
  let mudar: MudarFiltros<CampoDaTriagem>;
  function Tela({ sessao = "" }: { sessao?: string }) {
    [filtros, mudar] = usarFiltrosNaUrl(ESQUEMA, {
      sessao,
      manter: ["edital"],
    });
    return h("output", null, `${filtros.aba}|${filtros.situacao}`);
  }

  it("abre com os filtros do link", async () => {
    history.replaceState(null, "", `${TRIAGEM}?aba=pessoas&situacao=X`);
    await montar(h(Tela));
    expect(filtros).toMatchObject({ aba: "pessoas", situacao: "X" });
  });

  it("filtro troca a entrada; a aba empilha e deixa só o edital", async () => {
    history.replaceState(null, "", `${TRIAGEM}?edital=e1&vaga=9`);
    await montar(h(Tela));
    const tamanho = history.length;
    await act(async () => mudar({ situacao: "ELIMINADOS" }));
    expect(url()).toBe(`${TRIAGEM}?edital=e1&vaga=9&situacao=ELIMINADOS`);
    expect(history.length).toBe(tamanho);
    await act(async () => mudar({ aba: "vagas" }));
    expect(url()).toBe(`${TRIAGEM}?edital=e1&situacao=ELIMINADOS&aba=vagas`);
    expect(history.length).toBe(tamanho + 1);
  });

  it("a busca fica fora da URL (e na sessão)", async () => {
    await montar(h(Tela, { sessao: "k" }));
    await act(async () => mudar({ busca: "Maria 123.456.789-00" }));
    expect(location.search).toBe("");
    expect(filtros.busca).toBe("Maria 123.456.789-00");
    expect(JSON.parse(String(sessionStorage.getItem("k"))).busca).toBe(
      "Maria 123.456.789-00",
    );
  });

  it("voltar do navegador devolve os filtros; o padrão some da URL", async () => {
    await montar(h(Tela));
    await act(async () => mudar({ aba: "pessoas", situacao: "X" }));
    await voltarPara(TRIAGEM);
    expect(filtros).toMatchObject({ aba: "resumo", situacao: "TODAS" });
    await voltarPara(`${TRIAGEM}?aba=vagas`);
    expect(filtros.aba).toBe("vagas");
  });

  it("sem filtro na URL, vale a sessão (por edital), e a URL passa a mostrá-lo", async () => {
    sessionStorage.setItem("e1", JSON.stringify({ situacao: "S1" }));
    sessionStorage.setItem("e2", JSON.stringify({ situacao: "S2" }));
    await montar(h(Tela, { sessao: "e1" }));
    expect(filtros.situacao).toBe("S1");
    expect(location.search).toBe("?situacao=S1");
    await act(async () =>
      definido(raiz).render(
        h(
          TelaNaUrl.Provider,
          { value: "pre-classificacao" },
          h(Tela, { sessao: "e2" }),
        ),
      ),
    );
    expect(filtros.situacao).toBe("S2");
    expect(location.search).toBe("?situacao=S2");
  });

  it("com a URL de outra tela, só guarda; o voltar de lá não mexe aqui", async () => {
    await montar(h(Tela));
    await act(async () => mudar({ situacao: "X" }));
    history.replaceState(null, "", "/projetos/cronograma");
    await act(async () => mudar({ situacao: "Y" }));
    expect(location.search).toBe("");
    expect(filtrosGuardadosDaTela("pre-classificacao")).toBe("situacao=Y");
    await voltarPara("/projetos/cronograma?x=1");
    expect(filtros.situacao).toBe("Y");
  });

  it("fora de <TelaNaUrl>, nada vai à URL", async () => {
    await montar(h(Tela), "");
    await act(async () => mudar({ aba: "vagas" }));
    expect(location.search).toBe("");
    expect(filtros.aba).toBe("vagas");
  });
});

describe("usarLojaNaUrl e usarEditalNaUrl", () => {
  const EDITAIS = [{ id: "e1" }, { id: "e2" }];

  function criarLoja(inicial: string) {
    let valor = inicial;
    const ouvintes = new Set<() => void>();
    return {
      obter: () => valor,
      assinar: (f: () => void) => (ouvintes.add(f), () => ouvintes.delete(f)),
      escolher: vi.fn((id: string) => {
        valor = id;
        ouvintes.forEach((f) => f());
      }),
    };
  }

  let escolher: (id: string) => void;
  function Tela({
    loja,
    carregado,
  }: {
    loja: ReturnType<typeof criarLoja>;
    carregado: boolean;
  }) {
    const editalId = useSyncExternalStore(loja.assinar, loja.obter);
    escolher = usarEditalNaUrl({
      editalId,
      editais: EDITAIS,
      carregado,
      escolher: loja.escolher,
    });
    return h("output", null, editalId);
  }

  it("o edital do link vale depois de carregado; a escolha automática não ganha dele", async () => {
    history.replaceState(null, "", `${TRIAGEM}?edital=e2&aba=pessoas`);
    const loja = criarLoja("e1");
    await montar(h(Tela, { loja, carregado: false }));
    expect(loja.escolher).not.toHaveBeenCalled();
    await act(async () =>
      definido(raiz).render(
        h(
          TelaNaUrl.Provider,
          { value: "pre-classificacao" },
          h(Tela, { loja, carregado: true }),
        ),
      ),
    );
    expect(loja.escolher).toHaveBeenCalledWith("e2");
    expect(url()).toBe(`${TRIAGEM}?edital=e2&aba=pessoas`);
  });

  it("edital fora da lista não abre; a URL fica com o da loja", async () => {
    history.replaceState(null, "", `${TRIAGEM}?edital=e9`);
    const loja = criarLoja("e1");
    await montar(h(Tela, { loja, carregado: true }));
    expect(loja.escolher).not.toHaveBeenCalled();
    expect(location.search).toBe("?edital=e1");
  });

  it("escolher outro edital empilha, mantém a aba e leva os filtros", async () => {
    history.replaceState(
      null,
      "",
      `${TRIAGEM}?edital=e1&aba=pessoas&situacao=X`,
    );
    const loja = criarLoja("e1");
    await montar(h(Tela, { loja, carregado: true }));
    const tamanho = history.length;
    await act(async () => escolher("e2"));
    expect(loja.escolher).toHaveBeenCalledWith("e2");
    expect(url()).toBe(`${TRIAGEM}?edital=e2&aba=pessoas`);
    expect(history.length).toBe(tamanho + 1);
    await voltarPara(`${TRIAGEM}?edital=e1&aba=pessoas&situacao=X`);
    expect(loja.escolher).toHaveBeenLastCalledWith("e1");
  });

  it("a loja muda sozinha (sem link): a URL acompanha, trocando a entrada", async () => {
    const esquema: EsquemaDosFiltros<"etapa"> = {
      etapa: { padrao: "lote", empilha: true },
    };
    let valores = { etapa: "lote" };
    const aplicar = vi.fn();
    function Fila({ etapa }: { etapa: string }) {
      usarLojaNaUrl(esquema, { etapa }, aplicar);
      return null;
    }
    await montar(h(Fila, valores));
    const tamanho = history.length;
    valores = { etapa: "concluidas" };
    await act(async () =>
      definido(raiz).render(
        h(TelaNaUrl.Provider, { value: "pre-classificacao" }, h(Fila, valores)),
      ),
    );
    expect(location.search).toBe("?etapa=concluidas");
    expect(history.length).toBe(tamanho);
    expect(aplicar).not.toHaveBeenCalled();
  });
});
