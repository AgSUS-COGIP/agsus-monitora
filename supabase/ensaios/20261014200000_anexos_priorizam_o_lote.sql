/*
  Ensaio de 20261014200000 (anexos priorizam o lote). Sempre termina em
  rollback. Cole a migration no ponto marcado (dentro do mesmo begin/rollback):
  reprova se algum NO_LOTE do 114/2026 não sair com prioridade 1, se algum
  eliminado por QUESTIONARIO/CANCELADO (sem ficha aberta) sair com prioridade
  maior que 0, se algum RANQUEADO não sair com 1 ou 2, se código inválido
  devolver candidatos ou se a maior vaga passar de 2 s; mostra a contagem por
  prioridade e quantos ainda não têm resposta lida.
*/
begin;

-- >>> cole aqui supabase/migrations/20261014200000_anexos_priorizam_o_lote.sql <<<

create temp table t_prior as
select v.vaga, (x ->> 'codigo') as codigo, (x ->> 'prioridade')::integer as prioridade,
       jsonb_array_length(x -> 'lidas') as lidas
  from (select distinct p."CO_VAGA" as vaga from public."TB_PRE_CLASSIFICACAO" p
         where p."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0') v,
       lateral jsonb_array_elements(public.listar_prioridade_anexos_empregare(v.vaga) -> 'candidatos') x;

do $$
declare
  v_ruins integer;
  t0 timestamptz;
  v_ms numeric;
begin
  select count(*) into v_ruins
    from public."TB_PRE_CLASSIFICACAO" p
    join public."TB_EMPREGARE_CANDIDATO" c using ("CO_EMPREGARE_CANDIDATO")
    left join t_prior t on t.vaga = c."CO_VAGA" and t.codigo = btrim(c."CO_CANDIDATO_EMPREGARE")
   where p."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
     and c."ST_REGISTRO_ATIVO" = 'S'
     and ((p."TP_SITUACAO" = 'NO_LOTE' and t.prioridade is distinct from 1)
       or (p."TP_SITUACAO" = 'ELIMINADO' and p."CO_MOTIVO_ELIMINACAO" in ('QUESTIONARIO', 'CANCELADO')
           and coalesce(t.prioridade, 0) > 0
           and not exists (select 1 from public."TB_FICHA_ANALISE" f
                            where f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO"
                              and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')))
       or (p."TP_SITUACAO" = 'RANQUEADO' and coalesce(t.prioridade, 0) not in (1, 2)));
  if v_ruins > 0 then
    raise exception '% candidato(s) do 114/2026 com prioridade errada', v_ruins;
  end if;
  if public.listar_prioridade_anexos_empregare('x; drop') -> 'candidatos' <> '[]'::jsonb then
    raise exception 'código de vaga inválido deveria devolver lista vazia';
  end if;
  t0 := clock_timestamp();
  perform public.listar_prioridade_anexos_empregare(t.vaga)
     from (select vaga, count(*) n from t_prior group by 1 order by 2 desc limit 1) t;
  v_ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
  if v_ms > 2000 then
    raise exception 'a maior vaga levou % ms', v_ms;
  end if;
end;
$$;

select prioridade, count(*) as candidatos, count(*) filter (where lidas = 0) as sem_resposta_lida
  from t_prior group by 1 order by 1;

rollback;
