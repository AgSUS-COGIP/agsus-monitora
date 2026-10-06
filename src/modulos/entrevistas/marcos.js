/*
  Marco da tela de Entrevistas: vaga pronta para o resultado final (todos os
  aprovados na análise entrevistados, todas as entrevistas com parecer).

  Chamado pelo estado da tela (estado.js) sempre que os dados da área chegam.
  `ligadas` é o liga/desliga das comemorações do app (a situação do sistema
  que o app leu na entrada; o controlador relê a cada abertura da tela). A
  regra (linha de base, transição, frase) é de src/lib/comemoracao.js; o
  aviso e fogos pequenos, de src/modules/comemoracao.js. Este arquivo não
  importa React.
*/
import {
  chaveDoMarco,
  comemoracaoDasEntrevistas,
  estadoGuardadoDasVagas,
  situacaoDasVagas,
} from "../../lib/comemoracao.js";
import { avaliarMarco } from "../../modules/comemoracao.js";

export function avaliarMarcosDasEntrevistas({
  usuarioId,
  area,
  dados,
  ligadas = false,
}) {
  try {
    if (!usuarioId || !area || !dados) return null;
    const situacao = situacaoDasVagas(dados);
    if (!Object.keys(situacao).length) return null;
    return avaliarMarco({
      chave: chaveDoMarco("vagas", usuarioId, area),
      atual: estadoGuardadoDasVagas(situacao),
      ligadas: ligadas === true,
      confete: "pequeno",
      decidir: (anterior) => comemoracaoDasEntrevistas({ anterior, situacao }),
    });
  } catch (erro) {
    // Comemoração nunca atrapalha a tela.
    console.warn("Marcos da tela de entrevistas indisponíveis:", erro);
    return null;
  }
}
