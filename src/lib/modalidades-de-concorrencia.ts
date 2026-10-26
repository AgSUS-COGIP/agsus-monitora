const texto = (valor) => String(valor ?? "").trim();

const normalizarBusca = (valor) =>
  texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function modalidadesDaConcorrencia(valor) {
  const original = texto(valor);
  if (!original) return [];

  const busca = normalizarBusca(original);
  const modalidades = [];

  if (busca.includes("ampla") && busca.includes("concorr")) {
    modalidades.push("Ampla concorrência");
  }
  if (busca.includes("preto") || busca.includes("pardo")) {
    modalidades.push("Pretos e pardos");
  }
  if (busca.includes("indigen")) {
    modalidades.push("Indígenas");
  }
  if (busca.includes("quilomb")) {
    modalidades.push("Quilombolas");
  }
  if (busca.includes("defici") || busca.includes("pcd")) {
    modalidades.push("Pessoas com deficiência (PCD)");
  }

  if (modalidades.length) return modalidades;

  const limpo = original.replaceAll('"', "").trim();
  return limpo ? [limpo] : [];
}
