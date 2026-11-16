/*
  ROLLBACK de 20261116120000_relatorio_da_diretoria_por_cargo_e_aprovados: apaga as duas
  RPCs e volta a regra de TP_CONTEUDO (LISTA, RESUMO, varchar(6)). Os registros de download
  'DIRETORIA' já gravados não se apagam (são a trilha de quem baixou matrícula):
  se houver algum, a regra fica com 'DIRETORIA' e o rollback avisa.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.exportar_aprovados_da_diretoria(text, text, uuid[]);
drop function if exists public.listar_vagas_por_cargo_da_visao_geral(text, uuid[]);

do $volta$
begin
  if exists (select 1 from public."TL_EXPORTACAO_APROVADO" where "TP_CONTEUDO" = 'DIRETORIA') then
    raise notice 'Rollback 20261116120000: há downloads DIRETORIA registrados; a regra de TP_CONTEUDO continua aceitando DIRETORIA.';
  else
    alter table public."TL_EXPORTACAO_APROVADO" drop constraint "CK_EXPAPROV_TPCONTEUDO";
    alter table public."TL_EXPORTACAO_APROVADO" alter column "TP_CONTEUDO" type varchar(6);
    alter table public."TL_EXPORTACAO_APROVADO" add constraint "CK_EXPAPROV_TPCONTEUDO"
      check ("TP_CONTEUDO"::text = any (array['LISTA'::character varying, 'RESUMO'::character varying]::text[]));
    comment on table public."TL_EXPORTACAO_APROVADO" is 'Cada exportação da Lista de aprovados (XLSX, CSV ou PDF, gerada no navegador): área, formato, conteúdo (lista ou resumo), filtros, total do recorte no banco, registros exportados, quem e quando. Sem dado de candidato. Grava só registrar_exportacao_aprovados.';
  end if;
end;
$volta$;

commit;
