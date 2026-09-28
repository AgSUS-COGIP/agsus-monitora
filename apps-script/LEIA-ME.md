# Apps Script das planilhas de Análises Curriculares

Três planilhas enviam análises para o **mesmo** banco do MONITORA
(`https://gnudtaxhjfgtvwkwpsel.supabase.co`). Cada uma tem uma etiqueta
(`CO_PLANILHA`) e o banco garante que o envio de uma **nunca altera, desativa ou
mistura** os dados de outra. O desenho está em `docs/banco-de-dados.md`
(seção 6) e a migration em
`supabase/migrations/20260928140000_sync_de_analises_por_planilha.sql`.

| Planilha | ID do arquivo | `grupo` aceito | Origens (constante `ORIGEM`) |
|---|---|---|---|
| Saúde Indígena | `15jEbApj-tdxKAm2DQZdojrgvU_SbO00G8031vmAg7cw` | Saúde Indígena | `apps_script_analises_curriculares_v2_pdf` (FULL), `apps_script_analises_incremental_v1` (incremental) |
| Projetos ("Central AgSus Monitora Sede e Projetos") | `1BJbi9SJRc-UaEEYR5PMPReyvyUYt9kGoeGqdepXhkJQ` | Projetos | `apps_script_analises_projetos_full_v1`, `apps_script_analises_projetos_incremental_v1` |
| SEDE (ainda não existe) | — | SEDE | `apps_script_analises_sede_full_v1`, `apps_script_analises_sede_incremental_v1` |

**Regras que o banco aplica (o "porteiro"):**

- Toda linha de `DIM_EDITAIS` e `FATO_ANALISES` precisa ter na coluna `grupo`
  exatamente o grupo da planilha (maiúsculas, acentos e espaços extras são
  tolerados). Uma linha errada recusa o envio **inteiro**; nada é gravado. A
  mensagem aparece no log do Apps Script: `recusado pelo porteiro: N linha(s) do
  envio com grupo diferente de "Projetos"...`.
- Origem que não está na tabela acima é recusada.
- Cada planilha tem a própria fila: a Saúde Indígena e Projetos podem enviar ao
  mesmo tempo, mas cada planilha só tem um envio pendente por vez.
- Um edital que some da `DIM_EDITAIS` é desativado **só na planilha dele**.

## Arquivos

```
apps-script/
  saude-indigena/
    2-sincronizar-com-supabase-full.gs   substitui "Sincronizar com Supabase" (Scipts Monitora analises2)
    3-analises-incremental.gs            substitui "AnalisesIncremental" (Scipts Monitora analises3)
  projetos/
    2-sincronizar-com-supabase-full.gs   novo; substitui o antigo sync (Script Projetos1), que deve ser APAGADO
    3-analises-incremental.gs            novo
    4-orquestrador-fato-supabase.gs      novo (orquestrador igual ao da SI)
```

- O **"Atualizar base"** de cada planilha continua o que está lá (não muda).
- O orquestrador da Saúde Indígena (Scipts Monitora analises4) **não muda**: ele
  não consulta o banco diretamente.
- O painel web de Projetos (Script Projetos3/4/6/7) não muda.
- Nos arquivos da SI, cada linha alterada está marcada com `// [por-planilha]`.
  As mudanças são só estas: a lista `ORIGENS_PLANILHA`, o filtro
  `&origem=in.(...)` em toda consulta ao log `TL_SYNC_ANALISE`, e `p_origem`
  nas chamadas `iniciar_sync_analises_incremental` e
  `verificar_sync_analises_incremental`.

## Ordem segura

1. **Migration no banco** (quem aplica é o responsável pelo banco). O script
   atual da Saúde Indígena continua funcionando sem mudança nenhuma: as funções
   aceitam as mesmas chamadas e devolvem as mesmas chaves.
   > Não troque os scripts **antes** da migration: o script novo passa
   > `p_origem`, que o banco antigo não conhece.
2. **Trocar os scripts da Saúde Indígena** e acompanhar 2 ou 3 ciclos do
   orquestrador (cerca de 1 hora).
3. **Projetos**: colar os scripts, fazer **um envio manual**, conferir no banco e
   só então instalar o gatilho.

## Passo a passo

### Saúde Indígena (passo 2)

1. Abra a planilha > **Extensões > Apps Script**.
2. Espere não haver envio em andamento: rode `statusSyncAnalisesCurricularesIncremental`
   e confira que `state` é `null` (ou olhe a consulta "Conferir no banco", abaixo).
3. Abra o arquivo do sync FULL (o que começa com `const ANALISES_SYNC_CFG`),
   apague todo o conteúdo e cole `saude-indigena/2-sincronizar-com-supabase-full.gs`.
4. Abra o arquivo do incremental (começa com o comentário "Sincronizacao
   incremental") e cole `saude-indigena/3-analises-incremental.gs`.
5. Salve (Ctrl+S). Não é preciso reinstalar gatilho nem mexer na chave: ela já
   está nas Propriedades do Script.
6. Acompanhe: **Execuções** (menu da esquerda) deve mostrar
   `orquestrarFatoESupabaseAgendado` concluindo, e no banco os envios aparecem
   como `processado` (consulta abaixo).

### Projetos (passo 3)

1. Abra a planilha "Central AgSus Monitora Sede e Projetos" > **Extensões > Apps Script**.
2. **Apague o arquivo do sync antigo** (o que começa com
   `01_sync_analises_curriculares_supabase.gs` / `ORIGEM: 'apps_script_analises_curriculares_v3_edital_30_2026'`).
   Ele aponta para outro Supabase, desativado, e tem funções com os mesmos nomes
   dos arquivos novos (o projeto não salva com os dois).
3. Remova os gatilhos antigos desse sync: **Acionadores** (ícone de relógio) e
   apague os que chamam `syncAnalisesCurricularesCompleto` ou
   `atualizarDimVagasESincronizarAgendado`.
4. Crie três arquivos (botão **+ > Script**) e cole em cada um:
   `projetos/2-sincronizar-com-supabase-full.gs`,
   `projetos/3-analises-incremental.gs`,
   `projetos/4-orquestrador-fato-supabase.gs`.
5. **Chave do banco**: engrenagem **Configurações do projeto > Propriedades do
   script > Adicionar propriedade**:
   - `SUPABASE_SERVICE_ROLE_KEY` = a chave secreta (`sb_secret_...` ou JWT
     `service_role`) do projeto `gnudtaxhjfgtvwkwpsel`;
   - `SUPABASE_URL` = `https://gnudtaxhjfgtvwkwpsel.supabase.co` (opcional; é o padrão).
   **Nunca cole a chave no código** (`SERVICE_ROLE_KEY_FIXA` fica vazio).
6. Rode `verificarConfiguracaoSupabaseAnalisesCurriculares` e confira no log
   "SUPABASE_SERVICE_ROLE_KEY: CONFIGURADA".
7. Confira a coluna `grupo` de `DIM_EDITAIS` e `FATO_ANALISES`: tem de ser
   **Projetos** em todas as linhas. O nome do arquivo fala em "Sede e
   Projetos", mas ele está cadastrado como planilha de Projetos: um edital com
   `grupo` = SEDE aqui seria recusado. Editais da SEDE vão para a planilha
   própria da SEDE (ou peça uma nova migration se a decisão mudar).
8. **Envio manual**: rode `syncAnalisesCurricularesCompleto` (FULL). Se o log
   disser `continuation_scheduled: true`, ele continua sozinho a cada minuto;
   rode `retomarSyncAnalisesCurriculares` para acompanhar. O fim é
   `"ok": true, "status": "processado"`.
9. Confira no banco (abaixo). Estando certo, instale o gatilho: rode
   **uma vez** `instalarGatilhoFatoESupabase`. A partir daí, a cada 20 minutos o
   orquestrador atualiza a FATO e manda só o que mudou (incremental).

### SEDE (futuro)

Quando a planilha existir: copie a pasta `projetos/`, troque as constantes
`ORIGEM` e `ORIGENS_PLANILHA` pelas origens da SEDE (tabela acima), use `grupo` =
SEDE e peça para gravar o ID do arquivo em `TB_PLANILHA_ANALISE."DS_PLANILHA_ID"`.

## Envio recusado (porteiro, origem, fila)

Quando o banco recusa um envio, a mensagem aparece no log de **Execuções** do
Apps Script e o envio fica pendente no banco. O script **não** tenta de novo com
dados novos sozinho (isso é de propósito: nada errado entra). Para destravar:

1. Corrija a planilha (em geral, a coluna `grupo`).
2. Peça ao responsável pelo banco para encerrar o envio pendente **daquela
   planilha**:
   ```sql
   update public."TL_SYNC_ANALISE"
      set status = 'erro', finished_at = now(), erro = 'Recusado pelo porteiro; encerrado manualmente.'
    where sync_id = '<sync_id da mensagem>';
   ```
3. No Apps Script da planilha, limpe o estado local:
   - incremental: rode `limparEstadoLocalAnalisesIncremental` com o argumento
     `'LIMPAR_ESTADO_LOCAL'` (crie uma função de uma linha que a chame, se
     preferir);
   - FULL: em **Configurações do projeto > Propriedades do script**, apague
     `ANALISES_SYNC_LOTES_CLIENT_V1`.
4. Rode o envio manual de novo (ou espere o próximo ciclo do orquestrador).

## Conferir no banco

No SQL Editor do Supabase (só leitura):

```sql
-- últimos envios de cada planilha
select "CO_PLANILHA", origem, modo, status, created_at, finished_at,
       resultado->>'analises_editais_inativados' editais_inativados,
       resultado->>'fato_analises_inativadas' analises_inativadas, erro
  from public."TL_SYNC_ANALISE"
 order by id desc
 limit 20;

-- o que cada planilha tem ativo
select "CO_PLANILHA", "CO_AREA", ativo, count(*)
  from public."TB_ANALISE_CURRICULAR"
 group by 1, 2, 3 order by 1, 2, 3;

select "CO_PLANILHA", grupo, unidade, edital, ativo
  from public."TB_EDITAL_ANALISE"
 order by 1, ativo desc, edital;
```

Depois do primeiro envio de Projetos, a contagem de ativos da Saúde Indígena
tem de ser a mesma de antes.

## Diferenças encontradas no "Atualizar base" de Projetos

As funções que o orquestrador chama existem com os mesmos nomes
(`atualizarDimVagasESincronizar`, `processarLoteSincronizacaoAnalises_`,
`limparGatilhosSincronizacaoAnalises_`, e `META_PAINEL` com `last_run_status`
SUCCESS/NO_CHANGES/ERROR/PARTIAL/BLOCKED/STALE_RESET/CANCELLED). Diferenças em
relação ao da Saúde Indígena, que **não impedem** o funcionamento:

- `atualizarDimVagasESincronizar` não devolve o resumo da FATO: o orquestrador
  espera o próximo ciclo de 5 minutos para enviar, em vez de enviar na hora.
- Não existe `reconciliarFatoComDimVagasAtivas_`: análises de vagas desativadas
  não saem da FATO automaticamente.
- Os gatilhos de continuação são criados com nome terminado em `_`
  (`processarLoteSincronizacaoAnalises_`, `continuarRecalculoStatusFato_`,
  `continuarRecalculoNotasPontuacoesFato_`). O Apps Script não executa gatilho
  com esse nome; a FATO só avança pelo resgate do orquestrador (a cada 8
  minutos sem sinal). Para corrigir, no `CFG` do "Atualizar base" de Projetos
  troque `CONTINUATION_SYNC_TRIGGER_HANDLER` para
  `'processarLoteSincronizacaoAnalises'` (a função pública já vem no
  `4-orquestrador-fato-supabase.gs`).
