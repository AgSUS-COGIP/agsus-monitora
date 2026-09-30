-- Volta salvar_matriz_acessos à versão sem a exigência de coordenação.
begin;

CREATE OR REPLACE FUNCTION public.salvar_matriz_acessos(p_alteracoes jsonb, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  item jsonb; alvo public."TB_PERFIL_USUARIO"; v_tipo text; v_sem_area text;
  anterior text; revisao_atual integer; recurso_atual text; novo text; v_nivel_grupo text;
  quantidade integer := 0;
begin
  if jsonb_typeof(p_alteracoes) is distinct from 'array' or jsonb_array_length(p_alteracoes) not between 1 and 500 then raise exception 'Alterações inválidas'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  -- Serializa inserções de linhas ausentes e updates; a revisão evita perda de alteração.
  perform pg_advisory_xact_lock(73923124153);
  for item in select value from jsonb_array_elements(p_alteracoes) loop
    select * into alvo from public."TB_PERFIL_USUARIO" where id = (item ->> 'usuario_id')::uuid and ativo for update;
    perform private."FC_EXIGIR_GESTAO_DO_USUARIO"(alvo);
    v_tipo := coalesce(item ->> 'tipo', 'nivel');

    -- Grupo de acesso ----------------------------------------------------------
    if v_tipo = 'grupo' then
      novo := item ->> 'grupo';
      if not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo) then raise exception 'Grupo inválido'; end if;
      if item ->> 'revisao' is distinct from alvo.updated_at::text and alvo.updated_at <> now() then
        raise exception 'Conta alterada por outra pessoa. Recarregue a matriz.' using errcode = '40001';
      end if;
      if not private."FC_GRUPO_CABE_NO_TETO"(novo) then
        raise exception 'O grupo % dá mais acesso do que você tem', novo using errcode = '42501';
      end if;
      if alvo.perfil = novo then continue; end if;
      anterior := alvo.perfil;
      update public."TB_PERFIL_USUARIO"
         set perfil = novo,
             "CO_COORDENACAO" = case when exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL")
                                     then null else "CO_COORDENACAO" end,
             p_config = exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL"),
             p_admin = exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL"),
             updated_at = now()
       where id = alvo.id;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, '#grupo', anterior, novo, (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    -- Coordenação (só admin) --------------------------------------------------------
    if v_tipo = 'coordenacao' then
      if v_gestor <> 'admin' then raise exception 'Só o administrador muda a coordenação de alguém' using errcode = '42501'; end if;
      novo := nullif(btrim(coalesce(item ->> 'coordenacao', '')), '');
      if item ->> 'revisao' is distinct from alvo.updated_at::text and alvo.updated_at <> now() then
        raise exception 'Conta alterada por outra pessoa. Recarregue a matriz.' using errcode = '40001';
      end if;
      if novo is not null and not exists (select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = novo and c."ST_ATIVO") then
        raise exception 'Coordenação inválida ou desativada';
      end if;
      if novo is not null and exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = alvo.perfil and a."ST_ADMIN_GLOBAL") then
        raise exception 'Administrador global não fica em coordenação';
      end if;
      if alvo."CO_COORDENACAO" is not distinct from novo then continue; end if;
      anterior := coalesce(alvo."CO_COORDENACAO", '(sem coordenação)');
      update public."TB_PERFIL_USUARIO" set "CO_COORDENACAO" = novo, updated_at = now() where id = alvo.id;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, '#coordenacao', anterior, coalesce(novo, '(sem coordenação)'), (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    if v_tipo <> 'nivel' then raise exception 'Tipo de alteração inválido'; end if;
    recurso_atual := item ->> 'recurso';
    novo := item ->> 'nivel';

    -- Área (só admin) ---------------------------------------------------------------
    if recurso_atual like 'area:%' then
      if v_gestor <> 'admin' then raise exception 'Só o administrador muda as áreas de alguém' using errcode = '42501'; end if;
      if not exists (select 1 from public."TB_AREA" a where 'area:' || a."CO_AREA" = recurso_atual) then raise exception 'Área inválida'; end if;
      if novo is null or novo not in ('sem_acesso', 'leitor') then raise exception 'Área aceita apenas Sim ou Não'; end if;
      if exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = alvo.perfil and a."ST_ADMIN_GLOBAL") then
        raise exception 'Administrador já vê todas as áreas';
      end if;
      anterior := case when exists (select 1 from public."RL_PERFIL_USUARIO_AREA" x
                                     where x."CO_PERFIL_USUARIO" = alvo.id and 'area:' || x."CO_AREA" = recurso_atual)
                       then 'leitor' else 'sem_acesso' end;
      if anterior = novo then continue; end if;
      if novo = 'leitor' then
        insert into public."RL_PERFIL_USUARIO_AREA"("CO_PERFIL_USUARIO", "CO_AREA") values (alvo.id, substr(recurso_atual, 6));
      else
        delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO" = alvo.id and "CO_AREA" = substr(recurso_atual, 6);
      end if;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, recurso_atual, anterior, novo, (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    -- Módulo ou painel ------------------------------------------------------------------
    if recurso_atual is null or (recurso_atual <> all (private."FC_RECURSOS_MODULO"())
        and not exists (select 1 from public."TB_PAINEL_EXTERNO" where 'painel:' || id = recurso_atual and ativo)) then
      raise exception 'Recurso inválido';
    end if;
    if novo is not null and novo not in ('sem_acesso', 'leitor', 'editor', 'admin') then raise exception 'Nível inválido'; end if;
    if recurso_atual = 'configuracoes' and novo = 'leitor' then raise exception 'Configurações exige Editor ou Administrador'; end if;
    if recurso_atual = 'acessos' and novo not in ('sem_acesso', 'editor') then raise exception 'Acessos aceita Sem acesso ou Editor'; end if;
    if recurso_atual like 'painel:%' and novo not in ('sem_acesso', 'leitor') then raise exception 'Painel externo permite apenas acesso de leitura no portal'; end if;

    select g.nivel, g.revisao into anterior, revisao_atual
      from public."TB_PERMISSAO_RECURSO" g where g.perfil_usuario_id = alvo.id and g.recurso = recurso_atual;
    if item ->> 'revisao' is null or coalesce(revisao_atual, 0) <> (item ->> 'revisao')::integer then
      raise exception 'Permissão alterada por outra pessoa. Recarregue a matriz.' using errcode = '40001';
    end if;
    v_nivel_grupo := private."FC_NIVEL_DO_GRUPO"(alvo.perfil, recurso_atual);

    -- Administrador global segue o grupo: uma exceção de módulo nele (ex.: um
    -- select que mostrou "Leitor" por engano) o rebaixaria sem ninguém perceber.
    -- Para mudar um administrador, troca-se o grupo, de forma explícita.
    if novo is not null and novo is distinct from v_nivel_grupo
       and exists (select 1 from public."TB_GRUPO_ACESSO" a
                    where a."CO_GRUPO_ACESSO" = alvo.perfil and a."ST_ADMIN_GLOBAL") then
      raise exception 'Administrador global segue o grupo: para mudar o acesso de %, troque o grupo da pessoa.', coalesce(alvo.email, 'esta pessoa')
        using errcode = '42501';
    end if;

    -- Teto do coordenador: o nível resultante (exceção ou padrão do grupo).
    if v_gestor = 'coordenador' then
      if recurso_atual = 'acessos' then raise exception 'Só o administrador concede Acessos' using errcode = '42501'; end if;
      if private."FC_RANK_NIVEL"(coalesce(novo, v_nivel_grupo)) > private."FC_RANK_NIVEL"(private."FC_TETO_DO_GESTOR"(recurso_atual)) then
        raise exception 'Você não pode conceder mais do que o seu próprio nível em %', recurso_atual using errcode = '42501';
      end if;
    end if;

    if novo is null then
      -- Voltar ao padrão do grupo: apaga a exceção.
      if anterior is null then continue; end if;
      delete from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id = alvo.id and recurso = recurso_atual;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, recurso_atual, anterior, v_nivel_grupo, (select auth.uid()), btrim(p_motivo) || ' [padrão do grupo]');
      quantidade := quantidade + 1;
      continue;
    end if;

    if anterior is not distinct from novo then continue; end if;
    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by) values (alvo.id, recurso_atual, novo, (select auth.uid()))
    on conflict (perfil_usuario_id, recurso) do update
      set nivel = excluded.nivel, revisao = "TB_PERMISSAO_RECURSO".revisao + 1, updated_at = now(), updated_by = excluded.updated_by;
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    values (alvo.id, recurso_atual, coalesce(anterior, v_nivel_grupo), novo, (select auth.uid()), btrim(p_motivo));
    quantidade := quantidade + 1;
  end loop;

  -- Ninguém ativo termina o lote sem área: quem não é administrador global só
  -- vê as áreas marcadas (ou a da coordenação). Em 30/09 uma conta saiu de
  -- Administrador para Usuário sem área e entrou num sistema vazio.
  for v_sem_area in
    select coalesce(nullif(btrim(u.nome), ''), u.email)
      from public."TB_PERFIL_USUARIO" u
     where u.ativo
       and u.id in (select (x ->> 'usuario_id')::uuid from jsonb_array_elements(p_alteracoes) x
                     where x ->> 'usuario_id' is not null)
       and cardinality(coalesce(private."FC_AREAS_DO_PERFIL"(u.id), '{}')) = 0
  loop
    raise exception '% ficaria sem nenhuma área e não veria nada no sistema. Marque ao menos uma área (ou uma coordenação) junto com a troca de grupo.', v_sem_area
      using errcode = '23514';
  end loop;

  return jsonb_build_object('alteradas', quantidade);
end;
$function$;

commit;
