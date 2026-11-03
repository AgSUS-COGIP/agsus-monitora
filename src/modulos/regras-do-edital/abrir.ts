import { telaPronta } from "../../app/registro-das-telas.ts";
import type { EtapaDasRegras } from "../../lib/regras-do-edital.ts";

/*
  "Editar nas Regras do edital" das telas de cada etapa (Triagem, Avaliação
  documental, Classificação): abre Editais na página Regras do edital do
  edital, já na etapa certa. A troca de tela é a da navegação
  (`window.navigate`, que confere a permissão da página); Editais é do
  pacote principal e está sempre montada (src/app/telas.tsx).
*/
export type JanelaDasRegras = {
  navigate?: (view: string) => unknown;
};

type EditaisDasRegras = {
  abrirRegrasDoEdital?: (id: string, etapa?: EtapaDasRegras) => unknown;
};

export function abrirRegrasDoEdital(
  editalId: string,
  etapa: EtapaDasRegras,
  janela = globalThis.window as JanelaDasRegras | undefined,
  editais: () => EditaisDasRegras | undefined = () => telaPronta("nucleo"),
): boolean {
  if (!editalId || typeof janela?.navigate !== "function") return false;
  if (janela.navigate("nucleo") === false) return false;
  editais()?.abrirRegrasDoEdital?.(editalId, etapa);
  return true;
}
