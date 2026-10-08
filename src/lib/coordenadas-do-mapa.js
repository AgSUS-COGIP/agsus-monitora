import { coordenadasDoMunicipio } from "./coordenadas-dos-municipios.js";
import {
  filaDoEditor,
  formatarDistancia,
  listaDeSugestoes,
  nivelDaGravidade,
} from "./editor-de-coordenadas.ts";

/*
  COORDENADAS DO MAPA DA SAÚDE INDÍGENA — as regras deste mapa no editor

  As regras comuns (leitura, validação, fila, sugestões, gravidade,
  histórico) estão em `editor-de-coordenadas.ts`, que serve também ao mapa
  de Projetos. Aqui: os pontos editáveis (lmap e rede_cnes), a ligação com a
  pendência, as fontes das sugestões e os motivos de erro da auditoria.
*/

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

/*
  FILA DO EDITOR — pendências, sugestões e gravidade deste mapa

  As pendências vêm de `listar_pendencias_coordenada_mapa_saude_indigena`
  (private."TB_PENDENCIA_COORDENADA_MAPA"): um ponto é pendente enquanto não
  for conferido por um administrador. A ligação com o ponto do mapa é pela
  fonte, tipo, DSEI e código (cod do polo ou CNES), a mesma do banco.
*/

/** Chave que liga a pendência ao alvo do ponto (fonte|tipo|dsei|codigo). */
export const chaveDaPendencia = ({ fonte, tipo, dsei, codigo } = {}) =>
  [fonte, tipo, dsei ?? "", codigo ?? ""].join("|");

const comparar = (a, b) => {
  const dseiA = a.alvo?.dsei || "";
  const dseiB = b.alvo?.dsei || "";
  if (!dseiA !== !dseiB) return dseiA ? -1 : 1;
  return (
    dseiA.localeCompare(dseiB, "pt-BR") ||
    String(a.nome).localeCompare(String(b.nome), "pt-BR")
  );
};

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
  const candidatos = (pendencia.candidatos || []).map((c) => ({
    fonte: c.f,
    nome: c.n,
    terra: c.ti,
    latitude: c.lat,
    longitude: c.lon,
  }));
  const municipio = coordenadasDoMunicipio(pendencia.municipio);
  if (municipio)
    candidatos.push({
      fonte: "MUNICIPIO",
      nome: `${municipio.municipio}/${municipio.uf}`,
      latitude: municipio.latitude,
      longitude: municipio.longitude,
    });
  return listaDeSugestoes(candidatos, ponto, GRUPOS_DA_FONTE);
}

/*
  Gravidade de um ponto pendente: a régua é a aldeia/lugar sugerido mais
  perto (IBGE, Funai, OSM, PDSI) — o CNES não serve de régua porque quase
  sempre é a própria posição atual — e o motivo que a auditoria registrou:
  sede do município, ponto coletor, posição do nome do município ou aldeia
  homônima fora do DSEI já são "erro". Sem aldeia sugerida, "revisar".
*/
const MOTIVOS_DE_ERRO = Object.freeze({
  SEDE_MUNICIPAL: "Na sede do município",
  PONTO_COLETOR: "Em ponto coletor",
  NOME_MUNICIPIO: "Na posição do nome do município",
  HOMONIMO_FORA: "Aldeia de mesmo nome fora do DSEI",
});
const FONTES_DE_ALDEIA = new Set(["IBGE", "FUNAI", "OSM", "PDSI"]);

/**
 * `{ nivel, resumo, melhor }` de uma pendência: o nível (chave de
 * GRAVIDADES), uma frase curta para a fila ("Na sede do município · aldeia
 * Koiupanká a 18 km (Funai)") e a sugestão mais provável (a aldeia mais
 * perto; sem aldeia, a primeira sugestão), ou null.
 */
export function gravidadeDaPendencia(pendencia, ponto) {
  if (!pendencia) return null;
  const sugestoes = sugestoesDaPendencia(pendencia, ponto);
  const aldeias = sugestoes
    .filter((s) => FONTES_DE_ALDEIA.has(s.fonte))
    .sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
  const melhor = aldeias[0] || sugestoes[0] || null;
  const km = aldeias[0]?.distanciaKm;
  const motivoDeErro = MOTIVOS_DE_ERRO[pendencia.motivo_tipo] || "";
  const nivel = nivelDaGravidade({
    temSugestao: sugestoes.length > 0,
    motivoDeErro,
    km,
  });
  const sobreAMelhor = aldeias[0]
    ? `aldeia ${aldeias[0].nome || "sem nome"} a ${formatarDistancia(km)} (${aldeias[0].rotulo.replace(/^.*· /, "")})`
    : melhor
      ? `só ${melhor.rotulo}`
      : "nenhuma posição candidata";
  return {
    nivel,
    resumo: [motivoDeErro, sobreAMelhor].filter(Boolean).join(" · "),
    melhor,
  };
}

/** As regras deste mapa para a fila comum (`filaDoEditor`). */
export const REGRAS_DA_FILA = Object.freeze({
  chaveDoPonto: (ponto) => chaveDaPendencia(ponto.alvo),
  chaveDaPendencia,
  gravidade: gravidadeDaPendencia,
  textoDeBusca: (item) =>
    [
      item.nome,
      item.alvo?.codigo,
      item.localidade,
      item.alvo?.dsei,
      item.pendencia?.municipio,
    ]
      .filter(Boolean)
      .join(" "),
  comparar,
});

/**
 * A fila do editor deste mapa: busca por nome, CNES/código, município e
 * DSEI; em Só pendentes, o provável erro primeiro; depois DSEI e nome.
 */
export const filaDeCoordenadas = (pontos, pendencias, opcoes) =>
  filaDoEditor(pontos, pendencias, opcoes, REGRAS_DA_FILA);
