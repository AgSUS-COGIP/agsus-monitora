-- Ensaio no projeto: não persiste correções ou histórico de teste.
begin;
do $$
declare
  v_admin uuid;
  v_alvo jsonb;
  v_ponto jsonb;
  v_payload jsonb;
  v_resultado jsonb;
  v_lat double precision;
  v_lon double precision;
  v_antes bigint;
  v_fonte text;
  v_tipo text;
  v_dsei text;
  v_i integer;
  v_caminho text[];
  v_esperado jsonb;
  v_quantidade integer := 0;
begin
  select p.user_id into v_admin from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO"=p.perfil
    where p.ativo and g."ST_ADMIN_GLOBAL" and p.user_id is not null limit 1;
  assert v_admin is not null, 'Precisa de um administrador vinculado ao Auth para ensaiar.';
  perform set_config('request.jwt.claims','{}',true);
  begin
    perform public.salvar_coordenada_mapa_saude_indigena('{}',-10,-40,null,null,'Ensaio sem sessão');
    raise exception 'Aceitou sessão ausente';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid())::text,true);
  begin
    perform public.salvar_coordenada_mapa_saude_indigena('{}',-10,-40,null,null,'Ensaio sem admin');
    raise exception 'Aceitou usuário sem perfil administrador';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin)::text,true);
  assert private.is_master(), 'O contexto de teste deve ser administrador global.';
  foreach v_tipo in array array['sede','polo','casai','u','c','nac'] loop
    v_fonte := case when v_tipo in ('sede','polo','casai') then 'lmap' else 'rede_cnes' end;
    select payload into v_payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave=v_fonte;
    v_dsei := null;
    v_i := 0;
    if v_tipo in ('sede','polo') then
      v_dsei := v_payload->'dsei'->0->>'k';
      v_caminho := case when v_tipo='sede' then array['dsei','0'] else array['dsei','0','polos','0'] end;
    elsif v_tipo='casai' then v_caminho := array['casai','0'];
    elsif v_tipo='nac' then v_caminho := array['nac','0'];
    else
      select key into v_dsei from jsonb_each(v_payload->'rede')
        where jsonb_array_length(value->v_tipo)>0 limit 1;
      v_caminho := array['rede',v_dsei,v_tipo,'0'];
    end if;
    v_ponto := v_payload #> v_caminho;
    v_lat := case when v_fonte='lmap' then (v_ponto->>'lat')::double precision else (v_ponto->>2)::double precision end;
    v_lon := case when v_fonte='lmap' then (v_ponto->>'lon')::double precision else (v_ponto->>3)::double precision end;
    v_alvo := jsonb_build_object('fonte',v_fonte,'tipo',v_tipo,'dsei',v_dsei,'indice',v_i,
      'nome',case when v_fonte='lmap' then v_ponto->>'n' else v_ponto->>0 end,
      'codigo',case when v_tipo='polo' then v_ponto->>'cod' when v_fonte='rede_cnes' then v_ponto->>1 else null end);
    assert v_ponto is not null and v_lat is not null and v_lon is not null, 'Ponto de teste precisa existir.';
    select count(*) into v_antes from private."TH_COORDENADA_MAPA_SAUDE_INDIG";
    v_resultado := public.salvar_coordenada_mapa_saude_indigena(v_alvo,v_lat+0.000001,v_lon+0.000001,v_lat,v_lon,'Ensaio transacional com rollback');
    v_esperado := jsonb_set(jsonb_set(v_payload,v_caminho || array[case when v_fonte='lmap' then 'lat' else '2' end],to_jsonb(v_lat+0.000001)),
      v_caminho || array[case when v_fonte='lmap' then 'lon' else '3' end],to_jsonb(v_lon+0.000001));
    assert (select payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave=v_fonte)=v_esperado, 'Só as duas coordenadas do ponto selecionado podem mudar.';
    assert (select count(*) from private."TH_COORDENADA_MAPA_SAUDE_INDIG")=v_antes+1, 'Correção precisa de histórico.';
    assert v_resultado->'lmap' is not null and v_resultado->'rede_cnes' is not null, 'Retorno deve permitir atualizar o mapa.';
    assert exists (select 1 from private."TH_COORDENADA_MAPA_SAUDE_INDIG" where "ID_USUARIO"=v_admin and "JS_ALVO"=v_alvo
      and "NU_LATITUDE_ANTERIOR"=v_lat and "NU_LONGITUDE_ANTERIOR"=v_lon
      and "NU_LATITUDE"=v_lat+0.000001 and "NU_LONGITUDE"=v_lon+0.000001), 'Histórico deve preservar autoria e antes/depois.';
    begin
      perform public.salvar_coordenada_mapa_saude_indigena(v_alvo,v_lat+0.000002,v_lon+0.000002,v_lat,v_lon,'Ensaio conflito de coordenada');
      raise exception 'Aceitou coordenada anterior desatualizada';
    exception when serialization_failure then null; end;
    begin
      perform public.salvar_coordenada_mapa_saude_indigena(v_alvo || '{"nome":"Outro ponto"}'::jsonb,v_lat+0.000002,v_lon+0.000002,v_lat+0.000001,v_lon+0.000001,'Ensaio identidade alterada');
      raise exception 'Aceitou nome diferente';
    exception when serialization_failure then null; end;
    v_quantidade := v_quantidade+1;
  end loop;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_alvo,'NaN',-40,null,null,'Ensaio valor não finito');
    raise exception 'Aceitou NaN';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_alvo,-90,-40,null,null,'Ensaio fora do Brasil');
    raise exception 'Aceitou latitude inválida';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_alvo,-10,-40,null,null,'curto');
    raise exception 'Aceitou motivo curto';
  exception when invalid_parameter_value then null; end;
  assert not has_function_privilege('anon','public.salvar_coordenada_mapa_saude_indigena(jsonb,double precision,double precision,double precision,double precision,text)','EXECUTE'), 'Anon não pode chamar a função.';
  assert not has_table_privilege('authenticated','private."TH_COORDENADA_MAPA_SAUDE_INDIG"','SELECT'), 'Histórico não pode ficar acessível por API.';
  assert (select qual like '%is_master%' and with_check like '%is_master%'
    from pg_policies where tablename='TB_CONFIG_MAPA_SAUDE_INDIG' and policyname='mapa_saude_indigena_update_config'), 'RLS exige admin nos cadastros ativos.';
  assert (select relrowsecurity from pg_class where oid='private."TH_COORDENADA_MAPA_SAUDE_INDIG"'::regclass), 'Histórico precisa de RLS.';
  raise notice 'Ensaio aprovado para % tipos; rollback a seguir.',v_quantidade;
end;
$$;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$
declare v_visiveis integer; v_alterados integer;
begin
  select count(*) into v_visiveis from public."TB_CONFIG_MAPA_SAUDE_INDIG";
  assert v_visiveis=2, 'Leitura dos dois cadastros ativos deve continuar funcionando.';
  update public."TB_CONFIG_MAPA_SAUDE_INDIG" set updated_at=updated_at where chave='lmap';
  get diagnostics v_alterados = row_count;
  assert v_alterados=0, 'Usuário sem admin não deve escrever diretamente no mapa.';
end;
$$;
reset role;
rollback;
select 'Ensaio aprovado e transação desfeita' resultado;
