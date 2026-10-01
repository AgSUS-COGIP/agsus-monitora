# Banco de dados — estado, convenções e o que falta reconciliar

Levantamento de 08/09/2026. Escrito durante o saneamento arquitetural, seguindo
os princípios já usados no SIGAV: **uma fronteira conhecida para dados e
autorização**, e **um repositório capaz de reconstruir o banco**.

> O levantamento do repositório foi feito em 08/09/2026. O **inventário vivo** da
> seção 4 foi conferido no Supabase real pela equipe durante a revisão do PR #154;
> o ambiente onde este documento foi escrito não tinha credenciais, e por isso
> cada número dessa seção vem da conferência externa, não de execução local.

## 1. Convenção de nomes das migrations

A partir de agora:

```
supabase/migrations/AAAAMMDDHHMMSS_descricao_em_minusculas.sql
```

Timestamp de 14 dígitos e descrição no infinitivo dizendo o efeito, não o meio
(`recusar_solicitacao_acesso_por_rpc`, não `fix_rpc`). Toda migration abre com
`begin;`, fecha com `commit;`, é idempotente (`create or replace`,
`create ... if not exists`) e traz no cabeçalho, em comentário: o motivo, os
**dependentes** e o **rollback**.

Três ficheiros existentes ficam fora do padrão e **não devem ser renomeados** —
já foram aplicados, e renomear quebraria o histórico de quem os aplicou:

| Ficheiro                                             | Problema      |
| ---------------------------------------------------- | ------------- |
| `20260624_access_requests_and_panel_permissions.sql` | data sem hora |
| `add_update_user_access_rpc.sql`                     | sem timestamp |
| `restrict_access_management_to_master.sql`           | sem timestamp |

### 1.1 O registro do que já foi aplicado

O parágrafo acima dizia que renomear esses três ficheiros "quebraria o histórico
de quem os aplicou". Esse histórico não existia em lado nenhum além das pessoas.

Agora existe, em `public.migracoes_aplicadas`: caminho do ficheiro, **sha256 do
conteúdo**, origem e data. A ideia é do SIGAV, que mantém
`sigav."TB_MIGRACAO"` desde agosto de 2026.

```
npm run db:estado                       # o que falta aplicar
npm run db:estado -- --registrar=<caminho>
npm run db:estado -- --registrar-todas-pendentes
```

O script lê `supabase/migrations/` e `supabase/correcoes/` e responde quatro
coisas:

| Estado         | O que significa                                    |
| -------------- | -------------------------------------------------- |
| **aplicado**   | caminho e hash batem com o registro                |
| **pendente**   | está no disco e não no banco                       |
| **divergente** | foi aplicado e o ficheiro **mudou depois**         |
| **órfão**      | está registado e o ficheiro já não existe no disco |

A divergência é o que só o hash encontra, e é a mais perigosa: alguém corrige um
erro de digitação numa migration já aplicada, o Git fica coerente, o banco não, e
ninguém descobre até um ambiente novo nascer diferente.

**Por que não há modo `--aplicar`.** O SIGAV tem; aqui não. Neste projeto quem
executa SQL no banco é a equipa, e o que faltava era saber o estado — não
automatizar a escrita. `--registrar` marca como aplicado **sem executar nada**,
que é o caso de tudo o que já estava no banco antes desta tabela existir.

**Credencial.** `SUPABASE_DB_URL`, a mesma de `check:rpc-contract:db`. A tabela
tem RLS ligada e nenhuma policy: nem `anon` nem `authenticated` a alcançam. É
ferramenta de operação, não superfície da aplicação.

**Carga inicial.** Depois de aplicar
`20260922144500_criar_registro_de_migracoes_aplicadas.sql`, correr
`--registrar-todas-pendentes` uma vez marca tudo o que já está no banco. A
partir daí, marcar uma a uma — marcar sem ter aplicado é a única forma de este
registro passar a mentir.

## 2. Fronteira de dados: o que o frontend acessa

### 2.1 Acesso direto a tabelas

Onze pontos, em oito tabelas. Nove são leitura.

| Tabela                        | Operação   | Onde                                                        |
| ----------------------------- | ---------- | ----------------------------------------------------------- |
| `monitoramento_indigena`      | select     | `modules/health-status-details.js`, `modules/legacy-app.js` |
| `solicitacoes_acesso`         | select ×3  | `modules/legacy-app.js`                                     |
| `solicitacoes_acesso`         | **insert** | `modules/legacy-app.js` — pedido que a própria pessoa faz   |
| `solicitacoes_acesso_paineis` | **insert** | `modules/legacy-app.js` — painéis do próprio pedido         |
| `configuracoes`               | select     | `modules/legacy-app.js`                                     |
| `dim_unidades`                | select     | `modules/legacy-app.js`                                     |
| `paineis_externos`            | select     | `modules/legacy-app.js`                                     |
| `perfis_paineis_externos`     | select     | `modules/legacy-app.js`                                     |
| `perfis_usuarios`             | select     | `modules/legacy-app.js`                                     |

As duas escritas restantes **ficam para uma segunda etapa**, com o risco
registado: o corpo do `insert` é montado no navegador e inclui `status` e
`perfil_solicitado`. Hoje só a RLS impede que alguém envie
`status: "aprovado"`. Substituí-las por uma RPC `registrar_solicitacao_acesso`
levaria essa decisão para o mesmo lugar onde já estão aprovar e recusar.

A escrita de **recusa** foi convertida em `20260908181500` — era a única decisão
administrativa que o navegador ainda gravava direto, enquanto aprovar, atualizar,
desativar e revogar já passavam por RPC.

### 2.2 RPCs

O mapa único está em [`src/lib/rpc-contrato.js`](../src/lib/rpc-contrato.js), com
argumentos esperados, resumo e criticidade. `npm run check:rpc-contract` valida:

`npm run check:rpc-contract` — **estático, em todo build**: nenhuma chamada usa
nome fora do contrato; nenhuma entrada ficou órfã. Sem rede, sem credencial.

`npm run check:rpc-contract:db` — **job próprio, fora do build**: lê o catálogo do
PostgreSQL e confere existência, assinatura e quem tem `EXECUTE`. Ver 4.3.

## 3. O que falta reconciliar

Duas perguntas diferentes, e é importante não as confundir.

**Existem no banco?** Sim. A conferência de 08/09/2026 no Supabase real encontrou
**22 das 23** funções do contrato; a única ausente é
`recusar_solicitacao_acesso`, criada pela migration deste PR e ainda não
aplicada. Das 22 existentes, **21 não são executáveis por `anon`** — são funções
de `authenticated`, como se espera.

**Estão versionadas aqui?** Não. **13 das 23 não têm migration neste
repositório** — sete delas críticas. Foram aplicadas manualmente.

Sem migration (⚠ = crítica):

- ⚠ `usuario_pode_ler_analises`
- ⚠ `salvar_configuracoes_e_paineis`
- ⚠ `salvar_configuracoes_e_paineis_v2`
- ~~`salvar_monitoramento_indigena`~~ (removida em `20260925150000_remove_objetos_mortos.sql`)
- ⚠ `salvar_monitoramento_com_cronograma_v2`
- ⚠ `get_monitoramento_cronograma`
- ⚠ `get_analises_dashboard_payload_v2` (hoje em `20260928240000`)
- `get_acessos_config_master`
- `get_configuracoes_snapshot`
- `get_configuracoes_historico`
- `restaurar_configuracoes_versao`
- `get_nucleo_cronograma_resumo`
- `registrar_evento_acesso`

Consequência prática: **o repositório não reconstrói o banco.** Um ambiente novo
sobe sem essas funções, e o sistema falha em Configurações, Análises e Equipe
Núcleo.

### Como fechar a lacuna

`npm run db:capturar-baseline` faz exatamente isto, e nada além: lê
`pg_get_functiondef` das funções do contrato que não aparecem em nenhuma
migration e escreve
`supabase/migrations/AAAAMMDDHHMMSS_baseline_funcoes_existentes.sql`, com os
`grant execute` tal como estão hoje. Sessão somente-leitura; o ficheiro fica para
revisão humana e **nada é aplicado**.

A regra que o script existe para cumprir: **nenhuma função escrita de memória.**
Um corpo aproximado apagaria trabalho que ninguém tem versionado em lugar algum,
e o apagão só apareceria semanas depois, quando alguém notasse o comportamento
diferente.

Fica registado o caminho manual equivalente, para quem preferir conferir à mão:

O caminho é o mesmo do SIGAV: uma **migration de linha de base** que captura o
estado vivo, sem inventar nada. Com credenciais de leitura:

```sql
-- Executar no Supabase, em sessão somente-leitura, e guardar a saída:
set session characteristics as transaction read only;
select pg_get_functiondef(p.oid) || E';\n'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.proname;
```

O resultado vira `AAAAMMDDHHMMSS_baseline_funcoes_existentes.sql`, com
`create or replace` — idempotente e sem efeito em quem já tem as funções.

**Não escrever essas definições de memória.** Uma função redefinida com corpo
aproximado apaga trabalho que não está no repositório.

## 4. Inventário vivo

Conferido no Supabase real em 08/09/2026, durante a revisão do PR #154.

| Objeto                                      | Quantidade     |
| ------------------------------------------- | -------------- |
| Tabelas no schema `public`                  | **24**         |
| Tabelas com RLS ativa                       | **24 — todas** |
| Funções                                     | **52**         |
| Funções `SECURITY DEFINER`                  | **30**         |
| `SECURITY DEFINER` sem `search_path` fixado | **0**          |

Os dois últimos números merecem registo: `SECURITY DEFINER` sem `search_path`
fixado é o vetor clássico de escalada de privilégio em PostgreSQL, e **nenhuma
das 30 funções está nessa condição**. É um ponto forte da base atual, não uma
pendência.

### 4.1 O acesso de `anon` a `configuracoes`

Conferido no banco principal em 09/09/2026, e registado aqui porque uma versão
anterior deste documento afirmava o contrário.

**`anon` tem `select` em `public.configuracoes`.** A RLS está ligada e a policy
`config_select_anon_safe` limita a leitura a dez chaves inócuas:

`app_version_current`, `footer_text`, `cogip_nome`, `cogip_funcao`,
`cogip_versao`, `cogip_dept`, `cogip_logo_url`, `auth_google_enabled`,
`auth_google_button_text`, `auth_google_domain_hint`.

Nenhuma delas é a arte de fundo, o logotipo, a cor do painel, a saudação ou a
instrução — que é por isso que a tela de acesso precisou de
`obter_branding_acesso_publico()` para as cinco que faltam.

**Não revogar este grant.** Ele é anterior a este trabalho e há consumidores
legítimos; qualquer redução pertence à etapa de saneamento de grants, depois do
inventário completo.

Medição que importa para o diagnóstico, feita no banco real:

| `Authorization` enviado        | `GET /configuracoes` | `POST /rpc/…`                              |
| ------------------------------ | -------------------- | ------------------------------------------ |
| chave publicável (role `anon`) | **200**, 10 chaves   | 404 `PGRST202` (função ainda não aplicada) |
| JWT expirado / indecifrável    | **401** `PGRST301`   | **401** `PGRST301`                         |

A segunda linha é a razão de a chamada pública de branding não usar o cliente
compartilhado: uma sessão corrompida no armazenamento faria a requisição falhar
com 401 **mesmo tendo `anon` o `execute` concedido**. Ver
`src/lib/access-branding-publico.js`.

### 4.2 Seis tabelas com RLS e sem policy — não mexer

Existem seis tabelas com RLS ativa e nenhuma política definida. Com RLS ligada e
sem policy, a tabela nega tudo para roles comuns.

**Isto não é um defeito a corrigir automaticamente.** Essas tabelas **não têm
grant direto para `authenticated`**, o que é exatamente o desenho de quem quer a
tabela fechada e alcançável apenas por RPC `SECURITY DEFINER` ou por
`service_role`. Acrescentar policies "para destravar" abriria acesso direto que
alguém fechou de propósito — o oposto do princípio deste documento.

Antes de qualquer mudança nelas, responder: quem lê e quem escreve hoje, e por
qual caminho. Só então decidir entre manter fechada, criar RPC ou abrir policy.

### 4.3 O que ainda não foi levantado

| Item                           | Como levantar                                                 |
| ------------------------------ | ------------------------------------------------------------- |
| Grants por tabela e por função | `information_schema.role_table_grants`, `role_routine_grants` |
| Políticas RLS, uma a uma       | `pg_policies`                                                 |
| Índices                        | `pg_indexes`                                                  |
| Triggers                       | `information_schema.triggers`                                 |
| Dependências entre objetos     | `pg_depend`                                                   |
| Migrations aplicadas           | tabela de controlo do Supabase                                |

Só depois desse levantamento faz sentido a etapa seguinte do item 7: **propor a
redução dos grants de `authenticated` e `anon`**. Reduzir agora, sem saber quem
consome o quê no banco, quebraria consumidores invisíveis a partir do repositório.

### 4.4 Verificação automatizada do contrato

`npm run check:rpc-contract:db` consulta `pg_proc` por conexão direta e compara
com [`src/lib/rpc-contrato.js`](../src/lib/rpc-contrato.js): quais funções
existem, se aceitam os parâmetros declarados, e quais roles têm `EXECUTE`.

Precisa de `SUPABASE_DB_URL` — **segredo de CI ou de servidor**. Nunca uma
variável `VITE_*`: tudo com esse prefixo entra no bundle e vai para o navegador.
A sessão é aberta como somente-leitura.

> **Por que não pelo PostgREST.** A primeira versão desta verificação lia a
> especificação OpenAPI de `/rest/v1/` com a chave publicável. Estava errada: o
> OpenAPI do PostgREST **reflete os privilégios da role que pergunta**. Com
> `anon`, 21 das 22 funções que existem ficam invisíveis, porque são de
> `authenticated` — a verificação acusaria ausência de funções presentes. Usar a
> chave publicável como cabeçalho de autorização não resolve: ela não é token de
> usuário autenticado. Por isso a verificação viva saiu do build, virou job
> próprio e passou a ler o catálogo.

Rodar primeiro contra um Supabase de desenvolvimento ou branch; só depois contra
produção.

### 4.5 Validação da migration de recusa

`npm run db:validar-recusar -- --antes` confere os pré-requisitos estruturais:
`private.is_master()`, as colunas de `solicitacoes_acesso`, o gatilho
`trg_solicitacoes_acesso_updated_at` e que a função ainda não existe.

`npm run db:validar-recusar -- --depois` confere, já com a migration aplicada:
assinatura, retorno, `search_path` fixado, `EXECUTE` concedido **apenas** a
`authenticated`, e o comportamento — usuário não-master é recusado, e solicitação
já avaliada não é decidida duas vezes.

As duas verificações de comportamento precisam **chamar** a função, e chamar é
escrever. Por isso cada uma corre dentro de uma transação que sempre termina em
`rollback`, inclusive quando passa. Nenhuma linha muda de estado, e
`tests/verificadores-de-contrato.test.js` falha se algum `begin` deixar de ter o
seu `rollback`.

## 5. Conexão ao `db_dataware` corporativo

O SIGAV fala direto com o PostgreSQL corporativo porque tem servidor. O Monitora
é uma aplicação de página única servida estaticamente: **o bundle Vite vai
inteiro para o navegador**. Qualquer credencial PostgreSQL colocada aqui fica
legível para quem abrir a página.

Se essa integração for desejada, ela exige uma camada servidor — Vercel Function,
Edge Function do Supabase ou backend equivalente — que guarde a credencial e
exponha só as consultas necessárias. O frontend continuaria falando com essa
camada pelo mesmo contrato de RPC deste documento.

Nada disso foi iniciado. Nenhuma migração de produção para o `db_dataware` deve
acontecer sem autorização explícita.

## 6. Análises curriculares: sincronização por planilha

Migration `20260928140000_sync_de_analises_por_planilha.sql` (rollback em
`supabase/rollback/`); passo a passo das planilhas em `apps-script/LEIA-ME.md`.

As planilhas Google de cada área (Saúde Indígena, Projetos e, no futuro, SEDE)
enviam para as **mesmas** tabelas. Cada linha leva a etiqueta da planilha que a
enviou, e só o envio dessa planilha a altera ou desativa.

| Objeto                                           | Papel                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `TB_PLANILHA_ANALISE`                            | cadastro: `CO_PLANILHA` (saude-indigena, projetos, sede), `CO_AREA`, `NO_PLANILHA`, `DS_PLANILHA_ID` (arquivo no Drive)               |
| `TA_ORIGEM_ANALISE`                              | `CO_ORIGEM` (a constante `ORIGEM` do Apps Script, gravada em `TL_SYNC_ANALISE.origem`) → `CO_PLANILHA`, `TP_CARGA` (FULL/INCREMENTAL) |
| `"CO_PLANILHA"`                                  | em `TB_ANALISE_CURRICULAR`, `TB_EDITAL_ANALISE` e `TL_SYNC_ANALISE`, NOT NULL, FK                                                     |
| `experiencia_profissional_anos/meses/dias/total` | colunas do Edital 30/2026 (Projetos) em `TB_ANALISE_CURRICULAR`                                                                       |

As duas tabelas novas têm RLS com leitura para `authenticated`; escrita só por
migration. Cadastrar planilha ou origem nova = migration nova.

**Fluxo.** O Apps Script grava staging em `TM_ANALISE_CURRICULAR` e chama as
RPCs. O banco descobre a planilha pela origem do log (`TL_SYNC_ANALISE.origem`
→ `TA_ORIGEM_ANALISE`):

- **Origem não cadastrada**: recusada no insert do log (gatilho
  `trg_analises_sync_guard_before_insert`, caminho do FULL) e em
  `iniciar_sync_analises_incremental` (que também exige origem INCREMENTAL).
- **Porteiro** (`FC_VALIDAR_GRUPO_STAGING_ANALISE`): qualquer linha de
  `FATO_ANALISES` ou `DIM_EDITAIS` com `grupo` diferente de
  `TB_AREA."NO_GRUPO_PLANILHA"` da área da planilha recusa o sync inteiro. Roda
  no `preparar_sync_analises_incremental`, no primeiro lote do FULL e nos dois
  `finalizar_*`; cada lote ainda confere as linhas que vai gravar.
- **Isolamento**: os `finalizar_*` só desativam editais (e, no FULL, análises)
  com `"CO_PLANILHA"` = planilha do sync. Upsert que encontre a mesma chave
  etiquetada com outra planilha recusa o sync.
- **Filas por planilha**: lock consultivo `hashtext('public.processar_sync_analises:' || planilha)`
  e "um sync pendente por planilha" (no `iniciar` e no gatilho do log). Planilhas
  diferentes enviam ao mesmo tempo.
- `verificar_sync_analises_incremental` conta só a planilha da origem.

**Compatibilidade.** `iniciar_sync_analises_incremental` e
`verificar_sync_analises_incremental` ganharam `p_origem text` com default =
`apps_script_analises_incremental_v1` (a SI). A assinatura antiga saiu na mesma
transação, para o PostgREST não ter duas sobrecargas. Os JSON devolvidos
mantêm as chaves e ganharam `planilha`. O script da SI sem mudança continua
funcionando.

**Auxiliares em `public`.** As RPCs incrementais são SECURITY INVOKER e rodam
como `service_role`, que não tem USAGE em `private` nem SELECT em `TB_AREA`.
Por isso `FC_PLANILHA_DA_ORIGEM_ANALISE`, `FC_PLANILHA_DO_SYNC_ANALISE` e
`FC_VALIDAR_GRUPO_STAGING_ANALISE` ficam em `public`, SECURITY DEFINER,
`search_path` vazio, com EXECUTE só para `service_role`.

**Envio recusado pelo porteiro** fica pendente (status `carregado`) e o
script da planilha repete a recusa a cada ciclo: não há recuperação
automática, de propósito. Corrige-se a planilha e reconcilia-se à mão
(`apps-script/LEIA-ME.md`, "Envio recusado"). As outras planilhas não são
afetadas, porque a fila é por planilha.

### 6.1 O painel de análises por área

Migration `20260928180000_analises_do_painel_por_area.sql` (rollback em
`supabase/rollback/`, que volta às versões de `20260928170000`).

Saúde Indígena, SEDE e Projetos usam o **mesmo** painel (`analises.html`). O
MONITORA abre o painel com a área atual do menu na URL (`?area=`); sem área, é o
da Saúde Indígena.

- `get_analises_dashboard_payload_v2(p_scope, p_area)` e
  `get_analises_dashboard_filtrado(…, p_include_total, p_area)`: `p_area` tem
  padrão `'saude-indigena'`, então a chamada sem ela devolve o mesmo que antes
  (ensaiado: linhas e editais da Saúde Indígena idênticos). As assinaturas
  antigas saíram na mesma transação.
- A área tem de existir em `TB_AREA` (senão `22023`) e ser do usuário
  (`FC_PODE_AREA`) ou o usuário ser admin (senão `42501`). A regra fica em
  `private."FC_GRUPOS_ANALISES_DA_AREA"`, sem EXECUTE para os papéis da API.
- Linhas e editais são os do grupo da planilha da área
  (`TB_AREA."NO_GRUPO_PLANILHA"`). O front lê o catálogo de `TB_EDITAL_ANALISE`
  por `"CO_PLANILHA"` = área.
- O payload ganhou, **no fim** de `columns`, `experiencia_profissional_anos`,
  `_meses`, `_dias` e `_total` (em dias), e as chaves `area` e `area_nome`. O
  front monta as linhas pelo nome da coluna, então a ordem antiga não mudou.
  No filtrado, as mesmas quatro entram como chaves a mais em cada linha.

### 6.2 O painel de análises mais leve

Migration `20260928200000_analises_painel_mais_leve.sql` (rollback em
`supabase/rollback/`, que volta às versões de `20260928180000`; ensaiado).

- O payload da lista (`get_analises_dashboard_payload_v2`, `schema_version` 3)
  não traz mais `analise` (o parecer) nem `chave_natural`. Na Saúde Indígena
  ativa, 7,1 MB → 3,6 MB (gzip: 669 KB → 365 KB); em Projetos, 1,4 MB → 0,8 MB.
  O front monta as linhas pelo nome da coluna e aceita linha com ou sem
  `analise` (o filtrado, o fallback pela view e o cache antigo ainda trazem).
- O parecer vem sob demanda: `get_analise_detalhe_do_painel(p_id)` ao abrir o
  detalhamento, e `get_analises_texto_do_painel(p_scope, p_area)` em lote para
  o CSV (que sai igual ao de antes) e para a busca geral, que também procura no
  parecer. Mesma permissão da lista: `pode_recurso('analises')` e área do
  usuário (`FC_PODE_AREA`) ou admin; no detalhe, a área é a do grupo da linha.
- O recorte por área (e, no filtrado, por unidade e edital) compara as colunas
  geradas `*_norm` da tabela, em vez de chamar `analises_norm_key` linha a
  linha (a função tem `SET search_path` e não é embutida pelo planejador).
- As RPCs da lista devolvem `json` (montado com `json_agg`/`json_build_*`),
  não `jsonb`: mesmo conteúdo, montagem mais rápida (Saúde Indígena ativa:
  ~380 ms → ~150 ms no banco, no ensaio).
- Fora da Saúde Indígena, o payload ganha `municipio_uf` no fim de `columns`,
  lido do nome da vaga ("… UBS móvel Seropédica/RJ …" → `Seropédica/RJ`).

### 6.3 Cache do painel de análises (servidor e navegador)

Migration `20260928240000_cache_do_painel_de_analises.sql` (rollback em
`supabase/rollback/`, que volta às definições de 28/09/2026; ensaiado, com hash
das funções igual ao de antes).

- `private."TA_PAINEL_ANALISE"` guarda, por área, as linhas e os editais do
  escopo `ativo` já montados em JSON (`DS_LINHAS`, `DS_EDITAIS`, `QT_LINHAS`),
  a versão dos dados usada (`DS_VERSAO_DADOS`), a hora (`DT_GERACAO`) e quanto
  levou (`NU_DURACAO_MS`). Schema `private`, RLS ligada, sem policy e sem grant:
  só funções `SECURITY DEFINER` leem (como as da seção 4.2).
- A montagem saiu de dentro de `get_analises_dashboard_payload_v2` para
  `private."FC_MONTAR_PAINEL_ANALISE"(área, escopo)`, sem mudar o SQL e sem
  checar permissão: a RPC e a remontagem usam a mesma conta.
- `get_analises_dashboard_payload_v2` mantém assinatura, permissão
  (`pode_recurso` + `FC_GRUPOS_ANALISES_DA_AREA`) e conteúdo (md5 de `rows` e
  `editais` igual ao de antes nas três áreas). No `ativo`, devolve o guardado
  (`cache.hit = true`; `generated_at` e `cache.refreshed_at` = hora da
  montagem). `inativo` e `todos` seguem montados na hora.
- O guardado vale enquanto `private."FC_VERSAO_DADOS_ANALISE"(área)` — quantos
  syncs das planilhas da área terminaram e o último `finished_at`, em
  `TL_SYNC_ANALISE` — for a mesma da montagem e ele tiver menos de 40 min.
  Vencido, a RPC remonta (uma abertura por vez, por trava consultiva; as outras
  recebem o guardado anterior) e, se não conseguir gravar, monta na hora.
- Quem remonta: `public.atualizar_cache_painel_analises(p_area default null)`
  (só `service_role`/`postgres`), chamada no fim de
  `finalizar_sync_analises_lotes` e `finalizar_sync_analises_incremental` (a
  área da planilha; erro vira aviso, o sync não falha), pelo pg_cron
  `agsus_analises_cache_do_painel` (`7,37 * * * *`, todas as áreas) e pela RPC.
  Sem gatilho por linha (o cache antigo, `TA_DASHBOARD_ANALISE`, era apagado a
  cada escrita do sync).
- Ensaio (Saúde Indígena, 6.828 linhas, 3,5 MB): a RPC levava de 0,6 s (banco
  quente) a 5 s (frio); com o cache, 0,14–0,17 s. Projetos: 0,08–0,5 s →
  0,03 s. A remontagem da Saúde Indígena leva 0,2–0,8 s.
- No navegador, o payload fica no IndexedDB (banco `agsus-monitora-analises`,
  por usuário, área e escopo, amarrado à publicação e ao `schema_version`):
  o painel abre com a cópia e revalida por trás (`analises-consolidated-transport.js`,
  regras em `src/lib/cache-do-painel-de-analises.js`). O MONITORA apaga esse
  banco ao sair pelo botão, em "Limpar sessão", com acesso revogado e quando
  outro usuário entra. O cache antigo do `localStorage`
  (`agsus_analises_cache_*`) é apagado ao abrir o painel.

### 6.4 Lista enxuta e os três escopos prontos

Migration `20260929150000_analises_lista_enxuta.sql` (rollback em
`supabase/rollback/`, que volta às definições que estavam no banco em 29/09,
inclusive o recorte por coordenação aplicado fora do repositório; ensaiado, com
hash das funções, permissões, comentários e colunas iguais aos de antes).

- **Lista (schema_version 4)**: `columns` = `id`, `unidade`, `edital`,
  `codigo_vaga`, `nome_vaga`, `candidato`, `categoria`,
  `modalidade_concorrencia`, `status_consolidado`, `etapa`,
  `responsavel_analise`, `data_analise`, `nota_final_ajustada`, `pdf_status`,
  `tem_pdf`. O envelope ganhou `grupo` (o da área), `edital_status` (do
  escopo), `atualizado_em` (o "Atualizado em" do painel), `versao_dados` e
  `detalhe_sob_demanda`. Saúde Indígena ativa: 3.644 KB → 1.935 KB (gzip
  370 → 306 KB); inativa: 7.804 KB → 3.926 KB (gzip 859 → 633 KB); Projetos
  inativo: 828 KB → 411 KB.
- **O que saiu da linha e onde está**: a janela oficial e a validação, o front
  calcula com `editais[]` (como já fazia quando a linha vinha sem janela); o
  município/UF, o front lê do nome da vaga; pontuações, experiências,
  `link_pdf`, `erro_pdf`, `origem_arquivo_id`, `updated_at`,
  `ultima_atualizacao`, `chave_natural` vêm em
  `get_analise_detalhe_do_painel(p_id)`, ao abrir o registro;
  `get_analises_texto_do_painel` traz, com o parecer, `link_pdf` e o tempo de
  experiência profissional, e o CSV sai igual ao de antes.
- **Três escopos guardados** por área em `TA_PAINEL_ANALISE`, que dividem as
  análises sem sobra nem repetição: `ativo` (análise ativa de edital ativo),
  `inativo` (edital inativo) e `desativadas` (análise desativada pelo sync, de
  edital ativo — só aparece em "Todos"). "Todos" não tem pacote: o front junta
  os três na ordem do banco (unidade, edital, vaga, candidato e, no desempate,
  o id). `private."FC_MONTAR_PAINEL_ANALISE"(área, escopos[], só_visíveis)`
  monta os escopos numa passada pela tabela (Saúde Indígena: 2–4 s os três,
  contra ~5 s só o ativo e ~8 s só o inativo antes).
- **Quem recebe o pronto**: quem vê a área inteira (`FC_EDITAIS_VISIVEIS()`
  nulo). Quem tem recorte por coordenação recebe a lista montada na hora, só
  com o que pode ver. RPC com o pronto: Saúde Indígena ativa 1,6–5,1 s →
  0,03–0,11 s; inativa 0,4–3 s → 0,01–0,07 s.
- **Remontagem**: `atualizar_cache_painel_analises(p_area, p_escopos)` (só
  `service_role`/`postgres`) e o pg_cron `agsus_analises_cache_do_painel`
  (a cada 2 min, `atualizar_cache_painel_analises_vencidos`), que remonta a
  área só quando a versão dos dados muda, falta um escopo ou o pronto tem mais
  de 6 h.
- `get_analises_dashboard_filtrado` saiu: o painel não pede mais o recorte
  (unidades e editais) antes de mostrar Inativo e Todos; os filtros de unidade
  e edital agem sobre as linhas carregadas.
- **No navegador**: uma cópia por escopo no IndexedDB (`ativo`, `inativo`,
  `desativadas`); "Todos" reaproveita as de Ativo e Inativo. A cópia aceita
  `schema_version` 3 e 4.
- **Ordem de publicação**: primeiro o front (aceita o payload de 35 colunas e o
  enxuto; sem o escopo `desativadas` no banco, "Todos" cai na leitura pela
  view), depois a migration. Ao contrário, o front antigo mostraria a lista
  enxuta sem grupo e sem detalhamento, e o Inativo quebraria (sem o filtrado).

## 7. Edital sempre na área certa

Migration `20260928220000_edital_na_area_certa.sql` (rollback em
`supabase/rollback/`, que volta às definições lidas do banco em 28/09/2026 e
**não** desfaz dados: unidades registradas e editais movidos ficam).

Antes, a área do edital (`"CO_AREA"`) era só deduzida pelo gatilho
`TBA_MONITORAMENTO_INDIGENA` (unidade em `TA_UNIDADE_AREA`; senão responsável
CORES → `sede`; senão `saude-indigena`), calada: um edital da SEDE com unidade
desconhecida caía na Saúde Indígena e sumia da tela de quem o criou.

- **Área de uma unidade** (`private."FC_AREA_DA_UNIDADE"`): `TA_UNIDADE_AREA`;
  senão unidade do catálogo `TD_UNIDADE` (DSEI/CASAI) → `saude-indigena`; senão
  desconhecida. O front usa a mesma ordem (`mapaDeAreasDasUnidades`, em
  `src/lib/editais-do-nucleo.js`), lendo `listar_unidades_por_area()`.
- **`salvar_monitoramento_com_cronograma_v2`** — mesma assinatura; a área
  pretendida vai em `p_payload.co_area` (o formulário manda a área do menu no
  edital novo e a do próprio edital ao editar). Com ela: a área tem de existir
  (`22023`) e ser do usuário (`FC_AREAS_USUARIO`, admin tem todas; senão
  `42501`); edital existente só é salvo na área em que está; unidade nova ou
  trocada que é de outra área é recusada ("A unidade X é da área Y; escolha uma
  unidade de Z ou peça ao administrador para mover."); unidade desconhecida é
  registrada em `TA_UNIDADE_AREA` na área pretendida. **Sem `co_area`, tudo como
  antes** — o front já publicado continua funcionando.
- **Gatilho**: no INSERT só deduz se `"CO_AREA"` vier vazio; no UPDATE só deduz
  quando responsável ou unidade mudam de verdade e `"CO_AREA"` não foi trocado
  no mesmo comando. (Antes deduzia a cada salvar, o que desfaria uma mudança de
  área.) Nenhuma linha existente mudou (ensaio: hash de id + área igual antes e
  depois).
- **`mover_edital_de_area(p_id, p_area, p_motivo)`** — só `is_master()`; motivo
  obrigatório; só o edital muda (não `TA_UNIDADE_AREA`). Auditoria em
  `TH_MONITORAMENTO`: `campo_alterado = 'CO_AREA'`, `valor_anterior`,
  `valor_novo`, `snapshot_json = {acao, de, para, motivo}`; quem e quando em
  `usuario_id`, `usuario_email`, `created_at`. O gatilho de histórico grava
  também a foto da linha.
- **Arquivar**: o edital já tem `ativo` (o front lê só `ativo = true`; o
  histórico registra `desativado`). Não há RPC para arquivar pelo app, e esta
  migration não apaga nada.

Ensaio (begin…rollback, produção, 28/09/2026, admin sintético e um
`edital_gestor` da Saúde Indígena): SEDE + unidade SEDE → `sede`; SEDE + Rio
Doce e SEDE + DSEI → recusados (`22023`); Projetos + unidade nova → edital e
`TA_UNIDADE_AREA` em `projetos`; sem área → mesmas áreas de hoje (CORES +
desconhecida continua `sede`, sem registrar); edital existente salvo em outra
área → recusado; mover como admin → área trocada + 1 linha de auditoria, e
salvar de novo (com ou sem área) mantém a área movida; mover sem motivo ou para
a mesma área → recusado; mover e salvar em área alheia como não admin →
`42501`. Migration + rollback devolvem as definições idênticas às do banco.

Risco levantado no ensaio: dos 137 editais, 100 têm unidade fora de
`TA_UNIDADE_AREA` (36 unidades, todas DSEI/CASAI do `TD_UNIDADE`, todas na
Saúde Indígena) e **nenhum** tem unidade fora das duas tabelas; nenhum edital
tem área diferente da que a regra deduz.

## 8. Análises curriculares viram aba interna

Migration `20260929100000_analises_aba_interna.sql` (rollback em
`supabase/rollback/`; ensaiada, com o rollback, em 28/09/2026).

Análises curriculares era a linha `analises` de `TB_PAINEL_EXTERNO`, aberta
como painel externo e repetida em cada área pelo menu. Para vê-la eram precisos
três recursos: `analises`, `paineis` e `painel:<id do analises>`. Agora é a
view `analises` do front (`src/modules/pagina-de-analises.js`), com endereço
fixo do app (`analises.html?area=<área atual>`) e permissão **só do recurso
`analises`** (>= leitor). Nenhuma RPC mudou.

- **Quem via continua vendo.** Quem via o painel já tinha `analises` >= leitor
  (era uma das três condições); nenhuma linha é criada para essas pessoas, e a
  migration aborta se alguém delas ficasse sem acesso.
- **Quem não via continua sem ver** (padrão, `c_manter_quem_nao_via = true` no
  topo do bloco): quem tinha `analises` mas não o painel ganha linha explícita
  `analises` = `sem_acesso`. Isso também tira o acesso direto a
  `analises.html` e às RPCs de análises, que essas pessoas tinham pelo padrão
  do papel. Com `false`, elas passam a ver a aba e nenhuma linha é criada.
- **O painel é arquivado**: `ativo = false` e `tipo_abertura = 'aba_interna'`
  (a marca, em coluna existente; `em_manutencao` não muda). As linhas
  `painel:<id>` de `TB_PERMISSAO_RECURSO` ficam, como histórico. Painel
  inativo já some de `obter_contexto_monitora` (`panel_ids`) e da matriz
  (`obter_matriz_acessos` lista só painel ativo).
- **Auditoria**: cada permissão alterada em `TH_PERMISSAO_RECURSO` (motivo
  "Análises curriculares viram aba interna"); o arquivamento em
  `TH_CONFIGURACAO` (histórico de configurações, com a foto dos painéis antes e
  depois). Idempotente: com a marca já gravada, não faz nada.
- **Rollback**: desfaz só as permissões que a migration mudou e que ninguém
  mudou depois (linha criada por ela sai; linha que já existia volta ao nível e à
  revisão anteriores) e devolve `ativo`/`tipo_abertura` da foto
  `paineis_antes`. Registra o desfazer nos dois históricos.

Ensaio (begin…rollback, produção, 22 perfis ativos): a fórmula da migration bate
com `private.nivel_recurso` perfil a perfil (impersonando cada usuário). Viam o
painel: admin 9/9, edital_gestor 2/2, usuario 9/11. Depois: os mesmos 20 veem a
aba, ninguém perde e ninguém ganha; 2 linhas criadas (`usuario`, `analises` =
`sem_acesso`, sem linha anterior — contas de 24 e 25/09, sem nenhum painel);
`panel_ids` somados 80 → 60; a matriz fica com Seleção, Entrevistas e Recursos.
Com `false`, 0 linhas e os 2 passam a ver. Rodar duas vezes não muda nada.
Migration + rollback devolvem `TB_PERMISSAO_RECURSO` (nível, revisão,
updated_at, updated_by) e a linha do painel idênticas.

Cuidado: restaurar no Histórico de configurações uma versão anterior a esta
migration reativa a linha (`ativo`), e a coluna `painel:<analises>` volta à
matriz. O front ignora o painel `analises` de qualquer jeito
(`semOPainelAntigoDeAnalises`, em `src/lib/pagina-de-analises.js`).

## 9. Catálogo de abas (etapa 1 do "tudo vira aba")

Migration `20260929110000_catalogo_de_abas.sql` (rollback em
`supabase/rollback/`; ensaiada, com o rollback, em 28/09/2026). **Nenhuma
mudança visível**: o seed é o menu de hoje.

- `TB_ABA` — catálogo: `CO_ABA` (visao-geral, editais, cronograma, aprovados,
  analises), `NO_ABA`, `DS_ICONE`, `NU_ORDEM`, `CO_VIEW` (a tela do front:
  `dashboard`, `visao-area`, `nucleo`, `calendario`, `approved`, `analises`),
  `CO_RECURSO` (o recurso de permissão que a aba usa hoje), `TP_ABA`
  (`nativa`/`externa`), `ST_ATIVO` e auditoria (`DT_CRIACAO`,
  `DT_ATUALIZACAO`, `CO_USUARIO_ATUALIZACAO`).
- `RL_ABA_AREA` — aba × área (`TB_AREA`). Sem linha ativa, a aba não aparece
  na área. `NU_ORDEM`, `CO_VIEW` e `DS_ICONE` nulos herdam da aba: é assim que
  a Visão geral é `dashboard`/`map` na Saúde Indígena e
  `visao-area`/`layout-dashboard` na SEDE e em Projetos.
- `listar_abas_do_menu()` — JSON
  `[{co_aba, no_aba, ds_icone, nu_ordem, co_view, co_recurso, tp_aba, areas: [{co_area, nu_ordem, co_view, ds_icone}]}]`,
  só o que está ativo, com a herança já resolvida. `SECURITY INVOKER`: não
  precisa de privilégio a mais, então valem a RLS (`using (true)` para
  `authenticated`) e os grants (só `select` para `authenticated`; `anon` sem
  nada). Nenhuma escrita: a manutenção virá por RPC de administração.

Não entram ainda: permissão perfil × aba (continua `TB_PERMISSAO_RECURSO` por
recurso; `CO_RECURSO` é o ponto de partida) e os painéis externos (Seleção,
Entrevistas, Recursos seguem em `TB_PAINEL_EXTERNO`, grupo "Painéis"; quando
virarem aba, entram com `TP_ABA = 'externa'`).

O front (`src/modules/catalogo-de-abas.js`) pede a função junto com as outras
consultas da entrada e guarda a resposta na cópia da sessão (parte opcional
`abas`). Sem a função (PostgREST `PGRST202`), com erro ou resposta vazia, usa
`ABAS_DO_MENU` (`src/lib/menu-lateral.js`), o mesmo catálogo no código — por
isso o front pode ir antes da migration. `tests/catalogo-de-abas.test.js`
confere que o seed é `ABAS_DO_MENU`, que a resposta capturada no ensaio
(`tests/fixtures/listar-abas-do-menu.json`) é a que o seed produz e que a árvore
do menu é a de antes em toda combinação de permissão e área.

Ensaio (begin…rollback, produção): 5 abas, 15 ligações, a função como
`authenticated` (admin ativo) devolve o menu de hoje; `anon` recebe `42501` na
função e na tabela; `authenticated` recebe `42501` ao inserir; migration +
rollback não deixam tabela nem função.

## 10. Recursos dos candidatos viram aba nativa

Migration `20260929120000_recursos.sql` (rollback em `supabase/rollback/`;
ensaiada com o rollback em 29/09/2026 — as quatro funções de permissão voltam
com o mesmo md5). Sem migração de dados: a aba começa vazia. O painel externo
"Recursos" (`TB_PAINEL_EXTERNO`) fica até a aba ser aprovada.

- `TB_ORIGEM_RECURSO` (domínio: análise curricular, entrevista, resultado
  final; avaliação de conhecimentos inativa), `TB_RECURSO_CANDIDATO` (edital =
  `TB_MONITORAMENTO_INDIGENA`, área do edital; candidato = FK para
  `TB_ANALISE_CURRICULAR`, sem cópia de nome/vaga/nota; só "fora das análises"
  guarda o digitado; nota e resultado do dia do cadastro para saber se a nota
  mudou; etapas com quando e quem) e `TH_RECURSO_CANDIDATO` (auditoria).
  RLS ligada, sem policy nem grant: só as RPCs leem e escrevem.
- RPCs `SECURITY DEFINER`: `get_recursos_da_area` (json), `get_recurso_candidato_detalhe`,
  `buscar_candidatos_recurso`, `salvar_recurso_candidato` (revisão → `40001`,
  duplicado em análise → `23505` salvo `permitir_duplicado`),
  `marcar_etapa_recurso`, `excluir_recurso_candidato` (lógica, com motivo).
- Permissão: recurso `recursos` (admin = admin, edital_gestor = editor,
  usuario/contratador = leitor) + área do edital (`FC_PODE_AREA`). Ler exige
  leitor; gravar e buscar candidato, editor.
- Catálogo: aba `recursos` (ícone `scale`, ordem 6) nas três áreas.
- O prazo de resposta é classificado no front a partir das etapas do
  cronograma (`src/lib/prazo-do-recurso.js`); nada é guardado no banco.

## 11. CCE e Escritório Distrital e Regional são Projetos

Migration `20260929180000_cce_e_escritorio_em_projetos.sql` (rollback em
`supabase/rollback/`). Em 25/09 as duas unidades foram para a SEDE,
provisoriamente; a decisão de 29/09/2026 é que a SEDE só tem a unidade SEDE.

- `TA_UNIDADE_AREA`: CCE e Escritório Distrital e Regional → `projetos`. O
  formulário da SEDE deixa de oferecê-las e o salvar as recusa num edital da
  SEDE.
- Os editais dessas unidades que estavam em `sede` vão para `projetos`, com uma
  linha de auditoria cada em `TH_MONITORAMENTO` (`campo_alterado = 'CO_AREA'`,
  `snapshot_json.acao = 'cce_e_escritorio_em_projetos'`), como no
  `mover_edital_de_area`. Edital já movido por um administrador para outra área
  fica onde está.
- As análises curriculares não mudam: a área delas vem do `grupo` da planilha.

## 12. Lista de aprovados por área

Migration `20260929210000_aprovados_por_area.sql` (rollback em
`supabase/rollback/`, que volta à definição lida do banco em 29/09/2026, com o
recorte por coordenação; ensaiado: hash, volatilidade, config, grants e
comentário da função iguais aos de antes, e nenhuma sobra).

- `listar_candidatos_aprovados_compacto(p_area text default null, p_versao text
default null)`. Com `p_area`: só a área (22023 se não existe, 42501 se não é
  do usuário), mesma permissão (`pode_recurso` + `papel_recurso`) e mesmo recorte
  por coordenação (`FC_EDITAIS_VISIVEIS`). Sem `p_area`: exatamente a resposta
  de antes (formato 1, todas as áreas), para o front publicado até o deploy — sai
  numa próxima migration, junto com o formato 1 do expansor.
- **Formato 2**: `listas` em array (id na primeira coluna; a linha leva o
  índice), `dicionarios` com cargo, modalidade, status e código da vaga (a linha
  leva o índice, base 0), `versao`, `area` e `cache`. O front
  (`src/lib/candidatos-aprovados-compactos.js`) remonta objetos idênticos aos
  de antes — conferido no ensaio para o admin (3 áreas), um usuário da Saúde
  Indígena e um usuário sintético com recorte por coordenação: conteúdo e ordem
  iguais.
- **Tamanho** (ensaio, 29/09): admin 9.809 KB (todas as áreas) → Saúde Indígena
  1.539 KB, SEDE 1.345 KB, Projetos 1.626 KB. Usuário só da Saúde Indígena:
  2.640 KB → 1.539 KB. Usuário com recorte (3 editais da SEDE): 2.083 KB → 780 KB.
- **Tempo** (ensaio): antes 1,6 s com o banco quente e 11 s frio (todas as
  áreas); com o pronto, 18–30 ms por área; com `p_versao` que ainda vale,
  14–18 ms e nada trafega. A versão custa ~13 ms; montar uma área, 150–300 ms.
- **Pronto no servidor**: `private."TA_CANDIDATO_APROVADO_AREA"` (por área:
  `DS_LISTAS`, `DS_DICIONARIOS`, `DS_LINHAS`, `QT_CANDIDATOS`,
  `DS_VERSAO_DADOS`, `DT_GERACAO`, `NU_DURACAO_MS`; RLS sem policy, sem
  grant). Montagem em `private."FC_MONTAR_APROVADOS_AREA"(área, editais)`;
  remontagem em `atualizar_cache_aprovados(p_area)` e
  `atualizar_cache_aprovados_vencidos()` (só `service_role`/`postgres`), pelo
  pg_cron `agsus_aprovados_cache_por_area` a cada 2 min. Só quem vê a área
  inteira recebe o pronto; quem tem recorte por coordenação, a lista montada na
  hora (a versão dele leva o md5 dos editais visíveis).
- **Quem escreve vê a própria mudança na hora**: a versão
  (`private."FC_VERSAO_APROVADOS_AREA"`) é calculada a cada chamada dos próprios
  dados — contagens e soma de hash do `xmin` das listas da área e dos
  candidatos das listas vigentes, mais edital/unidade do monitoramento. Todo
  insert, update (status, sub judice, soft delete) ou delete muda a versão no
  mesmo commit dos dados. O pronto só é servido com a versão de agora; senão a
  RPC remonta (trava consultiva por área) ou, com a trava ocupada, monta na hora
  sem gravar. Não há "stale-while-cron" nesta lista, e as RPCs que escrevem não
  mudaram. Ensaio: depois de `alterar_status_candidato_aprovado`, a chamada
  seguinte trouxe o status novo e a versão nova; depois de um soft delete, um
  candidato a menos.
- **No navegador**: uma cópia por área no IndexedDB (`aprovados:<área>`, no
  mesmo banco e com o mesmo dono das cópias do painel de análises; regras gerais
  em `src/lib/cache-de-payload.js`). A primeira abertura da área mostra a cópia
  e pergunta ao banco se a `versao` dela vale; a releitura depois de uma
  escrita vai sempre ao banco, com a versão da tela. Sair, "Limpar sessão",
  acesso revogado e outro usuário apagam as cópias.
- **Ordem de publicação**: a migration pode ir antes do front (o front
  publicado chama sem `p_area` e recebe o de sempre) ou depois (o front novo,
  sem `p_area` no banco, recebe PGRST202 e chama a função sem argumentos).

### Sub judice: inclusão e decisão judicial sobre quem já está na lista

Migration `20261001150000_sub_judice_alteracao.sql` (rollback em
`supabase/rollback/`, que recusa enquanto houver candidato alterado).

- **Inclusão** (`incluir_sub_judice`, editor do módulo): candidato novo na lista
  vigente e ativa, com modalidade, processo judicial e observação opcionais.
- **Decisão judicial** (`alterar_candidato_sub_judice`, só admin do módulo):
  nota e/ou modalidade novas para quem já está na lista. Na primeira alteração
  o candidato guarda o resultado publicado (`nota_original`,
  `modalidade_original`, `classificacao_original`, `sub_judice_original`) e
  ganha `alterado_judicialmente` e `sub_judice`. `desfazer_alteracao_sub_judice`
  (só admin) volta ao publicado. `remover_sub_judice` vale só para a inclusão.
- **Classificação**: `private."FC_RECOLOCAR_NA_CLASSIFICACAO"` põe o candidato
  na posição da nota dentro da escala dele e renumera a escala (os outros
  mantêm a ordem). A escala é a vaga da convocação (cargo da lista, e o código
  da vaga quando o cargo tem mais de uma); quando a planilha classificou por
  modalidade (o mesmo número em modalidades diferentes), cada modalidade é
  renumerada à parte. Empate de nota: depois de quem tinha a classificação
  original melhor.
- **Histórico**: `TH_CANDIDATO_SUB_JUDICE` (INCLUSAO, ALTERACAO, DESFAZER,
  REMOCAO; antes e depois de nota, modalidade e classificação; processo,
  observação, quem e quando). RLS sem policy, sem grant.
- **Pacote da área**: só a linha alterada leva 4 posições a mais
  (`alterado_judicialmente`, `nota_original`, `modalidade_original`,
  `classificacao_original`); o expansor do front lê a que falta como nulo.

## 13. Recursos: anexos, modelos de resposta e resposta escrita no sistema

Migration `20260929230000_recursos_modelos_anexos_respostas.sql` (rollback em
`supabase/rollback/`; ensaiada com o rollback em 29/09/2026, depois de
`20260929190200` — sem ela a migration para). Os corpos de
`get_recursos_da_area` e `get_recurso_candidato_detalhe` são os de
`20260929190200` (com o recorte por coordenação), só acrescidos.

- **Anexos**: bucket privado `recursos-anexos` (20 MB; pdf, docx, doc, jpg,
  png, odt), caminho `<área>/<recurso>/<uuid>-<nome>`. `TB_ANEXO_RECURSO`
  (metadados, `TP_ANEXO` recurso_candidato/resposta/documento/outro, tamanho e
  tipo lidos do Storage no registro, arquivamento lógico com motivo) e
  `TH_ANEXO_RECURSO` (inclusão, download, arquivamento).
  Políticas do Storage (funções `private."FC_PODE_ANEXO_RECURSO"` e
  `private."FC_PODE_BAIXAR_ANEXO_RECURSO"`): envio com `recursos` >= editor e o
  edital visível (área + coordenação); leitura — que é o que gera a URL
  assinada — só com um download registrado pela própria pessoa nos últimos 5
  minutos (`registrar_download_anexo_recurso` confere o acesso e grava), ou o
  próprio arquivo recém-enviado (10 min, porque o insert do Storage devolve a
  linha). Sem update nem delete: nada se sobrescreve nem se apaga pela API.
  Arquivo enviado e não registrado (falha no meio) fica órfão no bucket.
- **Modelos de resposta**: `TB_MODELO_RESPOSTA_RECURSO`, uma linha por versão
  (PK modelo + versão, `ST_VIGENTE`); área e origem nulas = todas. Editar grava
  a versão seguinte; a resposta guarda a versão usada. Marcadores aceitos em
  `private."FC_MARCADORES_MODELO_RESPOSTA"()` (= `src/lib/modelos-de-resposta.js`).
  Seis modelos iniciais (deferido, indeferido, parcialmente indeferido ×
  análise curricular, entrevista). Manutenção só com `recursos` = admin, na
  gaveta "Modelos de resposta" do painel de recursos.
- **Resposta**: `TB_RESPOSTA_RECURSO` (uma por recurso; `NU_REVISAO`) e
  `TH_RESPOSTA_RECURSO` (cada gravação e transição, com o texto do momento).
  Estados rascunho → (em_revisao → devolvida | aprovada) → enviada; revisão
  opcional, mas depois de ir à revisão quem escreveu ou enviou não aprova;
  aprovar exige o recurso decidido com a situação do modelo; marcar enviada
  marca a etapa `resposta_candidato` do recurso. Regras espelhadas em
  `src/lib/resposta-do-recurso.js`.
- `TH_RECURSO_CANDIDATO` passa a aceitar `anexo` e `resposta` em `TP_ACAO`.
- RPCs: `listar_modelos_resposta_recurso`, `salvar_modelo_resposta_recurso`,
  `arquivar_modelo_resposta_recurso`, `salvar_resposta_recurso`,
  `transicionar_resposta_recurso`, `registrar_anexo_recurso`,
  `arquivar_anexo_recurso`, `registrar_download_anexo_recurso` (todas
  `SECURITY DEFINER`, search_path vazio, sem `anon`; nível + área +
  coordenação por `private."FC_EXIGIR_RECURSO_ACESSIVEL"`).
- **Rollback**: tira políticas, RPCs e funções e devolve leitura e detalhe aos
  corpos de `20260929190200`; **não** apaga o bucket nem arquivo
  (`storage.protect_delete`), e só apaga as tabelas se estiverem sem dado de
  uso (senão ficam, com NOTICE).

Ensaio (begin…rollback, produção): admin cria modelo (v1 → v2, sem mudança não
cria versão, versão velha → 40001, marcador desconhecido → 22023, arquiva);
usuario lê a aba sem modelos e recebe 42501 ao gravar; editor grava rascunho
(revisão velha → 40001), não aprova recurso em análise, envia para revisão e
não aprova a própria; outro editor devolve (comentário obrigatório), aprova
(situação diferente do modelo → 22023) e marca enviada (etapa marcada); editor
com coordenação recortada não vê o recurso nem envia arquivo; upload com área
errada, em subpasta ou por leitor é barrado pela política; registrar arquivo
de outra pessoa → 42501; leitor só enxerga o objeto depois de registrar o
download; outra área → 42501; anexo arquivado só o editor baixa. Migration +
rollback: funções, CHECK e comentários iguais aos de antes (a menos do fim de
linha CRLF com que 20260929190200 foi aplicada); fica só o bucket, vazio.

## 14. Seleção vira aba nativa (funil por vaga)

Migration `20261001090000_selecao.sql` (rollback em `supabase/rollback/`); a aba entra desligada
e `20261001090500_liga_aba_selecao.sql` a liga junto com o front. **Ainda não ensaiada no banco.**

- `TB_SELECAO_VAGA` — uma linha por vaga da aba Resultado da planilha "Auditoria": inscritos,
  aptos, cancelados, reprovados no questionário, eliminados por nota, reprovados na análise,
  triados, total de eliminados, convocados antigos (`QT_CONVOCADO_PLANILHA`) e observação. Chave
  natural `DS_CHAVE_ORIGEM` = número do edital | código da vaga (outras bancas: `cargo:<nome>`,
  com `#2`… para vaga de mesmo nome e números diferentes). Exclusão lógica em `ST_REGISTRO_ATIVO`
  (norma MAD; `TB_ENTREVISTA` usa `ST_ATIVO`).
- `TL_SYNC_SELECAO` — log das cargas (sem área: a planilha mistura as três).
- Carga só `service_role` (`scripts/sincronizar-selecao.mjs`, GitHub Actions às 9h):
  `sincronizar_selecao(p_sync, p_linhas)` em lotes e `finalizar_sync_selecao(p_sync, p_forcar)`,
  que desativa o que saiu e chama `private."FC_LIGAR_SELECAO_AOS_EDITAIS"()`
  (`20261001100000_selecao_area_pelos_editais.sql`): unidade DSEI ou CASAI fica na Saúde Indígena,
  com o edital de mesmo número (`FC_NUMERO_EDITAL`) da Saúde Indígena; qualquer outra unidade
  nunca fica nela — edital de mesmo número da SEDE ou de Projetos (de preferência mesma unidade),
  área dele; sem edital, `TA_UNIDADE_AREA`, senão `sede`. Carga com menos da metade das linhas
  ativas é recusada sem `p_forcar`.
- Leitura `get_selecao_da_area(p_area)` — recurso `selecao` >= leitor, área e recorte da
  coordenação. Calcula na hora:
  - **convocados**: edital com alguma entrevista ativa em `TB_ENTREVISTA` (planilha ou sistema)
    usa a contagem da vaga (0 sem nenhuma); senão, `QT_CONVOCADO_PLANILHA`;
  - **aprovados / contratados / não contratados**: lista vigente (`TB_LISTA_APROVADO.vigente`) ×
    `TB_CANDIDATO_APROVADO` sem removidos, pela vaga; contratado = status `Contratado` ou
    `Migração`; sem lista vigente, nulos. Vaga sem código (outras bancas: CESPE, FGV, CCE…) liga
    pelo nome do cargo — `codigo_vaga` da lista × coluna A da Auditoria, sem acento, caixa nem
    pontuação (`20261001130000_selecao_aprovados_outras_bancas.sql`).
- Permissão `selecao` com os níveis de `entrevistas`. O painel externo "Seleção" continua ativo até
  a aba nova ser aprovada.

## 15. Status das atualizações (antes "Saúde das cargas"; Configurações, só administrador global)

Migration `20261001120000_saude_das_cargas.sql` (rollback em `supabase/rollback/`). **Só leitura.**

- `get_saude_das_cargas()` (json; `private.is_master()`, 42501 para os demais): as últimas 10
  execuções de cada origem das análises (`TL_SYNC_ANALISE` × `TA_ORIGEM_ANALISE` ×
  `TB_PLANILHA_ANALISE`; colunas lidas pelo json da linha, porque a tabela é anterior às
  migrations), de `TL_SYNC_ENTREVISTA`, de `TL_SYNC_SELECAO` e das tarefas `agsus_*` do pg_cron
  (`cron.job` × `cron.job_run_details`; nulas sem acesso ao pg_cron).
- Índice `IN_SYNCANALISE_ORIGEM` (`origem`, `started_at desc`) para a leitura por origem.
- A tela mostra uma linha por aba (análises por área, entrevistas, seleção, tarefas do banco) e uma
  frase no topo; o selo (em dia, atrasada, falhou, em andamento, ainda sem carga — este não pede
  atenção: a SEDE ainda não tem planilha de análise) e os prazos ficam no front, em
  `src/lib/saude-das-cargas.js`: análises incrementais atrasadas depois de 1 h; entrevistas e
  seleção, de 26 h; tarefas a cada 2 min, de 15 min. A seção é
  `src/componentes/saude-das-cargas/`.
