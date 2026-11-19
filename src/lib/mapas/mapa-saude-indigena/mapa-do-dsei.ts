import { acessoDoPonto } from "./territorio-do-sigepsi.ts";
import type { CoordenadasDoMapa } from "../tipos-do-mapa.ts";
import type {
  DseiDoMapa,
  RegistroDoDsei,
  TerraDoMapa,
  LinhaDaTerra,
} from "./tipos.ts";
/*
  O MAPA DE UM DSEI (MODO DETALHADO), SEM LEAFLET

  Os pontos de um distrito são os do SIGEPSI, a fonte verdadeira: os `polos`
  que `aplicarLocalizacoes` (localizacoes-do-sigepsi.ts) põe em cada DSEI —
  polos base, CASAIs e unidades de lotação, na posição, no município e na UF
  (pelo CEP) cadastrados lá. O CNES e a reconciliação com ele saíram do mapa
  em 17/11/2026.

  Mais o vínculo territorial (UF do ponto × UFs do DSEI), os filtros por tipo,
  o resumo da dica e os dois enquadramentos (território / com vínculos
  externos).
*/
import {
  VINCULO_EXTERNO,
  VINCULO_INDETERMINADO,
  classificarVinculoTerritorial,
} from "../uf-ibge.ts";
import { formatarNumero, temCoordenada, texto } from "./chaves.ts";
import {
  TIPO_CASAI,
  TIPO_POLO,
  TIPO_SEDE,
  TIPO_UNIDADE,
  tipoDaUnidade,
} from "./formas.ts";

/*
  O tipo do ponto: o do SIGEPSI (TP_UNIDADE). A unidade de lotação toma o
  tipo do nome ("UBSI BANANAL" é UBSI; "NOVO DIA", Unidade).
*/
function tipoDoPonto(tipo: unknown, nome: unknown) {
  if (tipo === "casai") return TIPO_CASAI;
  if (tipo !== "unidade") return TIPO_POLO;
  const doNome = tipoDaUnidade(nome);
  return doNome === TIPO_POLO ? TIPO_UNIDADE : doNome;
}

/* Os pontos de um DSEI, sem repetição e só com coordenada. */

export function registrosDoDsei(dsei: DseiDoMapa): RegistroDoDsei[] {
  if (!dsei?.k) return [];
  const vistos = new Set<string>();
  return (dsei.polos || [])
    .filter((p) => temCoordenada(p.lat, p.lon))
    .flatMap((p) => {
      const lat = Number(p.lat);
      const lon = Number(p.lon);
      const chave = [p.n, lat, lon].join("|");
      if (vistos.has(chave)) return [];
      vistos.add(chave);
      return [
        {
          name: p.n,
          cod: p.cod === null || p.cod === undefined ? null : String(p.cod),
          acesso: acessoDoPonto(p),
          cnes: "",
          lat,
          lon,
          city: p.municipio || "",
          // Sem CEP, sem UF: não herda a da sede (esconderia o ponto de fora
          // da área); o vínculo fica indeterminado.
          uf: p.uf || "",
          type: tipoDoPonto(p.tipo, p.n),
          origens: ["sigepsi"],
        },
      ];
    })
    .map((r, indice) => ({
      ...r,
      id: `${indice}|${r.name}|${r.lat}|${r.lon}`,
    }));
}

/*
  Vínculo territorial: a UF do ponto (pelo CEP no SIGEPSI) decide a UF
  administrativa; a coordenada só diz onde desenhar. Fora das UFs do DSEI = externo (marcador no lugar verdadeiro e
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

/* Sem acento e sem caixa, para a busca da lista. */
const paraBusca = (valor: unknown) =>
  texto(valor).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * "Buscar ponto pelo nome" (como no Mapa dos DSEIs do SIGEPSI): os polos e
 * unidades da lista cujo nome ou município contém o termo, sem acento nem
 * caixa. Termo vazio devolve a lista inteira.
 */
export function buscarNaLista(
  registros: readonly RegistroDoDsei[],
  termo: unknown,
): RegistroDoDsei[] {
  const procurado = paraBusca(termo);
  const lista = [...(registros || [])];
  if (!procurado) return lista;
  return lista.filter(
    (r) =>
      paraBusca(r.name).includes(procurado) ||
      paraBusca(r.city).includes(procurado),
  );
}

/*
  Duas perguntas, duas linhas: quantos polos base o distrito TEM (SIGEPSI) e
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
  // CASAI e outras unidades do SIGEPSI não são polo base.
  const polos = (dsei.polos || []).filter(
    (p) => !p.tipo || p.tipo === "polo",
  ).length;
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
    linhas.push(
      "UF não informada no SIGEPSI (sem CEP) — vínculo não classificado",
    );
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
