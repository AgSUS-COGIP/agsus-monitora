/*
  Ensaio de 20261015000100 (mapa da Saúde Indígena só quando muda). Sempre
  termina em rollback. Cole a migration no ponto marcado (dentro do mesmo
  begin/rollback): reprova se as linhas da função forem diferentes do select
  que o front fazia (como authenticated, pela RLS), se a versão atual não
  devolver `inalterado` ou se a versão errada não devolver as linhas; mostra o
  tamanho antes e depois.
*/
begin;

-- >>> cole aqui supabase/migrations/20261015000100_mapa_da_saude_indigena_so_quando_muda.sql <<<

select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_select jsonb := (select coalesce(jsonb_agg(jsonb_build_object('chave', m.chave, 'payload', m.payload) order by m.chave), '[]'::jsonb)
                       from public."TB_CONFIG_MAPA_SAUDE_INDIG" m where m.chave in ('lmap', 'rede_cnes'));
  v_rpc jsonb := public.listar_mapa_da_saude_indigena(null);
  v_versao text := v_rpc ->> 'versao';
begin
  if v_rpc -> 'linhas' <> v_select then raise exception 'linhas diferentes do select'; end if;
  if jsonb_array_length(v_select) <> 2 then raise exception 'esperava lmap e rede_cnes, vieram %', jsonb_array_length(v_select); end if;
  if public.listar_mapa_da_saude_indigena(v_versao) <> jsonb_build_object('inalterado', true, 'versao', v_versao) then
    raise exception 'a versão atual deveria devolver só inalterado';
  end if;
  if not (public.listar_mapa_da_saude_indigena('velha') ? 'linhas') then
    raise exception 'versão velha deveria devolver as linhas';
  end if;
end;
$$;

select octet_length(public.listar_mapa_da_saude_indigena(null)::text) as completo,
       octet_length(public.listar_mapa_da_saude_indigena(public.listar_mapa_da_saude_indigena(null) ->> 'versao')::text) as sem_mudanca;

rollback;
