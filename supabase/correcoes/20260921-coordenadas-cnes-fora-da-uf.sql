-- ---------------------------------------------------------------------------
-- CORRIGE 3 COORDENADAS DO CNES QUE CAEM FORA DA UF DECLARADA
--
-- Origem: scripts/validar-localizacoes.mjs, execução de 21/09/2026.
-- Prova por registro: public/data/localizacoes-validadas.json
--
-- O ÁRBITRO
--
-- Cada uma destas 3 unidades tem duas coordenadas: a do CNES, guardada aqui no
-- payload `rede_cnes`, e a da planilha oficial de Lotações. Elas discordam. A
-- malha da UF publicada pelo IBGE — independente das duas — mostra que a do
-- CNES cai fora do estado que o próprio registro declara, e a das Lotações cai
-- dentro. É por isso, e só por isso, que a segunda substitui a primeira.
--
-- POR QUE SÃO 3 E NÃO 4
--
-- Uma quarta unidade, POLO BASE TELES PIRES (CNES 7597355), entrou nesta lista
-- na primeira apuração e foi retirada. A malha usada era a de qualidade
-- mínima, que corta os recortes da divisa; na malha detalhada a coordenada do
-- CNES cai DENTRO do Pará. Ela discorda das Lotações em 175 km e continua por
-- resolver, mas não é erro do CNES e não se toca nela aqui.
--
-- O QUE ISTO NÃO RESOLVE
--
-- 119 unidades têm as duas fontes dentro da UF e longe uma da outra. A malha
-- do estado não distingue essas, e nenhuma delas entra neste ficheiro.
--
-- COMO APLICAR
--
-- 1. Correr o bloco de CONFERÊNCIA primeiro. Ele não altera nada e mostra o
--    que está lá agora. Se devolver menos de 3 linhas, PARE: o payload mudou
--    desde a apuração e este ficheiro precisa de ser refeito.
-- 2. Correr o UPDATE. Ele só escreve se as coordenadas atuais forem exatamente
--    as que foram auditadas — se alguém já corrigiu, não faz nada.
-- 3. Correr o bloco de VERIFICAÇÃO no fim.
--
-- Reversível: o bloco final imprime o UPDATE inverso.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================
-- Não altera nada. Esperado: 3 linhas, com as coordenadas "antes" abaixo.
--
--   7620306  POLO BASE CUCUI          1.000000, -66.502263
--   7360312  POLO BASE RIOZINHO      -1.102485, -58.045991
--   7593635  POLO BASE KATO          -6.740986, -58.518677

with unidades as (
  select
    dsei.key                        as dsei,
    (unidade.value ->> 0)           as nome,
    (unidade.value ->> 1)           as cnes,
    (unidade.value ->> 2)::numeric  as lat,
    (unidade.value ->> 3)::numeric  as lon
  from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
  cross join lateral jsonb_each(cfg.payload -> 'rede')        as dsei(key, value)
  cross join lateral jsonb_array_elements(dsei.value -> 'u')  as unidade(value)
  where cfg.chave = 'rede_cnes'
)
select * from unidades
where cnes in ('7620306', '7360312', '7593635');

-- ============================ 2. CORREÇÃO ==================================
-- Reescreve o array `u` de cada DSEI, trocando só os elementos cujo código
-- CNES está na lista E cuja coordenada ainda é a auditada. Qualquer outro
-- elemento é copiado tal e qual.

update "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
set payload = jsonb_set(
  cfg.payload,
  '{rede}',
  (
    select jsonb_object_agg(
      dsei.key,
      case
        when dsei.value ? 'u' then jsonb_set(
          dsei.value,
          '{u}',
          (
            select coalesce(jsonb_agg(corrigida.linha order by corrigida.ordem), '[]'::jsonb)
            from (
              select
                unidade.ordem,
                case
                  -- POLO BASE CUCUI, São Gabriel da Cachoeira (AM).
                  -- A latitude 1.000000 exata é, em si, sinal de preenchimento.
                  when unidade.value ->> 1 = '7620306'
                   and (unidade.value ->> 2)::numeric = 1.000000
                   and (unidade.value ->> 3)::numeric = -66.502263
                  then jsonb_set(
                         jsonb_set(unidade.value, '{2}', to_jsonb(1.188613::numeric)),
                         '{3}', to_jsonb(-66.838784::numeric))

                  -- POLO BASE RIOZINHO, Nhamundá (AM). 39,2 km de diferença.
                  when unidade.value ->> 1 = '7360312'
                   and (unidade.value ->> 2)::numeric = -1.102485
                   and (unidade.value ->> 3)::numeric = -58.045991
                  then jsonb_set(
                         jsonb_set(unidade.value, '{2}', to_jsonb(-1.429139::numeric)),
                         '{3}', to_jsonb(-57.913889::numeric))

                  -- POLO BASE KATO, Jacareacanga (PA). 98,8 km de diferença.
                  when unidade.value ->> 1 = '7593635'
                   and (unidade.value ->> 2)::numeric = -6.740986
                   and (unidade.value ->> 3)::numeric = -58.518677
                  then jsonb_set(
                         jsonb_set(unidade.value, '{2}', to_jsonb(-6.646461::numeric)),
                         '{3}', to_jsonb(-57.629369::numeric))

                  else unidade.value
                end as linha
              from jsonb_array_elements(dsei.value -> 'u')
                   with ordinality as unidade(value, ordem)
            ) as corrigida
          )
        )
        else dsei.value
      end
    )
    from jsonb_each(cfg.payload -> 'rede') as dsei(key, value)
  )
)
where cfg.chave = 'rede_cnes';

-- ============================ 3. VERIFICAÇÃO ===============================
-- Esperado depois do UPDATE:
--
--   7620306  POLO BASE CUCUI          1.188613, -66.838784
--   7360312  POLO BASE RIOZINHO      -1.429139, -57.913889
--   7593635  POLO BASE KATO          -6.646461, -57.629369

with unidades as (
  select
    (unidade.value ->> 1)           as cnes,
    (unidade.value ->> 0)           as nome,
    (unidade.value ->> 2)::numeric  as lat,
    (unidade.value ->> 3)::numeric  as lon
  from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
  cross join lateral jsonb_each(cfg.payload -> 'rede')        as dsei(key, value)
  cross join lateral jsonb_array_elements(dsei.value -> 'u')  as unidade(value)
  where cfg.chave = 'rede_cnes'
)
select * from unidades
where cnes in ('7620306', '7360312', '7593635');

-- ============================ 4. PARA DESFAZER =============================
-- Correr o UPDATE acima trocando os pares, em cada ramo do CASE:
--
--   7620306   1.188613, -66.838784   ->    1.000000, -66.502263
--   7360312  -1.429139, -57.913889   ->   -1.102485, -58.045991
--   7593635  -6.646461, -57.629369   ->   -6.740986, -58.518677
