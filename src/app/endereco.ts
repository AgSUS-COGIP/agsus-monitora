/*
  O endereço da página (caminho e busca), sem React e sem dependência: o
  roteador do app é isto mais as regras de src/lib/rotas.ts. Quem decide a
  tela é a navegação (src/app/navegacao.ts); aqui só se lê e se escreve o
  histórico do navegador.

  - `ir(caminho)` empilha uma entrada (`pushState`); `{ substituir: true }`
    troca a atual (`replaceState`: a tela de entrada, o redirecionamento de
    tela proibida). O mesmo endereço não empilha de novo.
  - `assinar(ouvinte)` avisa o voltar/avançar do navegador (`popstate`).
    Entrada do histórico com o mesmo endereço (as Regras do edital marcam o
    `history.state` sem mudar o caminho) também avisa: quem assina compara.

  Por que não o React Router: o app só precisa disto, e a entrada do app
  (o JavaScript antes da tela de acesso) já está perto do orçamento
  (scripts/check-bundle-size.mjs). Ver docs/arquitetura/raiz-react.md.
*/

export interface LocalDoEndereco {
  caminho: string;
  busca: string;
}

/** O que o endereço usa da janela (nos testes, uma falsa). */
export interface JanelaDoEndereco {
  location: { pathname: string; search: string };
  history: Pick<History, "pushState" | "replaceState" | "state">;
  addEventListener(tipo: "popstate", ouvinte: () => void): void;
  removeEventListener(tipo: "popstate", ouvinte: () => void): void;
}

export interface Endereco {
  obter(): LocalDoEndereco;
  ir(caminho: string, opcoes?: { substituir?: boolean }): void;
  assinar(ouvinte: (local: LocalDoEndereco) => void): () => void;
}

const ENDERECO_PARADO: Endereco = Object.freeze({
  obter: () => ({ caminho: "/", busca: "" }),
  ir: () => {},
  assinar: () => () => {},
});

/** O endereço da janela; sem janela (servidor, teste sem DOM), um que não muda. */
export function criarEndereco(
  janela: JanelaDoEndereco | undefined = globalThis.window,
): Endereco {
  if (!janela?.history || !janela.location) return ENDERECO_PARADO;
  const ouvintes = new Set<(local: LocalDoEndereco) => void>();

  const obter = (): LocalDoEndereco => ({
    caminho: janela.location.pathname || "/",
    busca: janela.location.search || "",
  });

  function ir(caminho: string, { substituir = false } = {}) {
    const { caminho: atual, busca } = obter();
    const mesmo = atual + busca === caminho;
    try {
      if (substituir || mesmo)
        janela.history.replaceState(janela.history.state ?? null, "", caminho);
      else janela.history.pushState(null, "", caminho);
    } catch {
      // Navegador que recusa o histórico: a tela troca, o endereço fica.
    }
  }

  const aoVoltar = () => {
    const local = obter();
    ouvintes.forEach((ouvinte) => ouvinte(local));
  };

  return {
    obter,
    ir,
    assinar(ouvinte) {
      if (!ouvintes.size) janela.addEventListener("popstate", aoVoltar);
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
        if (!ouvintes.size) janela.removeEventListener("popstate", aoVoltar);
      };
    },
  };
}
