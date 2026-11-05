import { StrictMode } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { avisar } from "./avisos.ts";
import { Avisos } from "./casca/avisos.tsx";
import { Casca } from "./casca/casca.tsx";
import { BuscaGlobalDoApp } from "./casca/pecas.tsx";
import { ContextoDoApp } from "./contexto-do-app.ts";
import type { PecasDoApp } from "./contexto-do-app.ts";
import { TelaDeEntrada } from "./entrada/entrada.tsx";
import type { SessaoDaEntrada } from "./entrada/entrada.tsx";
import type { EstadoDaMarcaDaEntrada } from "./entrada/marca.ts";
import type { PedidoDeAcesso } from "./entrada/pedido-de-acesso.ts";
import type { LeituraDaNavegacao } from "./navegacao.ts";
import { PortaisAvulsos } from "./portais-avulsos.tsx";
import { registrarTelasDoApp } from "./telas.tsx";

/*
  A raiz do app: o ÚNICO `createRoot` do sistema. Ela entrega o contexto do
  app (a navegação, o aviso curto e as peças do sistema: presença, versão,
  encerramento do edital, sessão) e desenha, por portal, nos lugares de
  sempre do index.html:

    #avisosApp      notificações, carregamento e conexão (src/app/casca/avisos.tsx)
    #telaDeEntrada  a tela de acesso (src/app/entrada/)
    #appScreen      a casca: barra lateral, cabeçalho e as telas (rotas)

  A busca global (Ctrl+K) fica no próprio `#raiz` (o diálogo vai por portal
  para o fim do body). Os portais avulsos (src/app/portais-avulsos.tsx) põem
  pedaços de React no DOM que ainda é feito à mão (a arara dos fogos, a
  cobertura do painel externo carregando).

  Os ids e as classes continuam os mesmos (CSS, testes e tours). Os portais
  deixam cada parte onde o HTML a espera (a tela de acesso dentro do
  `#loginScreen`, os avisos fora do `#appScreen`) com uma árvore React só.
*/

export interface PropsDaRaiz {
  navegacao: LeituraDaNavegacao;
  sessao: SessaoDaEntrada;
  marca: EstadoDaMarcaDaEntrada;
  pedido: PedidoDeAcesso;
  /** O estado do sistema para as partes da casca (src/app/sistema.ts). */
  pecas?: PecasDoApp | null;
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
  pecas = null,
  lugares,
}: PropsDaRaiz) {
  return (
    <ContextoDoApp.Provider value={{ navegacao, avisar, pecas }}>
      <BuscaGlobalDoApp />
      <PortaisAvulsos />
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
  registrarTelasDoApp({
    navegacao,
    aoSalvarModulos: props.pecas?.recarregarPaineisExternos,
  });
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
