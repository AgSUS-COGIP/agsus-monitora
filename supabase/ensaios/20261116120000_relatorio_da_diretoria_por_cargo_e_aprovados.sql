/*
  ENSAIO de 20261116120000_relatorio_da_diretoria_por_cargo_e_aprovados: aplica, confere como um administrador global e termina em rollback.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if to_regprocedure('public.listar_vagas_por_cargo_da_visao_geral(text, uuid[])') is not null
     or to_regprocedure('public.exportar_aprovados_da_diretoria(text, text, uuid[])') is not null then
    raise exception 'A migration 20261116120000 já foi aplicada.';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public."TL_EXPORTACAO_APROVADO"'::regclass
         and c.conname = 'CK_EXPAPROV_TPCONTEUDO')
     is distinct from $$CHECK ((("TP_CONTEUDO")::text = ANY ((ARRAY['LISTA'::character varying, 'RESUMO'::character varying])::text[])))$$ then
    raise exception 'A regra CK_EXPAPROV_TPCONTEUDO mudou depois de 11/11/2026: junte as mudanças antes de aplicar.';
  end if;
end;
$guarda$;

-- 3. O registro aceita o relatório da diretoria
alter table public."TL_EXPORTACAO_APROVADO" drop constraint "CK_EXPAPROV_TPCONTEUDO";
alter table public."TL_EXPORTACAO_APROVADO" alter column "TP_CONTEUDO" type varchar(10);
alter table public."TL_EXPORTACAO_APROVADO" add constraint "CK_EXPAPROV_TPCONTEUDO"
  check ("TP_CONTEUDO" in ('LISTA', 'RESUMO', 'DIRETORIA'));
comment on table public."TL_EXPORTACAO_APROVADO" is 'Cada exportação da Lista de aprovados (XLSX, CSV ou PDF, gerada no navegador): área, formato, conteúdo (lista, resumo ou relatório da diretoria), filtros, total do recorte no banco, registros exportados, quem e quando. Sem dado de candidato. Gravam registrar_exportacao_aprovados e exportar_aprovados_da_diretoria.';

-- 1. Vagas por cargo (aba 2)
create function public.listar_vagas_por_cargo_da_visao_geral(p_area text, p_editais uuid[])
returns jsonb
language plpgsql
stable security definer
set search_path = ''
set statement_timeout = '10s'
as $funcao$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_visiveis uuid[];
  v_editais uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_editais, '{}'::uuid[])) > 1000 then
    raise exception 'Editais demais para um relatório.' using errcode = '22023';
  end if;

  -- Só os editais pedidos que a pessoa vê; os outros ficam de fora, sem erro.
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  select coalesce(array_agg(m.id), '{}') into v_editais
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.id = any (coalesce(p_editais, '{}'::uuid[]))
     and m."CO_AREA" = v_area
     and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
     and (v_visiveis is null or m.id = any (v_visiveis));

  return jsonb_build_object(
    'vagas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', s."CO_MONITORAMENTO",
               'codigo', s."CO_VAGA",
               'vaga', s."DS_VAGA_PLANILHA",
               'cargo', s."NO_CARGO",
               'unidade', s."NO_UNIDADE",
               'inscritos', s."QT_INSCRITO"
             ) order by s."CO_MONITORAMENTO", s."DS_VAGA_PLANILHA")
        from public."TB_SELECAO_VAGA" s
       where s."ST_REGISTRO_ATIVO" = 'S'
         and s."CO_MONITORAMENTO" = any (v_editais)
    ), '[]'::jsonb),
    'quadro', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', q."CO_MONITORAMENTO",
               'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO",
               'vagas', q."QT_VAGA_IMEDIATA",
               'reserva', q."ST_CADASTRO_RESERVA" = 'S'
             ) order by q."CO_MONITORAMENTO", q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."ST_REGISTRO_ATIVO" = 'S'
         and q."CO_MONITORAMENTO" = any (v_editais)
    ), '[]'::jsonb),
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', r.edital_id,
               'codigo_vaga', r.codigo_vaga,
               'cargo', r.cargo,
               'aprovados', r.aprovados
             ) order by r.edital_id, r.codigo_vaga, r.cargo)
        from (
          select l.edital_id, c.codigo_vaga, c.cargo, count(*)::integer as aprovados
            from public."TB_LISTA_APROVADO" l
            join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.vigente is true
             and l.edital_id = any (array(select e::text from unnest(v_editais) e))
           group by l.edital_id, c.codigo_vaga, c.cargo
        ) r
    ), '[]'::jsonb)
  );
end;
$funcao$;

-- 2. Aprovados com matrícula e admissão (aba 3), com o registro do download
create function public.exportar_aprovados_da_diretoria(p_area text, p_formato text, p_editais uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '20s'
as $funcao$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_formato text := upper(btrim(coalesce(p_formato, '')));
  v_editais uuid[];
  v_visiveis uuid[];
  v_linhas jsonb;
  v_total integer;
  v_autor record;
  v_id uuid;
  v_emitida timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if not private.pode_recurso('aprovados', 1) then
    raise exception 'Sem permissão para exportar a lista de aprovados.' using errcode = '42501';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida.' using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área.' using errcode = '42501';
  end if;
  if v_formato not in ('XLSX', 'CSV', 'PDF') then
    raise exception 'Formato inválido: escolha XLSX, CSV ou PDF.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct e), '{}') into v_editais
    from unnest(coalesce(p_editais, '{}'::uuid[])) e where e is not null;
  if cardinality(v_editais) = 0 then
    raise exception 'Nenhum edital para exportar.' using errcode = '22023';
  end if;
  if cardinality(v_editais) > 1000 then
    raise exception 'Editais demais para uma exportação.' using errcode = '22023';
  end if;

  -- Cada edital: da área, fora de treinamento e visível para a coordenação.
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  if exists (
    select 1 from unnest(v_editais) e
     where not exists (
       select 1 from public."TB_MONITORAMENTO_INDIGENA" m
        where m.id = e
          and m."CO_AREA" = v_area
          and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
          and (v_visiveis is null or m.id = any (v_visiveis))
     )
  ) then
    raise exception 'Há edital fora da área ou sem permissão.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'monitoramento_id', l.edital_id,
           'codigo_vaga', c.codigo_vaga,
           'cargo', c.cargo,
           'modalidade', c.modalidade,
           'nota', c.nota,
           'classificacao', c.classificacao,
           'nome', c.nome,
           'status', case when c.status = 'Contratado' and private."FC_EM_OUTRA_LISTA"(c.id)
                          then 'Contratado em outra lista' else c.status end,
           'matricula', nullif(btrim(c.matricula), ''),
           'admissao', a."DT_ADMISSAO"
         ) order by l.edital_id, c.cargo, c.classificacao nulls last, c.nome), '[]'::jsonb),
         count(c.id)::integer
    into v_linhas, v_total
    from public."TB_LISTA_APROVADO" l
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
    left join public."TB_ADMISSAO_CONCILIADA" a on a."CO_CANDIDATO_APROVADO" = c.id
   where l.vigente is true
     and l.edital_id = any (array(select e::text from unnest(v_editais) e));

  select * into v_autor from private.autor_da_sessao();
  insert into public."TL_EXPORTACAO_APROVADO" (
    "CO_AREA", "TP_FORMATO", "TP_CONTEUDO", "DS_FILTRO", "QT_EDITAL", "QT_RECORTE", "QT_REGISTRO",
    "CO_USUARIO", "NO_USUARIO", "DS_EMAIL_USUARIO"
  ) values (
    v_area, v_formato, 'DIRETORIA',
    jsonb_build_object('editais', to_jsonb(v_editais)),
    cardinality(v_editais), v_total, v_total,
    (select auth.uid()), v_autor.nome, v_autor.email
  ) returning "CO_EXPORTACAO_APROVADO", "DT_EMISSAO" into v_id, v_emitida;

  return jsonb_build_object(
    'exportacao_id', v_id, 'emitida_em', v_emitida,
    'registros', v_total, 'aprovados', v_linhas);
end;
$funcao$;

comment on function public.listar_vagas_por_cargo_da_visao_geral(p_area text, p_editais uuid[]) is 'Aba 2 do relatório da diretoria (montador da Visão geral, só leitura): dos editais pedidos que a pessoa vê, as vagas da Seleção com inscritos, o quadro de vagas do edital e as contagens da lista vigente por vaga. Sem dado pessoal. Recurso dashboard, área do usuário e recorte da coordenação (20261116120000).';
comment on function public.exportar_aprovados_da_diretoria(p_area text, p_formato text, p_editais uuid[]) is 'Aba 3 do relatório da diretoria: os candidatos das listas vigentes dos editais pedidos (cargo, nota, classificação, nome, status, matrícula e a data de admissão conciliada com o RH). Grava antes o download em TL_EXPORTACAO_APROVADO (DIRETORIA). Aprovados leitor, área do usuário, editais da área visíveis à coordenação (20261116120000).';

revoke all on function public.listar_vagas_por_cargo_da_visao_geral(text, uuid[]) from public, anon;
grant execute on function public.listar_vagas_por_cargo_da_visao_geral(text, uuid[]) to authenticated;
revoke all on function public.exportar_aprovados_da_diretoria(text, text, uuid[]) from public, anon;
grant execute on function public.exportar_aprovados_da_diretoria(text, text, uuid[]) to authenticated;


-- ENSAIO: confere privilégios, recusas e as contagens como um administrador global.
do $ensaio$
declare
  v_admin uuid;
  v_email text;
  v_area text;
  v_editais uuid[];
  v_total integer;
  v_r jsonb;
  v_v jsonb;
  v_n integer;
  v_outra uuid;
  v_estado text;
begin
  if has_function_privilege('anon', 'public.listar_vagas_por_cargo_da_visao_geral(text, uuid[])', 'execute')
     or has_function_privilege('anon', 'public.exportar_aprovados_da_diretoria(text, text, uuid[])', 'execute')
     or not has_function_privilege('authenticated', 'public.listar_vagas_por_cargo_da_visao_geral(text, uuid[])', 'execute')
     or not has_function_privilege('authenticated', 'public.exportar_aprovados_da_diretoria(text, text, uuid[])', 'execute') then
    raise exception 'Ensaio: execute das RPCs errado (anon não pode, authenticated pode).';
  end if;
  if (select count(*) from pg_proc p
       where p.oid in ('public.listar_vagas_por_cargo_da_visao_geral(text, uuid[])'::regprocedure,
                       'public.exportar_aprovados_da_diretoria(text, text, uuid[])'::regprocedure)
         and p.prosecdef and 'search_path=""' = any (p.proconfig)) <> 2 then
    raise exception 'Ensaio: as RPCs não são SECURITY DEFINER com search_path vazio.';
  end if;

  -- Sem sessão.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.listar_vagas_por_cargo_da_visao_geral('saude-indigena', array[gen_random_uuid()]);
    raise exception 'Ensaio: sem sessão, a leitura passou.';
  exception when sqlstate '28000' then null;
  end;
  begin
    perform public.exportar_aprovados_da_diretoria('saude-indigena', 'XLSX', array[gen_random_uuid()]);
    raise exception 'Ensaio: sem sessão, a exportação passou.';
  exception when sqlstate '28000' then null;
  end;

  -- Como um administrador global.
  select p.user_id, lower(p.email) into v_admin, v_email
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.updated_at desc nulls last
   limit 1;
  if v_admin is null then
    raise exception 'Ensaio: sem administrador global ativo.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'email', v_email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select m."CO_AREA" into v_area
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
   where l.vigente is true and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
   group by m."CO_AREA" order by count(*) desc limit 1;
  select array_agg(m.id) into v_editais
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = v_area and m.ativo and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  select count(*) into v_total
    from public."TB_LISTA_APROVADO" l
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
   where l.vigente is true and l.edital_id = any (array(select e::text from unnest(v_editais) e));

  -- Aba 2
  v_v := public.listar_vagas_por_cargo_da_visao_geral(v_area, v_editais);
  select coalesce(sum((x ->> 'aprovados')::integer), 0) into v_n from jsonb_array_elements(v_v -> 'lista') x;
  if v_n <> v_total then
    raise exception 'Ensaio: a aba 2 conta % aprovados e a lista vigente tem %.', v_n, v_total;
  end if;
  if jsonb_array_length(v_v -> 'vagas') = 0 then
    raise exception 'Ensaio: a aba 2 veio sem vagas da Seleção.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_v -> 'lista') x where x ? 'nome' or x ? 'matricula') then
    raise exception 'Ensaio: a aba 2 trouxe dado pessoal.';
  end if;

  -- Aba 3
  v_r := public.exportar_aprovados_da_diretoria(v_area, 'xlsx', v_editais);
  if (v_r ->> 'exportacao_id') is null or (v_r ->> 'registros')::integer <> v_total
     or jsonb_array_length(v_r -> 'aprovados') <> v_total then
    raise exception 'Ensaio: a aba 3 devolveu % de % aprovados.', v_r ->> 'registros', v_total;
  end if;
  select count(*) into v_n from public."TL_EXPORTACAO_APROVADO"
   where "CO_EXPORTACAO_APROVADO" = (v_r ->> 'exportacao_id')::uuid
     and "TP_CONTEUDO" = 'DIRETORIA' and "TP_FORMATO" = 'XLSX'
     and "QT_REGISTRO" = v_total and "QT_EDITAL" = cardinality(v_editais) and "CO_USUARIO" = v_admin;
  if v_n <> 1 then
    raise exception 'Ensaio: o download não ficou registrado como pedido.';
  end if;

  raise notice 'Ensaio 20261116120000: área %, % editais; aba 2: % vagas da Seleção, % linhas do quadro, % grupos da lista; aba 3: % aprovados, % com matrícula, % com admissão, % contratados em outra lista.',
    v_area, cardinality(v_editais),
    jsonb_array_length(v_v -> 'vagas'), jsonb_array_length(v_v -> 'quadro'), jsonb_array_length(v_v -> 'lista'),
    v_total,
    (select count(*) from jsonb_array_elements(v_r -> 'aprovados') x where x ->> 'matricula' is not null),
    (select count(*) from jsonb_array_elements(v_r -> 'aprovados') x where x ->> 'admissao' is not null),
    (select count(*) from jsonb_array_elements(v_r -> 'aprovados') x where x ->> 'status' = 'Contratado em outra lista');

  -- Recusas
  select m.id into v_outra from public."TB_MONITORAMENTO_INDIGENA" m where m."CO_AREA" is distinct from v_area limit 1;
  for v_estado in select x from (values ('22023f'), ('22023v'), ('42501')) t(x) loop
    begin
      case v_estado
        when '22023f' then perform public.exportar_aprovados_da_diretoria(v_area, 'XLS', v_editais);
        when '22023v' then perform public.exportar_aprovados_da_diretoria(v_area, 'PDF', '{}'::uuid[]);
        when '42501' then perform public.exportar_aprovados_da_diretoria(v_area, 'PDF', v_editais || v_outra);
      end case;
      raise exception 'Ensaio: o caso % passou.', v_estado;
    exception when sqlstate '22023' or sqlstate '42501' then
      if left(v_estado, 5) <> sqlstate then
        raise exception 'Ensaio: o caso % deu %.', v_estado, sqlstate;
      end if;
    end;
  end loop;
  -- Edital de outra área na leitura: fica de fora, sem erro.
  v_v := public.listar_vagas_por_cargo_da_visao_geral(v_area, array[v_outra]);
  if jsonb_array_length(v_v -> 'vagas') + jsonb_array_length(v_v -> 'lista') <> 0 then
    raise exception 'Ensaio: a aba 2 trouxe edital de outra área.';
  end if;

  raise notice 'Ensaio 20261116120000 ok';
end;
$ensaio$;

rollback;
