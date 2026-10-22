# Apps Script das planilhas de Análises Curriculares

Três planilhas enviam análises para o **mesmo** banco do MONITORA
(o projeto Supabase de produção; a URL vem de quem administra). Cada uma tem uma etiqueta
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
    4-orquestrador-fato-supabase.gs      substitui o orquestrador (Scipts Monitora analises4), desde 07/10/2026
  projetos/
    1-atualizar-base.gs                  o "Atualizar base" (DIM_VAGAS -> FATO_ANALISES); ver nota abaixo
    2-sincronizar-com-supabase-full.gs   novo; substitui o antigo sync (Script Projetos1), que deve ser APAGADO
    3-analises-incremental.gs            novo
    4-orquestrador-fato-supabase.gs      novo (orquestrador igual ao da SI)
  sede/
    2-, 3- e 4-                          os mesmos de Projetos, com as origens da SEDE
```

- O **"Atualizar base"** de cada planilha continua o que está lá (não muda).
- O orquestrador da Saúde Indígena (Scipts Monitora analises4) passou a vir daqui
  em 07/10/2026 (`saude-indigena/4-orquestrador-fato-supabase.gs`): é o de
  Projetos **sem** a função pública `processarLoteSincronizacaoAnalises`, que o
  "Atualizar base" da SI já tem. Ver "Sync incremental não trava" no fim.
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
     `service_role`) do projeto de produção;
   - `SUPABASE_URL` = `https://SEU-PROJETO.supabase.co` (**obrigatória**: o código
     não tem URL fixa; sem a propriedade, o envio para com "Configure a propriedade do
     script SUPABASE_URL…").
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
   - FULL: não é preciso; com o envio encerrado como `erro`, o script descarta
     o estado local sozinho na próxima execução (linha `FULL: estado local do
     sync … descartado` no log). Para forçar, apague `ANALISES_SYNC_LOTES_CLIENT_V1`
     em **Configurações do projeto > Propriedades do script**.
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
- Até 22/10/2026 os gatilhos de continuação eram criados com nome terminado em
  `_`, que o Apps Script não executa (a FATO só avançava pelo resgate do
  orquestrador). Corrigido em `projetos/1-atualizar-base.gs`: ver "Robustez dos
  scripts (22/10/2026)" no fim.

## Nota: nomes repetidos entre arquivos (29/09/2026)

No Apps Script, quando dois arquivos do mesmo projeto definem a mesma função,
vale a do arquivo carregado por último, sem aviso. Em Projetos, o painel web
(Code.gs) e o "Atualizar base" tinham `normalizeHeader_`, `parseDateOnlySafe_`,
`getTodayDateOnly_` e `formatDateOnlyPtBr_` com comportamentos diferentes. Quando
a ordem dos arquivos mudou, o Atualizar base passou a ler `pasta_origem_link`
como vazio ("Linha de DIM_EDITAIS ignorada por edital ou pasta vazios") e
encontrava 0 vagas. `projetos/1-atualizar-base.gs` usa nomes próprios
(`normalizarCabecalhoAB_`, `parseDataSemHoraAB_`, `hojeSemHoraAB_`,
`formatarDataPtBrAB_`). Ao colar código novo num projeto, confira se não há
função com o mesmo nome em outro arquivo.

## Entrevistas → MONITORA

A carga das entrevistas não é mais Apps Script (30/09/2026): o GitHub Actions
lê a aba `Entrevistados` da planilha **"[dash] entrevistados"** com a conta de
serviço do Google, todo dia às 9h (`scripts/sincronizar-entrevistas.mjs`). Como
operar: `docs/sincronizacao-das-planilhas.md`.

Na planilha continua só o script "Cruzamento de entrevistados", que monta a aba
`Entrevistados` (as pastas das planilhas de vaga não são da conta
`dados.recursoshumanos`). Ele não está neste repositório.

## Sync incremental travado por "A planilha mudou" (30/09/2026)

Em 29/09, às 15h07, um sync incremental da Saúde Indígena pausou no meio da
comparação (fase COMPARING, nenhuma linha enviada). Na execução seguinte a
planilha já tinha mudado (a equipe continua trabalhando) e o script parava a
cada gatilho com "A planilha mudou durante um sync incremental pendente": 17 h
sem sincronizar, análises concluídas aparecendo como pendentes no painel.

Agora, nas fases INIT e COMPARING (nada preparado nem processado no banco), o
`3-analises-incremental.gs` das três planilhas recomeça a comparação com a
planilha atual e apaga o staging daquele sync. Depois da preparação a trava
continua (aí misturar planilhas seria errado).

## Sync incremental não trava (07/10/2026)

**O que aconteceu (06–07/10).** Um sync incremental da Saúde Indígena (log
`TL_SYNC_ANALISE` id 5065) parou no meio da comparação: o orquestrador já tinha
gastado a maior parte dos 30 min da execução atualizando a FATO e o incremental
foi cortado. O banco recusava um sync novo enquanto aquele estivesse
`carregado`, e nada o encerrava: ~16 h sem sincronizar. Depois que a linha foi
marcada `erro` à mão, o script continuava tentando retomar o sync guardado
(`"Status remoto nao permite retomada: erro"`) até alguém apagar a propriedade
`ANALISES_SYNC_INCREMENTAL_CLIENT_V1`.

**O que mudou.**

- **Banco** (`supabase/migrations/20261007170000_sync_de_analises_nao_trava.sql`):
  execução `carregado`/`processando` **sem progresso há mais de 30 min** é
  encerrada como `erro` com a mensagem "Execução encerrada por inatividade…"
  quando outra da mesma planilha pede para começar, e também por uma tarefa do
  banco a cada 10 min (`agsus_analises_encerrar_inativas`). Nada é apagado.
  Duas execuções ao mesmo tempo da mesma planilha continuam impossíveis. No
  **Status das atualizações** a execução aparece como "Encerrada por inatividade".
- **`3-analises-incremental.gs`** (as três planilhas): se o banco disser que o
  sync guardado não pode seguir (`erro`, inexistente) ou se não houver
  progresso há mais de 30 min, o script **descarta o estado local e começa um
  sync novo na mesma execução**, com a linha
  `Incremental: estado local do sync … descartado: …` no log.
- **`4-orquestrador-fato-supabase.gs`** (as três planilhas): não espera um sync
  em `erro` (esquece o `sync_id` e segue com um novo) e, se a FATO já consumiu
  20 min da execução, deixa o incremental para a próxima verificação de 5 min
  em vez de estourar os 30 min do Apps Script.

**Colar nas planilhas** (só depois de a migration estar aplicada no banco):

1. Abra a planilha > **Extensões > Apps Script**.
2. Abra o arquivo do incremental (começa com "Sincronizacao incremental" ou
   "PLANILHA … - sincronizacao incremental"), apague tudo e cole:
   - Saúde Indígena: `saude-indigena/3-analises-incremental.gs`
   - Projetos: `projetos/3-analises-incremental.gs`
   - SEDE: `sede/3-analises-incremental.gs`
3. Abra o arquivo do orquestrador (começa com "orquestrador automatico" ou
   `const FATO_SUPABASE_ORQ_CFG`), apague tudo e cole:
   - Saúde Indígena: `saude-indigena/4-orquestrador-fato-supabase.gs`
   - Projetos: `projetos/4-orquestrador-fato-supabase.gs`
   - SEDE: `sede/4-orquestrador-fato-supabase.gs`
4. Salve (Ctrl+S). Os nomes das funções são os mesmos: não mexa nos
   acionadores nem nas propriedades.
5. Confira em **Execuções** o próximo `orquestrarFatoESupabaseAgendado`.

**Se ainda assim travar** (não deveria; o banco e o script se destravam sozinhos
em até ~40 min):

1. No banco (SQL Editor), veja o pendente da planilha:
   `select id, sync_id, status, updated_at from public."TL_SYNC_ANALISE" where status in ('carregado','processando') order by id desc;`
2. Para encerrar já, sem esperar os 30 min (nada é apagado):
   `select public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(null, 30);` encerra só os
   parados há mais de 30 min; um parado há menos, encerre como em "Envio
   recusado" acima (`update … set status = 'erro' …`).
3. No Apps Script não é preciso apagar nada: o script descarta o estado na
   próxima execução. Se quiser forçar, rode `limparEstadoLocalAnalisesIncremental`
   com `'LIMPAR_ESTADO_LOCAL'` (ou apague a propriedade
   `ANALISES_SYNC_INCREMENTAL_CLIENT_V1` em **Configurações do projeto >
   Propriedades do script**).

## Planilha igual ao último envio: nada vai ao banco (14/10/2026)

**Por quê.** O Supabase do MONITORA está no plano gratuito (egress e logs
limitados). Em 13–14/10 o incremental rodava ~220 vezes por dia (Projetos a cada
10 min, Saúde Indígena a cada 20 min), quase sempre sem nenhuma linha alterada, e
cada execução fazia dezenas de requisições (a SI manda o manifesto das ~10.300
linhas em lotes de 300 para `comparar_analises_incremental_v2`).

**O que mudou** (`3-analises-incremental.gs`, as três planilhas; marcado
`[sem-mudanca]`): depois de um envio confirmado, o script guarda o hash da
planilha (`ANALISES_SYNC_INCREMENTAL_ULTIMO_V1` nas Propriedades do script). No
ciclo seguinte, sem sync guardado e com a planilha igual (mesmo hash) há menos de
6 horas, ele **não chama o banco** e responde "processado, sem mudança" ao
orquestrador (`Incremental: Planilha igual ao ultimo envio confirmado; nada
enviado ao banco.` no log). Mudou qualquer linha de `FATO_ANALISES` ou
`DIM_EDITAIS`, ou passaram 6 horas, o sync roda como antes.
`limparEstadoLocalAnalisesIncremental('LIMPAR_ESTADO_LOCAL')` apaga também o hash
(força o próximo envio). Para aplicar: colar o `3-analises-incremental.gs` novo nas
três planilhas (não precisa reinstalar gatilho).

## Robustez dos scripts (22/10/2026)

**O que mudou** (marcas no código entre colchetes):

- **FULL não adota incremental** (`2-sincronizar-com-supabase-full.gs`, as três
  planilhas, `[so-full]`): a busca do "sync pendente da planilha" não olhava o modo e o
  FULL adotava um `INCREMENTAL_ACTIVE` parado. Finalizar um incremental como FULL
  desativaria tudo o que não estava no staging (só as linhas alteradas). Agora o FULL
  recusa ("Existe um sync INCREMENTAL_ACTIVE desta planilha pendente… O FULL não o
  adota") e só cria, retoma e finaliza sync `FULL`. O banco recusa também
  (`supabase/migrations/20261022140000_full_nao_processa_sync_incremental.sql`).
- **FULL descarta estado local órfão** (`[nao-trava]`, como o incremental): se o sync
  guardado em `ANALISES_SYNC_LOTES_CLIENT_V1` sumiu do banco, terminou em `erro`
  (inclusive "encerrada por inatividade") ou é de outro modo, o estado sai sozinho
  (`FULL: estado local do sync … descartado: …` no log). Nada é apagado no banco.
- **Sem URL fixa** (`[sem-url-fixa]`): `DEFAULT_SUPABASE_URL` e `SUPABASE_URL_FIXA`
  saíram (apontavam para o projeto antigo, desativado). A URL vem só da propriedade
  `SUPABASE_URL`; sem ela, erro claro antes de qualquer requisição.
- **Incremental já processado conclui primeiro** (`3-analises-incremental.gs`,
  `[processado-primeiro]`): se o banco diz `processado`, o script conclui e limpa
  antes de comparar com a planilha. Antes, uma planilha alterada depois do envio dava
  "A planilha mudou durante um sync incremental pendente".
- **PARTIAL não trava o incremental** (`4-orquestrador-fato-supabase.gs`,
  `[parcial-nao-trava]`): o "Atualizar base" grava `PARTIAL` quando a FATO foi
  promovida mas algumas vagas deram erro (essas ficam com as linhas anteriores). Uma vaga
  com erro persistente deixava todo ciclo em PARTIAL e o incremental nunca mais rodava.
  Agora PARTIAL segue para o incremental **se** `last_success_at` e
  `last_run_finished_at` da `META_PAINEL` foram gravados juntos (até 2 min de
  diferença: a FATO foi promovida nesta execução). PARTIAL sem essa confirmação,
  ERROR, BLOCKED, STALE_RESET e CANCELLED continuam bloqueando.
- **Gatilhos públicos** (`projetos/1-atualizar-base.gs`, `[gatilho-publico]`): os
  gatilhos de continuação passam a chamar `processarLoteSincronizacaoAnalises` (vem no
  `4-orquestrador-fato-supabase.gs`), `continuarRecalculoStatusFato` e
  `continuarRecalculoNotasPontuacoesFato`. Um gatilho antigo com `_` é trocado pelo
  novo no próximo agendamento e sai na limpeza.
- **Fuso fixo** (`[fuso]`): `Utilities.formatDate`/`parseDate` usam
  `America/Sao_Paulo` (constante `FUSO_HORARIO`), não o fuso do projeto. Se algum
  projeto estava em outro fuso, as datas sem hora mudam uma vez e o incremental reenvia
  essas linhas no primeiro ciclo.

Testes: `tests/apps-script-analises-full.test.js` (e o do incremental).

**Ordem para aplicar:**

1. Banco: aplicar `20261022140000_full_nao_processa_sync_incremental.sql` (o ensaio
   está em `supabase/ensaios/`) e registrar, como em `supabase/migrations/README.md`.
   Os scripts atuais continuam funcionando com ela (o incremental passa pelo próprio
   caminho; só o FULL com sync incremental é recusado).
2. Em cada planilha, conferir em **Configurações do projeto > Propriedades do script**
   que `SUPABASE_URL` existe (rode `verificarConfiguracaoSupabaseAnalisesCurriculares`).
3. Colar os arquivos (apagar tudo e colar), salvar:
   - Saúde Indígena: `saude-indigena/2-`, `3-` e `4-`;
   - Projetos: `projetos/1-atualizar-base.gs`, `2-`, `3-` e `4-`;
   - SEDE (quando existir): `sede/2-`, `3-` e `4-`.
   Não é preciso reinstalar o gatilho do orquestrador.
4. Acompanhar em **Execuções** o próximo `orquestrarFatoESupabaseAgendado`.
