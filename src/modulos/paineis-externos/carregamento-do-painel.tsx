import { useEffect, useRef, useState } from "react";
import { abrirPortalAvulso } from "../../app/portais-avulsos.tsx";
import {
  AVISO_DO_PAINEL_CARREGANDO,
  AVISO_DO_PAINEL_ERRO,
  AVISO_DO_PAINEL_PRONTO,
  DEMORA_DO_PAINEL_MS,
  ESPERA_MAXIMA_DO_PAINEL_MS,
  FOLGA_DO_AVISO_MS,
  rotuloDoCarregamento,
} from "../../lib/carregamento-do-painel.ts";
import "./carregamento-do-painel.css";

/*
  A cobertura do painel externo enquanto o site de fora não responde.

  O iframe nasce na primeira abertura (src/app/paineis-externos.ts) e fica
  montado depois: só a primeira abertura passa por aqui. A cobertura diz o que
  está carregando ("Carregando o painel do Looker Studio…"), com o giro, até o
  `load` do iframe. Aos 20 s, "Está demorando mais que o normal", com "Abrir em
  nova aba" e "Tentar novamente". Erro (o iframe recusou, a conexão caiu ou o
  painel avisou): a mensagem e as mesmas duas saídas.

  Painel que avisa (docs/painel-externo-avisa-que-carregou.md): quem manda
  `agsus:painel-carregando` mantém a cobertura até `agsus:painel-pronto` (ou
  até a espera máxima, para não ficar coberto para sempre); `agsus:painel-erro`
  mostra o erro.
*/

type Estado = "carregando" | "demorando" | "erro" | "pronto";

export interface PropriedadesDoCarregamentoDoPainel {
  quadro: HTMLIFrameElement;
  /** O endereço do painel (o "Abrir em nova aba" e o nome do serviço). */
  endereco: string;
  /** "Tentar novamente" (no app, recarrega o painel). */
  aoTentarDeNovo?: () => void;
  /** A cobertura saiu (o painel apareceu). */
  aoTerminar?: () => void;
  /** Conexão do navegador; os testes trocam. */
  janela?: Window;
}

/*
  A mensagem veio deste iframe? O Apps Script roda num iframe dentro do
  iframe, então a janela que manda pode estar alguns níveis abaixo. `parent`
  se lê mesmo entre origens diferentes.
*/
function veioDoQuadro(janela: Window | null, quadro: HTMLIFrameElement) {
  for (let nivel = 0; janela && nivel < 4; nivel += 1) {
    if (janela === quadro.contentWindow) return true;
    if (janela === janela.parent) return false;
    janela = janela.parent;
  }
  return false;
}

export function CarregamentoDoPainel({
  quadro,
  endereco,
  aoTentarDeNovo,
  aoTerminar,
  janela = window,
}: PropriedadesDoCarregamentoDoPainel) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;

  useEffect(() => {
    let anunciou = false;
    let encerrado = false;
    const temporizadores: number[] = [];
    const depois = (ms: number, fazer: () => void) =>
      temporizadores.push(janela.setTimeout(fazer, ms));
    const mudar = (proximo: Estado) => {
      if (encerrado) return;
      if (proximo === "pronto" || proximo === "erro") encerrado = true;
      setEstado(proximo);
    };
    const pronto = () => mudar("pronto");

    const aoCarregar = () =>
      depois(FOLGA_DO_AVISO_MS, () => {
        if (!anunciou) pronto();
      });
    const aoFalhar = () => mudar("erro");
    const aoOuvir = (
      evento: MessageEvent<{ tipo?: unknown } | null | undefined>,
    ) => {
      const tipo = evento.data?.tipo;
      if (
        tipo !== AVISO_DO_PAINEL_CARREGANDO &&
        tipo !== AVISO_DO_PAINEL_PRONTO &&
        tipo !== AVISO_DO_PAINEL_ERRO
      )
        return;
      // A janela que manda (um iframe); MessagePort/ServiceWorker não chegam aqui.
      if (!veioDoQuadro(evento.source as Window | null, quadro)) return;
      if (tipo === AVISO_DO_PAINEL_PRONTO) pronto();
      else if (tipo === AVISO_DO_PAINEL_ERRO) aoFalhar();
      else anunciou = true;
    };

    quadro.addEventListener("load", aoCarregar);
    quadro.addEventListener("error", aoFalhar);
    janela.addEventListener("message", aoOuvir);
    janela.addEventListener("offline", aoFalhar);
    if (janela.navigator && janela.navigator.onLine === false) aoFalhar();
    depois(DEMORA_DO_PAINEL_MS, () => {
      if (!encerrado) setEstado("demorando");
    });
    // Avisou que carrega e travou: não fica coberto para sempre.
    depois(ESPERA_MAXIMA_DO_PAINEL_MS, () => {
      if (anunciou) pronto();
    });
    return () => {
      encerrado = true;
      quadro.removeEventListener("load", aoCarregar);
      quadro.removeEventListener("error", aoFalhar);
      janela.removeEventListener("message", aoOuvir);
      janela.removeEventListener("offline", aoFalhar);
      temporizadores.forEach((id) => janela.clearTimeout(id));
    };
  }, [quadro, janela]);

  // Pronto: some com a transição e avisa quem montou.
  useEffect(() => {
    if (estado !== "pronto") return undefined;
    const id = janela.setTimeout(() => terminar.current?.(), 200);
    return () => janela.clearTimeout(id);
  }, [estado, janela]);

  const saidas = (
    <span className="carregamento-do-painel__acoes">
      <a
        className="btn secondary small"
        href={endereco}
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir em nova aba
      </a>
      {aoTentarDeNovo ? (
        <button
          type="button"
          className="btn secondary small"
          onClick={aoTentarDeNovo}
        >
          Tentar novamente
        </button>
      ) : null}
    </span>
  );

  return (
    <div
      className={
        estado === "pronto"
          ? "carregamento-do-painel carregamento-do-painel--saindo"
          : "carregamento-do-painel"
      }
      data-estado={estado}
    >
      {estado === "erro" ? (
        <div className="carregamento-do-painel__caixa" role="alert">
          <i
            className="fa-solid fa-triangle-exclamation carregamento-do-painel__erro"
            aria-hidden="true"
          />
          <p>Não foi possível carregar o painel.</p>
          {saidas}
        </div>
      ) : (
        <div
          className="carregamento-do-painel__caixa"
          role="status"
          aria-live="polite"
        >
          <span className="botao-girando" aria-hidden="true" />
          <p>{rotuloDoCarregamento(endereco)}</p>
          {estado === "demorando" ? (
            <>
              <p className="carregamento-do-painel__demora">
                Está demorando mais que o normal.
              </p>
              {saidas}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export type OpcoesDoCarregamentoDoPainel = {
  endereco: string;
  aoTentarDeNovo?: () => void;
};

/**
 * Cobre o iframe do `holder` até ele carregar. Devolve o desmonte (o app o
 * chama ao descartar o quadro antes do fim). Sem iframe, não cobre nada.
 */
export function acompanharCarregamentoDoPainel(
  holder: Element | null | undefined,
  { endereco, aoTentarDeNovo }: OpcoesDoCarregamentoDoPainel,
): () => void {
  const quadro = holder?.querySelector("iframe");
  if (!holder || !quadro) return () => {};
  const raiz = holder.ownerDocument.createElement("div");
  raiz.className = "carregamento-do-painel-raiz";
  holder.append(raiz);
  let montado = true;
  const desmontar = () => {
    if (!montado) return;
    montado = false;
    fechar();
    raiz.remove();
  };
  const fechar = abrirPortalAvulso(
    raiz,
    <CarregamentoDoPainel
      quadro={quadro}
      endereco={endereco}
      aoTentarDeNovo={aoTentarDeNovo}
      aoTerminar={() => queueMicrotask(desmontar)}
    />,
    { nome: "Carregamento do painel" },
  );
  return desmontar;
}
