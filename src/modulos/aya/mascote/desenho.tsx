/*
  O desenho da Aya: uma arara-azul (Anodorhynchus hyacinthinus) em SVG, em
  camadas que as animações movem por transform/opacity (mascote.css). Cores
  da ilustração (não da interface): o azul-cobalto do corpo, o amarelo do
  anel do olho e da faixa na base do bico, o bico cinza-grafite e o poleiro.

  Duas versões: `DesenhoCompleto` (viewBox 0 0 200 200, com corpo, asas,
  cauda, pés e poleiro opcional; o retrato recorta a cabeça e o peito) e
  `DesenhoSimples` (≤32px: cabeça, olho e bico, sem textura).

  Os ids dos gradientes levam o prefixo de cada instância (várias araras na
  mesma página não dividem gradiente).
*/

export const VIEWBOX_DO_CORPO = "0 0 200 200";
export const VIEWBOX_DO_RETRATO = "88 16 96 96";
export const VIEWBOX_SIMPLES = "0 0 32 32";

const AZUL = Object.freeze({
  brilho: "#6f95ff",
  claro: "#3d6cf5",
  medio: "#2350dc",
  base: "#1b3fc2",
  escuro: "#132c93",
  fundo: "#0c1d68",
});
const AMARELO = Object.freeze({
  claro: "#ffe27a",
  base: "#ffc928",
  escuro: "#e59a00",
});
const BICO = Object.freeze({
  brilho: "#8d939f",
  base: "#4a4f5a",
  escuro: "#23262d",
});

/** Uma pena alongada da raiz à ponta, com largura no meio (asa aberta, penas soltas). */
function pena(
  [x1, y1]: readonly [number, number],
  [x2, y2]: readonly [number, number],
  largura: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const comprimento = Math.hypot(dx, dy) || 1;
  const nx = (-dy / comprimento) * largura;
  const ny = (dx / comprimento) * largura;
  const ponto = (t: number, lado: number) =>
    `${(x1 + dx * t + nx * lado).toFixed(1)} ${(y1 + dy * t + ny * lado).toFixed(1)}`;
  return [
    `M ${x1} ${y1}`,
    `C ${ponto(0.25, 0.9)} ${ponto(0.75, 0.8)} ${ponto(0.97, 0.18)}`,
    `Q ${x2} ${y2} ${ponto(0.97, -0.18)}`,
    `C ${ponto(0.75, -0.8)} ${ponto(0.25, -0.9)} ${x1} ${y1}`,
    "Z",
  ].join(" ");
}

/* A asa de trás, aberta (aceno e comemoração): rêmiges em leque, da mais alta à mais baixa. */
const RAIZ_DA_ASA: readonly [number, number] = [145, 110];
const grau = (g: number) => (g * Math.PI) / 180;
const leque = (
  angulos: readonly number[],
  comprimentos: readonly number[],
  largura: number,
  recuo: number,
) =>
  angulos.map((angulo, i) => {
    const comprimento = comprimentos[i] ?? 50;
    const raiz: [number, number] = [
      RAIZ_DA_ASA[0] + recuo * Math.cos(grau(angulo)),
      RAIZ_DA_ASA[1] + recuo * Math.sin(grau(angulo)),
    ];
    const ponta: [number, number] = [
      Number(
        (RAIZ_DA_ASA[0] + comprimento * Math.cos(grau(angulo))).toFixed(1),
      ),
      Number(
        (RAIZ_DA_ASA[1] + comprimento * Math.sin(grau(angulo))).toFixed(1),
      ),
    ];
    return { d: pena(raiz, ponta, largura), raiz, ponta, i };
  });
const REMIGES = leque(
  [-64, -53, -42, -31, -20, -9, 2],
  [68, 70, 68, 64, 59, 53, 46],
  6.4,
  10,
);
const SECUNDARIAS = leque([-58, -44, -30, -16, -2], [44, 46, 44, 40, 33], 7, 6);

/* As penas que se soltam na comemoração (posição inicial). */
const PENAS_SOLTAS = Object.freeze([
  { x: 96, y: 104, giro: -30 },
  { x: 158, y: 124, giro: 20 },
  { x: 120, y: 92, giro: -60 },
]);

function Gradientes({ p }: { p: string }) {
  return (
    <defs>
      <radialGradient id={`${p}-corpo`} cx="0.62" cy="0.34" r="0.78">
        <stop offset="0" stopColor={AZUL.brilho} />
        <stop offset="0.35" stopColor={AZUL.claro} />
        <stop offset="0.72" stopColor={AZUL.base} />
        <stop offset="1" stopColor={AZUL.fundo} />
      </radialGradient>
      <radialGradient id={`${p}-cabeca`} cx="0.6" cy="0.32" r="0.75">
        <stop offset="0" stopColor={AZUL.brilho} />
        <stop offset="0.4" stopColor={AZUL.claro} />
        <stop offset="0.85" stopColor={AZUL.base} />
        <stop offset="1" stopColor={AZUL.escuro} />
      </radialGradient>
      <linearGradient id={`${p}-asa`} x1="0.2" y1="0" x2="0.55" y2="1">
        <stop offset="0" stopColor={AZUL.claro} />
        <stop offset="0.45" stopColor={AZUL.medio} />
        <stop offset="1" stopColor={AZUL.fundo} />
      </linearGradient>
      <linearGradient id={`${p}-asa-aberta`} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor={AZUL.escuro} />
        <stop offset="0.5" stopColor={AZUL.medio} />
        <stop offset="1" stopColor={AZUL.claro} />
      </linearGradient>
      <linearGradient id={`${p}-coberteiras`} x1="0.3" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor={AZUL.brilho} />
        <stop offset="0.5" stopColor={AZUL.claro} />
        <stop offset="1" stopColor={AZUL.medio} />
      </linearGradient>
      <linearGradient id={`${p}-primarias`} x1="0.8" y1="0" x2="0.2" y2="1">
        <stop offset="0" stopColor={AZUL.medio} />
        <stop offset="1" stopColor={AZUL.fundo} />
      </linearGradient>
      <linearGradient id={`${p}-cauda`} x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={AZUL.medio} />
        <stop offset="1" stopColor={AZUL.fundo} />
      </linearGradient>
      <radialGradient id={`${p}-anel`} cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor={AMARELO.claro} />
        <stop offset="0.6" stopColor={AMARELO.base} />
        <stop offset="1" stopColor={AMARELO.escuro} />
      </radialGradient>
      <linearGradient id={`${p}-faixa`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={AMARELO.claro} />
        <stop offset="1" stopColor={AMARELO.escuro} />
      </linearGradient>
      <radialGradient id={`${p}-iris`} cx="0.45" cy="0.4" r="0.6">
        <stop offset="0" stopColor="#7a4a22" />
        <stop offset="0.7" stopColor="#3d2310" />
        <stop offset="1" stopColor="#1c0f06" />
      </radialGradient>
      <linearGradient id={`${p}-bico`} x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor={BICO.brilho} />
        <stop offset="0.35" stopColor={BICO.base} />
        <stop offset="1" stopColor={BICO.escuro} />
      </linearGradient>
      <linearGradient id={`${p}-bico-inferior`} x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor={BICO.base} />
        <stop offset="1" stopColor={BICO.escuro} />
      </linearGradient>
      <linearGradient id={`${p}-pe`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a5f6a" />
        <stop offset="1" stopColor="#2a2d34" />
      </linearGradient>
      <linearGradient id={`${p}-galho`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b07d4b" />
        <stop offset="0.45" stopColor="#8a5a2e" />
        <stop offset="1" stopColor="#4e3018" />
      </linearGradient>
      <radialGradient id={`${p}-sombra`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#0b1f3d" stopOpacity="0.35" />
        <stop offset="1" stopColor="#0b1f3d" stopOpacity="0" />
      </radialGradient>
      <clipPath id={`${p}-olho`}>
        <ellipse cx="134" cy="50" rx="6.5" ry="6.1" />
      </clipPath>
    </defs>
  );
}

function Cauda({ p }: { p: string }) {
  return (
    <g className="mascote__cauda">
      <path
        d="M 98 140 C 88 162 68 184 40 198 C 47 200 56 199 63 195 C 86 182 104 166 116 148 Z"
        fill={`url(#${p}-cauda)`}
      />
      <path
        d="M 104 146 C 96 164 82 182 60 196 C 66 196 71 194 75 191 C 92 180 106 164 114 150 Z"
        fill={AZUL.medio}
        opacity="0.75"
      />
      <path
        d="M 103 150 C 92 168 76 184 52 197"
        fill="none"
        stroke={AZUL.fundo}
        strokeWidth="0.8"
        opacity="0.55"
      />
    </g>
  );
}

function AsaAberta({ p }: { p: string }) {
  return (
    <g className="mascote__asa-aberta">
      {REMIGES.map(({ d, i }) => (
        <path
          key={i}
          d={d}
          fill={`url(#${p}-asa-aberta)`}
          stroke={AZUL.fundo}
          strokeWidth="0.6"
          strokeOpacity="0.6"
        />
      ))}
      {REMIGES.map(({ raiz, ponta, i }) => (
        <path
          key={`raque-${i}`}
          d={`M ${raiz[0].toFixed(1)} ${raiz[1].toFixed(1)} L ${(ponta[0] * 0.92 + raiz[0] * 0.08).toFixed(1)} ${(ponta[1] * 0.92 + raiz[1] * 0.08).toFixed(1)}`}
          stroke={AZUL.fundo}
          strokeWidth="0.55"
          opacity="0.5"
        />
      ))}
      {SECUNDARIAS.map(({ d, i }) => (
        <path
          key={`sec-${i}`}
          d={d}
          fill={AZUL.medio}
          stroke={AZUL.fundo}
          strokeWidth="0.5"
          strokeOpacity="0.5"
        />
      ))}
      {/* Coberteiras: a parte de cima, mais clara, em escamas. */}
      <path
        d="M 140 118 C 138 100 148 84 162 78 C 170 76 174 82 172 90 C 170 102 160 114 148 120 C 144 122 141 121 140 118 Z"
        fill={`url(#${p}-coberteiras)`}
      />
      <path
        d="M 148 110 q 5 -1 8 -6 M 154 102 q 5 -2 8 -7 M 160 94 q 4 -2 7 -7 M 146 100 q 4 -3 6 -8"
        fill="none"
        stroke={AZUL.escuro}
        strokeWidth="0.7"
        strokeLinecap="round"
        opacity="0.5"
      />
    </g>
  );
}

function Poleiro({ p }: { p: string }) {
  return (
    <g className="mascote__poleiro">
      <ellipse cx="120" cy="168" rx="34" ry="5" fill={`url(#${p}-sombra)`} />
      <path
        d="M 4 176 C 60 170 140 167 198 170 L 198 182 C 140 179 60 181 4 188 Z"
        fill={`url(#${p}-galho)`}
      />
      <path
        d="M 18 178 q 14 -2 26 -1 M 64 175 q 18 -2 30 -1 M 150 174 q 16 0 28 1 M 30 184 q 14 -2 24 -2"
        fill="none"
        stroke="#4e3018"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M 196 169 C 198 172 198 179 196 182"
        stroke="#4e3018"
        strokeWidth="1"
        fill="none"
      />
      {/* Um raminho com duas folhas na ponta esquerda. */}
      <path
        d="M 28 177 C 22 168 18 162 12 158"
        stroke="#6b4423"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 16 161 C 6 160 2 152 4 146 C 12 148 17 154 16 161 Z"
        fill="#2f8a4a"
      />
      <path
        d="M 20 165 C 22 156 30 152 36 153 C 34 160 28 165 20 165 Z"
        fill="#3fa35c"
      />
      <path
        d="M 16 161 C 11 156 7 151 5 147"
        stroke="#1f6636"
        strokeWidth="0.6"
        fill="none"
      />
    </g>
  );
}

function Corpo({ p }: { p: string }) {
  return (
    <g className="mascote__corpo">
      <path
        d="M 138 80 C 158 90 162 120 152 140 C 144 156 128 165 111 163 C 94 161 84 145 85 122 C 86 102 96 86 108 80 C 117 76 129 76 138 80 Z"
        fill={`url(#${p}-corpo)`}
      />
      {/* Penas do peito: escamas discretas. */}
      <path
        d="M 140 100 q 4 3 8 0 M 134 110 q 4 3 8 0 M 144 112 q 4 3 7 0 M 138 122 q 4 3 8 0 M 130 130 q 4 3 8 0 M 142 132 q 3 3 6 0 M 126 142 q 4 3 8 0 M 136 144 q 3 2 6 0 M 118 152 q 4 3 8 0"
        fill="none"
        stroke={AZUL.escuro}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.32"
      />
      <path
        d="M 149 96 C 155 108 155 122 149 134"
        fill="none"
        stroke={AZUL.brilho}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.35"
      />
    </g>
  );
}

function Pes({ p }: { p: string }) {
  const dedos = (x: number) => (
    <g key={x}>
      <path
        d={`M ${x - 3} 152 L ${x - 3} 168 L ${x + 4} 168 L ${x + 4} 152 Z`}
        fill={`url(#${p}-pe)`}
      />
      <path
        d={`M ${x - 2} 168 C ${x - 7} 168 ${x - 9} 172 ${x - 8} 177 M ${x + 2} 168 C ${x + 7} 167 ${x + 10} 171 ${x + 9} 177 M ${x} 169 C ${x} 173 ${x + 1} 176 ${x + 2} 179`}
        stroke={`url(#${p}-pe)`}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${x - 8.5} 176 l -0.5 3 M ${x + 9.5} 176 l 0.3 3 M ${x + 2.2} 178.5 l 0.3 2.6`}
        stroke="#14161a"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d={`M ${x - 2} 156 h 5 M ${x - 2} 160 h 5 M ${x - 2} 164 h 5`}
        stroke="#1b1d22"
        strokeWidth="0.5"
        opacity="0.6"
      />
    </g>
  );
  return <g className="mascote__pes">{[110, 128].map(dedos)}</g>;
}

function AsaFechada({ p }: { p: string }) {
  return (
    <g className="mascote__asa">
      {/* Rêmiges primárias (as mais longas, sobre a cauda). */}
      <path
        d="M 118 120 C 114 142 104 164 88 184 C 86 186 83 185 84 182 C 90 162 96 140 98 120 Z"
        fill={`url(#${p}-primarias)`}
      />
      <path
        d="M 112 132 C 106 152 98 168 88 181 M 106 130 C 100 150 94 164 87 176"
        fill="none"
        stroke={AZUL.fundo}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Secundárias. */}
      <path
        d="M 128 106 C 127 130 118 152 102 170 C 99 172 96 170 97 167 C 103 148 101 128 97 110 Z"
        fill={`url(#${p}-asa)`}
      />
      <path
        d="M 122 124 C 118 140 112 154 103 166 M 115 122 C 112 138 106 152 99 163"
        fill="none"
        stroke={AZUL.fundo}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Coberteiras: o "ombro", mais claro, com a borda em escamas. */}
      <path
        d="M 120 86 C 132 92 136 110 130 124 C 128 128 125 130 122 129 C 118 133 112 133 108 130 C 104 132 99 129 97 125 C 94 108 100 90 120 86 Z"
        fill={`url(#${p}-coberteiras)`}
      />
      <path
        d="M 98 124 q 5 5 10 5 q 5 2 13 -1 q 5 0 8 -4 M 101 112 q 5 4 10 3 q 6 1 11 -2 M 104 100 q 5 4 10 2 q 5 0 9 -3"
        fill="none"
        stroke={AZUL.fundo}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.42"
      />
      <path
        d="M 112 90 C 104 98 101 108 100 118"
        fill="none"
        stroke={AZUL.brilho}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
    </g>
  );
}

function Olho({ p }: { p: string }) {
  return (
    <g className="mascote__olho">
      <ellipse cx="134" cy="50" rx="7.4" ry="7" fill={`url(#${p}-anel)`} />
      <ellipse
        cx="134"
        cy="50"
        rx="7.4"
        ry="7"
        fill="none"
        stroke={AMARELO.escuro}
        strokeWidth="0.6"
      />
      <g clipPath={`url(#${p}-olho)`}>
        <g className="mascote__iris">
          <circle cx="134.5" cy="50" r="3.9" fill={`url(#${p}-iris)`} />
          <circle cx="134.5" cy="50" r="2.05" fill="#0d0703" />
          <circle cx="136" cy="48.3" r="1.2" fill="#ffffff" />
          <circle cx="133.1" cy="51.6" r="0.5" fill="#ffffff" opacity="0.8" />
        </g>
        <g className="mascote__palpebra">
          <rect x="126" y="43" width="16" height="14" fill={AMARELO.base} />
        </g>
      </g>
      <path
        className="mascote__olho-fechado"
        d="M 128.6 50.4 Q 134 54.4 139.4 50.4"
        fill="none"
        stroke="#6b4300"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </g>
  );
}

function Bico({ p }: { p: string }) {
  return (
    <g className="mascote__bico">
      <path
        className="mascote__boca"
        d="M 146 69.5 C 151 69.5 157 70.5 160.5 72.5 C 162.5 76 162.5 81 160 85 C 154 86 149 83 145 79 Z"
        fill="#2b1210"
      />
      <ellipse
        className="mascote__lingua"
        cx="151"
        cy="74.5"
        rx="4.4"
        ry="2.2"
        fill="#6a2b2a"
      />
      <g className="mascote__bico-inferior">
        <path
          d="M 145 69 C 151 69 157 70 160.5 72.5 C 163 76 163 82 160 86 C 157 89 151 89.5 147.5 87.5 C 144.5 86 143 83 143 80 C 142.8 76 143.2 72 145 69 Z"
          fill={`url(#${p}-bico-inferior)`}
        />
        <path
          d="M 147.5 84.5 C 151 86.5 155.5 86 158.5 83"
          fill="none"
          stroke={BICO.brilho}
          strokeWidth="0.8"
          opacity="0.45"
        />
        {/* A faixa amarela na base do bico inferior (a "risada" da arara-azul). */}
        <path
          d="M 142.5 65.5 C 137.5 72 138.5 82 145.5 88.5 C 147 88 147.5 86.8 147 85.8 C 143 80.5 142.8 73.5 146 68.5 Z"
          fill={`url(#${p}-faixa)`}
        />
      </g>
      <g className="mascote__bico-superior">
        <path
          d="M 147 44 C 158 39 171 45 174 58 C 176 70 171 81 163 88 C 161.5 89 160.5 87.5 161.5 86 C 164 80 163 74 159 71 C 155 68.5 150 68.5 146 69.5 C 144 61 144 51 147 44 Z"
          fill={`url(#${p}-bico)`}
        />
        <path
          d="M 150.5 46 C 159 44.5 167 49.5 170 58"
          fill="none"
          stroke="#c9ced6"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.42"
        />
        <path
          d="M 159 71 C 162.5 74 164 80 161.5 86"
          fill="none"
          stroke="#14161a"
          strokeWidth="0.7"
          opacity="0.55"
        />
        <path
          d="M 151.5 54 q 2.6 -0.6 4.5 0.8"
          fill="none"
          stroke="#14161a"
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.45"
        />
      </g>
    </g>
  );
}

function Cabeca({ p }: { p: string }) {
  return (
    <g className="mascote__cabeca-pose">
      <g className="mascote__cabeca">
        <g className="mascote__penas-da-cabeca">
          <path
            d="M 104 46 C 100 40 101 34 105 31 C 107 36 110 39 114 41 Z"
            fill={AZUL.medio}
          />
          <path
            d="M 110 39 C 108 32 111 27 116 25 C 116 30 118 34 121 36 Z"
            fill={AZUL.claro}
          />
          <path
            d="M 118 35 C 117 29 121 24 126 23 C 125 28 126 31 128 34 Z"
            fill={AZUL.medio}
          />
        </g>
        <path
          d="M 98 64 C 96 42 112 28 128 28 C 143 28 153 38 153 52 C 153 66 147 78 134 82 C 117 86 99 80 98 64 Z"
          fill={`url(#${p}-cabeca)`}
        />
        {/* Penas da face e da nuca, sutis. */}
        <path
          d="M 106 54 q 3 3 7 1 M 108 64 q 3 3 7 1 M 117 73 q 3 2 6 0 M 113 43 q 3 2 6 0 M 124 62 q 3 2 6 0"
          fill="none"
          stroke={AZUL.escuro}
          strokeWidth="0.7"
          strokeLinecap="round"
          opacity="0.32"
        />
        <path
          d="M 113 34 C 124 30 138 32 145 38"
          fill="none"
          stroke={AZUL.brilho}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />
        <Olho p={p} />
        <Bico p={p} />
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
            <path
              d={pena(
                [x, y],
                [
                  x + 16 * Math.cos((giro * Math.PI) / 180),
                  y + 16 * Math.sin((giro * Math.PI) / 180),
                ],
                3.6,
              )}
              fill={i === 1 ? AZUL.claro : AZUL.medio}
            />
          </g>
        ))}
      </g>
      <g className="mascote__sono" aria-hidden="true">
        <text className="mascote__z" x="158" y="36">
          z
        </text>
        <text className="mascote__z" x="166" y="28">
          z
        </text>
        <text className="mascote__z" x="174" y="20">
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
      <Gradientes p={p} />
      <g className="mascote__salto">
        <g className="mascote__respiro">
          <Cauda p={p} />
          <g className="mascote__asa-aberta-pose">
            <AsaAberta p={p} />
          </g>
        </g>
        {poleiro ? null : <Pes p={p} />}
      </g>
      {poleiro ? <Poleiro p={p} /> : null}
      <g className="mascote__salto">
        {poleiro ? <Pes p={p} /> : null}
        <g className="mascote__respiro">
          <Corpo p={p} />
          <g className="mascote__asa-pose">
            <AsaFechada p={p} />
          </g>
          <Cabeca p={p} />
        </g>
      </g>
      <Extras />
    </>
  );
}

/* ≤32px: cabeça de perfil, anel amarelo, olho (que pisca) e o bico com a faixa. */
export function DesenhoSimples({ p }: { p: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${p}-s-cabeca`} cx="0.45" cy="0.35" r="0.7">
          <stop offset="0" stopColor={AZUL.claro} />
          <stop offset="1" stopColor={AZUL.base} />
        </radialGradient>
        <clipPath id={`${p}-s-olho`}>
          <circle cx="14.5" cy="12.5" r="3.4" />
        </clipPath>
      </defs>
      <path
        d="M 4 18 C 3 9 9 3 16 3 C 22 3 25 8 25 13 C 25 21 19 28 12 28 C 7 28 4 24 4 18 Z"
        fill={`url(#${p}-s-cabeca)`}
      />
      <path d="M 7 6 C 6 3 8 1 10 1 C 10 3 11 5 12 6 Z" fill={AZUL.medio} />
      <path
        d="M 20.5 14 C 19 17 19.5 21 22 23.5 C 21.5 20 21.5 17 22.5 15 Z"
        fill={AMARELO.base}
      />
      <path
        d="M 22 15 C 25 16 27.5 18 28 21 C 27 24 24.5 25 22.5 24 C 21.5 21 21.5 18 22 15 Z"
        fill={BICO.escuro}
      />
      <path
        d="M 21 9 C 26 7.5 30.5 11 31 16 C 31.3 20 30 23 28 25 C 27.5 22 26.5 19 24.5 17.5 C 23 16.5 21.5 16.5 20.5 16.5 C 20 14 20 11 21 9 Z"
        fill={BICO.base}
      />
      <path
        d="M 22 10 C 25 9.5 28 11.5 29 14"
        fill="none"
        stroke={BICO.brilho}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="14.5" cy="12.5" r="3.9" fill={AMARELO.base} />
      <g clipPath={`url(#${p}-s-olho)`}>
        <g className="mascote__iris">
          <circle cx="14.8" cy="12.5" r="2" fill="#2a1608" />
          <circle cx="15.6" cy="11.7" r="0.7" fill="#ffffff" />
        </g>
        <g className="mascote__palpebra">
          <rect x="10.5" y="8.5" width="8" height="8" fill={AMARELO.base} />
        </g>
      </g>
      <path
        className="mascote__olho-fechado"
        d="M 11.8 12.8 Q 14.5 15 17.2 12.8"
        fill="none"
        stroke="#6b4300"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </>
  );
}
