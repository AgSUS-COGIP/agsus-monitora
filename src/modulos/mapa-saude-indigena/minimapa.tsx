import { useEffect, useMemo, useState } from "react";
import type { DseiDoMapa } from "../../lib/mapas/mapa-saude-indigena/tipos.ts";
import type { ContornoDoDsei } from "../../lib/mapas/mapa-saude-indigena/contornos-dos-dseis.ts";
import { carregarContornosDosDseis } from "../../lib/mapas/mapa-saude-indigena/contornos-dos-dseis.ts";
import {
  caminhoDaGeometria,
  contornoDoDsei,
  projecaoDoBrasil,
  type GeometriaDoMinimapa,
} from "../../lib/mapas/mapa-saude-indigena/minimapa.ts";
import { temCoordenada } from "../../lib/mapas/mapa-saude-indigena/chaves.ts";
import { carregarContornos } from "./leaflet.ts";

/*
  O minimapa de localização do DSEI (como no SIGEPSI): um Brasil pequeno no
  canto do mapa do DSEI, com a área do distrito em destaque. Os contornos
  chegam sob demanda (os mesmos do mapa); sem eles, nada aparece; sem o
  contorno do DSEI, um ponto na sede. Regra em
  src/lib/mapas/mapa-saude-indigena/minimapa.ts.
*/

const PROJECAO = projecaoDoBrasil(120);

/* O contorno do Brasil e os dos DSEIs, uma vez por página. */
function usarContornos() {
  const [dados, definir] = useState<{
    brasil: GeometriaDoMinimapa | null;
    dseis: readonly ContornoDoDsei[];
  }>({ brasil: null, dseis: [] });
  useEffect(() => {
    let vivo = true;
    void Promise.all([
      carregarContornos().then(
        (m) => m.BR_OUTLINE as GeometriaDoMinimapa,
        () => null,
      ),
      carregarContornosDosDseis(),
    ]).then(([brasil, dseis]) => {
      if (vivo) definir({ brasil, dseis });
    });
    return () => {
      vivo = false;
    };
  }, []);
  return dados;
}

export function MinimapaDoDsei({ dsei }: { dsei: DseiDoMapa }) {
  const { brasil, dseis } = usarContornos();
  const caminhoDoBrasil = useMemo(
    () => caminhoDaGeometria(brasil, PROJECAO),
    [brasil],
  );
  const caminhoDoDsei = useMemo(() => {
    const contorno = contornoDoDsei(dseis, dsei);
    return contorno ? caminhoDaGeometria(contorno.geometry, PROJECAO) : "";
  }, [dseis, dsei]);
  if (!caminhoDoBrasil) return null;
  const sede = temCoordenada(dsei.lat, dsei.lon)
    ? PROJECAO.ponto(Number(dsei.lon), Number(dsei.lat))
    : null;
  return (
    <div className="mapa-si-minimapa">
      <svg
        viewBox={`0 0 ${PROJECAO.largura} ${PROJECAO.altura}`}
        width={PROJECAO.largura}
        height={PROJECAO.altura}
        role="img"
        aria-label={`Onde fica o DSEI ${dsei.n} no Brasil`}
      >
        <path className="mapa-si-minimapa__brasil" d={caminhoDoBrasil} />
        {caminhoDoDsei ? (
          <path className="mapa-si-minimapa__dsei" d={caminhoDoDsei} />
        ) : sede ? (
          <circle
            className="mapa-si-minimapa__sede"
            cx={sede[0]}
            cy={sede[1]}
            r={4}
          />
        ) : null}
      </svg>
    </div>
  );
}
