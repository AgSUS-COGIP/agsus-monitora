-- Desfaz 20261014100000: volta gravar_lote_empregare (tabela temporária, work_mem padrão, sempre
-- regrava o questionário) e FC_EMPREGARE_DATA/MOMENTO (bloco de exceção) às definições anteriores.
-- O robô continua funcionando: lotes de 200 cabem na função antiga.
begin;
CREATE OR REPLACE FUNCTION private."FC_EMPREGARE_DATA"(p_texto text)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin
  if p_texto is null or p_texto !~ '^\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  return left(p_texto, 10)::date;
exception when others then
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION private."FC_EMPREGARE_MOMENTO"(p_texto text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if p_texto is null or p_texto !~ '^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$' then
    return null;
  end if;
  return (replace(p_texto, 'T', ' ')::timestamp) at time zone 'America/Sao_Paulo';
exception when others then
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gravar_lote_empregare(p_sync text, p_vaga text, p_total integer, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_situacao text;
  v_qt integer;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if coalesce(p_total, -1) not between 1 and 50000 then
    raise exception 'Total de candidatos fora de 1 a 50000' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  v_situacao := private."FC_EMPREGARE_ABRIR_VAGA"(p_sync, p_vaga, p_total);
  if v_situacao <> 'EM_CARGA' then
    return jsonb_build_object('situacao', v_situacao, 'gravadas', 0);
  end if;

  create temporary table if not exists pg_temp.tmp_empregare_lote_link (
    chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
    nascimento date, situacao text, candidatura timestamptz, colunas jsonb, hash text, link text
  ) on commit drop;
  truncate pg_temp.tmp_empregare_lote_link;

  insert into pg_temp.tmp_empregare_lote_link
  select distinct on (l.chave)
         l.chave, l.tipo,
         nullif(left(btrim(l.codigo), 60), ''),
         nullif(left(btrim(l.nome), 300), ''),
         nullif(left(lower(btrim(l.email)), 320), ''),
         case when l.cpf ~ '^[0-9]{11}$' then l.cpf end,
         nullif(left(btrim(l.telefone), 60), ''),
         private."FC_EMPREGARE_DATA"(l.nascimento),
         nullif(left(btrim(l.situacao), 200), ''),
         private."FC_EMPREGARE_MOMENTO"(l.candidatura),
         l.colunas,
         encode(sha256(convert_to(l.colunas::text, 'UTF8')), 'hex'),
         -- Link fora do formato (outro site, javascript:, aspas) vira nulo: mantém o anterior.
         case when l.link ~ '^https://corporate\.empregare\.com/empresa/curriculo/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$'
                   and length(l.link) <= 600
              then l.link end
    from jsonb_to_recordset(p_linhas) as l(
      chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
      nascimento text, situacao text, candidatura text, colunas jsonb, link text)
   where l.chave ~ '^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$'
     and l.tipo in ('CODIGO', 'CPF', 'EMAIL')
     and jsonb_typeof(l.colunas) = 'object'
   order by l.chave;

  insert into public."TB_EMPREGARE_CANDIDATO" as c (
    "CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO", "DS_EMAIL",
    "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA", "CO_SYNC", "ST_REGISTRO_ATIVO", "DS_LINK_DETALHE", "DT_CAPTURA_LINK")
  select p_vaga, t.chave, t.tipo, t.codigo, t.nome, t.email, t.cpf, t.telefone, t.nascimento,
         t.situacao, t.candidatura, t.colunas, t.hash, p_sync, 'S', t.link,
         case when t.link is not null then now() end
    from pg_temp.tmp_empregare_lote_link t
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set
    "TP_CHAVE" = excluded."TP_CHAVE",
    "CO_CANDIDATO_EMPREGARE" = excluded."CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "DS_EMAIL" = excluded."DS_EMAIL",
    "NU_CPF" = excluded."NU_CPF",
    "NU_TELEFONE" = excluded."NU_TELEFONE",
    "DT_NASCIMENTO" = excluded."DT_NASCIMENTO",
    "DS_SITUACAO_EMPREGARE" = excluded."DS_SITUACAO_EMPREGARE",
    "DT_CANDIDATURA" = excluded."DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL" = excluded."DS_COLUNA_ORIGINAL",
    "DS_HASH_LINHA" = excluded."DS_HASH_LINHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "DT_ATUALIZACAO" = case
      when c."DS_HASH_LINHA" is distinct from excluded."DS_HASH_LINHA" or c."ST_REGISTRO_ATIVO" = 'N' then now()
      else c."DT_ATUALIZACAO" end,
    "DT_CONFERENCIA" = now(),
    "ST_REGISTRO_ATIVO" = 'S',
    "DT_DESATIVACAO" = null,
    "DS_LINK_DETALHE" = coalesce(excluded."DS_LINK_DETALHE", c."DS_LINK_DETALHE"),
    "DT_CAPTURA_LINK" = coalesce(excluded."DT_CAPTURA_LINK", c."DT_CAPTURA_LINK");

  select count(*) into v_qt from pg_temp.tmp_empregare_lote_link;
  update public."TB_EMPREGARE_VAGA" set "QT_RECEBIDA" = "QT_RECEBIDA" + v_qt, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  update public."TL_SYNC_EMPREGARE" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('situacao', 'EM_CARGA', 'recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt,
                            'com_link', (select count(*) from pg_temp.tmp_empregare_lote_link t where t.link is not null));
end;
$function$
;

comment on function public.gravar_lote_empregare(text, text, integer, jsonb) is
  'Recebe um lote (até 1000) de candidatos de uma vaga e faz upsert em TB_EMPREGARE_CANDIDATO pela chave natural (o hash da linha diz se mudou). Cada linha aceita "link" (opcional): o link da página de detalhes do candidato na Empregare, gravado em DS_LINK_DETALHE quando válido; sem link, fica o anterior. p_total = candidatos do arquivo inteiro: no primeiro lote da vaga, a trava recusa (RECUSADA, nada gravado) o arquivo com menos da metade dos ativos sem forçar. Fechar com fechar_vaga_empregare. Só service_role.';
commit;
