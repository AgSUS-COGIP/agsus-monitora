import { chaveDoMarco, trocarEstadoGuardado } from "../lib/comemoracao.js";
import {
  configuracaoDasComemoracoes,
  estadoDosPersonalizados,
  hojeComoChave,
  mensagemDoPersonalizado,
  personalizadosAlcancados,
} from "../lib/catalogo-de-comemoracoes.ts";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../componentes/dados-do-monitoramento.js";
import { comemorar as comemorarPadrao } from "../modules/comemoracao.js";

/*
  Marcos personalizados de Configurações › Comemorações, avaliados com o
  que o front já carregou (sem consulta nova ao banco):

    - "edital-contratados": as linhas do monitoramento (carga da entrada e
      Realtime) — `instalarMarcosDosEditais`, ligado em src/main.js;
    - "analises-no-dia": as linhas da tela de Análises curriculares, a cada
      carga dela (src/modulos/analises/marcos.js).

  Mesma regra dos outros marcos (src/lib/comemoracao.js): linha de base em
  silêncio na primeira leitura, comemora a TRANSIÇÃO vista por esta pessoa
  neste navegador, uma vez. Desligadas (Módulos e abas), o estado segue
  guardado sem comemorar.
*/

/**
 * Avalia os personalizados de um `tipo` com `linhas`. Devolve os marcos
 * comemorados (o primeiro no aviso, os demais na lista) ou [].
 */
export function avaliarMarcosPersonalizados({
  tipo,
  linhas,
  usuarioId,
  area = "todas",
  ligadas = false,
  config = configuracaoDasComemoracoes(),
  armazenamento = globalThis.window?.localStorage,
  agora = new Date(),
  comemorar = comemorarPadrao,
}) {
  try {
    const personalizados = config.personalizados.filter(
      (p) => p.tipo === tipo && p.meta,
    );
    if (!usuarioId || !personalizados.length) return [];
    const atual = estadoDosPersonalizados(personalizados, tipo, {
      linhas: Array.isArray(linhas) ? linhas : [],
      dia: hojeComoChave(agora),
    });
    const anterior = trocarEstadoGuardado({
      armazenamento,
      chave: chaveDoMarco(`pessoal-${tipo}`, usuarioId, area),
      atual,
    });
    if (anterior === null || !ligadas) return [];
    const alcancados = personalizadosAlcancados(
      anterior,
      atual,
      personalizados,
    );
    const [primeiro, ...demais] = alcancados;
    if (!primeiro) return [];
    comemorar({
      texto: mensagemDoPersonalizado(primeiro),
      itens: demais.map(mensagemDoPersonalizado),
      marco: primeiro.id,
    });
    return alcancados;
  } catch (erro) {
    // Comemoração nunca atrapalha a tela.
    console.warn("Marcos personalizados indisponíveis:", erro);
    return [];
  }
}

/**
 * Acompanha as linhas do monitoramento e avalia "edital chegou a N
 * contratados" a cada carga. Devolve o cancelamento.
 */
export function instalarMarcosDosEditais({
  obterUsuario,
  ligadas,
  assinar = assinarDadosDoMonitoramento,
  obter = obterDadosDoMonitoramento,
  avaliar = avaliarMarcosPersonalizados,
}) {
  let ultimas = null;
  const aoMudar = () => {
    const { linhas, carregado } = obter();
    if (!carregado || linhas === ultimas) return;
    ultimas = linhas;
    avaliar({
      tipo: "edital-contratados",
      linhas,
      usuarioId: String(obterUsuario?.()?.id || "").trim(),
      ligadas: ligadas?.() === true,
    });
  };
  return assinar(aoMudar);
}
