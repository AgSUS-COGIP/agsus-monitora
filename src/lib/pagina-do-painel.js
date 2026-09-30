/*
  Páginas do MONITORA que são um painel do próprio app num quadro.

  Análises curriculares (`analises.html`) e Recursos dos candidatos
  (`recursos.html`) são apps separados, com cabeçalho, filtros, KPIs e
  gráficos próprios, abertos dentro da página da view pelo mesmo módulo
  (`src/modules/pagina-do-painel.js`): endereço fixo do app e a área atual do
  menu na URL (`?area=`). A tabela abaixo é tudo o que muda de uma para outra.

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
  entrevistas: Object.freeze({
    endereco: "/entrevistas.html",
    titulo: "Entrevistas",
  }),
  recursos: Object.freeze({
    endereco: "/recursos.html",
    titulo: "Recursos dos candidatos",
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
