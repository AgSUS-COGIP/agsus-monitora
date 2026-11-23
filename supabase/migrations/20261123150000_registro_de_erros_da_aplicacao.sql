/*
  REGISTRO DOS ERROS DA APLICAÇÃO (O QUE QUEBRA NO NAVEGADOR DAS PESSOAS)

  Até aqui o Yeendé não sabia dos erros que aconteciam no navegador de quem usa:
  um erro de JavaScript, uma promessa rejeitada sem tratamento ou uma parte da
  tela que não desenhou ficavam só no console da pessoa. O desenho vem do SIGAV
  (outro sistema da AgSUS): o navegador manda um registro curto e já limpo, com
  uma referência opaca que a pessoa passa ao suporte ("Código do erro: …"), e o
  banco repete a limpeza antes de gravar.

  O QUE ESTA MIGRATION FAZ
    1. public."TL_ERRO_APLICACAO": uma linha por erro — referência, tipo
       (CLIENTE, SERVIDOR, REDE, BANCO, DESCONHECIDO), mensagem e contexto
       limpos, rota (só o caminho), versão do build, área, status HTTP, quem
       (auth.uid(), nunca o e-mail) e quando. RLS ligada, sem policy e sem
       privilégio para anon/authenticated: ninguém lê nem grava direto.
    2. private."FC_LIMPAR_TEXTO_ERRO"(texto, limite): a mesma limpeza do
       navegador (src/lib/seguranca/registro-de-erros.ts). Tira token
       (Bearer e JWT), e-mail, CPF com pontuação, telefone e qualquer sequência
       de 5 ou mais dígitos; corta no limite.
    3. public.registrar_erro_da_aplicacao(...): só com sessão. Repete a
       limpeza, limita os tamanhos, ignora a repetição do mesmo erro da mesma
       pessoa em 30 s e passa a ignorar depois de 30 registros da pessoa no
       último minuto (devolve registrado = false, sem erro: o navegador não
       insiste). Apaga aos poucos (50 por chamada) o que passou de 180 dias.
    4. public.listar_erros_da_aplicacao(...): leitura para uma tela futura, só
       para o administrador global ativo (private."FC_ADMIN_GLOBAL_ATIVO").
       Ainda não entra em src/lib/rpc-contrato.ts: o contrato só aceita RPC que
       o front chama; entra com a tela.

  O front já chama registrar_erro_da_aplicacao: enquanto esta migration não
  estiver aplicada, a função ausente (PGRST202) é ignorada em silêncio e o
  navegador para de tentar naquela página.

  Ensaio:   supabase/ensaios/20261123150000_registro_de_erros_da_aplicacao.sql
  Rollback: supabase/rollback/20261123150000_registro_de_erros_da_aplicacao.sql
  Testes:   tests/repositorio-e-banco.test.ts (bloco `registro-de-erros-no-banco`, PGlite)
            e tests/demais-regras.test.ts (bloco `lib/registro-de-erros`).
*/
begin;

set local lock_timeout = '5s';

-- 0. Guardas ---------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TL_ERRO_APLICACAO"') is not null then
    raise exception 'A migration 20261123150000 já foi aplicada (TL_ERRO_APLICACAO existe).';
  end if;
  if to_regclass('public."TB_AREA"') is null
     or to_regprocedure('private."FC_ADMIN_GLOBAL_ATIVO"(uuid)') is null then
    raise exception 'Faltam TB_AREA ou private."FC_ADMIN_GLOBAL_ATIVO"; confira o banco antes de aplicar.';
  end if;
end;
$$;

-- 1. O registro dos erros ---------------------------------------------------------------------
create table public."TL_ERRO_APLICACAO" (
  "CO_ERRO_APLICACAO" uuid default gen_random_uuid() not null,
  "CO_REFERENCIA" character varying(64) not null,
  "TP_ERRO" character varying(12) not null,
  "DS_MENSAGEM" character varying(500) not null,
  "DS_ROTA" character varying(200),
  "DS_CONTEXTO" jsonb default '{}'::jsonb not null,
  "CO_VERSAO_BUILD" character varying(64),
  "CO_AREA" text,
  "NU_STATUS_HTTP" smallint,
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamp with time zone default now() not null,
  constraint "PK_TL_ERRO_APLICACAO" primary key ("CO_ERRO_APLICACAO"),
  constraint "FK_AREA_ERROAPLIC" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_ERROAPLIC_TPERRO" check ("TP_ERRO" in ('CLIENTE', 'SERVIDOR', 'REDE', 'BANCO', 'DESCONHECIDO')),
  constraint "CK_ERROAPLIC_DSCONTEXTO" check (jsonb_typeof("DS_CONTEXTO") = 'object' and pg_column_size("DS_CONTEXTO") <= 16384),
  constraint "CK_ERROAPLIC_NUSTATUSHTTP" check ("NU_STATUS_HTTP" between 100 and 599),
  constraint "CK_ERROAPLIC_COREFERENCIA" check ("CO_REFERENCIA" ~ '^[a-z0-9-]{8,64}$')
);

create index "IN_ERROAPLIC_DTREGISTRO" on public."TL_ERRO_APLICACAO" ("DT_REGISTRO" desc);
create index "IN_ERROAPLIC_COUSUARIO" on public."TL_ERRO_APLICACAO" ("CO_USUARIO", "DT_REGISTRO" desc);
create index "IN_ERROAPLIC_COREFERENCIA" on public."TL_ERRO_APLICACAO" ("CO_REFERENCIA" varchar_pattern_ops);

alter table public."TL_ERRO_APLICACAO" enable row level security;
revoke all on table public."TL_ERRO_APLICACAO" from public, anon, authenticated;

comment on table public."TL_ERRO_APLICACAO" is 'Erros que aconteceram no navegador de quem usa o Yeendé (JavaScript, promessa rejeitada, parte da tela que não desenhou), já limpos de dado pessoal: referência mostrada à pessoa, tipo, mensagem, rota, contexto, versão do build, área, status HTTP, quem (id) e quando. Grava só registrar_erro_da_aplicacao; lê só listar_erros_da_aplicacao (administrador global). Guarda 180 dias. (20261123150000)';
comment on column public."TL_ERRO_APLICACAO"."CO_ERRO_APLICACAO" is 'Identificador do registro.';
comment on column public."TL_ERRO_APLICACAO"."CO_REFERENCIA" is 'Referência opaca gerada no navegador (UUID em minúsculas); a pessoa vê o começo dela ("Código do erro: …") e o suporte acha o registro pelo prefixo.';
comment on column public."TL_ERRO_APLICACAO"."TP_ERRO" is 'Tipo do erro: CLIENTE (código do navegador), SERVIDOR (HTTP 5xx), REDE (sem conexão ou falha de rede), BANCO (erro do PostgREST/PostgreSQL) ou DESCONHECIDO.';
comment on column public."TL_ERRO_APLICACAO"."DS_MENSAGEM" is 'Mensagem do erro, sem e-mail, CPF, telefone, token nem sequência de 5 ou mais dígitos (private."FC_LIMPAR_TEXTO_ERRO"); até 500 caracteres.';
comment on column public."TL_ERRO_APLICACAO"."DS_ROTA" is 'Caminho da página onde o erro aconteceu, sem consulta nem âncora, limpo como a mensagem; até 200 caracteres.';
comment on column public."TL_ERRO_APLICACAO"."DS_CONTEXTO" is 'Contexto técnico (objeto JSON de até 12 chaves simples: arquivo, linha, coluna, pilha, online, código, parte da tela…), com os textos limpos e cortados em 1.500 caracteres e só números pequenos (linha e coluna).';
comment on column public."TL_ERRO_APLICACAO"."CO_VERSAO_BUILD" is 'Versão do build aberta no navegador (o commit gravado no JS; nulo fora da Vercel).';
comment on column public."TL_ERRO_APLICACAO"."CO_AREA" is 'Área aberta quando o erro aconteceu (TB_AREA), quando havia uma.';
comment on column public."TL_ERRO_APLICACAO"."NU_STATUS_HTTP" is 'Status HTTP da resposta que falhou, quando o erro veio de uma (100 a 599).';
comment on column public."TL_ERRO_APLICACAO"."CO_USUARIO" is 'Quem estava com a sessão aberta (auth.uid()); nunca o e-mail.';
comment on column public."TL_ERRO_APLICACAO"."DT_REGISTRO" is 'Data e hora do registro (do servidor).';
comment on constraint "PK_TL_ERRO_APLICACAO" on public."TL_ERRO_APLICACAO" is 'Um registro por erro.';
comment on constraint "FK_AREA_ERROAPLIC" on public."TL_ERRO_APLICACAO" is 'Área do erro, quando havia uma aberta.';
comment on constraint "CK_ERROAPLIC_TPERRO" on public."TL_ERRO_APLICACAO" is 'Tipos de erro válidos.';
comment on constraint "CK_ERROAPLIC_DSCONTEXTO" on public."TL_ERRO_APLICACAO" is 'O contexto é um objeto JSON de até 16 kB.';
comment on constraint "CK_ERROAPLIC_NUSTATUSHTTP" on public."TL_ERRO_APLICACAO" is 'Status HTTP válido (100 a 599).';
comment on constraint "CK_ERROAPLIC_COREFERENCIA" on public."TL_ERRO_APLICACAO" is 'Referência só com letras minúsculas, dígitos e hífen (8 a 64).';
comment on index public."IN_ERROAPLIC_DTREGISTRO" is 'Erros mais novos primeiro; e a limpeza do que passou de 180 dias.';
comment on index public."IN_ERROAPLIC_COUSUARIO" is 'Erros de cada pessoa, dos mais novos: a repetição em 30 s e o limite por minuto.';
comment on index public."IN_ERROAPLIC_COREFERENCIA" is 'Busca do suporte pelo começo da referência (LIKE ''prefixo%'').';

-- 2. A limpeza (a mesma do navegador) -----------------------------------------------------------
create function private."FC_LIMPAR_TEXTO_ERRO"(p_texto text, p_limite integer default 500)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(
      left(coalesce(p_texto, ''), 20000),
      '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', ' ', 'g'),
      '(bearer)\s+[A-Za-z0-9._~+/=-]+', '\1 [token]', 'gi'),
      'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?', '[token]', 'g'),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[e-mail]', 'g'),
      '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}', '[número]', 'g'),
      '\(?[0-9]{2}\)?\s?[0-9]{4,5}-[0-9]{4}', '[número]', 'g'),
      '[0-9]{5,}', '[número]', 'g')),
    least(greatest(coalesce(p_limite, 500), 1), 4000));
$$;

revoke all on function private."FC_LIMPAR_TEXTO_ERRO"(text, integer) from public, anon, authenticated;

comment on function private."FC_LIMPAR_TEXTO_ERRO"(text, integer) is 'Limpa um texto de erro antes de gravar, como o navegador (src/lib/seguranca/registro-de-erros.ts, limparTextoDoErro): caracteres de controle viram espaço; "Bearer <token>" vira "Bearer [token]"; JWT vira [token]; e-mail vira [e-mail]; CPF com pontuação, telefone e qualquer sequência de 5 ou mais dígitos viram [número]; corta no limite (1 a 4.000; padrão 500). (20261123150000)';

-- 3. A gravação (o navegador chama) ---------------------------------------------------------------
create function public.registrar_erro_da_aplicacao(
  p_referencia text,
  p_tipo text,
  p_mensagem text,
  p_rota text default null,
  p_contexto jsonb default '{}'::jsonb,
  p_versao text default null,
  p_area text default null,
  p_status integer default null
)
returns json
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  c_limite_por_minuto constant integer := 30;
  c_janela_da_repeticao constant interval := interval '30 seconds';
  c_guarda constant interval := interval '180 days';
  v_uid uuid := (select auth.uid());
  v_referencia text := lower(btrim(coalesce(p_referencia, '')));
  v_tipo text := upper(btrim(coalesce(p_tipo, '')));
  v_mensagem text;
  v_rota text;
  v_contexto jsonb := '{}'::jsonb;
  v_versao text := nullif(btrim(coalesce(p_versao, '')), '');
  v_area text := lower(nullif(btrim(coalesce(p_area, '')), ''));
  v_status smallint;
  v_repetida text;
  v_recentes integer;
begin
  if v_uid is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if v_referencia !~ '^[a-z0-9-]{8,64}$' then
    raise exception 'Referência do erro inválida.' using errcode = '22023';
  end if;

  -- O navegador já limpou; o banco limpa de novo e corta.
  if v_tipo not in ('CLIENTE', 'SERVIDOR', 'REDE', 'BANCO', 'DESCONHECIDO') then
    v_tipo := 'DESCONHECIDO';
  end if;
  v_mensagem := coalesce(nullif(private."FC_LIMPAR_TEXTO_ERRO"(p_mensagem, 500), ''), '(sem mensagem)');
  v_rota := nullif(private."FC_LIMPAR_TEXTO_ERRO"(
    split_part(split_part(coalesce(p_rota, ''), '?', 1), '#', 1), 200), '');
  if v_versao is not null and v_versao !~ '^[A-Za-z0-9._-]{1,64}$' then
    v_versao := null;
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    v_area := null;
  end if;
  if p_status between 100 and 599 then
    v_status := p_status;
  end if;
  -- Contexto: até 12 chaves simples; texto limpo e cortado, só número pequeno (linha, coluna).
  if jsonb_typeof(p_contexto) = 'object' then
    select coalesce(jsonb_object_agg(x.chave, x.valor), '{}'::jsonb) into v_contexto
      from (
        select e.key as chave,
               case jsonb_typeof(e.value)
                 when 'string' then to_jsonb(private."FC_LIMPAR_TEXTO_ERRO"(e.value #>> '{}', 1500))
                 when 'number' then case when abs((e.value #>> '{}')::numeric) < 100000 then e.value end
                 when 'boolean' then e.value
               end as valor
          from jsonb_each(p_contexto) e
         where e.key ~ '^[a-z_]{1,40}$'
         order by e.key
         limit 12
      ) x
     where x.valor is not null;
  end if;

  -- Um registro por vez por pessoa: a repetição e o limite contam certo.
  perform pg_advisory_xact_lock(hashtext('TL_ERRO_APLICACAO:' || v_uid::text));

  select l."CO_REFERENCIA" into v_repetida
    from public."TL_ERRO_APLICACAO" l
   where l."CO_USUARIO" = v_uid
     and l."DT_REGISTRO" > now() - c_janela_da_repeticao
     and l."TP_ERRO" = v_tipo
     and l."DS_MENSAGEM" = v_mensagem
     and l."DS_ROTA" is not distinct from v_rota
     and l."NU_STATUS_HTTP" is not distinct from v_status
   order by l."DT_REGISTRO" desc
   limit 1;
  if v_repetida is not null then
    return json_build_object('registrado', false, 'motivo', 'repetido', 'referencia', v_repetida);
  end if;

  select count(*) into v_recentes
    from public."TL_ERRO_APLICACAO" l
   where l."CO_USUARIO" = v_uid
     and l."DT_REGISTRO" > now() - interval '1 minute';
  if v_recentes >= c_limite_por_minuto then
    return json_build_object('registrado', false, 'motivo', 'limite');
  end if;

  insert into public."TL_ERRO_APLICACAO" (
    "CO_REFERENCIA", "TP_ERRO", "DS_MENSAGEM", "DS_ROTA", "DS_CONTEXTO",
    "CO_VERSAO_BUILD", "CO_AREA", "NU_STATUS_HTTP", "CO_USUARIO")
  values (
    v_referencia, v_tipo, v_mensagem, v_rota, v_contexto,
    v_versao, v_area, v_status, v_uid);

  -- A guarda de 180 dias, aos poucos: nada de tarefa agendada para um log.
  delete from public."TL_ERRO_APLICACAO"
   where "CO_ERRO_APLICACAO" in (
     select v."CO_ERRO_APLICACAO" from public."TL_ERRO_APLICACAO" v
      where v."DT_REGISTRO" < now() - c_guarda
      order by v."DT_REGISTRO"
      limit 50);

  return json_build_object('registrado', true, 'referencia', v_referencia);
end;
$$;

revoke all on function public.registrar_erro_da_aplicacao(text, text, text, text, jsonb, text, text, integer) from public, anon;
grant execute on function public.registrar_erro_da_aplicacao(text, text, text, text, jsonb, text, text, integer) to authenticated;

comment on function public.registrar_erro_da_aplicacao(text, text, text, text, jsonb, text, text, integer) is 'Registra um erro que aconteceu no navegador (src/app/registro-de-erros.ts), só com sessão (28000 sem ela). Repete a limpeza do navegador (private."FC_LIMPAR_TEXTO_ERRO"), limita os tamanhos (mensagem 500, rota 200 sem consulta, contexto de 12 chaves simples), aceita só tipo, versão, área e status válidos (o resto vira DESCONHECIDO ou nulo). Não grava, sem erro, a repetição do mesmo erro da mesma pessoa em 30 s (motivo repetido) nem o que passar de 30 registros da pessoa no último minuto (motivo limite). Apaga até 50 registros com mais de 180 dias por chamada. Devolve {registrado, motivo?, referencia?}. Grava TL_ERRO_APLICACAO. (20261123150000)';

-- 4. A leitura (tela futura, só administrador global) ----------------------------------------------
create function public.listar_erros_da_aplicacao(
  p_referencia text default null,
  p_tipo text default null,
  p_desde timestamp with time zone default null,
  p_limite integer default 100
)
returns json
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_referencia text := lower(nullif(btrim(coalesce(p_referencia, '')), ''));
  v_tipo text := upper(nullif(btrim(coalesce(p_tipo, '')), ''));
  v_limite integer := least(greatest(coalesce(p_limite, 100), 1), 500);
begin
  if v_uid is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if not private."FC_ADMIN_GLOBAL_ATIVO"(v_uid) then
    raise exception 'Só o administrador global vê os erros registrados.' using errcode = '42501';
  end if;
  if v_referencia is not null and v_referencia !~ '^[a-z0-9-]{4,64}$' then
    raise exception 'Referência inválida: use letras, dígitos e hífen.' using errcode = '22023';
  end if;

  return coalesce((
    select json_agg(json_build_object(
             'referencia', l."CO_REFERENCIA",
             'tipo', l."TP_ERRO",
             'mensagem', l."DS_MENSAGEM",
             'rota', l."DS_ROTA",
             'contexto', l."DS_CONTEXTO",
             'versao', l."CO_VERSAO_BUILD",
             'area', l."CO_AREA",
             'status', l."NU_STATUS_HTTP",
             'usuario', l."CO_USUARIO",
             'registrado_em', l."DT_REGISTRO")
           order by l."DT_REGISTRO" desc)
      from (
        select * from public."TL_ERRO_APLICACAO" e
         where (v_referencia is null or e."CO_REFERENCIA" like v_referencia || '%')
           and (v_tipo is null or e."TP_ERRO" = v_tipo)
           and (p_desde is null or e."DT_REGISTRO" >= p_desde)
         order by e."DT_REGISTRO" desc
         limit v_limite
      ) l), '[]'::json);
end;
$$;

revoke all on function public.listar_erros_da_aplicacao(text, text, timestamp with time zone, integer) from public, anon;
grant execute on function public.listar_erros_da_aplicacao(text, text, timestamp with time zone, integer) to authenticated;

comment on function public.listar_erros_da_aplicacao(text, text, timestamp with time zone, integer) is 'Lista os erros registrados do navegador (TL_ERRO_APLICACAO), dos mais novos: filtro pelo começo da referência (o "Código do erro" que a pessoa passou), pelo tipo e pela data; até 500 (padrão 100). Só administrador global ativo (42501 para os demais). Devolve o id de quem estava com a sessão, nunca o e-mail. Para uma tela futura: entra em src/lib/rpc-contrato.ts com ela. (20261123150000)';

commit;
