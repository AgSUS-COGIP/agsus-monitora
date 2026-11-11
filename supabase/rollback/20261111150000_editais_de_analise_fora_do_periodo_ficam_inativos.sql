/*
  ROLLBACK de 20261111150000_editais_de_analise_fora_do_periodo_ficam_inativos.sql
  Tira a tarefa diária, o gatilho, as três funções e a linha do catálogo. Não reativa
  editais: a próxima carga da planilha grava de novo o SIM/NÃO dela.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if to_regprocedure('private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"()') is null then
    raise exception 'A migration 20261111150000 não está aplicada: nada a desfazer.';
  end if;
end;
$guarda$;

select cron.unschedule('agsus_analises_inativar_editais_encerrados');

delete from public."TB_TAREFA_AGENDADA" where "NO_TAREFA" = 'agsus_analises_inativar_editais_encerrados';

drop trigger "TG_EDITALANALISE_PERIODO" on public."TB_EDITAL_ANALISE";
drop function private."FC_TG_PERIODO_EDITAL_ANALISE"();
drop function private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"();
drop function private."FC_EDITAL_ANALISE_ENCERRADO"(text, text, date);

commit;
