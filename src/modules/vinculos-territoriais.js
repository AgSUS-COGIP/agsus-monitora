/*
  Vínculo territorial entre as unidades e o DSEI selecionado.

  Quem decide o quê (regra fixada em 09/09/2026):

    UF administrativa  -> código IBGE do CNES
    posição do marcador -> latitude/longitude reais, nunca ajustadas
    UF_GEO              -> desenho e diagnóstico; não decide nada

  Uma unidade cuja UF não está entre as UFs de abrangência do DSEI recebe
  marcador no lugar verdadeiro e uma linha pontilhada ligando-a à sede. A linha
  é deliberadamente secundária: ela representa **vínculo**, não trajeto.
*/
import {
  VINCULO_EXTERNO,
  VINCULO_INDETERMINADO,
  classificarVinculoTerritorial,
} from "../lib/uf-ibge.js";
import { DIVERGENCIA } from "../lib/reconciliacao-unidades.js";
import { TITULO_DA_LEGENDA } from "./legenda-das-terras.js";

/*
  Forma além de cor. Quem não distingue vermelho de verde continua distinguindo
  círculo de casa de cruz de losango — a cor é reforço, nunca a única informação.

  As cores foram medidas contra os tiles reais do OSM, não escolhidas de olho.
  Amostrando a área do DSEI Potiguara: terra #f2efe9 (86.2% dos pixels),
  vegetação #add19e (2.2%), água #aad3df (1%).

  O UBSI era #189b63 — verde sobre verde. Dava 2.10:1 de contraste contra a
  vegetação, abaixo do mínimo de 3:1 que a WCAG pede para elementos gráficos, e
  ficava a apenas 52° de matiz dela: o marcador se dissolvia no mapa. O violeta
  #6d28d9 sobe para 4.19:1 e 161°, quase complementar.

  Os quatro matizes ficam separados entre si — 38°, 355°, 263° e 188°, com o par
  mais próximo a 43°.
*/
/*
  A SEDE DO DSEI NÃO TINHA FORMA NENHUMA

  Ela era desenhada, mas como um círculo azul solto, fora desta tabela: sem
  entrar na legenda, sem forma própria, indistinguível de um polo base para
  quem só vê dois círculos. É o ponto administrativo do distrito inteiro, e era
  o único que o mapa não sabia nomear.

  Estrela, porque é o símbolo de sede em cartografia desde sempre — capital num
  mapa político é estrela, e ninguém precisa de aprender isso.

  Grafite, e não uma quinta matiz. Os quatro matizes existentes estão em 38°,
  355°, 263° e 188°, com o par mais próximo a 43° — encaixar mais um sem
  colidir obrigaria a ir ao verde, que é onde a vegetação do mapa já está. A
  sede fica como o único marcador sem cor, que a distingue de todos os outros
  sem disputar espaço com nenhum.
*/
const FORMAS = Object.freeze({
  sede: { forma: "estrela", rotulo: "Sede do DSEI", cor: "#1f2937" },
  polo: { forma: "circulo", rotulo: "Polo base", cor: "#e49a1b" },
  casai: { forma: "casa", rotulo: "CASAI", cor: "#d92d3a" },
  ubsi: { forma: "cruz", rotulo: "UBSI", cor: "#6d28d9" },
  unit: { forma: "losango", rotulo: "Unidade de saúde", cor: "#0d8192" },
});

/*
  A legenda sai daqui, da mesma tabela que decide a forma e a cor de cada
  marcador — e não de HTML escrito à mão.

  Ela estava errada: desde que os marcadores passaram a ter forma própria
  (círculo, casa, cruz, losango), a legenda continuou desenhando uma bolinha
  redonda para os quatro tipos, distinguindo-os só pela cor. Além de não
  descrever mais o mapa, isso devolvia à cor o papel de única informação — o
  contrário do que as formas existem para resolver.

  A ordem segue a do mapa: os pontos que mais aparecem primeiro.
*/
export const TIPOS_DA_LEGENDA = Object.freeze([
  "sede",
  "polo",
  "casai",
  "ubsi",
  "unit",
]);

export const ESTILO_DA_LINHA = Object.freeze({
  dashArray: "6 7",
  opacity: 0.55,
  weight: 1.75,
  color: "#4a6b80",
  interactive: true,
});

export function formaDoTipo(chave) {
  return FORMAS[chave] || FORMAS.unit;
}

/*
  Anota cada registro com a classificação. Não filtra e não reordena: quem
  desenha decide o que fazer com `vinculo`.
*/
export function classificarRegistros(registros, dsei) {
  const ufs = dsei?.ufs || (dsei?.sedeuf ? [dsei.sedeuf] : []);
  return (registros || []).map((registro) => {
    const resultado = classificarVinculoTerritorial(registro.uf, ufs);
    return {
      ...registro,
      vinculo: resultado.vinculo,
      ufAdministrativa: resultado.uf,
      ufsDoDsei: resultado.ufsDoDsei,
    };
  });
}

export function registrosExternos(registros) {
  return (registros || []).filter((r) => r.vinculo === VINCULO_EXTERNO);
}

/*
  Um `indeterminado` — CNES sem UF utilizável, ou DSEI sem abrangência — conta
  como local para efeito de enquadramento. Sem prova de que está fora, tratá-lo
  como externo inventaria uma relação.
*/
export function registrosLocais(registros) {
  return (registros || []).filter((r) => r.vinculo !== VINCULO_EXTERNO);
}

export function svgDaForma(forma, cor) {
  const traco = '#ffffff" stroke-width="1.6';
  switch (forma) {
    case "estrela":
      return `<path d="M9 1.9 11.2 6.7 16.4 7.3 12.6 10.9 13.6 16.1 9 13.6 4.4 16.1 5.4 10.9 1.6 7.3 6.8 6.7Z" fill="${cor}" stroke="${traco}" stroke-linejoin="round"/>`;
    case "circulo":
      return `<circle cx="9" cy="9" r="6.4" fill="${cor}" stroke="${traco}"/>`;
    case "casa":
      return `<path d="M9 2.6 15.2 8v8.2H2.8V8Z" fill="${cor}" stroke="${traco}" stroke-linejoin="round"/>`;
    case "cruz":
      return `<path d="M7 2.8h4v4.2h4.2v4H11v4.2H7V11H2.8V7H7Z" fill="${cor}" stroke="${traco}" stroke-linejoin="round"/>`;
    default:
      return `<path d="M9 2.4 15.6 9 9 15.6 2.4 9Z" fill="${cor}" stroke="${traco}" stroke-linejoin="round"/>`;
  }
}

export function htmlDoMarcador(registro) {
  const { forma } = formaDoTipo(registro?.type?.key);
  const cor = registro?.type?.color || "#0d8192";
  const externo = registro?.vinculo === VINCULO_EXTERNO;
  return (
    `<span class="mapa-marcador${externo ? " mapa-marcador--externo" : ""}">` +
    `<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">${svgDaForma(forma, cor)}</svg>` +
    `</span>`
  );
}

const escapar = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/*
  O tooltip identifica; o popup explica.

  Antes o tooltip também contava a reconciliação — origem do registro e
  divergência entre fontes — e o popup repetia a mesma história com outras
  palavras, acrescentando as coordenadas. Como abrir um popup desloca o mapa, o
  marcador volta a passar sob o cursor, o tooltip reabre, e quem clicava ficava
  com os dois textos lado a lado dizendo o mesmo.

  Agora o tooltip nomeia o tipo, o DSEI e a UF real, e só afirma "fora das UFs
  de abrangência" quando a classificação provou isso. Para `indeterminado` a
  localização aparece sem veredito. A reconciliação está no popup, junto dos
  números que a sustentam.
*/
export function tooltipDoRegistro(registro, dsei) {
  const rotulo =
    registro?.type?.label || formaDoTipo(registro?.type?.key).rotulo;
  const linhas = [
    `<b>${escapar(rotulo)} ${escapar(registro?.name || "")}</b>`,
    `Vinculado ao DSEI ${escapar(dsei?.n || "")}`,
  ];

  if (registro?.ufAdministrativa) {
    linhas.push(`Localização: ${escapar(registro.ufAdministrativa)}`);
  }

  if (registro?.vinculo === VINCULO_EXTERNO) {
    linhas.push("Fora das UFs de abrangência do DSEI");
  } else if (registro?.vinculo === VINCULO_INDETERMINADO) {
    linhas.push("<i>UF não informada no CNES — vínculo não classificado</i>");
  }

  return linhas.join("<br>");
}

/*
  Quando um marcador representa a mesma estrutura vinda das duas fontes, quem
  olha o mapa tem de saber disso — e sobretudo tem de saber quando as duas
  discordam. Um ponto desenhado sem ressalva é lido como localização apurada.
*/
export function linhasDaReconciliacao(registro) {
  const origens = Array.isArray(registro?.origens) ? registro.origens : [];
  if (origens.length < 2) return [];

  const linhas = [
    registro?.coordenadas?.lotacoes
      ? "<i>Registro unificado: mapa anterior + Lotações + CNES</i>"
      : "<i>Registro unificado: mapa anterior + CNES</i>",
  ];
  const km = registro?.distancia_entre_fontes_km;

  if (registro?.divergencia === DIVERGENCIA.PENDENTE) {
    linhas.push(
      km == null
        ? "<b>Localização pendente de validação</b>"
        : `<b>Localização pendente de validação</b> — as fontes divergem ${km} km`,
    );
  } else if (registro?.divergencia === DIVERGENCIA.DIVERGENTE) {
    linhas.push(
      `Fontes divergem ${km} km — preservada a coordenada anterior até validação independente`,
    );
  } else if (km != null) {
    linhas.push(
      `Diferença entre mapa anterior e CNES: ${km} km — proximidade não equivale a validação`,
    );
  }

  return linhas;
}

const ROTULOS_DE_FONTE = [
  ["lmap", "mapa anterior"],
  ["lotacoes", "Lotações"],
  ["rede_cnes", "CNES"],
];

function listaEmPortugues(itens) {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/*
  Uma linha por coordenada distinta, não por fonte.

  Em POLO BASE JOAO CAMARA as Lotações e o CNES dão exatamente o mesmo ponto, e
  o popup imprimia as duas linhas idênticas uma sob a outra. Lido de fora, isso
  parece um defeito do registro. Agrupar por coordenada mostra o que de facto
  interessa: quantos pontos diferentes existem, e quais fontes sustentam cada
  um. Uma única coordenada distinta significa que as fontes concordam.

  Cinco casas decimais são cerca de um metro — mais do que a precisão de
  qualquer destes cadastros, e o suficiente para não juntar pontos distintos.
*/
export function linhasDasCoordenadas(coordenadas) {
  const porPonto = new Map();

  for (const [chave, rotulo] of ROTULOS_DE_FONTE) {
    const lat = Number(coordenadas?.[chave]?.lat);
    const lon = Number(coordenadas?.[chave]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ponto = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    if (!porPonto.has(ponto)) porPonto.set(ponto, []);
    porPonto.get(ponto).push(rotulo);
  }

  // Com uma fonte só não há o que comparar, e a coordenada já está no mapa.
  const fontes = [...porPonto.values()].reduce(
    (total, rotulos) => total + rotulos.length,
    0,
  );
  if (fontes < 2) return [];

  return [...porPonto.entries()].map(
    ([ponto, rotulos]) => `${listaEmPortugues(rotulos)}: ${ponto}`,
  );
}

export const TOOLTIP_DA_LINHA = "Vínculo territorial — não representa trajeto";

/*
  A linha pontilhada também entra na legenda: ela aparece no mapa e, sem
  explicação, é fácil lê-la como rota.
*/
export function htmlDaLegenda() {
  const tipos = TIPOS_DA_LEGENDA.map((chave) => {
    const { forma, rotulo, cor } = FORMAS[chave];
    return (
      `<span><i class="health-map-legenda-forma" aria-hidden="true">` +
      `<svg viewBox="0 0 18 18" width="14" height="14">${svgDaForma(forma, cor)}</svg>` +
      `</i>${escapar(rotulo)}</span>`
    );
  });

  tipos.push(
    `<span><i class="health-map-legenda-linha" aria-hidden="true"></i>` +
      `vínculo fora das UFs do DSEI</span>`,
  );

  /*
    As Terras Indígenas não são um item: são três, uma por fase, e cada uma é
    um interruptor. Quem as desenha é `legenda-das-terras.js`, montado pelo
    mapa do DSEI quando ele existe — este texto é só o que se lê até lá.
  */
  tipos.push(
    `<span class="legenda-das-terras" data-legenda-das-terras>` +
      `${escapar(TITULO_DA_LEGENDA)}</span>`,
  );

  return tipos.join("");
}

export function aplicarLegendaDoMapaDetalhado(documento = globalThis.document) {
  const alvo = documento?.querySelector?.(".health-map-detail-legend");
  if (!alvo) return false;
  alvo.innerHTML = htmlDaLegenda();
  return true;
}

export function textoDoChip(quantidade) {
  if (!quantidade) return "";
  return quantidade === 1
    ? "1 vínculo fora da área"
    : `${quantidade} vínculos fora da área`;
}
