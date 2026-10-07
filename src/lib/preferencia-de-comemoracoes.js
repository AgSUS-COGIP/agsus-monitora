/*
  A preferência pessoal de não ver comemorações, neste navegador. A mesma
  chave e o mesmo formato que a mascote (Aya) lê: "1" = desligadas; ausente
  = ligadas. Quem grava é o "Para mim" de Configurações › Comemorações; quem
  respeita é toda comemoração (src/modules/comemoracao.js) e a mascote.
  Armazenamento sempre em try/catch (janela privada, bloqueado): sem ele,
  ligadas.
*/
import { gravarArmazenamento, lerArmazenamento } from "./comemoracao.js";

export const CHAVE_COMEMORACOES_PESSOAIS =
  "agsus_monitora_comemoracoes_desligadas";

/** Sem preferência guardada (ou sem armazenamento), ligadas. */
export const comemoracoesPessoaisLigadas = (armazenamento) =>
  lerArmazenamento(armazenamento, CHAVE_COMEMORACOES_PESSOAIS) !== "1";

/** Guarda a escolha ("1" ao desligar; apaga ao ligar). Devolve se conseguiu. */
export const guardarPreferenciaPessoal = (armazenamento, ligadas) =>
  gravarArmazenamento(
    armazenamento,
    CHAVE_COMEMORACOES_PESSOAIS,
    ligadas ? null : "1",
  );
