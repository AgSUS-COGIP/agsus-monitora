/*
  Marcos do painel de análises: edital 100% analisado e fila zerada.

  Chamado pelo analises-app.js sempre que as linhas do escopo "Ativo" chegam
  (do servidor ou da cópia do navegador). Só o escopo "Ativo" conta: Inativo
  e Todos misturam editais encerrados. A regra (linha de base, transições,
  frases) é de src/lib/comemoracao.js; o confete e o aviso, de
  src/modules/comemoracao.js. Com as comemorações desligadas, o estado segue
  guardado em silêncio.
*/
import {
  chaveDoMarco,
  comemoracaoDasAnalises,
  estadoGuardadoDosEditais,
  pendentesDaFila,
  situacaoDosEditais,
} from "../lib/comemoracao.js";
import {
  avaliarMarco,
  comemoracoesLigadasNoPainel,
} from "../modules/comemoracao.js";

export async function avaliarMarcosDasAnalises({
  supabase,
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
    const ligadas = await comemoracoesLigadasNoPainel(supabase);
    const situacao = situacaoDosEditais(lista);
    const pendentes = pendentesDaFila(lista);
    return avaliarMarco({
      chave: chaveDoMarco("analises", usuarioId, area),
      atual: { editais: estadoGuardadoDosEditais(situacao), fila: pendentes },
      ligadas,
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
    // Comemoração nunca atrapalha o painel.
    console.warn("Marcos do painel de análises indisponíveis:", erro);
    return null;
  }
}
