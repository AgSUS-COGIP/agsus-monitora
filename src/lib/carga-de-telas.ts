/*
  Quantas telas carregadas sob demanda (src/app/tela-sob-demanda.js) ainda
  estão baixando. O tour da Aya consulta para esperar a tela pedida aparecer
  antes de desistir do passo. Sem DOM e sem React.
*/
let pendentes = 0;

/** Marca o começo de uma carga; devolve a função que marca o fim (uma vez só). */
export function comecarCargaDeTela(): () => void {
  pendentes += 1;
  let terminou = false;
  return () => {
    if (terminou) return;
    terminou = true;
    pendentes = Math.max(0, pendentes - 1);
  };
}

/** Alguma tela ainda está baixando? */
export function haTelaCarregando(): boolean {
  return pendentes > 0;
}

/*
  Pré-carga ao passar o mouse (ou o foco) no item do menu: quem sabe qual
  controlador baixa cada tela registra a função (src/main.js); a barra
  lateral só chama `preCarregarTela(view, secao)`. Sem registro, nada faz.
*/
type PreCarga = (view: string, secao?: string) => void;

let preCarga: PreCarga | null = null;

export function registrarPreCarga(funcao: PreCarga | null): void {
  preCarga = funcao;
}

export function preCarregarTela(
  view: string | undefined,
  secao?: string,
): void {
  if (!view || !preCarga) return;
  try {
    preCarga(view, secao);
  } catch {
    // Pré-carga é só adiantamento: a abertura tenta de novo.
  }
}
