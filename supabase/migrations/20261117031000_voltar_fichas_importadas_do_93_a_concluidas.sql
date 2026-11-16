/*
  VOLTAR A CONCLUÍDAS AS FICHAS IMPORTADAS DO 93/2026 QUE A CONFERÊNCIA MANDOU PARA REVISÃO (16/11/2026)

  POR QUE
  Às 16h49 de 16/11/2026 a conferência automática mandou para REVISAR as 94 fichas do 93/2026
  importadas da planilha (sem itens marcados, todas tinham "pendência"). Indo para REVISAR, cada
  ficha republicou a linha do Painel das análises pelo caminho comum: situação Revisar, etapa
  Avaliação documental, a modalidade e a PcD pelas cotas da ficha vazia (15 e 5 linhas) e as
  parciais vazias como 0 (31). Nota, parecer, analista, data e nome não mudaram.
  20261117030000 impede que se repita; esta desfaz.

  O QUE MUDA
    - Cada ficha importada do 93/2026 em REVISAR, cuja última ação foi a conferência automática,
      volta a CONCLUIDA, com o histórico CORRIGIR e o motivo.
    - A linha de cada uma volta ao que a planilha decidiu, lido da marca da ficha
      (DS_LANCAMENTO.importada_da_planilha): situação, etapa, modalidade, PcD e as parciais (a que
      a planilha não tinha volta a vazia). A experiência em saúde indígena e em atenção básica fica
      vazia, como em todas as linhas da planilha de Projetos.
    - Republicar a ficha concluída e importada não reescreve a linha (FC_PUBLICAR_FICHA_ANALISE).

  GUARDAS: 20261117030000 aplicada; entre 90 e 94 fichas a corrigir (medidas: 94).
  Quem corrige: o usuário que pediu (dados.recursoshumanos), pelo e-mail no auth.users.
  Ensaio: supabase/ensaios/20261117031000_voltar_fichas_importadas_do_93_a_concluidas.sql
  Rollback: não há (voltar as fichas a REVISAR desfaria a correção pedida; o histórico guarda tudo).
*/

begin;

set local lock_timeout = '5s';

do $corrigir$
declare
  v_edital constant uuid := 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';
  v_motivo constant text := 'Volta a concluída: a conferência automática mandou para revisão a ficha importada da planilha (sem itens marcados, a análise foi feita na planilha); o resultado é o da planilha.';
  v_usuario uuid;
  v_f record;
  v_m jsonb;
  v_qt integer;
  v_feitas integer := 0;
begin
  if position('ficha importada da planilha' in coalesce((select prosrc from pg_proc
       where oid = to_regprocedure('public.revisar_ficha_concluida_com_pendencia(uuid, integer)')), '')) = 0 then
    raise exception 'Aplique antes 20261117030000_conferencia_nao_revisa_ficha_importada.sql' using errcode = '55000';
  end if;
  select u.id into v_usuario from auth.users u where lower(u.email) = 'dados.recursoshumanos@agenciasus.org.br';
  if v_usuario is null then
    raise exception 'Usuário de quem pediu a correção não encontrado' using errcode = '55000';
  end if;

  create temp table tmp_a_corrigir on commit drop as
    select f."CO_FICHA_ANALISE" as ficha
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = v_edital
       and f."TP_SITUACAO" = 'REVISAR'
       and jsonb_typeof(f."DS_LANCAMENTO" -> 'importada_da_planilha') = 'object'
       and (select h."TP_ACAO" || '|' || h."TP_ORIGEM" from public."TH_FICHA_ANALISE" h
             where h."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE"
             order by h."DT_REGISTRO" desc, h."CO_HISTORICO_FICHA" desc limit 1) = 'REVISAR|JOB';
  select count(*) into v_qt from tmp_a_corrigir;
  if v_qt not between 90 and 94 then
    raise exception 'São % fichas a corrigir; a medição de 16/11/2026 deu 94. Confira antes.', v_qt using errcode = '55000';
  end if;

  for v_f in select f.* from public."TB_FICHA_ANALISE" f join tmp_a_corrigir t on t.ficha = f."CO_FICHA_ANALISE" loop
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'CONCLUIDA',
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(v_f."CO_FICHA_ANALISE", 'CORRIGIR', 'REVISAR', v_motivo, v_usuario,
      jsonb_build_array(jsonb_build_object('campo', 'situacao', 'rotulo', 'Situação', 'de', 'REVISAR', 'para', 'CONCLUIDA')),
      null);

    v_m := v_f."DS_LANCAMENTO" -> 'importada_da_planilha';
    update public."TB_ANALISE_CURRICULAR" a set
      status_consolidado = v_m ->> 'status',
      etapa = v_m ->> 'etapa',
      modalidade_concorrencia = v_m ->> 'modalidade',
      pcd = v_m ->> 'pcd',
      pontuacao_escolaridade = (v_m -> 'parciais' ->> 'FORMACAO')::numeric,
      pontuacao_cursos_aperfeicoamento = (v_m -> 'parciais' ->> 'CURSOS')::numeric,
      pontuacao_experiencia_profissional = (v_m -> 'parciais' ->> 'EXPERIENCIA')::numeric,
      pontuacao_criterio_etnico = (v_m -> 'parciais' ->> 'ETNICO')::numeric,
      experiencia_saude_indigena_total = null,
      experiencia_atencao_basica_total = null,
      "TP_ORIGEM_REGISTRO" = 'MONITORA',
      updated_at = now(),
      ultima_atualizacao = now()
     where a.id = (v_m ->> 'linha')::uuid;
    v_feitas := v_feitas + 1;
  end loop;

  raise notice '% ficha(s) de volta a concluída, com a linha da planilha', v_feitas;
end
$corrigir$;

commit;
