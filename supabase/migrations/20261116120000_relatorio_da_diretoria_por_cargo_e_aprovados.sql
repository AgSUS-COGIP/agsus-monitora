/*
  AS ABAS 2 E 3 DO RELATÓRIO DA DIRETORIA (pedido de 13/11/2026)

  O montador de relatório da Visão geral (#826) já tem a aba 1, "Resumo
  Informações Editais". Faltam:
    - aba 2, "Informações nominais dos editais": por vaga de cada edital, as
      vagas imediatas, os inscritos e os aprovados;
    - aba 3, "Informações nominais dos aprovados": edital, cargo, nota,
      classificação, nome, status, matrícula e data de admissão.

  O QUE MUDA
    1. public.listar_vagas_por_cargo_da_visao_geral(p_area, p_editais): só
       leitura, recurso dashboard (o mesmo da Visão geral). Devolve, dos editais
       pedidos que a pessoa vê, as vagas da Seleção (código, texto da vaga,
       cargo, unidade, inscritos), o quadro de vagas do edital (cargo, lotação,
       vagas imediatas, cadastro reserva) e as contagens da lista vigente por
       vaga. Sem dado pessoal. A ligação vaga ↔ quadro ↔ lista é feita na tela
       (src/lib/relatorio-da-diretoria.ts): os nomes não batem entre as fontes
       e, em Projetos e na SEDE, a lista guarda o texto da vaga no lugar do
       código.
    2. public.exportar_aprovados_da_diretoria(p_area, p_formato, p_editais):
       recurso aprovados (leitor), área do usuário, editais da área, fora de
       treinamento e visíveis à coordenação. Devolve os candidatos das listas
       vigentes com nome e matrícula, e a data de admissão conciliada com o RH
       (TB_ADMISSAO_CONCILIADA); grava cada download em TL_EXPORTACAO_APROVADO
       (TP_CONTEUDO 'DIRETORIA', sem dado de candidato) antes de devolver.
    3. TL_EXPORTACAO_APROVADO aceita o conteúdo 'DIRETORIA' (TP_CONTEUDO vai
       de varchar(6) para varchar(10)).

  GUARDAS: as duas funções não existem e a regra de TP_CONTEUDO é a de
  20261111210000 (LISTA, RESUMO).

  Ensaio: supabase/ensaios/20261116120000_relatorio_da_diretoria_por_cargo_e_aprovados.sql
  Rollback: supabase/rollback/20261116120000_relatorio_da_diretoria_por_cargo_e_aprovados.sql
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

commit;
