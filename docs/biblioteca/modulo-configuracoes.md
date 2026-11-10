---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Configurações

Todas as seções em React: Marca, Página inicial, Tela de acesso, Aparência, Painéis externos,
Operação, Comemorações e as que têm tela própria (Acessos, Módulos e abas, Automação, Status das
atualizações). Pasta `src/modulos/configuracoes/`; rota `config`, cada seção em
`/administracao/configuracoes/<seção>`.

## Moldura

- `configuracoes.tsx` — a moldura (rota `config`).
- `secoes.ts` — a lista das seções; cada uma é rota desenhada pela página em `src/app/telas.tsx`
  (seção com tela própria registrada como `secao:<id>`).
- `estado.ts` — estado com a publicação versionada (barra fixa de publicar, com motivo e histórico em
  `TH_CONFIGURACAO`). Detalhe no topo de cada arquivo e em
  [docs/arquitetura-react.md](../arquitetura-react.md).
- Regras puras: `src/lib/publicacao-de-configuracoes.ts` (chaves de cada seção, comparação com o
  retrato do banco, validação de URL e domínio), `apresentacao-das-configuracoes.ts` (tom da faixa de
  aviso global e endereço de imagem aceito nas prévias), `marca-da-barra-lateral.ts` (logo e cor
  publicadas e em rascunho), `paineis-externos-das-configuracoes.ts`.

## Comemorações

| Peça                                  | O quê                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `comemoracoes.tsx`                    | a seção: catálogo de marcos, personalizados, palco de testes e preferência pessoal      |
| `palco-de-testes.tsx`                 | efeito, intensidade, duração e som escolhidos na hora, sem gravar                       |
| `src/lib/catalogo-de-comemoracoes.ts` | catálogo, normalização, JSON publicado, decisão de mostrar, revisão campo a campo       |
| `src/lib/motor-de-efeitos.ts`         | confete, serpentina, estrelas, corações e balões; embute os fogos de `fogos.ts`         |
| `src/modulos/comemoracao/`            | canvas, `requestAnimationFrame`, aviso, som e o evento da Aya                           |
| `src/app/marcos-personalizados.ts`    | avaliação dos personalizados com as linhas que o front já tem                           |

`src/modulos/comemoracao/` é filha da casca: aviso no topo (`role="status"`) com "Pular", botão de
som (desligado por padrão) e ×; efeito num `<canvas>` (véu escuro com fogos ou estrelas); a Aya
(`src/modulos/aya/mascote/`) atravessa a tela nos fogos; a frase do marco é texto numa placa
escura (`letreiro.tsx`). Tudo por portal no fim do `body`.

- **Persistência.** Chave `comemoracoes_marcos` de `TB_CONFIGURACAO`, publicada pela barra fixa
  (`salvar_configuracoes_e_paineis_v2`, com motivo e `TH_CONFIGURACAO`; restaurar versão volta os
  marcos). Sem migration. Vazio = padrão; o JSON guarda só o que difere. A revisão mostra cada campo
  mudado (`alteracoesDasComemoracoes`), não o JSON.
- **Quem edita.** Quem edita configurações (`canManageSettings`, `has_perm('config')`). Configuração
  única para o sistema (sem edição por área: `TB_CONFIGURACAO` e a permissão são globais). Próximo
  passo, se pedido: chave por área (`comemoracoes_marcos:<area>`) e RPC que confira o gestor.
- **Quem vê.** Só quem fez (quem vê a transição no próprio navegador). "Toda a área online" fica
  desabilitado: a presença é uma batida a cada 45 s, sem canal por área. Próximo passo: canal
  Supabase Realtime por área (broadcast `comemoracao` com `{ marco, texto }`).
- **Respeita** `prefers-reduced-motion` (só o aviso e a frase), o liga/desliga geral (Módulos e abas
  › Sistema inteiro) e a preferência pessoal (`agsus_monitora_comemoracoes_desligadas` = `"1"`,
  `CHAVE_COMEMORACOES_PESSOAIS` em `src/lib/preferencia-de-comemoracoes.ts`, a mesma da mascote).
  "Testar" e o palco passam `teste: true`: ignoram configuração e preferência e não gravam.
- **Marcos personalizados.** "Edital X chegou a N contratados" (soma de `contratados` das linhas do
  monitoramento, a cada carga/Realtime) e "a área passou de N análises concluídas no dia" (linhas de
  Análises). Linha de base em silêncio, comemora a transição, uma vez por pessoa e navegador.

### Integração com a mascote (Aya)

**Aya comemorando** (e o **Combinado**) não desenha a arara: avisa a mascote por evento na janela.

```js
window.addEventListener("aya:estado", (evento) => {
  // { estado: "comemorando", duracaoMs } no começo; { estado: "parada" } no fim
  const { estado, duracaoMs } = evento.detail;
});
```

O nome é `EVENTO_DA_AYA` em `src/modulos/comemoracao/comemoracoes.tsx`. Sem mascote ouvindo, nada
acontece. Com "Aya comemorando", a arara que voa nos fogos fica de fora, para não haver duas.

## Relacionadas

- [[modulo-acessos]], [[modulo-modulos-e-abas]], [[modulo-automacao]],
  [[modulo-status-das-atualizacoes]], [[modulo-paineis-externos]] — as outras seções
- [[modulo-encerramento-do-edital]] — usa os fogos do catálogo
- [[modulo-aya]] — a mascote que ouve `aya:estado`
- [[modulo-barra-lateral]] — logo e cor publicadas aqui
- [[acessibilidade]] — `prefers-reduced-motion`
