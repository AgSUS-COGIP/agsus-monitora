/*
  ENSAIO de 20261008120000_assistente_da_regra.sql — begin … rollback.

  PRÉ-REQUISITO: 20261006100000_regra_da_analise.sql e
  20261002150000_classificacao.sql aplicadas (o corpo para se não estiverem).

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e:
    E1  confere os grants: a RPC nova executa para authenticated e não para
        anon; a função privada não executa para ninguém;
    E2  cria 4 atores sintéticos no 93/2026 (Projetos), que já tem regra:
        admin no grupo de administrador global que já existe, gestor
        (edital_gestor), coordenação (Administrador + Coordenação na equipe)
        e leitor;
    E3  como cada um (papel authenticated): o leitor lê o apoio sem as regras
        da área e não confere; o gestor salva uma versão e NÃO a confere
        (dupla conferência, 42501) e a tela sabe disso
        (conferir_pede_outra_pessoa); a coordenação confere; o administrador
        global salva e confere a própria versão.
  Termina em ROLLBACK: nada fica gravado. Resultado: a linha do SELECT final
  (só contagens e situações). Qualquer "FALHOU …" interrompe e desfaz tudo.

  Mantenha em sincronia: tests/assistente-da-regra-migration.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.conferir_regra_analise(uuid, integer)') is null
     or to_regprocedure('private."FC_REGRA_ANALISE_JSON"(uuid)') is null then
    raise exception 'Aplique antes 20261006100000_regra_da_analise.sql.';
  end if;
  if to_regprocedure('public.salvar_regra_classificacao(uuid, jsonb, integer, text)') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
end;
$$;

-- 1. A regra vigente diz se quem está logado precisa de outra pessoa para conferir -----
create or replace function private."FC_REGRA_ANALISE_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'versao', r."NU_VERSAO_VIGENTE",
           'situacao', r."TP_SITUACAO",
           'modelo_origem', r."CO_MODELO_ORIGEM",
           'configuracao', v."DS_CONFIGURACAO",
           'hash', v."DS_HASH",
           'atualizado_em', v."DT_CRIACAO",
           'por', coalesce(p.nome, p.email),
           'conferida_em', r."DT_CONFERENCIA",
           'conferida_por', coalesce(pc.nome, pc.email),
           'conferir_pede_outra_pessoa',
             coalesce(v."CO_USUARIO" = (select auth.uid()), false) and not private.is_master(),
           'versoes', coalesce((
             select json_agg(json_build_object(
                      'versao', h."NU_VERSAO", 'em', h."DT_CRIACAO", 'por', coalesce(pu.nome, pu.email),
                      'motivo', h."DS_MOTIVO", 'hash', h."DS_HASH", 'configuracao', h."DS_CONFIGURACAO")
                    order by h."NU_VERSAO" desc)
               from public."TH_REGRA_ANALISE" h
               left join public."TB_PERFIL_USUARIO" pu on pu.user_id = h."CO_USUARIO"
              where h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE"), '[]'::json))
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" v
      on v."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and v."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    left join public."TB_PERFIL_USUARIO" p on p.user_id = v."CO_USUARIO"
    left join public."TB_PERFIL_USUARIO" pc on pc.user_id = r."CO_USUARIO_CONFERENCIA"
   where r."CO_MONITORAMENTO" = p_edital;
$function$;
comment on function private."FC_REGRA_ANALISE_JSON"(uuid) is
  'Regra da avaliação vigente do edital (versão, situação, configuração, hash, quem e quando, conferência, e se quem está logado precisa de outra pessoa para conferir: salvou a versão vigente e não é administrador global) e o histórico de versões; null sem regra.';
revoke all on function private."FC_REGRA_ANALISE_JSON"(uuid) from public, anon, authenticated;

-- 2. Dupla conferência ------------------------------------------------------------------
create or replace function public.conferir_regra_analise(p_edital uuid, p_versao integer)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_ANALISE";
  v_autor uuid;
begin
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); confira de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
  end if;
  if v_regra."TP_SITUACAO" <> 'CONFERIDA' then
    select h."CO_USUARIO" into v_autor
      from public."TH_REGRA_ANALISE" h
     where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";
    if v_autor = (select auth.uid()) and not private.is_master() then
      raise exception 'Dupla conferência: quem salvou a versão % não pode conferi-la. Peça a outra pessoa da coordenação do edital.', v_regra."NU_VERSAO_VIGENTE"
        using errcode = '42501';
    end if;
    update public."TB_REGRA_ANALISE"
       set "TP_SITUACAO" = 'CONFERIDA', "CO_USUARIO_CONFERENCIA" = (select auth.uid()), "DT_CONFERENCIA" = now(), "DT_ATUALIZACAO" = now()
     where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";
  end if;
  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital), 'fichas_afetadas', '[]'::json);
end;
$function$;
comment on function public.conferir_regra_analise(uuid, integer) is
  'Marca a versão vigente da regra como conferida (quem e quando). Dupla conferência: quem salvou a versão vigente não confere (42501), salvo o administrador global. p_versao tem de ser a vigente (senão 40001). Salvar uma versão nova volta para Conferir. Só a coordenação do edital.';
revoke all on function public.conferir_regra_analise(uuid, integer) from public, anon;
grant execute on function public.conferir_regra_analise(uuid, integer) to authenticated, service_role;

-- 3. O que o assistente lê ------------------------------------------------------------
create function public.obter_apoio_regra_analise(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_coordena boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_le_classificacao boolean := private.pode_recurso('classificacao', 1);
begin
  return json_build_object(
    'schema_version', 1,
    -- Só os nomes das colunas de pergunta, por vaga (nenhuma resposta de candidato).
    'perguntas_por_vaga', coalesce((
      select json_agg(json_build_object(
               'vaga', v."CO_VAGA",
               'cargo', (select s."NO_CARGO" from public."TB_SELECAO_VAGA" s
                          where s."CO_VAGA" = v."CO_VAGA" and s."NO_CARGO" is not null
                          order by s."CO_MONITORAMENTO" = p_edital desc limit 1),
               'colunas', coalesce((
                 select json_agg(c.coluna order by c.ordem)
                   from jsonb_array_elements_text(v."DS_COLUNA") with ordinality c(coluna, ordem)
                  where c.coluna ilike 'Pergunta %'), '[]'::json))
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
       where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA'), '[]'::json),
    'regras_da_area', case when v_coordena then coalesce((
      select json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'numero', private."FC_NUMERO_EDITAL"(m.edital), 'unidade', m.unidade,
               'versao', r."NU_VERSAO_VIGENTE", 'conferida_em', r."DT_CONFERENCIA", 'configuracao', h."DS_CONFIGURACAO")
             order by r."DT_CONFERENCIA" desc, m.edital)
        from public."TB_REGRA_ANALISE" r
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
        join public."TH_REGRA_ANALISE" h
          on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."TP_SITUACAO" = 'CONFERIDA' and m."CO_AREA" = v_area and m.id <> p_edital
         and private."FC_PODE_VER_EDITAL"(m.id)), '[]'::json) else '[]'::json end,
    'classificacao', json_build_object(
      'pode_ler', v_le_classificacao,
      'pode_editar', v_le_classificacao and private.pode_recurso('classificacao', 2),
      'regra', case when v_le_classificacao then (
        select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'configuracao', h."DS_CONFIGURACAO",
                                 'atualizado_em', h."DT_CRIACAO", 'por', coalesce(p.nome, p.email))
          from public."TB_REGRA_CLASSIFICACAO" r
          join public."TH_REGRA_CLASSIFICACAO" h
            on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
          left join public."TB_PERFIL_USUARIO" p on p.user_id = h."CO_USUARIO"
         where r."CO_MONITORAMENTO" = p_edital) end)
  );
end;
$function$;
comment on function public.obter_apoio_regra_analise(uuid) is
  'O que o assistente da regra da avaliação documental lê (json): os nomes das colunas de pergunta da última carga de cada vaga do edital (sem respostas), as regras conferidas dos outros editais da área que a pessoa vê (só para a coordenação do edital, para copiar) e a regra de classificação vigente (nota mínima e desempate) para quem lê a Classificação, com pode_editar (Editor na Classificação). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_apoio_regra_analise(uuid) from public, anon;
grant execute on function public.obter_apoio_regra_analise(uuid) to authenticated, service_role;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Grants.
do $$
begin
  if not has_function_privilege('authenticated', 'public.obter_apoio_regra_analise(uuid)', 'execute')
     or has_function_privilege('anon', 'public.obter_apoio_regra_analise(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private."FC_REGRA_ANALISE_JSON"(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.conferir_regra_analise(uuid, integer)', 'execute') then
    raise exception 'FALHOU E1: grants';
  end if;
end;
$$;

-- E2. Atores sintéticos (somem no rollback) no 93/2026.
do $$
declare
  v_edital uuid;
  v_area text;
  v_admin text;
begin
  select m.id, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
    join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
   where m."CO_AREA" = 'projetos' and private."FC_NUMERO_EDITAL"(m.edital) = '93/2026'
   limit 1;
  if v_edital is null then raise exception 'ENSAIO: o 93/2026 sem regra'; end if;
  select g."CO_GRUPO_ACESSO" into v_admin from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL" order by g."CO_GRUPO_ACESSO" = 'admin' desc limit 1;
  perform set_config('ensaio.edital', v_edital::text, true);

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000ae01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.admin@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000ae02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000ae03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.coord@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000ae04', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.leitor@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000ae01', 'ensaio.admin@ensaio.invalid', 'Ensaio Admin', v_admin, true),
    ('00000000-0000-4000-a000-00000000ae02', 'ensaio.gestor@ensaio.invalid', 'Ensaio Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000ae03', 'ensaio.coord@ensaio.invalid', 'Ensaio Coordenação', 'usuario', true),
    ('00000000-0000-4000-a000-00000000ae04', 'ensaio.leitor@ensaio.invalid', 'Ensaio Leitor', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u
   where u.email like 'ensaio.%@ensaio.invalid' and u.email <> 'ensaio.admin@ensaio.invalid';
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select u.id, 'avaliacao_documental', x.nivel, '00000000-0000-4000-a000-00000000ae01'
    from (values ('ensaio.coord@ensaio.invalid', 'admin'), ('ensaio.leitor@ensaio.invalid', 'leitor')) x(email, nivel)
    join public."TB_PERFIL_USUARIO" u on u.email = x.email;
  insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_USUARIO_ATUALIZACAO")
  values (v_edital, '00000000-0000-4000-a000-00000000ae03', 'COORDENADOR', '00000000-0000-4000-a000-00000000ae01');
end;
$$;

-- E3. As RPCs como cada pessoa.
set local role authenticated;
do $$
declare
  c_admin constant text := '{"sub":"00000000-0000-4000-a000-00000000ae01","role":"authenticated","email":"ensaio.admin@ensaio.invalid"}';
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000ae02","role":"authenticated","email":"ensaio.gestor@ensaio.invalid"}';
  c_coord constant text := '{"sub":"00000000-0000-4000-a000-00000000ae03","role":"authenticated","email":"ensaio.coord@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000ae04","role":"authenticated","email":"ensaio.leitor@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v json;
  v_regra json;
  v_versao integer;
  v_mensagem text;
  v_vagas integer;
  v_classif text;
begin
  -- Leitor: lê as perguntas por vaga, sem as regras da área; não confere.
  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.obter_apoio_regra_analise(v_edital);
  if json_array_length(v -> 'regras_da_area') <> 0 then raise exception 'FALHOU E3: leitor viu as regras da área'; end if;
  v_vagas := json_array_length(v -> 'perguntas_por_vaga');
  if exists (select 1 from json_array_elements(v -> 'perguntas_por_vaga') p, json_array_elements_text(p -> 'colunas') c
              where c not ilike 'Pergunta %') then
    raise exception 'FALHOU E3: coluna que não é pergunta';
  end if;
  v_regra := public.obter_regra_analise(v_edital) -> 'regra';
  v_versao := (v_regra ->> 'versao')::integer;
  begin
    perform public.conferir_regra_analise(v_edital, v_versao);
    raise exception 'FALHOU E3: leitor conferiu';
  exception when sqlstate '42501' then null;
  end;

  -- Gestor: coordena; salva uma versão e não a confere (dupla conferência).
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.obter_apoio_regra_analise(v_edital);
  v_classif := concat_ws('/', v -> 'classificacao' ->> 'pode_ler', v -> 'classificacao' ->> 'pode_editar',
                         coalesce(v -> 'classificacao' -> 'regra' ->> 'versao', 'sem regra'));
  v := public.salvar_regra_analise(v_edital, (v_regra -> 'configuracao')::jsonb, v_versao, 'Ensaio do assistente da regra');
  if (v -> 'regra' ->> 'versao')::int <> v_versao + 1 or v -> 'regra' ->> 'situacao' <> 'CONFERIR'
     or (v -> 'regra' ->> 'conferir_pede_outra_pessoa')::boolean is not true then
    raise exception 'FALHOU E3: versão do gestor %', v -> 'regra' ->> 'versao';
  end if;
  begin
    perform public.conferir_regra_analise(v_edital, v_versao + 1);
    raise exception 'FALHOU E3: o autor conferiu a própria versão';
  exception when sqlstate '42501' then
    get stacked diagnostics v_mensagem = message_text;
  end;
  if v_mensagem not like 'Dupla conferência:%' then raise exception 'FALHOU E3: mensagem %', v_mensagem; end if;

  -- Coordenação (outra pessoa): confere.
  perform set_config('request.jwt.claims', c_coord, true);
  v_regra := public.obter_regra_analise(v_edital) -> 'regra';
  if (v_regra ->> 'conferir_pede_outra_pessoa')::boolean then raise exception 'FALHOU E3: coordenação bloqueada'; end if;
  v := public.conferir_regra_analise(v_edital, v_versao + 1);
  if v -> 'regra' ->> 'situacao' <> 'CONFERIDA' then raise exception 'FALHOU E3: coordenação não conferiu'; end if;
  if json_array_length(public.obter_apoio_regra_analise(v_edital) -> 'regras_da_area') is null then
    raise exception 'FALHOU E3: regras da área';
  end if;

  -- Administrador global: salva e confere a própria versão.
  perform set_config('request.jwt.claims', c_admin, true);
  v := public.salvar_regra_analise(v_edital, (v_regra -> 'configuracao')::jsonb, v_versao + 1, 'Ensaio do administrador global');
  if (v -> 'regra' ->> 'conferir_pede_outra_pessoa')::boolean then raise exception 'FALHOU E3: admin bloqueado'; end if;
  v := public.conferir_regra_analise(v_edital, v_versao + 2);
  if v -> 'regra' ->> 'situacao' <> 'CONFERIDA' then raise exception 'FALHOU E3: admin não conferiu'; end if;

  perform set_config('ensaio.resultado',
    format('versao inicial %s; vagas com perguntas %s; classificacao do gestor (ler/editar/versao) %s; recusa: %s',
           v_versao, v_vagas, v_classif, v_mensagem), true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;
reset role;

select 'ENSAIO OK' as resultado, current_setting('ensaio.resultado') as detalhe;

rollback;
