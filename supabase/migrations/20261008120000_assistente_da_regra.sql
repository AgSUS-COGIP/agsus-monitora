/*
  AVALIAÇÃO DOCUMENTAL: ASSISTENTE DA REGRA E DUPLA CONFERÊNCIA

  O assistente "Nova regra" / "Editar regra" da aba Regra
  (src/modulos/avaliacao-documental/assistente/, regras em
  src/lib/avaliacao-documental/assistente-da-regra.ts) é uma interface sobre o
  MESMO JSON da regra: salva pelo salvar_regra_analise de sempre (versão nova
  com motivo) e grava a nota mínima e o desempate pelo
  salvar_regra_classificacao de sempre, com a permissão dela. Esta migration
  só acrescenta o que o assistente precisa ler e a dupla conferência.

  O QUE MUDA
    public.obter_apoio_regra_analise(p_edital)   NOVA, só leitura: o que o
        assistente lê de uma vez —
          perguntas_por_vaga  os nomes das colunas "Pergunta N - …" da última
                              carga de CADA vaga do edital (o número da mesma
                              pergunta muda de vaga para vaga; o casamento é
                              por vaga). Só nomes de coluna: nenhuma resposta.
          regras_da_area      as regras CONFERIDAS dos outros editais da mesma
                              área que a pessoa vê (para copiar), só para a
                              coordenação do edital.
          classificacao       a regra de classificação vigente do edital
                              (nota mínima, desempate) para quem lê a
                              Classificação, e se pode gravá-la (Editor).
        Leitor da Avaliação documental, com a área e o recorte da coordenação.
    public.conferir_regra_analise(p_edital, p_versao)   DUPLA CONFERÊNCIA:
        quem salvou a versão vigente não pode marcá-la como conferida (42501,
        com a mensagem), a não ser o administrador global, que pode tudo.
    private."FC_REGRA_ANALISE_JSON"(p_edital)   + conferir_pede_outra_pessoa:
        quem está logado salvou a versão vigente e não é administrador global
        (a tela trava o botão e diz por quê).

  QUEM CRIA E EDITA (sem mudança): a coordenação do edital — o gestor do
  edital (grupo edital_gestor com Administrador em avaliacao_documental, que
  vê o edital pela área e pela coordenação), quem está como Coordenação na
  equipe e o administrador global (FC_EXIGIR_COORD_AVALIACAO, 20261006100000).

  PRÉ-REQUISITO: 20261006100000_regra_da_analise.sql e
  20261002150000_classificacao.sql aplicadas.

  Ensaio: supabase/ensaios/20261008120000_assistente_da_regra.sql
  Rollback: supabase/rollback/20261008120000_assistente_da_regra.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.conferir_regra_analise(uuid, integer)') is null
     or to_regprocedure('private."FC_REGRA_ANALISE_JSON"(uuid)') is null then
    raise exception 'Aplique antes 20261006100000_regra_da_analise.sql.';
  end if;
  if to_regprocedure('public.salvar_regra_classificacao(uuid, jsonb, integer, text)') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
end;
$$;

-- 1. A regra vigente diz se quem está logado precisa de outra pessoa para conferir -----
create or replace function private."FC_REGRA_ANALISE_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'versao', r."NU_VERSAO_VIGENTE",
           'situacao', r."TP_SITUACAO",
           'modelo_origem', r."CO_MODELO_ORIGEM",
           'configuracao', v."DS_CONFIGURACAO",
           'hash', v."DS_HASH",
           'atualizado_em', v."DT_CRIACAO",
           'por', coalesce(p.nome, p.email),
           'conferida_em', r."DT_CONFERENCIA",
           'conferida_por', coalesce(pc.nome, pc.email),
           'conferir_pede_outra_pessoa',
             coalesce(v."CO_USUARIO" = (select auth.uid()), false) and not private.is_master(),
           'versoes', coalesce((
             select json_agg(json_build_object(
                      'versao', h."NU_VERSAO", 'em', h."DT_CRIACAO", 'por', coalesce(pu.nome, pu.email),
                      'motivo', h."DS_MOTIVO", 'hash', h."DS_HASH", 'configuracao', h."DS_CONFIGURACAO")
                    order by h."NU_VERSAO" desc)
               from public."TH_REGRA_ANALISE" h
               left join public."TB_PERFIL_USUARIO" pu on pu.user_id = h."CO_USUARIO"
              where h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE"), '[]'::json))
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" v
      on v."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and v."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    left join public."TB_PERFIL_USUARIO" p on p.user_id = v."CO_USUARIO"
    left join public."TB_PERFIL_USUARIO" pc on pc.user_id = r."CO_USUARIO_CONFERENCIA"
   where r."CO_MONITORAMENTO" = p_edital;
$function$;
comment on function private."FC_REGRA_ANALISE_JSON"(uuid) is
  'Regra da avaliação vigente do edital (versão, situação, configuração, hash, quem e quando, conferência, e se quem está logado precisa de outra pessoa para conferir: salvou a versão vigente e não é administrador global) e o histórico de versões; null sem regra.';
revoke all on function private."FC_REGRA_ANALISE_JSON"(uuid) from public, anon, authenticated;

-- 2. Dupla conferência ------------------------------------------------------------------
create or replace function public.conferir_regra_analise(p_edital uuid, p_versao integer)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_ANALISE";
  v_autor uuid;
begin
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); confira de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
  end if;
  if v_regra."TP_SITUACAO" <> 'CONFERIDA' then
    select h."CO_USUARIO" into v_autor
      from public."TH_REGRA_ANALISE" h
     where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";
    if v_autor = (select auth.uid()) and not private.is_master() then
      raise exception 'Dupla conferência: quem salvou a versão % não pode conferi-la. Peça a outra pessoa da coordenação do edital.', v_regra."NU_VERSAO_VIGENTE"
        using errcode = '42501';
    end if;
    update public."TB_REGRA_ANALISE"
       set "TP_SITUACAO" = 'CONFERIDA', "CO_USUARIO_CONFERENCIA" = (select auth.uid()), "DT_CONFERENCIA" = now(), "DT_ATUALIZACAO" = now()
     where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";
  end if;
  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital), 'fichas_afetadas', '[]'::json);
end;
$function$;
comment on function public.conferir_regra_analise(uuid, integer) is
  'Marca a versão vigente da regra como conferida (quem e quando). Dupla conferência: quem salvou a versão vigente não confere (42501), salvo o administrador global. p_versao tem de ser a vigente (senão 40001). Salvar uma versão nova volta para Conferir. Só a coordenação do edital.';
revoke all on function public.conferir_regra_analise(uuid, integer) from public, anon;
grant execute on function public.conferir_regra_analise(uuid, integer) to authenticated, service_role;

-- 3. O que o assistente lê ------------------------------------------------------------
create function public.obter_apoio_regra_analise(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_coordena boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_le_classificacao boolean := private.pode_recurso('classificacao', 1);
begin
  return json_build_object(
    'schema_version', 1,
    -- Só os nomes das colunas de pergunta, por vaga (nenhuma resposta de candidato).
    'perguntas_por_vaga', coalesce((
      select json_agg(json_build_object(
               'vaga', v."CO_VAGA",
               'cargo', (select s."NO_CARGO" from public."TB_SELECAO_VAGA" s
                          where s."CO_VAGA" = v."CO_VAGA" and s."NO_CARGO" is not null
                          order by s."CO_MONITORAMENTO" = p_edital desc limit 1),
               'colunas', coalesce((
                 select json_agg(c.coluna order by c.ordem)
                   from jsonb_array_elements_text(v."DS_COLUNA") with ordinality c(coluna, ordem)
                  where c.coluna ilike 'Pergunta %'), '[]'::json))
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
       where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA'), '[]'::json),
    'regras_da_area', case when v_coordena then coalesce((
      select json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'numero', private."FC_NUMERO_EDITAL"(m.edital), 'unidade', m.unidade,
               'versao', r."NU_VERSAO_VIGENTE", 'conferida_em', r."DT_CONFERENCIA", 'configuracao', h."DS_CONFIGURACAO")
             order by r."DT_CONFERENCIA" desc, m.edital)
        from public."TB_REGRA_ANALISE" r
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
        join public."TH_REGRA_ANALISE" h
          on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."TP_SITUACAO" = 'CONFERIDA' and m."CO_AREA" = v_area and m.id <> p_edital
         and private."FC_PODE_VER_EDITAL"(m.id)), '[]'::json) else '[]'::json end,
    'classificacao', json_build_object(
      'pode_ler', v_le_classificacao,
      'pode_editar', v_le_classificacao and private.pode_recurso('classificacao', 2),
      'regra', case when v_le_classificacao then (
        select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'configuracao', h."DS_CONFIGURACAO",
                                 'atualizado_em', h."DT_CRIACAO", 'por', coalesce(p.nome, p.email))
          from public."TB_REGRA_CLASSIFICACAO" r
          join public."TH_REGRA_CLASSIFICACAO" h
            on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
          left join public."TB_PERFIL_USUARIO" p on p.user_id = h."CO_USUARIO"
         where r."CO_MONITORAMENTO" = p_edital) end)
  );
end;
$function$;
comment on function public.obter_apoio_regra_analise(uuid) is
  'O que o assistente da regra da avaliação documental lê (json): os nomes das colunas de pergunta da última carga de cada vaga do edital (sem respostas), as regras conferidas dos outros editais da área que a pessoa vê (só para a coordenação do edital, para copiar) e a regra de classificação vigente (nota mínima e desempate) para quem lê a Classificação, com pode_editar (Editor na Classificação). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_apoio_regra_analise(uuid) from public, anon;
grant execute on function public.obter_apoio_regra_analise(uuid) to authenticated, service_role;

commit;
