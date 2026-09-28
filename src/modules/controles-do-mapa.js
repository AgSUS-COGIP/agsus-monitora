/*
  OS CONTROLES DO MAPA NACIONAL (SAÚDE INDÍGENA)

  Os botões "Brasil" e "Calor" e a legenda recolhível, que `legacy-app.js`
  põe dentro do Leaflet. Ficam aqui, fora do legado, para serem testáveis sem
  montar o mapa.

  - Os botões tinham emoji no rótulo ("🗺️ Brasil", "🔥 Calor"). O Design
    System (seção 14) pede Lucide, 16px, decorativo: o ícone sai do registro
    `icones.js` e quem nomeia o botão continua a ser o texto.
  - A legenda ocupava metade do mapa num celular. Agora é recolhível: o título
    é um botão com `aria-expanded`, e ela começa fechada abaixo de 768px.
    O controle é criado uma vez; o legado só reescreve o título e o corpo ao
    trocar Brasil/DSEI, e o estado aberto/fechado fica.
*/
import { criarIcone } from "./icones.js";

export const LARGURA_MINIMA_DA_LEGENDA_ABERTA = 768;

/** A legenda começa aberta no desktop e fechada no celular (< 768px). */
export function legendaComecaAberta(largura) {
  const numero = Number(largura);
  if (!Number.isFinite(numero)) return true;
  return numero >= LARGURA_MINIMA_DA_LEGENDA_ABERTA;
}

/** Botão do mapa com ícone Lucide de 16px e o rótulo em texto. */
export function criarBotaoDoMapa(documento, { icone, rotulo, classe = "" }) {
  const botao = documento.createElement("button");
  botao.type = "button";
  botao.className = ["health-map-botao", classe].filter(Boolean).join(" ");
  const texto = documento.createElement("span");
  texto.textContent = rotulo;
  botao.append(criarIcone(icone, { tamanho: 16 }), texto);
  return botao;
}

let sequencia = 0;

/*
  Monta o cabeçalho (botão) e o corpo da legenda dentro de `caixa` e devolve
  os dois pontos que o legado preenche: `titulo` e `corpo`.
*/
export function montarLegendaRecolhivel(caixa, { largura } = {}) {
  const documento = caixa.ownerDocument;
  sequencia += 1;
  const idDoCorpo = `health-map-legenda-corpo-${sequencia}`;

  const botao = documento.createElement("button");
  botao.type = "button";
  botao.className = "health-map-legenda__alternar";
  botao.setAttribute("aria-controls", idDoCorpo);

  const titulo = documento.createElement("span");
  titulo.className = "health-map-legenda__titulo";
  titulo.dataset.legendaTitulo = "";
  titulo.textContent = "Legenda";

  const corpo = documento.createElement("div");
  corpo.id = idDoCorpo;
  corpo.className = "health-map-legenda__corpo";
  corpo.dataset.legendaCorpo = "";

  const aplicar = (aberta) => {
    botao.setAttribute("aria-expanded", aberta ? "true" : "false");
    corpo.hidden = !aberta;
    const chevron = criarIcone(aberta ? "chevron-up" : "chevron-down", {
      tamanho: 16,
    });
    const anterior = botao.querySelector(".icone");
    if (anterior) anterior.replaceWith(chevron);
    else botao.append(chevron);
  };

  botao.append(titulo);
  botao.addEventListener("click", () => {
    aplicar(botao.getAttribute("aria-expanded") !== "true");
  });

  caixa.classList.add("health-map-legenda");
  caixa.replaceChildren(botao, corpo);
  aplicar(legendaComecaAberta(largura));
  return { botao, titulo, corpo };
}
