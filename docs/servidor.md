# Servidor web do MONITORA

`server/servidor.ts` entrega o build do Vite. Substituiu o servidor Laravel/PHP em 22/09/2026,
com o mesmo contrato e sem regra de negócio: os dados continuam indo do navegador ao Supabase,
sob RLS. Não há chave do Supabase no servidor.

## O que ele faz

| Pedido | Resposta |
|---|---|
| `/`, `/index.html`, `/analises`, `/analises.html`, `/auth/callback`, `/auth/callback.html` | a página do `dist/`, idêntica byte a byte ao build, com `Cache-Control: no-store` |
| `/up` | `200 ok` — saúde para Docker e CI |
| `/assets/*`, `/icons/*`, `/data/*`, `manifest.webmanifest`, `offline.html`, `sw.js`, `sw-policy.js` | o arquivo estático, com ETag e gzip para texto e JSON |
| qualquer outra coisa (`/.env`, pastas, arquivos com ponto, `..`) | `404` |
| método diferente de GET/HEAD numa rota conhecida | `405` |

- **Cabeçalhos de segurança:** lidos do `vercel.json`. Vercel e servidor têm uma fonte só; mudou lá,
  mudou aqui. O HSTS só sai por HTTPS (conexão TLS ou `X-Forwarded-Proto: https` do proxy).
- **Cache:** arquivo com hash do Vite no nome (`main-QJvlLklo.js`) vai com `immutable` por um ano;
  o resto é `no-cache`, revalidado por ETag.
- **Páginas lidas do disco a cada requisição**, o que permite o `npm run dev` (build em watch +
  servidor) sem reiniciar nada.
- **`/data/*.json`** (terras indígenas, lotações) é servido. O Laravel não servia essa pasta, e as
  camadas do mapa quebravam lá.

## Rodar

```sh
npm run dev          # vite build --watch + servidor, em http://127.0.0.1:8000
npm run build        # build completo com checagens
npm start            # serve o dist/ existente
docker compose up --build -d
```

Variáveis de ambiente do servidor: `HOST` (padrão `127.0.0.1`; o container usa `0.0.0.0`),
`PORT` (padrão `8000`) e `DIST` (padrão `dist`).

## Por que TypeScript sem compilação

O Node 24 remove os tipos ao executar (`node server/servidor.ts`), então não há etapa de build
nem pasta de saída. A checagem de tipos é o `npm run typecheck` (`tsc`, só de desenvolvimento), e
ela roda dentro do `npm run build`. O `tsconfig.json` liga `erasableSyntaxOnly`: só vale sintaxe
que o Node sabe apagar (nada de `enum`, `namespace` ou parâmetro de construtor com modificador).

O servidor usa só módulos nativos do Node, então a imagem Docker final não tem `node_modules`.

## Testes

`tests/servidor.test.js` sobe o servidor numa porta aleatória, sobre um `dist` de teste, e fixa o
contrato acima. Herdou os casos do antigo `MonitoraRoutesTest.php`. `npm run test:smoke:servidor`
roda o smoke do Playwright contra ele, e o CI faz o mesmo contra a imagem Docker.

## Implantação

A imagem do `Dockerfile` é autossuficiente: `docker build --build-arg VITE_SUPABASE_URL
--build-arg VITE_SUPABASE_PUBLISHABLE_KEY -t monitora .` e `docker run -p 8000:8000 monitora`.
Em produção, coloque um proxy HTTPS na frente e preserve o domínio atual, para manter os endereços
de retorno do OAuth já autorizados. A Vercel continua sendo o caminho estático e não usa este servidor.
