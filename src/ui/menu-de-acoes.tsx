import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { classes } from "./classes.ts";

/*
  Menu de ações (ex.: "Ações da coordenação" na Fila): o botão abre a lista
  embaixo dele; escolher uma ação, Esc ou clicar fora fecham. Setas para
  cima e para baixo andam entre as ações. `acoes`: [{ id, rotulo, icone,
  aoEscolher, desabilitado, dados, atalho }] — a desabilitada fica à vista,
  apagada; `dados` vira atributos do item (data-acao, data-tour); `atalho`
  mostra a tecla ao lado do rótulo (quem liga a tecla é a tela). `contagem`
  aparece no botão (ex.: quantas fichas estão selecionadas). Quem não tem
  ação não recebe o menu: a tela simplesmente não o desenha.

  `compacto`: o "⋯" de uma linha de tabela (AcoesDaLinha) — só o ícone, com
  o `rotulo` como nome acessível; a lista abre presa à janela (fixa, medida
  do botão), para não ser cortada pela rolagem da tabela, e fecha se a
  página rolar.
*/
export interface AcaoDoMenu {
  id: string;
  rotulo: ReactNode;
  icone?: string;
  aoEscolher: () => void;
  desabilitado?: boolean;
  dados?: Record<string, string>;
  atalho?: string;
}

export interface PropriedadesDoMenuDeAcoes {
  rotulo: ReactNode;
  icone?: string;
  acoes: readonly AcaoDoMenu[];
  contagem?: number;
  tour?: string;
  className?: string;
  compacto?: boolean;
}

const LARGURA_DA_LISTA = 260;

export function MenuDeAcoes({
  rotulo,
  icone = "fa-ellipsis",
  acoes,
  contagem = 0,
  tour,
  className,
  compacto = false,
}: PropriedadesDoMenuDeAcoes) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<CSSProperties | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idDaLista = useId();

  const itens = () => [
    ...(raiz.current?.querySelectorAll<HTMLElement>(
      "[role='menuitem']:not(:disabled)",
    ) ?? []),
  ];

  // Compacto: a lista presa à janela, embaixo do botão (ou em cima, sem espaço).
  useLayoutEffect(() => {
    if (!aberto || !compacto || !botao.current) {
      setPosicao(null);
      return;
    }
    const caixa = botao.current.getBoundingClientRect();
    const altura = globalThis.innerHeight || 0;
    const largura = globalThis.innerWidth || 0;
    const esquerda = Math.max(
      8,
      Math.min(caixa.right - LARGURA_DA_LISTA, largura - LARGURA_DA_LISTA - 8),
    );
    const emCima = altura > 0 && caixa.bottom > altura * 0.6;
    setPosicao(
      emCima
        ? { position: "fixed", left: esquerda, bottom: altura - caixa.top + 4 }
        : { position: "fixed", left: esquerda, top: caixa.bottom + 4 },
    );
  }, [aberto, compacto]);

  useEffect(() => {
    if (!aberto) return undefined;
    itens()[0]?.focus();
    const foraDoMenu = (ev: MouseEvent) => {
      if (!raiz.current?.contains(ev.target as Node | null)) setAberto(false);
    };
    // A lista fixa não acompanha a rolagem: fecha (a da própria lista não conta).
    const aoRolar = (ev: Event) => {
      if (!raiz.current?.contains(ev.target as Node | null)) setAberto(false);
    };
    document.addEventListener("mousedown", foraDoMenu);
    if (compacto) globalThis.addEventListener?.("scroll", aoRolar, true);
    return () => {
      document.removeEventListener("mousedown", foraDoMenu);
      if (compacto) globalThis.removeEventListener?.("scroll", aoRolar, true);
    };
  }, [aberto, compacto]);

  function aoTeclar(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      setAberto(false);
      botao.current?.focus();
      return;
    }
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    ev.preventDefault();
    const lista = itens();
    const atual = lista.indexOf(document.activeElement as HTMLElement);
    const passo = ev.key === "ArrowDown" ? 1 : -1;
    lista[(atual + passo + lista.length) % lista.length]?.focus();
  }

  const nome = typeof rotulo === "string" ? rotulo : undefined;
  return (
    <div
      className={classes("ui-menu", compacto && "ui-menu-compacto", className)}
      ref={raiz}
      data-tour={tour}
      onKeyDown={aberto ? aoTeclar : undefined}
    >
      <button
        type="button"
        ref={botao}
        className={compacto ? "ui-menu-reticencias" : "btn secondary"}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDaLista : undefined}
        aria-label={compacto ? nome : undefined}
        title={compacto ? nome : undefined}
        data-acao="abrir-menu"
        onClick={() => setAberto(!aberto)}
      >
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
        {compacto ? null : (
          <>
            {" "}
            {rotulo}
            {contagem ? <span className="ui-contagem">{contagem}</span> : null}
            <i
              className={`fa-solid ${aberto ? "fa-chevron-up" : "fa-chevron-down"}`}
              aria-hidden="true"
            />
          </>
        )}
      </button>
      {aberto ? (
        <div
          className="ui-menu-lista"
          role="menu"
          id={idDaLista}
          aria-label={nome}
          style={posicao ?? undefined}
        >
          {acoes.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              disabled={a.desabilitado}
              aria-keyshortcuts={a.atalho}
              {...a.dados}
              onClick={() => {
                setAberto(false);
                a.aoEscolher();
              }}
            >
              {a.icone ? (
                <i className={`fa-solid ${a.icone}`} aria-hidden="true" />
              ) : null}
              {a.rotulo}
              {a.atalho ? (
                <kbd className="ui-menu-atalho" aria-hidden="true">
                  {a.atalho}
                </kbd>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
