import type { OpcoesDoEstadoDasEntrevistas } from "./tipos-do-painel.ts";
type ContextoDosMarcos = Parameters<
  NonNullable<OpcoesDoEstadoDasEntrevistas["avaliarMarcos"]>
>[0];
/*
  Marco da tela de Entrevistas: vaga pronta para o resultado final (todos os
  aprovados na análise entrevistados, todas as entrevistas com parecer).

  Chamado pelo estado da tela (estado.ts) sempre que os dados da área chegam.
  `ligadas` é o liga/desliga das comemorações do app (a situação do sistema
  que o app leu na entrada; o controlador relê a cada abertura da tela). A
  regra (linha de base, transição, frase) é de src/lib/comemoracao.js; o
  aviso e o efeito (o do marco "vaga-pronta" em Configurações ›
  Comemorações; padrão: fogos suaves), de src/modules/comemoracao.js. Este arquivo não
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
}: ContextoDosMarcos): unknown {
  try {
    if (!usuarioId || !area || !dados) return null;
    const situacao = situacaoDasVagas(dados);
    if (!Object.keys(situacao).length) return null;
    return avaliarMarco({
      chave: chaveDoMarco("vagas", usuarioId, area),
      atual: estadoGuardadoDasVagas(situacao),
      ligadas: ligadas === true,
      decidir: (anterior: unknown) =>
        comemoracaoDasEntrevistas({ anterior, situacao }),
    });
  } catch (erro) {
    // Comemoração nunca atrapalha a tela.
    console.warn("Marcos da tela de entrevistas indisponíveis:", erro);
    return null;
  }
}
