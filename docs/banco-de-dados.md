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

| Estado          | O que significa                                        |
| --------------- | ------------------------------------------------------ |
| **aplicado**    | caminho e hash batem com o registro                    |
| **pendente**    | está no disco e não no banco                           |
| **divergente**  | foi aplicado e o ficheiro **mudou depois**             |
| **órfão**       | está registado e o ficheiro já não existe no disco     |

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

Doze pontos, em nove tabelas. Dez são leitura.

| Tabela                        | Operação   | Onde                                                        |
| ----------------------------- | ---------- | ----------------------------------------------------------- |
| `analises_editais`            | select     | `analises/analises-scope-guard.js`                          |
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
- ⚠ `salvar_monitoramento_indigena`
- ⚠ `salvar_monitoramento_com_cronograma_v2`
- ⚠ `get_monitoramento_cronograma`
- ⚠ `get_analises_dashboard_payload_v2`
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
