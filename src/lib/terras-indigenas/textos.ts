import type { PropriedadesDaTerra } from "./tipos.ts";

type Propriedades = PropriedadesDaTerra | null | undefined;

/*
  `terrai_nome` é o nome que a Funai publica hoje em `Funai:tis_poligonais`.
  Consultado o DescribeFeatureType do GeoServer, os atributos são: gid,
  terrai_codigo, terrai_nome, etnia_nome, municipio_nome, uf_sigla,
  superficie_perimetro_ha, fase_ti, modalidade_ti, reestudo_ti, cr,
  faixa_fronteira, undadm_codigo, undadm_nome, undadm_sigla, the_geom,
  dominio_uniao, data_atualizacao, epsg.

  A lista abaixo começava em `terrai_nom` — sem o "e" final, como o shapefile
  trunca — e nenhum dos outros nomes existe na camada. O resultado era string
  vazia para todo polígono, e o tooltip da Terra Indígena nunca aparecia. Os
  nomes antigos ficam como reserva, caso a Funai republique com o esquema de
  shapefile.
*/
export function funaiFeatureName(properties: Propriedades = {}): string {
  const p = properties ?? {};
  return String(
    p.terrai_nome ||
      p.terrai_nom ||
      p.terra_nome ||
      p.ti_nome ||
      p.nome ||
      p.name ||
      "",
  ).trim();
}

/*
  Quem olha o mapa do DSEI quer saber que povos ele atende — não o nome
  cartorial do polígono. A Funai declara isso em `etnia_nome`, num só campo de
  texto e com separador inconsistente: "Pataxó, Pataxo Há-Há-Há" numa linha,
  "Guaraní e Kaingang e Xetá" noutra. Os dois casos são reais e foram vistos na
  camada publicada.

  Nada é inferido: se o campo vier vazio, a lista vem vazia e o mapa não afirma
  povo nenhum.
*/
/*
  O PREENCHIMENTO DA FUNAI NÃO É NOME DE POVO

  Em 32 das 163 terras em estudo o campo de povo vem "Não especificada". O
  balão dizia "Povo: Não especificada", como se fosse o nome de um povo. É a
  ausência do dado, escrita pela fonte, e é tratada como ausência.
*/
const PREENCHIMENTO_SEM_POVO =
  /^(n[ãa]o\s+(especificad[ao]s?|informad[ao]s?|identificad[ao]s?|declarad[ao]s?)|sem\s+informa[çc][ãa]o)$/i;

export function ehPreenchimentoSemPovo(nome: unknown): boolean {
  return PREENCHIMENTO_SEM_POVO.test(String(nome ?? "").trim());
}

export const SEM_POVO_DECLARADO = "Povo não declarado pela Funai";

export function povosDaTerraIndigena(properties: Propriedades = {}): string[] {
  const p = properties ?? {};
  const bruto = String(p.etnia_nome || p.etnias || p.etnia || "");

  const vistos = new Set<string>();
  const povos: string[] = [];
  for (const parte of bruto.split(/\s*(?:,|;|\/|\se\s)\s*/i)) {
    const nome = parte.trim();
    if (!nome || ehPreenchimentoSemPovo(nome)) continue;
    const chave = nome.toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    povos.push(nome);
  }
  return povos;
}

export const escaparHtml = (valor: unknown): string =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** A dica do contorno do DSEI: o nome vem do GeoJSON da Funai, escapado. */
export const tooltipDoDsei = (nome: unknown): string =>
  `DSEI ${escaparHtml(nome)}`;

/*
  O povo vem primeiro e em destaque; a Terra Indígena, que é o recorte
  fundiário, vem abaixo. Sem `etnia_nome` o polígono continua identificado pelo
  nome da terra — é melhor do que não dizer nada, e não inventa atendimento.
*/
export function tooltipDaTerraIndigena(properties: Propriedades = {}): string {
  const povos = povosDaTerraIndigena(properties);
  const nome = funaiFeatureName(properties);
  const uf = String(properties?.uf_sigla || "").trim();

  const linhas: string[] = [];
  if (povos.length) {
    linhas.push(
      `<b>${escaparHtml(povos.length === 1 ? "Povo" : "Povos")}: ${escaparHtml(povos.join(", "))}</b>`,
    );
  }
  if (nome) {
    linhas.push(
      `${povos.length ? "" : "<b>"}Terra Indígena ${escaparHtml(nome)}${povos.length ? "" : "</b>"}`,
    );
  }
  // Povo desconhecido diz-se, como na lista do painel; não se inventa nem se esconde.
  if (!povos.length && nome) linhas.push(`<i>${SEM_POVO_DECLARADO}</i>`);
  if (uf) linhas.push(escaparHtml(uf));

  return linhas.join("<br>");
}

/*
  O rótulo desenhado sobre o polígono, ao contrário do tooltip, compete por
  espaço com tudo o resto no mapa. Leva o povo — que é o que se quer ver — e
  cala o resto. Com muitos povos na mesma terra, dois e a contagem do que
  sobra; escrever cinco nomes numa linha ocuparia meio estado.
*/
export function rotuloDaTerraIndigena(properties: Propriedades = {}): string {
  const povos = povosDaTerraIndigena(properties);
  if (!povos.length) return funaiFeatureName(properties);
  if (povos.length <= 2) return povos.join(", ");
  return `${povos.slice(0, 2).join(", ")} +${povos.length - 2}`;
}

/*
  TERRAS PEQUENAS DEMAIS PARA SEREM VISTAS: o tooltip avisa que o círculo não
  é o limite — para ninguém o ler como tal. Ver `terraPrecisaDeSimbolo`.
*/
export const AVISO_DO_SIMBOLO =
  "<i>Área pequena nesta escala — o círculo marca a posição, não o limite</i>";

/*
  AS TERRAS QUE AINDA NÃO TÊM LIMITE

  A camada de polígonos traz seis fases — Regularizada, Declarada, Delimitada,
  Encaminhada RI, Homologada e Em Estudo —, mas só quem já tem limite
  desenhado. As 163 terras em estudo sem limite definido existem apenas como
  ponto, noutra camada.

  Sem elas o mapa mostrava polos base aparentemente fora de qualquer terra
  indígena. Medido: dos 146 polos fora de polígono, nove estão a menos de 5 km
  de uma terra em estudo, e o polo de João Câmara está a 60 metros da TI
  Mendonça do Amarelão. Esses polos atendem terra indígena — é a terra que
  ainda não tem limite publicado.

  O DESENHO TEM DE DIZER QUE NÃO É LIMITE

  Um círculo tracejado, oco, do tamanho de um marcador. Não é a área da terra,
  porque a área não existe ainda: é a posição que a Funai regista enquanto o
  estudo corre. Preenchê-lo ou desenhá-lo como polígono seria afirmar uma
  extensão que nenhum documento sustenta.
*/
export const AVISO_DE_ESTUDO =
  "<i>Terra Indígena em estudo — sem limite publicado; o círculo marca a posição</i>";

export function tooltipDaTerraEmEstudo(properties: Propriedades = {}): string {
  const povos = povosDaTerraIndigena(properties);
  const nome = funaiFeatureName(properties);
  const uf = String(properties?.uf_sigla || "").trim();

  const linhas: string[] = [];
  if (povos.length) {
    linhas.push(
      `<b>${escaparHtml(povos.length === 1 ? "Povo" : "Povos")}: ${escaparHtml(povos.join(", "))}</b>`,
    );
  }
  if (nome) {
    linhas.push(
      `${povos.length ? "" : "<b>"}Terra Indígena ${escaparHtml(nome)}${povos.length ? "" : "</b>"}`,
    );
  }
  if (!povos.length) linhas.push(`<i>${SEM_POVO_DECLARADO}</i>`);
  if (uf) linhas.push(escaparHtml(uf));
  linhas.push(AVISO_DE_ESTUDO);
  return linhas.join("<br>");
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\bDSEI\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dseiFeatureName(properties: Propriedades = {}): string {
  const preferred = [
    "dsei",
    "nome_dsei",
    "nom_dsei",
    "dsei_nome",
    "ds_nome",
    "nome",
    "name",
  ];
  for (const key of preferred) {
    const value = String(properties?.[key] || "").trim();
    if (value) return value;
  }

  for (const [key, raw] of Object.entries(properties || {})) {
    if (!/(dsei|nome|name)/i.test(key)) continue;
    const value = String(raw || "").trim();
    if (value) return value;
  }
  return "";
}

export function dseiFeatureMatches(
  feature: { properties?: Propriedades } | null | undefined,
  dseiName: unknown,
): boolean {
  const target = normalizeText(dseiName);
  if (!target) return false;

  const properties = feature?.properties || {};
  const candidates = new Set(
    [
      dseiFeatureName(properties),
      ...Object.entries(properties)
        .filter(
          ([key, value]) => /(dsei|nome|name)/i.test(key) && value != null,
        )
        .map(([, value]) => String(value)),
    ]
      .map(normalizeText)
      .filter(Boolean),
  );

  for (const candidate of candidates) {
    if (candidate === target) return true;
    if (
      candidate.length >= 6 &&
      target.length >= 6 &&
      (candidate.includes(target) || target.includes(candidate))
    ) {
      return true;
    }
  }
  return false;
}
