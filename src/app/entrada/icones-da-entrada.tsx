import type { ReactNode } from "react";

/*
  Os desenhos da tela de acesso, em SVG embutido e com tamanho fixo: não
  dependem de fonte de ícones nem de CSS que chega depois, então ocupam o
  mesmo espaço do primeiro quadro em diante (o cartão provisório do
  index.html repete estes mesmos SVGs). O "G" é o do Google, nas quatro
  cores da marca; o gráfico e o escudo são os do Lucide (chart-line,
  shield-check), em traço.
*/

export function MarcaDoGoogle() {
  return (
    <svg
      className="gmark"
      viewBox="0 0 48 48"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type PropriedadesDoTraco = { className: string; tamanho: number };

function Traco({
  className,
  tamanho,
  children,
}: PropriedadesDoTraco & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** O gráfico ao lado de "MONITORA" no lockup. */
export function IconeDoMonitora() {
  return (
    <Traco className="login-product-icon" tamanho={30}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="m19 9-5 5-4-4-3 3" />
    </Traco>
  );
}

/** O escudo do rodapé institucional. */
export function IconeDeEscudo() {
  return (
    <Traco className="login-instituicao-icone" tamanho={16}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </Traco>
  );
}
