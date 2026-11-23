import { useEffect, useMemo, useRef } from "react";
import {
  passoDaTecla,
  textoDaPosicao,
  vizinhosNaLista,
} from "../lib/base/navegacao-da-lista.ts";
import { usarTecladoDoModal, usarTrocarNoModal } from "./modal.tsx";

/*
  Anterior e Próximo na ficha aberta de uma lista: ‹ "3 de 41" › no topo da
  gaveta, e ← → no teclado (fora de campos e de controles que usam as
  setas). Segue a lista como está na tela — filtro e ordem atuais —, que
  quem abre a ficha passa a `usarNavegacaoDaLista`:

    const navegacao = usarNavegacaoDaLista(filtrados, aberto, (c) => c.id, (c) => setAberto(c.id));
    <Gaveta navegacao={navegacao} …>

  Trocar de item passa pela pergunta "Descartar as alterações?" do <Modal>
  quando a ficha tem alteração (`alterado` ou `usarAlteradoNoModal`). A
  <Gaveta> recomeça o corpo a cada item (`key` pela `chave`), para o
  formulário voltar limpo; ela mesma não leva `key` pelo item: continua
  aberta, e o foco fica no botão.

  Nas pontas o botão fica `aria-disabled` (continua focável, para o foco não
  cair no corpo). Lista de um item só não mostra a navegação. Lógica em
  src/lib/base/navegacao-da-lista.ts.
*/

export interface NavegacaoDaFicha {
  /** O item aberto: ao mudar, a ficha volta ao alto. */
  chave?: string;
  /** 1 = o primeiro; `null` quando o item aberto saiu da lista. */
  posicao: number | null;
  total: number;
  /** Ausente na ponta. */
  aoAnterior?: () => void;
  aoProximo?: () => void;
}

/**
 * A navegação da ficha aberta (`atual`) pela lista na tela (`itens`, já
 * filtrada e ordenada). Sem item aberto, fora da lista ou com menos de dois
 * itens, `undefined`.
 */
export function usarNavegacaoDaLista<T>(
  itens: readonly T[] | null | undefined,
  atual: string | number | null | undefined,
  chaveDe: (item: T) => string | number,
  abrir: (item: T) => void,
): NavegacaoDaFicha | undefined {
  const chaveDoItem = useRef(chaveDe);
  const abrirItem = useRef(abrir);
  chaveDoItem.current = chaveDe;
  abrirItem.current = abrir;

  const porChave = useMemo(() => {
    const mapa = new Map<string, T>();
    for (const item of itens ?? [])
      mapa.set(String(chaveDoItem.current(item)), item);
    return mapa;
  }, [itens]);
  const chaves = useMemo(() => [...porChave.keys()], [porChave]);
  const chaveAtual = atual === null || atual === undefined ? "" : String(atual);

  /* A última lista em que o item aberto estava: para quando ele sai dela. */
  const ultimaComAtual = useRef<{ chave: string; chaves: string[] } | null>(
    null,
  );
  const antes =
    ultimaComAtual.current?.chave === chaveAtual
      ? ultimaComAtual.current.chaves
      : null;
  const vizinhos = chaveAtual
    ? vizinhosNaLista(chaves, chaveAtual, antes)
    : null;
  useEffect(() => {
    if (chaveAtual && chaves.includes(chaveAtual))
      ultimaComAtual.current = { chave: chaveAtual, chaves };
  }, [chaveAtual, chaves]);

  if (!vizinhos || vizinhos.total < 2) return undefined;
  const ir = (chave: string | null) => {
    const item = chave === null ? undefined : porChave.get(chave);
    return item === undefined ? undefined : () => abrirItem.current(item);
  };
  return {
    chave: chaveAtual,
    posicao: vizinhos.posicao,
    total: vizinhos.total,
    aoAnterior: ir(vizinhos.anterior),
    aoProximo: ir(vizinhos.proximo),
  };
}

export function NavegacaoDaFicha({
  chave,
  posicao,
  total,
  aoAnterior,
  aoProximo,
}: NavegacaoDaFicha) {
  const trocar = usarTrocarNoModal();
  const tecladoLivre = usarTecladoDoModal();
  const passos = useRef({ aoAnterior, aoProximo });
  passos.current = { aoAnterior, aoProximo };

  function ir(passo: (() => void) | undefined) {
    if (!passo) return;
    if (trocar) trocar(passo);
    else passo();
  }
  const irAgora = useRef(ir);
  irAgora.current = ir;

  /* Outro item: a ficha volta ao alto (o cartão rola, o topo é fixo). */
  const grupo = useRef<HTMLDivElement>(null);
  const chaveAnterior = useRef(chave);
  useEffect(() => {
    if (chaveAnterior.current === chave) return;
    chaveAnterior.current = chave;
    const cartao = grupo.current?.closest<HTMLElement>(".modal-card");
    if (cartao) cartao.scrollTop = 0;
  }, [chave]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const passo = passoDaTecla(evento);
      if (!passo || !tecladoLivre()) return;
      const acao =
        passo === "anterior"
          ? passos.current.aoAnterior
          : passos.current.aoProximo;
      if (!acao) return;
      evento.preventDefault();
      irAgora.current(acao);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [tecladoLivre]);

  return (
    <div
      ref={grupo}
      className="ui-navegacao-da-ficha"
      data-acao="navegacao-da-ficha"
    >
      <button
        type="button"
        className="ui-gaveta-fechar"
        data-acao="ficha-anterior"
        aria-label="Anterior"
        title="Anterior (←)"
        aria-disabled={aoAnterior ? undefined : "true"}
        onClick={() => ir(aoAnterior)}
      >
        <i className="fa-solid fa-chevron-left" aria-hidden="true" />
      </button>
      <span className="ui-navegacao-da-ficha-posicao" aria-live="polite">
        {textoDaPosicao(posicao, total)}
      </span>
      <button
        type="button"
        className="ui-gaveta-fechar"
        data-acao="ficha-proximo"
        aria-label="Próximo"
        title="Próximo (→)"
        aria-disabled={aoProximo ? undefined : "true"}
        onClick={() => ir(aoProximo)}
      >
        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>
    </div>
  );
}
