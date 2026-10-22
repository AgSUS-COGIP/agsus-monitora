/*
  Ensaio de 20261015040000 (a resposta capturada pela metade volta a ser
  pendente). Sempre termina em rollback. Cole a migration no ponto marcado:
  reprova se alguma resposta incompleta de candidato NO_LOTE do 114/2026
  (QT_PERGUNTA somado < colunas "Pergunta N") continuar em "lidas", se alguma
  completa sair de "lidas", se algum NO_LOTE não sair com prioridade 1 ou se a
  maior vaga passar de 2 s; mostra quantos NO_LOTE ficam a reler. Samuel
  (vaga 182514, resposta 8044295) tem de estar entre eles.
*/
begin;

-- >>> cole aqui supabase/migrations/20261015040000_anexos_recapturam_resposta_incompleta.sql <<<

create temp table t_prior as
select v.vaga, (x ->> 'codigo') as codigo, (x ->> 'prioridade')::integer as prioridade, x -> 'lidas' as lidas
  from (select distinct p."CO_VAGA" as vaga from public."TB_PRE_CLASSIFICACAO" p
         where p."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0') v,
       lateral jsonb_array_elements(public.listar_prioridade_anexos_empregare(v.vaga) -> 'candidatos') x;

create temp table t_lote as
select c."CO_VAGA" as vaga, btrim(c."CO_CANDIDATO_EMPREGARE") as codigo, r."CO_RESPOSTA_QUESTIONARIO" as resposta,
       r."QT_PERGUNTA" as lidas_qt,
       (select count(*) from jsonb_object_keys(c."DS_COLUNA_ORIGINAL") k where k ilike 'Pergunta%') as perguntas
  from public."TB_PRE_CLASSIFICACAO" p
  join public."TB_EMPREGARE_CANDIDATO" c using ("CO_EMPREGARE_CANDIDATO")
  join public."TB_EMPREGARE_RESPOSTA" r using ("CO_EMPREGARE_CANDIDATO")
 where p."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and p."TP_SITUACAO" = 'NO_LOTE'
   and c."ST_REGISTRO_ATIVO" = 'S' and r."QT_PERGUNTA" > 0;

do $$
declare
  v_ruins integer;
  t0 timestamptz;
  v_ms numeric;
begin
  select count(*) into v_ruins
    from t_lote l left join t_prior t on t.vaga = l.vaga and t.codigo = l.codigo
   where t.prioridade is distinct from 1
      or (l.lidas_qt < l.perguntas and t.lidas ? l.resposta)
      or (l.lidas_qt >= l.perguntas and not (t.lidas ? l.resposta));
  if v_ruins > 0 then
    raise exception '% resposta(s) NO_LOTE do 114/2026 com prioridade ou "lidas" errada', v_ruins;
  end if;
  if not exists (select 1 from t_prior where vaga = '182514' and not (lidas ? '8044295')
                   and codigo in (select codigo from t_lote where resposta = '8044295')) then
    raise exception 'a resposta 8044295 (Samuel) deveria estar pendente';
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

select count(*) filter (where l.lidas_qt < l.perguntas) as no_lote_a_reler,
       count(distinct l.vaga) filter (where l.lidas_qt < l.perguntas) as vagas,
       count(*) filter (where l.lidas_qt >= l.perguntas) as no_lote_completas
  from t_lote l;

rollback;
