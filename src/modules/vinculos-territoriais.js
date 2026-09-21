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
const FORMAS = Object.freeze({
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
  O tooltip nomeia o tipo, o DSEI e a UF real, e só afirma "fora das UFs de
  abrangência" quando a classificação provou isso. Para `indeterminado` a
  localização aparece sem veredito.
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

  linhas.push(...linhasDaReconciliacao(registro));

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
      ? "<i>Registo unificado: mapa anterior + Lotações + CNES</i>"
      : "<i>Registo unificado: mapa anterior + CNES</i>",
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
