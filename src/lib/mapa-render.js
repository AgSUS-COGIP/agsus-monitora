/*
  Decisões de renderização do mapa, isoladas do Leaflet para poderem ser
  medidas e testadas.

  POR QUE ESTE FICHEIRO EXISTE

  Medido em 14/09/2026, com os volumes reais (1081 estabelecimentos + 381
  polos), mediana de três corridas num container de 1100x520:

    A.  antes: divIcon + SVG + popup + tooltip    65,6 ms   96,4 ms   5848 nós
    A2. o mesmo, sem os bind prévios              54,4 ms   77,9 ms   5848 nós
    B.  circleMarker em canvas                     7,3 ms    7,6 ms      1 nó
    D.  polígono em canvas, forma preservada      10,2 ms   10,4 ms      1 nó
    E.  depois: cluster por célula + divIcon       1,8 ms    2,8 ms    160 nós

  36 vezes mais rápido na criação, 34 até o layout, e 5848 nós de DOM passam a
  160. Os 96 ms eram *long task* pela definição do Chrome, que é 50 ms; 2,8 ms
  não são — e isso num desktop rápido, sem os tiles a competir.

  O ensaio que produziu estes números está versionado em
  `bench/mapa-render.html`, para que o antes e o depois sejam reproduzíveis por
  quem revê.
*/

/*
  RAIO DA BOLHA DO DSEI

  A curva já era raiz quadrada — o que estava errado era o teto. Com 7 + 18,
  o maior DSEI chegava a 25 px de raio, 50 px de diâmetro, e na visão nacional
  34 bolhas dessas cobrem o território que deviam situar.

  A raiz quadrada é a escolha certa e vale dizer por quê: a área de um círculo
  cresce com o quadrado do raio, logo um raio proporcional à raiz da população
  faz a ÁREA ser proporcional à população. Escalar o raio linearmente, como é
  tentador, exagera os grandes por um fator igual à razão das populações.
*/
export const RAIO_MINIMO = 5;
export const RAIO_MAXIMO = 15;

export function raioDaBolha(
  populacao,
  populacaoMaxima,
  { minimo = RAIO_MINIMO, maximo = RAIO_MAXIMO } = {},
) {
  const pop = Number(populacao) || 0;
  const max = Number(populacaoMaxima) || 0;
  if (max <= 0 || pop <= 0) return minimo;
  const fracao = Math.min(1, Math.sqrt(pop / max));
  return minimo + (maximo - minimo) * fracao;
}

/*
  PONTOS COINCIDENTES — SEM MEXER NA COORDENADA

  O código antigo somava 0,55° à latitude e à longitude para "desempilhar"
  bolhas, o que são cerca de 61 km. Quem lia o mapa via um DSEI a 61 km de onde
  ele está, sem nada a dizer que aquilo era enfeite.

  Aqui o afastamento é em PIXELS e só existe no momento de desenhar um grupo
  expandido. A coordenada real fica intacta no dado; quem desenha converte o
  deslocamento em latlng na hora, com o zoom corrente, e desfaz ao recolher.

  O ângulo áureo distribui os pontos sem alinhamentos visíveis, e o raio cresce
  em anéis para caber grupos grandes — os 57 do ponto `4.596,-60.168`.
*/
const ANGULO_AUREO = 2.399963229728653;

export function posicoesSpiderfy(
  quantidade,
  { raioBase = 34, passo = 13 } = {},
) {
  const total = Math.max(0, Number(quantidade) || 0);
  const posicoes = [];
  for (let i = 0; i < total; i++) {
    const anel = Math.floor(i / 8);
    const raio = raioBase + passo * anel;
    const angulo = i * ANGULO_AUREO;
    posicoes.push({
      x: Math.round(raio * Math.cos(angulo)),
      y: Math.round(raio * Math.sin(angulo)),
    });
  }
  return posicoes;
}

/*
  Agrupa registos que partilham exactamente o mesmo ponto. É o caso (B) da
  auditoria — estabelecimentos genuinamente diferentes na mesma coordenada, que
  não se fundem: mostram-se agrupados e expandem-se a pedido.
*/
export function agruparCoincidentes(registros, casas = 5) {
  const grupos = new Map();
  (registros || []).forEach((r) => {
    if (!Number.isFinite(r?.lat) || !Number.isFinite(r?.lon)) return;
    const chave = `${r.lat.toFixed(casas)},${r.lon.toFixed(casas)}`;
    if (!grupos.has(chave))
      grupos.set(chave, { chave, lat: r.lat, lon: r.lon, registros: [] });
    grupos.get(chave).registros.push(r);
  });
  return [...grupos.values()];
}

/*
  CICLO DE VIDA

  Contado no `legacy-app.js`: 8 `.on(` do Leaflet contra zero `.off(`, e 23
  `addEventListener` contra 3 `removeEventListener`. Há um `ResizeObserver`,
  criado uma vez por mapa e nunca desconectado.

  Uma correção ao primeiro diagnóstico desta rodada: esse observador **não**
  cresce a cada troca de DSEI. `observeLeafletSize` é chamada duas vezes ao
  todo, dentro de inicializações guardadas por `_mapInited` e
  `_detailMapInited`, portanto o array fica em 2. É dívida de ciclo de vida,
  não vazamento sem teto — e dizer o contrário seria alarme falso.

  O custo real da troca de DSEI é outro, e está medido: a reconstrução completa
  dos 1462 marcadores, 96 ms de cada vez.

  Um registo de descarte resolve isto sem obrigar quem chama a lembrar-se de
  cada um: regista-se o que foi criado, e `descartarTudo()` desfaz na ordem
  inversa.
*/
export function criarRegistroDeDescarte() {
  const acoes = [];

  return {
    /** Regista uma função de limpeza qualquer. */
    aoDescartar(fn) {
      if (typeof fn === "function") acoes.push(fn);
      return fn;
    },

    observarTamanho(elemento, callback) {
      if (typeof ResizeObserver !== "function" || !elemento) return null;
      const observador = new ResizeObserver(callback);
      observador.observe(elemento);
      acoes.push(() => observador.disconnect());
      return observador;
    },

    ouvir(alvo, evento, handler, opcoes) {
      if (!alvo?.addEventListener) return null;
      alvo.addEventListener(evento, handler, opcoes);
      acoes.push(() => alvo.removeEventListener(evento, handler, opcoes));
      return handler;
    },

    /** Ouvinte do Leaflet, que usa `on`/`off` em vez do DOM. */
    ouvirMapa(mapa, evento, handler) {
      if (!mapa?.on) return null;
      mapa.on(evento, handler);
      acoes.push(() => mapa.off?.(evento, handler));
      return handler;
    },

    get pendentes() {
      return acoes.length;
    },

    descartarTudo() {
      let desfeitas = 0;
      while (acoes.length) {
        const acao = acoes.pop();
        try {
          acao();
          desfeitas++;
        } catch {
          // Uma limpeza que falha não pode impedir as seguintes.
        }
      }
      return desfeitas;
    },
  };
}

/*
  RECONSTRUÇÃO DIFERENCIAL

  `clearLayers()` aparece 24 vezes no `legacy-app.js`: qualquer filtro ou clique
  deitava fora a camada inteira e reconstruía tudo. Com 1462 pontos a 180 ms por
  reconstrução, é o custo repetido a cada interação.

  Esta função diz se vale a pena reconstruir: compara a assinatura do que está
  desenhado com a do que se quer desenhar. Igual, não se mexe.
*/
export function assinaturaDeCamada(registros) {
  if (!Array.isArray(registros)) return "";
  const partes = registros.map(
    (r) =>
      `${r?.cnes || r?.name || ""}|${r?.lat ?? ""}|${r?.lon ?? ""}|${r?.type?.key || ""}`,
  );
  return `${partes.length}:${partes.join(";")}`;
}

/*
  AGRUPAMENTO POR CÉLULA — A DECISÃO MEDIDA

  Três caminhos foram medidos com os volumes reais, mediana de três corridas
  (o ensaio está em `bench/mapa-render.html`):

    A.  atual, divIcon + SVG + popup + tooltip     65,6 ms   5848 nós
    A2. o mesmo, sem os bind prévios               54,4 ms   5848 nós
    B.  circleMarker em canvas                      7,3 ms      1 nó
    D.  polígono em canvas, forma preservada       10,2 ms      1 nó
    E.  cluster por célula + divIcon                1,8 ms    160 nós

  Duas conclusões que mudaram o desenho:

  Tirar os `bind` poupa só 21% (65,6 → 54,4). O custo é o DOM, não as ligações
  — a hipótese óbvia estava errada.

  E vence o canvas, e por uma razão estrutural: ataca o número de marcadores em
  vez do custo de cada um. 1462 pontos tornam-se 79 marcadores no zoom nacional.
  E como continua a usar `divIcon`, **as formas sobrevivem** — círculo, casa,
  cruz e losango, que existem para quem não distingue as cores. O canvas seria
  mais rápido por marcador e teria custado essa informação.

  Por isso não há migração de renderer nesta rodada. MapLibre resolveria um
  problema que 1,8 ms já não tem.

  A célula é medida em PIXELS do ecrã, não em graus: agrupar por graus juntaria
  demais perto do equador e de menos no sul.
*/
export const CELULA_PADRAO_PX = 60;

export function agruparPorCelula(
  registros,
  paraPonto,
  celula = CELULA_PADRAO_PX,
) {
  const grupos = new Map();
  (registros || []).forEach((registro) => {
    if (!Number.isFinite(registro?.lat) || !Number.isFinite(registro?.lon))
      return;
    const ponto = paraPonto(registro);
    if (!ponto || !Number.isFinite(ponto.x) || !Number.isFinite(ponto.y))
      return;
    const chave = `${Math.floor(ponto.x / celula)}:${Math.floor(ponto.y / celula)}`;
    if (!grupos.has(chave))
      grupos.set(chave, { chave, registros: [], lat: 0, lon: 0 });
    grupos.get(chave).registros.push(registro);
  });

  /*
    A âncora do grupo é a média das coordenadas REAIS dos seus membros — não um
    ponto inventado nem a coordenada de um deles promovida a representante. Um
    grupo de um só fica exactamente onde o registo está.
  */
  return [...grupos.values()].map((g) => {
    const n = g.registros.length;
    return {
      ...g,
      lat: g.registros.reduce((s, r) => s + r.lat, 0) / n,
      lon: g.registros.reduce((s, r) => s + r.lon, 0) / n,
      quantidade: n,
      unico: n === 1 ? g.registros[0] : null,
    };
  });
}
