/*
  PEDIR MAIS ACESSO (24/11/2026)

  POR QUE
  O pedido de acesso (20261021140000) só servia a quem entra sem perfil. Quem
  já tem conta e precisa de mais (uma aba com outro nível, outra área, outro
  grupo) pedia por fora, e quem aprova mudava à mão em Configurações › Acessos,
  sem o pedido nem a justificativa registrados. Agora o mesmo pedido
  (TB_SOLICITACAO_ACESSO e as mesmas RPCs) serve também a quem já tem acesso,
  pelo "Meus acessos" do menu da conta. Não é um fluxo paralelo: a aprovação e
  a recusa continuam em Configurações › Acessos › Pendentes.

  O QUE MUDA
    TB_SOLICITACAO_ACESSO
      + "TP_SOLICITACAO" ACESSO (o pedido de entrada, como hoje; padrão das
        linhas existentes) | MODULO | AREA | GRUPO.
      + "NO_RECURSO" e "TP_NIVEL": o módulo e o nível pedidos (MODULO).
        AREA usa "CO_AREA"; GRUPO usa perfil_solicitado (já com FK para
        TB_GRUPO_ACESSO).
      + CK_SOLICACESSO_TIPO e CK_SOLICACESSO_AMPLIACAO (o que cada tipo
        preenche).
    registrar_solicitacao_acesso: ganha p_tipo, p_recurso, p_nivel e p_grupo
      (no fim, com padrão nulo; as chamadas de hoje continuam valendo). Sem
      perfil ativo, faz o que fazia. Com perfil ativo, registra o pedido de
      mais acesso (private."FC_REGISTRAR_AMPLIACAO_ACESSO"), com a mesma regra
      da justificativa (20 a 2.000 caracteres, 3 palavras).
    aprovar_solicitacao_acesso: o pedido de mais acesso concede exatamente o
      que foi pedido (private."FC_APROVAR_AMPLIACAO_ACESSO"): o nível do
      módulo (permissão individual), a área ou o grupo; nada mais do perfil
      muda. Registra quem aprovou no pedido (avaliado_por/avaliado_em) e no
      histórico (TH_PERMISSAO_RECURSO). O pedido de entrada segue igual.
    obter_minha_solicitacao_acesso: com perfil ativo, devolve o último pedido
      de mais acesso; sem perfil, o último pedido de entrada (a tela de
      entrada não vê pedido de mais acesso que tenha sobrado de uma conta
      desativada). Devolve também tipo, módulo, nível e grupo pedidos.
    listar_solicitacoes_acesso: devolve tipo, módulo, nível, grupo pedido e o
      que a pessoa tem hoje (grupo, nível no módulo, áreas); não lista o
      pedido de quem está olhando (ninguém aprova o próprio acesso).
    listar_opcoes_da_solicitacao_acesso: com perfil ativo, devolve também os
      grupos que se podem pedir (código, nome e descrição; sem o de
      administrador global), para o formulário de "outro grupo".
    recusar_solicitacao_acesso e cancelar_minha_solicitacao_acesso: sem
      mudança (valem para os dois tipos).

  QUEM PEDE
    Quem tem perfil ativo, menos o administrador global (já tem tudo). Um
    pedido pendente por pessoa (o índice de hoje); enviar de novo troca o
    pendente.
      MODULO: nível acima do que a pessoa tem hoje, nas regras da matriz
              (Configurações sem Leitor; Gestão de acessos e Parecer jurídico
              só Editor).
      AREA:   área que a pessoa ainda não tem; quem tem coordenação não pede
              área (a área vem da coordenação).
      GRUPO:  outro grupo, menos o de administrador global.

  QUEM APROVA (as mesmas regras da matriz, salvar_matriz_acessos)
    Administrador global: todos os pedidos.
    Coordenador (Gestão de acessos como Editor): os da própria coordenação,
      dentro do teto dele: módulo até o próprio nível (nunca Gestão de
      acessos), grupo que cabe no teto; área, não.
    Ninguém aprova o próprio pedido. Depois de aprovar, a pessoa não pode
    ficar sem área nem gerenciar acessos sem coordenação (as travas da
    matriz).

  GUARDAS (nada é aplicado se falhar)
    - Já aplicada ("TP_SOLICITACAO" existe).
    - As cinco funções trocadas não são as que esta migration conhece (md5
      do corpo): alguém as mudou depois; junte as mudanças antes de aplicar.

  DADOS: nenhuma linha muda (as existentes ficam "TP_SOLICITACAO" = ACESSO).

  DEPOIS DE APLICAR: o front da PR "Pedir mais acesso" (gaveta Meus acessos e
  Pendentes) já pode ir ao ar; antes, o front de hoje segue funcionando.

  Ensaio:   supabase/ensaios/20261124210000_ampliar_pedido_de_acesso.sql
  Rollback: supabase/rollback/20261124210000_ampliar_pedido_de_acesso.sql
  Testes:   tests/repositorio-e-banco.test.ts (bloco
            pedido-de-mais-acesso-no-banco), PGlite.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'TB_SOLICITACAO_ACESSO'
                and column_name = 'TP_SOLICITACAO') then
    raise exception '20261124210000 já aplicada: TB_SOLICITACAO_ACESSO já tem "TP_SOLICITACAO".';
  end if;
  -- As funções abaixo partem das que estão no banco: se outra migration (ou um ajuste à mão)
  -- as mudou depois, o corpo não bate e nada é aplicado. O \r sai da conta: a de aprovar foi
  -- gravada com quebras de linha do Windows (CRLF), e o retrato as traz como LF.
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.registrar_solicitacao_acesso(text, text, text, text, text, text, text)')), E'\r', ''))
       is distinct from 'dbd7ab01aac795547e007ff58787dede'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.aprovar_solicitacao_acesso(uuid, text, text, text[], text)')), E'\r', ''))
       is distinct from '53af7b585c4fcf42edeb68ccb62bd791'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.obter_minha_solicitacao_acesso()')), E'\r', ''))
       is distinct from '1394838a42ae9c0ff559a9d260ac5563'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_solicitacoes_acesso(text)')), E'\r', ''))
       is distinct from '0ab1dee409d463821d9d2181ce1e0986'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_opcoes_da_solicitacao_acesso()')), E'\r', ''))
       is distinct from '853810f495679a7b966125a89e5aa2ce' then
    raise exception 'registrar_solicitacao_acesso, aprovar_solicitacao_acesso, obter_minha_solicitacao_acesso, listar_solicitacoes_acesso ou listar_opcoes_da_solicitacao_acesso mudou depois do retrato de 24/11/2026: junte as mudanças antes de aplicar.';
  end if;
end;
$$;

-- 1. A tabela ------------------------------------------------------------------------------------
alter table public."TB_SOLICITACAO_ACESSO"
  add column "TP_SOLICITACAO" text not null default 'ACESSO',
  add column "NO_RECURSO" text,
  add column "TP_NIVEL" text;

alter table public."TB_SOLICITACAO_ACESSO"
  add constraint "CK_SOLICACESSO_TIPO" check ("TP_SOLICITACAO" in ('ACESSO', 'MODULO', 'AREA', 'GRUPO')),
  add constraint "CK_SOLICACESSO_AMPLIACAO" check (
    case "TP_SOLICITACAO"
      when 'MODULO' then "NO_RECURSO" is not null and "TP_NIVEL" in ('leitor', 'editor', 'admin')
                         and "CO_AREA" is null and "CO_CARGO_SOLICITADO" is null
      when 'AREA' then "CO_AREA" is not null and "NO_RECURSO" is null and "TP_NIVEL" is null
                       and "CO_CARGO_SOLICITADO" is null
      when 'GRUPO' then "NO_RECURSO" is null and "TP_NIVEL" is null and "CO_AREA" is null
                        and "CO_CARGO_SOLICITADO" is null
      else "NO_RECURSO" is null and "TP_NIVEL" is null
    end);

comment on column public."TB_SOLICITACAO_ACESSO"."TP_SOLICITACAO" is
  'Tipo do pedido: ACESSO (entrada de quem não tem perfil ativo, ou reativação) ou, de quem já tem acesso (pedir mais acesso), MODULO (um nível num módulo), AREA (outra área, em CO_AREA) ou GRUPO (outro grupo, em perfil_solicitado).';
comment on column public."TB_SOLICITACAO_ACESSO"."NO_RECURSO" is
  'Módulo pedido (TP_SOLICITACAO = MODULO): um de private."FC_RECURSOS_MODULO"(), como em TA_GRUPO_ACESSO_RECURSO."NO_RECURSO".';
comment on column public."TB_SOLICITACAO_ACESSO"."TP_NIVEL" is
  'Nível pedido no módulo (TP_SOLICITACAO = MODULO): leitor, editor ou admin.';
comment on table public."TB_SOLICITACAO_ACESSO" is
  'Pedidos de acesso ao Yeendé, só por aprovação: de quem entrou com Google e não tem perfil ativo (TP_SOLICITACAO = ACESSO) e de quem já tem e pede mais (MODULO, AREA, GRUPO; 20261124210000). Status: pendente, aprovado, recusado, cancelado.';

-- 2. Registrar o pedido de mais acesso -----------------------------------------------------------
create function private."FC_REGISTRAR_AMPLIACAO_ACESSO"(
  p_perfil public."TB_PERFIL_USUARIO", p_tipo text, p_area text, p_recurso text, p_nivel text,
  p_grupo text, p_justificativa text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), p_perfil.email, ''));
  v_tipo text := upper(nullif(btrim(coalesce(p_tipo, '')), ''));
  v_area text := nullif(btrim(coalesce(p_area, '')), '');
  v_recurso text := nullif(btrim(coalesce(p_recurso, '')), '');
  v_nivel text := nullif(btrim(coalesce(p_nivel, '')), '');
  v_grupo text := nullif(btrim(coalesce(p_grupo, '')), '');
  v_justificativa text := btrim(coalesce(p_justificativa, ''));
  v_justificativa_limpa text := btrim(regexp_replace(coalesce(p_justificativa, ''), '\s+', ' ', 'g'));
  v_atual text;
  v_id uuid;
begin
  if exists (select 1 from public."TB_GRUPO_ACESSO" a
              where a."CO_GRUPO_ACESSO" = p_perfil.perfil and a."ST_ADMIN_GLOBAL") then
    raise exception 'O administrador global já tem acesso a tudo.' using errcode = '22023';
  end if;
  if v_tipo is null or v_tipo not in ('MODULO', 'AREA', 'GRUPO') then
    raise exception 'Escolha o que pedir: um módulo com um nível, outra área ou outro grupo.' using errcode = '22023';
  end if;
  if length(v_justificativa_limpa) not between 20 and 2000
     or not private."FC_MOTIVO_PARECE_TEXTO"(v_justificativa_limpa, 3) then
    raise exception 'Explique por que precisa do acesso: de 20 a 2.000 caracteres, com pelo menos 3 palavras.' using errcode = '22023';
  end if;

  if v_tipo = 'MODULO' then
    if v_recurso is null or v_recurso <> all (private."FC_RECURSOS_MODULO"()) then
      raise exception 'Módulo inválido: %', coalesce(v_recurso, '(vazio)') using errcode = '22023';
    end if;
    if v_nivel is null or v_nivel not in ('leitor', 'editor', 'admin') then
      raise exception 'Escolha o nível: Leitor, Editor ou Administrador.' using errcode = '22023';
    end if;
    if v_recurso = 'configuracoes' and v_nivel = 'leitor' then
      raise exception 'Configurações exige Editor ou Administrador.' using errcode = '22023';
    end if;
    if v_recurso in ('acessos', 'recursos_parecer') and v_nivel <> 'editor' then
      raise exception 'Este módulo só tem o nível Editor.' using errcode = '22023';
    end if;
    if v_recurso = 'chat' and v_nivel <> 'leitor' then
      raise exception 'Este módulo só tem o nível Leitor.' using errcode = '22023';
    end if;
    v_atual := private."FC_NIVEL_EFETIVO"(p_perfil.id, p_perfil.perfil, v_recurso);
    if private."FC_RANK_NIVEL"(v_atual) >= private."FC_RANK_NIVEL"(v_nivel) then
      raise exception 'Você já tem esse nível (ou mais) neste módulo.' using errcode = '22023';
    end if;
    v_area := null; v_grupo := null;
  elsif v_tipo = 'AREA' then
    if v_area is null or not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida: %', coalesce(v_area, '(vazia)') using errcode = '22023';
    end if;
    if p_perfil."CO_COORDENACAO" is not null then
      raise exception 'Sua área vem da sua coordenação. Para outra área, fale com o administrador.' using errcode = '22023';
    end if;
    if v_area = any (coalesce(private."FC_AREAS_DO_PERFIL"(p_perfil.id), '{}')) then
      raise exception 'Você já tem acesso a esta área.' using errcode = '22023';
    end if;
    v_recurso := null; v_nivel := null; v_grupo := null;
  else
    if v_grupo is null or not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = v_grupo) then
      raise exception 'Grupo inválido: %', coalesce(v_grupo, '(vazio)') using errcode = '22023';
    end if;
    if exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = v_grupo and a."ST_ADMIN_GLOBAL") then
      raise exception 'O grupo de administrador global não se pede por aqui.' using errcode = '22023';
    end if;
    if v_grupo = p_perfil.perfil then
      raise exception 'Você já está neste grupo.' using errcode = '22023';
    end if;
    v_area := null; v_recurso := null; v_nivel := null;
  end if;

  -- Um pedido pendente por pessoa: enviar de novo troca o pendente.
  update public."TB_SOLICITACAO_ACESSO"
     set "TP_SOLICITACAO" = v_tipo, "NO_RECURSO" = v_recurso, "TP_NIVEL" = v_nivel, "CO_AREA" = v_area,
         perfil_solicitado = coalesce(v_grupo, p_perfil.perfil),
         "CO_COORDENACAO" = p_perfil."CO_COORDENACAO",
         "CO_CARGO_SOLICITADO" = null, "DS_CARGO_OUTRO" = null, setor = null,
         nome = coalesce(nullif(btrim(p_perfil.nome), ''), nome), justificativa = v_justificativa,
         updated_at = now()
   where user_id = v_uid and status = 'pendente'
  returning id into v_id;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente', 'tipo', v_tipo, 'atualizado', true);
  end if;

  insert into public."TB_SOLICITACAO_ACESSO" (user_id, email, nome, justificativa, perfil_solicitado, status,
                                              "CO_COORDENACAO", "CO_AREA", "TP_SOLICITACAO", "NO_RECURSO", "TP_NIVEL")
  values (v_uid, v_email, coalesce(nullif(btrim(p_perfil.nome), ''), v_email), v_justificativa,
          coalesce(v_grupo, p_perfil.perfil), 'pendente',
          p_perfil."CO_COORDENACAO", v_area, v_tipo, v_recurso, v_nivel)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente', 'tipo', v_tipo, 'atualizado', false);
end;
$$;

comment on function private."FC_REGISTRAR_AMPLIACAO_ACESSO"(public."TB_PERFIL_USUARIO", text, text, text, text, text, text) is
  'Pedido de mais acesso de quem já tem perfil ativo (chamada por registrar_solicitacao_acesso): MODULO (nível acima do atual, nas regras da matriz), AREA (sem coordenação, área que ainda não tem) ou GRUPO (outro, menos administrador global). Um pendente por pessoa. Nunca concede acesso.';
revoke all on function private."FC_REGISTRAR_AMPLIACAO_ACESSO"(public."TB_PERFIL_USUARIO", text, text, text, text, text, text) from public, anon, authenticated;

-- 3. registrar_solicitacao_acesso: os parâmetros novos no fim ------------------------------------
drop function public.registrar_solicitacao_acesso(text, text, text, text, text, text, text);

create function public.registrar_solicitacao_acesso(
  p_nome text, p_area text default null, p_cargo text default null, p_cargo_outro text default null,
  p_lotacao text default null, p_justificativa text default null, p_coordenacao text default null,
  p_tipo text default null, p_recurso text default null, p_nivel text default null, p_grupo text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_area text := nullif(btrim(coalesce(p_area, '')), '');
  v_cargo text := nullif(btrim(coalesce(p_cargo, '')), '');
  v_cargo_outro text := nullif(btrim(coalesce(p_cargo_outro, '')), '');
  v_lotacao text := nullif(btrim(coalesce(p_lotacao, '')), '');
  v_justificativa text := btrim(coalesce(p_justificativa, ''));
  v_justificativa_limpa text := btrim(regexp_replace(coalesce(p_justificativa, ''), '\s+', ' ', 'g'));
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_perfil public."TB_PERFIL_USUARIO";
  v_reativacao boolean;
  v_id uuid;
begin
  if v_uid is null or v_email = '' then raise exception 'Usuário não autenticado' using errcode = '42501'; end if;

  -- Quem já tem acesso ativo pede mais acesso (20261124210000).
  v_perfil := private.current_profile();
  if v_perfil.id is not null then
    return private."FC_REGISTRAR_AMPLIACAO_ACESSO"(v_perfil, p_tipo, p_area, p_recurso, p_nivel, p_grupo, p_justificativa);
  end if;
  if upper(coalesce(nullif(btrim(p_tipo), ''), 'ACESSO')) <> 'ACESSO' then
    raise exception 'Pedir mais acesso é para quem já tem acesso ativo.' using errcode = '42501';
  end if;

  if length(v_nome) not between 2 and 120 then
    raise exception 'Informe seu nome completo (2 a 120 caracteres).' using errcode = '22023';
  end if;
  if length(v_justificativa_limpa) not between 20 and 2000
     or not private."FC_MOTIVO_PARECE_TEXTO"(v_justificativa_limpa, 3) then
    raise exception 'Explique por que precisa do acesso: de 20 a 2.000 caracteres, com pelo menos 3 palavras.' using errcode = '22023';
  end if;

  -- Conta desativada pede reativação: o administrador já sabe a área de antes.
  v_reativacao := exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where not u.ativo and (u.user_id = v_uid or lower(u.email) = v_email));

  if v_area is null and not v_reativacao then
    raise exception 'Escolha a área: Projetos, Saúde Indígena ou SEDE.' using errcode = '22023';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;
  if v_area is null then
    v_cargo := null; v_cargo_outro := null; v_lotacao := null;
  else
    if v_cargo is null or private."FC_CARGO_SOLICITACAO_ACESSO"(v_area, v_cargo) is null then
      raise exception 'Escolha o cargo ou a função na lista da área.' using errcode = '22023';
    end if;
    if v_cargo = 'OUTRO' then
      if length(coalesce(v_cargo_outro, '')) not between 3 and 120 then
        raise exception 'Descreva o cargo ou a função (3 a 120 caracteres).' using errcode = '22023';
      end if;
    else
      v_cargo_outro := null;
    end if;
    if v_lotacao is null or length(v_lotacao) > 200 then
      raise exception 'Informe a unidade ou a lotação (até 200 caracteres).' using errcode = '22023';
    end if;
    if v_area = 'saude-indigena' and not exists (
         select 1 from public."TD_UNIDADE" t where t.ativo and t.nome_oficial = v_lotacao) then
      raise exception 'Escolha o DSEI ou a CASAI na lista.' using errcode = '22023';
    end if;
    if v_area = 'projetos' and not exists (
         select 1 from public."TA_UNIDADE_AREA" x where x."CO_AREA" = 'projetos' and x."NO_UNIDADE" = v_lotacao) then
      raise exception 'Escolha o projeto na lista.' using errcode = '22023';
    end if;
  end if;
  if v_coordenacao is not null and not exists (
       select 1 from public."TB_COORDENACAO" c
        where c."CO_COORDENACAO" = v_coordenacao and c."ST_ATIVO"
          and (v_area is null or c."CO_AREA" = v_area)) then
    raise exception 'Coordenação inválida para a área escolhida.' using errcode = '22023';
  end if;

  -- Pedido pendente: editar (a pessoa corrige o que pediu enquanto aguarda). Um pedido de mais
  -- acesso que sobrou de uma conta desativada vira o pedido de entrada.
  update public."TB_SOLICITACAO_ACESSO"
     set nome = v_nome, setor = v_lotacao, justificativa = v_justificativa,
         "CO_AREA" = v_area, "CO_CARGO_SOLICITADO" = v_cargo, "DS_CARGO_OUTRO" = v_cargo_outro,
         "CO_COORDENACAO" = v_coordenacao,
         "TP_SOLICITACAO" = 'ACESSO', "NO_RECURSO" = null, "TP_NIVEL" = null, perfil_solicitado = 'usuario',
         updated_at = now()
   where user_id = v_uid and status = 'pendente'
  returning id into v_id;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente', 'atualizado', true);
  end if;

  insert into public."TB_SOLICITACAO_ACESSO" (user_id, email, nome, setor, justificativa, perfil_solicitado, status,
                                              "CO_COORDENACAO", "CO_AREA", "CO_CARGO_SOLICITADO", "DS_CARGO_OUTRO")
  values (v_uid, v_email, v_nome, v_lotacao, v_justificativa, 'usuario', 'pendente',
          v_coordenacao, v_area, v_cargo, v_cargo_outro)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente', 'atualizado', false);
end;
$$;

comment on function public.registrar_solicitacao_acesso(text, text, text, text, text, text, text, text, text, text, text) is
  'Registra o pedido de acesso de quem está autenticado (área, cargo da lista, lotação, justificativa com 3 palavras) ou, com pedido pendente, o atualiza. Conta desativada (reativação): área opcional. Com perfil ativo, registra o pedido de mais acesso (p_tipo MODULO, AREA ou GRUPO; private."FC_REGISTRAR_AMPLIACAO_ACESSO"). Nunca concede acesso.';
-- Como a de antes: só quem tem login (o Supabase dá EXECUTE a anon e service_role por padrão em função nova).
revoke all on function public.registrar_solicitacao_acesso(text, text, text, text, text, text, text, text, text, text, text) from public, anon, service_role;
grant execute on function public.registrar_solicitacao_acesso(text, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- 4. Aprovar o pedido de mais acesso -------------------------------------------------------------
create function private."FC_APROVAR_AMPLIACAO_ACESSO"(p_solicitacao_id uuid, p_observacao_admin text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_uid uuid := (select auth.uid());
  v_req public."TB_SOLICITACAO_ACESSO";
  v_alvo public."TB_PERFIL_USUARIO";
  v_observacao text := nullif(btrim(coalesce(p_observacao_admin, '')), '');
  v_motivo text;
  v_anterior text;
  v_concedido jsonb;
begin
  select * into v_req from public."TB_SOLICITACAO_ACESSO" where id = p_solicitacao_id for update;
  if v_req.id is null then raise exception 'Solicitação de acesso não encontrada'; end if;
  if v_req.status <> 'pendente' then raise exception 'Solicitação já avaliada (status atual: %)', v_req.status; end if;
  if v_req."TP_SOLICITACAO" not in ('MODULO', 'AREA', 'GRUPO') then
    raise exception 'Não é um pedido de mais acesso';
  end if;
  if v_req.user_id = v_uid or lower(v_req.email) = lower(coalesce((select auth.jwt() ->> 'email'), '')) then
    raise exception 'Outra pessoa deve aprovar o seu pedido' using errcode = '42501';
  end if;

  select * into v_alvo from public."TB_PERFIL_USUARIO" u
   where u.ativo and ((v_req.user_id is not null and u.user_id = v_req.user_id) or lower(u.email) = lower(v_req.email))
   order by case when u.user_id = v_req.user_id then 0 else 1 end, u.updated_at desc
   limit 1
   for update;
  if v_alvo.id is null then
    raise exception 'A conta desta pessoa não está ativa: recuse o pedido' using errcode = '22023';
  end if;
  -- As regras de quem muda quem (a própria conta, a coordenação, outro administrador).
  perform private."FC_EXIGIR_GESTAO_DO_USUARIO"(v_alvo);
  if v_gestor = 'coordenador' and v_req."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
    raise exception 'Solicitação de outra coordenação' using errcode = '42501';
  end if;
  if exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = v_alvo.perfil and a."ST_ADMIN_GLOBAL") then
    raise exception 'O administrador global já tem acesso a tudo: recuse o pedido' using errcode = '22023';
  end if;
  v_motivo := coalesce(v_observacao, 'Pedido de mais acesso aprovado');

  if v_req."TP_SOLICITACAO" = 'MODULO' then
    if v_gestor = 'coordenador' then
      if v_req."NO_RECURSO" = 'acessos' then
        raise exception 'Só o administrador concede Acessos' using errcode = '42501';
      end if;
      if private."FC_RANK_NIVEL"(v_req."TP_NIVEL") > private."FC_RANK_NIVEL"(private."FC_TETO_DO_GESTOR"(v_req."NO_RECURSO")) then
        raise exception 'Você não pode conceder mais do que o seu próprio nível em %', v_req."NO_RECURSO" using errcode = '42501';
      end if;
    end if;
    v_anterior := private."FC_NIVEL_EFETIVO"(v_alvo.id, v_alvo.perfil, v_req."NO_RECURSO");
    if private."FC_RANK_NIVEL"(v_anterior) >= private."FC_RANK_NIVEL"(v_req."TP_NIVEL") then
      raise exception 'A pessoa já tem esse nível (ou mais): recuse o pedido' using errcode = '22023';
    end if;
    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
    values (v_alvo.id, v_req."NO_RECURSO", v_req."TP_NIVEL", v_uid)
    on conflict (perfil_usuario_id, recurso) do update
      set nivel = excluded.nivel, revisao = "TB_PERMISSAO_RECURSO".revisao + 1, updated_at = now(), updated_by = excluded.updated_by;
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    values (v_alvo.id, v_req."NO_RECURSO", v_anterior, v_req."TP_NIVEL", v_uid, v_motivo);
    v_concedido := jsonb_build_object('recurso', v_req."NO_RECURSO", 'nivel', v_req."TP_NIVEL");

  elsif v_req."TP_SOLICITACAO" = 'AREA' then
    if v_gestor <> 'admin' then
      raise exception 'Só o administrador muda as áreas de alguém' using errcode = '42501';
    end if;
    if v_alvo."CO_COORDENACAO" is not null then
      raise exception 'A área desta pessoa vem da coordenação: recuse o pedido ou mude a coordenação' using errcode = '22023';
    end if;
    if v_req."CO_AREA" = any (coalesce(private."FC_AREAS_DO_PERFIL"(v_alvo.id), '{}')) then
      raise exception 'A pessoa já tem esta área: recuse o pedido' using errcode = '22023';
    end if;
    insert into public."RL_PERFIL_USUARIO_AREA"("CO_PERFIL_USUARIO", "CO_AREA") values (v_alvo.id, v_req."CO_AREA");
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    values (v_alvo.id, 'area:' || v_req."CO_AREA", 'sem_acesso', 'leitor', v_uid, v_motivo);
    v_concedido := jsonb_build_object('area', v_req."CO_AREA");

  else
    if not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = v_req.perfil_solicitado and not a."ST_ADMIN_GLOBAL") then
      raise exception 'Grupo inválido: %', v_req.perfil_solicitado;
    end if;
    if not private."FC_GRUPO_CABE_NO_TETO"(v_req.perfil_solicitado) then
      raise exception 'O grupo % dá mais acesso do que você tem', v_req.perfil_solicitado using errcode = '42501';
    end if;
    if v_alvo.perfil = v_req.perfil_solicitado then
      raise exception 'A pessoa já está neste grupo: recuse o pedido' using errcode = '22023';
    end if;
    v_anterior := v_alvo.perfil;
    update public."TB_PERFIL_USUARIO"
       set perfil = v_req.perfil_solicitado, p_config = false, p_admin = false, updated_at = now()
     where id = v_alvo.id;
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    values (v_alvo.id, '#grupo', v_anterior, v_req.perfil_solicitado, v_uid, v_motivo);
    v_concedido := jsonb_build_object('grupo', v_req.perfil_solicitado);
  end if;

  -- As travas da matriz (salvar_matriz_acessos): ninguém fica sem área nem gerencia acessos sem coordenação.
  if cardinality(coalesce(private."FC_AREAS_DO_PERFIL"(v_alvo.id), '{}')) = 0 then
    raise exception 'A pessoa ficaria sem nenhuma área e não veria nada no sistema.' using errcode = '23514';
  end if;
  if v_alvo."CO_COORDENACAO" is null
     and exists (select 1 from public."TB_PERFIL_USUARIO" u
                   join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = u.perfil
                  where u.id = v_alvo.id and not g."ST_ADMIN_GLOBAL"
                    and private."FC_RANK_NIVEL"(private."FC_NIVEL_EFETIVO"(u.id, u.perfil, 'acessos')) >= private."FC_RANK_NIVEL"('editor')) then
    raise exception 'A pessoa gerenciaria acessos sem coordenação. Escolha a coordenação dela antes, em Usuários.' using errcode = '23514';
  end if;

  update public."TB_SOLICITACAO_ACESSO"
     set status = 'aprovado', avaliado_por = v_uid, avaliado_em = now(),
         observacao_admin = v_observacao, updated_at = now()
   where id = v_req.id;

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_alvo.id, 'tipo', v_req."TP_SOLICITACAO",
                            'concedido', v_concedido);
end;
$$;

comment on function private."FC_APROVAR_AMPLIACAO_ACESSO"(uuid, text) is
  'Aprova o pedido de mais acesso (chamada por aprovar_solicitacao_acesso): concede exatamente o pedido (nível do módulo como permissão individual, a área ou o grupo), nas regras e no teto de salvar_matriz_acessos; ninguém aprova o próprio. Registra quem aprovou no pedido e em TH_PERMISSAO_RECURSO.';
revoke all on function private."FC_APROVAR_AMPLIACAO_ACESSO"(uuid, text) from public, anon, authenticated;

-- 5. aprovar_solicitacao_acesso: o pedido de mais acesso vai para a função acima --------------------
create or replace function public.aprovar_solicitacao_acesso(p_solicitacao_id uuid, p_grupo text, p_coordenacao text DEFAULT NULL::text, p_areas text[] DEFAULT NULL::text[], p_observacao_admin text DEFAULT NULL::text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_req public."TB_SOLICITACAO_ACESSO";
  v_perfil_id uuid;
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_admin boolean;
  v_areas text[];
begin
  select * into v_req from public."TB_SOLICITACAO_ACESSO" where id = p_solicitacao_id for update;
  if v_req.id is null then raise exception 'Solicitação de acesso não encontrada'; end if;
  if v_req.status <> 'pendente' then raise exception 'Solicitação já avaliada (status atual: %)', v_req.status; end if;
  -- Pedido de mais acesso (20261124210000): concede só o que foi pedido; grupo, coordenação e áreas daqui não valem.
  if v_req."TP_SOLICITACAO" <> 'ACESSO' then
    return private."FC_APROVAR_AMPLIACAO_ACESSO"(v_req.id, p_observacao_admin);
  end if;
  if not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo) then
    raise exception 'Grupo inválido: %', p_grupo;
  end if;
  v_admin := exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo and a."ST_ADMIN_GLOBAL");

  if v_gestor = 'coordenador' then
    if v_req."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
      raise exception 'Solicitação de outra coordenação' using errcode = '42501';
    end if;
    v_coordenacao := private."FC_COORDENACAO_USUARIO"();
    if not private."FC_GRUPO_CABE_NO_TETO"(p_grupo) then
      raise exception 'O grupo % dá mais acesso do que você tem', p_grupo using errcode = '42501';
    end if;
  end if;

  if v_admin then
    v_coordenacao := null;
  elsif v_coordenacao is not null then
    if not exists (select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = v_coordenacao and c."ST_ATIVO") then
      raise exception 'Coordenação inválida ou desativada';
    end if;
  else
    select coalesce(array_agg(distinct a."CO_AREA"), '{}') into v_areas
      from public."TB_AREA" a where a."CO_AREA" = any (coalesce(p_areas, '{}'));
    if cardinality(v_areas) = 0 then
      raise exception 'Sem coordenação, escolha ao menos uma área';
    end if;
  end if;

  select id into v_perfil_id
    from public."TB_PERFIL_USUARIO"
   where (v_req.user_id is not null and user_id = v_req.user_id) or lower(email) = lower(v_req.email)
   order by case when user_id = v_req.user_id then 0 else 1 end, updated_at desc
   limit 1
   for update;

  if v_perfil_id is null then
    insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, "CO_COORDENACAO", ativo, p_ind, p_cores, p_paineis, p_config, p_admin)
    values (v_req.user_id, v_req.email, coalesce(nullif(btrim(v_req.nome), ''), v_req.email),
            p_grupo, v_coordenacao, true, true, true, true, v_admin, v_admin)
    returning id into v_perfil_id;
  else
    if v_gestor = 'coordenador' and exists (
      select 1 from public."TB_PERFIL_USUARIO" u where u.id = v_perfil_id and u.ativo
         and u."CO_COORDENACAO" is distinct from v_coordenacao) then
      raise exception 'Esta pessoa já tem acesso por outra coordenação' using errcode = '42501';
    end if;
    update public."TB_PERFIL_USUARIO"
       set user_id = coalesce(user_id, v_req.user_id),
           email = v_req.email,
           nome = coalesce(nullif(btrim(v_req.nome), ''), nome, v_req.email),
           perfil = p_grupo,
           "CO_COORDENACAO" = v_coordenacao,
           ativo = true, p_ind = true, p_cores = true, p_paineis = true, p_config = v_admin, p_admin = v_admin,
           updated_at = now()
     where id = v_perfil_id;
  end if;

  if v_areas is not null then
    delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO" = v_perfil_id;
    insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA") select v_perfil_id, unnest(v_areas);
  end if;

  -- Painéis ativos em leitura, como na carga de 23/09 (o grupo decide se vê "Painéis").
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select v_perfil_id, 'painel:' || e.id, 'leitor', (select auth.uid())
    from public."TB_PAINEL_EXTERNO" e
   where e.ativo and (v_gestor = 'admin' or private.pode_recurso('painel:' || e.id))
  on conflict (perfil_usuario_id, recurso) do nothing;

  update public."TB_SOLICITACAO_ACESSO"
     set status = 'aprovado', perfil_solicitado = p_grupo, "CO_COORDENACAO" = coalesce(v_coordenacao, "CO_COORDENACAO"),
         avaliado_por = (select auth.uid()), avaliado_em = now(),
         observacao_admin = nullif(btrim(p_observacao_admin), ''), updated_at = now()
   where id = v_req.id;

  insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
  values (v_perfil_id, '#grupo', '(solicitação)', p_grupo, (select auth.uid()),
          coalesce(nullif(btrim(p_observacao_admin), ''), 'Solicitação de acesso aprovada'));

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_perfil_id, 'grupo', p_grupo, 'coordenacao', v_coordenacao);
end;
$$;

comment on function public.aprovar_solicitacao_acesso(uuid, text, text, text[], text) is
  'Aprova o pedido de acesso: o de entrada cria ou reativa o perfil com o grupo, a coordenação ou as áreas escolhidos; o de mais acesso (MODULO, AREA, GRUPO; 20261124210000) concede só o que foi pedido (private."FC_APROVAR_AMPLIACAO_ACESSO") e ignora p_grupo, p_coordenacao e p_areas.';

-- 6. obter_minha_solicitacao_acesso: com perfil ativo, o pedido de mais acesso ---------------------
create or replace function public.obter_minha_solicitacao_acesso()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('id', s.id, 'status', s.status, 'nome', s.nome, 'setor', s.setor,
                            'justificativa', s.justificativa, 'created_at', s.created_at,
                            'updated_at', s.updated_at, 'avaliado_em', s.avaliado_em,
                            'observacao_admin', s.observacao_admin, 'coordenacao', s."CO_COORDENACAO",
                            'coordenacao_nome', c."NO_COORDENACAO",
                            'area', s."CO_AREA", 'area_nome', a."NO_AREA",
                            'cargo', s."CO_CARGO_SOLICITADO",
                            'cargo_rotulo', private."FC_CARGO_SOLICITACAO_ACESSO"(null, s."CO_CARGO_SOLICITADO"),
                            'cargo_outro', s."DS_CARGO_OUTRO",
                            'motivo_recusa', s."CO_MOTIVO_RECUSA",
                            'tipo', s."TP_SOLICITACAO", 'recurso', s."NO_RECURSO", 'nivel', s."TP_NIVEL",
                            'grupo_solicitado', case when s."TP_SOLICITACAO" = 'GRUPO' then s.perfil_solicitado end,
                            'grupo_solicitado_nome', case when s."TP_SOLICITACAO" = 'GRUPO' then g."NO_GRUPO_ACESSO" end)
    from public."TB_SOLICITACAO_ACESSO" s
    left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
    left join public."TB_AREA" a on a."CO_AREA" = s."CO_AREA"
    left join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = s.perfil_solicitado
   where (s.user_id = (select auth.uid())
          or lower(s.email) = lower(coalesce((select auth.jwt() ->> 'email'), '-')))
     -- Com perfil ativo, só o pedido de mais acesso; sem perfil, só o de entrada (20261124210000).
     and (s."TP_SOLICITACAO" <> 'ACESSO') = ((select p.id from private.current_profile() p) is not null)
   order by (s.status = 'pendente') desc, s.created_at desc
   limit 1;
$$;

comment on function public.obter_minha_solicitacao_acesso() is
  'Último pedido de acesso de quem está autenticado, com área, cargo, lotação (setor), coordenação e motivo da recusa. Com perfil ativo, o último pedido de mais acesso (tipo, módulo, nível, grupo pedido); sem perfil, o último pedido de entrada.';

-- 7. listar_solicitacoes_acesso: o tipo, o pedido e o que a pessoa tem hoje -----------------------
create or replace function public.listar_solicitacoes_acesso(p_status text DEFAULT 'pendente'::text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'user_id', s.user_id, 'email', s.email, 'nome', s.nome, 'setor', s.setor,
      'justificativa', s.justificativa, 'status', s.status, 'created_at', s.created_at,
      'updated_at', s.updated_at,
      'observacao_admin', s.observacao_admin, 'coordenacao', s."CO_COORDENACAO",
      'coordenacao_nome', c."NO_COORDENACAO", 'area', ar."CO_AREA",
      'area_nome', ar."NO_AREA",
      'cargo', s."CO_CARGO_SOLICITADO",
      'cargo_rotulo', private."FC_CARGO_SOLICITACAO_ACESSO"(null, s."CO_CARGO_SOLICITADO"),
      'cargo_outro', s."DS_CARGO_OUTRO",
      'reativacao', p.id is not null,
      'desativada_em', h.alterado_em,
      'desativada_por', h.autor,
      'motivo_desativacao', h.motivo,
      'grupo_anterior', p.perfil,
      'tipo', s."TP_SOLICITACAO",
      'recurso', s."NO_RECURSO",
      'nivel', s."TP_NIVEL",
      'grupo_solicitado', case when s."TP_SOLICITACAO" = 'GRUPO' then s.perfil_solicitado end,
      'grupo_solicitado_nome', case when s."TP_SOLICITACAO" = 'GRUPO' then gs."NO_GRUPO_ACESSO" end,
      'grupo_atual', atual.perfil,
      'grupo_atual_nome', ga."NO_GRUPO_ACESSO",
      'nivel_atual', case when s."TP_SOLICITACAO" = 'MODULO' and atual.id is not null
                          then private."FC_NIVEL_EFETIVO"(atual.id, atual.perfil, s."NO_RECURSO") end,
      'areas_atuais', case when s."TP_SOLICITACAO" <> 'ACESSO' and atual.id is not null
                           then to_jsonb(private."FC_AREAS_DO_PERFIL"(atual.id)) end
    ) order by s.created_at)
      from public."TB_SOLICITACAO_ACESSO" s
      left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
      -- No pedido de entrada, a área do pedido ou a da coordenação; no de mais acesso, só a pedida.
      left join public."TB_AREA" ar on ar."CO_AREA" = case when s."TP_SOLICITACAO" = 'ACESSO'
                                                          then coalesce(s."CO_AREA", c."CO_AREA") else s."CO_AREA" end
      left join public."TB_GRUPO_ACESSO" gs on gs."CO_GRUPO_ACESSO" = s.perfil_solicitado
      -- Pedido de quem tem conta desativada = pedido de reativação (com o histórico).
      left join lateral (
        select u.id, u.perfil from public."TB_PERFIL_USUARIO" u
         where not u.ativo and s."TP_SOLICITACAO" = 'ACESSO'
           and ((s.user_id is not null and u.user_id = s.user_id) or lower(u.email) = lower(s.email))
         order by u.updated_at desc limit 1) p on true
      left join lateral (
        select t.alterado_em, t.motivo,
               (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id = t.alterado_por limit 1) autor
          from public."TH_PERMISSAO_RECURSO" t
         where p.id is not null and t.perfil_usuario_id = p.id and t.recurso = '#conta'
         order by t.alterado_em desc limit 1) h on true
      -- Pedido de mais acesso: o perfil ativo de hoje.
      left join lateral (
        select u.id, u.perfil from public."TB_PERFIL_USUARIO" u
         where u.ativo and s."TP_SOLICITACAO" <> 'ACESSO'
           and ((s.user_id is not null and u.user_id = s.user_id) or lower(u.email) = lower(s.email))
         order by u.updated_at desc limit 1) atual on true
      left join public."TB_GRUPO_ACESSO" ga on ga."CO_GRUPO_ACESSO" = atual.perfil
     where s.status = coalesce(nullif(btrim(p_status), ''), 'pendente')
       and (v_gestor = 'admin' or s."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"())
       -- Ninguém aprova o próprio acesso.
       and s.user_id is distinct from (select auth.uid())
     limit 200), '[]'::jsonb);
end;
$$;

comment on function public.listar_solicitacoes_acesso(text) is
  'Pedidos de acesso (admin global: todos; coordenador: os da própria coordenação), sem os de quem está olhando, com área, cargo, lotação (setor), justificativa e dados da reativação; no pedido de mais acesso, o tipo, o módulo e o nível ou o grupo pedidos e o que a pessoa tem hoje.';

-- 8. listar_opcoes_da_solicitacao_acesso: os grupos que se podem pedir ---------------------------
create or replace function public.listar_opcoes_da_solicitacao_acesso()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', a."CO_AREA", 'nome', a."NO_AREA") order by a."NU_ORDEM")
        from public."TB_AREA" a), '[]'::jsonb),
    'unidades', coalesce((
      select jsonb_agg(u.item order by u.area, u.tipo, u.nome)
        from (
          select 'saude-indigena' as area, t.tipo, t.nome_oficial as nome,
                 jsonb_build_object('area', 'saude-indigena', 'nome', t.nome_oficial, 'sigla', t.sigla, 'tipo', t.tipo) as item
            from public."TD_UNIDADE" t
           where t.ativo
          union all
          select 'projetos', '', x."NO_UNIDADE",
                 jsonb_build_object('area', 'projetos', 'nome', x."NO_UNIDADE", 'sigla', null, 'tipo', null)
            from public."TA_UNIDADE_AREA" x
           where x."CO_AREA" = 'projetos'
        ) u), '[]'::jsonb),
    'coordenacoes', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', c."CO_COORDENACAO", 'nome', c."NO_COORDENACAO", 'area', c."CO_AREA")
                       order by c."NO_COORDENACAO")
        from public."TB_COORDENACAO" c
       where c."ST_ATIVO"), '[]'::jsonb),
    -- Pedir mais acesso (20261124210000): os grupos, só para quem já tem perfil ativo.
    'grupos', case when (select p.id from private.current_profile() p) is null then '[]'::jsonb
                   else coalesce((
                     select jsonb_agg(jsonb_build_object('codigo', g."CO_GRUPO_ACESSO", 'nome', g."NO_GRUPO_ACESSO",
                                                         'descricao', g."DS_GRUPO_ACESSO")
                                      order by g."NU_ORDEM", g."NO_GRUPO_ACESSO")
                       from public."TB_GRUPO_ACESSO" g
                      where not g."ST_ADMIN_GLOBAL"), '[]'::jsonb) end);
end;
$$;

comment on function public.listar_opcoes_da_solicitacao_acesso() is
  'Opções da tela de solicitação de acesso (autenticado, mesmo sem perfil): áreas, unidades (DSEI/CASAI de TD_UNIDADE; projetos de TA_UNIDADE_AREA) e coordenações ativas; com perfil ativo, também os grupos que se podem pedir (sem o de administrador global).';

commit;
