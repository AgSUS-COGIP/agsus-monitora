import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { BRASIL_BOUNDS } from "../src/lib/brasil-bounds.js";
import {
  classificarVinculoTerritorial,
  siglaDaUf,
  VINCULO_EXTERNO,
} from "../src/lib/uf-ibge.js";

/*
  AUDITORIA DAS COORDENADAS DO MAPA — SOMENTE LEITURA.

  Este script não escreve nada: nem no banco, nem no payload. Ele lê as duas
  linhas de `mapa_saude_indigena_config` (`lmap` e `rede_cnes`), classifica a
  procedência de cada coordenada e lista os problemas.

  DUAS ENTRADAS POSSÍVEIS

    node scripts/auditar-coordenadas.mjs                  # usa SUPABASE_DB_URL
    node scripts/auditar-coordenadas.mjs --arquivo d.json # usa um export local

  A segunda existe porque a auditoria não deve depender de credencial de
  produção: basta exportar do painel do Supabase um JSON no formato
  `{ "lmap": {...}, "rede_cnes": {...} }`.

  SAÍDA

    --csv relatorio.csv   grava a tabela completa (separador `;`, como o resto
                          da casa) além do resumo impresso.

  O QUE ESTE SCRIPT NÃO FAZ

  Não decide UF por geometria. Medido em 09/09/2026 sobre os dados reais, o ray
  casting no `UF_GEO` diverge do CNES em 20 unidades e aponta 12 como fora do
  DSEI, das quais 9 são falso positivo perto de fronteira. Quem decide UF
  administrativa é o CNES — ver `src/lib/uf-ibge.js`. Aqui a geometria só serve
  para achar coordenada quebrada (fora do Brasil, invertida, sinal trocado).
*/

const NIVEIS = Object.freeze({
  OFICIAL_ESTABELECIMENTO: "oficial_estabelecimento",
  OFICIAL_CNES: "oficial_cnes",
  APROXIMADA_MUNICIPIO: "aproximada_municipio",
  INFERIDA: "inferida",
  PENDENTE: "pendente_validacao",
});

const args = process.argv.slice(2);
const valorDe = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

/* ---------- normalização, copiada da que o mapa usa hoje ---------- */

const txt = (v) => String(v ?? "").trim();

function mapNameKey(s) {
  let u = txt(s).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  u = u.replace(/\([^)]*\)/g, " ");
  u = u.replace(
    /\b(DISTRITO|SANITARIO|ESPECIAL|INDIGENA|SAUDE|DE|DO|DA|DOS|DAS|E|TIPO|I|II|III|IV)\b/g,
    " ",
  );
  u = u.replace(/\b(POLO|BASE|DSEI|UBSI|UBS|UNIDADE|BASICA|POSTO)\b/g, " ");
  return u
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavraInteira(hay, needle) {
  if (!hay || !needle) return false;
  return new RegExp(
    "(^| )" + needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( |$)",
  ).test(hay);
}

function nomeCasaForte(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const menor = a.length < b.length ? a : b;
  if (menor.length < 5) return false;
  return palavraInteira(a, b) || palavraInteira(b, a);
}

/* ---------- leitura ---------- */

async function lerDoBanco() {
  const conexao = process.env.SUPABASE_DB_URL || "";
  if (!conexao) return null;
  const { default: pg } = await import("pg");
  const cliente = new pg.Client({ connectionString: conexao });
  await cliente.connect();
  try {
    // Sessão somente-leitura: a auditoria não pode alterar produção nem por engano.
    await cliente.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    const { rows } = await cliente.query(
      "SELECT chave, payload FROM mapa_saude_indigena_config WHERE chave IN ('lmap','rede_cnes')",
    );
    return Object.fromEntries(rows.map((r) => [r.chave, r.payload]));
  } finally {
    await cliente.end();
  }
}

function lerDoArquivo(caminho) {
  const bruto = JSON.parse(readFileSync(caminho, "utf8"));
  // Aceita tanto `{lmap, rede_cnes}` quanto a linha crua do Supabase.
  if (bruto.lmap || bruto.rede_cnes) return bruto;
  if (Array.isArray(bruto))
    return Object.fromEntries(bruto.map((r) => [r.chave, r.payload]));
  throw new Error(
    "Formato não reconhecido. Esperado { lmap, rede_cnes } ou a lista de linhas da tabela.",
  );
}

/* ---------- diagnóstico geométrico: só o que é inequívoco ---------- */

const [[SUL, OESTE], [NORTE, LESTE]] = BRASIL_BOUNDS;

const dentro = (v, min, max) => v >= min && v <= max;

function coordenadaQuebrada(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "sem coordenada";
  if (lat === 0 && lon === 0) return "coordenada zero";
  if (lon > 0) return "longitude positiva (o Brasil é todo negativo)";
  /*
    Invertida: o valor guardado como latitude cai na faixa de LONGITUDE do país
    e o guardado como longitude cai na faixa de LATITUDE. Testar contra a faixa
    errada — o engano da primeira versão — nunca acusa a troca, porque as duas
    faixas se sobrepõem entre -33.75 e -32.42.
  */
  if (
    !dentro(lat, SUL, NORTE) &&
    dentro(lat, OESTE, LESTE) &&
    dentro(lon, SUL, NORTE)
  )
    return "latitude e longitude invertidas";
  if (!dentro(lat, SUL, NORTE) || !dentro(lon, OESTE, LESTE))
    return "fora do retângulo do Brasil";
  return null;
}

/* Casas decimais informadas — proxy de precisão da fonte. */
function casasDecimais(valor) {
  const s = String(valor);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

/* ---------- o casamento difuso que o frontend faz hoje, reproduzido ---------- */

function casarPoloComCnes(polo, rede) {
  const poloKey = mapNameKey(polo.n);
  const poloUf = txt(polo.uf).toUpperCase();
  const unidades = rede?.u || [];

  const candidatos = unidades
    .filter((a) => /\bPOLO\b/i.test(txt(a[0])))
    .map((a) => {
      const nameKey = mapNameKey(a[0]);
      const munKey = mapNameKey(a[4]);
      const uf = txt(a[5]).toUpperCase();
      let score = 0;
      const porNome =
        nameKey &&
        poloKey &&
        (nameKey.includes(poloKey) || poloKey.includes(nameKey));
      const porMunicipio =
        munKey &&
        poloKey &&
        (munKey.includes(poloKey) || poloKey.includes(munKey));
      if (porNome) score += 100;
      if (porMunicipio) score += 60;
      if (poloUf && uf && poloUf === uf) score += 10;
      return { a, score, porNome, porMunicipio };
    })
    .filter((x) => x.score >= 70)
    .sort((a, b) => b.score - a.score);

  if (candidatos[0])
    return {
      registro: candidatos[0].a,
      score: candidatos[0].score,
      via: candidatos[0].porNome ? "nome-polo" : "municipio-apenas",
    };

  if (!poloKey) return null;
  const fallback = unidades
    .map((a) => {
      const nameKey = mapNameKey(a[0]);
      const uf = txt(a[5]).toUpperCase();
      let score = nomeCasaForte(nameKey, poloKey) ? 100 : 0;
      if (score && poloUf && uf && poloUf === uf) score += 10;
      return { a, score };
    })
    .filter((x) => x.score >= 100)
    .sort((a, b) => b.score - a.score);

  return fallback[0]
    ? {
        registro: fallback[0].a,
        score: fallback[0].score,
        via: "nome-qualquer-unidade",
      }
    : null;
}

/* ---------- montagem dos registros ---------- */

function montarRegistros({ lmap, rede_cnes }) {
  const registros = [];
  const rede = rede_cnes?.rede || {};

  (lmap?.dsei || []).forEach((d) => {
    // Sede do DSEI: coordenada do próprio `lmap`, sem origem declarada.
    registros.push({
      dsei: d.n || d.k,
      tipo: "Sede DSEI",
      nome: d.n || d.k,
      cnes: "",
      municipio: "",
      uf: d.sedeuf || "",
      lat: d.lat,
      lon: d.lon,
      origem: "lmap",
      ufsDoDsei: d.ufs || (d.sedeuf ? [d.sedeuf] : []),
    });

    (d.polos || []).forEach((p) => {
      const casado = casarPoloComCnes(p, rede[d.k]);
      registros.push({
        dsei: d.n || d.k,
        tipo: "Polo Base",
        nome: p.n,
        cnes: casado ? casado.registro[1] : "",
        municipio: casado ? casado.registro[4] : "",
        uf: casado ? casado.registro[5] : p.uf || "",
        // A coordenada que o mapa desenha: a do registro casado, quando há.
        lat: casado ? casado.registro[2] : p.lat,
        lon: casado ? casado.registro[3] : p.lon,
        latLmap: p.lat,
        lonLmap: p.lon,
        origem: casado ? `cnes-casado:${casado.via}` : "lmap",
        scoreCasamento: casado ? casado.score : null,
        nomeCasado: casado ? casado.registro[0] : "",
        ufsDoDsei: d.ufs || (d.sedeuf ? [d.sedeuf] : []),
      });
    });

    const r = rede[d.k];
    (r?.u || []).forEach((a) =>
      registros.push({
        dsei: d.n || d.k,
        tipo: /\bPOLO\b/i.test(txt(a[0])) ? "UBSI (nome de polo)" : "UBSI",
        nome: a[0],
        cnes: a[1],
        municipio: a[4],
        uf: a[5],
        lat: a[2],
        lon: a[3],
        origem: "rede_cnes",
        ufsDoDsei: d.ufs || (d.sedeuf ? [d.sedeuf] : []),
      }),
    );
    (r?.c || []).forEach((a) =>
      registros.push({
        dsei: d.n || d.k,
        tipo: "CASAI",
        nome: a[0],
        cnes: a[1],
        municipio: a[4],
        uf: a[5],
        lat: a[2],
        lon: a[3],
        origem: "rede_cnes",
        ufsDoDsei: d.ufs || (d.sedeuf ? [d.sedeuf] : []),
      }),
    );
  });

  (rede_cnes?.nac || []).forEach((a) =>
    registros.push({
      dsei: "(nacional)",
      tipo: "CASAI Nacional",
      nome: a[0],
      cnes: a[1],
      municipio: a[4],
      uf: a[5],
      lat: a[2],
      lon: a[3],
      origem: "rede_cnes",
      ufsDoDsei: [],
    }),
  );

  return registros;
}

/* ---------- concentração: o suspeito que passa por plausível ---------- */

/*
  Uma coordenada pode estar dentro do Brasil, com seis casas decimais e sem
  nada de anómalo no número — e ainda assim não localizar coisa nenhuma. É o
  que acontece quando dezenas de estabelecimentos distintos partilham o mesmo
  ponto: o valor deixou de ser o endereço de alguém e passou a ser um
  depósito, tipicamente o centróide do território ou do município.

  Medido nos dados reais em 14/09/2026: um único ponto reúne 57
  estabelecimentos diferentes, e outro reúne 15, incluindo polos base.

  Dois limiares, com consequências diferentes:

    AGRUPAMENTO (3)  assinala, sem mexer no nível. Três unidades no mesmo
                     endereço é plausível — um campus, um mesmo prédio.

    COLETOR    (10)  assinala E rebaixa para `pendente_validacao`. A partir daí
                     a coordenada demonstravelmente não distingue os
                     estabelecimentos entre si, e chamar-lhe oficial seria
                     repetir o erro que esta auditoria veio expor.
*/
const LIMIAR_AGRUPAMENTO = 3;
const LIMIAR_COLETOR = 10;

/* Identidade do lugar: o polo e o registo que lhe emprestou a coordenada são
   o mesmo sítio, e contariam duas vezes se fossem separados. */
const chaveDoLugar = (r) => r.cnes || `${r.tipo}|${r.nome}`;

const chaveDaCoord = (r) =>
  Number.isFinite(r.lat) && Number.isFinite(r.lon)
    ? `${r.lat.toFixed(5)},${r.lon.toFixed(5)}`
    : null;

/* Distância em km entre dois pontos — para medir o quanto o casamento mudou
   de sítio um polo em relação à coordenada guardada no `lmap`. */
function distanciaKm(lat1, lon1, lat2, lon2) {
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

export function agruparPorCoordenada(registros) {
  const grupos = new Map();
  registros.forEach((r) => {
    const k = chaveDaCoord(r);
    if (!k) return;
    if (!grupos.has(k))
      grupos.set(k, { coord: k, registros: [], lugares: new Set() });
    const g = grupos.get(k);
    g.registros.push(r);
    g.lugares.add(chaveDoLugar(r));
  });
  return grupos;
}

/* ---------- classificação ---------- */

function classificar(registros) {
  const grupos = agruparPorCoordenada(registros);

  return registros.map((r) => {
    const problemas = [];
    const quebrada = coordenadaQuebrada(r.lat, r.lon);
    if (quebrada) problemas.push(quebrada);

    const k = chaveDaCoord(r);
    const grupo = k ? grupos.get(k) : null;
    const lugaresNoPonto = grupo ? grupo.lugares.size : 1;

    /*
      Um polo casado ao CNES fica, por construção, na mesma coordenada do
      registro que o originou. Isso não é coincidência a investigar: é o
      próprio mecanismo. Contar como repetição encheria o relatório de ruído e
      esconderia as repetições verdadeiras — dois estabelecimentos distintos no
      mesmo ponto.
    */
    const vizinhos = grupo
      ? grupo.registros.filter(
          (o) => o !== r && o.nome !== r.nomeCasado && r.nome !== o.nomeCasado,
        )
      : [];
    const duplicadaCom = vizinhos.map((o) => `${o.tipo}:${o.nome}`);
    if (duplicadaCom.length)
      problemas.push(`coordenada repetida com ${duplicadaCom.length} outro(s)`);

    const coletor = lugaresNoPonto >= LIMIAR_COLETOR;
    if (coletor)
      problemas.push(
        `ponto coletor: ${lugaresNoPonto} estabelecimentos distintos na mesma coordenada`,
      );
    else if (lugaresNoPonto >= LIMIAR_AGRUPAMENTO)
      problemas.push(
        `agrupamento: ${lugaresNoPonto} estabelecimentos distintos na mesma coordenada`,
      );

    /*
      Indício de município usado como substituto: o ponto junta vários
      estabelecimentos e todos declaram o mesmo município. Não prova que seja a
      sede — isso exige a base de sedes do IBGE —, mas é o padrão que ela teria.
    */
    const municipios = grupo
      ? new Set(
          grupo.registros
            .map((o) => txt(o.municipio).toUpperCase())
            .filter(Boolean),
        )
      : new Set();
    const possivelSedeMunicipal =
      lugaresNoPonto >= LIMIAR_AGRUPAMENTO && municipios.size === 1;
    if (possivelSedeMunicipal)
      problemas.push(
        `possível sede municipal: ${lugaresNoPonto} unidades, todas em ${[...municipios][0]}`,
      );

    const casas = Math.min(casasDecimais(r.lat), casasDecimais(r.lon));
    if (Number.isFinite(r.lat) && casas <= 2)
      problemas.push(`precisão baixa (${casas} casas decimais)`);

    const vinculo = classificarVinculoTerritorial(r.uf, r.ufsDoDsei);
    if (vinculo.vinculo === VINCULO_EXTERNO)
      problemas.push(
        `UF ${vinculo.uf} fora da abrangência do DSEI (${vinculo.ufsDoDsei.join("/")})`,
      );

    if (r.origem === "cnes-casado:municipio-apenas")
      problemas.push(
        "polo casado ao CNES SÓ pelo município — o nome não bateu",
      );
    if (r.origem === "cnes-casado:nome-qualquer-unidade")
      problemas.push("polo casado a uma unidade que não é POLO no CNES");
    if (r.tipo === "Polo Base" && r.origem === "lmap")
      problemas.push("polo sem correspondência no CNES");

    /*
      Quanto o casamento moveu o polo. O `lmap` guarda uma coordenada e o mapa
      desenha outra; medir a diferença mostra se o registo adotado é mesmo o
      mesmo lugar. Dezenas de quilómetros dizem que não é.
    */
    const deslocamentoKm =
      r.tipo === "Polo Base" && String(r.origem).startsWith("cnes-casado:")
        ? distanciaKm(r.latLmap, r.lonLmap, r.lat, r.lon)
        : null;
    if (deslocamentoKm != null && deslocamentoKm >= 50)
      problemas.push(
        `casamento moveu o polo ${deslocamentoKm.toFixed(0)} km do que o lmap guardava`,
      );

    let nivel;
    if (quebrada) nivel = NIVEIS.PENDENTE;
    else if (r.origem === "rede_cnes") nivel = NIVEIS.OFICIAL_ESTABELECIMENTO;
    else if (r.origem === "cnes-casado:nome-polo") nivel = NIVEIS.OFICIAL_CNES;
    else if (String(r.origem).startsWith("cnes-casado:"))
      nivel = NIVEIS.INFERIDA;
    else if (casas <= 2) nivel = NIVEIS.APROXIMADA_MUNICIPIO;
    else nivel = NIVEIS.PENDENTE;

    /*
      Os rebaixamentos vêm depois de tudo e vencem a origem declarada.

      Ponto coletor: uma coordenada partilhada por dez ou mais estabelecimentos
      não identifica nenhum deles, por mais oficial que seja a sua origem.

      Deslocamento grande: quando o casamento muda o polo dezenas de
      quilómetros do que o `lmap` guardava, as duas fontes discordam de forma
      irreconciliável. Não se sabe qual está errada — o `lmap` não tem
      procedência, e o casamento é por semelhança de nome —, e é justamente por
      não se saber que nenhuma das duas pode ser chamada de oficial.
    */
    if (deslocamentoKm != null && deslocamentoKm >= 50) nivel = NIVEIS.INFERIDA;
    if (coletor) nivel = NIVEIS.PENDENTE;

    return {
      ...r,
      nivel,
      problemas,
      duplicadaCom,
      lugaresNoPonto,
      coletor,
      possivelSedeMunicipal,
      deslocamentoKm,
    };
  });
}

/* ---------- saída ---------- */

function imprimir(classificados) {
  const contagem = {};
  const porTipo = {};
  classificados.forEach((r) => {
    contagem[r.nivel] = (contagem[r.nivel] || 0) + 1;
    porTipo[r.tipo] = porTipo[r.tipo] || {};
    porTipo[r.tipo][r.nivel] = (porTipo[r.tipo][r.nivel] || 0) + 1;
  });

  console.log(`\nRegistros auditados: ${classificados.length}\n`);
  console.log("NÍVEL DE CONFIANÇA");
  Object.values(NIVEIS).forEach((n) =>
    console.log(`  ${String(contagem[n] || 0).padStart(5)}  ${n}`),
  );

  console.log("\nPOR TIPO");
  Object.entries(porTipo)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([tipo, niveis]) => {
      const total = Object.values(niveis).reduce((s, v) => s + v, 0);
      const detalhe = Object.entries(niveis)
        .map(([n, v]) => `${n}=${v}`)
        .join("  ");
      console.log(
        `  ${String(total).padStart(5)}  ${tipo.padEnd(22)} ${detalhe}`,
      );
    });

  /*
    Coordenadas partilhadas. Esta é a seção que responde ao que a auditoria
    veio procurar: pontos numericamente impecáveis que, de facto, não
    localizam ninguém.
  */
  const grupos = [...agruparPorCoordenada(classificados).values()]
    .filter((g) => g.lugares.size >= LIMIAR_AGRUPAMENTO)
    .sort((a, b) => b.lugares.size - a.lugares.size);
  const coletores = grupos.filter((g) => g.lugares.size >= LIMIAR_COLETOR);
  const afetados = grupos.reduce((s, g) => s + g.registros.length, 0);

  console.log(
    `\nCOORDENADAS PARTILHADAS: ${grupos.length} ponto(s) com ${LIMIAR_AGRUPAMENTO}+ estabelecimentos, ${afetados} registro(s) afetado(s)`,
  );
  console.log(
    `  dos quais ${coletores.length} ponto(s) coletor(es) com ${LIMIAR_COLETOR}+ — rebaixados a pendente_validacao\n`,
  );
  grupos.slice(0, 15).forEach((g) => {
    const municipios = new Set(
      g.registros.map((r) => txt(r.municipio).toUpperCase()).filter(Boolean),
    );
    const tipos = new Set(g.registros.map((r) => r.tipo));
    const sede =
      municipios.size === 1 ? `  [todos em ${[...municipios][0]}]` : "";
    console.log(
      `  ${String(g.lugares.size).padStart(4)} lugares em ${g.coord}  tipos: ${[...tipos].join(", ")}${sede}`,
    );
  });

  const sedes = classificados.filter((r) => r.possivelSedeMunicipal);
  const municipiosSuspeitos = new Set(
    sedes.map((r) => `${txt(r.municipio).toUpperCase()}/${r.uf}`),
  );
  console.log(
    `\nMUNICÍPIO COMO SUBSTITUTO (indício): ${sedes.length} registro(s) em ${municipiosSuspeitos.size} município(s)`,
  );

  const polos = classificados.filter((r) => r.tipo === "Polo Base");
  const polosSuspeitos = polos.filter(
    (r) =>
      r.origem === "cnes-casado:municipio-apenas" ||
      r.origem === "cnes-casado:nome-qualquer-unidade" ||
      r.coletor ||
      (r.deslocamentoKm != null && r.deslocamentoKm >= 50),
  );
  const semCasamento = polos.filter((r) => r.origem === "lmap");
  console.log(
    `\nPOLOS: ${polos.length} no total — ${polosSuspeitos.length} com casamento suspeito, ${semCasamento.length} sem casamento nenhum`,
  );
  console.log("  motivos de suspeita (um polo pode ter mais de um):");
  const porMotivo = {
    "casado só pelo município": polos.filter(
      (r) => r.origem === "cnes-casado:municipio-apenas",
    ).length,
    "casado a unidade que não é polo": polos.filter(
      (r) => r.origem === "cnes-casado:nome-qualquer-unidade",
    ).length,
    "em ponto coletor": polos.filter((r) => r.coletor).length,
    "movido 50+ km pelo casamento": polos.filter(
      (r) => r.deslocamentoKm != null && r.deslocamentoKm >= 50,
    ).length,
  };
  Object.entries(porMotivo).forEach(([m, n]) =>
    console.log(`  ${String(n).padStart(5)}  ${m}`),
  );

  const comProblema = classificados.filter((r) => r.problemas.length);
  console.log(`\nPROBLEMAS: ${comProblema.length} registro(s)\n`);
  const porProblema = {};
  comProblema.forEach((r) =>
    r.problemas.forEach((p) => {
      const chave = p.replace(/\d+/g, "N");
      porProblema[chave] = (porProblema[chave] || 0) + 1;
    }),
  );
  Object.entries(porProblema)
    .sort((a, b) => b[1] - a[1])
    .forEach(([p, n]) => console.log(`  ${String(n).padStart(5)}  ${p}`));

  /*
    Grave é o que engana quem lê o mapa. Inclui tanto o número impossível
    quanto o número plausível que não localiza ninguém — um ponto coletor não
    dá erro nenhum, e é o problema mais espalhado que esta auditoria achou.
  */
  const graves = comProblema.filter((r) =>
    r.problemas.some(
      (p) =>
        p.includes("invertidas") ||
        p.includes("fora do retângulo") ||
        p.includes("longitude positiva") ||
        p.includes("coordenada zero") ||
        p.includes("SÓ pelo município") ||
        p.includes("ponto coletor") ||
        p.includes("moveu o polo"),
    ),
  );
  /*
    Os pontos coletores já foram listados acima, um por linha. Repetir aqui os
    seus 57 membros afogaria todo o resto, então desta lista só entram os que
    têm algum problema além da simples pertença ao ponto — e os polos, que
    importam um a um.
  */
  const soPertenceAoColetor = (r) =>
    r.problemas.every(
      (p) =>
        p.includes("ponto coletor") ||
        p.includes("possível sede municipal") ||
        p.includes("coordenada repetida") ||
        p.includes("precisão baixa"),
    );
  const gravesListaveis = graves.filter(
    (r) => r.tipo === "Polo Base" || !soPertenceAoColetor(r),
  );

  if (gravesListaveis.length) {
    console.log(
      `\nGRAVES: ${graves.length} registro(s); ${gravesListaveis.length} listado(s) aqui — os demais são membros dos pontos coletores já listados acima\n`,
    );
    gravesListaveis
      .slice(0, 25)
      .forEach((r) =>
        console.log(
          `  ${r.dsei} | ${r.tipo} | ${r.nome} | CNES ${r.cnes || "-"} | ${r.municipio || "-"}/${r.uf || "-"} | ${r.lat},${r.lon}\n      ${r.problemas.join("; ")}`,
        ),
      );
  }
  return { contagem, porTipo, comProblema, graves, grupos, coletores, polos };
}

function gravarCsv(caminho, classificados) {
  const cab = [
    "dsei",
    "tipo",
    "nome",
    "cnes",
    "municipio",
    "uf",
    "latitude",
    "longitude",
    "confianca",
    "origem",
    "score_casamento",
    "nome_casado",
    "lat_lmap",
    "lon_lmap",
    "deslocamento_km",
    "lugares_no_ponto",
    "ponto_coletor",
    "possivel_sede_municipal",
    "problema",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = classificados.map((r) =>
    [
      r.dsei,
      r.tipo,
      r.nome,
      r.cnes,
      r.municipio,
      r.uf,
      r.lat,
      r.lon,
      r.nivel,
      r.origem,
      r.scoreCasamento ?? "",
      r.nomeCasado ?? "",
      r.latLmap ?? "",
      r.lonLmap ?? "",
      r.deslocamentoKm == null ? "" : r.deslocamentoKm.toFixed(1),
      r.lugaresNoPonto ?? "",
      r.coletor ? "sim" : "",
      r.possivelSedeMunicipal ? "sim" : "",
      r.problemas.join(" | "),
    ]
      .map(esc)
      .join(";"),
  );
  writeFileSync(caminho, [cab.join(";"), ...linhas].join("\n"), "utf8");
  console.log(`\nTabela completa gravada em ${caminho}`);
}

/* ---------- execução ---------- */

async function principal() {
  const arquivo = valorDe("--arquivo");
  const payload = arquivo ? lerDoArquivo(arquivo) : await lerDoBanco();

  if (!payload) {
    console.error(
      "Sem fonte de dados. Defina SUPABASE_DB_URL (somente leitura) ou passe --arquivo <export.json>.",
    );
    process.exit(2);
  }
  if (!payload.lmap || !payload.rede_cnes) {
    console.error(
      "O payload não traz as duas chaves. Encontradas: " +
        Object.keys(payload).join(", "),
    );
    process.exit(2);
  }

  const classificados = classificar(montarRegistros(payload));
  const resumo = imprimir(classificados);

  const csv = valorDe("--csv");
  if (csv) gravarCsv(csv, classificados);

  console.log(
    "\nEste script não alterou nada. Nenhuma escrita foi feita no banco nem no payload.",
  );
  // Sai com 0 sempre: auditoria informa, não reprova build.
  return resumo;
}

/*
  Só corre como programa quando é invocado directamente. Importado — pelos
  testes — apenas expõe as funções puras, sem tocar em banco nem em ficheiro.
*/
const executadoDireto =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (executadoDireto) {
  principal().catch((erro) => {
    console.error("Auditoria falhou:", erro?.message || erro);
    process.exit(1);
  });
}

export {
  NIVEIS,
  casarPoloComCnes,
  classificar,
  coordenadaQuebrada,
  mapNameKey,
  montarRegistros,
};
