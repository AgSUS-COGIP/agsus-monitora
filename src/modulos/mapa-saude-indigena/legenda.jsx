import { useEffect, useId, useReducer, useState } from "react";
import { Icone } from "../../componentes/icone.jsx";
import {
  EVENTO_DAS_TERRAS,
  FASES_DAS_TERRAS,
} from "../../modules/indigenous-territories-layer.js";
import {
  CORES_DO_MAPA,
  DESENHO_DAS_FORMAS,
  TIPOS_DA_LEGENDA,
  formaDoTipo,
} from "../../lib/mapa-saude-indigena/formas.js";

/* A forma de um tipo (sede, polo, CASAI, UBSI, unidade) em SVG, decorativa. */
export function Forma({ tipo, cor, tamanho = 14 }) {
  const { forma, cor: corDoTipo } = formaDoTipo(tipo);
  const desenho = DESENHO_DAS_FORMAS[forma];
  const props = {
    fill: cor || corDoTipo,
    stroke: "#ffffff",
    strokeWidth: 1.6,
    strokeLinejoin: "round",
  };
  return (
    <svg
      viewBox="0 0 18 18"
      width={tamanho}
      height={tamanho}
      aria-hidden="true"
      focusable="false"
      className="mapa-si-forma"
      data-forma={forma}
    >
      {desenho ? (
        <path d={desenho} {...props} />
      ) : (
        <circle cx="9" cy="9" r="6.4" {...props} />
      )}
    </svg>
  );
}

/* Mesma regra da legenda antiga: sem a camada instalada, a fase fica ligada. */
const faseVisivel = (mapa, fase) =>
  typeof mapa?.__agsusFaseDaTerraVisivel === "function"
    ? mapa.__agsusFaseDaTerraVisivel(fase) !== false
    : true;

/*
  As Terras Indígenas são três itens, um por fase, e cada um é interruptor da
  camada (`indigenous-territories-layer.js`). O estado vem da camada: quando
  ela avisa (`agsus:terras-mudaram`), a legenda se redesenha.
*/
export function LegendaDasTerras({ mapa }) {
  const [, atualizar] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!mapa?.on) return undefined;
    mapa.on(EVENTO_DAS_TERRAS, atualizar);
    return () => mapa.off?.(EVENTO_DAS_TERRAS, atualizar);
  }, [mapa]);
  const interativa = typeof mapa?.__agsusAlternarFaseDaTerra === "function";
  return (
    <div className="mapa-si-legenda__terras">
      <span className="mapa-si-legenda__subtitulo">
        Terras Indígenas (Funai)
      </span>
      {FASES_DAS_TERRAS.map(({ fase, rotulo }) => (
        <button
          key={fase}
          type="button"
          className="mapa-si-terra-fase"
          aria-pressed={faseVisivel(mapa, fase)}
          disabled={!interativa}
          onClick={() => {
            mapa.__agsusAlternarFaseDaTerra(fase);
            atualizar();
          }}
        >
          <i
            className={`mapa-si-terra-fase__amostra mapa-si-terra-fase__amostra--${fase}`}
            aria-hidden="true"
          />
          <span>{rotulo}</span>
        </button>
      ))}
    </div>
  );
}

export function Amostra({ tipo, cor }) {
  return (
    <i
      className={`mapa-si-amostra mapa-si-amostra--${tipo}`}
      style={cor ? { "--mapa-si-amostra": cor } : undefined}
      aria-hidden="true"
    />
  );
}

/*
  A caixa da legenda sobre o canto do mapa, recolhível. Começa recolhida —
  só o botão "Legenda" — também no computador: aberta, ela tapava parte do
  Sul e do Sudeste no enquadramento do Brasil. Usada pelos mapas nacionais da
  Saúde Indígena e de Projetos.
*/
export function LegendaFlutuante({ children }) {
  const [aberta, definirAberta] = useState(false);
  const idDoCorpo = useId();
  return (
    <div className="mapa-si-legenda mapa-si-legenda--flutuante">
      <button
        type="button"
        className="mapa-si-legenda__alternar"
        aria-expanded={aberta}
        aria-controls={idDoCorpo}
        onClick={() => definirAberta((valor) => !valor)}
      >
        <span>Legenda</span>
        <Icone nome={aberta ? "chevron-up" : "chevron-down"} tamanho={16} />
      </button>
      <div id={idDoCorpo} className="mapa-si-legenda__corpo" hidden={!aberta}>
        {children}
      </div>
    </div>
  );
}

/*
  Legenda do mapa nacional da Saúde Indígena: as cores da bolha, a
  abrangência, a CASAI nacional e as terras.
*/
export function LegendaNacional({ mapa, temAbrangencia }) {
  return (
    <LegendaFlutuante>
      <span className="mapa-si-legenda__item">
        <Amostra tipo="bolha" cor={CORES_DO_MAPA.semEdital.preenchimento} />
        DSEI (sede; tamanho = nº de indígenas)
      </span>
      <span className="mapa-si-legenda__item">
        <Amostra tipo="bolha" cor={CORES_DO_MAPA.comEdital.preenchimento} />
        DSEI com processo ativo
      </span>
      {temAbrangencia ? (
        <span className="mapa-si-legenda__item">
          <Amostra tipo="abrangencia" />
          abrangência oficial do DSEI
        </span>
      ) : null}
      <span className="mapa-si-legenda__item">
        <Amostra tipo="casai-nacional" cor={CORES_DO_MAPA.casaiNacional} />
        CASAI Nacional
      </span>
      <LegendaDasTerras mapa={mapa} />
    </LegendaFlutuante>
  );
}

/* Legenda do mapa do DSEI: as cinco formas, a linha do vínculo e as terras. */
export function LegendaDoDsei({ mapa }) {
  return (
    <footer
      className="mapa-si-legenda mapa-si-legenda--rodape"
      aria-label="Legenda do mapa do DSEI"
    >
      {TIPOS_DA_LEGENDA.map((tipo) => (
        <span key={tipo} className="mapa-si-legenda__item">
          <Forma tipo={tipo} />
          {formaDoTipo(tipo).rotulo}
        </span>
      ))}
      <span className="mapa-si-legenda__item">
        <Amostra tipo="vinculo" />
        vínculo fora das UFs do DSEI
      </span>
      <LegendaDasTerras mapa={mapa} />
    </footer>
  );
}
