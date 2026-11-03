import type { EtapaDasRegras } from "../../lib/regras-do-edital.ts";

/*
  "Editar nas Regras do edital" das telas de cada etapa (Triagem, Avaliação
  documental, Classificação): abre Editais na página Regras do edital do
  edital, já na etapa certa. A troca de tela é a do legado
  (`window.navigate`, que confere a permissão da página).
*/
export type JanelaDasRegras = {
  navigate?: (view: string) => unknown;
  nucleoController?: {
    abrirRegrasDoEdital?: (id: string, etapa?: EtapaDasRegras) => unknown;
  };
};

export function abrirRegrasDoEdital(
  editalId: string,
  etapa: EtapaDasRegras,
  janela = globalThis.window as JanelaDasRegras | undefined,
): boolean {
  if (!editalId || typeof janela?.navigate !== "function") return false;
  janela.navigate("nucleo");
  janela.nucleoController?.abrirRegrasDoEdital?.(editalId, etapa);
  return true;
}
