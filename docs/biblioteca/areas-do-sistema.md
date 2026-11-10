---
tipo: decisao
area: front
atualizado: 2026-11-10
---

# Áreas do sistema (área é dado, não estrutura)

Cada edital pertence a uma **área**: Saúde Indígena, SEDE ou Projetos. Um sistema só serve as três;
muda só o que é próprio de cada uma (o mapa, as colunas de nota das análises).

## Decisões (proposta de arquitetura de 25/09/2026)

1. **Continua no Supabase** até estabilizar; depois migra para PostgreSQL próprio, como o SIGAV
   (`db_dataware`). As decisões foram pensadas para essa migração ser troca de camada, não
   reescrita.
2. **React** no front, migrando tela por tela ([[arquitetura-do-front]]).
3. **Área é dado, não estrutura**: a área é dimensão das tabelas e das permissões. Tabelas do
   núcleo (usuários, perfis, permissões, configuração, auditoria) são compartilhadas; as comuns às
   áreas (processo seletivo, cronograma, análise, aprovado, convocação) são uma tabela só com a
   coluna de área; o que é de uma área só (DSEI, polos, aldeias) tem tabela própria ligada à área.

A proposta completa, com o que ainda era plano na época, está em
[docs/_arquivo/arquitetura.md](../_arquivo/arquitetura.md); a seção do banco, em
[docs/banco-de-dados.md](../banco-de-dados.md) ("Edital sempre na área certa", "CCE e Escritório
Distrital e Regional são Projetos", "Lista de aprovados por área").

## Como aparece no app

- A área vai no endereço: `/saude-indigena/cronograma`, `/sede/classificacao/<edital>`; a
  administração em `/administracao/configuracoes/<seção>`.
- O menu é o mesmo em todas as áreas: **Acompanhar** (Visão geral, painéis e Cronograma),
  **Processo seletivo** na ordem do fluxo (Editais, Triagem, Avaliação documental, Recursos,
  Entrevistas, Classificação, Lista de aprovados) e **Administração** (Aparência, Pessoas e
  acessos, Sistema). Catálogo em `src/lib/menu-lateral.ts` (`BLOCOS_DA_AREA`/`blocoDaAba`).
- A área atual é definida pelo menu e lida por `usarAreaAtual()` /
  `src/componentes/dados-do-monitoramento.ts` (`linhasDaArea`, `soDosEditais`); Editais,
  Cronograma e Lista de aprovados recortam pelos ids dos editais da área.
- A API para outro sistema traz `area` e aceita `?area=` ([[funcoes-da-vercel]]).
- O mapa da Saúde Indígena só existe nela; Projetos tem o seu ([[mapas-e-leaflet]]).
- As regras das áreas para a Aya: `docs/aya/regras-das-areas.md`.

## Relacionadas

- [[permissoes-e-perfis]] — quem vê qual área
- [[modulo-barra-lateral]] — o menu por área
- [[modulo-visao-geral]] — a primeira tela de cada área
- [regras-das-areas](../aya/regras-das-areas.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
