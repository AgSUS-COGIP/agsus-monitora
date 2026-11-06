import { useEffect, useRef } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { formatNumberBR } from "../lib/formatters";
import { classes } from "./classes.ts";
import { Popover } from "./popover.tsx";

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

/** A tecla "/" leva o foco à busca que está à vista (menos de dentro de um campo). */
function usarAtalhoDaBusca(
  campo: RefObject<HTMLInputElement | null>,
  atalho: boolean,
) {
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
  }, [campo, atalho]);
}

/** A busca com a lupa e o "/"; Esc apaga o que foi digitado. */
function CampoDeBusca({
  campo,
  busca,
  atalho,
}: {
  campo: RefObject<HTMLInputElement | null>;
  busca: BuscaDaBarra;
  atalho: boolean;
}) {
  return (
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

  usarAtalhoDaBusca(campo, atalho);

  return (
    <section
      className={classes("ui-card ui-barra-de-filtros", className)}
      aria-label={rotulo}
      data-tour={tour}
    >
      <div className="ui-barra-de-filtros-linha">
        <CampoDeBusca campo={campo} busca={busca} atalho={atalho} />
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

/*
  A barra da lista das telas da seleção (`.ui-barra-da-lista`), no alto do
  card da lista (CardDaLista), numa linha que quebra no celular:
  a busca com a lupa e o atalho "/", os filtros principais (`children`:
  selects com nome acessível e a primeira opção "Todas as vagas"), o botão
  "Filtros" que abre os secundários (`secundarios`, com quantos estão em
  uso no botão), "Limpar" quando há filtro e, à direita, `acoes` (o "⋯" da
  coordenação e a ação principal).
*/
export interface PropriedadesDaBarraDaLista {
  rotulo: string;
  busca: BuscaDaBarra;
  /** Filtros em uso (a busca também); com algum, aparece "Limpar". */
  quantos: number;
  aoLimpar: () => void;
  secundarios?: ReactNode;
  /** Quantos dos secundários estão em uso (no botão "Filtros"). */
  quantosSecundarios?: number;
  acoes?: ReactNode;
  className?: string;
  tour?: string;
  atalho?: boolean;
  children?: ReactNode;
}

export function BarraDaLista({
  rotulo,
  busca,
  quantos,
  aoLimpar,
  secundarios,
  quantosSecundarios = 0,
  acoes,
  className,
  tour,
  atalho = true,
  children,
}: PropriedadesDaBarraDaLista) {
  const campo = useRef<HTMLInputElement>(null);
  usarAtalhoDaBusca(campo, atalho);
  return (
    <div
      className={classes("ui-barra-da-lista", className)}
      role="search"
      aria-label={rotulo}
      data-tour={tour}
    >
      <CampoDeBusca campo={campo} busca={busca} atalho={atalho} />
      {children}
      {secundarios ? (
        <Popover
          rotulo="Filtros"
          classeDoBotao="btn contorno"
          lado="esquerda"
          acao="mais-filtros"
          className="ui-barra-mais-filtros"
          gatilho={
            <>
              <i className="fa-solid fa-sliders" aria-hidden="true" /> Filtros
              {quantosSecundarios ? (
                <span className="ui-contagem">
                  {formatNumberBR(quantosSecundarios)}
                </span>
              ) : null}
            </>
          }
        >
          {secundarios}
        </Popover>
      ) : null}
      {quantos ? (
        <button
          type="button"
          className="btn ghost"
          data-acao="limpar-filtros"
          onClick={aoLimpar}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" /> Limpar
        </button>
      ) : null}
      {acoes ? <div className="ui-barra-da-lista-acoes">{acoes}</div> : null}
    </div>
  );
}
