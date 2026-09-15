# MONITORA em Laravel

## O que muda

O servidor Laravel 13 entrega o painel principal, Análises e o callback pelos
endereços existentes. PHP 8.5 e Composer passam a integrar o ambiente de execução.
Os módulos JavaScript, mapas, cronogramas, relatórios, autenticação e permissões
Supabase continuam responsáveis pelas mesmas funções. Não há migração de banco,
cópia de usuários, novo OAuth ou chave administrativa no servidor PHP.

Esta é a migração da camada web para Laravel, com preservação do cliente existente.
Não é uma reescrita dos RPCs/Postgres em Eloquent. As rotas entregam somente HTML
público; os dados continuam sujeitos à sessão e às políticas RLS existentes.

## Executar

Na raiz do repositório, com Node 24, PHP 8.5 e Composer 2 no PATH:

```sh
npm ci
composer --working-dir=laravel install
npm run build:laravel
php laravel/artisan serve --host=127.0.0.1 --port=8000
```

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente do
build, como antes. Sem essas variáveis a interface informa que a conexão não está
configurada. O arquivo `laravel/.env.example` documenta a configuração PHP; copie
para `laravel/.env` no ambiente e gere uma chave com `php laravel/artisan key:generate`
antes da implantação. Não publique esse arquivo nem use chaves service-role.

`npm run build:laravel` compila a aplicação e copia as páginas para
`laravel/resources/frontend`, fora da raiz pública. Somente assets e arquivos PWA
vão para `laravel/public`. O pacote mantém `/`, `/index.html`, `/analises`,
`/analises.html`, `/auth/callback` e `/auth/callback.html`.

```sh
npm run test:php
npm run test:smoke:laravel
```

Os testes PHP conferem a equivalência byte a byte das páginas compiladas, headers,
callback sem cache, rotas desconhecidas e rejeição de escrita. O smoke usa as
mesmas verificações do frontend contra o servidor Laravel.

## Implantação e retorno à versão anterior

O `Dockerfile` prepara Node/Vite e entrega PHP/Apache com document root em
`laravel/public`. Passe as variáveis públicas Supabase por `--build-arg`; as demais
configurações do servidor devem ser variáveis de runtime. Exemplo:

```sh
docker build --build-arg VITE_SUPABASE_URL --build-arg VITE_SUPABASE_PUBLISHABLE_KEY -t monitora-laravel .
docker run --rm -p 8000:80 --env-file laravel/.env -e APP_ENV=production -e APP_DEBUG=false monitora-laravel
```

Use HTTPS no ambiente de publicação e preserve o domínio atual para manter os
endereços OAuth já autorizados. Em outro domínio, a validação do redirect deve
preceder a publicação. O PR não altera a configuração do provedor de identidade.

A configuração Vercel existente continua sendo o caminho **estático**; ela não
executa Laravel. A implantação PHP precisa usar a imagem em uma hospedagem com
containers/PHP. Nenhum domínio, conta paga ou ambiente de produção foi alterado.
O build estático `dist` permanece disponível para retorno à versão anterior.

## Marca, ajuda e mapas

- Marca visível MONITORA no título, acesso, navegação, Análises e PWA.
- Arara Azul com ajuda recolhível por seção, sem timers, RPCs ou chat remoto.
- Avatar gerado com a ferramenta integrada de imagens, em
  `public/assets/arara-azul-monitora.png`. Prompt: arara-azul amigável para guiar o
  MONITORA, plumagem azul, pele amarela junto ao olho/bico, fundo transparente,
  uma asa em gesto de orientação, sem texto ou objetos adicionais.
- Correções de posição do selo, área dos mapas e lista nacional adaptadas do
  [PR #10 de Claude](https://github.com/AgSUS-COGIP/agsus-monitora/pull/10).
- Um único controlador troca o fundo cartográfico/satélite e atualiza os botões;
  erros tardios de camadas removidas são ignorados e duas fontes com falha não
  provocam alternância infinita.
- A importação CNES grava somente `rede_cnes`, sem sobrescrever `lmap`.

## Limites da validação

O funcionamento completo com sessão e dados de produção ainda exige homologação
autenticada. Não foram corrigidas coordenadas sem fonte verificável nem efetuado
backup da tabela de produção. O afastamento visual em leque de unidades
coincidentes permanece com suas linhas de ligação; a auditoria geográfica descrita
na passagem de Claude continua pendente. Medições de produção do PR #10 não são
apresentadas como novas medições desta migração.

Referências: [instalação Laravel](https://laravel.com/docs/13.x/installation),
[implantação Laravel](https://laravel.com/docs/13.x/deployment) e
[política de tiles OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).
O OSM permite navegação interativa normal; a necessidade de corrigir o fallback
não demonstra bloqueio por volume. Testes automatizados de mapas usam tiles
sintéticos, sem varrer os provedores públicos.
