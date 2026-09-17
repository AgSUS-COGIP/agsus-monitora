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
ollama pull qwen3:8b
ollama run qwen3:8b
```

Se o computador tiver pouca memória, use `qwen3:4b` e configure `AYA_LOCAL_MODEL=qwen3:4b` no ambiente do MONITORA.

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
AYA_LOCAL_MODEL=qwen3:8b
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
