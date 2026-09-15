# MONITORA

Aplicação de monitoramento com servidor Laravel/PHP, cliente modular Vite e
integração com Supabase. Veja [como executar, testar e implantar em Laravel](docs/monitora-laravel.md).
O build estático anterior continua disponível para compatibilidade durante a homologação.

## Visao geral

O projeto contem:

- aplicacao principal em `index.html`;
- painel de analises em `analises.html`;
- callback de autenticacao em `auth/callback.html`;
- codigo JavaScript modular em `src/`;
- estilos separados em `src/styles/` e `src/analises/`;
- configuracao de ambiente em `src/lib/env.js`;
- migracoes de banco em `supabase/migrations/`;
- plano tecnico de evolucao em `docs/arquitetura-evolucao.md`.

## Stack tecnica

- Vite
- JavaScript modular
- HTML e CSS
- Supabase
- Vercel

## Estrutura principal

```text
.
├── index.html
├── analises.html
├── auth/
│   └── callback.html
├── docs/
│   └── arquitetura-evolucao.md
├── src/
│   ├── analises/
│   ├── auth/
│   ├── lib/
│   ├── modules/
│   ├── styles/
│   └── main.js
├── supabase/
│   └── migrations/
├── package.json
├── vite.config.js
└── README.md
```

## Requisitos para executar

Antes de rodar o projeto, confirme que a maquina possui:

- Node.js instalado;
- npm instalado;
- acesso ao repositorio no GitHub;
- acesso ao projeto correspondente no Vercel, quando for publicar;
- acesso ao projeto correspondente no Supabase, quando for validar banco, autenticacao ou permissoes.

## Instalacao local

Clone o repositorio:

```bash
git clone https://github.com/yassurysuira-boop/agsus-monitora.git
cd agsus-monitora
```

Instale as dependencias:

```bash
npm install
```

Crie um arquivo `.env.local` na raiz do projeto com as variaveis necessarias:

```bash
VITE_SUPABASE_URL=cole_a_url_do_supabase_aqui
VITE_SUPABASE_PUBLISHABLE_KEY=cole_a_chave_publicavel_aqui
```

Tambem existe compatibilidade com:

```bash
VITE_SUPABASE_ANON_KEY=cole_a_chave_anon_aqui
```

O nome recomendado para novos ambientes e `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Comandos disponiveis

Rodar em desenvolvimento:

```bash
npm run dev
```

Gerar build de producao:

```bash
npm run build
```

Testar localmente o build gerado:

```bash
npm run preview
```

## Configuracao no Vercel

No Vercel, configure as variaveis em:

`Project Settings > Environment Variables`

Variaveis obrigatorias:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Variavel aceita como fallback:

- `VITE_SUPABASE_ANON_KEY`

Depois de alterar variaveis de ambiente, faca um novo deploy para garantir que o build use os valores atualizados.

## Supabase

As mudancas de banco devem ficar registradas em:

```text
supabase/migrations/
```

Antes de alterar estrutura, permissoes, autenticacao ou regras de acesso, valide:

- quais tabelas serao afetadas;
- quais perfis de usuario usam a funcionalidade;
- se ha impacto em login, solicitacao de acesso, aprovacoes ou paineis;
- se a mudanca precisa de migracao versionada;
- se ha politicas de seguranca ou RLS relacionadas.

Nao coloque chaves secretas, tokens, senhas ou credenciais no repositorio.

## Fluxo seguro de trabalho

1. Criar uma branch a partir de `main`.
2. Implementar a alteracao.
3. Rodar `npm run build`.
4. Publicar preview no Vercel.
5. Testar login, permissoes, paineis e analises.
6. Abrir Pull Request.
7. Fazer merge em `main` somente depois da validacao.

## Checklist antes de publicar em producao

- O build do Vercel passou.
- `index.html` abre corretamente.
- `analises.html` abre corretamente.
- Login Google funciona para conta autorizada.
- Usuario sem perfil cai no fluxo esperado de solicitacao de acesso.
- Solicitacoes aparecem para administracao.
- Administrador consegue aprovar usuario e configurar permissoes.
- Paineis externos carregam ou exibem mensagem clara de indisponibilidade.
- Variaveis do Supabase estao configuradas no ambiente correto.
- Nenhum segredo foi commitado no repositorio.

## Como baixar o projeto inteiro para outra coordenacao

Ha duas formas recomendadas.

a. Clonar o repositorio com:

```bash
git clone https://github.com/yassurysuira-boop/agsus-monitora.git
```

Depois disso, a equipe deve configurar o `.env.local` localmente e solicitar acesso aos projetos no Vercel e no Supabase.

### Opcao 2: baixar ZIP pelo GitHub

Esta opcao serve para entrega simples de uma copia do codigo.

1. Acesse o repositorio no GitHub.
2. Clique em `Code`.
3. Clique em `Download ZIP`.
4. Envie o arquivo ZIP para a outra coordenacao.

Link direto, se o usuario estiver autenticado no GitHub e tiver acesso ao repositorio:

```text
https://github.com/yassurysuira-boop/agsus-monitora/archive/refs/heads/main.zip
```

Importante: o ZIP nao leva variaveis de ambiente, credenciais, configuracoes internas do Vercel nem acessos do Supabase. Esses itens precisam ser concedidos separadamente.

## Itens que devem acompanhar a transferencia

Para a outra coordenacao conseguir prosseguir com seguranca, envie ou conceda acesso a:

- repositorio GitHub;
- projeto no Vercel;
- projeto no Supabase;
- variaveis de ambiente usadas no Vercel;
- orientacao sobre contas autorizadas no login;
- regras atuais de aprovacao de usuarios;
- lista de paineis externos usados pelo sistema;
- historico de decisoes tecnicas em `docs/arquitetura-evolucao.md`.

## Caminho de evolucao tecnica

O plano detalhado esta em:

```text
docs/arquitetura-evolucao.md
```

Proximas etapas recomendadas:

1. Estabilizar login Google e solicitacao de acesso.
2. Melhorar painel de aprovacao de usuarios.
3. Separar um cliente unico para Supabase.
4. Remover handlers inline gradualmente.
5. Criar testes simples de build e smoke test.
6. Melhorar mensagens de erro e estados vazios.

## Observacoes para manutencao

- `main` deve ser tratada como branch de producao.
- Mudancas estruturais devem passar por Pull Request.
- Alteracoes no banco devem ser versionadas em `supabase/migrations/`.
- Dados sensiveis e credenciais nao devem ser salvos no GitHub.
- Antes de grandes refatoracoes, priorize pequenas entregas validadas em preview.
