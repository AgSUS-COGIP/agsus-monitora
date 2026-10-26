import { chaveDoMarco, trocarEstadoGuardado } from "../lib/comemoracao.ts";
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
} from "../componentes/dados-do-monitoramento.ts";
import { comemorar as comemorarPadrao } from "../modules/comemoracao.ts";
import type {
  ConfiguracaoDasComemoracoes,
  MarcoPersonalizado,
  TipoPersonalizado,
} from "../lib/catalogo-de-comemoracoes.ts";
import type { SnapshotDoMonitoramento } from "../componentes/tipos-do-monitoramento.ts";

/*
  Marcos personalizados de Configurações › Comemorações, avaliados com o
  que o front já carregou (sem consulta nova ao banco):

    - "edital-contratados": as linhas do monitoramento (carga da entrada e
      Realtime) — `instalarMarcosDosEditais`, ligado em src/main.ts;
    - "analises-no-dia": as linhas da tela de Análises curriculares, a cada
      carga dela (src/modulos/analises/marcos.ts).

  Mesma regra dos outros marcos (src/lib/comemoracao.ts): linha de base em
  silêncio na primeira leitura, comemora a TRANSIÇÃO vista por esta pessoa
  neste navegador, uma vez. Desligadas (Módulos e abas), o estado segue
  guardado sem comemorar.
*/

export interface OpcoesDosMarcosPersonalizados {
  tipo: TipoPersonalizado;
  linhas: unknown;
  usuarioId: string;
  area?: string;
  ligadas?: boolean;
  config?: ConfiguracaoDasComemoracoes;
  armazenamento?: Storage;
  agora?: Date;
  comemorar?: typeof comemorarPadrao;
}

export interface DependenciasDosMarcosDosEditais {
  obterUsuario?: () => { id?: unknown } | null | undefined;
  ligadas?: () => boolean;
  assinar?: (ouvinte: () => void) => () => void;
  obter?: () => Pick<SnapshotDoMonitoramento, "linhas" | "carregado">;
  avaliar?: (opcoes: OpcoesDosMarcosPersonalizados) => unknown;
}

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
}: OpcoesDosMarcosPersonalizados): MarcoPersonalizado[] {
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
}: DependenciasDosMarcosDosEditais): () => void {
  let ultimas: SnapshotDoMonitoramento["linhas"] | null = null;
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
