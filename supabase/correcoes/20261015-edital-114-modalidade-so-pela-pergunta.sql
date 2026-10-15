/*
  CORREÇÃO DE DADOS — a modalidade do Edital 114/2026 (Projetos, PES Rio Doce
  AgSUS/FUNASA, id bcecfb08-88ef-4e06-8401-bcad6bf88fd0) SÓ pela pergunta do
  sistema de concorrência: a coluna PCD da Empregare deixa de dar a cota.

  PRÉ-REQUISITO: a migration 20261015150000_varias_cotas.sql aplicada (a lista
  das cotas optadas, os blocos de cota pela lista e a modalidade final). Este
  script não depende do número da versão: parte da VIGENTE no momento da
  execução (hoje a v21).

  O PROBLEMA: o edital (5.1.5 e 5.1.6) só deixa concorrer às vagas de PcD quem
  INDICOU no campo da inscrição (a pergunta "Indique em qual sistema de
  concorrência…"). O bloco MODALIDADE da regra (correção
  20261015-edital-114-modalidade-pela-pergunta.sql) tem também a pergunta
  "PCD" (a coluna SIM/NÃO da Empregare), que conta como PcD. Em 15/10, quatro
  inscritos do lote ficaram PCD só pela coluna (vagas 182567, 182502, 182567 e
  182431) e devem ser AC.

  O QUE FAZ: cria uma NOVA versão (vigente + 1), igual à vigente, com o bloco
  MODALIDADE só com a pergunta "Indique em qual sistema de concorrência" (sem
  "PCD"; a coluna fica só informativa, como as demais respostas). Todo o resto
  fica igual. A situação volta para CONFERIR, como em toda versão nova: o job
  só pré-classifica o edital com a regra CONFERIDA (confira antes de rodar).

  Depois de conferida, a próxima pré-classificação grava as cotas optadas de
  cada inscrito (DS_MODALIDADES; NO_MODALIDADE = a principal, de maior
  percentual); no fim dela, FC_ABRIR_FICHAS leva a lista às fichas não
  concluídas com lançamento gravado (histórico MODALIDADE) e publica de novo as
  linhas com modalidade ou PcD diferente.

  Assinada pelo usuário a01afddb-f64b-47d9-80e8-476a1ed14e43.

  Rode no SQL Editor (papel postgres). Idempotente: se o bloco MODALIDADE da
  vigente já não tem a pergunta "PCD", não faz nada (avisa). Para ensaiar,
  troque o commit por rollback. Termina com o SELECT de conferência.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_autor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  c_motivo constant text := 'Modalidade só pela pergunta do sistema de concorrência (edital 5.1.5 e 5.1.6): a coluna PCD da Empregare não dá a cota';
  c_nome constant text := 'Modalidade só pela pergunta';
  v_regra public."TB_REGRA_ANALISE";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
  v_blocos jsonb;
begin
  if not exists (select 1 from auth.users where id = c_autor) then
    raise exception 'Usuário % não encontrado para assinar a versão', c_autor;
  end if;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA"
                  where id = c_edital and private."FC_NUMERO_EDITAL"(edital) = '114/2026') then
    raise exception 'Edital 114/2026 não encontrado pelo id';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'TB_PRE_CLASSIFICACAO' and column_name = 'DS_MODALIDADES') then
    raise exception 'Aplique antes a migration 20261015150000_varias_cotas.sql';
  end if;

  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = c_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O 114/2026 ainda não tem regra da avaliação documental';
  end if;
  select h."DS_CONFIGURACAO" into v_atual
    from public."TH_REGRA_ANALISE" h
   where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";

  if not exists (select 1 from jsonb_array_elements(v_atual -> 'blocos') b where b ->> 'codigo' = 'MODALIDADE') then
    raise exception 'A versão vigente (%) não tem o bloco MODALIDADE: aplique antes 20261015-edital-114-modalidade-pela-pergunta.sql',
      v_regra."NU_VERSAO_VIGENTE";
  end if;
  if not exists (select 1 from jsonb_array_elements(v_atual -> 'blocos') b,
                               jsonb_array_elements_text(coalesce(b -> 'perguntas', '[]'::jsonb)) p
                  where b ->> 'codigo' = 'MODALIDADE' and upper(btrim(p)) = 'PCD') then
    raise notice 'O bloco MODALIDADE da versão vigente (%) já não tem a pergunta PCD: nada foi feito.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;

  -- O bloco MODALIDADE sem a pergunta "PCD" (na mesma posição; o resto igual).
  select jsonb_agg(case when b.x ->> 'codigo' = 'MODALIDADE'
                        then jsonb_set(b.x, '{perguntas}',
                               coalesce((select jsonb_agg(p.v order by p.n)
                                           from jsonb_array_elements(b.x -> 'perguntas') with ordinality p(v, n)
                                          where upper(btrim(p.v #>> '{}')) <> 'PCD'), '[]'::jsonb))
                        else b.x end order by b.n)
    into v_blocos
    from jsonb_array_elements(v_atual -> 'blocos') with ordinality b(x, n);

  v_nova := jsonb_set(v_atual, '{blocos}', v_blocos);
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_nova);
  v_versao := v_regra."NU_VERSAO_VIGENTE" + 1;

  insert into public."TH_REGRA_ANALISE"
    ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_ANALISE", v_versao, v_nova,
          encode(sha256(convert_to(v_nova::text, 'UTF8')), 'hex'), c_motivo, c_autor,
          private."FC_NOME_DA_VERSAO"(c_nome));

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_versao, "TP_SITUACAO" = 'CONFERIR',
         "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = c_autor
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  raise notice 'Regra do 114/2026: versão % criada a partir da % com o bloco MODALIDADE só pela pergunta (situação CONFERIR).',
    v_versao, v_regra."NU_VERSAO_VIGENTE";
end;
$$;

commit;

-- Conferência: versão, situação, nome, motivo e as perguntas do bloco MODALIDADE.
select r."NU_VERSAO_VIGENTE" as versao,
       r."TP_SITUACAO" as situacao,
       h."NO_VERSAO" as nome,
       h."DS_MOTIVO" as motivo,
       b.x -> 'perguntas' as perguntas,
       jsonb_array_length(h."DS_CONFIGURACAO" -> 'blocos') as blocos
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h
    on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
  cross join lateral jsonb_array_elements(h."DS_CONFIGURACAO" -> 'blocos') b(x)
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
   and b.x ->> 'codigo' = 'MODALIDADE';
