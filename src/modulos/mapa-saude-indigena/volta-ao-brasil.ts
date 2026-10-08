import type { RefObject } from "react";
import type { DistritoDaVolta, VoltaDoDsei } from "./tipos-do-painel.ts";
import { useEffect, useState } from "react";
import { temCoordenada } from "../../lib/mapa-saude-indigena/chaves.js";
import { usarUltimo } from "./usar-ultimo.ts";

/*
  A VOLTA DE UM DSEI AO BRASIL

  `usarVoltaDoDsei` percebe a saída do DSEI venha de onde vier — "Voltar ao
  Brasil", Esc, o chip "DSEI" da Visão geral, "Limpar tudo" — e devolve a
  volta para o mapa nacional voar do distrito até o enquadramento:
  `{ k, partida, focar, vez }` (`partida` é a sede, `[lat, lon]`, ou null
  sem coordenada). `vez` muda a cada saída; `focar` só vale
  quando a saída foi pedida pelo próprio mapa (`pedirVolta`), para o foco
  voltar à linha do DSEI sem roubar o de quem usou o chip da página.

  `usarEscParaVoltar` liga o Esc enquanto um DSEI está aberto. Na tela cheia,
  o primeiro Esc volta ao Brasil e o segundo sai da tela cheia: este ouvinte
  fica na captura do `document` e marca o evento (`preventDefault`), e o da
  tela cheia (`tela-cheia.jsx`) ignora o Esc já usado. Fora da tela cheia, o
  Esc só volta com o foco no mapa ou em lugar nenhum (o `body`): na tabela, num
  campo, numa janela ou no painel da Aya ele não mexe no recorte da página.
*/
export function usarVoltaDoDsei(
  dsei: DistritoDaVolta | null,
): [VoltaDoDsei | null, () => void] {
  const [aberto, definirAberto] = useState(dsei);
  const [volta, definirVolta] = useState<VoltaDoDsei | null>(null);
  const [pedida, definirPedida] = useState(false);

  // Derivado durante a renderização: a volta chega junto com o mapa nacional.
  if ((aberto?.k ?? null) !== (dsei?.k ?? null)) {
    definirAberto(dsei);
    definirPedida(false);
    if (aberto && !dsei)
      definirVolta((anterior) => ({
        k: aberto.k,
        partida: temCoordenada(aberto.lat, aberto.lon)
          ? [Number(aberto.lat), Number(aberto.lon)]
          : null,
        focar: pedida,
        vez: (anterior?.vez ?? 0) + 1,
      }));
  }

  return [volta, () => definirPedida(true)];
}

export const CAMPOS_E_JANELAS =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [aria-modal="true"], dialog';

function escVoltaAoBrasil(
  evento: KeyboardEvent,
  regiao: HTMLElement | null,
  telaCheia: boolean,
) {
  if (evento.key !== "Escape" || evento.defaultPrevented) return false;
  if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey)
    return false;
  if (
    evento.target instanceof Element &&
    evento.target.closest(CAMPOS_E_JANELAS)
  )
    return false;
  if (document.querySelector('[aria-modal="true"], dialog[open]')) return false;
  if (telaCheia) return true;
  const ativo = document.activeElement;
  return !ativo || ativo === document.body || Boolean(regiao?.contains(ativo));
}

export function usarEscParaVoltar({
  ativo,
  regiao,
  telaCheia,
  aoVoltar,
}: {
  ativo: boolean;
  regiao: RefObject<HTMLElement | null>;
  telaCheia: boolean;
  aoVoltar?: () => void;
}) {
  const chamada = usarUltimo(aoVoltar);
  useEffect(() => {
    if (!ativo) return undefined;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (!escVoltaAoBrasil(evento, regiao.current, telaCheia)) return;
      evento.preventDefault();
      chamada.current?.();
    };
    document.addEventListener("keydown", aoTeclar, true);
    return () => document.removeEventListener("keydown", aoTeclar, true);
  }, [ativo, regiao, telaCheia, chamada]);
}
