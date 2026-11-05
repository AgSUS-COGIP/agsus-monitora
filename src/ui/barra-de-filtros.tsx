import { useEffect, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { formatNumberBR } from "../lib/formatters";
import { classes } from "./classes.ts";

/*
  A barra de "encontrar a pessoa" das listas (`.ui-card.ui-barra-de-filtros`):
  a busca em destaque, à esquerda, com a lupa; os filtros em linha (os
  campos vêm como filhos, cada um num <Campo>); embaixo, o resultado ("120
  de 3.400"), quantos filtros estão em uso e "Limpar". `acoes` fica à
  direita (botões da tela: Pegar próximo, menus).

  Sempre à vista (não recolhe): é a ferramenta principal da lista. A tecla
  "/" leva o foco à busca de qualquer lugar da página (menos de dentro de um
  campo); Esc na busca apaga o que foi digitado.

  `quantos` conta os filtros em uso (a busca também); sem nenhum, "Limpar"
  fica desligado. `resultado` é o texto do resultado (pode ser ReactNode).
*/

export interface BuscaDaBarra {
  valor: string;
  aoMudar: (valor: string) => void;
  /** O texto do campo vazio: "Código ou nome". */
  placeholder: string;
  /** O nome acessível do campo. */
  rotulo: string;
  aoTeclar?: (evento: KeyboardEvent<HTMLInputElement>) => void;
  /** `data-acao` do campo (contrato de teste). */
  acao?: string;
  tour?: string;
}

export interface PropriedadesDaBarraDeFiltros {
  /** O nome acessível da barra ("Encontrar a pessoa"). */
  rotulo: string;
  busca: BuscaDaBarra;
  quantos: number;
  aoLimpar: () => void;
  resultado?: ReactNode;
  acoes?: ReactNode;
  className?: string;
  tour?: string;
  /** Liga a tecla "/" (só uma barra por tela). Padrão: sim. */
  atalho?: boolean;
  children?: ReactNode;
}

/** A tecla "/" vale fora de campos de texto (onde ela é só um caractere). */
function digitandoEm(alvo: EventTarget | null): boolean {
  const el = alvo as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return Boolean(
    el.closest("input, textarea, select, [contenteditable='true']"),
  );
}

export function BarraDeFiltros({
  rotulo,
  busca,
  quantos,
  aoLimpar,
  resultado,
  acoes,
  className,
  tour,
  atalho = true,
  children,
}: PropriedadesDaBarraDeFiltros) {
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!atalho) return undefined;
    const aoTeclar = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== "/" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.defaultPrevented || digitandoEm(ev.target)) return;
      // Só a barra que está à vista (a tela pode ter outra aba aberta).
      if (!campo.current || !campo.current.offsetParent) return;
      ev.preventDefault();
      campo.current.focus();
      campo.current.select();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [atalho]);

  return (
    <section
      className={classes("ui-card ui-barra-de-filtros", className)}
      aria-label={rotulo}
      data-tour={tour}
    >
      <div className="ui-barra-de-filtros-linha">
        <label className="ui-barra-busca">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <span className="sr-only">{busca.rotulo}</span>
          <input
            ref={campo}
            type="search"
            value={busca.valor}
            placeholder={busca.placeholder}
            aria-keyshortcuts={atalho ? "/" : undefined}
            data-acao={busca.acao}
            data-tour={busca.tour}
            onChange={(ev) => busca.aoMudar(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Escape" && busca.valor) {
                ev.preventDefault();
                ev.stopPropagation();
                busca.aoMudar("");
                return;
              }
              busca.aoTeclar?.(ev);
            }}
          />
          {atalho ? (
            <kbd className="ui-barra-atalho" aria-hidden="true">
              /
            </kbd>
          ) : null}
        </label>
        {children ? (
          <div className="ui-barra-de-filtros-campos">{children}</div>
        ) : null}
        {acoes ? (
          <div className="ui-barra-de-filtros-acoes">{acoes}</div>
        ) : null}
      </div>
      <div className="ui-barra-de-filtros-rodape">
        <span className="ui-barra-resultado" aria-live="polite">
          {resultado}
        </span>
        <span
          className={classes("ui-barra-quantos", quantos > 0 && "tem-filtros")}
        >
          {quantos
            ? `${formatNumberBR(quantos)} ${quantos === 1 ? "filtro" : "filtros"}`
            : "Sem filtros"}
        </span>
        <button
          type="button"
          className="btn ghost small"
          data-acao="limpar-filtros"
          disabled={!quantos}
          onClick={aoLimpar}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" /> Limpar
        </button>
      </div>
    </section>
  );
}
