import { useEffect, useRef, useState } from "react";
import {
  DURACAO_MAXIMA_S,
  DURACAO_MINIMA_S,
  type Efeito,
  type FormaDoMarco,
  type Intensidade,
} from "../../lib/catalogo-de-comemoracoes.ts";
import {
  avancarCena,
  cenaAcabou,
  criarCena,
  EFEITOS,
  ROTULOS_DOS_EFEITOS,
  ROTULOS_DOS_NIVEIS,
} from "../../lib/motor-de-efeitos.js";
import {
  criarHalos,
  desenharPrevia,
  paletaDoTema,
  semMovimento,
} from "../../modules/comemoracao.js";
import { Segmentado } from "../../ui/index.js";
import { Icone } from "../../componentes/icone.jsx";

/*
  Palco de testes de Configurações › Comemorações, no topo da seção: a
  prévia em miniatura (o efeito escolhido em laço, num canvas do cartão), os
  efeitos em botões-ícone, a intensidade, a duração e o som; "Soltar" mostra
  na tela inteira, sem gravar nada (`teste: true`, que ignora a configuração
  publicada e a preferência pessoal). Com menos movimento, sem a miniatura.
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

/** O ícone (Lucide) de cada efeito: nos botões do palco e nos chips dos marcos. */
export const ICONES_DOS_EFEITOS: Readonly<Record<Efeito, string>> =
  Object.freeze({
    fogos: "sparkles",
    confete: "party-popper",
    serpentina: "ribbon",
    estrelas: "star",
    coracoes: "heart",
    baloes: "balloon",
    aya: "bird",
    combinado: "wand-sparkles",
  });

export const OPCOES_DE_INTENSIDADE = (
  Object.keys(ROTULOS_DOS_NIVEIS) as Intensidade[]
).map((valor) => ({ valor, rotulo: ROTULOS_DOS_NIVEIS[valor] }));

/* A miniatura: a cena do efeito em laço, do tamanho do cartão. */
function Previa({
  efeito,
  intensidade,
  duracaoS,
}: {
  efeito: Efeito;
  intensidade: Intensidade;
  duracaoS: number;
}) {
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = tela.current;
    const janela = canvas?.ownerDocument.defaultView;
    const contexto = canvas?.getContext?.("2d");
    if (!canvas || !janela || !contexto || semMovimento(janela)) return;
    const doc = canvas.ownerDocument;
    const largura = canvas.clientWidth || 600;
    const altura = canvas.clientHeight || 220;
    const dpr = Math.min(2, Math.max(1, janela.devicePixelRatio || 1));
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    contexto.setTransform(dpr, 0, 0, dpr, 0, 0);
    const halo = criarHalos(doc);
    const paleta = paletaDoTema(doc, janela);
    const nova = () =>
      criarCena({
        efeito,
        intensidade,
        duracaoMs: duracaoS * 1000,
        largura,
        altura,
        paleta,
        comAya: false,
      });
    let cena = nova();
    let anterior: number | null = null;
    let pedido = 0;
    const quadro = (agora: number) => {
      const dt =
        anterior === null || doc.hidden ? 0 : (agora - anterior) / 1000;
      anterior = agora;
      avancarCena(cena, dt);
      desenharPrevia(contexto, cena, { largura, altura, dt, halo });
      if (cenaAcabou(cena)) cena = nova();
      pedido = janela.requestAnimationFrame(quadro);
    };
    pedido = janela.requestAnimationFrame(quadro);
    return () => {
      janela.cancelAnimationFrame(pedido);
      contexto.clearRect(0, 0, largura, altura);
    };
  }, [efeito, intensidade, duracaoS]);
  return (
    <div className="comemoracoes-palco__previa" aria-hidden="true">
      <canvas ref={tela} />
      {efeito === "aya" ? (
        <span className="comemoracoes-palco__aya">
          <Icone nome="bird" tamanho={40} />
        </span>
      ) : null}
    </div>
  );
}

export function PalcoDeTestes({
  testar,
  previa = true,
}: {
  testar: Testar;
  previa?: boolean;
}) {
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
    <section
      className="comemoracoes-palco"
      aria-labelledby="comemoracoesPalcoTitulo"
      data-tour="config-comemoracoes-palco"
    >
      <h3 id="comemoracoesPalcoTitulo" className="comemoracoes-palco__titulo">
        <Icone nome="play" tamanho={16} /> Palco de testes
      </h3>
      {previa ? (
        <Previa efeito={efeito} intensidade={intensidade} duracaoS={duracaoS} />
      ) : null}
      <div
        className="comemoracoes-palco__efeitos"
        role="radiogroup"
        aria-label="Efeito"
      >
        {(EFEITOS as Efeito[]).map((nome) => (
          <button
            key={nome}
            type="button"
            role="radio"
            aria-checked={efeito === nome}
            data-efeito={nome}
            className={
              efeito === nome
                ? "comemoracoes-efeito is-ativo"
                : "comemoracoes-efeito"
            }
            onClick={() => setEfeito(nome)}
          >
            <Icone nome={ICONES_DOS_EFEITOS[nome]} tamanho={22} />
            <span>{ROTULOS_DOS_EFEITOS[nome]}</span>
          </button>
        ))}
      </div>
      <div className="comemoracoes-palco__controles">
        <Segmentado
          rotulo="Intensidade"
          className="comemoracoes-palco__intensidade"
          opcoes={OPCOES_DE_INTENSIDADE}
          valor={intensidade}
          aoMudar={(valor: Intensidade) => setIntensidade(valor)}
        />
        <label className="comemoracoes-palco__duracao">
          <span>Duração {duracaoS.toLocaleString("pt-BR")} s</span>
          <input
            id="comemoracoesPalcoDuracao"
            type="range"
            min={DURACAO_MINIMA_S}
            max={DURACAO_MAXIMA_S}
            step={0.5}
            value={duracaoS}
            onChange={(evento) => setDuracaoS(Number(evento.target.value))}
          />
        </label>
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
    </section>
  );
}
