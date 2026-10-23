-- ENSAIO de supabase/migrations/20261023200000_classificacao_em_python_etapa_2b.sql: roda o corpo e desfaz (rollback).
-- Esperado, no edital 114/2026 (bcecfb08-88ef-4e06-8401-bcad6bf88fd0), com a última lista gerada dele como base:
--   a chave "classificacao_calculo" nasce DESLIGADA (com o evento no histórico); desligada, pedir o cálculo
--   devolve {ligada: false} sem gravar nada e registrar_lista_classificacao registra como antes;
--   Rodar agora do relatório (disparar_robo classificacao_desempate) pede classificacao.yml com modo normal,
--   recusa o repetido (55006) e outro modo (22023); registrar_disparo_externo aceita classificacao.yml;
--   ligada: registrar_lista_classificacao recusa (55000); pedir grava o pedido e pede classificacao.yml
--   (modo calculo, origem MONITORA com o usuário; com um segredo FALSO criado e desfeito aqui: o pedido fica
--   na fila do pg_net desta transação e some no rollback); versão velha da regra dá PT409; o job lê a fila,
--   marca CALCULANDO e grava o retrato (PRONTO, com o hash), e recusa PRONTO pela marcação, mensagem com "@",
--   execução inválida, retrato de outro tipo e de outra versão; a tela lê o pedido (o retrato só com
--   p_com_retrato), o retrato diferente não registra (NAO_CONFERE, origem BANCO), o igual registra o retrato
--   do Python (mesmo hash, pedido REGISTRADO sem o retrato, relatório de desempate pedido) e não registra duas
--   vezes; a divergência da tela grava os caminhos e recusa caminho com valor; o pronto abandonado vira
--   SUBSTITUIDO sem o retrato; sem o segredo, SEM_DISPARO, e a lista que não pediu o relatório entra nas que
--   esperam; o Status das atualizações traz os pedidos e os preparos; as RPCs do job só para service_role.
-- O resultado (json) traz só contagens, situações e verdadeiro/falso; nenhum nome real.
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_PREPARO_DESEMPATE"') is null
     or to_regprocedure('private."FC_PEDIR_DESEMPATE"(uuid, uuid)') is null
     or to_regprocedure('public.classificacao_ler_pedidos_desempate(uuid[])') is null then
    raise exception 'Aplique antes 20261023170000_classificacao_em_python_etapa_2.sql.';
  end if;
  if to_regclass('public."TB_CHAVE_AUTOMACAO"') is null
     or to_regprocedure('private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)') is null then
    raise exception 'Aplique antes 20261022190000_chaves_da_automacao.sql.';
  end if;
end;
$$;

-- 1. A chave "Gerar listas pelo Python", desligada ---------------------------------------
alter table public."TB_CHAVE_AUTOMACAO" drop constraint "CK_CHAVEAUTOM_COCHAVE";
alter table public."TB_CHAVE_AUTOMACAO" add constraint "CK_CHAVEAUTOM_COCHAVE" check ("CO_CHAVE" in (
  'entrevistas', 'selecao', 'kpis_do_edital', 'robo_de_inscricoes',
  'pre_classificacao', 'conferencias', 'paineis', 'manutencao', 'classificacao', 'classificacao_calculo'));
comment on constraint "CK_CHAVEAUTOM_COCHAVE" on public."TB_CHAVE_AUTOMACAO" is 'Só as chaves da lista fixa.';

do $$
declare
  c_setor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  c_motivo constant text := 'Criada desligada pela migração 20261023200000: o cálculo das listas pelo Python só vai ao ar depois da publicação da classificação do 114/2026 com o motor atual.';
  v_autor uuid;
begin
  select u.id into v_autor from auth.users u where u.id = c_setor;
  insert into public."TB_CHAVE_AUTOMACAO"
         ("CO_CHAVE", "NO_CHAVE", "NU_ORDEM", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
  values ('classificacao_calculo', 'Gerar listas pelo Python', 10, 'N', c_motivo, v_autor)
  on conflict ("CO_CHAVE") do nothing;
  if found then
    insert into public."TH_CHAVE_AUTOMACAO" ("CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS")
    values ('classificacao_calculo', 'N', c_motivo, v_autor, '{}');
  end if;
end;
$$;

create function private."FC_CALCULO_PELO_PYTHON"()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (select 1 from public."TB_CHAVE_AUTOMACAO" c
                  where c."CO_CHAVE" = 'classificacao_calculo' and c."ST_LIGADA" = 'S');
$function$;
comment on function private."FC_CALCULO_PELO_PYTHON"() is
  'A chave "Gerar listas pelo Python" (classificacao_calculo, 20261023200000) está ligada? Sem a linha na tabela, desligada (o padrão é o cálculo da tela). Só o dono (as RPCs da Classificação).';
revoke all on function private."FC_CALCULO_PELO_PYTHON"() from public, anon, authenticated, service_role;

-- 2. Os pedidos de cálculo -----------------------------------------------------------------
create table public."TB_PEDIDO_CALCULO_CLASSIFICACAO" (
  "CO_PEDIDO_CALCULO" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "TP_LISTA" varchar(20) not null,
  "NU_VERSAO_REGRA" integer not null,
  "TP_SITUACAO" varchar(20) not null default 'PEDIDO',
  "DS_MENSAGEM" varchar(300),
  "DS_RETRATO" jsonb,
  "DS_HASH" varchar(64),
  "DS_DIVERGENCIA" jsonb,
  "CO_LISTA_CLASSIFICACAO" uuid,
  "CO_DISPARO" bigint,
  "CO_EXECUCAO" varchar(80),
  "CO_USUARIO" uuid not null,
  "DT_PEDIDO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_PEDIDO_CALCULO_CLASSIFICACAO" primary key ("CO_PEDIDO_CALCULO"),
  constraint "FK_MONITORAMENTO_PEDCALCCLASSIF" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_LISTACLASSIF_PEDCALCCLASSIF" foreign key ("CO_LISTA_CLASSIFICACAO")
    references public."TB_LISTA_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO"),
  constraint "CK_PEDCALCCLASSIF_TPLISTA" check ("TP_LISTA" in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL')),
  constraint "CK_PEDCALCCLASSIF_TPSITUACAO" check ("TP_SITUACAO" in (
    'PEDIDO', 'CALCULANDO', 'PRONTO', 'FALHOU', 'NAO_CONFERE', 'REGISTRADO', 'SEM_DISPARO', 'SUBSTITUIDO')),
  constraint "CK_PEDCALCCLASSIF_DSMENSAGEM" check ("DS_MENSAGEM" is null or "DS_MENSAGEM" !~ '@|[0-9]{11}'),
  constraint "CK_PEDCALCCLASSIF_DSRETRATO" check ("DS_RETRATO" is null or jsonb_typeof("DS_RETRATO") = 'object'),
  constraint "CK_PEDCALCCLASSIF_DSHASH" check ("DS_HASH" is null or "DS_HASH" ~ '^[0-9a-f]{64}$'),
  constraint "CK_PEDCALCCLASSIF_PRONTO" check ("TP_SITUACAO" <> 'PRONTO' or ("DS_RETRATO" is not null and "DS_HASH" is not null)),
  constraint "CK_PEDCALCCLASSIF_REGISTRADO" check ("TP_SITUACAO" <> 'REGISTRADO' or "CO_LISTA_CLASSIFICACAO" is not null),
  constraint "CK_PEDCALCCLASSIF_COEXECUCAO" check ("CO_EXECUCAO" is null or "CO_EXECUCAO" ~ '^[A-Za-z0-9_.:-]{1,80}$')
);
comment on table public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is
  'Pedidos de cálculo de uma lista de classificação pelo Python (20261023200000, chave classificacao_calculo): o "Gerar" da tela pede (pedir_calculo_classificacao), o job calcula e grava o retrato (classificacao_gravar_calculo), a tela confere com o motor.ts e registra (registrar_lista_calculada) ou grava a divergência (registrar_divergencia_do_calculo). O retrato leva os nomes, como a lista registrada; sai daqui quando a lista é registrada ou o pedido é substituído.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."CO_PEDIDO_CALCULO" is 'Identificador do pedido.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."TP_LISTA" is 'PRELIMINAR, CONVOCACAO, ENTREVISTA ou FINAL.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."NU_VERSAO_REGRA" is 'Versão da regra que a tela usou ao pedir (a do cálculo e a do registro).';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."TP_SITUACAO" is 'PEDIDO (o workflow foi pedido), CALCULANDO (o job começou), PRONTO (retrato gravado), FALHOU (erro no job), NAO_CONFERE (o retrato do Python não é o da tela), REGISTRADO (a lista foi registrada), SEM_DISPARO (o pedido ao GitHub não saiu), SUBSTITUIDO (pronto e abandonado: um pedido mais novo da mesma lista o trocou).';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."DS_MENSAGEM" is 'Mensagem curta para a tela (até 300 caracteres, sem "@" nem 11 dígitos seguidos; nunca nome).';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."DS_RETRATO" is 'O retrato da lista calculado pelo Python (o mesmo formato de TB_LISTA_CLASSIFICACAO.DS_RESULTADO); nulo depois do registro ou da substituição.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."DS_HASH" is 'SHA-256 do retrato (o mesmo que a lista registrada recebe).';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."DS_DIVERGENCIA" is 'Quando não confere: origem (TELA ou BANCO), total e até 20 caminhos das diferenças, sem os valores.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."CO_LISTA_CLASSIFICACAO" is 'A lista registrada a partir deste pedido.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."CO_DISPARO" is 'Pedido ao GitHub (TL_DISPARO_ROBO.CO_DISPARO), quando houve.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."CO_EXECUCAO" is 'Execução do job que mexeu por último (monitora.execucao.identificador).';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."CO_USUARIO" is 'Quem clicou em Gerar (auth.users.id).';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."DT_PEDIDO" is 'Quando foi pedido.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."DT_ATUALIZACAO" is 'Última mudança de situação.';
comment on constraint "PK_TB_PEDIDO_CALCULO_CLASSIFICACAO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Um pedido por linha.';
comment on constraint "FK_MONITORAMENTO_PEDCALCCLASSIF" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Edital do pedido.';
comment on constraint "FK_LISTACLASSIF_PEDCALCCLASSIF" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Lista registrada do pedido.';
comment on constraint "CK_PEDCALCCLASSIF_TPLISTA" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Tipos de lista da Classificação.';
comment on constraint "CK_PEDCALCCLASSIF_TPSITUACAO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Situações da lista fixa.';
comment on constraint "CK_PEDCALCCLASSIF_DSMENSAGEM" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Mensagem sem e-mail nem 11 dígitos seguidos.';
comment on constraint "CK_PEDCALCCLASSIF_DSRETRATO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Retrato é um objeto json.';
comment on constraint "CK_PEDCALCCLASSIF_DSHASH" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'SHA-256 em hexadecimal.';
comment on constraint "CK_PEDCALCCLASSIF_PRONTO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Pronto tem o retrato e o hash.';
comment on constraint "CK_PEDCALCCLASSIF_REGISTRADO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Registrado aponta a lista.';
comment on constraint "CK_PEDCALCCLASSIF_COEXECUCAO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" is 'Identificador de execução seguro para log.';
create index "IN_PEDCALCCLASSIF_TPSITUACAO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" ("TP_SITUACAO", "DT_PEDIDO");
comment on index public."IN_PEDCALCCLASSIF_TPSITUACAO" is 'Os pedidos que esperam o job, do mais antigo ao mais novo (classificacao_ler_pedidos_calculo).';
create index "IN_PEDCALCCLASSIF_COMONITORAMENTO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "DT_PEDIDO");
comment on index public."IN_PEDCALCCLASSIF_COMONITORAMENTO" is 'Os pedidos de uma lista do edital (a substituição dos prontos abandonados).';
create index "IN_PEDCALCCLASSIF_COLISTA" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO");
comment on index public."IN_PEDCALCCLASSIF_COLISTA" is 'Chave estrangeira da lista registrada.';
create index "IN_PEDCALCCLASSIF_DTATUALIZACAO" on public."TB_PEDIDO_CALCULO_CLASSIFICACAO" ("DT_ATUALIZACAO");
comment on index public."IN_PEDCALCCLASSIF_DTATUALIZACAO" is 'Os pedidos mais recentes (Status das atualizações).';
alter table public."TB_PEDIDO_CALCULO_CLASSIFICACAO" enable row level security;
revoke all on table public."TB_PEDIDO_CALCULO_CLASSIFICACAO" from public, anon, authenticated;

create index if not exists "IN_PREPARODESEMP_DTATUALIZACAO" on public."TB_PREPARO_DESEMPATE" ("DT_ATUALIZACAO");
comment on index public."IN_PREPARODESEMP_DTATUALIZACAO" is 'Os preparos mais recentes (Status das atualizações).';

-- 3. Registrar uma lista: um corpo só para os dois caminhos ---------------------------------
-- Corpo de registrar_lista_classificacao (20261023170000) sem o porteiro (quem chama confere).
create function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_totais jsonb := coalesce(p_resultado -> 'totais', '{}'::jsonb);
  v_qt integer[];
begin
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'array'
     or p_resultado ->> 'tipo' is distinct from p_tipo then
    raise exception 'Lista inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_resultado) > 8000000 then
    raise exception 'Lista grande demais para registrar.' using errcode = '22023';
  end if;
  -- Os candidatos do retrato são análises ativas deste edital (20261006070000).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital, p_resultado);
  select array_agg(case when jsonb_typeof(v_totais -> k) = 'number'
                        then greatest(0, least(1000000, (v_totais ->> k)::numeric))::integer else 0 end order by o)
    into v_qt
    from unnest(array['elegiveis', 'eliminados', 'avisos', 'pendencias']) with ordinality t(k, o);

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", p_resultado,
          encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex'),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  -- O relatório de desempate desta lista, pelo Python (20261023170000).
  perform private."FC_PEDIR_DESEMPATE"(v_id, (select auth.uid()));

  return v_id;
end;
$function$;
comment on function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb) is
  'Registra uma lista gerada (20261023200000; o corpo de registrar_lista_classificacao de 20261023170000): confere o tipo, a versão vigente da regra (PT409), a forma, o tamanho e os candidatos do retrato, grava com o hash SHA-256 calculado aqui e pede o relatório de desempate (FC_PEDIR_DESEMPATE). Devolve o id da lista. Sem porteiro: só o dono (registrar_lista_classificacao e registrar_lista_calculada, que conferem a permissão).';
revoke all on function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb) from public, anon, authenticated, service_role;

create or replace function public.registrar_lista_classificacao(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_id uuid;
begin
  -- Chave "Gerar listas pelo Python" ligada (20261023200000): a lista vem do cálculo do Python.
  if private."FC_CALCULO_PELO_PYTHON"() then
    raise exception 'A lista agora é calculada pelo Python: recarregue a página e gere de novo.' using errcode = '55000';
  end if;
  -- Dois comandos: a leitura (STABLE) tem de ver a lista que o registro acabou de gravar.
  v_id := private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(p_edital, p_tipo, p_versao, p_resultado);
  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_id);
end;
$function$;
comment on function public.registrar_lista_classificacao(uuid, text, integer, jsonb) is
  '"Gerar" da Classificação com o cálculo da tela (motor.ts): registra o retrato (FC_REGISTRAR_LISTA_CLASSIFICACAO: versão da regra, forma, candidatos, hash SHA-256 do banco) e pede o relatório de desempate. Com a chave "Gerar listas pelo Python" ligada (20261023200000), recusa (55000): a lista vem de registrar_lista_calculada. Classificação editor.';

-- 4. A tela: pedir, acompanhar, registrar e a divergência ---------------------------------------
create function public.pedir_calculo_classificacao(p_edital uuid, p_tipo text, p_versao integer)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_situacao text := 'PEDIDO';
  v_mensagem text;
  v_disparo bigint;
  v_estado text;
begin
  -- Chave desligada: nada é gravado nem pedido; a tela segue com o cálculo dela.
  if not private."FC_CALCULO_PELO_PYTHON"() then
    return json_build_object('ligada', false);
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
  end if;

  -- O cálculo pronto e abandonado (há mais de 10 min) da mesma lista sai: o retrato não fica guardado.
  update public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p
     set "TP_SITUACAO" = 'SUBSTITUIDO', "DS_RETRATO" = null, "DT_ATUALIZACAO" = now()
   where p."CO_MONITORAMENTO" = p_edital and p."TP_LISTA" = p_tipo
     and p."TP_SITUACAO" = 'PRONTO' and p."DT_ATUALIZACAO" < now() - interval '10 minutes';

  insert into public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "NU_VERSAO_REGRA", "TP_SITUACAO", "CO_USUARIO")
  values (p_edital, p_tipo, p_versao, 'PEDIDO', (select auth.uid()))
  returning "CO_PEDIDO_CALCULO" into v_id;

  -- O job leva todos os pedidos que esperam: o workflow vai só com o modo.
  begin
    v_disparo := private."FC_DISPARAR_ROBO"('classificacao.yml', jsonb_build_object('modo', 'calculo'), (select auth.uid()));
    select d."TP_SITUACAO" into v_estado from public."TL_DISPARO_ROBO" d where d."CO_DISPARO" = v_disparo;
    if v_estado is distinct from 'PEDIDO' then
      v_situacao := 'SEM_DISPARO';
      v_mensagem := 'O pedido ao GitHub não saiu (' || coalesce(v_estado, 'sem registro') || ').';
    end if;
  exception when others then
    v_situacao := 'SEM_DISPARO';
    v_mensagem := 'O pedido ao GitHub não saiu (' || sqlstate || ').';
    v_disparo := null;
  end;
  update public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
     set "TP_SITUACAO" = v_situacao, "DS_MENSAGEM" = v_mensagem, "CO_DISPARO" = v_disparo, "DT_ATUALIZACAO" = now()
   where "CO_PEDIDO_CALCULO" = v_id;

  return json_build_object('ligada', true, 'pedido', v_id, 'tipo', p_tipo, 'situacao', v_situacao,
                           'mensagem', v_mensagem, 'pedido_em', now());
end;
$function$;
comment on function public.pedir_calculo_classificacao(uuid, text, integer) is
  '"Gerar" da Classificação (20261023200000): com a chave "Gerar listas pelo Python" desligada, devolve {ligada: false} e não grava nada (a tela registra pelo cálculo dela, como antes). Ligada: confere o editor do edital, o tipo e a versão vigente da regra (PT409), troca para SUBSTITUIDO o cálculo pronto e abandonado da mesma lista, grava o pedido e pede classificacao.yml (modo calculo) por FC_DISPARAR_ROBO em nome de quem gerou; sem o pedido ao GitHub, SEM_DISPARO com a mensagem. Devolve {ligada, pedido, tipo, situacao, mensagem, pedido_em}. Classificação editor.';
revoke all on function public.pedir_calculo_classificacao(uuid, text, integer) from public, anon;
grant execute on function public.pedir_calculo_classificacao(uuid, text, integer) to authenticated;

create function public.obter_calculo_classificacao(p_pedido uuid, p_com_retrato boolean default false)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v public."TB_PEDIDO_CALCULO_CLASSIFICACAO";
begin
  select * into v from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p where p."CO_PEDIDO_CALCULO" = p_pedido;
  if v."CO_PEDIDO_CALCULO" is null then
    raise exception 'Pedido de cálculo não encontrado' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v."CO_MONITORAMENTO", 2);
  return json_build_object(
    'pedido', v."CO_PEDIDO_CALCULO",
    'tipo', v."TP_LISTA",
    'versao_regra', v."NU_VERSAO_REGRA",
    'situacao', v."TP_SITUACAO",
    'mensagem', v."DS_MENSAGEM",
    'pedido_em', v."DT_PEDIDO",
    'atualizado_em', v."DT_ATUALIZACAO",
    'hash', v."DS_HASH",
    'lista_id', v."CO_LISTA_CLASSIFICACAO",
    'retrato', case when p_com_retrato and v."TP_SITUACAO" = 'PRONTO' then v."DS_RETRATO" end);
end;
$function$;
comment on function public.obter_calculo_classificacao(uuid, boolean) is
  'A tela acompanha o pedido de cálculo (20261023200000): situação, mensagem, quando, o hash e, com p_com_retrato e a situação PRONTO, o retrato calculado pelo Python (com os nomes, como a lista). Classificação editor do edital.';
revoke all on function public.obter_calculo_classificacao(uuid, boolean) from public, anon;
grant execute on function public.obter_calculo_classificacao(uuid, boolean) to authenticated;

create function public.registrar_lista_calculada(p_pedido uuid, p_resultado jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PEDIDO_CALCULO_CLASSIFICACAO";
  v_lista uuid;
begin
  select * into v from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p where p."CO_PEDIDO_CALCULO" = p_pedido for update;
  if v."CO_PEDIDO_CALCULO" is null then
    raise exception 'Pedido de cálculo não encontrado' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v."CO_MONITORAMENTO", 2);
  if v."TP_SITUACAO" <> 'PRONTO' then
    raise exception 'Este cálculo não está pronto para registrar (%); gere de novo.', lower(v."TP_SITUACAO")
      using errcode = '55000';
  end if;

  -- O banco confere de novo: o retrato da tela tem de ser o do Python (jsonb a jsonb).
  if p_resultado is null or not (p_resultado = v."DS_RETRATO") then
    update public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
       set "TP_SITUACAO" = 'NAO_CONFERE',
           "DS_MENSAGEM" = 'O retrato da tela não é o do Python; a lista não foi registrada.',
           "DS_DIVERGENCIA" = jsonb_build_object('origem', 'BANCO'),
           "DT_ATUALIZACAO" = now()
     where "CO_PEDIDO_CALCULO" = p_pedido;
    return json_build_object('nao_confere', true, 'pedido', p_pedido);
  end if;

  -- Registra o retrato do Python (o mesmo hash que ele recebeu no cálculo).
  v_lista := private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(v."CO_MONITORAMENTO", v."TP_LISTA", v."NU_VERSAO_REGRA", v."DS_RETRATO");
  update public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
     set "TP_SITUACAO" = 'REGISTRADO', "CO_LISTA_CLASSIFICACAO" = v_lista, "DS_RETRATO" = null,
         "DS_MENSAGEM" = null, "DT_ATUALIZACAO" = now()
   where "CO_PEDIDO_CALCULO" = p_pedido;
  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_lista);
end;
$function$;
comment on function public.registrar_lista_calculada(uuid, jsonb) is
  'Registra a lista calculada pelo Python (20261023200000): só o pedido PRONTO (senão 55000) e só quando o retrato que a tela calculou com o motor.ts (p_resultado) é igual, jsonb a jsonb, ao do Python; então registra o retrato do Python (FC_REGISTRAR_LISTA_CLASSIFICACAO: versão da regra, candidatos, hash, relatório de desempate), marca REGISTRADO e devolve a lista como registrar_lista_classificacao. Diferente: marca NAO_CONFERE (origem BANCO), não registra e devolve {nao_confere: true}. Classificação editor do edital.';
revoke all on function public.registrar_lista_calculada(uuid, jsonb) from public, anon;
grant execute on function public.registrar_lista_calculada(uuid, jsonb) to authenticated;

create function public.registrar_divergencia_do_calculo(p_pedido uuid, p_total integer, p_caminhos text[])
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PEDIDO_CALCULO_CLASSIFICACAO";
  v_caminhos text[] := coalesce(p_caminhos, '{}');
begin
  select * into v from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p where p."CO_PEDIDO_CALCULO" = p_pedido for update;
  if v."CO_PEDIDO_CALCULO" is null then
    raise exception 'Pedido de cálculo não encontrado' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v."CO_MONITORAMENTO", 2);
  if v."TP_SITUACAO" not in ('PRONTO', 'NAO_CONFERE') then
    raise exception 'Este cálculo não está pronto (%).', lower(v."TP_SITUACAO") using errcode = '55000';
  end if;
  if p_total is null or p_total not between 1 and 1000000 or cardinality(v_caminhos) > 20
     or exists (select 1 from unnest(v_caminhos) c
                 where c is null or c !~ '^[A-Za-z0-9_.\[\]-]{1,200}$' or c ~ '[0-9]{11}') then
    raise exception 'Divergência inválida (total de 1 a 1.000.000, até 20 caminhos sem valores)' using errcode = '22023';
  end if;
  update public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
     set "TP_SITUACAO" = 'NAO_CONFERE',
         "DS_MENSAGEM" = 'O cálculo do Python não confere com o da tela (' || p_total || ' diferença(s)); a lista não foi registrada.',
         "DS_DIVERGENCIA" = jsonb_build_object('origem', 'TELA', 'total', p_total, 'caminhos', to_jsonb(v_caminhos)),
         "DT_ATUALIZACAO" = now()
   where "CO_PEDIDO_CALCULO" = p_pedido;
  return json_build_object('pedido', p_pedido, 'situacao', 'NAO_CONFERE');
end;
$function$;
comment on function public.registrar_divergencia_do_calculo(uuid, integer, text[]) is
  'A tela grava que o retrato do Python não confere com o do motor.ts (20261023200000): o pedido PRONTO vira NAO_CONFERE com o total e até 20 caminhos das diferenças (só letras, dígitos, _ . [ ] -; sem valores nem 11 dígitos seguidos). O retrato fica para a análise. Classificação editor do edital.';
revoke all on function public.registrar_divergencia_do_calculo(uuid, integer, text[]) from public, anon;
grant execute on function public.registrar_divergencia_do_calculo(uuid, integer, text[]) to authenticated;

-- 5. O job (service_role) --------------------------------------------------------------------
create function public.classificacao_ler_pedidos_calculo()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'pedido', p."CO_PEDIDO_CALCULO", 'edital', p."CO_MONITORAMENTO", 'tipo', p."TP_LISTA",
           'versao_regra', p."NU_VERSAO_REGRA", 'situacao', p."TP_SITUACAO", 'pedido_em', p."DT_PEDIDO")
         order by p."DT_PEDIDO", p."CO_PEDIDO_CALCULO"), '[]'::jsonb)
    from (select * from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" x
           where x."TP_SITUACAO" in ('PEDIDO', 'CALCULANDO')
             and x."DT_PEDIDO" > now() - interval '30 minutes'
           order by x."DT_PEDIDO"
           limit 20) p;
$function$;
comment on function public.classificacao_ler_pedidos_calculo() is
  'Job da classificação em Python (--calculo, 20261023200000): os pedidos de cálculo que esperam (PEDIDO ou CALCULANDO dos últimos 30 min; a tela desiste antes), com o edital, o tipo e a versão da regra; no máximo 20, do mais antigo ao mais novo. Toda execução do job lê esta fila (o GitHub guarda uma execução só na fila do grupo). Só service_role.';
revoke all on function public.classificacao_ler_pedidos_calculo() from public, anon, authenticated;
grant execute on function public.classificacao_ler_pedidos_calculo() to service_role;

create function public.classificacao_marcar_calculo(p_execucao text, p_pedido uuid, p_situacao text, p_mensagem text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_mensagem text := nullif(btrim(coalesce(p_mensagem, '')), '');
  v_atual text;
begin
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  if p_situacao is null or p_situacao not in ('CALCULANDO', 'FALHOU') then
    raise exception 'Situação inválida (CALCULANDO ou FALHOU)' using errcode = '22023';
  end if;
  if v_mensagem is not null and (length(v_mensagem) > 300 or v_mensagem ~ '@|[0-9]{11}') then
    raise exception 'Mensagem longa demais ou com dado que parece pessoal' using errcode = '22023';
  end if;
  select p."TP_SITUACAO" into v_atual from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p
   where p."CO_PEDIDO_CALCULO" = p_pedido for update;
  if v_atual is null then
    raise exception 'Pedido de cálculo não encontrado' using errcode = '22023';
  end if;
  if v_atual not in ('PEDIDO', 'CALCULANDO') then
    raise exception 'O pedido já saiu da fila (%)', lower(v_atual) using errcode = '55000';
  end if;
  update public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
     set "TP_SITUACAO" = p_situacao, "DS_MENSAGEM" = v_mensagem, "CO_EXECUCAO" = p_execucao, "DT_ATUALIZACAO" = now()
   where "CO_PEDIDO_CALCULO" = p_pedido;
  return jsonb_build_object('pedido', p_pedido, 'situacao', p_situacao);
end;
$function$;
comment on function public.classificacao_marcar_calculo(text, uuid, text, text) is
  'Job da classificação em Python (--calculo, 20261023200000): marca o pedido de cálculo CALCULANDO (começou) ou FALHOU, com mensagem curta (até 300, sem "@" nem 11 dígitos), só enquanto ele espera (PEDIDO ou CALCULANDO; senão 55000). PRONTO só pela gravação do retrato. Só service_role.';
revoke all on function public.classificacao_marcar_calculo(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.classificacao_marcar_calculo(text, uuid, text, text) to service_role;

create function public.classificacao_gravar_calculo(p_execucao text, p_pedido uuid, p_retrato jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PEDIDO_CALCULO_CLASSIFICACAO";
  v_vigente integer;
  v_hash text;
begin
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  select * into v from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p where p."CO_PEDIDO_CALCULO" = p_pedido for update;
  if v."CO_PEDIDO_CALCULO" is null then
    raise exception 'Pedido de cálculo não encontrado' using errcode = '22023';
  end if;
  if v."TP_SITUACAO" not in ('PEDIDO', 'CALCULANDO') then
    raise exception 'O pedido já saiu da fila (%)', lower(v."TP_SITUACAO") using errcode = '55000';
  end if;
  if p_retrato is null or jsonb_typeof(p_retrato) <> 'object'
     or p_retrato ->> 'tipo' is distinct from v."TP_LISTA"
     or coalesce(jsonb_typeof(p_retrato -> 'vagas'), '') <> 'array'
     or coalesce(jsonb_typeof(p_retrato -> 'totais'), '') <> 'object'
     or coalesce(jsonb_typeof(p_retrato -> 'regra_versao'), '') <> 'number'
     or (p_retrato ->> 'regra_versao')::numeric <> v."NU_VERSAO_REGRA" then
    raise exception 'Retrato inválido (tipo, vagas, totais ou versão da regra)' using errcode = '22023';
  end if;
  if pg_column_size(p_retrato) > 8000000 then
    raise exception 'Retrato grande demais.' using errcode = '22023';
  end if;
  select r."NU_VERSAO_VIGENTE" into v_vigente from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v."CO_MONITORAMENTO";
  if v_vigente is distinct from v."NU_VERSAO_REGRA" then
    raise exception 'A regra do edital mudou desde o pedido; gere de novo.' using errcode = 'PT409';
  end if;
  -- Os candidatos do retrato são análises ativas deste edital (a mesma conferência do registro).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(v."CO_MONITORAMENTO", p_retrato);

  v_hash := encode(sha256(convert_to(p_retrato::text, 'UTF8')), 'hex');
  update public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
     set "TP_SITUACAO" = 'PRONTO', "DS_RETRATO" = p_retrato, "DS_HASH" = v_hash, "DS_MENSAGEM" = null,
         "CO_EXECUCAO" = p_execucao, "DT_ATUALIZACAO" = now()
   where "CO_PEDIDO_CALCULO" = p_pedido;
  return jsonb_build_object('pedido', p_pedido, 'situacao', 'PRONTO', 'hash', v_hash);
end;
$function$;
comment on function public.classificacao_gravar_calculo(text, uuid, jsonb) is
  'Job da classificação em Python (--calculo, 20261023200000): grava o retrato calculado pelo Python num pedido que espera (PEDIDO ou CALCULANDO; senão 55000), confere a forma (tipo, vagas, totais), a versão da regra do pedido e a vigente (PT409), o tamanho e os candidatos do edital (FC_EXIGIR_CANDIDATOS_DO_EDITAL), calcula o hash SHA-256 (o mesmo que a lista registrada receberá) e marca PRONTO. Só service_role.';
revoke all on function public.classificacao_gravar_calculo(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.classificacao_gravar_calculo(text, uuid, jsonb) to service_role;

-- 6. As listas que esperam o relatório incluem as SEM_DISPARO ----------------------------------
-- Corpo de 20261023170000 + SEM_DISPARO entre as que esperam.
create or replace function public.classificacao_ler_pedidos_desempate(p_listas uuid[] default null)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'lista', l."CO_LISTA_CLASSIFICACAO", 'edital', l."CO_MONITORAMENTO", 'tipo', l."TP_LISTA",
           'situacao', p."TP_SITUACAO", 'pedido_em', p."DT_PEDIDO")
         order by coalesce(p."DT_PEDIDO", l."DT_GERACAO"), l."CO_LISTA_CLASSIFICACAO"), '[]'::jsonb)
    from (
      select l.*
        from public."TB_LISTA_CLASSIFICACAO" l
       -- As pedidas (input "listas"), em qualquer situação, e todas as que esperam (2 dias):
       -- o GitHub guarda só uma execução na fila do grupo, então cada execução leva as pendentes.
       where l."CO_LISTA_CLASSIFICACAO" = any (coalesce(p_listas, '{}'::uuid[]))
          or exists (select 1 from public."TB_PREPARO_DESEMPATE" x
                      where x."CO_LISTA_CLASSIFICACAO" = l."CO_LISTA_CLASSIFICACAO"
                        and x."TP_SITUACAO" in ('PEDIDO', 'PREPARANDO', 'SEM_DISPARO')
                        and x."DT_PEDIDO" > now() - interval '2 days')
       order by l."DT_GERACAO"
       limit 50
    ) l
    left join public."TB_PREPARO_DESEMPATE" p on p."CO_LISTA_CLASSIFICACAO" = l."CO_LISTA_CLASSIFICACAO";
$function$;
comment on function public.classificacao_ler_pedidos_desempate(uuid[]) is
  'Job da classificação em Python (20261023170000): as listas a preparar — as pedidas (p_listas, em qualquer situação) e todas as que esperam (PEDIDO, PREPARANDO e, desde 20261023200000, SEM_DISPARO, nos últimos 2 dias; o GitHub guarda só uma execução na fila do grupo, então cada execução leva as pendentes) — com o edital, o tipo e a situação; no máximo 50, da mais antiga à mais nova. Só service_role.';

-- 7. Rodar agora e o registro da execução iniciada no GitHub -----------------------------------
-- Corpo de 20261022170000 + o robô "classificacao_desempate" (classificacao.yml, modo normal).
create or replace function public.disparar_robo(p_robo text, p_inputs jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c_robos constant jsonb := jsonb_build_object(
    'empregare', jsonb_build_object('nome', 'Robô da Empregare', 'workflow', 'robo-empregare.yml',
      'modos', jsonb_build_array('normal', 'seco', 'fumaca', 'forcar', 'sondar', 'anexos'),
      'editais', 'numero', 'vagas', true, 'limite', true, 'anexos', true, 'candidatos', true, 'seco', true,
      'forcar_congelado', true, 'motivo', true, 'modos_que_gravam', jsonb_build_array('normal', 'forcar'),
      'modos_que_gravam_sem_seco', jsonb_build_array('anexos')),
    'selecao', jsonb_build_object('nome', 'Seleção', 'workflow', 'sincronizar-selecao.yml',
      'modos', jsonb_build_array('normal')),
    'entrevistas', jsonb_build_object('nome', 'Entrevistas', 'workflow', 'sincronizar-entrevistas.yml',
      'modos', jsonb_build_array('normal')),
    'conferencias', jsonb_build_object('nome', 'Conferências de consistência', 'workflow', 'conferencias.yml',
      'modos', jsonb_build_array('normal', 'seco')),
    'pre_classificacao', jsonb_build_object('nome', 'Pré-classificação (Avaliação documental)', 'workflow', 'pre-classificacao.yml',
      'modos', jsonb_build_array('normal', 'seco', 'refazer_lote'),
      'editais', 'numero_ou_id', 'por_edital', true,
      'forcar_congelado', true, 'motivo', true, 'modos_que_gravam', jsonb_build_array('normal', 'refazer_lote')),
    -- [classificacao-python] (20261023200000) reprocessa os relatórios de desempate e os cálculos pendentes.
    'classificacao_desempate', jsonb_build_object('nome', 'Relatório de desempate (Classificação em Python)',
      'workflow', 'classificacao.yml', 'modos', jsonb_build_array('normal')));
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_uid uuid := (select auth.uid());
  v_robo jsonb := c_robos -> p_robo;
  v_in jsonb := coalesce(p_inputs, '{}'::jsonb);
  v_chave text;
  v_valor jsonb;
  v_itens text[];
  v_item text;
  v_modo text;
  v_editais text[] := '{}';
  v_vagas text[] := '{}';
  v_candidatos text[] := '{}';
  v_limite integer;
  v_anexos boolean;
  v_seco boolean;
  v_saida jsonb;
  v_forcar_congelado boolean := false;
  v_motivo text;
  v_congelados uuid[] := '{}';
  v_rotulos text;
  v_liberacao uuid;
  v_disparo bigint;
  v_grava boolean;
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo para rodar a carga.' using errcode = '28000';
  end if;
  if v_robo is null then
    raise exception 'Carga desconhecida.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_in) <> 'object' then
    raise exception 'Opções inválidas.' using errcode = '22023';
  end if;

  -- Opção que o robô não aceita (vazia passa, como em validarOpcoes).
  for v_chave, v_valor in select * from jsonb_each(v_in) loop
    if v_chave not in ('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado', 'motivo')
       or (v_chave <> 'modo' and v_robo -> v_chave is null
           and not (jsonb_typeof(v_valor) = 'null'
                    or v_valor in ('""'::jsonb, '[]'::jsonb, 'false'::jsonb, '"false"'::jsonb))) then
      raise exception '% não aceita “%”.', v_robo ->> 'nome', left(v_chave, 30) using errcode = '22023';
    end if;
  end loop;

  -- Modo
  if jsonb_typeof(v_in -> 'modo') not in ('string', 'null') then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;
  v_modo := coalesce(nullif(btrim(v_in ->> 'modo'), ''), 'normal');
  if not ((v_robo -> 'modos') ? v_modo) then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;

  -- Editais: número (93/2026) ou, na pré-classificação, também o id.
  if v_robo ? 'editais' and coalesce(jsonb_typeof(v_in -> 'editais'), 'null') <> 'null' then
    v_valor := v_in -> 'editais';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Edital inválido.' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := string_to_array(v_valor #>> '{}', ',');
    else
      raise exception 'Edital inválido.' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if lower(v_item) ~ c_uuid and v_robo ->> 'editais' = 'numero_ou_id' then
        v_item := lower(v_item);
      elsif v_item !~ '^\d{1,4}/\d{4}$' then
        raise exception 'Edital inválido: %.', left(v_item, 40) using errcode = '22023';
      end if;
      if not v_item = any (v_editais) then
        v_editais := v_editais || v_item;
      end if;
    end loop;
    if cardinality(v_editais) > 100 then
      raise exception 'No máximo 100 editais por vez.' using errcode = '22023';
    end if;
  end if;

  -- Vagas: códigos da Empregare, só dígitos.
  if v_robo ? 'vagas' and coalesce(jsonb_typeof(v_in -> 'vagas'), 'null') <> 'null' then
    v_valor := v_in -> 'vagas';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de vaga inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_vagas) then
        v_vagas := v_vagas || v_item;
      end if;
    end loop;
    if cardinality(v_vagas) > 500 then
      raise exception 'No máximo 500 vagas por vez.' using errcode = '22023';
    end if;
  end if;

  -- Candidatos (modo anexos): códigos da Empregare, só dígitos.
  if v_robo ? 'candidatos' and coalesce(jsonb_typeof(v_in -> 'candidatos'), 'null') <> 'null' then
    v_valor := v_in -> 'candidatos';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de candidato inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_candidatos) then
        v_candidatos := v_candidatos || v_item;
      end if;
    end loop;
    if cardinality(v_candidatos) > 1000 then
      raise exception 'No máximo 1.000 candidatos por vez.' using errcode = '22023';
    end if;
  end if;

  -- Limite: 1 a 500 vagas.
  if v_robo ? 'limite' and coalesce(jsonb_typeof(v_in -> 'limite'), 'null') <> 'null'
     and btrim(v_in ->> 'limite') <> '' then
    if btrim(v_in ->> 'limite') !~ '^\d{1,3}$'
       or (btrim(v_in ->> 'limite'))::integer not between 1 and 500 then
      raise exception 'Limite de 1 a 500 vagas.' using errcode = '22023';
    end if;
    v_limite := (btrim(v_in ->> 'limite'))::integer;
  end if;

  -- Anexos (robô da Empregare): true/false ou "true"/"false"; só nos modos normal e forcar.
  if v_robo ? 'anexos' and coalesce(jsonb_typeof(v_in -> 'anexos'), 'null') <> 'null' then
    if v_in -> 'anexos' in ('true'::jsonb, '"true"'::jsonb) then
      v_anexos := true;
    elsif v_in -> 'anexos' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_anexos := false;
    else
      raise exception 'Opção “anexos” inválida (sim ou não).' using errcode = '22023';
    end if;
    if v_anexos and v_modo not in ('normal', 'forcar') then
      raise exception 'Guardar os links dos anexos só nos modos Normal e Forçar.' using errcode = '22023';
    end if;
  end if;

  -- Seco (modo anexos): true/false ou "true"/"false".
  if v_robo ? 'seco' and coalesce(jsonb_typeof(v_in -> 'seco'), 'null') <> 'null' then
    if v_in -> 'seco' in ('true'::jsonb, '"true"'::jsonb) then
      v_seco := true;
    elsif v_in -> 'seco' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_seco := false;
    else
      raise exception 'Opção “seco” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;

  -- Forçar edital congelado (20261020170000): true/false ou "true"/"false", com motivo.
  if v_robo ? 'forcar_congelado' and coalesce(jsonb_typeof(v_in -> 'forcar_congelado'), 'null') <> 'null' then
    if v_in -> 'forcar_congelado' in ('true'::jsonb, '"true"'::jsonb) then
      v_forcar_congelado := true;
    elsif v_in -> 'forcar_congelado' not in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      raise exception 'Opção “forcar_congelado” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;
  if v_robo ? 'motivo' and coalesce(jsonb_typeof(v_in -> 'motivo'), 'null') <> 'null' then
    if jsonb_typeof(v_in -> 'motivo') <> 'string' then
      raise exception 'Motivo inválido.' using errcode = '22023';
    end if;
    v_motivo := nullif(btrim(v_in ->> 'motivo'), '');
  end if;
  if v_motivo is not null and not v_forcar_congelado then
    raise exception 'O motivo só vale com “Forçar edital com inscrições congeladas”.' using errcode = '22023';
  end if;

  -- Só anexos: relê os anexos do questionário sem exportar; pede vagas ou editais.
  if v_modo = 'anexos' then
    if cardinality(v_vagas) = 0 and cardinality(v_editais) = 0 then
      raise exception 'O modo Só anexos pede vagas ou editais.' using errcode = '22023';
    end if;
  elsif cardinality(v_candidatos) > 0 or coalesce(v_seco, false) then
    raise exception 'Candidatos e "só comparar" só no modo Só anexos.' using errcode = '22023';
  end if;

  -- Sondar (como o workflow exige): uma única vaga, sem editais, limite de 1 a 3 candidatos.
  if v_modo = 'sondar' then
    if cardinality(v_vagas) <> 1 or cardinality(v_editais) > 0 then
      raise exception 'O modo Sondar pede um único código de vaga (sem editais).' using errcode = '22023';
    end if;
    if v_limite is not null and v_limite > 3 then
      raise exception 'No modo Sondar, o limite é de 1 a 3 candidatos.' using errcode = '22023';
    end if;
  end if;

  -- Quem pode (o banco decide, como em api/rodar-carga.js).
  if not public.pode_disparar_carga() then
    if not coalesce((v_robo ->> 'por_edital')::boolean, false) then
      raise exception 'Só o administrador global roda as cargas.' using errcode = '42501';
    end if;
    if v_modo <> 'normal' or cardinality(v_vagas) > 0 or v_limite is not null or v_forcar_congelado
       or cardinality(v_editais) <> 1 or v_editais[1] !~ c_uuid then
      raise exception 'Só o administrador global roda as cargas com opções.' using errcode = '42501';
    end if;
    if not public.pode_recalcular_pre_classificacao(v_editais[1]::uuid) then
      raise exception 'Só a coordenação da avaliação do edital recalcula a pré-classificação.' using errcode = '42501';
    end if;
  end if;

  -- Duplo clique: o mesmo robô pedido há menos de 2 min (e ainda não recusado).
  if exists (
    select 1 from public."TL_DISPARO_ROBO" d
     where d."NO_WORKFLOW" = v_robo ->> 'workflow'
       and d."TP_SITUACAO" in ('PEDIDO', 'ACEITO')
       and d."DT_DISPARO" > now() - interval '2 minutes') then
    raise exception 'Esta carga acabou de ser pedida. Aguarde alguns minutos.' using errcode = '55006';
  end if;

  -- [pendente-no-grupo] (20261022170000) O GitHub guarda UMA execução esperando por grupo de
  -- concorrência: um pedido novo cancela, sem aviso, o que já esperava. Com uma execução
  -- rodando e outra já pedida depois dela, recusa em vez de trocar uma pela outra.
  if private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(v_robo ->> 'workflow') then
    raise exception 'Já há uma execução desta carga esperando a que está rodando terminar; um pedido novo cancelaria aquela. Aguarde.'
      using errcode = '55006';
  end if;

  -- [congeladas] Inscrições congeladas (20261020170000): nos modos que gravam, o edital ou a
  -- vaga pedidos explicitamente de edital congelado são recusados; o administrador global
  -- pode forçar, com motivo (a LIBERACAO vale 12 h e vai ao workflow como forcar_congelado).
  -- Sem edital nem vaga, o robô e a pré-classificação pulam os congelados sozinhos.
  -- (20261022170000) O Só anexos grava também (respostas e anexos): só com a liberação, ou
  -- com "só comparar" (seco), que não grava nada.
  v_grava := (v_robo -> 'modos_que_gravam') ? v_modo
             or ((v_robo -> 'modos_que_gravam_sem_seco') ? v_modo and not coalesce(v_seco, false));
  if v_grava then
    select coalesce(array_agg(distinct m.id), '{}'),
           string_agg(distinct coalesce(private."FC_NUMERO_EDITAL"(m.edital), m.edital), ', ')
      into v_congelados, v_rotulos
      from public."TB_CONGELAMENTO_INSCRICAO" c
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c."CO_MONITORAMENTO"
     where c."ST_INSCRICOES_CONGELADAS" = 'S'
       and (m.id::text = any (v_editais)
            or private."FC_NUMERO_EDITAL"(m.edital) = any (v_editais)
            or exists (select 1 from public."TB_EMPREGARE_VAGA" v
                        where v."CO_MONITORAMENTO" = m.id and v."CO_VAGA" = any (v_vagas)));
    if cardinality(v_congelados) > 0 and not v_forcar_congelado and v_modo = 'anexos' then
      raise exception 'Inscrições congeladas: %. O Só anexos só grava neste edital com a liberação do administrador global (com motivo); para conferir sem gravar, use "só comparar".', v_rotulos
        using errcode = '55000';
    end if;
    if cardinality(v_congelados) > 0 and not v_forcar_congelado then
      raise exception 'Inscrições congeladas: %. O robô e a pré-classificação não mexem neste edital; tire-o do pedido (só o administrador global força, com motivo).', v_rotulos
        using errcode = '55000';
    end if;
    if v_forcar_congelado then
      if not public.pode_disparar_carga() then
        raise exception 'Só o administrador global força edital com inscrições congeladas.' using errcode = '42501';
      end if;
      if v_motivo is null or length(v_motivo) not between 10 and 500 then
        raise exception 'Informe o motivo para forçar (10 a 500 caracteres).' using errcode = '22023';
      end if;
      if cardinality(v_congelados) = 0 then
        raise exception 'Nenhum edital ou vaga pedida está com as inscrições congeladas.' using errcode = '22023';
      end if;
      v_liberacao := gen_random_uuid();
      insert into public."TH_CONGELAMENTO_INSCRICAO"
             ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "CO_USUARIO", "CO_LIBERACAO", "DT_VALIDADE")
      select x, 'LIBERACAO', v_motivo, v_uid, v_liberacao, now() + interval '12 hours'
        from unnest(v_congelados) x;
    end if;
  elsif v_forcar_congelado then
    raise exception 'Forçar edital congelado só nos modos que gravam (no Só anexos, sem "só comparar").' using errcode = '22023';
  end if;

  v_saida := jsonb_build_object('modo', v_modo);
  if coalesce((v_robo ->> 'por_edital')::boolean, false) or cardinality(v_editais) > 0 then
    v_saida := v_saida || jsonb_build_object('editais', array_to_string(v_editais, ','));
  end if;
  if cardinality(v_vagas) > 0 then
    v_saida := v_saida || jsonb_build_object('vagas', array_to_string(v_vagas, ','));
  end if;
  if v_limite is not null then
    v_saida := v_saida || jsonb_build_object('limite', v_limite::text);
  end if;
  if v_anexos is not null then
    v_saida := v_saida || jsonb_build_object('anexos', case when v_anexos then 'true' else 'false' end);
  end if;
  if cardinality(v_candidatos) > 0 then
    v_saida := v_saida || jsonb_build_object('candidatos', array_to_string(v_candidatos, ','));
  end if;
  if v_modo = 'anexos' then
    v_saida := v_saida || jsonb_build_object('seco', case when coalesce(v_seco, false) then 'true' else 'false' end);
  end if;

  if v_liberacao is not null then
    v_saida := v_saida || jsonb_build_object('forcar_congelado', v_liberacao::text);
  end if;

  v_disparo := private."FC_DISPARAR_ROBO"(v_robo ->> 'workflow', v_saida, v_uid);
  if v_liberacao is not null then
    update public."TH_CONGELAMENTO_INSCRICAO" h set "CO_DISPARO" = v_disparo
     where h."CO_LIBERACAO" = v_liberacao and h."TP_EVENTO" = 'LIBERACAO';
  end if;
  return v_disparo;
end;
$function$;
comment on function public.disparar_robo(text, jsonb) is
  'Rodar agora, Opções (Status das atualizações) e Recalcular (pré-classificação) pelo banco (20261008140000; substitui api/rodar-carga.js): confere quem pede (administrador global: qualquer robô e opções; coordenação: só a pré-classificação de um edital pelo id, modo normal), a lista branca do robô (modo, editais, vagas, limite, anexos; no robô da Empregare o modo "anexos" — só relê os anexos do questionário, sem exportar nem pré-classificar; pede vagas ou editais — com "candidatos" e "seco", que só valem nele; desde 20261023200000, o relatório de desempate da Classificação em Python, "classificacao_desempate", só no modo normal: prepara os relatórios e os cálculos pendentes), o pedido repetido em 2 min (55006) e, desde 20261022170000, a execução que já espera a vez no grupo de concorrência do GitHub (55006: o pedido novo a cancelaria). Inscrições congeladas (20261020170000): nos modos que gravam (robô: normal, forcar e, desde 20261022170000, anexos sem "seco"; pré-classificação: normal e refazer_lote), edital ou vaga pedidos de edital congelado dão 55000, salvo forcar_congelado = true com motivo (10 a 500), só do administrador global — grava a LIBERACAO em TH_CONGELAMENTO_INSCRICAO (12 h) e manda o token como forcar_congelado. Pede o workflow por FC_DISPARAR_ROBO com disparado_por = id de quem pediu e devolve o CO_DISPARO de TL_DISPARO_ROBO (acompanhe por situacao_do_disparo_robo). 28000 sem sessão, 42501 sem permissão, 22023 para opção inválida.';

-- Corpo de 20261022170000 + classificacao.yml.
create or replace function public.registrar_disparo_externo(p_workflow text, p_ator text, p_url text, p_resumo text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ator text := nullif(btrim(coalesce(p_ator, '')), '');
  v_resumo text := nullif(left(btrim(coalesce(p_resumo, '')), 300), '');
  v_disparo bigint;
begin
  if p_workflow is null or p_workflow not in (
       'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml',
       'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml') then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_url is null or length(p_url) > 300
     or p_url !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[0-9]+$' then
    raise exception 'Endereço da execução inválido' using errcode = '22023';
  end if;
  -- Login do GitHub (letras, dígitos, hífen; robôs com [bot]); fora disso, sem ator.
  if v_ator is not null and v_ator !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}(\[bot\])?$' then
    v_ator := null;
  end if;

  insert into public."TL_DISPARO_ROBO"
         ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "NO_ATOR_GITHUB", "DS_URL_EXECUCAO", "DS_MENSAGEM")
  values (p_workflow, 'GITHUB', null, 'INICIADO', v_ator, p_url, v_resumo)
  on conflict ("DS_URL_EXECUCAO") where "TP_ORIGEM" = 'GITHUB' do nothing
  returning "CO_DISPARO" into v_disparo;
  if v_disparo is null then
    select d."CO_DISPARO" into v_disparo
      from public."TL_DISPARO_ROBO" d
     where d."TP_ORIGEM" = 'GITHUB' and d."DS_URL_EXECUCAO" = p_url;
  end if;
  return v_disparo;
end;
$function$;

-- 8. Status das atualizações: o relatório e o cálculo pelo Python -------------------------------
-- Corpo de 20261020170000 + "classificacao_python".
create or replace function public.get_saude_das_cargas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tarefas json;
  v_chave_cadastrada boolean;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  -- [agenda-dos-robos] só se a chave existe (nunca o valor); null se o Vault não deixar ver.
  begin
    select exists (select 1 from vault.secrets s where s.name = 'github_disparo_robos')
      into v_chave_cadastrada;
  exception when others then
    v_chave_cadastrada := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500),
                -- [nao-trava] encerrada por inatividade (20261007170000)
                'encerrada_por_inatividade', coalesce((x.j -> 'resultado' ->> 'encerrada_por_inatividade')::boolean, false)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'conferencias', (
      select coalesce(json_agg(json_build_object(
          'inicio', c."DT_INICIO",
          'fim', c."DT_FIM",
          'situacao', c."TP_SITUACAO",
          'linhas', c."QT_AVISO_ABERTO",
          'mensagem', c."DS_MENSAGEM",
          'disparo', c."TP_DISPARO",
          'novos', c."QT_AVISO_NOVO",
          'abertos', c."QT_AVISO_ABERTO",
          'resolvidos', c."QT_AVISO_RESOLVIDO",
          'falhas', c."DS_FALHA",
          'execucao', c."DS_URL_EXECUCAO"
        ) order by c."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_CONFERENCIA" t order by t."DT_INICIO" desc limit 10) c
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
          'inicio', p."DT_INICIO",
          'fim', p."DT_FIM",
          'situacao', p."TP_SITUACAO",
          'linhas', p."QT_INSCRITO",
          'mensagem', p."DS_MENSAGEM",
          'disparo', p."TP_DISPARO",
          'editais', p."QT_EDITAL",
          'vagas', p."QT_VAGA",
          'lote', p."QT_LOTE",
          'refazer', p."ST_REFAZER_LOTE" = 'S',
          'execucao', p."DS_URL_EXECUCAO"
        ) order by p."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t where not private."FC_EXECUCAO_EH_TREINAMENTO"(t."CO_EXECUCAO") order by t."DT_INICIO" desc limit 10) p
    ),
    -- [agenda-dos-robos] os pedidos do banco ao GitHub (20261008140000)
    'agenda_dos_robos', json_build_object(
      'chave_cadastrada', v_chave_cadastrada,
      'ultimo_aceito', (select max(d."DT_DISPARO") from public."TL_DISPARO_ROBO" d where d."TP_SITUACAO" = 'ACEITO'),
      'falhas_24h', (select count(*) from public."TL_DISPARO_ROBO" d
                      where d."TP_SITUACAO" = 'FALHOU' and d."DT_DISPARO" > now() - interval '24 hours'),
      'sem_chave_24h', (select count(*) from public."TL_DISPARO_ROBO" d
                         where d."TP_SITUACAO" = 'SEM_TOKEN' and d."DT_DISPARO" > now() - interval '24 hours'),
      'disparos', (
        select coalesce(json_agg(json_build_object(
            'workflow', x."NO_WORKFLOW",
            'origem', x."TP_ORIGEM",
            'inicio', x."DT_DISPARO",
            'fim', x."DT_RESPOSTA",
            'situacao', x."TP_SITUACAO",
            'http', x."NU_STATUS_HTTP",
            'mensagem', x."DS_MENSAGEM",
            -- [disparos-externos] quem iniciou no GitHub e o link da execução (20261020170000)
            'ator', x."NO_ATOR_GITHUB",
            'execucao', x."DS_URL_EXECUCAO"
          ) order by x."DT_DISPARO" desc, x."CO_DISPARO" desc), '[]'::json)
          from (select * from public."TL_DISPARO_ROBO" t
                 order by t."DT_DISPARO" desc, t."CO_DISPARO" desc limit 20) x
      )
    ),
    -- [classificacao-python] o relatório de desempate e o cálculo das listas pelo Python (20261023200000)
    'classificacao_python', json_build_object(
      'relatorios', (
        select coalesce(json_agg(json_build_object(
            'inicio', p."DT_PEDIDO",
            'fim', p."DT_ATUALIZACAO",
            'situacao', p."TP_SITUACAO",
            'mensagem', p."DS_MENSAGEM",
            'edital', coalesce(private."FC_NUMERO_EDITAL"(m.edital), m.edital),
            'tipo', l."TP_LISTA"
          ) order by p."DT_ATUALIZACAO" desc), '[]'::json)
          from (select * from public."TB_PREPARO_DESEMPATE" t
                 where t."TP_SITUACAO" <> 'DESLIGADA'
                 order by t."DT_ATUALIZACAO" desc limit 20) p
          join public."TB_LISTA_CLASSIFICACAO" l on l."CO_LISTA_CLASSIFICACAO" = p."CO_LISTA_CLASSIFICACAO"
          join public."TB_MONITORAMENTO_INDIGENA" m on m.id = l."CO_MONITORAMENTO"
      ),
      'calculos', (
        select coalesce(json_agg(json_build_object(
            'inicio', p."DT_PEDIDO",
            'fim', p."DT_ATUALIZACAO",
            'situacao', p."TP_SITUACAO",
            'mensagem', p."DS_MENSAGEM",
            'edital', coalesce(private."FC_NUMERO_EDITAL"(m.edital), m.edital),
            'tipo', p."TP_LISTA"
          ) order by p."DT_ATUALIZACAO" desc), '[]'::json)
          from (select * from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" t
                 where t."TP_SITUACAO" <> 'SUBSTITUIDO'
                 order by t."DT_ATUALIZACAO" desc limit 20) p
          join public."TB_MONITORAMENTO_INDIGENA" m on m.id = p."CO_MONITORAMENTO"
      )
    ),
    'tarefas', v_tarefas
  );
end;
$function$;

-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table t_ensaio (chave text primary key, valor jsonb) on commit drop;
grant select, insert, update on t_ensaio to authenticated;

-- Segredo FALSO para todo o ensaio: nenhum pedido usa o segredo real do disparo.
select vault.create_secret('token-falso-do-ensaio', 'ensaio_disparo_classificacao_2b');
select set_config('agsus.segredo_disparo_robos', 'ensaio_disparo_classificacao_2b', true);

-- A base: a última lista do 114 e a versão vigente da regra.
insert into t_ensaio
select 'base', jsonb_build_object('tipo', l."TP_LISTA", 'versao', r."NU_VERSAO_VIGENTE",
                                  'resultado', jsonb_set(l."DS_RESULTADO", '{regra_versao}', to_jsonb(r."NU_VERSAO_VIGENTE")))
  from public."TB_LISTA_CLASSIFICACAO" l
  join public."TB_REGRA_CLASSIFICACAO" r on r."CO_MONITORAMENTO" = l."CO_MONITORAMENTO"
 where l."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
 order by l."DT_GERACAO" desc limit 1;

-- A. A chave nasce desligada; os privilégios.
insert into t_ensaio values ('chave', jsonb_build_object(
  'ligada', (select c."ST_LIGADA" from public."TB_CHAVE_AUTOMACAO" c where c."CO_CHAVE" = 'classificacao_calculo'),
  'nome', (select c."NO_CHAVE" from public."TB_CHAVE_AUTOMACAO" c where c."CO_CHAVE" = 'classificacao_calculo'),
  'historico', (select count(*) from public."TH_CHAVE_AUTOMACAO" h where h."CO_CHAVE" = 'classificacao_calculo'),
  'calculo_pelo_python', private."FC_CALCULO_PELO_PYTHON"(),
  'job_so_service_role', not has_function_privilege('authenticated', 'public.classificacao_gravar_calculo(text, uuid, jsonb)', 'execute')
                         and not has_function_privilege('authenticated', 'public.classificacao_marcar_calculo(text, uuid, text, text)', 'execute')
                         and not has_function_privilege('authenticated', 'public.classificacao_ler_pedidos_calculo()', 'execute')
                         and has_function_privilege('service_role', 'public.classificacao_gravar_calculo(text, uuid, jsonb)', 'execute'),
  'tela_sem_anon', not has_function_privilege('anon', 'public.pedir_calculo_classificacao(uuid, text, integer)', 'execute')
                   and not has_function_privilege('anon', 'public.registrar_lista_calculada(uuid, jsonb)', 'execute')
                   and has_function_privilege('authenticated', 'public.registrar_lista_calculada(uuid, jsonb)', 'execute'),
  'tabela_sem_acesso_direto', not has_table_privilege('authenticated', 'public."TB_PEDIDO_CALCULO_CLASSIFICACAO"', 'select'),
  'privado_sem_acesso', not has_function_privilege('authenticated', 'private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb)', 'execute')));

-- B. Desligada: tudo como hoje. Rodar agora do relatório. O registro da execução do GitHub.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"df5b852c-f981-4486-94b9-67857fff8f93","role":"authenticated"}', true);
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_base record;
  v_pedido json;
  v_lista json;
  v_disparo bigint;
  v_repetido boolean := false;
  v_outro_modo boolean := false;
begin
  select (b.valor->>'tipo') as tipo, (b.valor->'resultado') as resultado, (b.valor->>'versao')::integer as versao
    into v_base from t_ensaio b where b.chave = 'base';
  v_pedido := public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao);
  -- O Rodar agora antes de gerar: gerar pede o relatório (classificacao.yml) e o repetido em 2 min seria recusado.
  v_disparo := public.disparar_robo('classificacao_desempate', '{}'::jsonb);
  begin
    perform public.disparar_robo('classificacao_desempate', '{}'::jsonb);
  exception when sqlstate '55006' then v_repetido := true;
  end;
  begin
    perform public.disparar_robo('classificacao_desempate', '{"modo": "desempate"}'::jsonb);
  exception when sqlstate '22023' then v_outro_modo := true;
  end;
  v_lista := public.registrar_lista_classificacao(v_edital, v_base.tipo, v_base.versao, v_base.resultado);
  insert into t_ensaio values ('desligada', jsonb_build_object(
    'resposta', v_pedido,
    'lista_registrada', v_lista->>'id' is not null,
    'rodar_agora', v_disparo::text,
    'repetido_recusado', v_repetido,
    'outro_modo_recusado', v_outro_modo));
end;
$$;
reset role;
do $$
declare
  v_desligada jsonb := (select valor from t_ensaio where chave = 'desligada');
  v_disparo bigint := (v_desligada->>'rodar_agora')::bigint;
begin
  update t_ensaio set valor = (valor - 'rodar_agora') || jsonb_build_object(
    'pedidos_gravados', (select count(*) from public."TB_PEDIDO_CALCULO_CLASSIFICACAO"),
    'rodar_agora', (select d."NO_WORKFLOW" || ':' || d."TP_SITUACAO" || ':' || d."TP_ORIGEM" || ':' ||
                           (convert_from(r.body, 'UTF8')::jsonb #>> '{inputs,modo}')
                      from public."TL_DISPARO_ROBO" d
                      join net.http_request_queue r on r.id = d."CO_PEDIDO_HTTP"
                     where d."CO_DISPARO" = v_disparo),
    'externo', public.registrar_disparo_externo('classificacao.yml', 'ensaio-bot',
                 'https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/990000001', 'modo normal') is not null)
   where chave = 'desligada';
end;
$$;

-- C. Ligada: o caminho antigo recusa; pedir grava e pede o workflow; versão velha da regra.
update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = 'S' where "CO_CHAVE" = 'classificacao_calculo';
set local role authenticated;
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_base record;
  v_antigo boolean := false;
  v_versao_velha boolean := false;
  v_pedido json;
begin
  select (b.valor->>'tipo') as tipo, (b.valor->'resultado') as resultado, (b.valor->>'versao')::integer as versao
    into v_base from t_ensaio b where b.chave = 'base';
  begin
    perform public.registrar_lista_classificacao(v_edital, v_base.tipo, v_base.versao, v_base.resultado);
  exception when sqlstate '55000' then v_antigo := true;
  end;
  begin
    perform public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao - 1);
  exception when sqlstate 'PT409' then v_versao_velha := true;
  end;
  v_pedido := public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao);
  insert into t_ensaio values ('pedido1', jsonb_build_object('id', v_pedido->>'pedido'));
  insert into t_ensaio values ('ligada', jsonb_build_object(
    'caminho_antigo_recusado', v_antigo,
    'versao_velha_recusada', v_versao_velha,
    'resposta', jsonb_build_object('ligada', v_pedido->'ligada', 'situacao', v_pedido->'situacao', 'tipo', v_pedido->>'tipo' = v_base.tipo)));
end;
$$;
reset role;

-- D. O job: a fila, a marcação, as recusas e a gravação do retrato.
do $$
declare
  v_pedido uuid := ((select valor from t_ensaio where chave = 'pedido1')->>'id')::uuid;
  v_base jsonb := (select valor from t_ensaio where chave = 'base');
  v_fila jsonb;
  v_disparo text;
  v_recusas jsonb := '{}'::jsonb;
  v_marcado text;
  v_gravado jsonb;
begin
  select d."TP_SITUACAO" || ':' || d."TP_ORIGEM" || ':' || (d."CO_USUARIO" is not null)::text || ':' ||
         (convert_from(r.body, 'UTF8')::jsonb #>> '{inputs,modo}')
    into v_disparo
    from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p
    join public."TL_DISPARO_ROBO" d on d."CO_DISPARO" = p."CO_DISPARO"
    join net.http_request_queue r on r.id = d."CO_PEDIDO_HTTP"
   where p."CO_PEDIDO_CALCULO" = v_pedido;
  v_fila := public.classificacao_ler_pedidos_calculo();
  perform public.classificacao_marcar_calculo('ensaio-etapa2b', v_pedido, 'CALCULANDO', null);
  select p."TP_SITUACAO" into v_marcado from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p where p."CO_PEDIDO_CALCULO" = v_pedido;
  begin
    perform public.classificacao_marcar_calculo('ensaio-etapa2b', v_pedido, 'PRONTO', null);
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"pronto_pela_marcacao": true}';
  end;
  begin
    perform public.classificacao_marcar_calculo('ensaio-etapa2b', v_pedido, 'FALHOU', 'contato@exemplo');
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"mensagem_com_arroba": true}';
  end;
  begin
    perform public.classificacao_marcar_calculo('ensaio etapa2b', v_pedido, 'FALHOU', null);
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"execucao_invalida": true}';
  end;
  begin
    perform public.classificacao_gravar_calculo('ensaio-etapa2b', v_pedido,
      jsonb_set(v_base->'resultado', '{tipo}', to_jsonb(case when v_base->>'tipo' = 'FINAL' then 'PRELIMINAR' else 'FINAL' end)));
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"outro_tipo": true}';
  end;
  begin
    perform public.classificacao_gravar_calculo('ensaio-etapa2b', v_pedido,
      jsonb_set(v_base->'resultado', '{regra_versao}', to_jsonb((v_base->>'versao')::integer - 1)));
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"outra_versao": true}';
  end;
  v_gravado := public.classificacao_gravar_calculo('ensaio-etapa2b', v_pedido, v_base->'resultado');
  begin
    perform public.classificacao_gravar_calculo('ensaio-etapa2b', v_pedido, v_base->'resultado');
  exception when sqlstate '55000' then v_recusas := v_recusas || '{"gravar_duas_vezes": true}';
  end;
  insert into t_ensaio values ('job', jsonb_build_object(
    'disparo', v_disparo,
    'na_fila', exists (select 1 from jsonb_array_elements(v_fila) f where f->>'pedido' = v_pedido::text),
    'depois_de_marcar', v_marcado,
    'gravado', v_gravado->>'situacao',
    'hash_do_retrato', v_gravado->>'hash' = encode(sha256(convert_to((v_base->'resultado')::text, 'UTF8')), 'hex'),
    'recusas', v_recusas));
end;
$$;

-- E. A tela: lê o pedido, o retrato diferente não registra, o igual registra.
set local role authenticated;
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_base record;
  v_p1 uuid := ((select valor from t_ensaio where chave = 'pedido1')->>'id')::uuid;
  v_sem json;
  v_com json;
  v_mexido jsonb;
  v_nao json;
  v_p2 uuid;
  v_lista json;
  v_duas_vezes boolean := false;
begin
  select (b.valor->>'tipo') as tipo, (b.valor->'resultado') as resultado, (b.valor->>'versao')::integer as versao
    into v_base from t_ensaio b where b.chave = 'base';
  v_sem := public.obter_calculo_classificacao(v_p1);
  v_com := public.obter_calculo_classificacao(v_p1, true);
  v_mexido := jsonb_set(v_base.resultado, '{totais,elegiveis}',
                        to_jsonb(coalesce((v_base.resultado #>> '{totais,elegiveis}')::integer, 0) + 1));
  v_nao := public.registrar_lista_calculada(v_p1, v_mexido);
  insert into t_ensaio values ('tela_nao_confere', jsonb_build_object(
    'situacao_lida', v_sem->>'situacao',
    'sem_retrato_por_padrao', v_sem->'retrato' is null or json_typeof(v_sem->'retrato') = 'null',
    'retrato_igual', (v_com->'retrato')::jsonb = v_base.resultado,
    'resposta', v_nao::jsonb));

  v_p2 := (public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao)->>'pedido')::uuid;
  insert into t_ensaio values ('pedido2', jsonb_build_object('id', v_p2));
end;
$$;
reset role;
select public.classificacao_gravar_calculo('ensaio-etapa2b', ((select valor from t_ensaio where chave = 'pedido2')->>'id')::uuid,
                                           (select valor->'resultado' from t_ensaio where chave = 'base'));
set local role authenticated;
do $$
declare
  v_base record;
  v_p2 uuid := ((select valor from t_ensaio where chave = 'pedido2')->>'id')::uuid;
  v_lista json;
  v_duas_vezes boolean := false;
begin
  select (b.valor->'resultado') as resultado into v_base from t_ensaio b where b.chave = 'base';
  v_lista := public.registrar_lista_calculada(v_p2, v_base.resultado);
  begin
    perform public.registrar_lista_calculada(v_p2, v_base.resultado);
  exception when sqlstate '55000' then v_duas_vezes := true;
  end;
  insert into t_ensaio values ('lista2', jsonb_build_object('id', v_lista->>'id', 'hash', v_lista->>'hash',
                                                           'duas_vezes_recusada', v_duas_vezes));
end;
$$;
reset role;
do $$
declare
  v_p1 uuid := ((select valor from t_ensaio where chave = 'pedido1')->>'id')::uuid;
  v_p2 uuid := ((select valor from t_ensaio where chave = 'pedido2')->>'id')::uuid;
  v_l2 jsonb := (select valor from t_ensaio where chave = 'lista2');
  v_base jsonb := (select valor from t_ensaio where chave = 'base');
begin
  update t_ensaio set valor = valor || jsonb_build_object(
    'pedido', (select jsonb_build_object('situacao', p."TP_SITUACAO", 'origem', p."DS_DIVERGENCIA"->>'origem',
                                         'mensagem', p."DS_MENSAGEM" is not null)
                 from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p where p."CO_PEDIDO_CALCULO" = v_p1),
    'listas_registradas', (select count(*) from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p
                            where p."CO_PEDIDO_CALCULO" = v_p1 and p."CO_LISTA_CLASSIFICACAO" is not null))
   where chave = 'tela_nao_confere';
  insert into t_ensaio values ('tela_igual', jsonb_build_object(
    'pedido', (select jsonb_build_object('situacao', p."TP_SITUACAO", 'sem_retrato', p."DS_RETRATO" is null,
                                         'mesmo_hash', p."DS_HASH" = v_l2->>'hash',
                                         'aponta_a_lista', p."CO_LISTA_CLASSIFICACAO"::text = v_l2->>'id')
                 from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p where p."CO_PEDIDO_CALCULO" = v_p2),
    'lista_e_o_retrato_do_python', (select l."DS_RESULTADO" = v_base->'resultado' and l."DS_HASH" = v_l2->>'hash'
                                      from public."TB_LISTA_CLASSIFICACAO" l
                                     where l."CO_LISTA_CLASSIFICACAO" = (v_l2->>'id')::uuid),
    'relatorio_pedido', (select p."TP_SITUACAO" from public."TB_PREPARO_DESEMPATE" p
                          where p."CO_LISTA_CLASSIFICACAO" = (v_l2->>'id')::uuid),
    'duas_vezes_recusada', v_l2->'duas_vezes_recusada'));
end;
$$;

-- F. A divergência vista pela tela; o pronto abandonado é substituído.
set local role authenticated;
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_base record;
begin
  select (b.valor->>'tipo') as tipo, (b.valor->>'versao')::integer as versao into v_base from t_ensaio b where b.chave = 'base';
  insert into t_ensaio values ('pedido3', jsonb_build_object('id',
    public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao)->>'pedido'));
  insert into t_ensaio values ('pedido4', jsonb_build_object('id',
    public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao)->>'pedido'));
end;
$$;
reset role;
select public.classificacao_gravar_calculo('ensaio-etapa2b', ((select valor from t_ensaio where chave = k)->>'id')::uuid,
                                           (select valor->'resultado' from t_ensaio where chave = 'base'))
  from (values ('pedido3'), ('pedido4')) x(k);
-- O pedido 4 ficou pronto há 11 min e ninguém registrou.
update public."TB_PEDIDO_CALCULO_CLASSIFICACAO" set "DT_ATUALIZACAO" = now() - interval '11 minutes'
 where "CO_PEDIDO_CALCULO" = ((select valor from t_ensaio where chave = 'pedido4')->>'id')::uuid;
set local role authenticated;
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_base record;
  v_p3 uuid := ((select valor from t_ensaio where chave = 'pedido3')->>'id')::uuid;
  v_recusas jsonb := '{}'::jsonb;
  v_resposta json;
begin
  select (b.valor->>'tipo') as tipo, (b.valor->>'versao')::integer as versao into v_base from t_ensaio b where b.chave = 'base';
  begin
    perform public.registrar_divergencia_do_calculo(v_p3, 2, array['vagas[0].geral[1].nome=Fulana']);
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"caminho_com_valor": true}';
  end;
  begin
    perform public.registrar_divergencia_do_calculo(v_p3, 0, array['vagas[0].geral[1].posicao']);
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"total_zero": true}';
  end;
  v_resposta := public.registrar_divergencia_do_calculo(v_p3, 2, array['vagas[0].geral[1].posicao', 'totais.elegiveis']);
  -- Pedir de novo a mesma lista: o pedido 4 (pronto há 11 min) sai.
  insert into t_ensaio values ('pedido5', jsonb_build_object('id',
    public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao)->>'pedido'));
  insert into t_ensaio values ('divergencia', jsonb_build_object('resposta', v_resposta::jsonb, 'recusas', v_recusas));
end;
$$;
reset role;
update t_ensaio set valor = valor || jsonb_build_object(
  'gravada', (select jsonb_build_object('situacao', p."TP_SITUACAO", 'divergencia', p."DS_DIVERGENCIA",
                                        'retrato_fica', p."DS_RETRATO" is not null)
                from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p
               where p."CO_PEDIDO_CALCULO" = ((select valor from t_ensaio where chave = 'pedido3')->>'id')::uuid),
  'abandonado', (select jsonb_build_object('situacao', p."TP_SITUACAO", 'sem_retrato', p."DS_RETRATO" is null)
                   from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p
                  where p."CO_PEDIDO_CALCULO" = ((select valor from t_ensaio where chave = 'pedido4')->>'id')::uuid))
 where chave = 'divergencia';

-- G. Sem o segredo: o pedido não sai (SEM_DISPARO); a lista registrada sem o pedido do relatório entra na fila.
select set_config('agsus.segredo_disparo_robos', 'segredo_que_nao_existe_no_ensaio_2b', true);
set local role authenticated;
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_base record;
  v_pedido json;
begin
  select (b.valor->>'tipo') as tipo, (b.valor->>'versao')::integer as versao into v_base from t_ensaio b where b.chave = 'base';
  v_pedido := public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao);
  insert into t_ensaio values ('sem_segredo', jsonb_build_object('situacao', v_pedido->>'situacao',
                                                                'mensagem', v_pedido->>'mensagem', 'id', v_pedido->>'pedido'));
end;
$$;
reset role;
select public.classificacao_gravar_calculo('ensaio-etapa2b', ((select valor from t_ensaio where chave = 'pedido5')->>'id')::uuid,
                                           (select valor->'resultado' from t_ensaio where chave = 'base'));
set local role authenticated;
do $$
declare
  v_lista json;
begin
  v_lista := public.registrar_lista_calculada(((select valor from t_ensaio where chave = 'pedido5')->>'id')::uuid,
                                              (select valor->'resultado' from t_ensaio where chave = 'base'));
  insert into t_ensaio values ('lista_sem_segredo', jsonb_build_object('id', v_lista->>'id'));
end;
$$;
reset role;

-- H. O Status das atualizações e a fila do relatório.
insert into t_ensaio values ('fila', jsonb_build_object(
  'preparo_sem_disparo', (select p."TP_SITUACAO" from public."TB_PREPARO_DESEMPATE" p
                           where p."CO_LISTA_CLASSIFICACAO" = ((select valor from t_ensaio where chave = 'lista_sem_segredo')->>'id')::uuid),
  'sem_disparo_na_fila', exists (
    select 1 from jsonb_array_elements(public.classificacao_ler_pedidos_desempate()) p
     where p->>'lista' = (select valor->>'id' from t_ensaio where chave = 'lista_sem_segredo'))));
set local role authenticated;
select json_build_object(
  'chave', (select valor from t_ensaio where chave = 'chave'),
  'desligada', (select valor from t_ensaio where chave = 'desligada'),
  'ligada', (select valor from t_ensaio where chave = 'ligada'),
  'job', (select valor from t_ensaio where chave = 'job'),
  'tela_nao_confere', (select valor from t_ensaio where chave = 'tela_nao_confere'),
  'tela_igual', (select valor from t_ensaio where chave = 'tela_igual'),
  'divergencia', (select valor from t_ensaio where chave = 'divergencia'),
  'sem_segredo', (select valor - 'id' from t_ensaio where chave = 'sem_segredo'),
  'status', (select json_build_object(
               'calculos', json_array_length(s->'classificacao_python'->'calculos'),
               'situacoes', (select json_agg(distinct c->>'situacao') from json_array_elements(s->'classificacao_python'->'calculos') c),
               'relatorios_e_lista', json_typeof(s->'classificacao_python'->'relatorios'),
               'edital_no_status', (s->'classificacao_python'->'calculos'->0->>'edital') = '114/2026')
               from (select public.get_saude_das_cargas() s) x),
  'fila_do_relatorio', (select valor from t_ensaio where chave = 'fila')
) as ensaio;

rollback;
