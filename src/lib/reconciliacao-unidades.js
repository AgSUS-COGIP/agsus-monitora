/*
  Reconciliação entre as duas fontes do mapa — camada de LEITURA.

  O PROBLEMA

  O mesmo polo base existe nas duas fontes com nomes diferentes: `XITEI` no
  `lmap` e `POLO BASE XITEI` no `rede_cnes`. Medido em 14/09/2026 sobre os dados
  reais: **166 pares** com o mesmo nome canónico dentro do mesmo DSEI, dos quais
  163 são polo contra polo. E nenhum polo do `lmap` tem coordenada igual à do
  CNES, portanto a deduplicação que existia — por `nome|lat|lon` — nunca casava
  nada. O mapa desenhava os dois.

  A distância entre as duas fontes, nesses 166 pares:

      20 pares  a menos de  5 km
      57 pares  entre 5 e  50 km
      89 pares  a mais de  50 km

  O QUE ESTE MÓDULO FAZ, E O QUE NÃO FAZ

  Junta os dois registos num só marcador, preservando **tudo**: o CNES, o `cod`
  do `lmap`, o nome original de cada fonte e as duas coordenadas. Não apaga, não
  escolhe uma identidade em detrimento da outra, e não escreve no banco.

  Não funde:

    - registos de DSEIs diferentes, nunca — `SANTA MARIA`, `SÃO FRANCISCO` e
      `TUCUMÃ` existem em vários DSEIs, e casar por nome globalmente juntaria
      lugares a milhares de quilómetros;
    - polo base com UBSI ou posto — mesmo com o nome idêntico, são estruturas
      diferentes, e fundi-las apagaria uma delas do mapa;
    - por substring. `ANTA` está dentro de `CANTAGALO`. A igualdade tem de ser
      do nome canónico inteiro.

  Quando há mais de um candidato compatível, **não adivinha**: devolve o caso na
  lista de ambíguos, para decisão humana.

  O QUE ESTE MÓDULO NÃO RESOLVE

  Estabelecimentos genuinamente diferentes que partilham a mesma coordenada — o
  caso dos 57 no mesmo ponto, descrito em `docs/auditoria-geografica.md`. Isso
  não é duplicação de entidade e não se resolve fundindo: resolve-se no desenho,
  com agrupamento. Ver `agruparPorPontoDeRender` no fim deste ficheiro.
*/

export const RECONCILIACAO = Object.freeze({
  AUTOMATICA: "automatica",
  AMBIGUA: "ambigua",
  REJEITADA: "rejeitada",
});

export const DIVERGENCIA = Object.freeze({
  PROXIMA: "proxima",
  DIVERGENTE: "divergente",
  PENDENTE: "pendente_validacao",
});

/*
  OS LIMIARES, E POR QUE ESTES

  Não são verdade oficial — são convenções de triagem, e a distribuição real
  não oferece nenhum corte natural: 20/57/89 é praticamente plana. O que se
  pode justificar é o piso.

  5 km. Uma coordenada com duas casas decimais tem erro de arredondamento até
  cerca de 1,57 km na diagonal (0,01° de latitude ≈ 1,11 km). Cinco quilómetros
  são mais de três vezes isso, e ainda absorvem a diferença habitual entre a
  aldeia e a sede do município que a atende. Abaixo disso, a divergência não
  distingue duas localizações: distingue duas maneiras de arredondar a mesma.

  50 km. Aqui não há justificação física, e seria desonesto fingir que há. É um
  limiar de PRIORIZAÇÃO: acima dele, a hipótese de as duas fontes descreverem o
  mesmo sítio deixa de ser sustentável sem alguém olhar. Os 89 pares nesta faixa
  são a fila de trabalho da validação, não um veredito.

  Quem quiser outro corte muda aqui, e o relatório recalcula.
*/
export const LIMIAR_PROXIMA_KM = 5;
export const LIMIAR_PENDENTE_KM = 50;

const semAcento = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/*
  Nome canónico: tira o que descreve o TIPO e mantém o que nomeia o LUGAR.
  `POLO BASE XITEI` e `XITEI` convergem; `CASA NOVA` e `POLO BASE CASA NOVA`
  também.
*/
export function nomeCanonico(nome) {
  let u = semAcento(nome).toUpperCase();
  u = u.replace(/\([^)]*\)/g, " ");
  u = u.replace(
    /\b(POLO|POLOS|BASE|DSEI|DISTRITO|SANITARIO|ESPECIAL|INDIGENA|UBSI|UBS|CASAI|CASA|SAUDE|POSTO|UNIDADE|BASICA|APOIO|TIPO)\b/g,
    " ",
  );
  u = u.replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g, " ");
  return u
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Um canónico curto demais não identifica nada. `POLO BASE I` reduz-se a `I`, e
  casar por `I` juntaria tudo o que tem um algarismo romano no nome.
*/
const MIN_CANONICO = 3;
export const canonicoUtilizavel = (c) => Boolean(c) && c.length >= MIN_CANONICO;

/*
  Tipo declarado pelo NOME do registo, que é a única informação de tipo que o
  payload traz. Deliberadamente conservador: o que não se reconhece é `outro`, e
  `outro` não reconcilia com nada.
*/
export function tipoDeclarado(nome) {
  const u = semAcento(nome).toUpperCase();
  if (/\bCASAI\b|CASA DE SAUDE/.test(u)) return "casai";
  if (/\bPOLO\b/.test(u)) return "polo";
  if (/\bUBSI\b|UNIDADE BASICA/.test(u)) return "ubsi";
  if (/\bPOSTO\b/.test(u)) return "posto";
  return "outro";
}

/*
  Compatibilidade de tipo. A tabela é curta de propósito: só o que é a mesma
  estrutura com nome diferente nas duas fontes. Polo com UBSI não entra, mesmo
  com o nome igual — foi assim que a lógica antiga colou um polo sobre uma
  unidade que apenas o atende.
*/
export function tiposCompativeis(tipoLmap, tipoCnes) {
  if (tipoLmap === "polo") return tipoCnes === "polo";
  if (tipoLmap === "casai") return tipoCnes === "casai";
  return false;
}

export function distanciaKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function classificarDivergencia(km) {
  if (km == null) return DIVERGENCIA.PENDENTE;
  if (km < LIMIAR_PROXIMA_KM) return DIVERGENCIA.PROXIMA;
  if (km <= LIMIAR_PENDENTE_KM) return DIVERGENCIA.DIVERGENTE;
  return DIVERGENCIA.PENDENTE;
}

/*
  A COORDENADA DE EXIBIÇÃO — REGRA EXPLÍCITA

  Vence sempre a do `rede_cnes`. Não porque seja mais exata — ninguém verificou
  isso —, mas porque é a única das duas com procedência declarada: veio de um
  ficheiro do CNES, com código de estabelecimento. A do `lmap` entrou no sistema
  por fora da aplicação e não há registo de quem a pôs lá nem de que fonte.

  Entre uma coordenada rastreável e uma anónima, exibir a rastreável é a escolha
  defensável. A outra não se perde: fica em `coordenadas.lmap`, e a distância
  entre as duas fica no próprio registo.
*/
function coordenadaDeExibicao(polo, estab) {
  return { lat: estab.lat, lon: estab.lon, fonte: "rede_cnes" };
}

/**
 * Reconcilia os polos de um DSEI com os estabelecimentos do mesmo DSEI.
 *
 * Trabalha SEMPRE dentro de um único DSEI: a função recebe já as duas listas
 * daquele distrito, e não tem como cruzar fronteira nenhuma.
 *
 * @param {object} entrada
 * @param {string} entrada.dseiChave
 * @param {Array}  entrada.polos            registos do `lmap`
 * @param {Array}  entrada.estabelecimentos registos do `rede_cnes`
 * @returns {{reconciliados: Array, ambiguos: Array, rejeitados: Array,
 *            polosSemPar: Array, estabelecimentosUsados: Set<string>}}
 */
export function reconciliarDsei({
  dseiChave,
  polos = [],
  estabelecimentos = [],
}) {
  const reconciliados = [];
  const ambiguos = [];
  const rejeitados = [];
  const polosSemPar = [];
  const estabelecimentosUsados = new Set();

  // Índice por nome canónico, dentro deste DSEI e só dele.
  const porCanonico = new Map();
  estabelecimentos.forEach((e) => {
    const c = nomeCanonico(e.nome);
    if (!canonicoUtilizavel(c)) return;
    if (!porCanonico.has(c)) porCanonico.set(c, []);
    porCanonico.get(c).push(e);
  });

  polos.forEach((p) => {
    const canonico = nomeCanonico(p.nome);
    const tipoP = p.tipo || "polo";

    if (!canonicoUtilizavel(canonico)) {
      polosSemPar.push({ polo: p, motivo: "nome canónico curto demais" });
      return;
    }

    const mesmosNomes = porCanonico.get(canonico) || [];
    if (!mesmosNomes.length) {
      polosSemPar.push({ polo: p, motivo: "sem par de mesmo nome no DSEI" });
      return;
    }

    const compativeis = mesmosNomes.filter((e) =>
      tiposCompativeis(tipoP, tipoDeclarado(e.nome)),
    );

    if (!compativeis.length) {
      rejeitados.push({
        dsei: dseiChave,
        canonico,
        polo: p,
        candidatos: mesmosNomes,
        motivo: `nome bate, mas nenhum candidato é do tipo ${tipoP}`,
      });
      return;
    }

    if (compativeis.length > 1) {
      ambiguos.push({
        dsei: dseiChave,
        canonico,
        polo: p,
        candidatos: compativeis,
        motivo: `${compativeis.length} estabelecimentos do mesmo tipo e nome no DSEI`,
      });
      return;
    }

    const e = compativeis[0];
    const km = distanciaKm(p.lat, p.lon, e.lat, e.lon);
    const exibicao = coordenadaDeExibicao(p, e);

    estabelecimentosUsados.add(e.chave);
    reconciliados.push({
      dsei: dseiChave,
      canonico,
      tipo: tipoP,
      nome_exibicao: e.nome || p.nome,
      nomes: { lmap: p.nome, rede_cnes: e.nome },
      cnes: e.cnes || "",
      cod: p.cod ?? null,
      origens: ["lmap", "rede_cnes"],
      lat: exibicao.lat,
      lon: exibicao.lon,
      coordenada_exibida: exibicao.fonte,
      coordenadas: {
        lmap: { lat: p.lat, lon: p.lon },
        rede_cnes: { lat: e.lat, lon: e.lon },
      },
      distancia_entre_fontes_km: km == null ? null : Number(km.toFixed(1)),
      divergencia: classificarDivergencia(km),
      municipio: e.municipio || "",
      uf: e.uf || p.uf || "",
      reconciliacao: RECONCILIACAO.AUTOMATICA,
    });
  });

  return {
    reconciliados,
    ambiguos,
    rejeitados,
    polosSemPar,
    estabelecimentosUsados,
  };
}

/*
  AGRUPAMENTO DE RENDER — o caso (B), que NÃO é duplicação de entidade.

  Estabelecimentos genuinamente diferentes na mesma coordenada continuam a ser
  registos distintos e têm de continuar a existir. O que não podem é ficar um
  por cima do outro sem que se saiba que estão lá.

  Esta função só agrupa para desenho: devolve os pontos e quem está em cada um,
  sem tocar nas coordenadas de ninguém. Quem desenha decide se usa cluster,
  spiderfy ou um marcador com contagem.
*/
export function agruparPorPontoDeRender(registros, casasDecimais = 5) {
  const pontos = new Map();
  registros.forEach((r) => {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return;
    const chave = `${r.lat.toFixed(casasDecimais)},${r.lon.toFixed(casasDecimais)}`;
    if (!pontos.has(chave))
      pontos.set(chave, { chave, lat: r.lat, lon: r.lon, registros: [] });
    pontos.get(chave).registros.push(r);
  });
  return [...pontos.values()];
}
