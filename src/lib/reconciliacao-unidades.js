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

/*
  Distância abaixo da qual dois registos do mesmo tipo, no mesmo distrito, são
  tomados como o mesmo estabelecimento. Duzentos metros é a escala do terreno
  de um equipamento, e absorve a diferença entre um ponto tomado no portão e
  outro no edifício. Acima disso deixa de ser imprecisão de registo e passa a
  ser palpite. Ver a última passagem de `reconciliarDsei`.
*/
export const LIMIAR_MESMO_PONTO_KM = 0.2;

/*
  A coordenada sozinha não chega.

  Coordenadas de preenchimento existem nestes cadastros — o POLO BASE CUCUI
  tinha latitude exatamente 1.000000 — e dois registos diferentes podem cair no
  mesmo ponto por descuido, não por serem o mesmo sítio. Exige-se também uma
  palavra inteira em comum, de quatro letras ou mais.

  É o que separa os casos reais do falso positivo:

      "MACHACALIS"     e "II MACHACALIS"        partilham MACHACALIS  -> une
      "PIAUI AREA II"  e "SAUDE URUCUI AREA II" partilham AREA        -> une
      "ANTA"           e "CANTAGALO"            nada em comum         -> não

  "ANTA" é subcadeia de "CANTAGALO" e não é palavra dela. Comparar por palavra
  inteira, e não por subcadeia, é o que impede esse casamento.
*/
const MIN_PALAVRA = 4;

function partilhamPalavra(nomeA, nomeB) {
  const palavras = (nome) =>
    new Set(
      nomeCanonico(nome)
        .split(" ")
        .filter((palavra) => palavra.length >= MIN_PALAVRA),
    );
  const deA = palavras(nomeA);
  if (!deA.size) return false;
  for (const palavra of palavras(nomeB)) {
    if (deA.has(palavra)) return true;
  }
  return false;
}

const semAcento = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/*
  Nome canónico: tira o que descreve o TIPO e mantém o que nomeia o LUGAR.
  `POLO BASE XITEI`, `PB XITEI` e `XITEI` convergem; `CASA NOVA` e
  `POLO BASE CASA NOVA` também.
*/
export function nomeCanonico(nome) {
  let u = semAcento(nome).toUpperCase();
  u = u.replace(/\([^)]*\)/g, " ");
  u = u.replace(
    /\b(PB|POLO|POLOS|BASE|DSEI|DISTRITO|SANITARIO|ESPECIAL|INDIGENA|UBSI|UBS|CASAI|CASA|SAUDE|POSTO|UNIDADE|BASICA|APOIO|TIPO)\b/g,
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
  if (/\bPOLO\b|^\s*PB\b/.test(u)) return "polo";
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
  A COORDENADA DE EXIBIÇÃO — REGRA CONSERVADORA

  O CNES confirma a IDENTIDADE do estabelecimento, mas isso não prova que a
  latitude/longitude cadastrada seja a posição física exata do Polo Base.
  Em vários casos a coordenada da planilha de Lotações coincide com a do CNES,
  portanto as duas não são confirmação independente.

  Quando o polo já existia no lmap, preserva-se a posição que estava sendo
  exibida antes do enriquecimento e mantêm-se CNES/Lotações como fontes de
  comparação. Só uma validação independente deve substituir a posição.
*/
function coordenadaDeExibicao(polo, estab) {
  if (Number.isFinite(polo?.lat) && Number.isFinite(polo?.lon)) {
    return { lat: polo.lat, lon: polo.lon, fonte: "lmap" };
  }
  return { lat: estab.lat, lon: estab.lon, fonte: "rede_cnes" };
}

function identificadorCnes(valor) {
  return String(valor ?? "").trim();
}

function registrarReconciliacao({
  dseiChave,
  polo,
  estab,
  canonico,
  tipoP,
  reconciliados,
  estabelecimentosUsados,
}) {
  const km = distanciaKm(polo.lat, polo.lon, estab.lat, estab.lon);
  const exibicao = coordenadaDeExibicao(polo, estab);
  const chave = estab.chave || estab.cnes;
  if (chave) estabelecimentosUsados.add(chave);
  reconciliados.push({
    dsei: dseiChave,
    canonico,
    tipo: tipoP,
    nome_exibicao: estab.nome || polo.nome,
    nomes: { lmap: polo.nome, rede_cnes: estab.nome },
    cnes: estab.cnes || polo.cnes || "",
    cod: polo.cod ?? null,
    origens: ["lmap", "rede_cnes"],
    lat: exibicao.lat,
    lon: exibicao.lon,
    coordenada_exibida: exibicao.fonte,
    coordenadas: {
      lmap: { lat: polo.lat, lon: polo.lon },
      lotacoes:
        polo.coord_lotacoes &&
        Number.isFinite(Number(polo.coord_lotacoes.lat)) &&
        Number.isFinite(Number(polo.coord_lotacoes.lon))
          ? {
              lat: Number(polo.coord_lotacoes.lat),
              lon: Number(polo.coord_lotacoes.lon),
            }
          : null,
      rede_cnes: { lat: estab.lat, lon: estab.lon },
    },
    distancia_entre_fontes_km: km == null ? null : Number(km.toFixed(1)),
    divergencia: classificarDivergencia(km),
    validacao_coordenada: polo.coord_validacao || "pendente",
    confirmacao_independente: polo.confirmacao_independente === true,
    municipio: estab.municipio || polo.mun_lotacao || "",
    uf: estab.uf || polo.uf || "",
    reconciliacao: RECONCILIACAO.AUTOMATICA,
  });
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

  const porCanonico = new Map();
  const porCnes = new Map();
  estabelecimentos.forEach((e) => {
    const c = nomeCanonico(e.nome);
    if (canonicoUtilizavel(c)) {
      if (!porCanonico.has(c)) porCanonico.set(c, []);
      porCanonico.get(c).push(e);
    }

    const cnes = identificadorCnes(e.cnes || e.chave);
    if (!cnes) return;
    if (!porCnes.has(cnes)) porCnes.set(cnes, []);
    porCnes.get(cnes).push(e);
  });

  polos.forEach((p) => {
    const canonico = nomeCanonico(p.nome);
    const tipoP = p.tipo || "polo";
    const poloCnes = identificadorCnes(p.cnes);

    // Quando o transporte CNES × Lotações já identificou o estabelecimento,
    // o código CNES é a identidade mais forte. O nome pode conter ordinal,
    // nome histórico ou razão cadastral diferente sem voltar a duplicar o ponto.
    if (poloCnes && porCnes.has(poloCnes)) {
      const mesmosCnes = porCnes
        .get(poloCnes)
        .filter((e) => tiposCompativeis(tipoP, tipoDeclarado(e.nome)));

      if (mesmosCnes.length === 1) {
        registrarReconciliacao({
          dseiChave,
          polo: p,
          estab: mesmosCnes[0],
          canonico,
          tipoP,
          reconciliados,
          estabelecimentosUsados,
        });
        return;
      }

      if (mesmosCnes.length > 1) {
        ambiguos.push({
          dsei: dseiChave,
          canonico,
          polo: p,
          candidatos: mesmosCnes,
          motivo: `${mesmosCnes.length} estabelecimentos com o mesmo CNES no DSEI`,
        });
        return;
      }
    }

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

    registrarReconciliacao({
      dseiChave,
      polo: p,
      estab: compativeis[0],
      canonico,
      tipoP,
      reconciliados,
      estabelecimentosUsados,
    });
  });

  /*
    ÚLTIMA PASSAGEM: A COORDENADA COMO PROVA DE IDENTIDADE

    Sobram polos sem par por causa do NOME, não por serem outra coisa. Medido
    sobre os dados reais, depois da fusão com a planilha de Lotações: 36 pares
    de polo e unidade no mesmo ponto que o nome não junta. No DSEI Ceará o
    mapa mostra dois marcadores para o mesmo polo:

        polo    "PIAUÍ ÁREA II"
        unidade "SAUDE INDIGENA DE URUCUI POLO BASE AREA II"    a 0 metros

    Em Minas Gerais são três:

        "MACHACALIS"           vs "POLO BASE TIPO II MACHACALIS"
        "SÃO JOÃO DAS MISSÕES" vs "POLO BASE TIPO II SAO JOAO DAS MISSOES"
        "TEÓFILO OTONI"        vs "POLO BASE TIPO II TEOFILO OTONI"

    O canónico tira POLO, BASE e TIPO, mas fica com o "II" — e "II MACHACALIS"
    não é "MACHACALIS".

    O TIPO CONTINUA A MANDAR. Dos 36 pares, só 17 são polo com polo. Os outros
    19 são polo com CASAI, com UBSI, com posto — equipamentos diferentes no
    mesmo endereço, e uni-los apagaria um do mapa. A CASAI de Marabá está a
    zero metros do polo de Marabá e continua a ser outra coisa.

    O limiar é 200 m: é a escala do terreno de um equipamento, e absorve a
    diferença entre um ponto tomado no portão e outro no edifício. Acima disso
    deixa de ser imprecisão de registo e passa a ser palpite.

    Mais de um candidato não é prova, é ambiguidade — e não se arbitra.
  */
  const semParPorNome = polosSemPar.splice(0, polosSemPar.length);
  for (const pendente of semParPorNome) {
    const p = pendente.polo;
    const tipoP = p.tipo || "polo";
    const proximos = estabelecimentos.filter((e) => {
      const chave = identificadorCnes(e.chave || e.cnes);
      if (chave && estabelecimentosUsados.has(chave)) return false;
      if (!tiposCompativeis(tipoP, tipoDeclarado(e.nome))) return false;
      if (!partilhamPalavra(p.nome, e.nome)) return false;
      const km = distanciaKm(p.lat, p.lon, e.lat, e.lon);
      return km != null && km <= LIMIAR_MESMO_PONTO_KM;
    });

    if (proximos.length !== 1) {
      polosSemPar.push(pendente);
      continue;
    }

    registrarReconciliacao({
      dseiChave,
      polo: p,
      estab: proximos[0],
      canonico: nomeCanonico(p.nome),
      tipoP,
      reconciliados,
      estabelecimentosUsados,
    });
  }

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

/*
  DOIS REGISTOS CNES PARA O MESMO ESTABELECIMENTO

  O painel do DSEI listava o POLO BASE JAPIIM duas vezes. Não era defeito do
  desenho nem da reconciliação: são dois registos no CNES, com códigos
  diferentes, mesmo nome, mesmo tipo e a MESMA coordenada, um deles marcado
  "(em atualização cadastral)". A reconciliação nunca os viu porque só compara
  polo do lmap contra estabelecimento do CNES — nada comparava estabelecimentos
  entre si.

  São quatro pares em Médio Rio Purus, todos a 0,00 km:

      4206991 / 9425616   POLO BASE JAPIIM
      4207017 / 9425721   UBSI ÁGUA BRANCA
      4207025 / 9427104   UBSI IRMÃ CLEUSA
      4207033 / 9427015   UBSI CURRIÁ

  O QUE ESTA FUNÇÃO NÃO UNE

  Há outros cinco pares com o mesmo nome e o mesmo tipo, a 222, 224, 305, 472 e
  598 km um do outro — Aldeia São Luiz, Tocantins, Litoral Sul, Alto Rio Negro,
  Interior Sul. Nome igual a essa distância não é o mesmo sítio: ou são
  unidades distintas com nome genérico, ou é um problema de cadastro. Uni-los
  faria o mapa apagar um ponto real. Ficam como estão, os dois visíveis.

  O limiar é 500 m. Cinco casas decimais valem cerca de um metro, e a distância
  entre dois registos do mesmo estabelecimento, quando existe, é do tamanho do
  arredondamento — não de meio quilómetro.

  `CASAI TUCUMÃ` e `POLO BASE TUCUMÃ` partilham o nome do lugar e continuam
  dois registos: o tipo declarado difere, e são mesmo dois equipamentos.
*/
export const LIMIAR_MESMO_ESTABELECIMENTO_KM = 0.5;

const EM_ATUALIZACAO = /\(\s*em\s+atualiza[cç][aã]o\s+cadastral\s*\)/i;

/*
  Entre dois registos do mesmo estabelecimento, fica o que NÃO está marcado
  como em atualização cadastral: é o registo corrente, e é o nome que quem
  procura a unidade no CNES vai encontrar.
*/
function preferido(a, b) {
  const aEmAtualizacao = EM_ATUALIZACAO.test(String(a?.nome ?? ""));
  const bEmAtualizacao = EM_ATUALIZACAO.test(String(b?.nome ?? ""));
  if (aEmAtualizacao !== bEmAtualizacao) return aEmAtualizacao ? b : a;
  return a;
}

export function unirEstabelecimentosRepetidos(estabelecimentos = []) {
  const lista = Array.isArray(estabelecimentos) ? estabelecimentos : [];
  const grupos = new Map();
  const soltos = [];

  for (const estabelecimento of lista) {
    const canonico = nomeCanonico(estabelecimento?.nome);
    const tipo = tipoDeclarado(estabelecimento?.nome);
    if (!canonicoUtilizavel(canonico)) {
      // Sem nome que identifique, não se afirma que dois registos são um só.
      soltos.push(estabelecimento);
      continue;
    }
    const chave = `${canonico}|${tipo}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(estabelecimento);
  }

  const resultado = [];
  const unidos = [];

  for (const grupo of grupos.values()) {
    const pendentes = [...grupo];
    while (pendentes.length) {
      let atual = pendentes.shift();
      const absorvidos = [];

      for (let i = pendentes.length - 1; i >= 0; i -= 1) {
        const km = distanciaKm(
          Number(atual.lat),
          Number(atual.lon),
          Number(pendentes[i].lat),
          Number(pendentes[i].lon),
        );
        if (km == null || km > LIMIAR_MESMO_ESTABELECIMENTO_KM) continue;
        absorvidos.push(pendentes[i]);
        atual = preferido(atual, pendentes[i]);
        pendentes.splice(i, 1);
      }

      if (!absorvidos.length) {
        resultado.push(atual);
        continue;
      }

      const outros = absorvidos
        .map((e) => identificadorCnes(e.cnes))
        .filter((cnes) => cnes && cnes !== identificadorCnes(atual.cnes));
      const unido = { ...atual, cnes_absorvidos: outros };
      resultado.push(unido);
      unidos.push({ mantido: atual, absorvidos });
    }
  }

  return { estabelecimentos: [...resultado, ...soltos], unidos };
}
