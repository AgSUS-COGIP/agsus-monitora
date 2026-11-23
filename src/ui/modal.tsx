import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
import { classes } from "./classes.ts";

/*
  Modal (Design System 11.11): `.modal` > `.modal-card`, no fim do `body`
  (portal), para escapar de qualquer `transform` ou `overflow` da página que o
  abriu — o de listas do edital, por exemplo, abre a partir do Núcleo, com a
  página de aprovados escondida.

  Só existe enquanto está aberto: quem o usa decide quando o desenha. Ao abrir,
  o foco vai para o primeiro controle (ou para o marcado com
  `data-foco-inicial`) e fica preso no cartão; ao fechar, volta a quem abriu.

  Fecha pelo `Esc` e pelos botões de fechar; clicar no fundo escuro não fecha
  (um clique perdido fora do cartão não pode levar o que foi digitado).

  `alterado`: o que está no modal mudou e não foi salvo. Fechar (Esc, o ✕ da
  gaveta e do modal institucional, `FecharModal` e `usarFecharModal()`) então
  pergunta "Descartar as alterações?" numa faixa no alto do cartão — não se
  abre modal a partir de modal. "Continuar editando" (ou Esc) volta à edição;
  "Descartar alterações" chama `aoDescartar` (o padrão é `aoFechar`). Quem só
  mostra (lista, prévia, confirmação sem campo) não passa `alterado`. O
  Cancelar/Fechar de quem usa é um `<FecharModal>` (ou chama
  `usarFecharModal()` num filho), para passar pela mesma pergunta; salvar
  fecha com `aoFechar` direto. Um filho com formulário próprio (o editor
  dentro da gaveta) avisa com `usarAlteradoNoModal(mudou)`, sem subir o
  estado: o modal pergunta se ele ou qualquer filho tem alteração.

  Sem título visível (a busca global), `rotulo` dá o nome do diálogo.

  `tamanho` (pequeno, medio, grande) é o modal padrão: o cartão ganha o
  respiro (padding), a largura da variante e o conteúdo em coluna, com o
  mesmo espaço entre título, campos e ações — quem usa só escreve o
  conteúdo. Sem `tamanho`, o cartão é livre: o layout vem de quem usa
  (`.modal-head` + `.modal-body`, ou a classe própria em `cartaoClassName`).
    - pequeno: confirmação curta (até 440 px);
    - medio: formulário de poucos campos (até 640 px);
    - grande: listas, tabelas e prévias (até 960 px).
  No celular (mobile-app.css) todos ocupam a largura toda, em uma coluna.
*/

export type TamanhoDoModal = "pequeno" | "medio" | "grande";

const FOCAVEIS = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/* Os modais abertos, na ordem em que abriram: o teclado é do último. */
const ABERTOS: object[] = [];

/* Um painel de aba escondido continua no DOM; o que está nele não recebe foco. */
const focaveisDe = (cartao: HTMLElement) =>
  [...cartao.querySelectorAll<HTMLElement>(FOCAVEIS)].filter(
    (elemento) => !elemento.closest(".hidden, [hidden]"),
  );

/* O modal em volta: fechar (com a pergunta) e os filhos com alteração. */
const DoModal = createContext<{
  fechar: () => void;
  marcar: (filho: string, alterado: boolean) => void;
} | null>(null);

/** O fechar do modal em volta (com a pergunta de descarte); fora de um modal, `null`. */
export function usarFecharModal() {
  return useContext(DoModal)?.fechar ?? null;
}

/** Um filho com formulário próprio diz ao modal em volta que tem alteração. */
export function usarAlteradoNoModal(alterado: boolean) {
  const modal = useContext(DoModal);
  const filho = useId();
  useEffect(() => {
    if (!modal || !alterado) return undefined;
    modal.marcar(filho, true);
    return () => modal.marcar(filho, false);
  }, [modal, filho, alterado]);
}

/** Botão que fecha o modal em volta, passando pela pergunta de descarte. */
export function FecharModal({
  type = "button",
  onClick,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const fechar = usarFecharModal();
  return (
    <button
      type={type}
      {...resto}
      onClick={(evento) => {
        onClick?.(evento);
        if (!evento.defaultPrevented) fechar?.();
      }}
    />
  );
}

export interface PropriedadesDoModal {
  id?: string;
  rotuloId?: string;
  rotulo?: string;
  aoFechar: () => void;
  /** Há alterações não salvas: fechar pergunta antes. */
  alterado?: boolean;
  /** Ao confirmar o descarte; o padrão é `aoFechar`. */
  aoDescartar?: () => void;
  className?: string;
  cartaoClassName?: string;
  tamanho?: TamanhoDoModal;
  tour?: string;
  children?: ReactNode;
}

export function Modal({
  id,
  rotuloId,
  rotulo,
  aoFechar,
  alterado = false,
  aoDescartar,
  className = "",
  cartaoClassName = "",
  tamanho,
  tour,
  children,
}: PropriedadesDoModal) {
  const cartao = useRef<HTMLDivElement>(null);
  const continuar = useRef<HTMLButtonElement>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [filhosAlterados, setFilhosAlterados] = useState<readonly string[]>([]);
  const mudou = alterado || filhosAlterados.length > 0;
  const perguntando = confirmando && mudou;
  const idDaPergunta = useId();

  /*
    Esc e os botões de fechar passam por aqui. Com a pergunta na tela, volta à
    edição; sem mudança, fecha direto.
  */
  function pedirParaFechar() {
    if (perguntando) setConfirmando(false);
    else if (mudou) setConfirmando(true);
    else aoFechar();
  }
  const fechar = useRef(pedirParaFechar);
  useLayoutEffect(() => {
    fechar.current = pedirParaFechar;
  });
  const doModal = useMemo(
    () => ({
      fechar: () => fechar.current(),
      marcar: (filho: string, sim: boolean) =>
        setFilhosAlterados((atuais) =>
          sim
            ? atuais.includes(filho)
              ? atuais
              : [...atuais, filho]
            : atuais.filter((outro) => outro !== filho),
        ),
    }),
    [],
  );

  useEffect(() => {
    if (perguntando) continuar.current?.focus();
  }, [perguntando]);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const inicial =
      cartao.current?.querySelector<HTMLElement>("[data-foco-inicial]") ||
      focaveisDe(cartao.current!)[0];
    inicial?.focus();
    const eu = {};
    ABERTOS.push(eu);

    function aoTeclar(evento: KeyboardEvent) {
      // Modal aberto por cima de outro (a montagem do parecer sobre a gaveta):
      // Esc e Tab são só do de cima.
      if (ABERTOS.at(-1) !== eu) return;
      if (evento.key === "Escape") {
        // Um controle de dentro (menu aberto) já tratou o Esc: só ele fecha.
        if (!evento.defaultPrevented) fechar.current();
        return;
      }
      if (evento.key !== "Tab" || !cartao.current) return;
      const itens = focaveisDe(cartao.current);
      if (!itens.length) return;
      const primeiro = itens[0]!;
      const ultimo = itens.at(-1)!;
      const foraDoCartao = !cartao.current.contains(document.activeElement);
      if (
        evento.shiftKey &&
        (document.activeElement === primeiro || foraDoCartao)
      ) {
        evento.preventDefault();
        ultimo.focus();
      } else if (
        !evento.shiftKey &&
        (document.activeElement === ultimo || foraDoCartao)
      ) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      ABERTOS.splice(ABERTOS.indexOf(eu), 1);
      if (anterior?.isConnected) anterior.focus?.();
    };
  }, []);

  return createPortal(
    <div
      id={id}
      className={classes("modal", className, "show")}
      role="dialog"
      aria-modal="true"
      data-tour={tour}
      aria-labelledby={rotuloId}
      aria-label={rotuloId ? undefined : rotulo}
    >
      <div
        ref={cartao}
        className={classes(
          "modal-card",
          tamanho && `ui-modal ui-modal-${tamanho}`,
          cartaoClassName,
        )}
      >
        {perguntando && (
          <div
            className="ui-modal-descarte"
            role="alertdialog"
            aria-labelledby={`${idDaPergunta}-titulo`}
            aria-describedby={`${idDaPergunta}-texto`}
          >
            <div>
              <strong id={`${idDaPergunta}-titulo`}>
                Descartar as alterações?
              </strong>
              <p id={`${idDaPergunta}-texto`}>
                O que foi preenchido e não foi salvo será perdido.
              </p>
            </div>
            <div className="ui-modal-descarte-acoes">
              <button
                ref={continuar}
                className="btn secondary"
                type="button"
                onClick={() => setConfirmando(false)}
              >
                Continuar editando
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={aoDescartar || aoFechar}
              >
                Descartar alterações
              </button>
            </div>
          </div>
        )}
        <DoModal.Provider value={doModal}>{children}</DoModal.Provider>
      </div>
    </div>,
    document.body,
  );
}
