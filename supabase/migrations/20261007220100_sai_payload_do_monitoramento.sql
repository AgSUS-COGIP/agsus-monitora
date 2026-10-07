/*
  SAI get_monitoramento_dashboard_payload (07/10/2026)

  A tela deixou de chamar esta RPC em 06/10/2026 (#305: "rodava em toda carga e
  ninguém lia"), mas ela continuou recebendo chamadas: 426 de 02/10 a 07/10
  (711 ms em média, até 4,6 s; KPIs, por unidade e por edital montados sobre as
  views do monitoramento) e mais uma na manhã de 07/10, depois do deploy. Nada
  no repositório a chama (front, api/, server/, apps-script/, scripts/, outras
  funções do banco): quem chama é aba aberta antes do deploy, com o bundle
  antigo. Esse bundle já tratava o erro da RPC (console.warn e segue com as
  linhas da tabela), então tirar a função não quebra nada nele; ao recarregar,
  a pessoa recebe o bundle novo.

  Não entra em src/lib/rpc-contrato.js (já tinha saído). As views
  VW_MONITORAMENTO_INDIGENA_KPIS/_POR_UNIDADE/_POR_EDITAL ficam: outras telas
  as usam.
*/
begin;

drop function public.get_monitoramento_dashboard_payload();

notify pgrst, 'reload schema';

commit;
