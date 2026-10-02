/* Identidade da fonte, sem reconciliação por nome: índice + nome + código são
   conferidos novamente pelo banco antes de gravar. */
export function pontosEditaveisDoMapa(lmap, redeCnes, chaveDsei) {
  const pontos = [];
  const incluir = (alvo, nome, latitude, longitude, localidade = "") => {
    pontos.push({
      id: JSON.stringify(alvo),
      alvo,
      nome,
      localidade,
      latitude: latitude == null ? null : Number(latitude),
      longitude: longitude == null ? null : Number(longitude),
    });
  };
  (lmap?.dsei || []).forEach((dsei, indice) => {
    if (chaveDsei && dsei.k !== chaveDsei) return;
    incluir(
      {
        fonte: "lmap",
        tipo: "sede",
        dsei: dsei.k,
        indice,
        codigo: null,
        nome: dsei.n,
      },
      `Sede · ${dsei.n}`,
      dsei.lat,
      dsei.lon,
    );
    (dsei.polos || []).forEach((polo, i) =>
      incluir(
        {
          fonte: "lmap",
          tipo: "polo",
          dsei: dsei.k,
          indice: i,
          codigo: polo.cod == null ? null : String(polo.cod),
          nome: polo.n,
        },
        `Polo · ${polo.n}`,
        polo.lat,
        polo.lon,
        polo.uf || "",
      ),
    );
  });
  Object.entries(redeCnes?.rede || {}).forEach(([dsei, rede]) => {
    if (chaveDsei && dsei !== chaveDsei) return;
    for (const tipo of ["u", "c"]) {
      (rede[tipo] || []).forEach((ponto, indice) =>
        incluir(
          {
            fonte: "rede_cnes",
            tipo,
            dsei,
            indice,
            codigo: ponto[1] == null ? null : String(ponto[1]),
            nome: ponto[0],
          },
          `${tipo === "c" ? "CASAI" : tipo === "p" ? "Polo CNES" : "Unidade CNES"} · ${ponto[0]}`,
          ponto[2],
          ponto[3],
          [ponto[4], ponto[5]].filter(Boolean).join(" · "),
        ),
      );
    }
  });
  if (!chaveDsei) {
    (lmap?.casai || []).forEach((ponto, indice) =>
      incluir(
        {
          fonte: "lmap",
          tipo: "casai",
          dsei: null,
          indice,
          codigo: null,
          nome: ponto.n,
        },
        `CASAI · ${ponto.n}`,
        ponto.lat,
        ponto.lon,
        ponto.cidade || "",
      ),
    );
    (redeCnes?.nac || []).forEach((ponto, indice) =>
      incluir(
        {
          fonte: "rede_cnes",
          tipo: "nac",
          dsei: null,
          indice,
          codigo: ponto[1] == null ? null : String(ponto[1]),
          nome: ponto[0],
        },
        `CASAI nacional CNES · ${ponto[0]}`,
        ponto[2],
        ponto[3],
        ponto[4] || "",
      ),
    );
  }
  return pontos;
}

export function lerCoordenada(valor) {
  const texto = String(valor ?? "")
    .trim()
    .replace(",", ".");
  return /^[-+]?\d+(?:\.\d+)?$/.test(texto) ? Number(texto) : NaN;
}

export function validarCorrecaoDoMapa(latitude, longitude, motivo) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
    return "Informe latitude e longitude válidas.";
  if (
    latitude < -34.9 ||
    latitude > 6.4 ||
    longitude < -74.2 ||
    longitude > -32
  )
    return "A coordenada deve ficar nos limites do Brasil.";
  if (String(motivo ?? "").trim().length < 10)
    return "Descreva o motivo da correção (mínimo de 10 caracteres).";
  return "";
}

export const formatarCoordenada = (valor) =>
  Number.isFinite(valor) ? valor.toFixed(6) : "Sem coordenada";
