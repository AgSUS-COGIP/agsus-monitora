/*
  O desenho da Aya: a arara-azul-grande (Anodorhynchus hyacinthinus) de corpo
  inteiro, fiel à ilustração de referência (arara-azul-monitora.png, no histórico do git)
  em anatomia, proporção, cor e luz. Os contornos e as faixas de luz vêm de
  contornos.ts (traçados da referência); aqui fica a composição em camadas que
  as animações movem (mascote.css): cauda, asa aberta (só no aceno e na
  comemoração), corpo, pés, asa fechada, coxa, cabeça com as penas da nuca,
  olho (anel, íris, pálpebra), boca, bico inferior e superior, e o poleiro
  com a sombra de contato.

  Cada parte é o recorte (clipPath) do seu contorno sobre UM conjunto de tons
  compartilhado — por isso as emendas entre cabeça, corpo e asas não aparecem.
  Abaixo de 40px, `DesenhoSimples`: os mesmos contornos em cor chapada, sem
  tons nem filtro.

  Os ids levam o prefixo de cada instância (várias araras na mesma página).
  Vem num pedaço próprio do bundle (import dinâmico em mascote.tsx): os
  contornos pesam ~60 KB e não precisam atrasar a primeira tela.
*/

import { CONTORNOS, CORES_DOS_TONS, TONS } from "./contornos.ts";

type Parte = keyof typeof CONTORNOS;

const AMARELO = Object.freeze({
  claro: "#ffd84a",
  base: "#f9bc06",
  escuro: "#d98f00",
});
const AZUL = CORES_DOS_TONS.azul;
const CINZA = CORES_DOS_TONS.cinza;

/* O olho (da referência): centro do anel, raio da íris, pálpebra. */
const OLHO = Object.freeze({ x: 102.8, y: 29.3 });

/** Uma pena alongada da raiz à ponta (penas soltas da comemoração). */
function pena(x: number, y: number, giro: number, comprimento: number) {
  const r = (giro * Math.PI) / 180;
  const dx = Math.cos(r) * comprimento;
  const dy = Math.sin(r) * comprimento;
  const nx = -dy * 0.22;
  const ny = dx * 0.22;
  const f = (v: number) => v.toFixed(1);
  return `M${f(x)} ${f(y)}Q${f(x + dx / 2 + nx)} ${f(y + dy / 2 + ny)} ${f(x + dx)} ${f(y + dy)}Q${f(x + dx / 2 - nx)} ${f(y + dy / 2 - ny)} ${f(x)} ${f(y)}Z`;
}

const PENAS_SOLTAS = Object.freeze([
  { x: 74, y: 100, giro: 120 },
  { x: 132, y: 118, giro: 60 },
  { x: 100, y: 84, giro: 150 },
]);

function Recortes({ p }: { p: string }) {
  const partes: Parte[] = [
    "cauda",
    "asaAberta",
    "corpo",
    "asa",
    "coxa",
    "cabeca",
    "bicoSuperior",
    "bicoInferior",
    "pes",
  ];
  return (
    <>
      {partes.map((parte) => (
        <clipPath key={parte} id={`${p}-c-${parte}`}>
          <path d={CONTORNOS[parte]} />
        </clipPath>
      ))}
    </>
  );
}

function Tons({ p }: { p: string }) {
  return (
    <>
      <filter id={`${p}-suave`} x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="0.55" />
      </filter>
      <g id={`${p}-ta`} filter={`url(#${p}-suave)`}>
        {TONS.azul.map((d, i) => (
          <path key={i} d={d} fill={AZUL[i]} />
        ))}
      </g>
      <g id={`${p}-tp`}>
        <use href={`#${p}-ta`} />
        <path d={TONS.penas[0]} fill="#3f80ea" opacity="0.42" />
        <path d={TONS.penas[1]} fill="#010f38" opacity="0.32" />
      </g>
      <g id={`${p}-te`} filter={`url(#${p}-suave)`}>
        {TONS.cinza.map((d, i) => (
          <path key={i} d={d} fill={CINZA[i]} />
        ))}
      </g>
      <radialGradient id={`${p}-anel`} cx="0.42" cy="0.38" r="0.62">
        <stop offset="0" stopColor={AMARELO.claro} />
        <stop offset="0.65" stopColor={AMARELO.base} />
        <stop offset="1" stopColor={AMARELO.escuro} />
      </radialGradient>
      <radialGradient id={`${p}-iris`} cx="0.42" cy="0.38" r="0.6">
        <stop offset="0" stopColor="#8a5526" />
        <stop offset="0.6" stopColor="#4a2a12" />
        <stop offset="1" stopColor="#1c0f06" />
      </radialGradient>
      <linearGradient id={`${p}-galho`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b07d4b" />
        <stop offset="0.45" stopColor="#8a5a2e" />
        <stop offset="1" stopColor="#4e3018" />
      </linearGradient>
      <radialGradient id={`${p}-sombra`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#0b1f3d" stopOpacity="0.4" />
        <stop offset="1" stopColor="#0b1f3d" stopOpacity="0" />
      </radialGradient>
      <clipPath id={`${p}-c-olho`}>
        <ellipse cx={OLHO.x} cy={OLHO.y} rx="3.9" ry="3.8" />
      </clipPath>
    </>
  );
}

/** Uma parte: o contorno dela recortando os tons compartilhados. */
function Parte({
  p,
  parte,
  tons = "tp",
}: {
  p: string;
  parte: Parte;
  tons?: "tp" | "te";
}) {
  return (
    <g clipPath={`url(#${p}-c-${parte})`}>
      <use href={`#${p}-${tons}`} />
    </g>
  );
}

function Poleiro({ p }: { p: string }) {
  return (
    <g className="mascote__poleiro">
      <path
        d="M22 174C70 170 140 169 196 171L196 182C140 180 70 181 22 186Z"
        fill={`url(#${p}-galho)`}
      />
      <path
        d="M34 177q14-2 26-1M70 175q18-1 30-1M148 174q16 0 28 1M44 183q14-2 24-2"
        fill="none"
        stroke="#4e3018"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M194 171C196 174 196 179 194 182"
        stroke="#4e3018"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M30 178C25 170 22 165 17 161"
        stroke="#6b4423"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M20 164C10 163 7 156 8 150C16 152 21 158 20 164Z"
        fill="#2f8a4a"
      />
      <path
        d="M24 168C26 160 33 156 39 157C37 163 31 168 24 168Z"
        fill="#3fa35c"
      />
      {/* Sombra de contato sob os pés. */}
      <ellipse
        className="mascote__sombra"
        cx="103"
        cy="173"
        rx="30"
        ry="3.6"
        fill={`url(#${p}-sombra)`}
      />
    </g>
  );
}

function Olho({ p }: { p: string }) {
  return (
    <g className="mascote__olho">
      <path d={CONTORNOS.anel} fill={`url(#${p}-anel)`} />
      <ellipse
        cx={OLHO.x}
        cy={OLHO.y}
        rx="4.05"
        ry="3.95"
        fill="none"
        stroke="#7a4a00"
        strokeWidth="0.45"
        opacity="0.7"
      />
      <g clipPath={`url(#${p}-c-olho)`}>
        <g className="mascote__iris">
          <circle
            cx={OLHO.x + 0.2}
            cy={OLHO.y + 0.1}
            r="3.4"
            fill={`url(#${p}-iris)`}
          />
          <circle cx={OLHO.x + 0.2} cy={OLHO.y + 0.1} r="1.85" fill="#0d0703" />
          <circle
            cx={OLHO.x + 0.95}
            cy={OLHO.y - 1.25}
            r="0.85"
            fill="#ffffff"
          />
          <circle
            cx={OLHO.x - 0.9}
            cy={OLHO.y + 1.2}
            r="0.35"
            fill="#ffffff"
            opacity="0.7"
          />
        </g>
        <g className="mascote__palpebra">
          <rect
            x={OLHO.x - 4.2}
            y={OLHO.y - 4.1}
            width="8.4"
            height="8.4"
            fill={AMARELO.base}
          />
          <path
            d={`M${OLHO.x - 4.2} ${OLHO.y + 4.2}h8.4`}
            stroke={AMARELO.escuro}
            strokeWidth="0.7"
          />
        </g>
      </g>
      <path
        className="mascote__olho-fechado"
        d={`M${OLHO.x - 3} ${OLHO.y + 0.3}Q${OLHO.x} ${OLHO.y + 2.5} ${OLHO.x + 3} ${OLHO.y + 0.3}`}
        fill="none"
        stroke="#5a3400"
        strokeWidth="0.75"
        strokeLinecap="round"
      />
    </g>
  );
}

function Cabeca({ p }: { p: string }) {
  return (
    <g className="mascote__cabeca-pose">
      <g className="mascote__cabeca">
        {/* Penas da nuca: arrepiam às vezes. */}
        <g className="mascote__penas-da-cabeca">
          <path
            d="M86 35C82.5 33 80.5 30 81 27C83.5 29 86 30.5 89 31.5Z"
            fill={AZUL[3]}
          />
          <path
            d="M90.5 29C88.5 26.5 88 23.5 89.5 21C91.5 23.5 93 25.5 95.5 26.5Z"
            fill={AZUL[4]}
          />
          <path
            d="M83 43C79.5 42 77.5 39.5 77.5 37C80 38.5 82.5 39.5 85.5 39.5Z"
            fill={AZUL[2]}
          />
        </g>
        <Parte p={p} parte="cabeca" />
        <path d={CONTORNOS.faixa} fill={`url(#${p}-anel)`} />
        <Olho p={p} />
        <g className="mascote__bico">
          <path className="mascote__boca" d={CONTORNOS.boca} fill="#2a1512" />
          <g className="mascote__bico-inferior">
            <Parte p={p} parte="bicoInferior" tons="te" />
          </g>
          <g className="mascote__bico-superior">
            <Parte p={p} parte="bicoSuperior" tons="te" />
          </g>
        </g>
      </g>
    </g>
  );
}

function Extras() {
  return (
    <>
      <g className="mascote__penas-soltas" aria-hidden="true">
        {PENAS_SOLTAS.map(({ x, y, giro }, i) => (
          <g
            key={i}
            className="mascote__pena-solta"
            style={{ ["--i" as string]: i }}
          >
            <path d={pena(x, y, giro, 14)} fill={AZUL[i === 1 ? 6 : 4]} />
          </g>
        ))}
      </g>
      <g className="mascote__sono" aria-hidden="true">
        <text className="mascote__z" x="122" y="18">
          z
        </text>
        <text className="mascote__z" x="130" y="10">
          z
        </text>
        <text className="mascote__z" x="138" y="4">
          Z
        </text>
      </g>
    </>
  );
}

export function DesenhoCompleto({
  p,
  poleiro,
}: {
  p: string;
  poleiro: boolean;
}) {
  return (
    <>
      <defs>
        <Recortes p={p} />
        <Tons p={p} />
      </defs>
      {poleiro ? <Poleiro p={p} /> : null}
      <g className="mascote__salto">
        <g className="mascote__respiro">
          <g className="mascote__cauda">
            <Parte p={p} parte="cauda" />
          </g>
          <g className="mascote__asa-aberta-pose">
            <g className="mascote__asa-aberta">
              <Parte p={p} parte="asaAberta" />
            </g>
          </g>
          <g className="mascote__corpo">
            <Parte p={p} parte="corpo" />
          </g>
        </g>
        <g className="mascote__pes">
          <Parte p={p} parte="pes" tons="te" />
        </g>
        <g className="mascote__respiro">
          <g className="mascote__asa-pose">
            <g className="mascote__asa">
              <Parte p={p} parte="asa" />
            </g>
          </g>
          <g className="mascote__coxa">
            <Parte p={p} parte="coxa" />
          </g>
          <Cabeca p={p} />
        </g>
      </g>
      <Extras />
    </>
  );
}

/* Abaixo de 40px: os mesmos contornos, chapados (sem tons nem filtro). */
export function DesenhoSimples({ p }: { p: string }) {
  const azul = `url(#${p}-s-azul)`;
  return (
    <>
      <defs>
        <linearGradient id={`${p}-s-azul`} x1="0.7" y1="0.1" x2="0.2" y2="1">
          <stop offset="0" stopColor={AZUL[6]} />
          <stop offset="0.55" stopColor={AZUL[4]} />
          <stop offset="1" stopColor={AZUL[1]} />
        </linearGradient>
        <clipPath id={`${p}-c-olho`}>
          <ellipse cx={OLHO.x} cy={OLHO.y} rx="3.9" ry="3.8" />
        </clipPath>
      </defs>
      <g className="mascote__salto">
        <path d={CONTORNOS.cauda} fill={AZUL[2]} />
        <g className="mascote__asa-aberta-pose">
          <g className="mascote__asa-aberta">
            <path d={CONTORNOS.asaAberta} fill={AZUL[3]} />
          </g>
        </g>
        <path d={CONTORNOS.corpo} fill={azul} />
        <path d={CONTORNOS.pes} fill={CINZA[0]} />
        <path d={CONTORNOS.asa} fill={AZUL[3]} />
        <path d={CONTORNOS.coxa} fill={azul} />
        <g className="mascote__cabeca-pose">
          <path d={CONTORNOS.cabeca} fill={AZUL[5]} />
          <path d={CONTORNOS.faixa} fill={AMARELO.base} />
          <path d={CONTORNOS.anel} fill={AMARELO.base} />
          <g clipPath={`url(#${p}-c-olho)`}>
            <g className="mascote__iris">
              <circle cx={OLHO.x} cy={OLHO.y} r="2.6" fill="#2a1608" />
            </g>
            <g className="mascote__palpebra">
              <rect
                x={OLHO.x - 4.2}
                y={OLHO.y - 4.1}
                width="8.4"
                height="8.4"
                fill={AMARELO.base}
              />
            </g>
          </g>
          <path d={CONTORNOS.bicoInferior} fill={CINZA[0]} />
          <path d={CONTORNOS.bicoSuperior} fill={CINZA[1]} />
        </g>
      </g>
    </>
  );
}
