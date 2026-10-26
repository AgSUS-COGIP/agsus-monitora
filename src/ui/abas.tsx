import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { classes } from "./classes.ts";

export interface AbaDaLista {
  id: string;
  rotulo: ReactNode;
  icone?: string;
  contagem?: number | string;
  idDaAba?: string;
  idDoPainel?: string;
  dados?: Record<string, string>;
}

export interface PropriedadesDasAbas {
  rotulo: string;
  abas: ReadonlyArray<AbaDaLista>;
  ativa: string;
  aoEscolher: (id: string) => void;
  compactas?: boolean;
  className?: string;
  tour?: string;
}

/*
  Abas (DS 10.5, `.ui-abas`): sublinhado, sem caixas — a ativa leva a barra
  na cor da ação principal. É um `tablist`: só a ativa entra no Tab, e as
  setas ← → movem a escolha (e o foco), dando a volta.

  `abas`: `[{ id, rotulo, icone?, contagem?, idDaAba?, idDoPainel?, dados? }]`
  — `icone` é a classe `fa-*`; `contagem` vira um número ao lado do rótulo
  (some quando é 0 ou vazio); `idDaAba`/`idDoPainel` ligam a aba ao painel
  (`aria-controls`); `dados` são atributos `data-*` extras (contrato de
  teste/DOM). Cada botão leva `data-aba`. `compactas`: dentro de um modal
  (sem recuo lateral). `tour` vira o `data-tour` da lista (passos da Aya).
  Quem usa desenha os painéis.

  Usado por Acessos (Usuários · Grupos · Coordenações), pelos modais da
  Lista de aprovados (listas do edital e sub judice) e pelas etapas da fila
  da Avaliação documental.
*/
const PASSO_DA_SETA: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
};

export function Abas({
  rotulo,
  abas,
  ativa,
  aoEscolher,
  compactas = false,
  className,
  tour,
}: PropriedadesDasAbas) {
  const botoes = useRef<Array<HTMLButtonElement | null>>([]);

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo = PASSO_DA_SETA[evento.key];
    if (!passo) return;
    evento.preventDefault();
    const proximo = (indice + passo + abas.length) % abas.length;
    aoEscolher(abas[proximo]!.id);
    botoes.current[proximo]?.focus();
  }

  return (
    <div
      className={classes(
        "ui-abas",
        compactas && "ui-abas-compactas",
        className,
      )}
      role="tablist"
      aria-label={rotulo}
      data-tour={tour}
    >
      {abas.map((aba, indice) => {
        const escolhida = ativa === aba.id;
        return (
          <button
            key={aba.id}
            ref={(el) => {
              botoes.current[indice] = el;
            }}
            type="button"
            role="tab"
            id={aba.idDaAba}
            aria-controls={aba.idDoPainel}
            aria-selected={escolhida}
            tabIndex={escolhida ? 0 : -1}
            className={classes("ui-aba", escolhida && "is-ativo")}
            data-aba={aba.id}
            {...aba.dados}
            onClick={() => aoEscolher(aba.id)}
            onKeyDown={(evento) => aoTeclar(evento, indice)}
          >
            {aba.icone ? (
              <i className={`fa-solid ${aba.icone}`} aria-hidden="true" />
            ) : null}
            {aba.rotulo}
            {aba.contagem ? (
              <span className="ui-aba-contagem">{aba.contagem}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
