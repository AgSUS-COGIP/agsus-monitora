/*
  A LEGENDA DAS TERRAS INDÍGENAS, QUE TAMBÉM É O INTERRUPTOR

  Havia duas legendas a descrever as terras, escritas à mão em dois sítios — o
  mapa nacional, em `legacy-app.js`, e o mapa do DSEI, em
  `vinculos-territoriais.js` — e as duas já tinham divergido: uma nomeava as
  três fases, a outra mostrava um quadrado só. As cores de cada uma eram hex
  copiados, e ficaram magenta quando o mapa deixou de o ser.

  Agora as duas montam este módulo. Os rótulos vêm de `FASES_DAS_TERRAS`, na
  camada, e as amostras do CSS deste módulo, que o teste compara com as
  constantes da camada.

  E cada item é um botão: clicar em "Homologada ou regularizada" esconde as
  regularizadas e deixa as que estão em processo — o pedido era exatamente
  esse. `aria-pressed` porque é interruptor, não navegação: o leitor de ecrã
  anuncia "ativado/desativado".

  Construído com a API do DOM, sem `innerHTML`: nada aqui vem do utilizador,
  mas a regra do projeto não abre exceção para o que "parece seguro".
*/
import {
  EVENTO_DAS_TERRAS,
  FASES_DAS_TERRAS,
} from "./indigenous-territories-layer.js";

export const TITULO_DA_LEGENDA = "Terras Indígenas (Funai)";

/*
  As legendas montadas, por mapa. O mapa nacional reescreve a caixa da legenda
  a cada troca de nível; em vez de pendurar um ouvinte novo no mapa a cada
  reescrita, há um só por mapa, e ele atualiza as legendas que ainda estão no
  documento.
*/
const LEGENDAS = new WeakMap();

function sincronizar(map) {
  const alvos = LEGENDAS.get(map);
  if (!alvos) return;
  for (const alvo of [...alvos]) {
    if (!alvo.isConnected) {
      alvos.delete(alvo);
      continue;
    }
    for (const botao of alvo.querySelectorAll("button[data-fase]")) {
      botao.setAttribute(
        "aria-pressed",
        estadoDoInterruptor(map, botao.dataset.fase) ? "true" : "false",
      );
    }
  }
}

/*
  Ligado quando a fase está a ser desenhada. Sem a camada instalada não há o
  que desligar, e o item fica como legenda simples, ligado.
*/
export function estadoDoInterruptor(map, fase) {
  const consulta = map?.__agsusFaseDaTerraVisivel;
  return typeof consulta === "function" ? consulta(fase) !== false : true;
}

export function montarLegendaDasTerras(alvo, map) {
  const documento = alvo?.ownerDocument;
  if (!alvo || !documento) return false;

  alvo.replaceChildren();
  alvo.classList.add("legenda-das-terras");

  const titulo = documento.createElement("span");
  titulo.className = "legenda-das-terras__titulo";
  titulo.textContent = TITULO_DA_LEGENDA;
  alvo.append(titulo);

  const interativa = typeof map?.__agsusAlternarFaseDaTerra === "function";

  for (const { fase, rotulo } of FASES_DAS_TERRAS) {
    const botao = documento.createElement("button");
    botao.type = "button";
    botao.className = "legenda-terra";
    botao.dataset.fase = fase;
    botao.title = interativa
      ? `Mostrar ou esconder no mapa: ${rotulo}`
      : rotulo;
    botao.disabled = !interativa;
    botao.setAttribute(
      "aria-pressed",
      estadoDoInterruptor(map, fase) ? "true" : "false",
    );

    const amostra = documento.createElement("i");
    amostra.className = `legenda-terra__amostra legenda-terra__amostra--${fase}`;
    amostra.setAttribute("aria-hidden", "true");

    const texto = documento.createElement("span");
    texto.textContent = rotulo;

    botao.append(amostra, texto);
    botao.addEventListener("click", (evento) => {
      // A legenda nacional mora dentro do mapa: o clique não pode virar clique no mapa.
      evento.stopPropagation();
      map.__agsusAlternarFaseDaTerra(fase);
    });
    alvo.append(botao);
  }

  // Idem para o arrasto e a roda: mexer na legenda não pode mexer o mapa.
  globalThis.L?.DomEvent?.disableClickPropagation?.(alvo);
  globalThis.L?.DomEvent?.disableScrollPropagation?.(alvo);

  if (map && interativa) {
    if (!LEGENDAS.has(map)) {
      LEGENDAS.set(map, new Set());
      map.on?.(EVENTO_DAS_TERRAS, () => sincronizar(map));
    }
    LEGENDAS.get(map).add(alvo);
  }
  return true;
}
