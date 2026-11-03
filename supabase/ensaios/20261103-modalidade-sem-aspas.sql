/*
  Ensaio da correção 20261103-modalidade-sem-aspas (begin … rollback; nada fica
  gravado). O trecho entre "-- >>> correcao" e "-- <<< correcao" é cópia
  literal da correção (tests/modalidade-sem-aspas-correcao.test.js confere).

  Reprova (raise exception, e o rollback acontece do mesmo jeito) se a
  correção reprovaria: conta do setor, aspas fora do 114 depois, número de
  linhas, edital 114/2026 intocado, modalidade vazia, assinatura.

  Mostra as contagens antes → depois e as 15 formas mais comuns (antes → depois).
*/
begin;

set local statement_timeout = '15s';

-- >>> correcao
set local lock_timeout = '3s';

-- A autoria desta transação: auth.uid() = conta do setor.
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $$
begin
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
  if auth.uid() is distinct from 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid then
    raise exception 'auth.uid() desta transação não é a conta do setor.';
  end if;
end;
$$;

-- A regra de src/lib/aprovados-import.ts (limparModalidade).
create function pg_temp.modalidade_limpa(p text) returns text language sql immutable as $f$
  select case when p is null then null else
    array_to_string(array(
      select btrim(t)
        from unnest(string_to_array(
               regexp_replace(regexp_replace(p, '["“”]\s*[,;]?\s*["“”]', ';', 'g'), '["“”]', '', 'g'),
               ';')) with ordinality u(t, ordem)
       where btrim(t) <> ''
       order by ordem), '; ') end;
$f$;

create temporary table tmp_modalidade on commit drop as
select c.id, c.modalidade, c.modalidade_original,
       pg_temp.modalidade_limpa(c.modalidade) as nova,
       pg_temp.modalidade_limpa(c.modalidade_original) as nova_original
  from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
 where (c.modalidade ~ '["“”]' or c.modalidade_original ~ '["“”]')
   -- Edital 114/2026 congelado: fora.
   and l.edital_id is distinct from 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

create temporary table tmp_contagens (
  momento text not null,
  linhas_total integer,
  com_aspas_fora_114 integer,
  com_aspas_114 integer,
  linhas_114 integer,
  md5_114 text,
  assinadas_pela_conta integer
) on commit drop;

create function pg_temp.contar(p_momento text) returns void language sql as $f$
  insert into tmp_contagens
  select p_momento,
         count(*),
         count(*) filter (where (c.modalidade ~ '["“”]' or c.modalidade_original ~ '["“”]')
                            and l.edital_id is distinct from 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'),
         count(*) filter (where (c.modalidade ~ '["“”]' or c.modalidade_original ~ '["“”]')
                            and l.edital_id = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'),
         count(*) filter (where l.edital_id = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'),
         md5(coalesce(string_agg(c.id::text || '=' || coalesce(c.modalidade, '') || '|' || coalesce(c.modalidade_original, ''), ',' order by c.id)
                        filter (where l.edital_id = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'), '')),
         count(*) filter (where c.id in (select t.id from tmp_modalidade t)
                            and c.updated_by = 'a01afddb-f64b-47d9-80e8-476a1ed14e43')
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id;
$f$;

select pg_temp.contar('antes');

update public."TB_CANDIDATO_APROVADO" c
   set modalidade = t.nova,
       modalidade_original = t.nova_original,
       updated_by = 'a01afddb-f64b-47d9-80e8-476a1ed14e43',
       updated_at = now()
  from tmp_modalidade t
 where c.id = t.id
   and (c.modalidade, c.modalidade_original) is distinct from (t.nova, t.nova_original);

select pg_temp.contar('depois');

do $$
declare
  a tmp_contagens;
  d tmp_contagens;
  v_separadas integer;
begin
  select * into a from tmp_contagens where momento = 'antes';
  select * into d from tmp_contagens where momento = 'depois';
  select count(*) into v_separadas from tmp_modalidade;
  if d.com_aspas_fora_114 <> 0 then
    raise exception 'Sobraram % linhas com aspas fora do 114: nada foi gravado.', d.com_aspas_fora_114;
  end if;
  if d.linhas_total <> a.linhas_total then
    raise exception 'O número de linhas mudou (% → %): nada foi gravado.', a.linhas_total, d.linhas_total;
  end if;
  if (d.linhas_114, d.com_aspas_114, d.md5_114) is distinct from (a.linhas_114, a.com_aspas_114, a.md5_114) then
    raise exception 'O edital 114/2026 mudou: nada foi gravado.';
  end if;
  if exists (select 1 from tmp_modalidade t
              where (t.modalidade is not null and coalesce(t.nova, '') = '')
                 or (t.modalidade_original is not null and coalesce(t.nova_original, '') = '')) then
    raise exception 'Uma modalidade ficaria vazia: nada foi gravado.';
  end if;
  if d.assinadas_pela_conta <> v_separadas then
    raise exception '% de % linhas alteradas assinadas pela conta do setor: nada foi gravado.', d.assinadas_pela_conta, v_separadas;
  end if;
end;
$$;
-- <<< correcao

select 'contagem' as tipo, c.momento as antes, null::text as depois, c.linhas_total as linhas,
       c.com_aspas_fora_114, c.com_aspas_114, c.linhas_114, c.assinadas_pela_conta,
       (select count(*) from tmp_modalidade)::integer as separadas
  from tmp_contagens c
union all
select * from (
  select 'forma', t.modalidade, t.nova, count(*)::integer, null::integer, null::integer, null::integer, null::integer, null::integer
    from tmp_modalidade t
   group by t.modalidade, t.nova
   order by count(*) desc
   limit 15) f;

rollback;
