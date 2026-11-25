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

  Tudo fica dentro de `.mascote__quadro`: no enquadramento "rosto" (a Aya
  fechada) o CSS aproxima o quadro da cabeça e acende os `.mascote__detalhe`
  — penas do rosto em camadas, anel e faixa amarelos com relevo, brilho no
  olho, volume do bico, contorno e a sombra do busto. Pequenos demais para
  aparecer de corpo inteiro, só valem de perto. O "z" do sono fica fora do
  quadro (não cresce junto com a cabeça).

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
/* As luzes e sombras de perto (rosto e brilho do olho), fixas como a ilustração. */
const DE_PERTO = Object.freeze({
  luzAzul: "#7fa8ff",
  luzDaPena: "#5f8fff",
  raque: "#6f9bff",
  luzAmarela: "#fff2a8",
  brilhoDoAnel: "#fff6c4",
  sombraAmarela: "#a96500",
  bordaDaFaixa: "#b07000",
  luzDoBico: "#c9c6d0",
  quinaDoBico: "#e9e7ee",
  luzDaMandibula: "#9a979f",
  sombra: "#000000",
  brilho: "#ffffff",
  aroDaIris: "#1c0f06",
});
const AZUL = CORES_DOS_TONS.azul;
const CINZA = CORES_DOS_TONS.cinza;

/* O olho (da referência): centro do anel, raio da íris, pálpebra. */
const OLHO = Object.freeze({ x: 102.8, y: 29.3 });

const f = (v: number) => v.toFixed(1);

/** Uma pena alongada da raiz à ponta (penas soltas e penas da nuca). */
function pena(
  x: number,
  y: number,
  giro: number,
  comprimento: number,
  largura = 0.22,
) {
  const r = (giro * Math.PI) / 180;
  const dx = Math.cos(r) * comprimento;
  const dy = Math.sin(r) * comprimento;
  const nx = -dy * largura;
  const ny = dx * largura;
  return `M${f(x)} ${f(y)}Q${f(x + dx / 2 + nx)} ${f(y + dy / 2 + ny)} ${f(x + dx)} ${f(y + dy)}Q${f(x + dx / 2 - nx)} ${f(y + dy / 2 - ny)} ${f(x)} ${f(y)}Z`;
}

/** A haste (raque) de uma pena: da raiz até perto da ponta. */
function raque(x: number, y: number, giro: number, comprimento: number) {
  const r = (giro * Math.PI) / 180;
  return `M${f(x)} ${f(y)}L${f(x + Math.cos(r) * comprimento * 0.8)} ${f(y + Math.sin(r) * comprimento * 0.8)}`;
}

const PENAS_SOLTAS = Object.freeze([
  { x: 74, y: 100, giro: 120 },
  { x: 132, y: 118, giro: 60 },
  { x: 100, y: 84, giro: 150 },
]);

/*
  As penas da nuca (arrepiam às vezes): da raiz, escondida atrás da cabeça,
  para trás e para cima; as de baixo, mais escuras (ficam na sombra).
*/
const PENAS_DA_NUCA = Object.freeze([
  { x: 88, y: 44, giro: 194, comprimento: 11.5, tom: 2 },
  { x: 90, y: 38, giro: 205, comprimento: 13, tom: 3 },
  { x: 93.5, y: 32, giro: 217, comprimento: 13, tom: 4 },
  { x: 98, y: 27, giro: 232, comprimento: 11, tom: 5 },
]);

/*
  A textura das penas do rosto: fileiras de pontas de pena (arcos abertos
  para a frente), miúdas no alto da cabeça e maiores para a bochecha; um
  traço de sombra sob cada ponta e um de luz logo acima, com um desvio
  sorteado fixo (não parece escama de peixe). As de baixo saem mais claras
  para não marcar a emenda com o pescoço. Perto do olho e da faixa não há
  (o anel e a faixa cobrem). Calculadas uma vez.
*/
function texturaDasPenas() {
  const camadas = { alto: [[], []], baixo: [[], []] } as Record<
    "alto" | "baixo",
    [string[], string[]]
  >;
  // Sorteio fixo (o mesmo desenho sempre): seno com semente.
  const sorte = (n: number) => {
    const v = Math.sin(n * 12.9898) * 43758.5453;
    return v - Math.floor(v) - 0.5;
  };
  let n = 0;
  for (let linha = 0; linha < 12; linha++) {
    const y0 = 18 + linha * 3;
    const t = (y0 - 18) / 33;
    const passo = 3.6 + t * 1.6;
    for (let x0 = 77 + (linha % 2 ? passo / 2 : 0); x0 < 130; x0 += passo) {
      n += 1;
      const x = x0 + sorte(n) * 1.4;
      const y = y0 + sorte(n + 0.5) * 1.1;
      const tamanho = (1.2 + t * 1.3) * (1 + sorte(n + 0.25) * 0.3);
      if (Math.hypot(x - 102.8, (y - 29.3) * 1.1) < 6.8) continue;
      if (x > 98 && y > 36) continue;
      const [sombra, luz] = camadas[y0 < 40 ? "alto" : "baixo"];
      sombra.push(
        `M${f(x + tamanho * 0.5)} ${f(y - tamanho * 0.85)}Q${f(x - tamanho * 1.05)} ${f(y - tamanho * 0.05)} ${f(x + tamanho * 0.35)} ${f(y + tamanho * 0.8)}`,
      );
      luz.push(
        `M${f(x + tamanho * 0.85)} ${f(y - tamanho * 1.05)}Q${f(x - tamanho * 0.6)} ${f(y - tamanho * 0.35)} ${f(x + tamanho * 0.7)} ${f(y + tamanho * 0.45)}`,
      );
    }
  }
  const juntar = ([sombra, luz]: [string[], string[]]) =>
    Object.freeze({ sombra: sombra.join(""), luz: luz.join("") });
  return Object.freeze({
    alto: juntar(camadas.alto),
    baixo: juntar(camadas.baixo),
  });
}
const TEXTURA = texturaDasPenas();

/* O anel nu em volta do olho: centro e raios (da caixa do contorno `anel`). */
const ANEL = Object.freeze({ x: 102.65, y: 29.3, rx: 4.95, ry: 5.4 });

/* Rugas finas da pele do anel: tracinhos radiais na borda de fora. */
const RUGAS_DO_ANEL = Array.from({ length: 14 }, (_, i) => {
  const r = ((i * 360) / 14 + 8) * (Math.PI / 180);
  const ponto = (k: number) =>
    `${f(ANEL.x + Math.cos(r) * ANEL.rx * k)} ${f(ANEL.y + Math.sin(r) * ANEL.ry * k)}`;
  return `M${ponto(0.84)}L${ponto(0.95)}`;
}).join("");

/* Um arco do anel, de um ângulo a outro (graus), na fração `k` do raio. */
function arcoDoAnel(de: number, ate: number, k: number) {
  const ponto = (g: number) => {
    const r = (g * Math.PI) / 180;
    return `${f(ANEL.x + Math.cos(r) * ANEL.rx * k)} ${f(ANEL.y + Math.sin(r) * ANEL.ry * k)}`;
  };
  return `M${ponto(de)}A${f(ANEL.rx * k)} ${f(ANEL.ry * k)} 0 0 1 ${ponto(ate)}`;
}

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
    "faixa",
  ];
  return (
    <>
      {partes.map((parte) => (
        <clipPath key={parte} id={`${p}-c-${parte}`}>
          <path d={CONTORNOS[parte]} />
        </clipPath>
      ))}
      {/* O busto (corpo e asa fechada), para a sombra de baixo do rosto. */}
      <clipPath id={`${p}-c-busto`}>
        <path d={CONTORNOS.corpo} />
        <path d={CONTORNOS.asa} />
      </clipPath>
      {/* O contorno da cabeça só por fora: sem a emenda com o pescoço. */}
      <clipPath id={`${p}-c-sem-pescoco`}>
        <path d="M60 0H140V40H113L101 51L78 57.5H60Z" />
      </clipPath>
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
        <stop offset="1" stopColor={DE_PERTO.aroDaIris} />
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
      <TonsDoRosto p={p} />
    </>
  );
}

/* Os tons que só o rosto usa (luz da cabeça, relevo da faixa e do bico, busto). */
function TonsDoRosto({ p }: { p: string }) {
  return (
    <>
      <radialGradient
        id={`${p}-luz-cabeca`}
        gradientUnits="userSpaceOnUse"
        cx="106"
        cy="21"
        r="17"
      >
        <stop offset="0" stopColor={DE_PERTO.luzAzul} stopOpacity="0.42" />
        <stop offset="1" stopColor={DE_PERTO.luzAzul} stopOpacity="0" />
      </radialGradient>
      <radialGradient
        id={`${p}-sombra-nuca`}
        gradientUnits="userSpaceOnUse"
        cx="84"
        cy="58"
        r="16"
      >
        <stop offset="0" stopColor={AZUL[0]} stopOpacity="0.5" />
        <stop offset="1" stopColor={AZUL[0]} stopOpacity="0" />
      </radialGradient>
      <linearGradient
        id={`${p}-relevo-faixa`}
        gradientUnits="userSpaceOnUse"
        x1="100"
        y1="38"
        x2="109"
        y2="54"
      >
        <stop offset="0" stopColor={DE_PERTO.luzAmarela} stopOpacity="0.75" />
        <stop offset="0.4" stopColor={DE_PERTO.luzAmarela} stopOpacity="0" />
        <stop offset="0.7" stopColor={DE_PERTO.sombraAmarela} stopOpacity="0" />
        <stop
          offset="1"
          stopColor={DE_PERTO.sombraAmarela}
          stopOpacity="0.55"
        />
      </linearGradient>
      <linearGradient
        id={`${p}-relevo-bico`}
        gradientUnits="userSpaceOnUse"
        x1="114"
        y1="28"
        x2="131"
        y2="60"
      >
        <stop offset="0" stopColor={DE_PERTO.luzDoBico} stopOpacity="0.5" />
        <stop offset="0.35" stopColor={DE_PERTO.luzDoBico} stopOpacity="0" />
        <stop offset="0.7" stopColor={DE_PERTO.sombra} stopOpacity="0" />
        <stop offset="1" stopColor={DE_PERTO.sombra} stopOpacity="0.5" />
      </linearGradient>
      <linearGradient
        id={`${p}-relevo-mandibula`}
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="44"
        x2="0"
        y2="57"
      >
        <stop offset="0" stopColor={DE_PERTO.sombra} stopOpacity="0" />
        <stop offset="1" stopColor={DE_PERTO.sombra} stopOpacity="0.45" />
      </linearGradient>
      <linearGradient
        id={`${p}-busto`}
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="62"
        x2="0"
        y2="88"
      >
        <stop offset="0" stopColor={AZUL[0]} stopOpacity="0" />
        <stop offset="1" stopColor={AZUL[0]} stopOpacity="0.6" />
      </linearGradient>
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
      {/* De perto: borda limpa, rugas finas da pele e a luz no alto. */}
      <g className="mascote__detalhe" fill="none" strokeLinecap="round">
        <path
          d={CONTORNOS.anel}
          stroke={AMARELO.escuro}
          strokeWidth="0.45"
          opacity="0.85"
        />
        <path
          d={RUGAS_DO_ANEL}
          stroke={AMARELO.escuro}
          strokeWidth="0.28"
          opacity="0.55"
        />
        <path
          d={arcoDoAnel(195, 265, 0.9)}
          stroke={DE_PERTO.brilhoDoAnel}
          strokeWidth="0.6"
          opacity="0.85"
        />
        <path
          d={arcoDoAnel(20, 110, 0.9)}
          stroke={DE_PERTO.sombraAmarela}
          strokeWidth="0.5"
          opacity="0.45"
        />
      </g>
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
            fill={DE_PERTO.brilho}
          />
          <circle
            cx={OLHO.x - 0.9}
            cy={OLHO.y + 1.2}
            r="0.35"
            fill={DE_PERTO.brilho}
            opacity="0.7"
          />
          {/* De perto: o aro escuro da íris e o reflexo em meia-lua. */}
          <g className="mascote__detalhe" fill="none" strokeLinecap="round">
            <circle
              cx={OLHO.x + 0.2}
              cy={OLHO.y + 0.1}
              r="3.25"
              stroke={DE_PERTO.aroDaIris}
              strokeWidth="0.35"
              opacity="0.7"
            />
            <path
              d={`M${OLHO.x + 2.6} ${OLHO.y + 0.6}A2.5 2.5 0 0 1 ${OLHO.x + 0.4} ${OLHO.y + 2.6}`}
              stroke={DE_PERTO.brilho}
              strokeWidth="0.45"
              opacity="0.4"
            />
            <circle
              cx={OLHO.x + 1.75}
              cy={OLHO.y - 0.45}
              r="0.3"
              fill={DE_PERTO.brilho}
              opacity="0.85"
            />
          </g>
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

/* De perto: luz no alto da cabeça, sombra na nuca, penas em camadas e contorno. */
function DetalhesDaCabeca({ p }: { p: string }) {
  return (
    <g className="mascote__detalhe">
      <g clipPath={`url(#${p}-c-cabeca)`}>
        <rect
          x="76"
          y="15"
          width="56"
          height="50"
          fill={`url(#${p}-luz-cabeca)`}
        />
        <rect
          x="76"
          y="15"
          width="56"
          height="50"
          fill={`url(#${p}-sombra-nuca)`}
        />
        {(["alto", "baixo"] as const).map((camada) => (
          <g
            key={camada}
            fill="none"
            strokeLinecap="round"
            opacity={camada === "alto" ? 1 : 0.55}
          >
            <path
              d={TEXTURA[camada].sombra}
              stroke={AZUL[0]}
              strokeWidth="0.4"
              opacity="0.3"
            />
            <path
              d={TEXTURA[camada].luz}
              stroke={DE_PERTO.luzDaPena}
              strokeWidth="0.3"
              opacity="0.26"
            />
          </g>
        ))}
      </g>
      <g clipPath={`url(#${p}-c-sem-pescoco)`}>
        <path
          className="mascote__contorno"
          d={CONTORNOS.cabeca}
          fill="none"
          strokeWidth="0.55"
        />
      </g>
    </g>
  );
}

function Cabeca({ p }: { p: string }) {
  return (
    <g className="mascote__cabeca-pose">
      <g className="mascote__cabeca">
        {/* Penas da nuca: arrepiam às vezes. */}
        <g className="mascote__penas-da-cabeca">
          {PENAS_DA_NUCA.map(({ x, y, giro, comprimento, tom }) => (
            <path
              key={giro}
              d={pena(x, y, giro, comprimento, 0.42)}
              fill={AZUL[tom]}
            />
          ))}
          <path
            className="mascote__detalhe"
            d={PENAS_DA_NUCA.map(({ x, y, giro, comprimento }) =>
              raque(x, y, giro, comprimento),
            ).join("")}
            fill="none"
            stroke={DE_PERTO.raque}
            strokeWidth="0.35"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>
        <Parte p={p} parte="cabeca" />
        <DetalhesDaCabeca p={p} />
        <path d={CONTORNOS.faixa} fill={`url(#${p}-anel)`} />
        <g className="mascote__detalhe">
          <g clipPath={`url(#${p}-c-faixa)`}>
            <rect
              x="99"
              y="37"
              width="11"
              height="18"
              fill={`url(#${p}-relevo-faixa)`}
            />
          </g>
          <path
            d="M102.6 41.5q2.1 3.6 1.3 8.2M105.3 40.2q2.3 4.1 1.7 9.6"
            fill="none"
            stroke={AMARELO.escuro}
            strokeWidth="0.3"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d={CONTORNOS.faixa}
            fill="none"
            stroke={DE_PERTO.bordaDaFaixa}
            strokeWidth="0.4"
            opacity="0.7"
          />
        </g>
        <Olho p={p} />
        <g className="mascote__bico">
          <path className="mascote__boca" d={CONTORNOS.boca} fill="#2a1512" />
          <g className="mascote__bico-inferior">
            <Parte p={p} parte="bicoInferior" tons="te" />
            <g className="mascote__detalhe">
              <g clipPath={`url(#${p}-c-bicoInferior)`}>
                <rect
                  x="104"
                  y="37"
                  width="21"
                  height="21"
                  fill={`url(#${p}-relevo-mandibula)`}
                />
                <path
                  d="M107.5 52.5q7 2.6 14.5-1.2"
                  fill="none"
                  stroke={DE_PERTO.luzDaMandibula}
                  strokeWidth="0.5"
                  strokeLinecap="round"
                  opacity="0.45"
                />
              </g>
              <path
                className="mascote__contorno"
                d={CONTORNOS.bicoInferior}
                fill="none"
                strokeWidth="0.5"
              />
            </g>
          </g>
          <g className="mascote__bico-superior">
            <Parte p={p} parte="bicoSuperior" tons="te" />
            <g className="mascote__detalhe">
              <g clipPath={`url(#${p}-c-bicoSuperior)`}>
                <rect
                  x="112"
                  y="26"
                  width="22"
                  height="38"
                  fill={`url(#${p}-relevo-bico)`}
                />
                {/* A luz na quina de cima do bico (cúlmen). */}
                <path
                  d="M115.2 31.6Q123.6 27.6 129.6 34.2Q132.2 37.6 132.2 44"
                  fill="none"
                  stroke={DE_PERTO.quinaDoBico}
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  opacity="0.22"
                />
                <path
                  d="M116.4 31Q123.4 28.3 128.6 33.6"
                  fill="none"
                  stroke={DE_PERTO.brilho}
                  strokeWidth="0.45"
                  strokeLinecap="round"
                  opacity="0.55"
                />
              </g>
              <path
                className="mascote__contorno"
                d={CONTORNOS.bicoSuperior}
                fill="none"
                strokeWidth="0.5"
              />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

function PenasSoltas() {
  return (
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
  );
}

/* Fora do quadro: no rosto, o CSS só reposiciona (não cresce com a cabeça). */
function Sono() {
  return (
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
      <g className="mascote__quadro">
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
            {/* De perto: o busto escurece para baixo (o rosto em primeiro plano). */}
            <g
              className="mascote__detalhe mascote__busto"
              clipPath={`url(#${p}-c-busto)`}
            >
              <rect
                x="40"
                y="60"
                width="100"
                height="40"
                fill={`url(#${p}-busto)`}
              />
            </g>
            <Cabeca p={p} />
          </g>
        </g>
        <PenasSoltas />
      </g>
      <Sono />
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
      <g className="mascote__quadro">
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
      </g>
    </>
  );
}
