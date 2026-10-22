/*
  CORREÇÃO DE DADOS — liga a pontuação dos títulos no inapto por requisito, só
  informativa, na regra da avaliação documental do Edital 114/2026 (Projetos,
  PES Rio Doce AgSUS/FUNASA, id bcecfb08-88ef-4e06-8401-bcad6bf88fd0).

  PRÉ-REQUISITOS: a migration 20261014170000_pontos_informativos_no_inapto.sql
  aplicada (o banco passa a validar a opção) e o front com a opção publicado
  (a ficha manda a pontuação informativa; sem ele, concluir o inapto por
  requisito é recusado com "falta a pontuação informativa"). Não depende do
  número da versão: parte da VIGENTE no momento da execução.

  O QUE FAZ: cria uma NOVA versão (vigente + 1), igual à vigente, com
    parecer.mostrar_pontos_quando_inapto = true
    parecer.pontos_informativos = a linha do parecer abaixo.
  O inapto por requisito (ex.: Escolaridade "Não confere", curso diverso)
  continua Inapto e com nota final 0 (item 8.2.1); a ficha mostra também a
  "Pontuação dos títulos (informativa)" e o parecer ganha a linha, por exemplo:
    "Pontuação apurada dos títulos, para fins informativos (não entra na nota
     final, item 8.2.1): 10,0 pontos (Titulação 8,0; Cursos 2,0; Experiência 0,0)."
  Classificação, lote, painel oficial e conferência da conta não mudam. Todo
  o resto da regra fica igual. A situação volta para CONFERIR, como em toda
  versão nova: a coordenação confere antes de concluir fichas. As fichas já
  concluídas não mudam (reabrir e concluir de novo, se quiserem a linha).

  Rode no SQL Editor (papel postgres). Idempotente: se a vigente já tem a
  opção ligada, não faz nada (avisa). Para ensaiar, troque o commit por
  rollback. Termina com o SELECT de conferência.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_motivo constant text := 'Pontuação dos títulos no inapto por requisito, só informativa (pedido das COREs)';
  c_nome constant text := 'Pontuação informativa no inapto';
  c_modelo constant text := E'\n\nPontuação apurada dos títulos, para fins informativos (não entra na nota final, item 8.2.1): {nota_informativa} pontos ({distribuicao_informativa}).';
  v_regra public."TB_REGRA_ANALISE";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
  v_autor uuid := (
    select p.user_id from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
     order by p.user_id limit 1);
begin
  if v_autor is null then
    raise exception 'Nenhum administrador global ativo para assinar a versão';
  end if;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA"
                  where id = c_edital and private."FC_NUMERO_EDITAL"(edital) = '114/2026') then
    raise exception 'Edital 114/2026 não encontrado pelo id';
  end if;

  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = c_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O 114/2026 ainda não tem regra da avaliação documental';
  end if;
  select h."DS_CONFIGURACAO" into v_atual
    from public."TH_REGRA_ANALISE" h
   where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";

  if (v_atual #> '{parecer,mostrar_pontos_quando_inapto}') = 'true'::jsonb then
    raise notice 'A versão vigente (%) já mostra a pontuação informativa no inapto: nada foi feito.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;

  v_nova := jsonb_set(v_atual, '{parecer}', coalesce(v_atual -> 'parecer', '{}'::jsonb) || jsonb_build_object(
    'mostrar_pontos_quando_inapto', true,
    'pontos_informativos', c_modelo));
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_nova);
  v_versao := v_regra."NU_VERSAO_VIGENTE" + 1;

  insert into public."TH_REGRA_ANALISE"
    ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_ANALISE", v_versao, v_nova,
          encode(sha256(convert_to(v_nova::text, 'UTF8')), 'hex'), c_motivo, v_autor,
          private."FC_NOME_DA_VERSAO"(c_nome));

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_versao, "TP_SITUACAO" = 'CONFERIR',
         "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_autor
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  raise notice 'Regra do 114/2026: versão % criada a partir da % com a pontuação informativa no inapto (situação CONFERIR).',
    v_versao, v_regra."NU_VERSAO_VIGENTE";
end;
$$;

commit;

-- Conferência: versão, situação, nome, motivo, a opção e o modelo da linha.
select r."NU_VERSAO_VIGENTE" as versao,
       r."TP_SITUACAO" as situacao,
       h."NO_VERSAO" as nome,
       h."DS_MOTIVO" as motivo,
       h."DS_CONFIGURACAO" #> '{parecer,mostrar_pontos_quando_inapto}' as mostrar_pontos_quando_inapto,
       h."DS_CONFIGURACAO" #>> '{parecer,pontos_informativos}' as modelo_da_linha
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h
    on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
