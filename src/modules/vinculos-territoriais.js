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

/*
  Forma além de cor. Quem não distingue vermelho de verde continua distinguindo
  círculo de losango de triângulo — a cor vira reforço, não a única informação.
*/
const FORMAS = Object.freeze({
  polo: { forma: "circulo", rotulo: "Polo base" },
  casai: { forma: "casa", rotulo: "CASAI" },
  ubsi: { forma: "cruz", rotulo: "UBSI" },
  unit: { forma: "losango", rotulo: "Unidade" },
});

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

  return linhas.join("<br>");
}

export const TOOLTIP_DA_LINHA = "Vínculo territorial — não representa trajeto";

export function textoDoChip(quantidade) {
  if (!quantidade) return "";
  return quantidade === 1
    ? "1 vínculo fora da área"
    : `${quantidade} vínculos fora da área`;
}
