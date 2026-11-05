import { useCallback, useId, useState } from "react";
import type { OrdemDosTerritorios } from "../../lib/mapa-saude-indigena/ordem-dos-territorios.ts";
import {
  OPCOES_DE_ORDEM,
  ordemPadrao,
  ordemValida,
} from "../../lib/mapa-saude-indigena/ordem-dos-territorios.ts";

/*
  "Ordenar" da lista de territórios do mapa nacional (regras em
  src/lib/mapa-saude-indigena/ordem-dos-territorios.ts).

  Enquanto a pessoa não escolhe, a ordem segue o fundo: "Vagas" no Mapa e no
  Satélite, "Nº do DSEI" no Mapa simples. Escolhida, fica guardada neste
  navegador e vale para os três fundos (sem armazenamento, vale até
  recarregar).
*/
export const CHAVE_DA_ORDEM = "agsus_mapa_si_ordem_territorios_v1";

export function usarOrdemDosTerritorios(
  simples: boolean,
): [OrdemDosTerritorios, (valor: OrdemDosTerritorios) => void] {
  const [escolha, definirEscolha] = useState<OrdemDosTerritorios | null>(() => {
    try {
      return ordemValida(localStorage.getItem(CHAVE_DA_ORDEM));
    } catch {
      return null;
    }
  });
  const definir = useCallback((nova: OrdemDosTerritorios) => {
    definirEscolha(nova);
    try {
      localStorage.setItem(CHAVE_DA_ORDEM, nova);
    } catch {
      // a escolha vale até recarregar
    }
  }, []);
  return [escolha ?? ordemPadrao(simples), definir];
}

/* O seletor compacto, logo abaixo do título da lista. */
export function OrdemDaLista({
  ordem,
  aoOrdenar,
}: {
  ordem: OrdemDosTerritorios;
  aoOrdenar(valor: OrdemDosTerritorios): void;
}) {
  const id = useId();
  return (
    <div className="mapa-si-lista__ordem">
      <label htmlFor={id}>Ordenar</label>
      <select
        id={id}
        aria-label="Ordenar os territórios"
        value={ordem}
        onChange={(evento) => {
          const nova = ordemValida(evento.target.value);
          if (nova) aoOrdenar(nova);
        }}
      >
        {OPCOES_DE_ORDEM.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
