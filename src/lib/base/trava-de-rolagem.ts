/*
  A rolagem da página fica travada enquanto algo cobre a tela: a tela cheia
  do mapa, o modo de edição de coordenadas, a busca global. Contada: mais de
  um pode estar ligado ao mesmo tempo (a busca aberta sobre o mapa em tela
  cheia), e a página só volta a rolar — com o `overflow` que tinha antes —
  quando o último solta. Soltar duas vezes a mesma trava não conta duas.
*/

type Corpo = { style: { overflow: string } };

let travas = 0;
let overflowAnterior = "";

export function travarRolagemDaPagina(
  corpo: Corpo = document.body,
): () => void {
  if (travas === 0) {
    overflowAnterior = corpo.style.overflow;
    corpo.style.overflow = "hidden";
  }
  travas += 1;
  let solta = false;
  return () => {
    if (solta) return;
    solta = true;
    travas -= 1;
    if (travas === 0) corpo.style.overflow = overflowAnterior;
  };
}
