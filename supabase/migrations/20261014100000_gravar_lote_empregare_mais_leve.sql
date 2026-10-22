/*
  GRAVAR_LOTE_EMPREGARE MAIS LEVE

  Por quê: na execução de 14/10 10:00 UTC (edital 114/2026) a vaga 182528
  (Motorista D, BH, 769 candidatos) falhou três vezes com 57014 (statement
  timeout de 8 s do authenticator) no lote de 500 linhas. O pg_stat_statements
  mostrava a RPC com média de 1,3 s, máxima de 7,7 s e 61 mil blocos
  temporários escritos: cada linha leva o questionário inteiro (~3 KB de jsonb
  comprimido, bem mais em texto) e o lote de 500 não cabe no work_mem (2 MB),
  então a leitura do JSON, o "distinct on" e a tabela temporária iam para o
  disco. No ensaio, o primeiro lote frio de 500 levou 3,7 s; em produção, sob
  carga, passou de 8 s.

  Agora (mesma assinatura, mesma semântica, mesma resposta):
  - work_mem de 32 MB só nesta função: o lote inteiro fica em memória;
  - sem tabela temporária (um CTE só): nada de catálogo nem temp_buffers;
  - questionário sem mudança (mesmo hash) não é reescrito: a linha reaproveita
    o valor TOAST anterior em vez de gravar ~3 KB de novo por candidato;
  - FC_EMPREGARE_DATA e FC_EMPREGARE_MOMENTO sem bloco de exceção (uma
    subtransação por linha e por campo): pg_input_is_valid dá o mesmo
    resultado (texto inválido continua virando nulo).

  O robô também passa a mandar lotes de 200 e, se ainda assim um lote estourar
  o tempo, divide o lote ao meio e tenta de novo (scripts/robo-empregare).
  Os ausentes continuam sendo desativados só em fechar_vaga_empregare, no fim
  da vaga.

  Rollback: supabase/rollback/20261014100000_gravar_lote_empregare_mais_leve.sql
*/
begin;

create or replace function private."FC_EMPREGARE_DATA"(p_texto text)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_texto ~ '^\d{4}-\d{2}-\d{2}' and pg_input_is_valid(left(p_texto, 10), 'date')
    then left(p_texto, 10)::date
  end;
$$;

create or replace function private."FC_EMPREGARE_MOMENTO"(p_texto text)
returns timestamp with time zone
language sql
stable
set search_path = ''
as $$
  select case
    when p_texto ~ '^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$'
         and pg_input_is_valid(replace(p_texto, 'T', ' '), 'timestamp')
    then (replace(p_texto, 'T', ' ')::timestamp) at time zone 'America/Sao_Paulo'
  end;
$$;

create or replace function public.gravar_lote_empregare(p_sync text, p_vaga text, p_total integer, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set work_mem = '32MB'
as $$
declare
  v_situacao text;
  v_qt integer;
  v_com_link integer;
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

  with lote as materialized (
    select distinct on (l.chave)
           l.chave, l.tipo,
           nullif(left(btrim(l.codigo), 60), '') as codigo,
           nullif(left(btrim(l.nome), 300), '') as nome,
           nullif(left(lower(btrim(l.email)), 320), '') as email,
           case when l.cpf ~ '^[0-9]{11}$' then l.cpf end as cpf,
           nullif(left(btrim(l.telefone), 60), '') as telefone,
           private."FC_EMPREGARE_DATA"(l.nascimento) as nascimento,
           nullif(left(btrim(l.situacao), 200), '') as situacao,
           private."FC_EMPREGARE_MOMENTO"(l.candidatura) as candidatura,
           l.colunas,
           encode(sha256(convert_to(l.colunas::text, 'UTF8')), 'hex') as hash,
           -- Link fora do formato (outro site, javascript:, aspas) vira nulo: mantém o anterior.
           case when l.link ~ '^https://corporate\.empregare\.com/empresa/curriculo/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$'
                     and length(l.link) <= 600
                then l.link end as link
      from jsonb_to_recordset(p_linhas) as l(
        chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
        nascimento text, situacao text, candidatura text, colunas jsonb, link text)
     where l.chave ~ '^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$'
       and l.tipo in ('CODIGO', 'CPF', 'EMAIL')
       and jsonb_typeof(l.colunas) = 'object'
     order by l.chave
  ),
  gravadas as (
    insert into public."TB_EMPREGARE_CANDIDATO" as c (
      "CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO", "DS_EMAIL",
      "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
      "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA", "CO_SYNC", "ST_REGISTRO_ATIVO", "DS_LINK_DETALHE", "DT_CAPTURA_LINK")
    select p_vaga, t.chave, t.tipo, t.codigo, t.nome, t.email, t.cpf, t.telefone, t.nascimento,
           t.situacao, t.candidatura, t.colunas, t.hash, p_sync, 'S', t.link,
           case when t.link is not null then now() end
      from lote t
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
      -- Mesmo hash: mantém o valor gravado (o TOAST anterior é reaproveitado, nada de reescrever ~3 KB).
      "DS_COLUNA_ORIGINAL" = case
        when c."DS_HASH_LINHA" is distinct from excluded."DS_HASH_LINHA" then excluded."DS_COLUNA_ORIGINAL"
        else c."DS_COLUNA_ORIGINAL" end,
      "DS_HASH_LINHA" = excluded."DS_HASH_LINHA",
      "CO_SYNC" = excluded."CO_SYNC",
      "DT_ATUALIZACAO" = case
        when c."DS_HASH_LINHA" is distinct from excluded."DS_HASH_LINHA" or c."ST_REGISTRO_ATIVO" = 'N' then now()
        else c."DT_ATUALIZACAO" end,
      "DT_CONFERENCIA" = now(),
      "ST_REGISTRO_ATIVO" = 'S',
      "DT_DESATIVACAO" = null,
      "DS_LINK_DETALHE" = coalesce(excluded."DS_LINK_DETALHE", c."DS_LINK_DETALHE"),
      "DT_CAPTURA_LINK" = coalesce(excluded."DT_CAPTURA_LINK", c."DT_CAPTURA_LINK")
    returning 1
  )
  select (select count(*) from gravadas), count(*) filter (where t.link is not null)
    into v_qt, v_com_link
    from lote t;

  update public."TB_EMPREGARE_VAGA" set "QT_RECEBIDA" = "QT_RECEBIDA" + v_qt, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  update public."TL_SYNC_EMPREGARE" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('situacao', 'EM_CARGA', 'recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt,
                            'com_link', v_com_link);
end;
$$;

comment on function public.gravar_lote_empregare(text, text, integer, jsonb) is
  'Recebe um lote (até 1000; o robô manda 200) de candidatos de uma vaga e faz upsert em TB_EMPREGARE_CANDIDATO pela chave natural (o hash da linha diz se mudou; mesmo hash não reescreve o questionário). Cada linha aceita "link" (opcional): o link da página de detalhes do candidato na Empregare, gravado em DS_LINK_DETALHE quando válido; sem link, fica o anterior. p_total = candidatos do arquivo inteiro: no primeiro lote da vaga, a trava recusa (RECUSADA, nada gravado) o arquivo com menos da metade dos ativos sem forçar. Os ausentes só saem em fechar_vaga_empregare, no fim da vaga. work_mem de 32 MB só nesta função. Só service_role.';

revoke all on function private."FC_EMPREGARE_DATA"(text) from public, anon, authenticated;
revoke all on function private."FC_EMPREGARE_MOMENTO"(text) from public, anon, authenticated;
revoke all on function public.gravar_lote_empregare(text, text, integer, jsonb) from public, anon, authenticated;

commit;
