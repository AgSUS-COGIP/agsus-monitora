/*
  Página do MONITORA que é um painel do próprio app num quadro.

  Análises curriculares (`analises.html`) é um app separado, com cabeçalho,
  filtros, KPIs e gráficos próprios, aberto dentro da página da view por
  `src/modules/pagina-do-painel.js`: endereço fixo do app e a área atual do
  menu na URL (`?area=`). Recursos dos candidatos, Entrevistas e Seleção
  saíram do quadro: são os módulos src/modulos/recursos/,
  src/modulos/entrevistas/ e src/modulos/selecao/.

  Análises curriculares, antes, era a linha `analises` de `TB_PAINEL_EXTERNO`:
  aberta como painel externo, repetida em cada área pelo menu, e só para quem
  tinha três permissões (o recurso `analises`, o recurso `paineis` e o
  `painel:<id>` dela). Agora é a view `analises`, com a permissão só do
  recurso `analises`.

  A migration `20260929100000_analises_aba_interna.sql` arquiva aquela linha
  (ativo = false). Enquanto ela não roda — e na cópia da sessão guardada no
  navegador —, a linha ainda chega ativa; `semOPainelAntigoDeAnalises` a tira
  da lista de painéis, para ela não aparecer duas vezes no menu nem na lista
  de Painéis externos da Administração.

  O painel externo "Recursos" (Apps Script, `TB_PAINEL_EXTERNO`) não é este:
  continua em Painéis até a aba nova ser aprovada.
*/
import { enderecoDoPainelNaArea } from "./endereco-do-painel.js";

export const PAGINAS_DO_PAINEL = Object.freeze({
  analises: Object.freeze({
    endereco: "/analises.html",
    titulo: "Análises curriculares",
  }),
});

export const ENDERECO_DAS_ANALISES = PAGINAS_DO_PAINEL.analises.endereco;
export const CODIGO_DO_PAINEL_ANTIGO_DE_ANALISES = "analises";

/* O endereço do quadro da view: sempre no domínio atual, com a área (`?area=`). */
export function enderecoDaPaginaDoPainel(view, origemAtual, area) {
  const pagina = PAGINAS_DO_PAINEL[view];
  if (!pagina) return "";
  return enderecoDoPainelNaArea(pagina.endereco, origemAtual, area);
}

export function enderecoDasAnalises(origemAtual, area) {
  return enderecoDaPaginaDoPainel("analises", origemAtual, area);
}

export function semOPainelAntigoDeAnalises(paineis) {
  return (Array.isArray(paineis) ? paineis : []).filter(
    (painel) =>
      String(painel?.codigo ?? "").trim() !==
      CODIGO_DO_PAINEL_ANTIGO_DE_ANALISES,
  );
}
