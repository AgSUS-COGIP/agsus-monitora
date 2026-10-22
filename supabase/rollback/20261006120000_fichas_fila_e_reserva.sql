-- Desfaz 20261006120000_fichas_fila_e_reserva: tira as RPCs da fila, da distribuição e da
-- reserva, as travas (gatilhos em TB_PRE_CLASSIFICACAO e RL_ANALISTA_EDITAL) e as tabelas
-- TB_FICHA_ANALISE, TH_FICHA_ANALISE, TL_ACESSO_FICHA_ANALISE e TB_FILTRO_FILA_ANALISE.
-- ATENÇÃO: apaga as fichas, o histórico de distribuição e reserva, o log de acessos e os
-- filtros salvos. A pré-classificação (F2) fica como está.
begin;

drop function if exists public.excluir_filtro_fila(uuid);
drop function if exists public.salvar_filtro_fila(text, jsonb);
drop function if exists public.abrir_fichas_do_edital(uuid);
drop function if exists public.mandar_fichas_revisao(uuid, jsonb, text);
drop function if exists public.distribuir_fichas(uuid, jsonb, text);
drop function if exists public.liberar_reserva(uuid, uuid[], text);
drop function if exists public.renovar_reserva(uuid);
drop function if exists public.reservar_ficha(uuid);
drop function if exists public.pegar_proxima_ficha(uuid, text);
drop function if exists public.obter_fila_avaliacao(uuid);
drop function if exists public.abrir_fichas_pre_classificacao(text, uuid, jsonb);
drop function if exists public.pre_classificacao_ler_distribuicao(uuid);

drop trigger if exists "TG_ANALISTAEDT_FICHAS" on public."RL_ANALISTA_EDITAL";
drop function if exists private."FC_TG_EQUIPE_COM_FICHAS"();
drop trigger if exists "TG_PRECLASSIF_FICHA" on public."TB_PRE_CLASSIFICACAO";
drop function if exists private."FC_TG_LOTE_COM_FICHA"();

drop function if exists private."FC_ABRIR_FICHAS"(uuid, jsonb, uuid);
drop function if exists private."FC_FILTROS_FILA_JSON"(uuid);
drop function if exists private."FC_EXIGIR_COORD_FICHAS"(uuid);
drop function if exists private."FC_RESERVAR_FICHA"(uuid, uuid, text);
drop function if exists private."FC_HISTORICO_FICHA"(uuid, text, text, uuid, text, uuid);
drop function if exists private."FC_FICHA_ANALISE_JSON"(uuid);
drop function if exists private."FC_ANALISTAS_DO_EDITAL"(uuid, boolean);
drop function if exists private."FC_DISTRIBUICAO_DO_EDITAL"(uuid);
drop function if exists private."FC_PODE_ANALISAR_VAGA"(uuid, uuid, text);
drop function if exists private."FC_PRAZO_RESERVA_FICHA"();

drop table if exists public."TB_FILTRO_FILA_ANALISE";
drop table if exists public."TL_ACESSO_FICHA_ANALISE";
drop table if exists public."TH_FICHA_ANALISE";
drop table if exists public."TB_FICHA_ANALISE";
drop function if exists private."FC_TG_FICHA_IMUTAVEL"();

commit;
