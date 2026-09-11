/*
  Um dono só para recolher a barra lateral.

  Havia dois controles para a mesma ação. No desktop valia o hambúrguer do
  cabeçalho, `#hambToggle`; o flutuante `#globalSidebarToggle` ficava escondido
  por `system-ui-fixes.css`. Em telas estreitas os papéis se invertiam. E dentro
  de um painel externo o cabeçalho some, levando o hambúrguer junto — não sobrava
  nenhum, que foi o defeito corrigido no #176.

  Agora o `#globalSidebarToggle` é o único controle, em toda largura e em todo
  modo. O `#hambToggle` sai de cena pelo CSS. Um elemento, um `id`, um
  `toggleSidebar()`, um estado — `aria-expanded`, título e persistência
  continuam sendo escritos por `syncSidebarToggle()`, que encontra o botão pelo
  `id` e não se importa com onde ele está.

  Onde ele fica depende da largura, e isso não é preferência estética: é física
  de layout. Medido no preview em 11/09/2026, a 390x844, a barra lateral é
  `position: fixed` com `transform: translateX(-105%)` — fora da tela. Um
  `transform` faz do elemento o bloco de contenção dos descendentes fixos, então
  um botão dentro da barra sai da tela junto com ela e fica inalcançável
  justamente quando é preciso: com a gaveta fechada.

  Por isso o nó é movido, não duplicado:

    largura > 900   -> dentro da barra, logo abaixo da marca
    largura <= 900  -> dentro do `.title-row`, na vaga que o hambúrguer deixou

  No estreito não vale flutuar sobre o cabeçalho: medido, `.top` tem
  `z-index: 10030` e as próprias ações dele ficam em `20,33` — um botão fixo no
  canto superior esquerdo nasce coberto. A vaga do hambúrguer é livre, está no
  fluxo e é onde a pessoa já procurava o controle.

  Mover preserva `id`, `onclick` e ouvintes; recriar não preservaria nada disso.
*/

const LARGURA_DE_GAVETA = 900;
const ESPERA_DO_REDIMENSIONAMENTO = 150;

export const DESTINO_BARRA = "sidebar";
export const DESTINO_CABECALHO = "cabecalho";

export function destinoDoColapsar(largura) {
  return Number(largura) > LARGURA_DE_GAVETA
    ? DESTINO_BARRA
    : DESTINO_CABECALHO;
}

/*
  Devolve onde o botão ficou, ou `null` quando não há botão nem destino — assim
  quem chama consegue afirmar alguma coisa sem inspecionar o DOM.
*/
export function posicionarColapsarDaSidebar(
  documento = document,
  largura = globalThis.innerWidth,
) {
  const botao = documento.getElementById("globalSidebarToggle");
  if (!botao) return null;

  const destino = destinoDoColapsar(largura);
  const barra = documento.querySelector(".sidebar");
  const cabecalho = documento.querySelector(".main > header.top .title-row");
  const alvo = destino === DESTINO_BARRA ? barra : cabecalho;
  if (!alvo) return null;

  botao.classList.add("side-collapse-toggle");
  if (botao.parentElement === alvo) return destino;

  if (destino === DESTINO_BARRA) {
    const marca = barra.querySelector(".side-brand");
    if (marca) marca.after(botao);
    else barra.prepend(botao);
    return destino;
  }

  cabecalho.prepend(botao);
  return destino;
}

export function initColapsarDaSidebar() {
  const aplicar = () => posicionarColapsarDaSidebar();
  const posicaoInicial = aplicar();

  let agendado = 0;
  globalThis.addEventListener?.("resize", () => {
    globalThis.clearTimeout(agendado);
    agendado = globalThis.setTimeout(aplicar, ESPERA_DO_REDIMENSIONAMENTO);
  });

  return posicaoInicial;
}
