# Sincronização das entrevistas

Guia para quem opera a carga das entrevistas no dia a dia, inclusive na ausência de quem a montou.
**Não é preciso ter credencial nenhuma no computador**: basta acesso ao repositório no GitHub.

## O que é

A aba **Entrevistas** do MONITORA mostra o que está na aba `Entrevistados` da planilha
**"[dash] entrevistados"** (Google Drive). Todo dia às **9h** o GitHub Actions lê essa aba e grava no
banco (`TB_ENTREVISTA`, `TB_ENTREVISTA_NOTA` e o log `TL_SYNC_ENTREVISTA`).

```
planilhas de entrevista de cada vaga
   └─ Apps Script "Cruzamento de entrevistados" (continua na planilha) monta a aba Entrevistados
        └─ GitHub Actions, 9h: scripts/sincronizar-entrevistas.mjs
             lê a aba (conta de serviço do Google, só leitura) → grava no Supabase
```

O cruzamento continua no Apps Script porque as pastas das planilhas de vaga não são da conta
`dados.recursoshumanos`. Este guia cobre só a carga para o banco.

## Rodar agora (sem esperar as 9h)

1. GitHub → repositório → aba **Actions** → **Sincronizar entrevistas**.
2. **Run workflow** → escolha o modo → **Run workflow**.

| Modo | Quando usar |
|---|---|
| `normal` | o de sempre: lê a planilha e grava |
| `seco` | só confere se a planilha está legível; não grava nada |
| `forcar` | a carga foi **recusada** e você já conferiu que a planilha está certa (ver abaixo) |

Ao terminar, abra a execução: o resumo mostra linhas lidas, quantas ligaram à análise curricular,
quantas ficaram sem edital e quantas saíram da planilha.

## Ver se rodou

- **Actions → Sincronizar entrevistas**: verde = gravou; vermelho = não gravou (os dados de antes
  continuam na tela). O e-mail de falha vai para quem alterou o workflow por último.
- No banco (SQL Editor do Supabase):
  ```sql
  select "CO_SYNC", "DT_INICIO", "QT_LINHA", "TP_SITUACAO", "DS_MENSAGEM"
  from public."TL_SYNC_ENTREVISTA" order by "DT_INICIO" desc limit 10;
  ```
  As cargas do GitHub começam com `gh-`.

## Quando fica vermelho

| Mensagem no log | O que fazer |
|---|---|
| `Carga … RECUSADA: a planilha trouxe X linhas e o banco tem Y ativas` | A aba veio com menos da metade das linhas de antes. Abra a planilha: se a aba estiver vazia ou quebrada, espere o cruzamento refazer e rode `normal`. Se a redução for real, rode `forcar`. |
| `Sem acesso à planilha (403/404)` | A planilha deixou de estar compartilhada com a conta de serviço. Compartilhe como **Leitor** com `credenciais-pyhton@credencial-437411.iam.gserviceaccount.com`. |
| `Google recusou a conta de serviço` | A chave do Google foi apagada ou trocada. Gere uma nova (abaixo) e atualize o secret. |
| `Coluna obrigatória não encontrada` | Alguém renomeou ou apagou uma coluna da aba Entrevistados (DSEI, Edital, Vaga, Nome). Volte o cabeçalho. |
| `sincronizar_entrevistas respondeu 401` | A `service_role` do Supabase mudou. Atualize o secret `SUPABASE_SERVICE_ROLE_KEY`. |

## Onde ficam as credenciais

Só nos **secrets do repositório** (Settings → Secrets and variables → Actions). O GitHub não mostra
o valor depois de salvo, nem nos logs. Ninguém precisa do arquivo no computador.

| Secret | O que é |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | conteúdo do JSON da conta de serviço `credenciais-pyhton` (projeto `credencial-437411`) |
| `SUPABASE_URL` | `https://gnudtaxhjfgtvwkwpsel.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role (Supabase → Project Settings → API) |

Para trocar um secret: clique no nome → **Update secret** → cole o novo valor. Precisa ser
administrador do repositório.

### Trocar a chave do Google (se vazou ou a cada ano)

1. [console.cloud.google.com](https://console.cloud.google.com) → projeto **credencial-437411** →
   IAM e administrador → Contas de serviço → `credenciais-pyhton` → aba **Chaves**.
2. **Adicionar chave → Criar nova chave → JSON**. O arquivo baixa sozinho.
3. Cole o conteúdo inteiro no secret `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. Rode o workflow em modo `seco`. Deu verde? Volte em **Chaves** e **exclua a chave antiga**.
5. Apague o JSON da pasta Downloads (ou guarde só onde for combinado).

Outros usos da mesma conta de serviço também usam a chave antiga: avise antes de excluí-la.

## Rodar no computador (opcional)

Só para conferir a planilha; para gravar, use o botão do GitHub.

1. Guarde o JSON da conta de serviço **fora** da pasta do repositório.
2. No `.env.local` da raiz do projeto (o git ignora), com barras normais:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=C:/caminho/para/google_workspace.json
   ```
3. `npm run sync:entrevistas -- --seco`

Não ponha a `service_role` no `.env.local`: ela dá acesso total ao banco, e o `.env.local` também
vai para o container (`docker run --env-file .env.local`).

## Quem precisa ter acesso (para não depender de uma pessoa)

- **Repositório no GitHub**: pelo menos duas pessoas administradoras (para trocar secrets).
- **Projeto `credencial-437411` no Google Cloud**: pelo menos dois proprietários (para gerar chave).
- **Planilha "[dash] entrevistados"**: a conta de serviço como Leitor (já está).
- **Supabase**: pelo menos dois administradores do projeto (para ver a `service_role`).

## Arquivos

- `.github/workflows/sincronizar-entrevistas.yml`: horário (`cron: "0 12 * * *"`, 12h UTC = 9h de
  Brasília) e o botão.
- `scripts/sincronizar-entrevistas.mjs`: a carga.
- `src/lib/entrevistas-da-planilha.js`: como a aba vira linhas (teste em
  `tests/entrevistas-da-planilha.test.js`).
- `src/lib/planilhas.js` (`entrevistados`): ID da planilha, nome da aba e área.
