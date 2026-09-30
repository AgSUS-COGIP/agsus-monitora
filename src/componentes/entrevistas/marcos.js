/*
  Marco do painel de entrevistas: vaga pronta para o resultado final (todos
  os aprovados na análise entrevistados, todas as entrevistas com parecer).

  Chamado pelo estado do painel (estado.js) sempre que os dados da área
  chegam. A regra (linha de base, transição, frase) é de src/lib/comemoracao.js;
  o aviso e um confete pequeno, de src/modules/comemoracao.js. Este arquivo
  não importa React.
*/
import {
  chaveDoMarco,
  comemoracaoDasEntrevistas,
  estadoGuardadoDasVagas,
  situacaoDasVagas,
} from "../../lib/comemoracao.js";
import {
  avaliarMarco,
  comemoracoesLigadasNoPainel,
} from "../../modules/comemoracao.js";

export async function avaliarMarcosDasEntrevistas({
  supabase,
  usuarioId,
  area,
  dados,
}) {
  try {
    if (!usuarioId || !area || !dados) return null;
    const ligadas = await comemoracoesLigadasNoPainel(supabase);
    const situacao = situacaoDasVagas(dados);
    if (!Object.keys(situacao).length) return null;
    return avaliarMarco({
      chave: chaveDoMarco("vagas", usuarioId, area),
      atual: estadoGuardadoDasVagas(situacao),
      ligadas,
      confete: "pequeno",
      decidir: (anterior) => comemoracaoDasEntrevistas({ anterior, situacao }),
    });
  } catch (erro) {
    // Comemoração nunca atrapalha o painel.
    console.warn("Marcos do painel de entrevistas indisponíveis:", erro);
    return null;
  }
}
