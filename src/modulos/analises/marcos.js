/*
  Marcos da tela de Análises curriculares: edital 100% analisado e fila
  zerada. Chamado pelo estado (estado.js) sempre que as linhas do escopo
  "Ativo" chegam (do servidor ou da cópia do navegador) — Inativo e Todos
  misturam editais encerrados. A regra (linha de base, transições, frases) é
  de src/lib/comemoracao.js; o aviso e o confete, de src/modules/comemoracao.js.
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
import { avaliarMarco } from "../../modules/comemoracao.js";

export function avaliarMarcosDasAnalises({
  ligadas,
  usuarioId,
  area,
  nomeDaArea,
  escopo,
  linhas,
}) {
  try {
    if (escopo !== "ativo" || !usuarioId || !area) return null;
    const lista = Array.isArray(linhas) ? linhas : [];
    if (!lista.length) return null;
    const situacao = situacaoDosEditais(lista);
    const pendentes = pendentesDaFila(lista);
    return avaliarMarco({
      chave: chaveDoMarco("analises", usuarioId, area),
      atual: { editais: estadoGuardadoDosEditais(situacao), fila: pendentes },
      ligadas: Boolean(ligadas),
      decidir: (anterior) =>
        comemoracaoDasAnalises({
          anteriorEditais: anterior?.editais,
          anteriorFila: anterior?.fila,
          situacao,
          pendentes,
          nomeDaArea,
        }),
    });
  } catch (erro) {
    // Comemoração nunca atrapalha a tela.
    console.warn("Marcos de Análises curriculares indisponíveis:", erro);
    return null;
  }
}
