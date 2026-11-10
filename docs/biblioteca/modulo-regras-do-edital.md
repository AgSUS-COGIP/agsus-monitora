---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Regras do edital

Página aberta em Editais (no lugar da tabela, sob demanda): numa página só, por edital, todas as
regras do processo na ordem das etapas — 1 Triagem, 2 Avaliação documental, 3 Entrevista,
4 Classificação e 5 Chamada para contratação. Pasta `src/modulos/regras-do-edital/`; rota
`/<área>/editais/<edital>/regras/<etapa>`.

## Como funciona

- Cada etapa usa o editor (e as RPCs) que já existia na tela da etapa, com a mesma loja; nada aqui
  calcula ou grava por conta própria. Salvar não recalcula nada (o 114/2026 segue congelado).
- Todas editam aqui, com a permissão de sempre — o banco decide: coordenação do edital, gestor da
  classificação, quem configura a entrevista ou a convocação, ou o administrador global. Quem não
  pode vê a regra travada.
- A Entrevista edita o roteiro e a banca (`entrevistas/editor-da-configuracao.tsx`, loja de
  condução); a Chamada para contratação, a configuração de convocação
  (`aprovados/chamada-para-contratacao.tsx`, loja da Lista de aprovados).
- Carrega sob demanda: o pacote dos editores só baixa quando a página abre (`lazy()` em
  `editais/nucleo.tsx`).
- O "voltar" do navegador fecha a página (histórico, em `editais/estado.ts`).

## Arquivos

```
regras-do-edital.tsx           a página (etapas em ETAPAS_DAS_REGRAS, de src/lib/regras-do-edital.ts)
etapas.tsx                     as etapas sem editor na pasta da Triagem: montam o editor da tela
lojas.ts                       as MESMAS lojas das telas (Avaliação documental, Entrevista,
                               Classificação), criadas uma vez por cliente do banco; cada loja
                               escuta a troca de sessão; rascunho guardado também é o mesmo
                               (tipos ANALISE e CLASSIFICACAO, src/app/rascunho-da-regra.ts)
abrir.ts                       abrirRegrasDoEdital(edital, etapa): o "Editar nas Regras do edital"
                               das telas das etapas; navega por window.navigate("nucleo", {edital,
                               regras}), que confere a permissão de Editais e põe o endereço
resumo-da-regra-da-etapa.tsx   a regra só para ler no topo da tela da etapa (Avaliação documental,
                               Classificação): versão, situação, uma linha por regra; sem regra,
                               aviso curto e o mesmo botão. Linhas de
                               src/lib/regras-do-edital-resumos.ts, por import() na primeira vez
                               (até lá, esqueleto)
regras-do-edital.css, resumo-da-regra-da-etapa.css
```

## Relacionadas

- [[modulo-editais]] — onde a página abre
- [[modulo-triagem]], [[modulo-avaliacao-documental]], [[modulo-entrevistas]],
  [[modulo-classificacao]], [[modulo-aprovados]] — as etapas cujos editores aparecem aqui
- [[permissoes-e-perfis]] — quem edita cada etapa
