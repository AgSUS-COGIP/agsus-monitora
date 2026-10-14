/*
  AVALIAÇÃO DOCUMENTAL: A FILA CARREGA SÓ O LOTE (O RESTO SOB DEMANDA, EM PÁGINAS)

  Por quê: em 14/10 obter_fila_avaliacao devolvia todos os inscritos do edital
  (114/2026: 7.196 linhas, 3,1 MB de JSON, 0,2 a 1,8 s no banco), e a tela relê
  a fila a cada ficha fechada, a cada "Pegar próximo" e a cada ação da
  coordenação — com ~10 avaliadores ao mesmo tempo em 15/10. Medido em ensaio
  (como usuário, begin … rollback):
    - 5.474 eliminados (2,2 MB) e 480 ranqueados (0,17 MB) iam em toda
      releitura, sem mudar durante a avaliação;
    - para quem é só ANALISTA (o filtro "só as minhas vagas"), a permissão
      private."FC_PODE_ANALISAR_VAGA" era chamada por inscrito: 7.196 chamadas,
      8,2 a 9,0 s — acima do statement_timeout de 8 s do authenticated (a fila
      do analista não abriria).

  O QUE MUDA
    private."FC_NO_NUCLEO_DA_FILA"   (nova, imutável) a regra única da partição:
                                     está no núcleo quem está no lote
                                     (NO_LOTE/ANALISADO) ou tem ficha viva (não
                                     FORA_LOTE). O resto é "fora do lote".
    private."FC_VAGAS_DO_ANALISTA"   (nova) as vagas que o analista analisa, com a
                                     permissão avaliada uma vez por vaga.
    private."FC_LINHAS_DA_FILA"      (nova) as linhas da fila (o mesmo JSON por
                                     inscrito de antes, sem as chaves nulas:
                                     o lote cai de 782 para 398 KB), de uma
                                     das partições, só das vagas permitidas,
                                     em páginas pela chave do inscrito.
    public.obter_fila_avaliacao      mesma assinatura; "candidatos" passa a ser
                                     só o núcleo (114/2026: 1.242 linhas) e
                                     ganha "fora_do_lote": { total, eliminados,
                                     ranqueados, modalidades, versao } (as
                                     contagens das abas e a marca que diz à tela
                                     se a lista de fora mudou). O recorte do
                                     analista vem de FC_VAGAS_DO_ANALISTA.
                                     schema_version 2.
    public.obter_fila_fora_do_lote   (nova) os de fora do lote, em páginas de
                                     até 2.000 (p_apos = o último id da página
                                     anterior); a tela pede só ao abrir
                                     Inscritos, Eliminados, "Incluir por
                                     decisão" ou ao buscar uma ficha pelo
                                     código, e guarda até a "versao" mudar.
  Permissões: as mesmas de antes (FC_EXIGIR_AVALIACAO_EDITAL >= leitor, área,
  recorte da coordenação; o analista vê só as vagas que analisa).

  Ensaio: supabase/ensaios/20261014180000_fila_leve.sql
  Rollback: supabase/rollback/20261014180000_fila_leve.sql
*/
begin;

set local lock_timeout = '10s';

-- 1. A regra da partição (núcleo × fora do lote) ------------------------------------------
create or replace function private."FC_NO_NUCLEO_DA_FILA"(p_situacao_pre text, p_situacao_ficha text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select coalesce(p_situacao_pre in ('NO_LOTE', 'ANALISADO'), false)
      or coalesce(p_situacao_ficha, 'FORA_LOTE') <> 'FORA_LOTE';
$function$;

comment on function private."FC_NO_NUCLEO_DA_FILA"(text, text) is
  'Fila da avaliação documental: o inscrito está no núcleo (vai em toda leitura da fila) quando está no lote (NO_LOTE/ANALISADO) ou tem ficha que não está FORA_LOTE; os outros (eliminados e ranqueados sem ficha viva) vêm sob demanda por obter_fila_fora_do_lote.';

revoke all on function private."FC_NO_NUCLEO_DA_FILA"(text, text) from public, anon, authenticated;

-- 2. As vagas que o analista analisa (a permissão uma vez por vaga) -----------------------
create or replace function private."FC_VAGAS_DO_ANALISTA"(p_edital uuid, p_usuario uuid)
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  -- MATERIALIZED: sem ele o planejador empurra a permissão para dentro do DISTINCT e a
  -- avalia por inscrito (7.196 chamadas no 114/2026, 8,5 s medidos em ensaio).
  with v as materialized (
    select distinct a."CO_VAGA"::text as vaga from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital
    union
    select pv."CO_VAGA"::text from public."TB_PRE_CLASSIF_VAGA" pv where pv."CO_MONITORAMENTO" = p_edital
  )
  select coalesce(array_agg(v.vaga order by v.vaga), '{}')
    from v
   where private."FC_PODE_ANALISAR_VAGA"(p_edital, p_usuario, v.vaga);
$function$;

comment on function private."FC_VAGAS_DO_ANALISTA"(uuid, uuid) is
  'As vagas do edital (da pré-classificação e do quadro da pré-classificação) que o usuário analisa (FC_PODE_ANALISAR_VAGA avaliada uma vez por vaga). Usada pela fila da avaliação documental para o recorte do analista.';

revoke all on function private."FC_VAGAS_DO_ANALISTA"(uuid, uuid) from public, anon, authenticated;

-- 3. As linhas da fila (uma partição, vagas permitidas, em páginas) -----------------------
create or replace function private."FC_LINHAS_DA_FILA"(
  p_edital uuid,
  p_vagas text[],
  p_nucleo boolean,
  p_apos uuid,
  p_limite integer
)
returns table (id uuid, vaga text, eliminado boolean, posicao integer, codigo text, linha json)
language sql
stable
security definer
set search_path to ''
as $function$
  -- p_vagas nulo = todas as vagas; p_limite nulo = sem limite (o núcleo vem inteiro).
  select a."CO_EMPREGARE_CANDIDATO",
         a."CO_VAGA"::text,
         a."TP_SITUACAO" = 'ELIMINADO',
         a."NU_POSICAO",
         c."CO_CANDIDATO_EMPREGARE"::text,
         -- Sem as chaves nulas (a tela trata ausente como nulo): o JSON do lote cai pela metade.
         json_strip_nulls(json_build_object(
           'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA", 'codigo', c."CO_CANDIDATO_EMPREGARE",
           'nome', c."NO_CANDIDATO", 'situacao_pre', a."TP_SITUACAO", 'motivo_eliminacao', a."DS_MOTIVO_ELIMINACAO",
           'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM",
           'modalidade', a."NO_MODALIDADE", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'entrada', a."TP_ENTRADA_LOTE",
           'decisao', case when a."TP_ENTRADA_LOTE" = 'DECISAO' then a."DS_MOTIVO_ENTRADA" end,
           'ficha', case when f."CO_FICHA_ANALISE" is null then null else json_build_object(
             'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'situacao', f."TP_SITUACAO",
             'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
             'atribuida_em', f."DT_ATRIBUICAO", 'motivo_saida', f."DS_MOTIVO_SAIDA", 'lote', f."NU_LOTE",
             'resultado', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."TP_RESULTADO" end,
             'nota_final', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."VL_NOTA_FINAL" end,
             'concluida_em', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."DT_CONCLUSAO" end,
             'rascunho_em', f."DT_RASCUNHO",
             'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
               'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
               'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end) end))
    from public."TB_PRE_CLASSIFICACAO" a
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    left join public."TB_FICHA_ANALISE" f
      on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
    left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
   where a."CO_MONITORAMENTO" = p_edital
     and (p_vagas is null or a."CO_VAGA" = any (p_vagas))
     and private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO") = p_nucleo
     and (p_apos is null or a."CO_EMPREGARE_CANDIDATO" > p_apos)
   order by a."CO_EMPREGARE_CANDIDATO"
   limit p_limite;
$function$;

comment on function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer) is
  'Linhas da fila da avaliação documental (o JSON de cada inscrito, sem as chaves nulas, com a ficha, a reserva vigente e a decisão da coordenação), de uma partição (p_nucleo: FC_NO_NUCLEO_DA_FILA), das vagas p_vagas (nulo = todas), em ordem do id do inscrito, depois de p_apos e até p_limite (nulo = sem limite). Sem conferência de permissão: quem chama confere.';

revoke all on function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer) from public, anon, authenticated;

-- 4. A fila: o núcleo e as contagens de fora do lote --------------------------------------
create or replace function public.obter_fila_avaliacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_so_minhas_vagas boolean := coalesce(v_papel, '') = 'ANALISTA';
  v_vagas text[];
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  -- O analista vê só as vagas que analisa: a permissão é avaliada uma vez por vaga (não por inscrito).
  if v_so_minhas_vagas then
    v_vagas := private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid);
  end if;
  return json_build_object(
    'schema_version', 2,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'area', v_area,
                                'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_pegar', private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, null),
    'eu', v_uid,
    'prazo_reserva_min', extract(epoch from private."FC_PRAZO_RESERVA_FICHA"())::integer / 60,
    'distribuicao', private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital),
    'sem_ficha', (select count(*) from public."TB_PRE_CLASSIFICACAO" p
                   where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
                     and not exists (select 1 from public."TB_FICHA_ANALISE" f
                                      where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")),
    'vagas', coalesce((
      select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO")
                      order by pv."CO_VAGA")
        from public."TB_PRE_CLASSIF_VAGA" pv
       where pv."CO_MONITORAMENTO" = p_edital
         and (v_vagas is null or pv."CO_VAGA" = any (v_vagas))), '[]'::json),
    'analistas', private."FC_ANALISTAS_DO_EDITAL"(p_edital, true),
    'filtros', private."FC_FILTROS_FILA_JSON"(v_uid),
    'fora_do_lote', (
      select json_build_object(
               'total', count(*),
               'eliminados', count(*) filter (where a."TP_SITUACAO" = 'ELIMINADO'),
               'ranqueados', count(*) filter (where a."TP_SITUACAO" = 'RANQUEADO'),
               'modalidades', coalesce(json_agg(distinct a."NO_MODALIDADE") filter (where a."NO_MODALIDADE" is not null), '[]'::json),
               -- Muda quando a pré-classificação ou uma ficha de fora do lote muda: a tela relê a lista de fora.
               'versao', md5(concat_ws('|', count(*), max(a."DT_ATUALIZACAO"), max(f."NU_VERSAO"), sum(f."NU_VERSAO"),
                                       count(f."CO_FICHA_ANALISE"), max(f."DT_RESERVA_EXPIRA"))))
        from public."TB_PRE_CLASSIFICACAO" a
        left join public."TB_FICHA_ANALISE" f
          on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
       where a."CO_MONITORAMENTO" = p_edital
         and (v_vagas is null or a."CO_VAGA" = any (v_vagas))
         and not private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO")),
    'candidatos', coalesce((
      select json_agg(l.linha order by l.vaga, l.eliminado, l.posicao, l.codigo)
        from private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, true, null, null) l), '[]'::json)
  );
end;
$function$;

comment on function public.obter_fila_avaliacao(uuid) is
  'A fila da avaliação documental do edital (json, schema_version 2): papel de quem está logado (coordena, pode pegar), a distribuição da regra, os inscritos do núcleo (no lote ou com ficha viva: FC_NO_NUCLEO_DA_FILA) com a entrada no lote, o motivo da decisão da coordenação e a ficha (situação, responsável, reserva vigente, versão, rascunho e, concluída, resultado e nota; nome do candidato, sem CPF nem contato), as contagens e a versão dos de fora do lote (fora_do_lote; as linhas vêm de obter_fila_fora_do_lote), as vagas, os analistas com as pendentes, quantos do lote ainda estão sem ficha e os filtros salvos de quem chama. O analista vê só as vagas que analisa (permissão avaliada por vaga). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

revoke all on function public.obter_fila_avaliacao(uuid) from public, anon;
grant execute on function public.obter_fila_avaliacao(uuid) to authenticated;

-- 5. Os de fora do lote, sob demanda e em páginas -----------------------------------------
create or replace function public.obter_fila_fora_do_lote(
  p_edital uuid,
  p_apos uuid default null,
  p_limite integer default 1000
)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_limite integer := least(greatest(coalesce(p_limite, 1000), 1), 2000);
  v_vagas text[];
  v_linhas json;
  v_ultimo uuid;
  v_n integer;
begin
  if coalesce(v_papel, '') = 'ANALISTA' then
    v_vagas := private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid);
  end if;
  select coalesce(json_agg(l.linha order by l.id), '[]'::json), max(l.id::text)::uuid, count(*)
    into v_linhas, v_ultimo, v_n
    from private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, false, p_apos, v_limite) l;
  return json_build_object(
    'schema_version', 1,
    'edital', p_edital,
    'area', v_area,
    'candidatos', v_linhas,
    -- Página cheia: pode haver mais (a próxima chamada passa p_apos = proximo).
    'proximo', case when v_n = v_limite then v_ultimo end
  );
end;
$function$;

comment on function public.obter_fila_fora_do_lote(uuid, uuid, integer) is
  'Os inscritos de fora do lote na fila da avaliação documental (eliminados e ranqueados sem ficha viva: FC_NO_NUCLEO_DA_FILA), no mesmo formato de obter_fila_avaliacao, em páginas de até 2.000 em ordem do id do inscrito: p_apos = o "proximo" da página anterior (nulo na primeira); "proximo" nulo = acabou. O analista vê só as vagas que analisa. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

revoke all on function public.obter_fila_fora_do_lote(uuid, uuid, integer) from public, anon;
grant execute on function public.obter_fila_fora_do_lote(uuid, uuid, integer) to authenticated;

commit;
