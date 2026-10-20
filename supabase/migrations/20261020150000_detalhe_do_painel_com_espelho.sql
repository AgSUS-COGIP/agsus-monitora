/*
  DETALHE DO PAINEL DAS ANÁLISES COM O ESPELHO DE NOTA

  Por quê: a gaveta de uma análise no Painel das análises mostrava só a nota
  final e a composição final. Para as linhas publicadas pela ficha da
  Avaliação documental (origem MONITORA), a coordenação quer ver, como no
  espelho de nota, a nota autodeclarada (antes da análise) × a consolidada
  (após a análise) e, por critério, Declarada / Após análise / Teto, com a
  justificativa do critério que mudou. A conta é a do espelho (montarEspelho,
  via espelhoDaFichaGravada, no navegador): o banco só entrega a mesma entrada
  que obter_espelhos_de_nota entrega aos espelhos em massa, para uma ficha.

  O QUE MUDA
    public.get_analise_detalhe_do_painel(p_id): o mesmo detalhamento de
    20260929150000 (mesma permissão: pode_recurso('analises') e a área/recorte
    da linha), mais a chave "espelho":
      - a ficha da linha: pela chave natural 'monitora|<edital>|<candidato>' ou,
        na linha da planilha adotada pela ficha (TP_ORIGEM_REGISTRO = MONITORA),
        pela mesma regra da adoção (FC_PUBLICAR_FICHA_ANALISE: código Empregare,
        vaga, área e número do edital);
      - só ficha CONCLUÍDA (a do espelho); senão, ou na linha da planilha, null;
      - o que a montagem usa: resultado e nota final gravados, ART da
        pré-classificação, a declarada por critério de DS_RESULTADO, o
        lançamento enxuto (FC_LANCAMENTO_DO_ESPELHO: sem empregador nem nome de
        curso), a configuração da versão da regra usada na conclusão
        (TH_REGRA_ANALISE) e o documental do edital (FC_DOCUMENTAL_DO_EDITAL).
        Nada de nome, CPF, e-mail ou telefone do candidato.
    search_path passa a '' (tudo qualificado). Nada é gravado.

  Ensaio: supabase/ensaios/20261020150000_detalhe_do_painel_com_espelho.sql
  Rollback: supabase/rollback/20261020150000_detalhe_do_painel_com_espelho.sql
*/

begin;

set local lock_timeout = '5s';

create or replace function public.get_analise_detalhe_do_painel(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $function$
declare
  v_id uuid;
  v_analise text;
  v_chave text;
  v_grupo_norm text;
  v_origem text;
  v_area text;
  v_detalhe jsonb;
  v_ficha uuid;
  v_espelho jsonb;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  select a.id, a.analise, a.chave_natural, a.grupo_norm, a."TP_ORIGEM_REGISTRO"
    into v_id, v_analise, v_chave, v_grupo_norm, v_origem
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = p_id;

  if not found then
    return null;
  end if;

  select ar."CO_AREA" into v_area
    from public."TB_AREA" ar
   where public.analises_norm_key(ar."NO_GRUPO_PLANILHA") = v_grupo_norm;

  if not (private.is_master() or (v_area is not null and private."FC_PODE_AREA"(v_area)
      and (private."FC_EDITAIS_VISIVEIS"() is null or exists (
        select 1 from public."TB_ANALISE_CURRICULAR" x
         where x.id = v_id
           and (x.edital_norm = any (private."FC_EDITAIS_NORM_VISIVEIS"())
                or x.unidade_norm = any (private."FC_UNIDADES_NORM_VISIVEIS"())))))) then
    raise exception 'Sem permissão para as análises desta área' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'grupo', v.grupo,
    'nota_final_ajustada', v.nota_final_ajustada,
    'pontuacao_escolaridade', v.pontuacao_escolaridade,
    'pontuacao_cursos_aperfeicoamento', v.pontuacao_cursos_aperfeicoamento,
    'pontuacao_experiencia_profissional', v.pontuacao_experiencia_profissional,
    'pontuacao_criterio_etnico', v.pontuacao_criterio_etnico,
    'experiencia_saude_indigena_total', v.experiencia_saude_indigena_total,
    'experiencia_atencao_basica_total', v.experiencia_atencao_basica_total,
    'experiencia_profissional_anos', ac.experiencia_profissional_anos,
    'experiencia_profissional_meses', ac.experiencia_profissional_meses,
    'experiencia_profissional_dias', ac.experiencia_profissional_dias,
    'experiencia_profissional_total', ac.experiencia_profissional_total,
    'link_pdf', v.link_pdf,
    'pdf_status', v.pdf_status,
    'erro_pdf', v.erro_pdf,
    'origem_arquivo_id', v.origem_arquivo_id,
    'data_inicio_analise', v.data_inicio_analise,
    'data_fim_analise', v.data_fim_analise,
    'data_validacao_status', v.data_validacao_status,
    'edital_status', v.edital_status,
    'updated_at', v.updated_at,
    'ultima_atualizacao', v.ultima_atualizacao
  )
  into v_detalhe
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  where v.id = v_id;

  -- A ficha da linha: a da chave natural da ficha, ou a que adotou a linha da planilha.
  if v_chave ~* '^monitora\|[0-9a-f-]{36}\|[0-9a-f-]{36}$' then
    select f."CO_FICHA_ANALISE" into v_ficha
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = split_part(v_chave, '|', 2)::uuid
       and f."CO_EMPREGARE_CANDIDATO" = split_part(v_chave, '|', 3)::uuid;
  elsif v_origem = 'MONITORA' then
    select f."CO_FICHA_ANALISE" into v_ficha
      from public."TB_ANALISE_CURRICULAR" a
      join public."TB_EMPREGARE_CANDIDATO" c on c."CO_CANDIDATO_EMPREGARE" = btrim(a.id_origem)
      join public."TB_FICHA_ANALISE" f
        on f."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO" and f."CO_VAGA" = a.codigo_vaga
      join public."TB_MONITORAMENTO_INDIGENA" m
        on m.id = f."CO_MONITORAMENTO" and m."CO_AREA" = a."CO_AREA"
     where a.id = v_id
       and private."FC_NUMERO_EDITAL"(m.edital) = private."FC_NUMERO_EDITAL"(a.edital)
     order by f."CO_FICHA_ANALISE"
     limit 1;
  end if;

  -- A entrada do espelho de nota (a mesma de obter_espelhos_de_nota), só da ficha concluída.
  if v_ficha is not null then
    select jsonb_build_object(
             'schema_version', 1,
             'ficha', jsonb_build_object(
               'id', f."CO_FICHA_ANALISE",
               'vaga', f."CO_VAGA",
               'art', pc."VL_ART",
               'resultado', f."TP_RESULTADO",
               'nota_final', f."VL_NOTA_FINAL",
               'regra', f."CO_REGRA_ANALISE" || ':' || f."NU_VERSAO_REGRA",
               'declarada', case when jsonb_typeof(f."DS_RESULTADO" -> 'declarada') = 'object'
                                 then f."DS_RESULTADO" -> 'declarada' else '{}'::jsonb end,
               'lancamento', private."FC_LANCAMENTO_DO_ESPELHO"(f."DS_LANCAMENTO")),
             'regra', h."DS_CONFIGURACAO",
             'documental', private."FC_DOCUMENTAL_DO_EDITAL"(f."CO_MONITORAMENTO"),
             'edital', jsonb_build_object('id', m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
                                          'area', m."CO_AREA"))
      into v_espelho
      from public."TB_FICHA_ANALISE" f
      join public."TH_REGRA_ANALISE" h
        on h."CO_REGRA_ANALISE" = f."CO_REGRA_ANALISE" and h."NU_VERSAO" = f."NU_VERSAO_REGRA"
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = f."CO_MONITORAMENTO"
      left join public."TB_PRE_CLASSIFICACAO" pc
        on pc."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and pc."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_FICHA_ANALISE" = v_ficha
       and f."TP_SITUACAO" = 'CONCLUIDA';
  end if;

  return coalesce(v_detalhe, '{}'::jsonb) || jsonb_build_object(
    'id', v_id,
    'area', v_area,
    'analise', v_analise,
    'chave_natural', v_chave,
    'espelho', v_espelho
  );
end;
$function$;

comment on function public.get_analise_detalhe_do_painel(uuid) is
  'Detalhamento de uma linha do Painel das análises ao abrir a gaveta (parecer, pontuações, experiências, links, datas). Desde 20261020150000, "espelho": para a linha publicada pela ficha CONCLUÍDA da Avaliação documental (chave monitora|edital|candidato, ou a linha da planilha adotada), a entrada da montagem do espelho de nota (a mesma de obter_espelhos_de_nota: resultado, nota final, ART, declarada por critério, lançamento sem empregador nem nome de curso, configuração da versão da regra e documental do edital); null nas demais. Permissão: pode_recurso(analises) e a área/recorte da linha (42501). Não grava nada.';

revoke all on function public.get_analise_detalhe_do_painel(uuid) from public, anon;
grant execute on function public.get_analise_detalhe_do_painel(uuid) to authenticated;

commit;
