/*
  A LOCALIDADE DA VAGA (pedido de 16/11/2026: "nos editais que têm cargos/vagas
  com localidades distintas, adicionar aos filtros a localidade")

  Não há campo de localidade na lista de aprovados: ela vem no texto do cargo,
  num trecho separado por " - " ("Enfermeiro - Pacaraima/RR", "Técnico de
  Enfermagem - Polo Base Brasilândia - DSEI Mato Grosso do Sul - Cadastro
  Reserva", "Nutricionista - Cadastro Reserva - DSEI Guamá Tocantins - CASAI
  Paragominas"). A regra, explícita:
    1. o primeiro trecho é o cargo e fica de fora;
    2. saem os trechos de vagas ("2 vagas (1 AC + CR)", "Cadastro Reserva"),
       de modalidade (Ampla, PPIQ, PcD, Exclusiva…), de regime e de jornada;
    3. vale o primeiro trecho com marca de lugar: UF depois de barra ("/RR"),
       ou começo Polo, PB (polo base), CASAI, Distrital, Regional,
       Abrangência, Aldeia, UBS, Município, Sede, Base ou Território, ou o
       nome de um estado ("Ceará");
    4. sem trecho assim, não há localidade (o cargo fica fora do filtro).
  O trecho "DSEI X" é a unidade do edital, não a localidade.
  Duas grafias do mesmo lugar ("Pacaraima/RR" e "PACARAIMA/RR") são a mesma
  localidade: a comparação é pela chave (sem acento, sem maiúscula).
*/

const txt = (valor: unknown) => String(valor ?? "").trim();

/** Sem acento, sem maiúscula, só letras e números separados por um espaço. */
export function chaveDaLocalidade(valor: unknown): string {
  return txt(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DESCARTE = [
  /\bvagas?\b/i,
  /cadastro\s+(de\s+)?reserva/i,
  /^\(?\s*cr\s*\)?$/i,
  /ampla|ppiq|ppq|\bpcd\b|exclusiv|excluisiv|pretos|pardos|quilombol|defici[eê]n/i,
  /^(presencial|teletrabalho|h[ií]brido|remoto)$/i,
  /^\d{1,2}\s*(h|hs|horas?)(\s*semanais)?$/i,
];

const MARCA =
  /\/\s?[A-Z]{2}\b|^(polo|pb|casai|distrital|regional|abrang[eê]ncia|aldeia|ubs|munic[ií]pio|sede|base|territ[oó]rio)\b/i;

const ESTADOS = new Set(
  [
    "acre",
    "alagoas",
    "amapa",
    "amazonas",
    "bahia",
    "ceara",
    "distrito federal",
    "espirito santo",
    "goias",
    "maranhao",
    "mato grosso",
    "mato grosso do sul",
    "minas gerais",
    "para",
    "paraiba",
    "parana",
    "pernambuco",
    "piaui",
    "rio de janeiro",
    "rio grande do norte",
    "rio grande do sul",
    "rondonia",
    "roraima",
    "santa catarina",
    "sao paulo",
    "sergipe",
    "tocantins",
  ].map(chaveDaLocalidade),
);

/** A localidade escrita no texto do cargo, ou "" quando ele não traz. */
/**
 * O cargo sem a localidade e o resto da vaga: o primeiro trecho do texto
 * ("Enfermeiro - Pacaraima/RR - 2 vagas" → "Enfermeiro"). A lotação fica em
 * localidadeDoCargo: as duas viram colunas próprias na Lista de aprovados.
 */
export function cargoDaVaga(cargo: unknown): string {
  return (
    txt(cargo)
      .split(/\s+[-–—]\s+/)[0]
      ?.trim() ?? ""
  );
}

export function localidadeDoCargo(cargo: unknown): string {
  const trechos = txt(cargo)
    .split(/\s+[-–—]\s+/)
    .map((t) =>
      t
        .replace(/[\s/–—-]+$/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .slice(1);
  const lugares = trechos.filter(
    (t) => !DESCARTE.some((padrao) => padrao.test(t)),
  );
  return (
    lugares.find((t) => MARCA.test(t) || ESTADOS.has(chaveDaLocalidade(t))) ??
    ""
  );
}

/**
 * As localidades dos candidatos (nos editais escolhidos, ou em todos), uma por
 * chave, na ordem alfabética. Com menos de duas não há o que filtrar.
 */
export function opcoesDeLocalidade(
  candidatos: readonly { cargo?: unknown; edital_id?: unknown }[],
  editais: readonly string[] = [],
): string[] {
  const porChave = new Map<string, string>();
  for (const candidato of candidatos) {
    if (editais.length && !editais.includes(txt(candidato.edital_id))) continue;
    const localidade = localidadeDoCargo(candidato.cargo);
    const chave = chaveDaLocalidade(localidade);
    if (chave && !porChave.has(chave)) porChave.set(chave, localidade);
  }
  const opcoes = [...porChave.values()].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }),
  );
  return opcoes.length > 1 ? opcoes : [];
}

/** O candidato está numa das localidades escolhidas (pela chave)? */
export function naLocalidade(
  cargo: unknown,
  escolhidas: readonly string[],
): boolean {
  if (!escolhidas.length) return true;
  const chave = chaveDaLocalidade(localidadeDoCargo(cargo));
  return (
    Boolean(chave) && escolhidas.some((e) => chaveDaLocalidade(e) === chave)
  );
}
