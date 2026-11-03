import { StrictMode } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { avisar } from "./avisos.ts";
import { Avisos } from "./casca/avisos.tsx";
import { Casca } from "./casca/casca.tsx";
import { ContextoDoApp } from "./contexto-do-app.ts";
import { TelaDeEntrada } from "./entrada/entrada.tsx";
import type { SessaoDaEntrada } from "./entrada/entrada.tsx";
import type { EstadoDaMarcaDaEntrada } from "./entrada/marca.ts";
import type { PedidoDeAcesso } from "./entrada/pedido-de-acesso.ts";
import type { LeituraDaNavegacao } from "./navegacao.ts";
import { registrarTelasDoApp } from "./telas.tsx";

/*
  A raiz do app: o ÚNICO `createRoot` do sistema depois desta etapa (as ilhas
  que ainda montam sozinhas estão listadas em docs/arquitetura/raiz-react.md,
  passo 2). Ela entrega o contexto do app (a navegação) e desenha, por portal,
  nos lugares de sempre do index.html:

    #avisosApp      notificações, carregamento e conexão (src/app/casca/avisos.tsx)
    #telaDeEntrada  a tela de acesso (src/app/entrada/)
    #appScreen      a casca: barra lateral, cabeçalho e as telas (rotas)

  Os ids e as classes continuam os mesmos (CSS, testes e tours). Os portais
  deixam cada parte onde o HTML a espera (a tela de acesso dentro do
  `#loginScreen`, os avisos fora do `#appScreen`) com uma árvore React só.
*/

export interface PropsDaRaiz {
  navegacao: LeituraDaNavegacao;
  sessao: SessaoDaEntrada;
  marca: EstadoDaMarcaDaEntrada;
  pedido: PedidoDeAcesso;
  lugares: {
    avisos: Element | null;
    entrada: Element | null;
    casca: Element | null;
  };
}

function portal(filho: ReactNode, lugar: Element | null) {
  return lugar ? createPortal(filho, lugar) : null;
}

export function Raiz({
  navegacao,
  sessao,
  marca,
  pedido,
  lugares,
}: PropsDaRaiz) {
  return (
    <ContextoDoApp.Provider value={{ navegacao, avisar }}>
      {portal(
        <ErrorBoundary nome="os avisos do app">
          <Avisos />
        </ErrorBoundary>,
        lugares.avisos,
      )}
      {portal(
        <ErrorBoundary nome="a tela de acesso">
          <TelaDeEntrada sessao={sessao} marca={marca} pedido={pedido} />
        </ErrorBoundary>,
        lugares.entrada,
      )}
      {portal(
        <ErrorBoundary nome="a casca do app">
          <Casca />
        </ErrorBoundary>,
        lugares.casca,
      )}
    </ContextoDoApp.Provider>
  );
}

export type OpcoesDaRaiz = Omit<PropsDaRaiz, "lugares"> & {
  elemento?: HTMLElement | null;
  documento?: Document;
};

/**
 * Desenha o app na hora (`flushSync`): o código seguinte de src/main.ts (o
 * sistema, as ilhas, o legado) procura os elementos da casca pelo id. O
 * cartão vazio do `#telaDeEntrada` (o primeiro quadro, do index.html) dá
 * lugar ao de verdade sem quadro em branco no meio.
 */
export function montarRaiz({
  documento = globalThis.document,
  elemento = documento.getElementById("raiz"),
  navegacao,
  ...props
}: OpcoesDaRaiz) {
  if (!elemento) return null;
  registrarTelasDoApp({ navegacao });
  const lugar = (id: string) => documento.getElementById(id);
  const entrada = lugar("telaDeEntrada");
  // O cartão do primeiro quadro sai junto com o desenho do de verdade.
  entrada?.replaceChildren();
  const raiz = createRoot(elemento);
  flushSync(() =>
    raiz.render(
      <StrictMode>
        <Raiz
          navegacao={navegacao}
          {...props}
          lugares={{
            avisos: lugar("avisosApp"),
            entrada,
            casca: lugar("appScreen"),
          }}
        />
      </StrictMode>,
    ),
  );
  return raiz;
}
