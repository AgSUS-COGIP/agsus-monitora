# Configurações

A moldura (`configuracoes.jsx`), as seções (`secoes.js`) e o estado com a
publicação versionada (`estado.js`) estão descritos no topo de cada arquivo e
em `docs/arquitetura-react.md`. Aqui fica o que é próprio da seção
**Comemorações**.

## Comemorações

| Peça                                  | O quê                                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `comemoracoes.tsx`                    | a seção: catálogo de marcos, marcos personalizados, palco de testes e preferência pessoal                 |
| `palco-de-testes.tsx`                 | efeito, intensidade, duração e som escolhidos na hora, sem gravar                                         |
| `src/lib/catalogo-de-comemoracoes.ts` | catálogo, normalização e JSON publicado, decisão de mostrar, personalizados, revisão campo a campo        |
| `src/lib/motor-de-efeitos.js`         | cena, física e desenho de confete, serpentina, estrelas, corações e balões; embute os fogos de `fogos.js` |
| `src/modules/comemoracao.js`          | canvas, `requestAnimationFrame`, aviso, som e o evento da Aya                                             |
| `src/app/marcos-personalizados.js`    | avaliação dos personalizados com as linhas que o front já tem                                             |

**Persistência.** Chave `comemoracoes_marcos` de `TB_CONFIGURACAO`, publicada
pela barra fixa como as outras seções (`salvar_configuracoes_e_paineis_v2`,
com motivo e `TH_CONFIGURACAO`; restaurar uma versão também volta os marcos).
Sem migration: a tabela já aceita chaves novas. Vazio = tudo no padrão; o JSON
guarda só o que difere. A revisão da publicação mostra cada campo mudado
(`alteracoesDasComemoracoes`), não o JSON.

**Quem edita.** Quem edita configurações (`canManageSettings`, a mesma regra
das seções Marca… Operação e do banco: `has_perm('config')`). A
configuração é única para o sistema; não há edição por área para o gestor da
área, porque `TB_CONFIGURACAO` e a permissão são globais. Próximo passo, se
pedido: chave por área (`comemoracoes_marcos:<area>`) e RPC que confira o
gestor da área.

**Quem vê.** Só quem fez (quem vê a transição no próprio navegador).
"Toda a área online" fica desabilitado: a presença é uma batida a cada 45 s,
sem canal em tempo real por área. Próximo passo: um canal Supabase Realtime
por área (broadcast `comemoracao` com `{ marco, texto }`), que o app assine
depois de entrar.

**Respeita.** `prefers-reduced-motion` (só o aviso), o liga/desliga geral
(Módulos e abas › Sistema inteiro) e a preferência pessoal deste navegador
(`agsus_monitora_comemoracoes_desligadas` = `"1"`, `CHAVE_COMEMORACOES_PESSOAIS` em `src/lib/preferencia-de-comemoracoes.js`, a mesma que a mascote lê). "Testar" e o palco passam
`teste: true`: ignoram a configuração e a preferência pessoal e não gravam.

**Marcos personalizados.** "Edital X chegou a N contratados" (soma de
`contratados` das linhas do monitoramento, a cada carga/Realtime) e "a área
passou de N análises concluídas no dia" (linhas da tela de Análises, a cada
carga). Mesma regra dos outros marcos: linha de base em silêncio, comemora a
transição, uma vez por pessoa e navegador.

### Ponto de integração com a mascote (Aya)

O efeito **Aya comemorando** (e o **Combinado**) não desenha a arara: avisa a
mascote por evento na janela, e a mascote decide como reage.

```js
window.addEventListener("aya:estado", (evento) => {
  // { estado: "comemorando", duracaoMs } no começo; { estado: "parada" } no fim
  const { estado, duracaoMs } = evento.detail;
});
```

O nome do evento é `EVENTO_DA_AYA` em `src/modules/comemoracao.js`. Sem
mascote ouvindo, nada acontece. Com "Aya comemorando" no efeito, a arara que
voa nos fogos fica de fora, para não haver duas.
