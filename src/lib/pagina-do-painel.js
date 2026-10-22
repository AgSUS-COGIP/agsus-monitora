/*
  O que sobrou dos painéis do próprio app num quadro (iframe): nenhum. Análises
  curriculares, Recursos, Entrevistas e Seleção são módulos de src/modulos/.

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
export const CODIGO_DO_PAINEL_ANTIGO_DE_ANALISES = "analises";

export function semOPainelAntigoDeAnalises(paineis) {
  return (Array.isArray(paineis) ? paineis : []).filter(
    (painel) =>
      String(painel?.codigo ?? "").trim() !==
      CODIGO_DO_PAINEL_ANTIGO_DE_ANALISES,
  );
}
