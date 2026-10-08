import type {
  ConfiguracaoDoMapa,
  DseiDoMapa,
  EstabelecimentoCompacto,
  PoloDoMapa,
  RedeCnesDoMapa,
  TerraDoMapa,
} from "./tipos.ts";

const registro = (valor: unknown): valor is Record<string, unknown> =>
  Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
const lista = (valor: unknown): unknown[] =>
  Array.isArray(valor) ? valor : [];
const texto = (valor: unknown): string =>
  typeof valor === "string"
    ? valor
    : typeof valor === "number" && Number.isFinite(valor)
      ? String(valor)
      : "";
const textos = (valor: unknown): string[] =>
  lista(valor).filter((item): item is string => typeof item === "string");
const posicao = (valor: unknown): valor is number | string | null =>
  valor === null ||
  (typeof valor === "number" && Number.isFinite(valor)) ||
  (typeof valor === "string" &&
    valor.trim() !== "" &&
    Number.isFinite(Number(valor)));
const camposTextuais = [
  "uf",
  "cnes",
  "sedeuf",
  "sede_municipio",
  "sede_uf",
  "sede_endereco",
  "sede_cnes",
];

function polo(valor: unknown): PoloDoMapa | null {
  if (!registro(valor) || typeof valor.n !== "string" || !valor.n.trim())
    return null;
  const ponto: PoloDoMapa = { ...valor, n: valor.n };
  for (const campo of ["lat", "lon"] as const) {
    if (campo in valor)
      ponto[campo] = posicao(valor[campo]) ? valor[campo] : null;
  }
  for (const campo of camposTextuais) {
    if (campo in valor) ponto[campo] = texto(valor[campo]);
  }
  if ("cod" in valor)
    ponto.cod =
      typeof valor.cod === "string" || typeof valor.cod === "number"
        ? valor.cod
        : null;
  return ponto;
}

export function configuracaoDoMapa(valor: unknown): ConfiguracaoDoMapa {
  if (!registro(valor)) return { dsei: [] };
  const dsei = lista(valor.dsei).flatMap((item): DseiDoMapa[] => {
    const ponto = polo(item);
    if (
      !ponto ||
      !registro(item) ||
      typeof item.k !== "string" ||
      !item.k.trim()
    )
      return [];
    const distrito: DseiDoMapa = { ...ponto, k: item.k };
    if ("polos" in item)
      distrito.polos = lista(item.polos).flatMap((valor) => {
        const ponto = polo(valor);
        return ponto ? [ponto] : [];
      });
    if ("ufs" in item) distrito.ufs = textos(item.ufs);
    if ("pop" in item) distrito.pop = posicao(item.pop) ? item.pop : null;
    return [distrito];
  });
  return { ...valor, dsei };
}

function estabelecimentos(valor: unknown): EstabelecimentoCompacto[] {
  return lista(valor).flatMap((item): EstabelecimentoCompacto[] => {
    if (!Array.isArray(item) || typeof item[0] !== "string" || !item[0].trim())
      return [];
    const codigo =
      typeof item[1] === "string" || typeof item[1] === "number"
        ? item[1]
        : null;
    const uf =
      typeof item[5] === "string" || typeof item[5] === "number" ? item[5] : "";
    return [
      [
        item[0],
        codigo,
        posicao(item[2]) ? item[2] : null,
        posicao(item[3]) ? item[3] : null,
        texto(item[4]),
        uf,
      ],
    ];
  });
}
export function redeCnesDoMapa(valor: unknown): RedeCnesDoMapa {
  const raiz = registro(valor) ? valor : {};
  const rede = registro(raiz.rede) ? raiz.rede : {};
  return {
    rede: Object.fromEntries(
      Object.entries(rede).map(([chave, valor]) => {
        const distrito = registro(valor) ? valor : {};
        return [
          chave,
          { u: estabelecimentos(distrito.u), c: estabelecimentos(distrito.c) },
        ];
      }),
    ),
    nac: estabelecimentos(raiz.nac),
  };
}
export function terrasDoMapa(valor: unknown): TerraDoMapa[] {
  return lista(valor).flatMap((item): TerraDoMapa[] => {
    if (!registro(item) || typeof item.nome !== "string") return [];
    const caixa = item.caixa;
    const valida =
      registro(caixa) &&
      [caixa.oeste, caixa.sul, caixa.leste, caixa.norte].every(
        (valor) => typeof valor === "number" && Number.isFinite(valor),
      );
    return [
      {
        nome: item.nome,
        povos: textos(item.povos),
        ufs: textos(item.ufs),
        fase: texto(item.fase),
        caixa: valida
          ? {
              oeste: Number(caixa.oeste),
              sul: Number(caixa.sul),
              leste: Number(caixa.leste),
              norte: Number(caixa.norte),
            }
          : null,
      },
    ];
  });
}
