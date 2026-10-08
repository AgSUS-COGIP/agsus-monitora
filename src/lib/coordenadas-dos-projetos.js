import {
  coordenadasDaUf,
  coordenadasDoMunicipio,
} from "./coordenadas-dos-municipios.js";
import {
  filaDoEditor,
  formatarDistancia,
  listaDeSugestoes,
  nivelDaGravidade,
} from "./editor-de-coordenadas.ts";
import { rotuloDoLugar } from "./visao-geral-da-area.ts";

/*
  COORDENADAS DO MAPA DE PROJETOS — as regras deste mapa no editor

  Cada ponto do mapa de Projetos é um lugar das vagas (município, ou só a UF
  quando o edital só diz o estado), com a chave que a RPC
  `listar_municipios_das_vagas_da_area` devolve em `lugar` ('seropedica/RJ',
  'uf:PA') e a coordenada gravada no banco (public."TB_COORDENADA_LOCAL_VAGA",
  migration 20261002190000). As regras comuns (leitura, validação, fila,
  sugestões, gravidade, histórico) estão em `editor-de-coordenadas.ts`; aqui
  ficam os pontos editáveis, a ligação com a pendência
  (`listar_pendencias_coordenada_mapa_projetos`, pela chave do lugar), as
  fontes das sugestões e a régua da gravidade.
*/

const texto = (valor) => String(valor ?? "").trim();

/**
 * Os lugares que o editor pode corrigir: os que a RPC nova devolve com a
 * chave (`lugar`). `latitude`/`longitude` são as do banco (null quando o
 * lugar ainda não tem); a busca leva município, UF, projetos, editais e
 * lotações.
 */
/** @param {readonly import("../modulos/mapa-de-projetos/tipos.ts").MunicipioDoMapa[] | null | undefined} municipios @returns {import("../modulos/mapa-de-projetos/tipos.ts").PontoEditavelDoProjeto[]} */
export function pontosEditaveisDosProjetos(municipios) {
  return (Array.isArray(municipios) ? municipios : [])
    .filter((lugar) => texto(lugar?.lugar))
    .map((lugar) => {
      const editais = lugar.editais || [];
      return {
        id: lugar.lugar,
        alvo: { lugar: lugar.lugar },
        nome: rotuloDoLugar(lugar),
        nivel: lugar.nivel === "uf" ? "uf" : "municipio",
        uf: lugar.uf,
        municipioUf: lugar.municipioUf,
        codigoIbge: lugar.codigoIbge ?? null,
        localidade: (lugar.projetos || []).map((p) => p.nome).join(", "),
        editais: editais.map((e) => e.edital).filter(Boolean),
        lotacoes: [...new Set(editais.flatMap((e) => e.lotacoes || []))],
        latitude: Number.isFinite(lugar.coordenada?.latitude)
          ? lugar.coordenada.latitude
          : null,
        longitude: Number.isFinite(lugar.coordenada?.longitude)
          ? lugar.coordenada.longitude
          : null,
      };
    });
}

/** A pendência liga ao ponto pela chave do lugar. */
export const chaveDaPendenciaDoLugar = (pendencia) => texto(pendencia?.lugar);
const chaveDoPonto = (ponto) => texto(ponto?.alvo?.lugar);

const GRUPOS_DA_FONTE = Object.freeze({
  MUNICIPIO: { ordem: 0, rotulo: "Sede do município (IBGE)" },
  UF: { ordem: 0, rotulo: "Centro da UF" },
  DSEI: { ordem: 1, rotulo: "Sede do DSEI" },
  LUGAR: { ordem: 2, rotulo: "Outro lugar das vagas na UF" },
});

/**
 * Posições candidatas de um lugar, com a distância (km) até a posição atual:
 * as da pendência (sede do município pelo IBGE, também a de mesmo nome em
 * outra UF; centro da UF; sede do DSEI do mapa da Saúde Indígena; outros
 * lugares das vagas na UF) e, mesmo sem pendência, a sede do município da
 * tabela do IBGE (ou o centro da UF, para lugar só com UF). Repetidas saem.
 */
export function sugestoesDoLugar(pendencia, ponto) {
  const candidatos = (pendencia?.candidatos || []).map((c) => ({
    fonte: c.f,
    nome: c.n,
    latitude: c.lat,
    longitude: c.lon,
  }));
  if (ponto?.nivel === "uf") {
    const centro = coordenadasDaUf(ponto.uf);
    if (centro)
      candidatos.push({
        fonte: "UF",
        nome: centro.nome,
        latitude: centro.latitude,
        longitude: centro.longitude,
      });
  } else if (ponto) {
    const sede = coordenadasDoMunicipio(ponto.municipioUf, ponto.codigoIbge);
    if (sede)
      candidatos.push({
        fonte: "MUNICIPIO",
        nome: `${sede.municipio}/${sede.uf}`,
        latitude: sede.latitude,
        longitude: sede.longitude,
      });
  }
  return listaDeSugestoes(candidatos, ponto, GRUPOS_DA_FONTE);
}

/*
  Gravidade de um lugar pendente. A régua é a referência do próprio lugar —
  a sede do município (IBGE) na mesma UF, ou o centro da UF para lugar só com
  UF —, e o motivo que a carga registrou:
  - "erro": sem coordenada, município/UF que não batem, mesmo município com
    coordenadas diferentes, fora do Brasil, ou a régua a mais de 10 km;
  - "revisar": a régua entre 2 e 10 km, sem régua, ou escritório com
    endereço num edital que só diz a UF;
  - "confirmar": a posição é a da régua (até 2 km) — falta o "Conferido";
  - "sem": nenhuma posição candidata.
*/
const MOTIVOS_DE_ERRO = Object.freeze({
  SEM_COORDENADA: "Sem coordenada",
  MUNICIPIO_DIVERGE: "Município ou UF não batem",
  LUGAR_DIVERGE: "Mesmo município com coordenadas diferentes",
  FORA_DO_BRASIL: "Fora do Brasil",
});
const OUTROS_MOTIVOS = Object.freeze({
  ESCRITORIO_SO_UF: "Escritório num edital que só diz a UF",
  SO_UF: "O edital só diz a UF",
  SEDE_MUNICIPAL: "Na sede do município",
});

const reguaDoLugar = (sugestoes, ponto) =>
  ponto?.nivel === "uf"
    ? sugestoes.find((s) => s.fonte === "UF") || null
    : sugestoes
        .filter(
          (s) =>
            s.fonte === "MUNICIPIO" &&
            s.nome.toUpperCase().endsWith(`/${texto(ponto?.uf).toUpperCase()}`),
        )
        .sort(
          (a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity),
        )[0] || null;

/**
 * `{ nivel, resumo, melhor }` de um lugar pendente (com ou sem pendência
 * gravada: lugar sem coordenada também é pendente). `melhor` é a régua ou, sem
 * ela, a primeira sugestão.
 */
export function gravidadeDoLugar(pendencia, ponto) {
  if (!ponto) return null;
  const sugestoes = sugestoesDoLugar(pendencia, ponto);
  const regua = reguaDoLugar(sugestoes, ponto);
  const melhor = regua || sugestoes[0] || null;
  const semCoordenada =
    !Number.isFinite(ponto.latitude) || !Number.isFinite(ponto.longitude);
  const motivoDeErro = semCoordenada
    ? MOTIVOS_DE_ERRO.SEM_COORDENADA
    : MOTIVOS_DE_ERRO[pendencia?.motivo_tipo] || "";
  const km = regua?.distanciaKm;
  const nivel = nivelDaGravidade({
    temSugestao: sugestoes.length > 0,
    motivoDeErro,
    km,
    revisar: pendencia?.motivo_tipo === "ESCRITORIO_SO_UF",
  });
  const motivo = motivoDeErro || OUTROS_MOTIVOS[pendencia?.motivo_tipo] || "";
  const sobreAMelhor = regua
    ? semCoordenada
      ? `${regua.rotulo}: ${regua.nome}`
      : `${regua.rotulo} a ${formatarDistancia(km)}`
    : melhor
      ? `só ${melhor.rotulo}`
      : "nenhuma posição candidata";
  return {
    nivel,
    resumo: [motivo, sobreAMelhor].filter(Boolean).join(" · "),
    melhor,
  };
}

const comparar = (a, b) =>
  texto(a.uf).localeCompare(texto(b.uf), "pt-BR") ||
  (a.nivel === "uf") - (b.nivel === "uf") ||
  texto(a.nome).localeCompare(texto(b.nome), "pt-BR");

/** As regras deste mapa para a fila comum (`filaDoEditor`). */
export const REGRAS_DA_FILA_DOS_PROJETOS = Object.freeze({
  chaveDoPonto,
  chaveDaPendencia: chaveDaPendenciaDoLugar,
  gravidade: gravidadeDoLugar,
  pendenteSemPendencia: (ponto) =>
    !Number.isFinite(ponto?.latitude) || !Number.isFinite(ponto?.longitude),
  textoDeBusca: (item) =>
    [
      item.nome,
      item.municipioUf,
      item.uf,
      item.localidade,
      ...(item.editais || []),
      ...(item.lotacoes || []),
      item.pendencia?.nome,
    ]
      .filter(Boolean)
      .join(" "),
  comparar,
});

/**
 * A fila do editor do mapa de Projetos: busca por lugar, município, UF,
 * projeto, edital e lotação; em Só pendentes, o provável erro primeiro;
 * depois UF e nome. Lugar sem coordenada conta como pendente.
 */
/** @param {readonly import("../modulos/mapa-de-projetos/tipos.ts").PontoEditavelDoProjeto[]} pontos @param {readonly import("./tipos-do-editor-de-coordenadas.ts").PendenciaDoEditor[]} pendencias @param {import("./tipos-do-editor-de-coordenadas.ts").OpcoesDaFila} opcoes @returns {import("./tipos-do-editor-de-coordenadas.ts").FilaDoEditor<import("../modulos/mapa-de-projetos/tipos.ts").PontoEditavelDoProjeto>} */
export const filaDeCoordenadasDosProjetos = (pontos, pendencias, opcoes) =>
  filaDoEditor(pontos, pendencias, opcoes, REGRAS_DA_FILA_DOS_PROJETOS);

/**
 * Os lugares com a coordenada nova de um lugar (o que a RPC de gravação
 * devolveu), sem mudar o resto — para o mapa e o cache do carregador.
 */
export function aplicarCoordenada(municipios, lugar, latitude, longitude) {
  if (!Array.isArray(municipios)) return municipios;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
    return municipios;
  return municipios.map((item) =>
    item?.lugar === lugar
      ? {
          ...item,
          coordenada: {
            latitude,
            longitude,
            origem: "MANUAL",
          },
        }
      : item,
  );
}
