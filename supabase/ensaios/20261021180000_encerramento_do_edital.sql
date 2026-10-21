begin;
/*
  Ensaio de 20261021180000 (begin/rollback). Nada fica gravado.

  1. Cria a tabela e as funções e confere que hoje nenhum edital está
     encerrado (o 114/2026 ainda tem fichas no lote sem concluir).
  2. Simula o fim do lote do 114/2026: sem gatilhos (session_replication_role
     = replica, para não publicar no painel), as fichas do lote ainda abertas
     passam a CONCLUIDA pela conta do setor (a01afddb, Projetos), a última
     delas um minuto depois das outras.
  3. Como a conta do setor (authenticated): a leitura traz o 114/2026 com os
     totais, a contribuição só dela e "fechou"; marcar visto grava e repetir
     não muda; marcar edital não encerrado é recusado (22023); sem perfil
     ativo, 42501.
*/
\ir ../migrations/20261021180000_encerramento_do_edital.sql

-- 1. Hoje: nenhum edital encerrado.
do $$
begin
  if exists (select 1 from private."FC_EDITAIS_ENCERRADOS"()) then
    raise exception 'Ensaio: havia edital encerrado antes da simulação.';
  end if;
end;
$$;

-- 2. Simula o fim do lote do 114/2026.
set local session_replication_role = replica;
with abertas as (
  select f."CO_FICHA_ANALISE",
         row_number() over (order by f."CO_FICHA_ANALISE" desc) as ordem
    from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
     and f."TP_SITUACAO" not in ('CONCLUIDA', 'FORA_LOTE'))
update public."TB_FICHA_ANALISE" f
   set "TP_SITUACAO" = 'CONCLUIDA',
       "TP_RESULTADO" = 'APTO',
       "VL_NOTA_FINAL" = 1, "VL_NOTA_APURADA" = 1,
       "DS_PARECER" = 'Ensaio', "DS_LANCAMENTO" = '{}', "DS_RESULTADO" = '{}',
       "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
       "CO_USUARIO_CONCLUSAO" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43',
       "DT_CONCLUSAO" = now() + case when a.ordem = 1 then interval '1 minute' else interval '0' end
  from abertas a
 where a."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE";
set local session_replication_role = origin;

-- 3. Como a conta do setor.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

explain (analyze, buffers) select public.obter_encerramentos_do_edital();

do $$
declare
  v jsonb := public.obter_encerramentos_do_edital();
  e jsonb := v -> 'editais' -> 0;
begin
  if jsonb_array_length(v -> 'editais') <> 1 or e ->> 'numero' <> '114/2026' then
    raise exception 'Ensaio: esperava só o 114/2026, veio %', v -> 'editais';
  end if;
  if (e ->> 'visto')::boolean or not (e -> 'minha' ->> 'fechou')::boolean
     or (e -> 'minha' ->> 'fichas')::int < 1 or (e ->> 'fichas')::int < (e -> 'minha' ->> 'fichas')::int
     or (e ->> 'inscritos')::int < (e ->> 'fichas')::int or (e ->> 'dias')::int < 1 then
    raise exception 'Ensaio: números incoerentes: %', e;
  end if;
  if e ? 'avaliadores' or e -> 'minha' ? 'nome' then
    raise exception 'Ensaio: a leitura não pode trazer outras pessoas.';
  end if;
  if not public.marcar_encerramento_visto((e ->> 'id')::uuid)
     or not public.marcar_encerramento_visto((e ->> 'id')::uuid) then
    raise exception 'Ensaio: marcar visto falhou.';
  end if;
  if not (public.obter_encerramentos_do_edital() -> 'editais' -> 0 ->> 'visto')::boolean then
    raise exception 'Ensaio: visto não ficou gravado.';
  end if;
  begin
    perform public.marcar_encerramento_visto('efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80');
    raise exception 'Ensaio: aceitou marcar edital não encerrado.';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'Ensaio ok: % fichas, % inscritos, % dias; minhas %, % %%, melhor dia %',
    e ->> 'fichas', e ->> 'inscritos', e ->> 'dias', e -> 'minha' ->> 'fichas',
    e -> 'minha' ->> 'percentual', e -> 'minha' -> 'melhor_dia';
end;
$$;

select jsonb_pretty(public.obter_encerramentos_do_edital());

-- Sem perfil ativo (usuário inexistente): 42501.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
do $$
begin
  perform public.obter_encerramentos_do_edital();
  raise exception 'Ensaio: leu sem perfil ativo.';
exception when sqlstate '42501' then null;
end;
$$;

rollback;
