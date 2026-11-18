import type { MarcoDasAnalises } from "./tipos.ts";
/*
  Marcos da tela de Análises curriculares: edital 100% analisado (com
  efeito) e fila zerada (só o aviso). Chamado pelo estado (estado.ts) sempre que as linhas do escopo
  "Ativo" chegam (do servidor ou da cópia do navegador) — Inativo e Todos
  misturam editais encerrados. Também os marcos personalizados "análises no
  dia" (src/app/marcos-personalizados.ts). A regra (linha de base, transições, frases) é
  de src/lib/comemoracao/comemoracao.ts; o aviso e os fogos, de src/modulos/comemoracao/.
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
} from "../../lib/comemoracao/comemoracao.ts";
import { avaliarMarco } from "../../app/comemoracao-sob-demanda.ts";
import { avaliarMarcosPersonalizados } from "../../app/marcos-personalizados.ts";
import { EVENTO_EDITAL_CONCLUIDO } from "../../lib/encerramento-do-edital/encerramento-do-edital.ts";

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
