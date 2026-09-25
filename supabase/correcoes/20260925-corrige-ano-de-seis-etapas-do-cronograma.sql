-- Seis etapas de cronograma com o ano digitado errado (20206, 0202, 0225).
-- Dia e mês conferidos com as etapas vizinhas do mesmo edital; só o ano muda.
-- Cada UPDATE confere o valor antigo, então rodar de novo não altera nada.
begin;

update public."TB_CRONOGRAMA_MONIT_INDIG" set data_inicio = '2026-09-14', data_fim = '2026-09-14'
 where id = 'f3077c74-3661-4f41-b637-50e0556c15e9' and data_inicio = '20206-09-14'; -- 107/2026 etapa 1
update public."TB_CRONOGRAMA_MONIT_INDIG" set data_inicio = '2026-11-12', data_fim = '2026-11-12'
 where id = '7de61c48-3545-4204-8529-1e74f9aa4f55' and data_inicio = '0202-11-12'; -- 107/2026 etapa 12
update public."TB_CRONOGRAMA_MONIT_INDIG" set data_inicio = '2026-02-25'
 where id = '2a703b31-d938-4243-a30a-c113e72257c5' and data_inicio = '0202-02-25'; -- 05/2026 etapa 2
update public."TB_CRONOGRAMA_MONIT_INDIG" set data_inicio = '2026-10-09'
 where id = '3a11de5b-1661-485f-8d10-cb65ea192cd8' and data_inicio = '0202-10-09'; -- 108/2026 etapa 5
update public."TB_CRONOGRAMA_MONIT_INDIG" set data_inicio = '2026-10-09'
 where id = 'd4d80f31-a55b-418e-9256-d9433071bca8' and data_inicio = '0202-10-09'; -- 110/2026 etapa 5
update public."TB_CRONOGRAMA_MONIT_INDIG" set data_inicio = '2025-07-24'
 where id = '11c37141-8093-4809-bbdc-8f9beaeae90f' and data_inicio = '0225-07-24'; -- FGV etapa 1

commit;
