import type { SnapshotDosAvisos } from "./tipos.ts";

/*
  Recorte (área × módulo) → a última lista de avisos de conferência lida e a
  versão dela, só nesta página (src/modulos/conferencias/estado.ts). Fica num
  arquivo à parte, sem dependências, para a saída (src/app/sistema.ts,
  esquecerDaPessoa) apagá-la sem trazer a tela dos avisos para o pacote
  principal: nada da pessoa que saiu fica na memória da aba.
*/
export const memoriaDosAvisos = new Map<
  string,
  { lista: SnapshotDosAvisos["lista"]; versao: string }
>();

/** Esquece as listas guardadas (saída da pessoa; também nos testes). */
export function esquecerAvisosGuardados() {
  memoriaDosAvisos.clear();
}
