# Upload dos arquivos de bibliotecas

Suba estes arquivos na raiz da branch do `agsus-monitora-vercel`, preservando as pastas:

- `package.json`
- `playwright.config.js`
- `vitest.config.js`
- `src/lib/formatters.js`
- `src/lib/sanitize.js`
- `src/lib/schemas.js`
- `src/lib/supabaseClient.js`
- `tests/lib/formatters.test.js`
- `tests/lib/sanitize.test.js`
- `tests/lib/schemas.test.js`
- `tests/smoke.spec.js`
- `.github/workflows/ci.yml`

Depois do upload, rode:

```bash
npm install
npm run test
npm run build
```

Se voce nao quiser rodar comandos localmente, o arquivo `.github/workflows/ci.yml`
faz o GitHub executar automaticamente `npm install`, `npm run test` e
`npm run build` quando voce subir os arquivos na branch.

Observacao: este pacote nao sobrescreve `src/modules/legacy-app.js`.
O arquivo e grande e nao foi possivel recuperar uma copia completa pelo ambiente atual.
Para integrar o cliente unico do Supabase nele, faca uma branch separada ou aplique o patch ja enviado anteriormente.
