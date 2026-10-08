import type { CoordenadasDoMapa } from "../tipos-do-mapa.ts";
import type {
  DseiDoMapa,
  RedeCnesDoMapa,
  RegistroDoDsei,
  EstabelecimentoCompacto,
  TerraDoMapa,
  LinhaDaTerra,
} from "./tipos.ts";
/*
  O MAPA DE UM DSEI (MODO DETALHADO), SEM LEAFLET

  Junta os pontos de um distrito, todos do banco (TB_CONFIG_MAPA_SAUDE_INDIG):

    lmap (polos)        a posição do polo é a do `lmap`, exatamente como está
                        gravada (auditada em 01–02/10/2026 contra fontes
                        oficiais — ver docs/auditoria-oficial-das-coordenadas-
                        2026-10-01.md);
    rede_cnes (u, c)    estabelecimentos do CNES (UBSI, CASAI, polos
                        cadastrados), na coordenada gravada no `rede_cnes`;
    reconciliação       polo do lmap + registro do CNES que são a mesma
                        estrutura viram um ponto só (`reconciliarDsei`), na
                        posição do lmap; o que ela não decide continua como
                        dois registros.

  Nenhuma outra fonte mexe na posição: a planilha de Lotações e os vereditos
  da validação de 22/09 saíram do mapa em 02/10/2026.

  É o `detailRecordsForDsei` do `legacy-app.js`, mais o vínculo territorial
  (UF do CNES × UFs do DSEI), os filtros por tipo, o resumo da dica e os dois
  enquadramentos (território / com vínculos externos).
*/
import {
  reconciliarDsei,
  unirEstabelecimentosRepetidos,
} from "../reconciliacao-unidades.js";
import {
  VINCULO_EXTERNO,
  VINCULO_INDETERMINADO,
  classificarVinculoTerritorial,
} from "../uf-ibge.js";
import { formatarNumero, temCoordenada, texto } from "./chaves.ts";
import { TIPO_CASAI, TIPO_POLO, TIPO_SEDE, tipoDaUnidade } from "./formas.ts";

/* Estabelecimento compacto do `rede_cnes`: [nome, cnes, lat, lon, município, uf]. */
export function abrirEstabelecimento(a: EstabelecimentoCompacto) {
  return {
    n: a?.[0],
    cnes: a?.[1],
    lat: a?.[2],
    lon: a?.[3],
    mun: a?.[4],
    uf: a?.[5],
  };
}

/* Os pontos de saúde de um DSEI, sem repetição e só com coordenada. */

export function registrosDoDsei(
  dsei: DseiDoMapa,
  redeCnes: RedeCnesDoMapa,
): RegistroDoDsei[] {
  if (!dsei?.k) return [];
  const rede = redeCnes?.rede?.[dsei.k] || { u: [], c: [] };

  const estabelecimentos = [
    ...(rede.c || []).map((item) => ({ item, forcado: TIPO_CASAI })),
    ...(rede.u || []).map((item) => ({ item, forcado: null })),
  ].map(({ item, forcado }) => {
    const e = abrirEstabelecimento(item);
    return {
      nome: e.n,
      cnes: e.cnes,
      chave: e.cnes || `${e.n}|${e.lat}|${e.lon}`,
      lat: e.lat,
      lon: e.lon,
      municipio: e.mun,
      uf: e.uf,
      _tipoVisual: forcado || tipoDaUnidade(e.n),
    };
  });

  // O CNES não pode se repetir a si próprio antes de reconciliar com os polos.
  const { estabelecimentos: unicos } =
    unirEstabelecimentosRepetidos(estabelecimentos);

  const { reconciliados, estabelecimentosUsados } = reconciliarDsei({
    dseiChave: dsei.k,
    polos: (dsei.polos || [])
      .filter((p) => temCoordenada(p.lat, p.lon))
      .map((p) => ({
        nome: p.n,
        cnes: p.cnes || "",
        // Posição do polo: a do lmap, sem substituição.
        lat: Number(p.lat),
        lon: Number(p.lon),
        uf: p.uf,
        cod: p.cod ?? null,
        tipo: "polo",
      })),
    estabelecimentos: unicos,
  });

  const unificados = reconciliados.map((u) => ({
    name: u.nome_exibicao,
    cnes: u.cnes,
    lat: u.lat,
    lon: u.lon,
    city: u.municipio,
    uf: u.uf || dsei.sedeuf,
    type: TIPO_POLO,
    origens: u.origens,
    nomes: u.nomes,
  }));

  // Polos que a reconciliação não casou continuam a existir.
  const unidos = new Set(reconciliados.map((u) => u.nomes?.lmap));
  const polosSoltos = (dsei.polos || [])
    .filter((p) => !unidos.has(p.n) && temCoordenada(p.lat, p.lon))
    .map((p) => ({
      name: p.n,
      cnes: "",
      lat: Number(p.lat),
      lon: Number(p.lon),
      city: "",
      uf: p.uf || dsei.sedeuf,
      type: TIPO_POLO,
      origens: ["lmap"],
    }));

  // Estabelecimentos que nenhuma reconciliação absorveu.
  const soltos = unicos
    .filter((e) => !estabelecimentosUsados.has(e.chave))
    .map((e) => ({
      name: e.nome,
      cnes: e.cnes,
      lat: e.lat,
      lon: e.lon,
      city: e.municipio,
      uf: e.uf,
      type: e._tipoVisual,
      origens: ["rede_cnes"],
    }));

  type Candidato = Omit<RegistroDoDsei, "id" | "lat" | "lon"> & {
    lat: number | string | null;
    lon: number | string | null;
  };
  const candidatos: Candidato[] = [...unificados, ...polosSoltos, ...soltos];
  const vistos = new Set<string>();
  return candidatos
    .filter((r): r is Candidato & { lat: number; lon: number } => {
      const chave = [r.name, r.lat, r.lon].join("|");
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return Number.isFinite(r.lat) && Number.isFinite(r.lon);
    })
    .map((r, indice) => ({
      ...r,
      id: `${indice}|${r.name}|${r.lat}|${r.lon}`,
    }));
}

/*
  Vínculo territorial: o CNES decide a UF administrativa; a coordenada só diz
  onde desenhar. Fora das UFs do DSEI = externo (marcador no lugar verdadeiro e
  linha pontilhada até a sede); sem UF utilizável = indeterminado, que conta
  como local (sem prova, não se afirma que está fora).
*/

export function classificarRegistros(
  registros: readonly RegistroDoDsei[],
  dsei: DseiDoMapa,
): RegistroDoDsei[] {
  const ufs = dsei?.ufs || (dsei?.sedeuf ? [dsei.sedeuf] : []);
  return (registros || []).map((registro) => {
    const r = classificarVinculoTerritorial(registro.uf, ufs);
    return { ...registro, vinculo: r.vinculo, ufAdministrativa: r.uf };
  });
}

export const registrosExternos = (registros: readonly RegistroDoDsei[]) =>
  (registros || []).filter((r) => r.vinculo === VINCULO_EXTERNO);

export const registrosLocais = (registros: readonly RegistroDoDsei[]) =>
  (registros || []).filter((r) => r.vinculo !== VINCULO_EXTERNO);

/* Os tipos que o território tem, do mais frequente ao menos (os chips). */

export function tiposDoTerritorio(registros: readonly RegistroDoDsei[]) {
  const mapa = new Map<
    string,
    { tipo: RegistroDoDsei["type"]; quantidade: number }
  >();
  for (const r of registros || []) {
    const atual = mapa.get(r.type.key);
    if (atual) atual.quantidade += 1;
    else mapa.set(r.type.key, { tipo: r.type, quantidade: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade);
}

/* Guarda os tipos OCULTOS: um tipo novo aparece por inteiro, não escondido. */

export const visiveis = (
  registros: readonly RegistroDoDsei[],
  ocultos: ReadonlySet<string>,
) => (registros || []).filter((r) => !ocultos?.has?.(r.type.key));

/*
  Duas perguntas, duas linhas: quantos polos o distrito TEM (lotações/lmap) e
  quantos pontos o mapa MOSTRA (contados de `registrosDoDsei`, o mesmo que se
  desenha, para não divergirem).
*/
export function resumoDaRede(
  dsei: DseiDoMapa,
  registros: readonly RegistroDoDsei[],
) {
  if (!dsei?.k) return ["Sem unidades cadastradas"];
  const conta = { polo: 0, casai: 0, outros: 0 };
  for (const r of registros || []) {
    if (r.type?.key === "polo") conta.polo += 1;
    else if (r.type?.key === "casai") conta.casai += 1;
    else conta.outros += 1;
  }
  const total = (registros || []).length;
  const linhas = [];
  const polos = (dsei.polos || []).length;
  if (polos) linhas.push(`Polos base: ${polos}`);
  if (total) {
    const contagens: [string, number][] = [
      ["polos", conta.polo],
      ["unidades", conta.outros],
      ["CASAIs", conta.casai],
    ];
    const noMapa = contagens
      .filter(([, n]) => n > 0)
      .map(([rotulo, n]) => `${n} ${rotulo}`)
      .join(", ");
    linhas.push(
      `No mapa: ${total} ${total === 1 ? "ponto" : "pontos"} (${noMapa})`,
    );
  }
  return linhas.length ? linhas : ["Sem unidades cadastradas"];
}

/* A sede como registro (não entra nos totais nem nos filtros por tipo). */

export function registroDaSede(dsei: DseiDoMapa): RegistroDoDsei | null {
  if (!dsei || !temCoordenada(dsei.lat, dsei.lon)) return null;
  return {
    id: `sede|${dsei.k}`,
    name: `Sede do DSEI ${texto(dsei.n)}`,
    lat: Number(dsei.lat),
    lon: Number(dsei.lon),
    city: dsei.sede_municipio || "",
    uf: dsei.sede_uf || dsei.sedeuf || "",
    cnes: "",
    type: TIPO_SEDE,
  };
}

/*
  Os dois enquadramentos: "territorio" (sede + unidades locais — uma unidade
  a 773 km encolheria o distrito até ficar ilegível) e "completo" (com as
  externas). Nenhum é recalculado a partir do que está na tela.
*/

export function limitesDoDsei(
  dsei: DseiDoMapa,
  classificados: readonly RegistroDoDsei[],
) {
  const sede: CoordenadasDoMapa[] = temCoordenada(dsei?.lat, dsei?.lon)
    ? [[Number(dsei.lat), Number(dsei.lon)]]
    : [];
  const ponto = (r: RegistroDoDsei): CoordenadasDoMapa => [r.lat, r.lon];
  return {
    territorio: [...sede, ...registrosLocais(classificados).map(ponto)],
    completo: [...sede, ...(classificados || []).map(ponto)],
  };
}

/* Pontos que a camada de Terras Indígenas usa para recortar as terras do DSEI. */
export function pontosDoDistrito(
  dsei: DseiDoMapa,
  registros: readonly RegistroDoDsei[],
) {
  return [
    ...(temCoordenada(dsei?.lat, dsei?.lon)
      ? [{ lat: Number(dsei.lat), lon: Number(dsei.lon) }]
      : []),
    ...(registros || [])
      .filter((r) => temCoordenada(r.lat, r.lon))
      .map((r) => ({ lat: r.lat, lon: r.lon })),
  ];
}

export function textoDosVinculosExternos(quantidade: number) {
  if (!quantidade) return "";
  return quantidade === 1
    ? "1 vínculo fora da área"
    : `${formatarNumero(quantidade)} vínculos fora da área`;
}

/*
  O popup diz o que a unidade é: nome, tipo, município/UF e CNES. Nada sobre
  a procedência da coordenada — isso a Aya explica (docs/aya/).
*/
export function popupDoRegistro(registro: RegistroDoDsei) {
  return {
    titulo: registro.type?.label || "",
    linhas: [
      registro.name,
      [registro.city, registro.ufAdministrativa].filter(Boolean).join(" – "),
      registro.cnes ? `CNES: ${registro.cnes}` : "",
    ].filter(Boolean),
  };
}

/* A dica identifica: tipo, DSEI, UF e, se provado, que está fora da área. */
export function dicaDoRegistro(registro: RegistroDoDsei, dsei: DseiDoMapa) {
  const linhas = [`Vinculado ao DSEI ${texto(dsei?.n)}`];
  if (registro.ufAdministrativa)
    linhas.push(`Localização: ${registro.ufAdministrativa}`);
  if (registro.vinculo === VINCULO_EXTERNO)
    linhas.push("Fora das UFs de abrangência do DSEI");
  else if (registro.vinculo === VINCULO_INDETERMINADO)
    linhas.push("UF não informada no CNES — vínculo não classificado");
  return {
    titulo: `${registro.type?.label || ""} ${registro.name || ""}`.trim(),
    linhas,
  };
}

/* Endereço e origem do ponto da sede (correção das sedes dos DSEI). */
export function popupDaSede(dsei: DseiDoMapa) {
  return {
    titulo: `Sede do DSEI ${texto(dsei?.n)}`,
    linhas: [
      dsei?.sede_endereco || "",
      [dsei?.sede_municipio, dsei?.sede_uf || dsei?.sedeuf]
        .filter(Boolean)
        .join(" – "),
    ].filter(Boolean),
    nota: dsei?.sede_cnes ? `Endereço do CNES ${dsei.sede_cnes}` : "",
  };
}

/* A linha da lista "Terras Indígenas e povos". */

export function linhaDaTerra(terra: TerraDoMapa): LinhaDaTerra {
  const c = terra?.caixa;
  return {
    nome: texto(terra?.nome),
    povos: terra?.povos?.length
      ? terra.povos.join(", ")
      : "povo não declarado pela Funai",
    povoDeclarado: Boolean(terra?.povos?.length),
    detalhe: [terra?.ufs?.length ? terra.ufs.join(", ") : "", terra?.fase || ""]
      .filter(Boolean)
      .join(" · "),
    caixa: c
      ? { oeste: c.oeste, sul: c.sul, leste: c.leste, norte: c.norte }
      : null,
  };
}
