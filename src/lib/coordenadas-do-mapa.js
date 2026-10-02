import { coordenadasDoMunicipio } from "./coordenadas-dos-municipios.js";
import { distanciaKm } from "./reconciliacao-unidades.js";

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

/*
  FILA DO EDITOR — pendências, sugestões e histórico (regras puras)

  As pendências vêm de `listar_pendencias_coordenada_mapa_saude_indigena`
  (private."TB_PENDENCIA_COORDENADA_MAPA"): um ponto é pendente enquanto não
  for conferido por um administrador. A ligação com o ponto do mapa é pela
  fonte, tipo, DSEI e código (cod do polo ou CNES), a mesma do banco.
*/

/** Chave que liga a pendência ao alvo do ponto (fonte|tipo|dsei|codigo). */
export const chaveDaPendencia = ({ fonte, tipo, dsei, codigo } = {}) =>
  [fonte, tipo, dsei ?? "", codigo ?? ""].join("|");

const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const textoDeBusca = (item) =>
  normalizar(
    [
      item.nome,
      item.alvo?.codigo,
      item.localidade,
      item.alvo?.dsei,
      item.pendencia?.municipio,
    ]
      .filter(Boolean)
      .join(" "),
  );

const comparar = (a, b) => {
  const dseiA = a.alvo?.dsei || "";
  const dseiB = b.alvo?.dsei || "";
  if (!dseiA !== !dseiB) return dseiA ? -1 : 1;
  return (
    dseiA.localeCompare(dseiB, "pt-BR") ||
    String(a.nome).localeCompare(String(b.nome), "pt-BR")
  );
};

/**
 * A fila do editor: os pontos com a pendência ligada, filtrados pela busca
 * (nome, CNES/código, município, DSEI — sem acento nem caixa) e, com
 * `soPendentes`, só os ainda não conferidos; ordenada por DSEI e nome.
 * `pendentes` conta os não conferidos de todos os pontos (ignora a busca).
 */
export function filaDeCoordenadas(
  pontos,
  pendencias,
  { busca = "", soPendentes = true } = {},
) {
  const porChave = new Map(
    (pendencias || []).map((p) => [chaveDaPendencia(p), p]),
  );
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  const todos = (pontos || []).map((ponto) => {
    const pendencia = porChave.get(chaveDaPendencia(ponto.alvo)) || null;
    return {
      ...ponto,
      pendencia,
      pendente: Boolean(pendencia && !pendencia.conferido),
    };
  });
  const itens = todos
    .filter(
      (item) =>
        (!soPendentes || item.pendente) &&
        termos.every((termo) => textoDeBusca(item).includes(termo)),
    )
    .sort(comparar);
  return { itens, pendentes: todos.filter((i) => i.pendente).length };
}

/** Uma pendência por linha da contagem: "1 pendente", "N pendentes". */
export const textoDePendentes = (n) =>
  `${n} ${n === 1 ? "pendente" : "pendentes"}`;

const GRUPOS_DA_FONTE = Object.freeze({
  CNES: { ordem: 0, rotulo: "CNES/DATASUS" },
  IBGE: { ordem: 1, rotulo: "Aldeia · IBGE" },
  FUNAI: { ordem: 1, rotulo: "Aldeia · Funai" },
  OSM: { ordem: 1, rotulo: "Lugar · OpenStreetMap" },
  PDSI: { ordem: 1, rotulo: "PDSI" },
  MUNICIPIO: { ordem: 2, rotulo: "Sede do município" },
});

/**
 * Posições candidatas de uma pendência, com a distância (km) até a posição
 * atual do ponto: CNES primeiro, depois aldeias/lugares, por fim a sede do
 * município (quando a tabela de municípios a conhece); dentro de cada grupo,
 * da mais perto para a mais longe. Posição repetida da mesma fonte sai.
 */
export function sugestoesDaPendencia(pendencia, ponto) {
  if (!pendencia) return [];
  const candidatos = [...(pendencia.candidatos || [])].map((c) => ({
    fonte: GRUPOS_DA_FONTE[c.f] ? c.f : "OUTRA",
    nome: c.n || "",
    terra: c.ti || "",
    latitude: Number(c.lat),
    longitude: Number(c.lon),
  }));
  const municipio = coordenadasDoMunicipio(pendencia.municipio);
  if (municipio)
    candidatos.push({
      fonte: "MUNICIPIO",
      nome: `${municipio.municipio}/${municipio.uf}`,
      terra: "",
      latitude: municipio.latitude,
      longitude: municipio.longitude,
    });
  const vistos = new Set();
  return candidatos
    .filter((c) => {
      const chave = `${c.fonte}|${c.latitude.toFixed(5)}|${c.longitude.toFixed(5)}`;
      if (
        !Number.isFinite(c.latitude) ||
        !Number.isFinite(c.longitude) ||
        vistos.has(chave)
      )
        return false;
      vistos.add(chave);
      return true;
    })
    .map((c) => ({
      ...c,
      id: `${c.fonte}|${c.latitude.toFixed(5)}|${c.longitude.toFixed(5)}`,
      rotulo: GRUPOS_DA_FONTE[c.fonte]?.rotulo || "Outra fonte",
      distanciaKm: distanciaKm(
        ponto?.latitude,
        ponto?.longitude,
        c.latitude,
        c.longitude,
      ),
    }))
    .sort(
      (a, b) =>
        (GRUPOS_DA_FONTE[a.fonte]?.ordem ?? 3) -
          (GRUPOS_DA_FONTE[b.fonte]?.ordem ?? 3) ||
        (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity),
    );
}

/** "350 m", "4,2 km", "73 km" ou "—" sem posição atual. */
export function formatarDistancia(km) {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km`;
}

const ACOES = Object.freeze({
  CORRECAO: "Correção",
  CONFERENCIA: "Conferido",
  DESFAZER: "Desfeito",
});
export const rotuloDaAcao = (acao) => ACOES[acao] || "Alteração";

/**
 * A alteração que o "Desfazer" volta: a mais recente do ponto, se não for um
 * desfazer, ainda não tiver sido desfeita e o ponto tinha posição antes.
 * O banco confere de novo (só a última, uma vez só).
 */
export function correcaoDesfazivel(historico) {
  const ultima = historico?.[0];
  if (
    !ultima ||
    ultima.acao === "DESFAZER" ||
    ultima.desfeito ||
    ultima.latitude_anterior == null ||
    ultima.longitude_anterior == null
  )
    return null;
  return ultima;
}
