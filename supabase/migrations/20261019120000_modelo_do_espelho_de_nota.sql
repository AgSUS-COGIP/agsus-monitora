/*
  MODELO DO ESPELHO DE NOTA, POR EDITAL

  Por quê: os textos da folha do espelho de nota (título, subtítulo, saudação,
  abertura, nomes dos quadros, rótulos das notas, "Não se aplica" do
  eliminado, "Sem observação registrada." e rodapé) estavam no código; mudar
  uma palavra pedia deploy. A coordenação passa a ajustá-los por edital, como
  os modelos da carta de convocação e da resposta de recurso, e o espelho da
  ficha, os em massa, a impressão e o PDF/ZIP usam o modelo na hora.
  O CONTEÚDO não se edita: quem aparece, as notas, os critérios e as
  justificativas continuam só da montagem
  (src/lib/avaliacao-documental/espelho-de-nota.ts).

  O QUE MUDA
    1. public."TB_MODELO_ESPELHO_NOTA": um modelo por edital (UK no edital),
       com a versão vigente e DS_TEXTOS = só o que difere do padrão do código
       ({} = o padrão; "Restaurar padrão" grava {}). Sem linha = padrão.
    2. public."TH_MODELO_ESPELHO_NOTA": cada versão salva (os textos, SALVAR ou
       RESTAURAR, quem e quando). Imutável; nada se apaga.
    3. private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(textos): as mesmas regras de
       validarModeloDoEspelho (src/lib/avaliacao-documental/modelo-do-espelho.ts):
       só as chaves conhecidas, textos dentro do limite, vazio só em subtitulo,
       abertura e rodape, {candidato} só na saudação (obrigatório) e na
       abertura, nenhum outro marcador entre chaves, mostrar_autodeclarada
       booleano. Recusa com 22023.
    4. public.obter_modelo_espelho_nota(edital): o modelo (versão 0 e {} quando
       não há), quando e quem salvou e pode_editar. Para todos da avaliação
       documental do edital (Leitor ou mais: o botão "Espelho de nota" da ficha
       é de todos).
    5. public.salvar_modelo_espelho_nota(edital, textos, versão aberta): só a
       coordenação do edital (FC_EXIGIR_COORD_AVALIACAO, 42501), com a versão
       que a tela abriu (outra = PT409, sem repetição no PostgREST, como
       20261016160000). Grava a versão nova e o histórico.

  Não mexe em nenhuma tabela ou função existente.

  Ensaio: supabase/ensaios/20261019120000_modelo_do_espelho_de_nota.sql
  Rollback: supabase/rollback/20261019120000_modelo_do_espelho_de_nota.sql
*/

begin;

set local lock_timeout = '5s';

-- 1. O modelo vigente de cada edital ------------------------------------------------------------
create table public."TB_MODELO_ESPELHO_NOTA" (
  "CO_MODELO_ESPELHO_NOTA" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "NU_VERSAO" integer not null default 1,
  "DS_TEXTOS" jsonb not null default '{}'::jsonb,
  "CO_USUARIO_CRIACAO" uuid not null,
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_MODELO_ESPELHO_NOTA" primary key ("CO_MODELO_ESPELHO_NOTA"),
  constraint "UK_MODELOESPELHO_EDITAL" unique ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_MODELOESPELHO" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_MODELOESPELHO_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_MODELOESPELHO_TEXTOS" check (
    jsonb_typeof("DS_TEXTOS") = 'object' and pg_column_size("DS_TEXTOS") <= 32768)
);
comment on table public."TB_MODELO_ESPELHO_NOTA" is
  'Modelo do espelho de nota da avaliação documental, um por edital: os textos da folha que a coordenação ajusta (título, subtítulo, saudação, abertura, nomes dos quadros, rótulos das notas, "Não se aplica", "Sem observação registrada.", rodapé e se a nota autodeclarada aparece). Só textos: o conteúdo do espelho é da montagem no front. Sem linha = o padrão do código. Cada versão em TH_MODELO_ESPELHO_NOTA. Desde 20261019120000.';
comment on column public."TB_MODELO_ESPELHO_NOTA"."CO_MODELO_ESPELHO_NOTA" is 'Identificador do modelo.';
comment on column public."TB_MODELO_ESPELHO_NOTA"."CO_MONITORAMENTO" is 'Edital do modelo (TB_MONITORAMENTO_INDIGENA.id); um modelo por edital.';
comment on column public."TB_MODELO_ESPELHO_NOTA"."NU_VERSAO" is 'Versão vigente (TH_MODELO_ESPELHO_NOTA.NU_VERSAO). Salvar cria a próxima; a tela manda a que abriu (concorrência otimista, PT409).';
comment on column public."TB_MODELO_ESPELHO_NOTA"."DS_TEXTOS" is 'Só os textos que diferem do padrão do código (chaves de FC_VALIDAR_MODELO_ESPELHO_NOTA); {} = o padrão (Restaurar padrão). Até 32 KB.';
comment on column public."TB_MODELO_ESPELHO_NOTA"."CO_USUARIO_CRIACAO" is 'Quem salvou a primeira versão (auth.users.id).';
comment on column public."TB_MODELO_ESPELHO_NOTA"."CO_USUARIO_ATUALIZACAO" is 'Quem salvou a versão vigente (auth.users.id).';
comment on column public."TB_MODELO_ESPELHO_NOTA"."DT_CRIACAO" is 'Primeira versão.';
comment on column public."TB_MODELO_ESPELHO_NOTA"."DT_ATUALIZACAO" is 'Versão vigente.';
comment on constraint "PK_TB_MODELO_ESPELHO_NOTA" on public."TB_MODELO_ESPELHO_NOTA" is 'Identificador do modelo.';
comment on constraint "UK_MODELOESPELHO_EDITAL" on public."TB_MODELO_ESPELHO_NOTA" is 'Um modelo por edital (o índice também serve à chave estrangeira).';
comment on constraint "FK_MONITORAMENTO_MODELOESPELHO" on public."TB_MODELO_ESPELHO_NOTA" is 'Edital do modelo (MODELOESPELHO = MODELO_ESPELHO_NOTA).';
comment on constraint "CK_MODELOESPELHO_NUVERSAO" on public."TB_MODELO_ESPELHO_NOTA" is 'Versões começam em 1.';
comment on constraint "CK_MODELOESPELHO_TEXTOS" on public."TB_MODELO_ESPELHO_NOTA" is 'Os textos são um objeto JSON de até 32 KB (o conteúdo é validado por FC_VALIDAR_MODELO_ESPELHO_NOTA).';
comment on index public."UK_MODELOESPELHO_EDITAL" is 'Um modelo por edital; leitura do modelo pelo edital.';

-- 2. Cada versão salva ----------------------------------------------------------------------------
create table public."TH_MODELO_ESPELHO_NOTA" (
  "CO_MODELO_ESPELHO_NOTA" uuid not null,
  "NU_VERSAO" integer not null,
  "DS_TEXTOS" jsonb not null,
  "TP_ACAO" varchar(10) not null,
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_MODELO_ESPELHO_NOTA" primary key ("CO_MODELO_ESPELHO_NOTA", "NU_VERSAO"),
  constraint "FK_MODELOESPELHO_THMODELOESPELHO" foreign key ("CO_MODELO_ESPELHO_NOTA")
    references public."TB_MODELO_ESPELHO_NOTA" ("CO_MODELO_ESPELHO_NOTA"),
  constraint "CK_THMODELOESPELHO_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_THMODELOESPELHO_ACAO" check ("TP_ACAO" in ('SALVAR', 'RESTAURAR')),
  constraint "CK_THMODELOESPELHO_TEXTOS" check (jsonb_typeof("DS_TEXTOS") = 'object')
);
comment on table public."TH_MODELO_ESPELHO_NOTA" is
  'Histórico imutável do modelo do espelho de nota: cada versão salva, com os textos (só as diferenças do padrão), a ação (SALVAR ou RESTAURAR = voltou ao padrão), quem e quando. Desde 20261019120000.';
comment on column public."TH_MODELO_ESPELHO_NOTA"."CO_MODELO_ESPELHO_NOTA" is 'Modelo (TB_MODELO_ESPELHO_NOTA).';
comment on column public."TH_MODELO_ESPELHO_NOTA"."NU_VERSAO" is 'Versão salva (1, 2, …).';
comment on column public."TH_MODELO_ESPELHO_NOTA"."DS_TEXTOS" is 'Os textos dessa versão (só o que difere do padrão do código; {} = o padrão).';
comment on column public."TH_MODELO_ESPELHO_NOTA"."TP_ACAO" is 'SALVAR (textos ajustados) ou RESTAURAR (voltou ao padrão: DS_TEXTOS = {}).';
comment on column public."TH_MODELO_ESPELHO_NOTA"."CO_USUARIO" is 'Quem salvou (auth.users.id).';
comment on column public."TH_MODELO_ESPELHO_NOTA"."DT_REGISTRO" is 'Quando salvou.';
comment on constraint "PK_TH_MODELO_ESPELHO_NOTA" on public."TH_MODELO_ESPELHO_NOTA" is 'Uma linha por versão do modelo (o índice também serve à chave estrangeira).';
comment on constraint "FK_MODELOESPELHO_THMODELOESPELHO" on public."TH_MODELO_ESPELHO_NOTA" is 'Modelo da versão.';
comment on constraint "CK_THMODELOESPELHO_NUVERSAO" on public."TH_MODELO_ESPELHO_NOTA" is 'Versões começam em 1.';
comment on constraint "CK_THMODELOESPELHO_ACAO" on public."TH_MODELO_ESPELHO_NOTA" is 'Ação SALVAR ou RESTAURAR.';
comment on constraint "CK_THMODELOESPELHO_TEXTOS" on public."TH_MODELO_ESPELHO_NOTA" is 'Os textos são um objeto JSON.';
comment on index public."PK_TH_MODELO_ESPELHO_NOTA" is 'Versões de um modelo, em ordem.';

alter table public."TB_MODELO_ESPELHO_NOTA" enable row level security;
alter table public."TH_MODELO_ESPELHO_NOTA" enable row level security;
revoke all on public."TB_MODELO_ESPELHO_NOTA", public."TH_MODELO_ESPELHO_NOTA" from public, anon, authenticated;

-- 3. A validação dos textos (as mesmas regras de validarModeloDoEspelho) --------------------------
create or replace function private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(p_textos jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $function$
declare
  -- chave: [pode ficar vazio, máximo de caracteres]
  v_campos constant jsonb := '{
    "titulo": [false, 200], "subtitulo": [true, 300], "saudacao": [false, 300], "abertura": [true, 2000],
    "secao_dados": [false, 120], "secao_notas": [false, 120], "secao_criterios": [false, 120],
    "secao_justificativas": [false, 120], "rotulo_autodeclarada": [false, 150],
    "rotulo_consolidada": [false, 150], "nao_se_aplica": [false, 300], "sem_observacao": [false, 300],
    "rodape": [true, 2000]
  }'::jsonb;
  v_chave text;
  v_valor jsonb;
  v_campo jsonb;
  v_texto text;
begin
  if jsonb_typeof(p_textos) is distinct from 'object' then
    raise exception 'Os textos do modelo do espelho devem ser um objeto JSON' using errcode = '22023';
  end if;
  for v_chave, v_valor in select e.key, e.value from jsonb_each(p_textos) e loop
    if v_chave = 'mostrar_autodeclarada' then
      if jsonb_typeof(v_valor) <> 'boolean' then
        raise exception 'mostrar_autodeclarada deve ser verdadeiro ou falso' using errcode = '22023';
      end if;
      continue;
    end if;
    v_campo := v_campos -> v_chave;
    if v_campo is null then
      raise exception 'Campo desconhecido no modelo do espelho: %', v_chave using errcode = '22023';
    end if;
    if jsonb_typeof(v_valor) <> 'string' then
      raise exception 'O campo % do modelo do espelho precisa ser um texto', v_chave using errcode = '22023';
    end if;
    v_texto := regexp_replace(v_valor #>> '{}', '^\s+|\s+$', '', 'g');
    if v_texto = '' and not (v_campo ->> 0)::boolean then
      raise exception 'O campo % do modelo do espelho não pode ficar vazio', v_chave using errcode = '22023';
    end if;
    if length(v_texto) > (v_campo ->> 1)::integer then
      raise exception 'O campo % do modelo do espelho vai até % caracteres', v_chave, v_campo ->> 1
        using errcode = '22023';
    end if;
    if v_texto ~ '\{(?!candidato\})[^{}]*\}' then
      raise exception 'Só o marcador {candidato} é aceito (campo %)', v_chave using errcode = '22023';
    end if;
    if v_chave not in ('saudacao', 'abertura') and strpos(v_texto, '{candidato}') > 0 then
      raise exception '{candidato} só na saudação e na abertura (campo %)', v_chave using errcode = '22023';
    end if;
    if v_chave = 'saudacao' and strpos(v_texto, '{candidato}') = 0 then
      raise exception 'A saudação precisa de {candidato} (o nome do candidato)' using errcode = '22023';
    end if;
  end loop;
end;
$function$;
comment on function private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(jsonb) is
  'Valida os textos do modelo do espelho de nota com as regras de validarModeloDoEspelho (src/lib/avaliacao-documental/modelo-do-espelho.ts): chaves conhecidas, limites, vazio só em subtitulo/abertura/rodape, {candidato} só na saudação (obrigatório) e na abertura, nenhum outro marcador, mostrar_autodeclarada booleano. Recusa com 22023. Desde 20261019120000.';
revoke all on function private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(jsonb) from public, anon, authenticated;

-- 4. Ler o modelo do edital (todos da avaliação documental do edital) ------------------------------
create or replace function public.obter_modelo_espelho_nota(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_modelo public."TB_MODELO_ESPELHO_NOTA";
begin
  perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  select * into v_modelo from public."TB_MODELO_ESPELHO_NOTA" m where m."CO_MONITORAMENTO" = p_edital;
  return json_build_object(
    'versao', coalesce(v_modelo."NU_VERSAO", 0),
    'textos', coalesce(v_modelo."DS_TEXTOS", '{}'::jsonb),
    'atualizado_em', v_modelo."DT_ATUALIZACAO",
    'atualizado_por', (select private."FC_NOME_E_SOBRENOME"(p.nome)
                         from public."TB_PERFIL_USUARIO" p
                        where p.user_id = v_modelo."CO_USUARIO_ATUALIZACAO"
                        limit 1),
    'pode_editar', coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false));
end;
$function$;
comment on function public.obter_modelo_espelho_nota(uuid) is
  'Modelo do espelho de nota do edital (20261019120000): versao (0 = nunca salvo), textos (só as diferenças do padrão do código; {} = padrão), atualizado_em, atualizado_por (nome e sobrenome do cadastro) e pode_editar (coordenação do edital). Para todos da avaliação documental do edital (FC_EXIGIR_AVALIACAO_EDITAL nível 1), porque o espelho da ficha usa o modelo. Não grava nada.';
revoke all on function public.obter_modelo_espelho_nota(uuid) from public, anon;
grant execute on function public.obter_modelo_espelho_nota(uuid) to authenticated;

-- 5. Salvar (só a coordenação, com a versão que a tela abriu) --------------------------------------
create or replace function public.salvar_modelo_espelho_nota(
  p_edital uuid,
  p_textos jsonb,
  p_versao_atual integer
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_textos jsonb := coalesce(p_textos, '{}'::jsonb);
  v_modelo public."TB_MODELO_ESPELHO_NOTA";
  v_existe boolean;
begin
  perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  perform private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(v_textos);
  if p_versao_atual is null or p_versao_atual < 0 then
    raise exception 'Versão aberta do modelo inválida' using errcode = '22023';
  end if;

  -- Um salvamento por edital de cada vez (a primeira versão ainda não tem linha para travar).
  perform pg_advisory_xact_lock(hashtextextended('TB_MODELO_ESPELHO_NOTA|' || p_edital::text, 0));
  select * into v_modelo from public."TB_MODELO_ESPELHO_NOTA" m
   where m."CO_MONITORAMENTO" = p_edital
   for update;
  v_existe := found;

  -- Concorrência: a versão que a tela abriu tem de ser a vigente (0 = nunca salvo).
  if coalesce(v_modelo."NU_VERSAO", 0) <> p_versao_atual then
    raise exception using errcode = 'PT409',
      message = 'O modelo do espelho foi alterado por outra pessoa. Recarregue e tente de novo.';
  end if;
  if coalesce(v_modelo."DS_TEXTOS", '{}'::jsonb) = v_textos then
    raise exception 'O modelo do espelho não mudou' using errcode = '22023';
  end if;

  if v_existe then
    update public."TB_MODELO_ESPELHO_NOTA" m
       set "NU_VERSAO" = m."NU_VERSAO" + 1, "DS_TEXTOS" = v_textos,
           "CO_USUARIO_ATUALIZACAO" = auth.uid(), "DT_ATUALIZACAO" = now()
     where m."CO_MODELO_ESPELHO_NOTA" = v_modelo."CO_MODELO_ESPELHO_NOTA"
    returning * into v_modelo;
  else
    insert into public."TB_MODELO_ESPELHO_NOTA"
      ("CO_MONITORAMENTO", "NU_VERSAO", "DS_TEXTOS", "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_textos, auth.uid(), auth.uid())
    returning * into v_modelo;
  end if;
  insert into public."TH_MODELO_ESPELHO_NOTA"
    ("CO_MODELO_ESPELHO_NOTA", "NU_VERSAO", "DS_TEXTOS", "TP_ACAO", "CO_USUARIO")
  values (v_modelo."CO_MODELO_ESPELHO_NOTA", v_modelo."NU_VERSAO", v_textos,
          case when v_textos = '{}'::jsonb then 'RESTAURAR' else 'SALVAR' end, auth.uid());

  return public.obter_modelo_espelho_nota(p_edital);
end;
$function$;
comment on function public.salvar_modelo_espelho_nota(uuid, jsonb, integer) is
  'Salva o modelo do espelho de nota do edital (20261019120000): p_textos = só as diferenças do padrão ({} = Restaurar padrão), validados por FC_VALIDAR_MODELO_ESPELHO_NOTA (22023); p_versao_atual = a versão que a tela abriu (0 = nunca salvo; outra = PT409). Só a coordenação do edital (FC_EXIGIR_COORD_AVALIACAO, 42501). Grava a versão nova em TB_MODELO_ESPELHO_NOTA e TH_MODELO_ESPELHO_NOTA e devolve obter_modelo_espelho_nota.';
revoke all on function public.salvar_modelo_espelho_nota(uuid, jsonb, integer) from public, anon;
grant execute on function public.salvar_modelo_espelho_nota(uuid, jsonb, integer) to authenticated;

commit;
