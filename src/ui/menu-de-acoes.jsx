import { useEffect, useId, useRef, useState } from "react";
import { classes } from "./classes.js";

/*
  Menu de ações (ex.: "Ações da coordenação" na Fila): o botão abre a lista
  embaixo dele; escolher uma ação, Esc ou clicar fora fecham. Setas para
  cima e para baixo andam entre as ações. `acoes`: [{ id, rotulo, icone,
  aoEscolher, desabilitado, dados }] — a desabilitada fica à vista, apagada;
  `dados` vira atributos do item (data-acao, data-tour). `contagem` aparece
  no botão (ex.: quantas fichas estão selecionadas). Quem não tem ação não
  recebe o menu: a tela simplesmente não o desenha.
*/
export function MenuDeAcoes({
  rotulo,
  icone = "fa-ellipsis",
  acoes,
  contagem = 0,
  tour,
  className,
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);
  const botao = useRef(null);
  const idDaLista = useId();

  const itens = () => [
    ...(raiz.current?.querySelectorAll("[role='menuitem']:not(:disabled)") ??
      []),
  ];

  useEffect(() => {
    if (!aberto) return undefined;
    itens()[0]?.focus();
    const foraDoMenu = (ev) => {
      if (!raiz.current?.contains(ev.target)) setAberto(false);
    };
    document.addEventListener("mousedown", foraDoMenu);
    return () => document.removeEventListener("mousedown", foraDoMenu);
  }, [aberto]);

  function aoTeclar(ev) {
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
    const atual = lista.indexOf(document.activeElement);
    const passo = ev.key === "ArrowDown" ? 1 : -1;
    lista[(atual + passo + lista.length) % lista.length]?.focus();
  }

  return (
    <div
      className={classes("ui-menu", className)}
      ref={raiz}
      data-tour={tour}
      onKeyDown={aberto ? aoTeclar : undefined}
    >
      <button
        type="button"
        ref={botao}
        className="btn secondary"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDaLista : undefined}
        data-acao="abrir-menu"
        onClick={() => setAberto(!aberto)}
      >
        <i className={`fa-solid ${icone}`} aria-hidden="true" /> {rotulo}
        {contagem ? <span className="ui-contagem">{contagem}</span> : null}
        <i
          className={`fa-solid ${aberto ? "fa-chevron-up" : "fa-chevron-down"}`}
          aria-hidden="true"
        />
      </button>
      {aberto ? (
        <div className="ui-menu-lista" role="menu" id={idDaLista}>
          {acoes.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              disabled={a.desabilitado}
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
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
