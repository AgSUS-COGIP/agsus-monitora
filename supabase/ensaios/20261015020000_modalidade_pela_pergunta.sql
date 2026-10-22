/*
  Ensaio de 20261015020000 (modalidade pela pergunta). Sempre termina em
  rollback. Cole a migration no ponto marcado (dentro do mesmo begin/rollback).
  No 114/2026 (análise no MONITORA): muda para PP a modalidade da
  pré-classificação de uma ficha não concluída com lançamento gravado e de uma
  sem lançamento, roda FC_ABRIR_FICHAS e reprova se a ficha com lançamento não
  passar a PP (com histórico MODALIDADE), se as duas linhas publicadas não
  ficarem "Pretos e pardos", se a segunda rodada mexer em algo, se a
  FC_DOCUMENTAL_DO_EDITAL não trouxer as cotas ou se o bloco COTA_PP não valer
  só para PP. Termina com o retorno das duas rodadas.

  Em 14/10/2026, com as modalidades do lote calculadas pelo Python
  (pre_classificacao.py) com a regra corrigida, o mesmo FC_ABRIR_FICHAS deu:
  modalidade_atualizada 3, republicadas 294; linhas publicadas AC 1048,
  PP 234, PCD 54, PI 4, PQ 2; 2 fichas CONCLUÍDAS de cotista PP (reabrir);
  segunda rodada sem mudança.
*/
begin;

-- >>> cole aqui supabase/migrations/20261015020000_modalidade_pela_pergunta.sql <<<

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_com public."TB_FICHA_ANALISE";
  v_sem public."TB_FICHA_ANALISE";
  v_r1 jsonb;
  v_r2 jsonb;
  v_cotas jsonb := private."FC_DOCUMENTAL_DO_EDITAL"(c_edital) -> 'cotas';
  v_bloco constant jsonb := '{"codigo": "COTA_PP", "tipo": "COTA", "condicao": "MODALIDADE=PP"}';
begin
  if v_cotas ->> 'acumulo' is null or jsonb_typeof(v_cotas -> 'percentuais') <> 'object' then
    raise exception 'FC_DOCUMENTAL_DO_EDITAL sem as cotas: %', v_cotas;
  end if;
  if not private."FC_BLOCO_SE_APLICA"(v_bloco, '{"modalidade": "PP"}')
     or private."FC_BLOCO_SE_APLICA"(v_bloco, '{"modalidade": "AC"}') then
    raise exception 'COTA_PP deveria valer só para PP';
  end if;

  select f.* into v_com from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = c_edital and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR')
     and jsonb_typeof(f."DS_LANCAMENTO") = 'object'
   order by f."CO_FICHA_ANALISE" limit 1;
  select f.* into v_sem from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = c_edital and f."TP_SITUACAO" = 'PENDENTE' and f."DS_LANCAMENTO" is null
   order by f."CO_FICHA_ANALISE" limit 1;
  if v_com."CO_FICHA_ANALISE" is null or v_sem."CO_FICHA_ANALISE" is null then
    raise exception 'O 114 não tem as fichas do ensaio (com e sem lançamento)';
  end if;

  update public."TB_PRE_CLASSIFICACAO" set "NO_MODALIDADE" = 'PP'
   where "CO_MONITORAMENTO" = c_edital
     and "CO_EMPREGARE_CANDIDATO" in (v_com."CO_EMPREGARE_CANDIDATO", v_sem."CO_EMPREGARE_CANDIDATO");

  v_r1 := private."FC_ABRIR_FICHAS"(c_edital, '[]'::jsonb, null);
  v_r2 := private."FC_ABRIR_FICHAS"(c_edital, '[]'::jsonb, null);

  if (select "DS_LANCAMENTO" ->> 'modalidade' from public."TB_FICHA_ANALISE"
       where "CO_FICHA_ANALISE" = v_com."CO_FICHA_ANALISE") is distinct from 'PP' then
    raise exception 'a ficha com lançamento não passou a PP';
  end if;
  if (select "NU_VERSAO" from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_com."CO_FICHA_ANALISE")
     <> v_com."NU_VERSAO" + 1 then
    raise exception 'a versão da ficha com lançamento deveria subir 1';
  end if;
  if not exists (select 1 from public."TH_FICHA_ANALISE"
                  where "CO_FICHA_ANALISE" = v_com."CO_FICHA_ANALISE" and "TP_ACAO" = 'MODALIDADE'
                    and "DS_MOTIVO" like '%→ PP') then
    raise exception 'sem histórico MODALIDADE';
  end if;
  if (select "DS_LANCAMENTO" from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_sem."CO_FICHA_ANALISE") is not null then
    raise exception 'a ficha sem lançamento não deveria ganhar lançamento';
  end if;
  if (select count(*) from public."TB_ANALISE_CURRICULAR" a
       where a.chave_natural in ('monitora|' || c_edital || '|' || v_com."CO_EMPREGARE_CANDIDATO",
                                 'monitora|' || c_edital || '|' || v_sem."CO_EMPREGARE_CANDIDATO")
         and a.modalidade_concorrencia = 'Pretos e pardos' and a.pcd = 'NÃO') <> 2 then
    raise exception 'as linhas publicadas não ficaram "Pretos e pardos"';
  end if;
  if (v_r1 ->> 'modalidade_atualizada')::integer < 1 or (v_r1 ->> 'republicadas')::integer < 2 then
    raise exception 'contagens da primeira rodada: %', v_r1;
  end if;
  if (v_r2 ->> 'modalidade_atualizada')::integer <> 0 or (v_r2 ->> 'republicadas')::integer <> 0 then
    raise exception 'a segunda rodada mexeu em algo: %', v_r2;
  end if;
  raise notice 'OK. Primeira rodada: %; segunda: %; cotas: %', v_r1, v_r2, v_cotas;
end;
$$;

rollback;
