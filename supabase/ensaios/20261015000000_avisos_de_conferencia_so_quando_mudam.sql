/*
  Ensaio de 20261015000000 (avisos de conferência só quando mudam). Sempre
  termina em rollback. Cole a migration no ponto marcado (dentro do mesmo
  begin/rollback) e troque o usuário pelo de um administrador global: reprova
  se a função nova devolver outra quantidade de avisos ou outros ids que a de
  sempre, se sobrar chave nula ou `exemplos` em aviso com casos, se a versão
  atual não devolver `inalterado` ou se a versão errada não devolver a lista;
  mostra o tamanho antes e depois.
*/
begin;

-- >>> cole aqui supabase/migrations/20261015000000_avisos_de_conferencia_so_quando_mudam.sql <<<

select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_antes jsonb := public.listar_avisos_conferencia(null, null)::jsonb;
  v_depois jsonb := public.listar_avisos_conferencia_se_mudou(null, null, null);
  v_versao text := v_depois ->> 'versao';
  v_ruins integer;
begin
  if jsonb_array_length(v_antes -> 'avisos') <> jsonb_array_length(v_depois -> 'avisos') then
    raise exception 'quantidade de avisos diferente: % × %',
      jsonb_array_length(v_antes -> 'avisos'), jsonb_array_length(v_depois -> 'avisos');
  end if;
  if (select array_agg(x ->> 'id' order by n) from jsonb_array_elements(v_antes -> 'avisos') with ordinality t(x, n))
     is distinct from
     (select array_agg(x ->> 'id' order by n) from jsonb_array_elements(v_depois -> 'avisos') with ordinality t(x, n)) then
    raise exception 'ids ou ordem dos avisos diferentes';
  end if;
  select count(*) into v_ruins
    from jsonb_array_elements(v_depois -> 'avisos') a(x), jsonb_each(a.x) e(k, v)
   where e.v = 'null'::jsonb;
  if v_ruins > 0 then raise exception '% chave(s) nula(s) sobraram', v_ruins; end if;
  -- Quem tem exemplos: conferido abaixo, fora do papel authenticated (que não lê os casos).
  create temp table t_com_exemplos on commit drop as
  select (a.x ->> 'id')::uuid as id
    from jsonb_array_elements(v_depois -> 'avisos') a(x)
   where a.x ? 'exemplos';
  if v_versao is null then raise exception 'sem versao'; end if;
  if public.listar_avisos_conferencia_se_mudou(null, null, v_versao) <> jsonb_build_object('inalterado', true, 'versao', v_versao) then
    raise exception 'a versão atual deveria devolver só inalterado';
  end if;
  if public.listar_avisos_conferencia_se_mudou(null, null, 'velha') ? 'inalterado' then
    raise exception 'versão velha deveria devolver a lista';
  end if;
  raise notice 'antes % bytes, depois % bytes, sem mudança % bytes',
    octet_length(v_antes::text), octet_length(v_depois::text),
    octet_length(public.listar_avisos_conferencia_se_mudou(null, null, v_versao)::text);
end;
$$;

select octet_length(public.listar_avisos_conferencia(null, null)::text) as antes,
       octet_length(public.listar_avisos_conferencia_se_mudou(null, null, null)::text) as depois;

reset role;
do $$
declare v_ruins integer;
begin
  select count(*) into v_ruins
    from t_com_exemplos t
   where exists (select 1 from public."TB_CASO_AVISO_CONFERENCIA" c where c."CO_AVISO_CONFERENCIA" = t.id);
  if v_ruins > 0 then raise exception '% aviso(s) com casos ainda levam exemplos', v_ruins; end if;
end;
$$;

rollback;
