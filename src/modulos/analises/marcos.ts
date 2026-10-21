import type { MarcoDasAnalises } from "./tipos.ts";
/*
  Marcos da tela de Análises curriculares: edital 100% analisado, fila
  zerada e a meta de hoje batida pela equipe (card "Ritmo da análise"). Chamado pelo estado (estado.ts) sempre que as linhas do escopo
  "Ativo" chegam (do servidor ou da cópia do navegador) — Inativo e Todos
  misturam editais encerrados. Também os marcos personalizados "análises no
  dia" (src/app/marcos-personalizados.js). A regra (linha de base, transições, frases) é
  de src/lib/comemoracao.js; o aviso e os fogos, de src/modules/comemoracao.js.
  Edital concluído avisa a tela de encerramento (EVENTO_EDITAL_CONCLUIDO, em
  src/modulos/encerramento-do-edital/), que relê o banco e não repete os fogos.
  `ligadas` é o liga/desliga das comemorações que o app já leu (situação do
  sistema); desligadas, o estado segue guardado em silêncio. Este arquivo não
  importa React.
*/
import {
  chaveDoMarco,
  comemoracaoDasAnalises,
  estadoGuardadoDosEditais,
  pendentesDaFila,
  situacaoDosEditais,
} from "../../lib/comemoracao.js";
import { avaliarMarco, comemorar } from "../../modules/comemoracao.js";
import {
  gravarMetaComemorada,
  lerMetaComemorada,
  metaDaEquipeBatida,
  TEXTO_DA_META_BATIDA,
  type RitmoDoEdital,
} from "../../lib/ritmo-da-analise.ts";
import { avaliarMarcosPersonalizados } from "../../app/marcos-personalizados.js";
import { EVENTO_EDITAL_CONCLUIDO } from "../../lib/encerramento-do-edital.ts";

export function avaliarMarcosDasAnalises({
  ligadas,
  usuarioId,
  area,
  nomeDaArea,
  escopo,
  linhas,
}: MarcoDasAnalises) {
  try {
    if (escopo !== "ativo" || !usuarioId || !area) return null;
    const lista = Array.isArray(linhas) ? linhas : [];
    if (!lista.length) return null;
    const situacao = situacaoDosEditais(lista);
    const pendentes = pendentesDaFila(lista);
    // "A área passou de N análises no dia" (Configurações › Comemorações).
    avaliarMarcosPersonalizados({
      tipo: "analises-no-dia",
      linhas: lista,
      usuarioId,
      area,
      ligadas: Boolean(ligadas),
    });
    const comemoracao = avaliarMarco({
      chave: chaveDoMarco("analises", usuarioId, area),
      atual: { editais: estadoGuardadoDosEditais(situacao), fila: pendentes },
      ligadas: Boolean(ligadas),
      decidir: (anterior: { editais?: unknown; fila?: unknown } | null) =>
        comemoracaoDasAnalises({
          anteriorEditais: anterior?.editais,
          anteriorFila: anterior?.fila,
          situacao,
          pendentes,
          nomeDaArea,
        }),
    });
    const editais = comemoracao?.editais ?? [];
    if (editais.length)
      globalThis.window?.dispatchEvent(
        new CustomEvent(EVENTO_EDITAL_CONCLUIDO, { detail: { editais } }),
      );
    return comemoracao;
  } catch (erro) {
    // Comemoração nunca atrapalha a tela.
    console.warn("Marcos de Análises curriculares indisponíveis:", erro);
    return null;
  }
}

/*
  Meta de hoje batida pela equipe (card "Ritmo da análise"): uma vez por dia
  por pessoa, guardado neste navegador. Com as comemorações desligadas no
  sistema, não grava nada (religar no mesmo dia ainda comemora); o marco
  "meta-do-dia" do catálogo decide o efeito e respeita a preferência pessoal;
  com prefers-reduced-motion, só o aviso (src/modules/comemoracao.js).
*/
export function comemorarMetaDoDia({
  ritmos,
  hoje,
  usuario,
  ligadas,
  soltar = comemorar,
}: {
  ritmos: readonly RitmoDoEdital[];
  hoje: string;
  usuario: string | null | undefined;
  ligadas: boolean;
  soltar?: typeof comemorar;
}): boolean {
  try {
    if (!ligadas || !usuario) return false;
    const batida = metaDaEquipeBatida(ritmos);
    if (!batida || lerMetaComemorada(usuario) === hoje) return false;
    gravarMetaComemorada(usuario, hoje);
    soltar({
      texto: TEXTO_DA_META_BATIDA,
      marco: "meta-do-dia",
      forma: "estrela",
    });
    return true;
  } catch (erro) {
    console.warn("Comemoração da meta do dia indisponível:", erro);
    return false;
  }
}
