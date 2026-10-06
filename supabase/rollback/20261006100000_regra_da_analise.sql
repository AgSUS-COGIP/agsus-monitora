-- Desfaz 20261006100000_regra_da_analise: tira as RPCs, as funções, os gatilhos e as
-- tabelas da regra da avaliação documental, da equipe, das aldeias e do dono da
-- avaliação. ATENÇÃO: apaga as regras e as versões, a equipe, as aldeias carregadas e
-- os modelos. Exporte antes (obter_regra_analise / obter_equipe_edital) se precisar
-- guardar. Os gatilhos que impedem apagar caem junto com as tabelas.
begin;

drop function if exists public.salvar_aldeias_dsei(text, jsonb, text);
drop function if exists public.salvar_equipe_edital(uuid, jsonb, text);
drop function if exists public.obter_equipe_edital(uuid);
drop function if exists public.conferir_regra_analise(uuid, integer);
drop function if exists public.copiar_modelo_regra_analise(uuid, text);
drop function if exists public.salvar_regra_analise(uuid, jsonb, integer, text);
drop function if exists public.obter_regra_analise(uuid);
drop function if exists public.listar_editais_avaliacao(text);
drop function if exists private."FC_REGRA_ANALISE_JSON"(uuid);
drop function if exists private."FC_VALIDAR_REGRA_ANALISE"(jsonb);
drop function if exists private."FC_VALIDAR_BLOCO_ANALISE"(jsonb, integer);
drop function if exists private."FC_ERRO_PONTOS_EXPERIENCIA"(jsonb, text, text);
drop function if exists private."FC_ERRO_FAIXAS_ANALISE"(jsonb, text);
drop function if exists private."FC_ERRO_EFEITO_ANALISE"(text, text, text);
drop function if exists private."FC_JSON_SIM_NAO_OK"(jsonb, text);
drop function if exists private."FC_JSON_NUMERO_OBRIGATORIO"(jsonb, numeric, numeric);
drop function if exists private."FC_JSON_TEXTOS_OK"(jsonb, integer);
drop function if exists private."FC_JSON_TEXTO_OK"(jsonb, boolean, integer);
drop function if exists private."FC_EXIGIR_COORD_AVALIACAO"(uuid);
drop function if exists private."FC_EXIGIR_AVALIACAO_EDITAL"(uuid, integer);
drop function if exists private."FC_PAPEL_AVALIACAO"(uuid);
drop function if exists private."FC_GESTOR_DO_EDITAL"(uuid, uuid);
drop function if exists private."FC_NIVEL_AVALIACAO_DO_PERFIL"(uuid);
drop function if exists private."FC_PERFIL_VE_EDITAL"(uuid, uuid);

drop table if exists public."TH_ORIGEM_ANALISE_EDITAL";
drop table if exists public."TB_ORIGEM_ANALISE_EDITAL";
drop table if exists public."TD_ALDEIA_DSEI";
drop table if exists public."RL_ANALISTA_EDITAL";
drop table if exists public."TH_REGRA_ANALISE";
drop table if exists public."TB_REGRA_ANALISE";
drop table if exists public."TB_REGRA_ANALISE_MODELO";
drop function if exists private."FC_TG_REGRA_ANALISE_IMUTAVEL"();

commit;
