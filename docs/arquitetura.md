# Arquitetura do MONITORA — proposta

Status: **proposta para revisão** (25/09/2026). Nada aqui está implementado ainda,
exceto onde dito.

## Por que agora

O MONITORA nasceu para a Saúde Indígena e vai atender também a **SEDE** e os
**Projetos**. Hoje a estrutura supõe uma área só:

- a tabela principal chama `TB_MONITORAMENTO_INDIGENA` e já guarda editais da SEDE
  e do MFC;
- o recorte "é da Saúde Indígena" é feito no front (`ehEditalDaSaudeIndigena`), e
  foi por isso que MFC e SEDE apareceram na tela da Saúde Indígena;
- `TB_ANALISE_CURRICULAR` tem colunas de nota que só existem na Saúde Indígena
  (`pontuacao_criterio_etnico`, `experiencia_saude_indigena_total`).

Decisões já tomadas:

1. **Continua no Supabase** até estabilizar; depois migra para PostgreSQL próprio,
   como o SIGAV (`db_dataware`). Tudo abaixo é pensado para essa migração ser
   troca de camada, não reescrita.
2. **React** no front, migrando tela por tela (a barra lateral, Editais,
   Cronograma e Aprovados já são React).
3. **Área é dado, não estrutura**: um sistema só, com a área (Saúde Indígena,
   SEDE, Projetos) como dimensão das tabelas e das permissões.

## Telas por área

| Tela                            | Saúde Indígena | SEDE | Projetos |
| ------------------------------- | :------------: | :--: | :------: |
| Início (visão da área)          |       ✓        |  ✓   |    ✓     |
| Editais / processos seletivos   |       ✓        |  ✓   |    ✓     |
| Cronograma                      |       ✓        |  ✓   |    ✓     |
| Monitora Análises (curricular)  |       ✓        |  ✓   |    ✓     |
| Lista de aprovados e convocação |       ✓        |  ✓   |    ✓     |
| Vagas imediatas                 |       ✓        |  ✓   |    ✓     |
| Mapa nacional, DSEI, núcleos    |       ✓        |  —   |    —     |
| Configurações e acessos         |     comum      |      |          |
| Aya                             |     comum      |      |          |

A mesma tela serve às três áreas; muda só o que é próprio de cada uma (colunas
de nota nas Análises, o mapa). A área vai no endereço: `/saude-indigena/analises`,
`/sede/analises`.

## Banco

### Tipos de tabela

| Tipo                | Exemplos                                                                         | Como fica                          |
| ------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| Núcleo              | usuários, perfis, permissões, áreas, configuração, auditoria                     | compartilhado                      |
| Comum às áreas      | processo seletivo, etapa de cronograma, análise curricular, aprovado, convocação | tabela única com a coluna de área  |
| Próprio de uma área | DSEI, polos, aldeias, núcleos                                                    | tabela própria, ligada à área dona |

### Monitora Análises por área

- A planilha da SEDE e dos Projetos terá o **mesmo formato** da planilha da Saúde
  Indígena, com critérios de nota diferentes.
- A planilha já manda a área na coluna `grupo` ("Saúde Indígena"). O gatilho
  `"TBA_ANALISE_CURRICULAR"` preenche `"CO_AREA"` a partir de
  `TB_AREA."NO_GRUPO_PLANILHA"`; a planilha da SEDE só precisa trazer `grupo` =
  "SEDE" ou "Projetos". (`origem_planilha` é o arquivo de candidatos de cada vaga,
  não serve para isso.) As funções chamadas pelo Apps Script (`processar_sync_*`,
  `*_incremental`) mantêm nome e assinatura: o script não muda.
- As notas próprias saem das colunas fixas para **critérios por área** (critério ×
  candidato × valor). A Saúde Indígena mantém os dela; a SEDE cadastra os seus
  sem migration.

### Organização e nomes

- **Schema `monitora`** para as tabelas; no `public` ficam só as funções que o
  site chama (RPC), que repassam para `monitora`. Na migração vai o schema inteiro.
- **Padrão MAD** também nas funções (`FC_`), com nomes neutros de área:
  `TB_MONITORAMENTO_INDIGENA` → `TB_PROCESSO_SELETIVO`,
  `TB_CRONOGRAMA_MONIT_INDIG` → `TB_ETAPA_CRONOGRAMA`, e assim por diante.
- **Quem é o usuário** vem de uma função nossa (como `FC_UID_SESSAO` no SIGAV), e
  não de `auth.uid()` espalhado. Na migração troca-se só ela.

### Lições do SIGAV que valem aqui

- Renomear tabela **não** atualiza o corpo das funções PL/pgSQL nem os comandos do
  pg_cron (foi o que quebrou os dois jobs a partir de 20/09).
- Funções de gatilho usam `new.coluna` sem citar a tabela: não aparecem numa busca
  por quem usa a tabela.
- Chaves do JSON devolvido pelas RPCs são contrato com a tela; não renomear às cegas.
- Ensaiar cada lote numa cópia do banco chamando as RPCs com um usuário real.

## Permissões

O modelo atual (`TB_PERMISSAO_RECURSO`: perfil × recurso × nível) ganha a **área**:
"Maria · Análises · SEDE · editor", "João · Editais · todas · leitor".

- **O banco decide.** As RPCs devolvem só as áreas permitidas (`private.has_perm`
  passa a receber a área). A tela apenas esconde o que não pode.
- A barra lateral mostra só áreas e telas liberadas.
- A matriz de Configurações → Acessos ganha a coluna de área.

## Front

- React 19 + Vite (já no projeto), **TypeScript no código novo**, React Router
  para rotas por área, TanStack Query para cache das RPCs.
- Pastas por funcionalidade:

```
src/
  nucleo/            login, área atual, permissões
  dados/             TODAS as chamadas ao Supabase
  componentes/ui/    botões, tabelas, filtros (tokens.css)
  funcionalidades/
    inicio/ editais/ cronograma/ analises/ aprovados/
    convocacao/ vagas/ mapa/ acessos/ configuracoes/
```

- **Nenhuma tela fala com o Supabase direto**: só `dados/`. Na migração para o
  banco próprio, `dados/` passa a chamar rotas `/api` (como `src/lib/db` no SIGAV).

## Ordem

Banco:

| Etapa | O quê                                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Correções: jobs do pg_cron, RPCs fora do contrato, registro de migrations                                                                                                                                                                                                |
| 1     | **Feita em 25/09.** Lixo certo: `get_analises_dashboard_payload` (v1) e suas 4 views e cache, gatilho de invalidação, `VW_AUDITORIA_ACESSOS_DIARIA`, `TL_NOTIFICACAO`, funções sem referência; `pwa-lifecycle.css`; dependências `echarts`, `pdfjs-dist`, `tesseract.js` |
| 2     | **Feita em 25/09**: `bench/`, o PDF do padrão e `pwa-lifecycle.css` saíram; `TA_ANALISE_QUARENTENA` foi para o schema `arquivo`. Falta: funções sem chamador                                                                                                             |
| 3     | **Áreas feitas em 25/09** (`TB_AREA`, `TA_UNIDADE_AREA`, `"CO_AREA"` no edital e nas análises, gatilhos). Falta: schema `monitora`                                                                                                                                       |
| 4     | Nomes neutros e `FC_`, função própria de sessão (em lotes)                                                                                                                                                                                                               |
| 5     | Permissão por área no banco; sai `ehEditalDaSaudeIndigena`                                                                                                                                                                                                               |

Front (em paralelo, sem parar o sistema):

1. Casca React: rotas por área, login, permissões, `dados/`.
2. Configurações e acessos (as permissões por área dependem dela).
3. Monitora Análises vira rota do sistema (hoje é `analises.html` à parte) — é a
   primeira tela que a SEDE usa.
4. Início por área.
5. Editais, Cronograma e Aprovados: já em React, só mudam de pasta.
6. Mapa nacional, por último.

Consolidar os arquivos-remendo (`*-fix*`, `*-refinement*`, `post-*`) nos
arquivos-base e quebrar `legacy-app.js` acontece junto com cada tela migrada.
