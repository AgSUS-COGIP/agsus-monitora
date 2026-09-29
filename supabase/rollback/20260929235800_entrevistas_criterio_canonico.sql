-- Volta sincronizar_entrevistas à versão sem texto canônico (os textos já acertados ficam).
begin;

create or replace function public.sincronizar_entrevistas(p_sync text, p_area text, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  if p_sync is null or p_sync !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de carga inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  insert into public."TL_SYNC_ENTREVISTA" ("CO_SYNC", "CO_AREA")
  values (p_sync, p_area)
  on conflict ("CO_SYNC") do nothing;
  if exists (select 1 from public."TL_SYNC_ENTREVISTA" s
              where s."CO_SYNC" = p_sync and (s."CO_AREA" <> p_area or s."TP_SITUACAO" <> 'EM_ANDAMENTO')) then
    raise exception 'Carga % já fechada ou de outra área', p_sync using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.tmp_entrevista_lote (
    chave text, unidade text, edital text, vaga text, candidato text, codigo text,
    modalidade text, cargo text, nota numeric, parecer text, compareceu text,
    link text, notas jsonb
  ) on commit drop;
  truncate pg_temp.tmp_entrevista_lote;

  insert into pg_temp.tmp_entrevista_lote
  select distinct on (x.chave) x.*
    from (
      select
        p_area || '|' || coalesce(private."FC_NUMERO_EDITAL"(l.edital), lower(l.edital)) || '|' || l.vaga || '|' ||
          coalesce(nullif(l.codigo, ''), 'nome:' || private."FC_TEXTO_BUSCA_RECURSO"(l.candidato)) as chave,
        l.unidade, l.edital, l.vaga, l.candidato, nullif(l.codigo, '') as codigo,
        nullif(array_to_string(array(
          select btrim(t) from unnest(string_to_array(replace(coalesce(l.modalidade, ''), '"', ''), ',')) t
           where btrim(t) <> ''), ' / '), '') as modalidade,
        nullif(l.cargo, '') as cargo,
        case when l.nota ~ '^-?\d+([.,]\d+)?$' then replace(l.nota, ',', '.')::numeric end as nota,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ '(inapto|reprovad|nao apto)' then 'INAPTO'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ 'apto' then 'APTO'
          else 'SEM_PARECER' end as parecer,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(nao|n|ausente|faltou)' then 'N'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(sim|s|compareceu|presente)' then 'S'
          end as compareceu,
        nullif(l.link, '') as link,
        coalesce(l.notas, '[]'::jsonb) as notas
      from jsonb_to_recordset(p_linhas) as l(
        unidade text, edital text, vaga text, candidato text, codigo text, modalidade text,
        cargo text, nota text, parecer text, compareceu text, link text, notas jsonb)
      where btrim(coalesce(l.candidato, '')) <> ''
        and btrim(coalesce(l.vaga, '')) <> ''
        and btrim(coalesce(l.edital, '')) <> ''
    ) x
   order by x.chave;

  insert into public."TB_ENTREVISTA" as e (
    "CO_AREA", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO",
    "DS_MODALIDADE", "NO_CARGO", "VL_NOTA_TOTAL", "TP_PARECER", "ST_COMPARECEU",
    "DS_LINK_PLANILHA", "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_SYNC", "ST_ATIVO")
  select p_area, left(coalesce(t.unidade, ''), 200), left(t.edital, 120), left(t.vaga, 60),
         left(t.candidato, 200), left(t.codigo, 60), left(t.modalidade, 300), left(t.cargo, 400),
         t.nota, t.parecer, t.compareceu, left(t.link, 500), 'planilha', t.chave, p_sync, 'S'
    from pg_temp.tmp_entrevista_lote t
  on conflict ("DS_CHAVE_ORIGEM") do update set
    "NO_UNIDADE" = excluded."NO_UNIDADE",
    "DS_EDITAL" = excluded."DS_EDITAL",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "CO_CANDIDATO" = excluded."CO_CANDIDATO",
    "DS_MODALIDADE" = excluded."DS_MODALIDADE",
    "NO_CARGO" = excluded."NO_CARGO",
    "VL_NOTA_TOTAL" = excluded."VL_NOTA_TOTAL",
    "TP_PARECER" = excluded."TP_PARECER",
    "ST_COMPARECEU" = excluded."ST_COMPARECEU",
    "DS_LINK_PLANILHA" = excluded."DS_LINK_PLANILHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "ST_ATIVO" = 'S',
    "DT_ATUALIZACAO" = now()
  where e."TP_ORIGEM" = 'planilha';

  -- Notas: upsert por ordem; ordem que sumiu fica com nota nula (nada é apagado).
  with n as (
    select e."CO_ENTREVISTA", (c.ord)::smallint as ordem,
           left(btrim(c.item->>'criterio'), 600) as criterio,
           case when (c.item->>'nota') ~ '^-?\d+([.,]\d+)?$' then replace(c.item->>'nota', ',', '.')::numeric end as nota
      from pg_temp.tmp_entrevista_lote t
      join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
      cross join lateral jsonb_array_elements(t.notas) with ordinality c(item, ord)
     where c.ord between 1 and 20 and btrim(coalesce(c.item->>'criterio', '')) <> ''
  )
  insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
  select "CO_ENTREVISTA", ordem, criterio, nota from n
  on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set
    "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA";

  update public."TB_ENTREVISTA_NOTA" en set "VL_NOTA" = null
    from pg_temp.tmp_entrevista_lote t
    join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
   where en."CO_ENTREVISTA" = e."CO_ENTREVISTA"
     and en."NU_ORDEM" > (select count(*) from jsonb_array_elements(t.notas) x
                           where btrim(coalesce(x->>'criterio', '')) <> '')
     and en."VL_NOTA" is not null;

  select count(*) into v_qt from pg_temp.tmp_entrevista_lote;
  update public."TL_SYNC_ENTREVISTA" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt);
end;
$function$;

drop function if exists private."FC_CRITERIO_ENTREVISTA"(text);

commit;
