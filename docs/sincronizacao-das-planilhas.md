# Sincronização das planilhas (Entrevistas e Seleção)

Guia para quem opera as cargas das planilhas no dia a dia, inclusive na ausência de quem as montou.
**Não é preciso ter credencial nenhuma no computador**: basta acesso ao repositório no GitHub.

## O que é

Duas abas do MONITORA vêm de planilhas do Google Drive. De hora em hora, o GitHub Actions lê cada
planilha e grava no banco, o dia todo. As duas cargas funcionam do mesmo jeito e usam as mesmas credenciais.

| Aba do MONITORA | Planilha (aba)                           | Workflow no Actions         | Tabelas                                                         |
| --------------- | ---------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| **Entrevistas** | "[dash] entrevistados" (`Entrevistados`) | **Sincronizar entrevistas** | `TB_ENTREVISTA`, `TB_ENTREVISTA_NOTA`, log `TL_SYNC_ENTREVISTA` |
| **Seleção**     | "Auditoria" (`Resultado`)                | **Sincronizar seleção**     | `TB_SELECAO_VAGA`, log `TL_SYNC_SELECAO`                        |

```
Entrevistas
  planilhas de entrevista de cada vaga
     └─ Apps Script "Cruzamento de entrevistados" (continua na planilha) monta a aba Entrevistados
          └─ GitHub Actions, de hora em hora (o dia todo, pedido pelo banco): scripts/sincronizar-entrevistas.mjs → Supabase

Seleção
  planilha "Auditoria", aba Resultado (uma linha por vaga: inscritos, aptos, eliminados, triados…)
     └─ GitHub Actions, às 8h10, 13h10 e 18h10 (pedido pelo banco): scripts/sincronizar-selecao.mjs → Supabase
```

O cruzamento das entrevistas continua no Apps Script porque as pastas das planilhas de vaga não
são da conta `dados.recursoshumanos`. Este guia cobre só as cargas para o banco. Os candidatos
da Empregare vêm por um robô à parte, com guia próprio: **`docs/robo-empregare.md`**.

### Aspectos da entrevista (Conceitua, Propriedade, Profundidade)

A carga lê só a aba consolidada **Entrevistados** (a nota de cada competência, os pares
"Critério N" / "Nota N"), não as notas por avaliador nem os aspectos das planilhas de vaga. A nota
por aspecto existe só nas entrevistas conduzidas no MONITORA (roteiro com aspectos, migration
`20261008100000_aspectos_da_entrevista.sql`). Se um dia a carga precisar das notas por avaliador,
o cruzamento do Apps Script é que teria de levá-las à aba.

### O que a Seleção calcula (e não lê da planilha)

- **Convocados para entrevista**: se o edital tem entrevistas no MONITORA (`TB_ENTREVISTA`, vindas
  da planilha ou conduzidas no sistema), vale a contagem de lá — vaga sem nenhuma entrevista fica
  com **0**. Edital sem nenhuma entrevista no MONITORA usa a coluna V da Auditoria (o dado antigo).
- **Aprovados, contratados e não contratados** (colunas W, X e Y da Auditoria, que **não** são
  lidas): da lista de aprovados vigente do edital. Contratados = status _Contratado_ ou
  _Migração_; não contratados = aprovados − contratados. Edital sem lista importada mostra "—".
- **Área**: DSEI e CASAI são sempre Saúde Indígena (edital procurado entre os da Saúde Indígena).
  As outras unidades nunca são: o edital é procurado entre os da SEDE e de Projetos, e a área é a
  dele; sem edital, a da unidade em `TA_UNIDADE_AREA`, senão SEDE
  (`20261001100000_selecao_area_pelos_editais.sql`).
- Editais de **outras bancas** (04/2026, 96/2025, 97/2025, FGV, FCC) só têm inscritos e total de
  eliminados. Não é erro: o processo é outro.

## Rodar agora (sem esperar o próximo horário)

**Pelo MONITORA** (administrador global): Configurações → **Status das atualizações** → linha
Entrevistas ou Seleção → **Rodar agora** (modo `normal`). O banco pede ao GitHub com a chave `github_disparo_robos` do Vault (ver
`docs/agenda-dos-robos.md`); o botão fica desabilitado enquanto a carga roda.

**Pelo GitHub** (qualquer modo):

1. GitHub → repositório → aba **Actions** → **Sincronizar entrevistas** ou **Sincronizar seleção**.
2. **Run workflow** → escolha o modo → **Run workflow** (`disparado_por` fica em branco).

| Modo     | Quando usar                                                                        |
| -------- | ---------------------------------------------------------------------------------- |
| `normal` | o de sempre: lê a planilha e grava                                                 |
| `seco`   | só confere se a planilha está legível; não grava nada                              |
| `forcar` | a carga foi **recusada** e você já conferiu que a planilha está certa (ver abaixo) |

Ao terminar, abra a execução: o resumo mostra quantas linhas foram lidas e gravadas, quantas
ficaram sem edital e quantas saíram da planilha.

## Ver se rodou

- **Actions → o workflow**: verde = gravou; vermelho = não gravou (os dados de antes continuam na
  tela). O e-mail de falha vai para quem alterou o workflow por último.
- No banco (SQL Editor do Supabase):
  ```sql
  select "CO_SYNC", "DT_INICIO", "QT_LINHA", "TP_SITUACAO", "DS_MENSAGEM"
  from public."TL_SYNC_ENTREVISTA" order by "DT_INICIO" desc limit 10;   -- entrevistas

  select "CO_SYNC", "DT_INICIO", "QT_LINHA", "TP_SITUACAO", "DS_MENSAGEM"
  from public."TL_SYNC_SELECAO" order by "DT_INICIO" desc limit 10;      -- seleção
  ```
  As cargas do GitHub começam com `gh-`.

## Quando fica vermelho

| Mensagem no log                                                  | O que fazer                                                                                                                                                                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Carga … RECUSADA: a planilha trouxe X … e o banco tem Y ativas` | A aba veio com menos da metade das linhas de antes. Abra a planilha: se a aba estiver vazia ou quebrada, conserte (ou espere o cruzamento refazer) e rode `normal`. Se a redução for real, rode `forcar`. |
| `Sem acesso à planilha (403/404)`                                | A planilha deixou de estar compartilhada com a conta de serviço. Compartilhe como **Leitor** com `credenciais-pyhton@credencial-437411.iam.gserviceaccount.com`.                                          |
| `Google recusou a conta de serviço`                              | A chave do Google foi apagada ou trocada. Gere uma nova (abaixo) e atualize o secret.                                                                                                                     |
| `Coluna obrigatória não encontrada`                              | Alguém renomeou ou apagou uma coluna. Entrevistados: DSEI, Edital, Vaga, Nome. Resultado: Vaga, Edital, Inscritos. Volte o cabeçalho.                                                                     |
| `… respondeu 401`                                                | A `service_role` do Supabase mudou. Atualize o secret `SUPABASE_SERVICE_ROLE_KEY`.                                                                                                                        |
| `… respondeu 404` com `sincronizar_selecao`                      | A migration da Seleção ainda não foi aplicada no banco.                                                                                                                                                   |

## Onde ficam as credenciais

Só nos **secrets do repositório** (Settings → Secrets and variables → Actions), os mesmos para as
duas cargas. O GitHub não mostra o valor depois de salvo, nem nos logs. Ninguém precisa do arquivo
no computador.

| Secret                        | O que é                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | conteúdo do JSON da conta de serviço `credenciais-pyhton` (projeto `credencial-437411`) |
| `SUPABASE_URL`                | `https://gnudtaxhjfgtvwkwpsel.supabase.co`                                              |
| `SUPABASE_SERVICE_ROLE_KEY`   | chave service_role (Supabase → Project Settings → API)                                  |

Para trocar um secret: clique no nome → **Update secret** → cole o novo valor. Precisa ser
administrador do repositório.

### Trocar a chave do Google (se vazou ou a cada ano)

1. [console.cloud.google.com](https://console.cloud.google.com) → projeto **credencial-437411** →
   IAM e administrador → Contas de serviço → `credenciais-pyhton` → aba **Chaves**.
2. **Adicionar chave → Criar nova chave → JSON**. O arquivo baixa sozinho.
3. Cole o conteúdo inteiro no secret `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. Rode os dois workflows em modo `seco`. Deu verde? Volte em **Chaves** e **exclua a chave antiga**.
5. Apague o JSON da pasta Downloads (ou guarde só onde for combinado).

Outros usos da mesma conta de serviço também usam a chave antiga: avise antes de excluí-la.

## Rodar no computador (opcional)

Só para conferir a planilha; para gravar, use o botão do GitHub.

1. Guarde o JSON da conta de serviço **fora** da pasta do repositório.
2. No `.env.local` da raiz do projeto (o git ignora), com barras normais:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=C:/caminho/para/google_workspace.json
   ```
3. `npm run sync:entrevistas -- --seco` ou `npm run sync:selecao -- --seco`

Não ponha a `service_role` no `.env.local`: ela dá acesso total ao banco, e o `.env.local` também
vai para o container (`docker run --env-file .env.local`).

## Quem precisa ter acesso (para não depender de uma pessoa)

- **Repositório no GitHub**: pelo menos duas pessoas administradoras (para trocar secrets).
- **Projeto `credencial-437411` no Google Cloud**: pelo menos dois proprietários (para gerar chave).
- **Planilhas "[dash] entrevistados" e "Auditoria"**: a conta de serviço como Leitor (já está).
- **Supabase**: pelo menos dois administradores do projeto (para ver a `service_role`).

## Arquivos

- `.github/workflows/sincronizar-entrevistas.yml` e `sincronizar-selecao.yml`: o botão
  (`workflow_dispatch`); os horários ficam no banco (pg_cron), ver `docs/agenda-dos-robos.md`.
- `scripts/sincronizar-entrevistas.mjs` e `scripts/sincronizar-selecao.mjs`: as cargas;
  `scripts/carga-de-planilha.mjs`: o que as duas têm em comum (credencial, leitura da aba, RPC).
- `src/lib/entrevistas-da-planilha.js` e `src/lib/selecao-da-planilha.js`: como cada aba vira
  linhas (testes em `tests/entrevistas-da-planilha.test.js` e `tests/selecao-da-planilha.test.js`).
- `src/lib/planilhas.js` (`entrevistados`, `auditoriaDaSelecao`): ID da planilha e nome da aba.
- `supabase/migrations/20261001090000_selecao.sql`: tabelas e regras da Seleção.
