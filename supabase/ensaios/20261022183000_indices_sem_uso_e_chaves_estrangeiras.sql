/*
  ENSAIO da migration 20261022183000_indices_sem_uso_e_chaves_estrangeiras.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado.

  Montagem (como nos outros ensaios):
    { echo begin;
      sed -n '/^-- == ANTES ==/,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261022183000_indices_sem_uso_e_chaves_estrangeiras.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261022183000_indices_sem_uso_e_chaves_estrangeiras.sql;
      sed -n '/^-- == DEPOIS ==/,$p' supabase/ensaios/20261022183000_indices_sem_uso_e_chaves_estrangeiras.sql;
    } > /tmp/ensaio.sql   (o arquivo termina em rollback)

  Antes: os seis índices existem, continuam com zero leituras e nenhum é de
  constraint. Depois: saíram, e as chaves estrangeiras de TB_ENTREVISTA.CO_ROTEIRO
  e TH_CANDIDATO_APROVADO.lista_id têm índice com a coluna na frente. Mostra o
  espaço que sai e o que entra.
*/
-- == ANTES ==
create temporary table t_ind (nome text, bytes bigint, leituras bigint) on commit drop;
insert into t_ind
select s.indexrelname, pg_relation_size(s.indexrelid), s.idx_scan
  from pg_stat_user_indexes s
 where s.schemaname = 'public'
   and s.indexrelname in ('idx_analises_curriculares_origem', 'idx_analises_curriculares_ativo_lookup',
                          'IN_ANALISECURRICULAR_VAGA', 'idx_eventos_acesso_tela_evento_created_at',
                          'idx_historico_usuario', 'idx_historico_evento_created');
do $$
begin
  if (select count(*) from t_ind) <> 6 or exists (select 1 from t_ind where leituras > 0)
     or exists (select 1 from pg_constraint c join pg_class i on i.oid = c.conindid
                 where i.relname in (select nome from t_ind)) then
    raise exception 'Ensaio: os índices mudaram desde a análise: %', (select json_agg(t) from t_ind t);
  end if;
end;
$$;
-- == aplicar a migration aqui ==

-- == DEPOIS ==
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname in (select nome from t_ind)) then
    raise exception 'Ensaio: índice que devia sair ficou.';
  end if;
  if (select count(*) from pg_constraint c
       where c.contype = 'f'
         and c.conname in ('FK_ROTEIRO_ENTREVISTA', 'lista_aprovados_historico_lista_id_fkey')
         and exists (select 1 from pg_index i
                      where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])) <> 2 then
    raise exception 'Ensaio: chave estrangeira sem índice.';
  end if;
end;
$$;

select 'sai' as o_que, count(*) as indices, pg_size_pretty(sum(bytes)) as espaco from t_ind
union all
select 'entra', count(*), pg_size_pretty(sum(pg_relation_size(c.oid)))
  from pg_class c where c.relname in ('IN_FKENTREVISTA_COROTEIRO', 'IN_FKHISTCANDAPROV_LISTA');

rollback;
