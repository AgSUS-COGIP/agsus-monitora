# Aya com Ollama local

Objetivo: executar a IA da Aya no computador do responsável pelo MONITORA, sem API paga por token.

## Arquitetura

MONITORA (Vercel) -> /api/aya -> bridge HTTPS -> computador local -> Ollama -> modelo local

O Ollama nunca deve ser exposto diretamente à internet. O processo `scripts/aya-local-bridge.mjs` escuta apenas em `127.0.0.1` por padrão e exige uma chave compartilhada em todas as chamadas de chat.

Antes de consultar o modelo, a Aya combina o contexto fixo da página atual com o contexto vivo permitido da interface, como filtros, indicadores, DSEIs, territórios, editais e processos visíveis. O contexto enviado ao modelo deve continuar limitado ao que o usuário autenticado já pode acessar no MONITORA.

## 1. Instalar Ollama

Instale o Ollama para Windows pelo site oficial.

Depois, no PowerShell:

```powershell
ollama pull qwen3:1.7b
```

O modelo padrão é `qwen3:1.7b`, escolhido por medição: em máquina sem GPU dedicada ele gera a ~13 tokens/s, o que mantém a resposta em torno de 12s. Modelos maiores (`qwen3:4b`, `qwen3:8b`) continuam permitidos, mas só valem em máquina com GPU: o `qwen3:8b` medido em CPU levou 97s e estourava todos os limites de tempo.

O bridge mantém o modelo residente na memória (`keep_alive: -1`) e o aquece ao iniciar. Sem isso o Ollama o descarrega após 5 minutos ocioso e a pergunta seguinte paga a recarga.

## 2. Preparar o repositório no computador

No PowerShell, dentro do repositório:

```powershell
npm install
$env:AYA_LOCAL_BRIDGE_KEY="troque-por-uma-chave-longa-e-aleatoria"
npm run aya:bridge
```

O bridge iniciará em:

```text
http://127.0.0.1:8787
```

Teste local:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

## 3. Publicar somente o bridge por HTTPS

O endpoint externo deve apontar para `http://127.0.0.1:8787` por meio de um túnel HTTPS autenticado. Não publique a porta 11434 do Ollama e não abra essa porta no roteador.

A URL HTTPS resultante será configurada no ambiente do MONITORA como:

```text
AYA_LOCAL_BRIDGE_URL=https://SEU-ENDERECO-HTTPS
AYA_LOCAL_BRIDGE_KEY=a-mesma-chave-do-computador
AYA_LOCAL_MODEL=qwen3:1.7b
```

## 4. Segurança

- O usuário continua sendo autenticado pelo Supabase antes de `/api/aya` aceitar a pergunta.
- O bridge só aceita chamadas com `X-Aya-Bridge-Key` correta.
- O Ollama permanece acessível apenas pelo próprio computador.
- A chave não deve ser colocada no código ou em arquivo versionado.
- Não use `0.0.0.0` para o Ollama nem abra a porta 11434 na internet.
- O contexto da Aya deve respeitar as mesmas permissões do usuário no MONITORA.

## 5. Disponibilidade

Se o computador reiniciar, Ollama, bridge e túnel precisam iniciar novamente. Para uso permanente, configure os três processos para iniciar com o Windows e desative suspensão automática da máquina.

## 6. Subir sozinho e anunciar o próprio endereço

Sem domínio próprio, o túnel é um quick tunnel e recebe hostname novo a cada
execução. Manter isso numa variável da Vercel obrigava a reconfigurar e
redeployar a cada reinício da máquina, e a Aya ficava sem IA no meio-tempo.

Duas peças resolvem isso.

`npm run aya:servico` sobe o bridge, sobe o túnel, anuncia o endereço no banco
e reinicia o que cair. Um túnel novo tem hostname novo, então todo reinício do
túnel é seguido de novo anúncio. A cada cinco minutos o serviço renova a marca
de presença, que é como a `/api/aya` distingue máquina ligada de registro velho.

Para subir junto com o Windows, uma vez:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\aya-instalar-servico.ps1
```

A tarefa roda no logon do usuário, sem privilégio de administrador e sem senha
guardada. Para remover, o mesmo comando com `-Remover`.

### Ativação no banco, uma única vez

A migration `20260918120000_registro_do_bridge_da_aya.sql` cria a tabela e as
funções, mas nasce inerte: enquanto o segredo de escrita não for definido,
nenhum anúncio é aceito e a `/api/aya` continua usando `AYA_LOCAL_BRIDGE_URL`.

Para ativar, gere o hash na própria máquina e cole apenas o hash no editor SQL
do projeto. O hash é irreversível, então não é segredo e pode ser copiado sem
cuidado especial:

```powershell
$k = [Environment]::GetEnvironmentVariable("AYA_LOCAL_BRIDGE_KEY","User")
$sha = [System.Security.Cryptography.SHA256]::Create()
$hash = ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($k)) | ForEach-Object { $_.ToString("x2") }) -join ""
Write-Output "update public.aya_bridge set chave_sha256 = '$hash' where id;"
```

Rode no SQL o comando que sair daí.

Existe também `definir_segredo_bridge_aya('<chave>')`, que recebe a chave em
texto e calcula o hash. Evite: copiar 48 caracteres à mão erra, e o erro só
aparece depois, como `chave_invalida` no anúncio. A função ainda recusa
sobrescrever um segredo já definido, então corrigir exige o `update` acima de
qualquer forma.

Feito isso, `AYA_LOCAL_BRIDGE_URL` deixa de ser necessária na Vercel. Ela
continua sendo lida como alternativa, então pode ficar onde está sem prejuízo.

### Requisitos locais

O serviço lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do ambiente
ou do `.env.local`, e `AYA_LOCAL_BRIDGE_KEY` do ambiente do Windows:

```powershell
setx AYA_LOCAL_BRIDGE_KEY "<chave>"
```
