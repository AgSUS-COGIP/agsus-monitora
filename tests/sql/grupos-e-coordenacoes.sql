-- Perfis de acesso, coordenações e gestão delegada (migrations 20260929121000–121300 e 190200).
-- Rode só num banco de teste isolado, com as migrations aplicadas.
-- Identidades sintéticas; o rollback final não deixa rastro.
begin;

-- 1. Semente dos perfis = função fixa antiga, célula a célula --------------------------
do $$
begin
  if exists (
    select 1
      from unnest(array['usuario','edital_gestor','contratador','admin']) p(perfil)
     cross join unnest(array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes']) r(recurso)
     where private."FC_NIVEL_DO_GRUPO"(p.perfil, r.recurso) is distinct from private.nivel_padrao_recurso(p.perfil, r.recurso)
  ) then raise exception 'Perfis semente divergem de nivel_padrao_recurso'; end if;
end;
$$;

-- 2. Cenário: área Saúde Indígena, dois editais, coordenação Norte só com a unidade A --
insert into public."TB_MONITORAMENTO_INDIGENA" (id, edital, unidade, responsavel, ativo, "CO_AREA") values
('30000000-0000-0000-0000-000000000001', 'Edital T1', 'Unidade Teste A', 'USI', true, 'saude-indigena'),
('30000000-0000-0000-0000-000000000002', 'Edital T2', 'Unidade Teste B', 'USI', true, 'saude-indigena');
insert into public."TB_COORDENACAO" ("CO_COORDENACAO","NO_COORDENACAO","CO_AREA","TP_RESPONSAVEL") values
('norte-teste', 'Norte (teste)', 'saude-indigena', 'USI');
insert into public."RL_COORDENACAO_UNIDADE" values ('norte-teste', 'Unidade Teste A');

insert into public."TB_PERFIL_USUARIO" (id,user_id,email,nome,perfil,ativo,updated_at,"CO_COORDENACAO") values
('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011','adm@test.invalid','Admin','admin',true,now(),null),
('10000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000012','coord@test.invalid','Coord','coordenador',true,now(),'norte-teste'),
('10000000-0000-0000-0000-000000000013','20000000-0000-0000-0000-000000000013','membro@test.invalid','Membro','usuario',true,now(),'norte-teste'),
('10000000-0000-0000-0000-000000000014','20000000-0000-0000-0000-000000000014','fora@test.invalid','Fora','usuario',true,now(),null);
insert into public."RL_PERFIL_USUARIO_AREA" values ('10000000-0000-0000-0000-000000000014','saude-indigena',now());
-- TB_SOLICITACAO_ACESSO.user_id referencia auth.users.
insert into auth.users (id, email) values ('20000000-0000-0000-0000-000000000015', 'novo@test.invalid');
insert into public."TB_SOLICITACAO_ACESSO" (id,user_id,email,nome,status,perfil_solicitado,"CO_COORDENACAO") values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000015','novo@test.invalid','Novo','pendente','usuario','norte-teste');

-- 3. Membro da coordenação: vê só o edital da unidade A --------------------------------
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000013","email":"membro@test.invalid"}',true);
set local role authenticated;
do $$
begin
  if not private."FC_PODE_VER_EDITAL"('30000000-0000-0000-0000-000000000001') then raise exception 'Membro perdeu o edital da coordenação'; end if;
  if private."FC_PODE_VER_EDITAL"('30000000-0000-0000-0000-000000000002') then raise exception 'Membro vê edital fora da coordenação'; end if;
  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = '30000000-0000-0000-0000-000000000002') then
    raise exception 'Policy deixou passar edital fora da coordenação';
  end if;
  if (public.obter_contexto_monitora() -> 'profile' -> 'coordenacao' ->> 'codigo') <> 'norte-teste' then
    raise exception 'Contexto sem a coordenação';
  end if;
  begin
    perform public.obter_matriz_acessos('', 0, '');
    raise exception 'Membro sem Acessos abriu a matriz';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

-- 4. Sem coordenação: a área inteira, como antes ----------------------------------------
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000014","email":"fora@test.invalid"}',true);
set local role authenticated;
do $$
begin
  if private."FC_EDITAIS_VISIVEIS"() is not null then raise exception 'Sem coordenação ganhou recorte'; end if;
  if not private."FC_PODE_VER_EDITAL"('30000000-0000-0000-0000-000000000002') then raise exception 'Sem coordenação perdeu a área'; end if;
end;
$$;
reset role;

-- 5. Coordenador: gerencia a própria coordenação, com teto --------------------------------
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000012","email":"coord@test.invalid"}',true);
set local role authenticated;
do $$
declare m jsonb; negado boolean;
begin
  m := public.obter_matriz_acessos('', 0, '');
  if exists (select 1 from jsonb_array_elements(m->'usuarios') u where u->>'coordenacao' is distinct from 'norte-teste') then
    raise exception 'Coordenador vê usuário de fora';
  end if;
  -- origem: sem exceção, a célula segue o perfil
  if (select u->'permissoes'->'nucleo'->>'origem' from jsonb_array_elements(m->'usuarios') u where u->>'id' = '10000000-0000-0000-0000-000000000013') <> 'grupo' then
    raise exception 'Origem errada';
  end if;
  -- dentro do teto (coordenador é editor em nucleo)
  perform public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000013","recurso":"nucleo","nivel":"editor","revisao":0}]', 'Teste teto');
  -- acima do teto
  negado := false;
  begin perform public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000013","recurso":"nucleo","nivel":"admin","revisao":1}]', 'Acima');
  exception when insufficient_privilege then negado := true; end;
  if not negado then raise exception 'Coordenador passou do teto'; end if;
  -- conceder Acessos
  negado := false;
  begin perform public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000013","recurso":"acessos","nivel":"editor","revisao":0}]', 'Acessos');
  exception when insufficient_privilege then negado := true; end;
  if not negado then raise exception 'Coordenador concedeu Acessos'; end if;
  -- usuário de fora
  negado := false;
  begin perform public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000014","recurso":"nucleo","nivel":"leitor","revisao":0}]', 'Fora');
  exception when insufficient_privilege then negado := true; end;
  if not negado then raise exception 'Coordenador alterou usuário de fora'; end if;
  -- a si mesmo
  negado := false;
  begin perform public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000012","recurso":"nucleo","nivel":"leitor","revisao":0}]', 'Eu');
  exception when insufficient_privilege then negado := true; end;
  if not negado then raise exception 'Coordenador alterou a si mesmo'; end if;
  -- mudar coordenação
  negado := false;
  begin perform public.salvar_matriz_acessos(jsonb_build_array(jsonb_build_object('tipo','coordenacao','usuario_id','10000000-0000-0000-0000-000000000013','coordenacao',null,
    'revisao',(select updated_at::text from public."TB_PERFIL_USUARIO" where id='10000000-0000-0000-0000-000000000013'))), 'Mover');
  exception when insufficient_privilege then negado := true; end;
  if not negado then raise exception 'Coordenador mudou coordenação'; end if;
  -- voltar ao padrão apaga a exceção
  perform public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000013","recurso":"nucleo","nivel":null,"revisao":1}]', 'Padrão');
  -- ver como: só da própria coordenação
  if (public.obter_contexto_de_usuario('10000000-0000-0000-0000-000000000013') -> 'escopo' ->> 'editais_visiveis')::int <> 1 then
    raise exception 'Ver como com escopo errado';
  end if;
  negado := false;
  begin perform public.obter_contexto_de_usuario('10000000-0000-0000-0000-000000000014');
  exception when insufficient_privilege then negado := true; end;
  if not negado then raise exception 'Ver como de fora da coordenação'; end if;
  -- solicitação da própria coordenação, perfil dentro do teto
  perform public.aprovar_solicitacao_acesso('40000000-0000-0000-0000-000000000001', 'usuario', null, null, 'ok');
end;
$$;
reset role;

-- 6. Aba Recursos: o coordenador (recursos = editor) só vê e grava na coordenação ------------
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000012","email":"coord@test.invalid"}',true);
set local role authenticated;
do $$
declare
  v_editais jsonb := public.get_recursos_da_area('saude-indigena')::jsonb -> 'editais';
begin
  if not v_editais @> '[{"id":"30000000-0000-0000-0000-000000000001"}]' then raise exception 'Recursos sem o edital da coordenação'; end if;
  if v_editais @> '[{"id":"30000000-0000-0000-0000-000000000002"}]' then raise exception 'Recursos lista edital fora da coordenação'; end if;
  begin
    perform public.buscar_candidatos_recurso('30000000-0000-0000-0000-000000000002', 'teste');
    raise exception 'Recursos buscou candidato fora da coordenação';
  exception when insufficient_privilege then null; end;
  begin
    perform public.salvar_recurso_candidato('{"edital_id":"30000000-0000-0000-0000-000000000002","origem":"analise-curricular","fora_analise":true}');
    raise exception 'Recursos gravou fora da coordenação';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

do $$
begin
  if exists (select 1 from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id='10000000-0000-0000-0000-000000000013' and recurso='nucleo') then
    raise exception 'Voltar ao padrão não apagou a exceção';
  end if;
  if (select "CO_COORDENACAO" from public."TB_PERFIL_USUARIO" where lower(email)='novo@test.invalid') <> 'norte-teste' then
    raise exception 'Aprovação do coordenador fora da coordenação';
  end if;
end;
$$;

rollback;
