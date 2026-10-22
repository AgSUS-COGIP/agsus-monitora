import type {
  AlvoDaCoordenadaIndigena,
  PontoEditavelIndigena,
} from "./tipos-das-coordenadas-do-mapa.ts";
import type {
  PendenciaDoEditor,
  OpcoesDaFila,
  RegrasDaFila,
  ItemDaFila,
  GravidadeDoPonto,
} from "./tipos-do-editor-de-coordenadas.ts";
import {
  pendenciasDoEditor,
  registroDoEditor,
} from "./respostas-do-editor-de-coordenadas.ts";
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
const texto = (valor: unknown) =>
  typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
const lista = (valor: unknown): unknown[] =>
  Array.isArray(valor) ? valor : [];
const registro = (valor: unknown): Record<string, unknown> =>
  registroDoEditor(valor) ? valor : {};
const posicao = (valor: unknown): number | null => {
  if (
    (typeof valor !== "number" && typeof valor !== "string") ||
    String(valor).trim() === ""
  )
    return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

export function pontosEditaveisDoMapa(
  lmap: unknown,
  redeCnes: unknown,
  chaveDsei?: string | null,
): PontoEditavelIndigena[] {
  const pontos: PontoEditavelIndigena[] = [];
  const incluir = (
    alvo: AlvoDaCoordenadaIndigena,
    nome: string,
    latitude: unknown,
    longitude: unknown,
    localidade = "",
  ) => {
    if (!alvo.nome.trim()) return;
    pontos.push({
      id: JSON.stringify(alvo),
      alvo,
      nome,
      localidade,
      latitude: posicao(latitude),
      longitude: posicao(longitude),
    });
  };
  // Iterar a lista original preserva o índice que o banco confere ao gravar.
  lista(registro(lmap).dsei).forEach((valor, indice) => {
    const dsei = registro(valor);
    if (
      typeof dsei.k !== "string" ||
      !dsei.k ||
      (chaveDsei && dsei.k !== chaveDsei)
    )
      return;
    const chave = dsei.k;
    incluir(
      {
        fonte: "lmap",
        tipo: "sede",
        dsei: chave,
        indice,
        codigo: null,
        nome: texto(dsei.n),
      },
      `Sede · ${texto(dsei.n)}`,
      dsei.lat,
      dsei.lon,
    );
    lista(dsei.polos).forEach((valorDoPolo, i) => {
      const polo = registro(valorDoPolo);
      incluir(
        {
          fonte: "lmap",
          tipo: "polo",
          dsei: chave,
          indice: i,
          codigo: polo.cod == null ? null : texto(polo.cod),
          nome: texto(polo.n),
        },
        `Polo · ${texto(polo.n)}`,
        polo.lat,
        polo.lon,
        texto(polo.uf),
      );
    });
  });
  Object.entries(registro(registro(redeCnes).rede)).forEach(([dsei, valor]) => {
    if (chaveDsei && dsei !== chaveDsei) return;
    const rede = registro(valor);
    for (const tipo of ["u", "c"] as const) {
      lista(rede[tipo]).forEach((valorDoPonto, indice) => {
        if (!Array.isArray(valorDoPonto)) return;
        const ponto: unknown[] = valorDoPonto;
        incluir(
          {
            fonte: "rede_cnes",
            tipo,
            dsei,
            indice,
            codigo: ponto[1] == null ? null : texto(ponto[1]),
            nome: texto(ponto[0]),
          },
          `${tipo === "c" ? "CASAI" : "Unidade CNES"} · ${texto(ponto[0])}`,
          ponto[2],
          ponto[3],
          [texto(ponto[4]), texto(ponto[5])].filter(Boolean).join(" · "),
        );
      });
    }
  });
  if (!chaveDsei) {
    lista(registro(lmap).casai).forEach((valor, indice) => {
      const ponto = registro(valor);
      incluir(
        {
          fonte: "lmap",
          tipo: "casai",
          dsei: null,
          indice,
          codigo: null,
          nome: texto(ponto.n),
        },
        `CASAI · ${texto(ponto.n)}`,
        ponto.lat,
        ponto.lon,
        texto(ponto.cidade),
      );
    });
    lista(registro(redeCnes).nac).forEach((valor, indice) => {
      if (!Array.isArray(valor)) return;
      const ponto: unknown[] = valor;
      incluir(
        {
          fonte: "rede_cnes",
          tipo: "nac",
          dsei: null,
          indice,
          codigo: ponto[1] == null ? null : texto(ponto[1]),
          nome: texto(ponto[0]),
        },
        `CASAI nacional CNES · ${texto(ponto[0])}`,
        ponto[2],
        ponto[3],
        texto(ponto[4]),
      );
    });
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
export const chaveDaPendencia = ({
  fonte,
  tipo,
  dsei,
  codigo,
}: {
  fonte?: unknown;
  tipo?: unknown;
  dsei?: unknown;
  codigo?: unknown;
} = {}) => [fonte, tipo, dsei, codigo].map(texto).join("|");

const comparar = (a: PontoEditavelIndigena, b: PontoEditavelIndigena) => {
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
export function sugestoesDaPendencia(
  pendencia: PendenciaDoEditor | null,
  ponto: PontoEditavelIndigena | null,
) {
  if (!pendencia) return [];
  const candidatos = (pendenciasDoEditor([pendencia])[0]?.candidatos || []).map(
    (c) => ({
      fonte: c.f,
      nome: c.n,
      terra: c.ti,
      latitude: c.lat,
      longitude: c.lon,
    }),
  );
  const municipio = coordenadasDoMunicipio(texto(pendencia.municipio));
  if (municipio)
    candidatos.push({
      fonte: "MUNICIPIO",
      nome: `${municipio.municipio}/${municipio.uf}`,
      terra: undefined,
      latitude: Number(municipio.latitude),
      longitude: Number(municipio.longitude),
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
const MOTIVOS_DE_ERRO: Readonly<Record<string, string>> = Object.freeze({
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
export function gravidadeDaPendencia(
  pendencia: PendenciaDoEditor | null,
  ponto: PontoEditavelIndigena | null,
): GravidadeDoPonto | null {
  if (!pendencia) return null;
  const sugestoes = sugestoesDaPendencia(pendencia, ponto);
  const aldeias = sugestoes
    .filter((s) => FONTES_DE_ALDEIA.has(s.fonte))
    .sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
  const melhor = aldeias[0] || sugestoes[0] || null;
  const km = aldeias[0]?.distanciaKm;
  const motivoDeErro = rotuloDoMotivo(MOTIVOS_DE_ERRO, pendencia.motivo_tipo);
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
export const REGRAS_DA_FILA: RegrasDaFila<PontoEditavelIndigena> =
  Object.freeze({
    chaveDoPonto: (ponto: PontoEditavelIndigena) =>
      chaveDaPendencia(ponto.alvo),
    chaveDaPendencia,
    gravidade: gravidadeDaPendencia,
    textoDeBusca: (item: ItemDaFila<PontoEditavelIndigena>) =>
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
export const filaDeCoordenadas = (
  pontos: readonly PontoEditavelIndigena[],
  pendencias: readonly PendenciaDoEditor[],
  opcoes?: OpcoesDaFila,
) => filaDoEditor(pontos, pendencias, opcoes, REGRAS_DA_FILA);

function rotuloDoMotivo(
  motivos: Readonly<Record<string, string>>,
  chave: unknown,
): string {
  const rotulo = motivos[texto(chave)];
  return typeof rotulo === "string" ? rotulo : "";
}
