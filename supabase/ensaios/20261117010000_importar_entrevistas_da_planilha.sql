/*
  ENSAIO de supabase/migrations/20261117010000_importar_entrevistas_da_planilha.sql: o mesmo
  corpo e, dentro da transação, a importação de duas entrevistas fictícias do 93/2026 (dois
  aprovados da avaliação documental escolhidos pelo banco, avaliadores "Avaliador de ensaio",
  notas inventadas), a conferência da conta e rollback. Sem dado pessoal no arquivo.

  O ensaio com os dados reais (as 49 entrevistas das planilhas da banca) roda fora do
  repositório, com o mesmo corpo: 49 importadas, 200 notas, 0 divergências de nota e parecer
  com a planilha, segunda importação recusada (16/11/2026).
*/

begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if to_regprocedure('private."FC_IMPORTAR_ENTREVISTAS_DA_PLANILHA"(uuid, jsonb, text, uuid)') is not null then
    raise exception 'A importação das entrevistas já existe' using errcode = '55000';
  end if;
  if to_regprocedure('private."FC_CALCULAR_ENTREVISTA"(uuid)') is null
     or to_regprocedure('private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(text, uuid, uuid)') is null then
    raise exception 'Faltam FC_CALCULAR_ENTREVISTA ou FC_DESATIVAR_ENTREVISTAS_REPETIDAS' using errcode = '55000';
  end if;
end
$guarda$;

create function private."FC_IMPORTAR_ENTREVISTAS_DA_PLANILHA"(p_edital uuid, p_dados jsonb, p_motivo text, p_usuario uuid)
returns jsonb
    language plpgsql security definer
    set search_path to ''
    as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_roteiro uuid;
  v_avaliadores jsonb := '{}'::jsonb;
  x jsonb;
  n jsonb;
  v_a public."TB_ANALISE_CURRICULAR";
  v_ent uuid;
  v_av uuid;
  v_comp public."TB_ROTEIRO_COMPETENCIA";
  v_nota numeric;
  v_banca smallint;
  v_compareceu text;
  v_link text;
  v_final public."TB_ENTREVISTA";
  v_abaixo text;
  v_just text;
  v_qt integer := 0;
  v_divergentes jsonb := '[]'::jsonb;
  v_planilha_nota numeric;
  v_planilha_parecer text;
begin
  if p_usuario is null then
    raise exception 'Informe quem importa' using errcode = '42501';
  end if;
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Diga o motivo da importação (10 a 2.000 caracteres)' using errcode = '22023';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if v_m.id is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  select "CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  if v_roteiro is null then
    raise exception 'Configure a entrevista do edital antes de importar' using errcode = '23514';
  end if;
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_roteiro;
  if exists (select 1 from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_roteiro) then
    raise exception 'O roteiro do edital avalia por aspectos: a planilha da banca não tem essas notas' using errcode = '23514';
  end if;
  if jsonb_typeof(p_dados -> 'avaliadores') is distinct from 'array'
     or jsonb_typeof(p_dados -> 'entrevistas') is distinct from 'array'
     or jsonb_array_length(p_dados -> 'entrevistas') not between 1 and 2000 then
    raise exception 'Dados: {avaliadores: [...], entrevistas: [...]} com 1 a 2.000 entrevistas' using errcode = '22023';
  end if;

  -- Uma convocação por edital de cada vez (a mesma trava de convocar_para_entrevista).
  perform pg_advisory_xact_lock(hashtextextended('convocacao_entrevista:' || p_edital::text, 0));
  if exists (select 1 from public."TB_ENTREVISTA" e
              where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'
                and (e."ST_COMPARECEU" is not null
                     or exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" a where a."CO_ENTREVISTA" = e."CO_ENTREVISTA"))) then
    raise exception 'O edital já tem entrevista lançada no sistema: a importação não sobrescreve' using errcode = '23514';
  end if;

  -- A banca: cada avaliador da planilha (o de mesmo nome e banca é reaproveitado).
  for x in select value from jsonb_array_elements(p_dados -> 'avaliadores') loop
    v_banca := nullif(x ->> 'banca', '')::smallint;
    if v_banca is null or v_banca not between 1 and 20 or (x ->> 'posicao') not in ('1', '2', '3')
       or length(btrim(coalesce(x ->> 'nome', ''))) not between 2 and 150 then
      raise exception 'Avaliador inválido: %', x using errcode = '22023';
    end if;
    select a."CO_AVALIADOR" into v_av from public."TB_ENTREVISTA_AVALIADOR" a
     where a."CO_MONITORAMENTO" = p_edital and a."NU_BANCA" = v_banca and a."ST_ATIVO" = 'S'
       and lower(btrim(a."NO_AVALIADOR")) = lower(btrim(x ->> 'nome'))
     limit 1;
    if v_av is null then
      insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA")
      values (p_edital, btrim(x ->> 'nome'), 'Planilha da banca', v_banca)
      returning "CO_AVALIADOR" into v_av;
    end if;
    v_avaliadores := v_avaliadores || jsonb_build_object(v_banca || '|' || (x ->> 'posicao'), v_av);
  end loop;

  for x in select value from jsonb_array_elements(p_dados -> 'entrevistas') loop
    select * into v_a from public."TB_ANALISE_CURRICULAR" a
     where a.id = nullif(x ->> 'analise', '')::uuid and a.ativo and a."CO_AREA" = v_m."CO_AREA"
       and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital);
    if v_a.id is null then
      raise exception 'Análise % não é do edital', x ->> 'analise' using errcode = '22023';
    end if;
    v_banca := nullif(x ->> 'banca', '')::smallint;
    v_compareceu := x ->> 'compareceu';
    if v_banca is null or v_compareceu not in ('S', 'N') then
      raise exception 'Entrevista sem banca ou comparecimento: %', x ->> 'analise' using errcode = '22023';
    end if;
    v_link := nullif(btrim(coalesce(x ->> 'link', '')), '');
    if v_link is not null and (v_link !~ '^https://' or length(v_link) > 500) then
      raise exception 'Endereço da planilha inválido' using errcode = '22023';
    end if;

    insert into public."TB_ENTREVISTA" as e ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE",
      "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "NO_CARGO", "TP_PARECER",
      "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO", "NU_BANCA", "ST_COMPARECEU", "DS_LINK_PLANILHA")
    values (v_m."CO_AREA", p_edital, v_a.id, 'codigo', left(coalesce(v_m.unidade, ''), 200), left(v_m.edital, 120),
      left(v_a.codigo_vaga, 60), left(v_a.candidato, 200), left(v_a.id_origem, 60), left(v_a.modalidade_concorrencia, 300),
      left(v_a.nome_vaga, 400), 'SEM_PARECER', 'sistema', 'sistema|' || p_edital || '|' || v_a.id, v_roteiro, 'S',
      v_banca, v_compareceu, v_link)
    on conflict ("DS_CHAVE_ORIGEM") do update set
      "ST_ATIVO" = 'S', "CO_ROTEIRO" = excluded."CO_ROTEIRO", "NU_BANCA" = excluded."NU_BANCA",
      "ST_COMPARECEU" = excluded."ST_COMPARECEU", "DS_LINK_PLANILHA" = excluded."DS_LINK_PLANILHA", "DT_ATUALIZACAO" = now()
    returning e."CO_ENTREVISTA" into v_ent;

    insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_ent, 'convocacao', left('importada da planilha da banca: ' || v_motivo, 2000), p_usuario),
           (v_ent, 'compareceu', v_compareceu, p_usuario);

    if v_compareceu = 'S' then
      for n in select value from jsonb_array_elements(coalesce(x -> 'notas', '[]'::jsonb)) loop
        select * into v_comp from public."TB_ROTEIRO_COMPETENCIA" k
         where k."CO_ROTEIRO" = v_roteiro and k."NU_ORDEM" = nullif(n ->> 'ordem', '')::smallint;
        if v_comp."CO_COMPETENCIA" is null then
          raise exception 'Competência % não é do roteiro', n ->> 'ordem' using errcode = '22023';
        end if;
        v_av := (v_avaliadores ->> (v_banca || '|' || (n ->> 'posicao')))::uuid;
        if v_av is null then
          raise exception 'Avaliador % da banca % não informado', n ->> 'posicao', v_banca using errcode = '22023';
        end if;
        v_nota := nullif(n ->> 'nota', '')::numeric;
        if v_nota is null then continue; end if;
        if v_nota < 0 or v_nota > v_comp."VL_NOTA_MAXIMA" then
          raise exception 'Nota % fora da faixa de % (0 a %)', v_nota, v_comp."NO_COMPETENCIA", v_comp."VL_NOTA_MAXIMA"
            using errcode = '22023';
        end if;
        insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
        values (v_ent, v_comp."CO_COMPETENCIA", v_av, v_nota, p_usuario);
        insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
        values (v_ent, v_comp."CO_COMPETENCIA", v_av, 'nota', null, v_nota::text, p_usuario);
      end loop;
    end if;

    perform private."FC_CALCULAR_ENTREVISTA"(v_ent);
    select * into v_final from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = v_ent;

    -- Inapto ou ausente: a justificativa da banca pelo motivo (como a tela exige).
    if v_final."ST_COMPARECEU" = 'N' or v_final."TP_PARECER" = 'INAPTO' then
      select string_agg(k."NO_COMPETENCIA", ', ' order by k."NU_ORDEM") into v_abaixo
        from public."TB_ROTEIRO_COMPETENCIA" k
        join public."TB_ENTREVISTA_NOTA" t on t."CO_ENTREVISTA" = v_ent and t."NU_ORDEM" = k."NU_ORDEM"
       where k."CO_ROTEIRO" = v_roteiro and k."VL_MINIMO" is not null
         and t."VL_NOTA" < case when k."TP_MINIMO" = 'PERCENTUAL'
                                then k."VL_NOTA_MAXIMA" * k."VL_PESO" * k."VL_MINIMO" / 100.0 else k."VL_MINIMO" end;
      v_just := case
        when v_final."ST_COMPARECEU" = 'N' then 'Não compareceu à entrevista.'
        when v_abaixo is not null then 'Nota abaixo do mínimo em: ' || v_abaixo || '.'
        else 'Nota total abaixo do mínimo de ' || trim_scale(v_r."VL_NOTA_MINIMA_TOTAL") || '.'
      end || ' Resultado importado da planilha da banca.';
      update public."TB_ENTREVISTA" set "DS_JUSTIFICATIVA_BANCA" = v_just where "CO_ENTREVISTA" = v_ent;
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      values (v_ent, 'justificativa', null, v_just, p_usuario);
    end if;

    -- O que a planilha dizia: diferença de nota (mais de 0,02) ou de parecer volta para conferir.
    v_planilha_nota := nullif(x -> 'planilha' ->> 'nota_final', '')::numeric;
    v_planilha_parecer := upper(nullif(x -> 'planilha' ->> 'parecer', ''));
    if (v_planilha_nota is not null and abs(coalesce(v_final."VL_NOTA_TOTAL", 0) - v_planilha_nota) > 0.02)
       or (v_planilha_parecer is not null and v_planilha_parecer is distinct from v_final."TP_PARECER") then
      v_divergentes := v_divergentes || jsonb_build_array(jsonb_build_object(
        'analise', v_a.id, 'nota_sistema', v_final."VL_NOTA_TOTAL", 'nota_planilha', v_planilha_nota,
        'parecer_sistema', v_final."TP_PARECER", 'parecer_planilha', v_planilha_parecer));
    end if;
    v_qt := v_qt + 1;
  end loop;

  perform private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(v_m."CO_AREA", p_edital, p_usuario);

  return jsonb_build_object(
    'importadas', v_qt,
    'avaliadores', (select count(*) from jsonb_object_keys(v_avaliadores)),
    'aptos', (select count(*) from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" = p_edital
               and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S' and e."TP_PARECER" = 'APTO'),
    'divergentes', v_divergentes);
end;
$$;

comment on function private."FC_IMPORTAR_ENTREVISTAS_DA_PLANILHA"(uuid, jsonb, text, uuid) is
  'Importa as entrevistas da planilha da banca ("Avaliação Estruturada por Competência"; 16/11/2026): os avaliadores (TB_ENTREVISTA_AVALIADOR, origem "Planilha da banca"), cada entrevista como a ficha de notas do sistema (TB_ENTREVISTA sistema, sem exigir a lista de convocação), com banca, comparecimento, endereço da planilha e as notas de cada avaliador por competência (sem a escala do roteiro: a planilha guarda médias). Nota total e parecer pelo sistema (FC_CALCULAR_ENTREVISTA), comparados com os da planilha (devolve as divergências); inapto ou ausente recebe a justificativa pelo motivo. Histórico em TH_ENTREVISTA_AVALIACAO. Recusa edital com entrevista já lançada no sistema. p_dados: {avaliadores: [{banca, posicao, nome}], entrevistas: [{analise, banca, compareceu, link, notas: [{ordem, posicao, nota}], planilha: {nota_final, parecer}}]}. Sem grant.';

revoke all on function private."FC_IMPORTAR_ENTREVISTAS_DA_PLANILHA"(uuid, jsonb, text, uuid) from public, anon, authenticated;


do $ensaio$
declare
  v_edital constant uuid := 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';
  v_a uuid[];
  v_eu uuid;
  v jsonb;
  v_e1 public."TB_ENTREVISTA";
  v_e2 public."TB_ENTREVISTA";
begin
  -- Sem entrevista lançada no sistema (senão a importação recusa).
  if exists (select 1 from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" = v_edital and e."TP_ORIGEM" = 'sistema'
              and e."ST_ATIVO" = 'S' and e."ST_COMPARECEU" is not null) then
    raise notice 'ENSAIO: o 93/2026 já tem entrevista lançada; confira só a criação da função.';
    return;
  end if;
  select array_agg(id order by id) into v_a from (
    select a.id from public."TB_ANALISE_CURRICULAR" a
     where a.edital = '93/2026' and a.ativo and a.status_consolidado = 'Aprovado' order by a.id limit 2) x;
  select u.user_id into v_eu from public."TB_PERFIL_USUARIO" u where u.ativo order by u.user_id limit 1;

  v := private."FC_IMPORTAR_ENTREVISTAS_DA_PLANILHA"(v_edital, jsonb_build_object(
    'avaliadores', jsonb_build_array(
      jsonb_build_object('banca', 1, 'posicao', '1', 'nome', 'Avaliador de ensaio 1'),
      jsonb_build_object('banca', 1, 'posicao', '2', 'nome', 'Avaliador de ensaio 2')),
    'entrevistas', jsonb_build_array(
      -- Compareceu: técnica (2+1,67)/2 = 1,835 → 1,84; intercultural (1,75+2)/2 × 1,5 = 2,81;
      -- comportamental (1,76+1,76)/2 × 1,5 = 2,64; situacional (1+1)/2 = 1 → total 8,29, Apto.
      jsonb_build_object('analise', v_a[1], 'banca', 1, 'compareceu', 'S',
        'link', 'https://docs.google.com/spreadsheets/d/ensaio/edit',
        'notas', jsonb_build_array(
          jsonb_build_object('ordem', 1, 'posicao', '1', 'nota', 2), jsonb_build_object('ordem', 1, 'posicao', '2', 'nota', 1.67),
          jsonb_build_object('ordem', 2, 'posicao', '1', 'nota', 1.75), jsonb_build_object('ordem', 2, 'posicao', '2', 'nota', 2),
          jsonb_build_object('ordem', 3, 'posicao', '1', 'nota', 1.76), jsonb_build_object('ordem', 3, 'posicao', '2', 'nota', 1.76),
          jsonb_build_object('ordem', 4, 'posicao', '1', 'nota', 1), jsonb_build_object('ordem', 4, 'posicao', '2', 'nota', 1)),
        'planilha', jsonb_build_object('nota_final', 8.3, 'parecer', 'APTO')),
      -- Faltou: nota 0, Inapto, justificativa de ausência.
      jsonb_build_object('analise', v_a[2], 'banca', 1, 'compareceu', 'N',
        'planilha', jsonb_build_object('nota_final', 0, 'parecer', 'INAPTO')))),
    'Ensaio da importação das entrevistas', v_eu);
  raise notice 'importação: %', v;

  select * into v_e1 from public."TB_ENTREVISTA" where "DS_CHAVE_ORIGEM" = 'sistema|' || v_edital || '|' || v_a[1];
  select * into v_e2 from public."TB_ENTREVISTA" where "DS_CHAVE_ORIGEM" = 'sistema|' || v_edital || '|' || v_a[2];
  if v_e1."VL_NOTA_TOTAL" <> 8.29 or v_e1."TP_PARECER" <> 'APTO' or v_e1."NU_BANCA" <> 1 or v_e1."ST_COMPARECEU" <> 'S' then
    raise exception 'ENSAIO: entrevista 1 com nota % e parecer %', v_e1."VL_NOTA_TOTAL", v_e1."TP_PARECER";
  end if;
  if v_e2."VL_NOTA_TOTAL" <> 0 or v_e2."TP_PARECER" <> 'INAPTO'
     or v_e2."DS_JUSTIFICATIVA_BANCA" <> 'Não compareceu à entrevista. Resultado importado da planilha da banca.' then
    raise exception 'ENSAIO: entrevista 2 com nota %, parecer % e justificativa %', v_e2."VL_NOTA_TOTAL", v_e2."TP_PARECER", v_e2."DS_JUSTIFICATIVA_BANCA";
  end if;
  if (v ->> 'importadas')::int <> 2 or jsonb_array_length(v -> 'divergentes') <> 0 then
    raise exception 'ENSAIO: resposta inesperada %', v;
  end if;
  if (select count(*) from public."TB_ENTREVISTA_AVALIACAO" where "CO_ENTREVISTA" = v_e1."CO_ENTREVISTA") <> 8 then
    raise exception 'ENSAIO: a entrevista 1 não tem as 8 notas';
  end if;
  begin
    perform private."FC_IMPORTAR_ENTREVISTAS_DA_PLANILHA"(v_edital, '{"avaliadores": [], "entrevistas": [{}]}'::jsonb,
      'Ensaio: segunda importação', v_eu);
    raise exception 'ENSAIO: a segunda importação passou';
  exception when sqlstate '23514' then
    null;
  end;
  raise notice 'ENSAIO OK: nota e parecer pelo sistema, justificativa da ausência, segunda importação recusada';
end
$ensaio$;

rollback;
