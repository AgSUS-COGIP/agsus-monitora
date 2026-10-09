import { useRef } from "react";
import { classes } from "./classes.js";

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
/**
 * @param {object} p
 * @param {string} p.rotulo
 * @param {ReadonlyArray<{ id: string, rotulo: import("react").ReactNode, icone?: string, contagem?: number | string, idDaAba?: string, idDoPainel?: string, dados?: Record<string, string> }>} p.abas
 * @param {string} p.ativa
 * @param {(id: string) => void} p.aoEscolher
 * @param {boolean} [p.compactas]
 * @param {string} [p.className]
 * @param {string} [p.tour]
 */
export function Abas({
  rotulo,
  abas,
  ativa,
  aoEscolher,
  compactas = false,
  className,
  tour,
}) {
  const botoes = useRef([]);

  function aoTeclar(evento, indice) {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
    if (!passo) return;
    evento.preventDefault();
    const proximo = (indice + passo + abas.length) % abas.length;
    aoEscolher(abas[proximo].id);
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
            ref={(el) => (botoes.current[indice] = el)}
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
