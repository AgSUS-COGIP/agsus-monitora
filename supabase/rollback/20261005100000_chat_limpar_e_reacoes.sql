-- Desfaz 20261005100000_chat_limpar_e_reacoes: tira as RPCs limpar_conversa_chat e
-- alternar_reacao_chat, volta listar_mensagens_chat, FC_CHAT_CONVERSA_JSON e
-- FC_CHAT_MENSAGEM_JSON ao corpo de 20261002210000_chat.sql, tira a tabela de
-- reações (sai da publicação supabase_realtime junto) e a coluna DT_LIMPEZA.
-- ATENÇÃO: perde as reações e quem limpou volta a ver o histórico inteiro.
-- Exporte antes, se precisar guardar:
--   select * from public."RL_MENSAGEM_REACAO";
begin;

drop function if exists public.alternar_reacao_chat(uuid, text);
drop function if exists public.limpar_conversa_chat(uuid);

-- Corpos de 20261002210000_chat.sql (sem limpeza e sem reações).
create or replace function private."FC_CHAT_MENSAGEM_JSON"(p_mensagem uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', m."CO_MENSAGEM",
    'conversa', m."CO_CONVERSA",
    'autor', m."CO_USUARIO_AUTOR",
    'texto', m."DS_TEXTO",
    'link', m."DS_LINK_TELA",
    'mencoes', to_jsonb(m."CO_USUARIOS_MENCIONADOS"),
    'criada_em', m."DT_CRIACAO",
    'editada_em', m."DT_EDICAO",
    'apagada', m."ST_APAGADA" = 'S')
  from public."TB_MENSAGEM" m
  where m."CO_MENSAGEM" = p_mensagem;
$function$;
comment on function private."FC_CHAT_MENSAGEM_JSON"(uuid) is
  'Uma mensagem no formato da tela (o mesmo que o Realtime entrega, com nomes de campo da tela).';

create or replace function private."FC_CHAT_CONVERSA_JSON"(p_conversa uuid, p_usuario uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', c."CO_CONVERSA",
    'tipo', c."TP_CONVERSA",
    'nome', c."NO_CONVERSA",
    'edital', case when c."TP_CONVERSA" = 'EDITAL' then jsonb_build_object(
      'id', m.id,
      'titulo', coalesce(nullif(btrim(m.edital), ''), m.unidade, 'Edital'),
      'unidade', m.unidade,
      'area', m."CO_AREA") end,
    'criador', c."CO_USUARIO_CRIADOR",
    'criada_em', c."DT_CRIACAO",
    'atualizada_em', coalesce(c."DT_ULTIMA_MENSAGEM", c."DT_CRIACAO"),
    'participantes', coalesce((
      select jsonb_agg(private."FC_CHAT_PESSOA"(p."CO_USUARIO") || jsonb_build_object('papel', p."TP_PAPEL")
                       order by p."DT_ENTRADA", p."CO_USUARIO")
        from public."RL_CONVERSA_PARTICIPANTE" p
       where p."CO_CONVERSA" = c."CO_CONVERSA" and p."DT_SAIDA" is null), '[]'::jsonb),
    'participa', eu."CO_USUARIO" is not null and eu."DT_SAIDA" is null,
    'lida_em', eu."DT_ULTIMA_LEITURA",
    'silenciada', coalesce(eu."ST_SILENCIADA" = 'S', false),
    'nao_lidas', (
      select count(*) from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA" and x."CO_USUARIO_AUTOR" <> p_usuario and x."ST_APAGADA" = 'N'
         and (eu."DT_ULTIMA_LEITURA" is null or x."DT_CRIACAO" > eu."DT_ULTIMA_LEITURA")),
    'mencoes', (
      select count(*) from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA" and x."CO_USUARIO_AUTOR" <> p_usuario and x."ST_APAGADA" = 'N'
         and p_usuario = any (x."CO_USUARIOS_MENCIONADOS")
         and (eu."DT_ULTIMA_LEITURA" is null or x."DT_CRIACAO" > eu."DT_ULTIMA_LEITURA")),
    'ultima', (
      select jsonb_build_object(
               'id', x."CO_MENSAGEM",
               'autor', x."CO_USUARIO_AUTOR",
               'texto', left(x."DS_TEXTO", 160),
               'apagada', x."ST_APAGADA" = 'S',
               'criada_em', x."DT_CRIACAO")
        from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA"
       order by x."DT_CRIACAO" desc, x."CO_MENSAGEM" desc
       limit 1))
  from public."TB_CONVERSA" c
  left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c."CO_MONITORAMENTO"
  left join public."RL_CONVERSA_PARTICIPANTE" eu on eu."CO_CONVERSA" = c."CO_CONVERSA" and eu."CO_USUARIO" = p_usuario
  where c."CO_CONVERSA" = p_conversa;
$function$;
comment on function private."FC_CHAT_CONVERSA_JSON"(uuid, uuid) is
  'Uma conversa como a pessoa a vê: tipo, nome, edital, participantes (com online), não lidas, menções não lidas, silenciada e a última mensagem.';

create or replace function public.listar_mensagens_chat(p_conversa uuid, p_antes timestamptz default null, p_limite integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_ids uuid[];
begin
  perform private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  select coalesce(array_agg(s.id order by s.criada_em desc, s.id desc), '{}') into v_ids
    from (
      select m."CO_MENSAGEM" as id, m."DT_CRIACAO" as criada_em
        from public."TB_MENSAGEM" m
       where m."CO_CONVERSA" = p_conversa
         and (p_antes is null or m."DT_CRIACAO" < p_antes)
       order by m."DT_CRIACAO" desc, m."CO_MENSAGEM" desc
       limit v_limite + 1
    ) s;
  return jsonb_build_object(
    'conversa', private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid),
    'tem_mais', cardinality(v_ids) > v_limite,
    'mensagens', coalesce((
      select jsonb_agg(private."FC_CHAT_MENSAGEM_JSON"(m."CO_MENSAGEM") order by m."DT_CRIACAO", m."CO_MENSAGEM")
        from public."TB_MENSAGEM" m
       where m."CO_MENSAGEM" = any (v_ids[1:v_limite])), '[]'::jsonb));
end;
$function$;
comment on function public.listar_mensagens_chat(uuid, timestamptz, integer) is
  'Uma página de mensagens da conversa (as mais novas antes de p_antes, até p_limite, no máximo 100), em ordem de envio, com a conversa e tem_mais. Exige poder ler a conversa.';

-- drop table tira a tabela da publicação supabase_realtime.
drop table if exists public."RL_MENSAGEM_REACAO";
drop function if exists private."FC_CHAT_REACOES"();
alter table public."RL_CONVERSA_PARTICIPANTE" drop column if exists "DT_LIMPEZA";

notify pgrst, 'reload schema';

commit;
