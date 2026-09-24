-- Run only against an isolated test database with the migration applied.
-- Synthetic identities; rollback leaves no records behind.
begin;
insert into public."TB_PERFIL_USUARIO" (id,user_id,email,nome,perfil,ativo,updated_at) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','admin@test.invalid','Admin','admin',true,now()),
('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','reader@test.invalid','Leitor','usuario',true,now()),
('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','inactive@test.invalid','Inativo','admin',false,now());
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","email":"admin@test.invalid"}',true);
set local role authenticated;
do $$
declare result jsonb; denied boolean:=false;
begin
  if not private.pode_recurso('configuracoes',3) then raise exception 'Admin lost access'; end if;
  result:=public.obter_matriz_acessos('',0);
  if jsonb_array_length(result->'usuarios')<>2 then raise exception 'Inactive user exposed in matrix'; end if;
  begin
    perform public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000001","recurso":"dashboard","nivel":"sem_acesso","revisao":0}]','Teste próprio');
  exception when others then denied:=true; end;
  if not denied then raise exception 'Self edit allowed'; end if;
  result:=public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000002","recurso":"aprovados","nivel":"sem_acesso","revisao":0},{"usuario_id":"10000000-0000-0000-0000-000000000002","recurso":"calendario","nivel":"editor","revisao":0}]','Mudança de equipe');
  if (result->>'alteradas')::int<>2 then raise exception 'Batch not saved'; end if;
  denied:=false;
  begin
    perform public.salvar_matriz_acessos('[{"usuario_id":"10000000-0000-0000-0000-000000000002","recurso":"dashboard","nivel":"sem_acesso","revisao":0},{"usuario_id":"10000000-0000-0000-0000-000000000002","recurso":"calendario","nivel":"admin","revisao":0}]','Conflito simultâneo');
  exception when serialization_failure then denied:=true; end;
  if not denied then raise exception 'Stale revision accepted'; end if;
end;
$$;
reset role;
do $$
begin
  if exists(select 1 from public."TB_PERMISSAO_RECURSO" where recurso='dashboard') then raise exception 'Partial batch committed'; end if;
  if (select count(*) from public."TH_PERMISSAO_RECURSO")<>2 then raise exception 'Audit mismatch'; end if;
end;
$$;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000002","email":"reader@test.invalid"}',true);
set local role authenticated;
do $$
declare denied boolean:=false;
begin
  if private.pode_recurso('aprovados') then raise exception 'Denied module remains readable'; end if;
  if not private.pode_recurso('calendario',2) then raise exception 'Editor grant ineffective'; end if;
  if private.pode_recurso('calendario',3) or private.is_master() then raise exception 'Privilege escalation'; end if;
  if private.pode_recurso('painel:00000000-0000-0000-0000-000000000000') then raise exception 'Unknown panel allowed'; end if;
  begin perform public.obter_matriz_acessos('',0); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Reader obtained matrix'; end if;
  denied:=false;
  begin perform public.salvar_matriz_acessos('[]','Tentativa indevida'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Reader saved permissions'; end if;
  denied:=false;
  begin perform public.listar_listas_aprovados(); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Definer RPC bypassed module denial'; end if;
  denied:=false;
  begin insert into public."TB_PERMISSAO_RECURSO" values ('10000000-0000-0000-0000-000000000002','configuracoes','admin',1,now(),'20000000-0000-0000-0000-000000000002'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct permission mutation allowed'; end if;
end;
$$;
reset role;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000003","email":"inactive@test.invalid"}',true);
set local role authenticated;
do $$
begin
  if private.pode_recurso('dashboard') or private.pode_recurso('configuracoes',3) then raise exception 'Inactive profile allowed'; end if;
  if public.obter_contexto_monitora() is not null then raise exception 'Inactive context returned'; end if;
end;
$$;
reset role;
rollback;
