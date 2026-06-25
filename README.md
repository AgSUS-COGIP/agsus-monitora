# AgSUS Monitora - versão modular Vite

Esta versão tira o sistema do HTML monolítico e organiza o projeto para deploy no Vercel.

## Estrutura

- `index.html`: entrada principal do sistema.
- `analises.html`: entrada do painel de análises.
- `src/styles/app.css`: estilos da aplicação principal.
- `src/modules/legacy-app.js`: lógica principal preservada durante a primeira refatoração.
- `src/analises/analises.css`: estilos do painel de análises.
- `src/analises/analises-app.js`: lógica do painel de análises.
- `src/lib/env.js`: leitura das variáveis de ambiente do Vercel.
- `supabase/migrations/`: histórico das mudanças aplicadas ao banco.

## Variáveis no Vercel

Configure em Project Settings > Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Também funciona com `VITE_SUPABASE_ANON_KEY` como fallback, mas o nome recomendado é `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Caminho de evolução

Esta é a primeira etapa segura: separa HTML, CSS, JS, ambiente e migrações sem redesenhar o sistema inteiro.

Próximas etapas recomendadas:

1. Trocar `onclick` inline por eventos em módulos.
2. Separar autenticação em `src/modules/auth/`.
3. Separar painéis externos em `src/modules/panels/`.
4. Separar administração e solicitações em `src/modules/admin/`.
5. Criar uma camada única para chamadas Supabase.
