import { useState } from "react";
import {
  DURACAO_MAXIMA_S,
  DURACAO_MINIMA_S,
  type Efeito,
  type FormaDoMarco,
  type Intensidade,
} from "../../lib/catalogo-de-comemoracoes.ts";
import {
  EFEITOS,
  ROTULOS_DOS_EFEITOS,
  ROTULOS_DOS_NIVEIS,
} from "../../lib/motor-de-efeitos.js";
import { Campo } from "../../ui/index.js";
import { Icone } from "../../componentes/icone.jsx";

/*
  Palco de testes de Configurações › Comemorações: escolhe um efeito, a
  intensidade, a duração e o som e solta na hora, sem gravar nada (a
  comemoração vai com `teste: true`, que ignora a configuração publicada e a
  preferência pessoal). O desenho é o de todas as comemorações
  (src/modules/comemoracao.js).
*/

export interface PedidoDeTeste {
  texto: string;
  efeito: Efeito;
  intensidade: Intensidade;
  duracaoMs: number | null;
  som: boolean;
  forma?: FormaDoMarco;
}

export type Testar = (pedido: PedidoDeTeste) => void;

const INTENSIDADES = Object.keys(ROTULOS_DOS_NIVEIS) as Intensidade[];

export function PalcoDeTestes({ testar }: { testar: Testar }) {
  const [efeito, setEfeito] = useState<Efeito>("fogos");
  const [intensidade, setIntensidade] = useState<Intensidade>("normal");
  const [duracaoS, setDuracaoS] = useState(6);
  const [som, setSom] = useState(false);
  const soltar = () =>
    testar({
      texto: `Prévia: ${ROTULOS_DOS_EFEITOS[efeito]} · ${ROTULOS_DOS_NIVEIS[intensidade]} · ${duracaoS.toLocaleString("pt-BR")} s`,
      efeito,
      intensidade,
      duracaoMs: Math.round(duracaoS * 1000),
      som,
    });
  return (
    <div
      className="comemoracoes-palco ui-campo-largo"
      data-tour="config-comemoracoes-palco"
    >
      <Campo rotulo="Efeito">
        <select
          id="comemoracoesPalcoEfeito"
          value={efeito}
          onChange={(evento) => setEfeito(evento.target.value as Efeito)}
        >
          {EFEITOS.map((nome) => (
            <option key={nome} value={nome}>
              {ROTULOS_DOS_EFEITOS[nome as Efeito]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Intensidade">
        <select
          id="comemoracoesPalcoIntensidade"
          value={intensidade}
          onChange={(evento) =>
            setIntensidade(evento.target.value as Intensidade)
          }
        >
          {INTENSIDADES.map((nome) => (
            <option key={nome} value={nome}>
              {ROTULOS_DOS_NIVEIS[nome]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo={`Duração: ${duracaoS.toLocaleString("pt-BR")} s`}>
        <input
          id="comemoracoesPalcoDuracao"
          type="range"
          min={DURACAO_MINIMA_S}
          max={DURACAO_MAXIMA_S}
          step={0.5}
          value={duracaoS}
          onChange={(evento) => setDuracaoS(Number(evento.target.value))}
        />
      </Campo>
      <label className="comemoracoes-caixa">
        <input
          type="checkbox"
          checked={som}
          onChange={(evento) => setSom(evento.target.checked)}
        />
        Som
      </label>
      <button
        type="button"
        className="btn green comemoracoes-palco__soltar"
        onClick={soltar}
      >
        <Icone nome="play" tamanho={16} /> Soltar
      </button>
    </div>
  );
}
