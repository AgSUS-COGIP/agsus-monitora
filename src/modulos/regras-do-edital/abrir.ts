import type { EtapaDasRegras } from "../../lib/regras-do-edital.ts";

/*
  "Editar nas Regras do edital" das telas de cada etapa (Triagem, Avaliação
  documental, Classificação, Entrevistas, Lista de aprovados): abre Editais
  na página Regras do edital do edital, já na etapa certa. É uma rota
  (`/<área>/editais/<edital>/regras/<etapa>`): a navegação
  (`window.navigate`) confere a permissão de Editais e põe o endereço.
*/
export type JanelaDasRegras = {
  navigate?: (
    view: string,
    extras?: { edital?: string; regras?: string },
  ) => unknown;
};

export function abrirRegrasDoEdital(
  editalId: string,
  etapa: EtapaDasRegras,
  janela = globalThis.window as JanelaDasRegras | undefined,
): boolean {
  if (!editalId || typeof janela?.navigate !== "function") return false;
  return (
    janela.navigate("nucleo", { edital: editalId, regras: etapa }) !== false
  );
}
