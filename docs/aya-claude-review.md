# Revisão manual da Aya com Claude

Este projeto não usa a API do Claude como fallback automático, para evitar custo por uso e envio silencioso de dados do MONITORA a terceiros.

Quando uma parte da implementação precisar de uma segunda revisão técnica, use o Claude manualmente com código sanitizado e sem dados reais de usuários.

## O que pode ser enviado

- trechos de código do repositório sem segredos;
- mensagens de erro e logs sem tokens, e-mails, CPF, nomes ou dados pessoais;
- testes unitários;
- arquitetura do bridge Ollama;
- prompts institucionais que não contenham dados reais da tela.

## O que não deve ser enviado

- `AYA_LOCAL_BRIDGE_KEY`;
- tokens Supabase;
- cookies/sessões;
- chaves de API;
- dados pessoais ou registros internos reais;
- conteúdo integral de telas com informações restritas.

## Prompt de revisão recomendado

```text
Você está revisando uma implementação do AgSUS MONITORA.

Objetivo: a assistente Aya usa Ollama + Qwen3 local, sem API paga. O sistema possui contexto fixo por página e contexto vivo coletado da tela. O Ollama não deve ser exposto diretamente na internet; existe um bridge autenticado por chave. A sessão do usuário é validada pelo Supabase antes da chamada à IA.

Revise apenas o código fornecido e procure:
1. falhas de segurança;
2. problemas de concorrência, timeout ou disponibilidade;
3. risco de vazamento de dados;
4. prompt injection ou confusão entre instruções e dados da tela;
5. problemas de arquitetura entre frontend, /api/aya, bridge local e Ollama;
6. bugs que façam a Aya perder o contexto da página;
7. testes adicionais necessários.

Não invente arquivos ou dependências. Para cada problema, informe arquivo, trecho aproximado, impacto e correção mínima sugerida.
```

## Fluxo

1. reproduzir o problema localmente;
2. tentar corrigir no repositório e adicionar teste;
3. se ainda houver dúvida, enviar ao Claude somente o trecho sanitizado relevante;
4. revisar criticamente a sugestão recebida antes de aplicá-la;
5. aplicar a correção no mesmo PR e passar pelo Quality Gate.
