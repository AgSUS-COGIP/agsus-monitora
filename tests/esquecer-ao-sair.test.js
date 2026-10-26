import { describe, expect, it, vi } from "vitest";
import {
  CHAVE_DOS_FILTROS,
  criarEstadoDaVisaoGeral,
  esquecerVisaoGeral,
} from "../src/modulos/visao-geral/estado.ts";
import {
  esquecerConversaDaAya,
  obterPaginaDaAya,
} from "../src/modulos/aya/estado.ts";
import { salvarConversa } from "../src/modules/aya-memoria.js";

/*
  Sair do sistema (ou ficar sem acesso) esquece o que a pessoa deixou nas
  telas que continuam montadas: o recorte da Visão geral e a conversa da Aya.
  Quem entrar depois na mesma aba não herda nada disso.
*/

function memoria() {
  const mapa = new Map();
  return {
    mapa,
    getItem: (chave) => (mapa.has(chave) ? mapa.get(chave) : null),
    setItem: (chave, valor) => void mapa.set(chave, String(valor)),
  };
}

const dadosVazios = {
  assinar: () => () => {},
  obter: () => ({
    linhas: [],
    unidades: [],
    carregado: false,
    areas: ["saude-indigena"],
    areaAtual: "saude-indigena",
  }),
};

describe("Visão geral ao sair", () => {
  it("o recorte e os filtros guardados voltam ao vazio, sem aviso", () => {
    const armazenamento = memoria();
    const estado = criarEstadoDaVisaoGeral({
      dados: dadosVazios,
      armazenamento,
      aberta: false,
    });
    const aviso = vi.fn();
    estado.definirAviso(aviso);
    estado.definirFiltro("unidade", ["DSEI Xingu"]);
    estado.definirBusca("xingu");
    estado.definirDsei("xingu", "DSEI Xingu");
    expect(armazenamento.getItem(CHAVE_DOS_FILTROS)).toContain("DSEI Xingu");
    aviso.mockClear();

    esquecerVisaoGeral(estado);

    const agora = estado.obter();
    expect(agora.filtros.unidade).toEqual([]);
    expect(agora.busca).toBe("");
    expect(agora.dsei).toEqual({ chave: "", nome: "" });
    expect(armazenamento.getItem(CHAVE_DOS_FILTROS)).not.toContain(
      "DSEI Xingu",
    );
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe("Aya ao sair", () => {
  it("a conversa guardada na aba sai e o painel é avisado", () => {
    salvarConversa([{ role: "user", content: "Quem decide o recurso?" }]);
    const antes = obterPaginaDaAya().conversa;
    esquecerConversaDaAya();
    expect(sessionStorage.getItem("agsus_aya_conversa_v1")).toBeNull();
    expect(obterPaginaDaAya().conversa).toBe(antes + 1);
  });
});
