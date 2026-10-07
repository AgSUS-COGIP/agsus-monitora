import { useState } from "react";
import { Icone } from "../../componentes/icone.jsx";
import { Segmentado } from "../../ui/index.js";
import {
  definirEstadoDaAya,
  ESTADOS_DA_MASCOTE,
  type EstadoDaMascote,
} from "../../lib/estado-da-aya.ts";
import { Mascote } from "../aya/mascote/mascote.tsx";

/*
  Configurações › Marca › Mascote: a arara da Aya em cada estado, para o
  administrador conferir. "Ver na arara do canto" manda o estado escolhido
  para a arara flutuante pelo evento global `aya:estado`.
*/

const ROTULOS: Readonly<Record<EstadoDaMascote, string>> = Object.freeze({
  parada: "Parada",
  atenta: "Atenta",
  falando: "Falando",
  pensando: "Pensando",
  comemorando: "Comemorando",
  dormindo: "Dormindo",
  acenando: "Acenando",
});

const OPCOES = ESTADOS_DA_MASCOTE.map((valor) => ({
  valor,
  rotulo: ROTULOS[valor],
}));

const DURACAO_NO_CANTO_MS = 4000;

export function CartaoDaMascote() {
  const [estado, setEstado] = useState<EstadoDaMascote>("parada");
  return (
    <section
      className="config-grupo cartao-da-mascote"
      data-tom="azul"
      data-grupo="mascote"
      data-tour="config-marca-mascote"
      aria-labelledby="configGrupo-marca-mascote"
    >
      <header className="config-grupo__cabecalho">
        <span className="config-grupo__icone" aria-hidden="true">
          <Icone nome="image" tamanho={16} />
        </span>
        <div>
          <h4 id="configGrupo-marca-mascote">Mascote</h4>
        </div>
      </header>
      <div className="cartao-da-mascote__palco">
        <Mascote
          estado={estado}
          tamanho={176}
          rotulo={`Aya, ${ROTULOS[estado].toLowerCase()}`}
        />
        <div className="cartao-da-mascote__tamanhos" aria-hidden="true">
          <span className="aya-retrato">
            <Mascote estado={estado} enquadramento="retrato" tamanho={58} />
          </span>
          <span className="aya-retrato cartao-da-mascote__retrato-pequeno">
            <Mascote estado={estado} enquadramento="retrato" tamanho={42} />
          </span>
          <Mascote estado={estado} tamanho={32} />
          <Mascote estado={estado} tamanho={20} />
        </div>
      </div>
      <Segmentado
        rotulo="Estado da mascote"
        opcoes={OPCOES}
        valor={estado}
        aoMudar={(valor: EstadoDaMascote) => setEstado(valor)}
        className="cartao-da-mascote__estados"
        tour={undefined}
      />
      <button
        type="button"
        className="btn secondary cartao-da-mascote__canto"
        onClick={() => definirEstadoDaAya(estado, DURACAO_NO_CANTO_MS)}
      >
        Ver na arara do canto
      </button>
    </section>
  );
}
