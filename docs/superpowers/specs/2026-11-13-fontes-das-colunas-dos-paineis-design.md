# Fontes das colunas dos Painéis — desenho

Data: 13/11/2026 · Branch: `funcionalidade/aba-de-paineis` · Módulo: Painéis (bloco Dados),
`src/modulos/paineis-de-dados/`, nota [[modulo-paineis-de-dados]].

## Intenção

Hoje cada coluna dos três relatórios dos Painéis (Resumo dos editais, Editais por cargo,
Aprovados) tem uma origem fixa, escrita no SQL das RPCs da migration
`20261113210000_relatorios_dos_paineis.sql`. A verificação de 13/11/2026 mostrou que a melhor
origem de uma mesma coluna muda de área para área: as vagas imediatas por vaga estão no título da
vaga em metade dos casos da Saúde Indígena e nunca na SEDE; existe outra fonte por vaga (a
configuração da convocação, `TB_VAGA_IMEDIATA`) que hoje cobre poucas vagas mas pode crescer.

O usuário quer trocar, **pelo sistema e por área**, de onde cada coluna puxa o dado, sem depender
de desenvolvimento a cada troca. Um editor de SQL foi descartado por segurança (uma RPC que executa
SQL digitado roda com privilégio do dono e lê qualquer tabela, inclusive CPF e contatos). A escolha
é um **seletor**: fontes conferidas, criadas por migration, que o editor lista a partir do próprio
catálogo do banco (os nomes das visões e das colunas).

## Objetivos

- Botão **Fontes dos dados** no relatório aberto: um editor que mostra, para a área escolhida no
  menu, cada coluna editável com a origem em uso e permite trocar por outra fonte compatível ou
  voltar ao padrão.
- As fontes são **visões num schema próprio, `painel`**, criadas só por migration. O editor lista
  as visões e as colunas lendo o catálogo do PostgreSQL (com os rótulos dos `COMMENT ON`).
  Fonte nova = visão nova numa migration; aparece no seletor sem mexer em RPC nem em tela.
- A escolha vale **por área**. Sem escolha, a coluna usa o **padrão** (o SQL de hoje).
- Cada troca guarda **histórico**: quem, quando, de qual fonte para qual e o motivo.
- Todos que veem o relatório sabem a fonte em uso de cada coluna (marcador no cabeçalho, com a
  fonte na dica), e o XLSX ganha uma aba **Fontes** com a origem de cada coluna.

## Fora do escopo (agora)

- SQL digitado em qualquer forma.
- Criar colunas ou relatórios novos pela tela.
- Mudar quais linhas aparecem (os editais, as vagas e os aprovados continuam os de hoje; é isso
  que faz os totais fecharem entre os relatórios).
- Fallback automático entre fontes (a coluna mostra o que a fonte escolhida tem; vazio é vazio).

## O que faria isso dar errado mesmo funcionando (anti-objetivos)

- Qualquer caminho em que texto vindo do navegador vire SQL sem passar pela lista do catálogo.
- Uma fonte de fora do schema `painel`, ou o schema `painel` exposto pela API do Supabase.
- Uma fonte que mostre dado de outra área: a fonte só é **juntada** às linhas que a RPC do
  relatório já recortou (área, coordenação, editais ativos e fora de treinamento).
- A escolha de uma área mudar o relatório de outra.

## Restrições do projeto

- Dados só por RPC `SECURITY DEFINER` com `set search_path to ''`; RPC nova ou mudada vai para
  `src/lib/rpc-contrato.ts` (o `check:rpc-contract` quebra o build).
- Nomes no padrão MAD (rodar a skill `mad-ddl-review` no DDL); `COMMENT ON` em tudo.
- Migration aplicada à mão, com ensaio e rollback de mesmo nome, registrada em
  `public.migracoes_aplicadas`; nunca `supabase db push`. As duas migrations dos Painéis já estão
  aplicadas (13/11/2026): **mudança nelas = migration nova**.
- `scripts/gerar-esquema-atual.mjs` (`SCHEMAS`) passa a incluir `painel`, para o retrato do banco
  mostrar as visões.
- Front: React em `src/modulos/paineis-de-dados/`, visual de `src/ui/` com tokens, lógica pura em
  `src/lib/` com teste, nenhuma dependência nova.

## Abordagens consideradas

- **A. Lista fixa de fontes por coluna** (opções escritas na RPC e na tela). Simples e segura, mas
  cada fonte nova pede mudança de RPC e de tela.
- **B. Visões num schema próprio + seletor de colunas (escolhida).** As fontes são visões
  conferidas; o editor lista visões e colunas do catálogo do banco; a RPC monta a junção a partir
  da escolha, validada contra o catálogo. Mais trabalho agora, mas fonte nova não mexe em RPC nem
  em tela, e é o que o usuário descreveu ("um SQL que puxa os nomes das colunas").
- **C. Editor de SQL.** Descartada pelo usuário: inseguro.

## O desenho

### 1. Grão de cada relatório e a chave das fontes

Toda visão de `painel` declara o grão pelo nome e traz a chave do grão com o nome exato:

| Relatório          | Grão     | Nome da visão                 | Chave obrigatória                       |
| ------------------ | -------- | ----------------------------- | --------------------------------------- |
| Resumo dos editais | edital   | `painel."VW_EDITAL_<NOME>"`   | `CO_MONITORAMENTO uuid`                 |
| Editais por cargo  | vaga     | `painel."VW_VAGA_<NOME>"`     | `CO_MONITORAMENTO uuid`, `CO_VAGA text` |
| Aprovados          | aprovado | `painel."VW_APROVADO_<NOME>"` | `CO_CANDIDATO_APROVADO uuid`            |

- A chave deve ser única na visão (no máximo uma linha por chave); o ensaio de cada migration de
  fonte confere isso.
- `COMMENT ON VIEW` = o rótulo da fonte no seletor ("Vagas da convocação"); `COMMENT ON COLUMN` =
  o rótulo da coluna. Visão ou coluna sem comentário não aparece no seletor.
- No relatório 2, as linhas sem código de vaga (vagas de outras bancas, aprovados de vaga sem
  código, edital sem vaga na Seleção) ficam **vazias** numa coluna com fonte não padrão.

### 2. Colunas editáveis

As colunas que identificam a linha ficam fixas (edital, DSEI/unidade, código da vaga, cargo,
nome). Editáveis:

| Relatório          | Coluna (campo)                                 | Tipo    |
| ------------------ | ---------------------------------------------- | ------- |
| Resumo dos editais | Total de vagas imediatas (`vagas_imediatas`)   | inteiro |
|                    | Data da divulgação (`data_divulgacao`)         | data    |
|                    | Data final do processo seletivo (`data_final`) | data    |
| Editais por cargo  | Vagas imediatas (`vagas_imediatas`)            | inteiro |
|                    | Total de inscritos (`inscritos`)               | inteiro |
|                    | Total de aprovados (`aprovados`)               | inteiro |
| Aprovados          | Nota (`nota`)                                  | decimal |
|                    | Classificação (`classificacao`)                | inteiro |
|                    | Status (`status`)                              | texto   |
|                    | Matrícula (`matricula`)                        | texto   |
|                    | Data de admissão (`data_contratacao`)          | data    |

O seletor só oferece colunas de tipo compatível: inteiro ← `smallint`, `integer`, `bigint`;
decimal ← os inteiros, `numeric`, `real`, `double precision`; data ← `date`, `timestamp`,
`timestamptz` (convertidos para a data de Brasília); texto ← `text`, `varchar`, `char`. O que a
RPC devolve continua no formato que o front já lê (`src/lib/relatorios-dos-paineis.ts`).

### 3. Catálogo inicial de fontes (primeira migration)

Visões que embrulham as alternativas que já existem no banco (o construtor confere cada coluna no
`supabase/esquema-atual.sql` antes de escrever):

- `VW_EDITAL_QUADRO_DE_VAGAS` — soma de `TB_QUADRO_VAGA_EDITAL.QT_VAGA_IMEDIATA` (registros
  ativos) por edital.
- `VW_EDITAL_VAGAS_DA_CONVOCACAO` — soma de `TB_VAGA_IMEDIATA.QT_VAGA_IMEDIATA` por edital.
- `VW_EDITAL_CADASTRO` — as datas e as vagas do formulário do edital, sem o cronograma
  (`data_inicio`, `data_fim`, `vagas_total`).
- `VW_VAGA_CONVOCACAO` — `TB_VAGA_IMEDIATA.QT_VAGA_IMEDIATA` por edital e vaga.
- `VW_VAGA_TRIAGEM` — o último `TB_PRE_CLASSIF_VAGA` de cada vaga (`QT_VAGA_IMEDIATA`,
  `QT_INSCRITO`).
- `VW_VAGA_INSCRICOES` — o último retrato de `TH_INSCRICAO_VAGA_EDITAL.QT_INSCRITO` por vaga.
- `VW_APROVADO_CONTRATACAO` — o status calculado pela contratação
  (`TB_CONTRATACAO_APROVADO."TP_SITUACAO"`).
- `VW_APROVADO_ANTES_DA_DECISAO_JUDICIAL` — `nota_original` e `classificacao_original`.

### 4. Configuração e histórico (banco)

- `public."TB_FONTE_COLUNA_PAINEL"`: `CO_AREA`, `CO_RELATORIO`, `CO_COLUNA`, `NO_VISAO`,
  `NO_COLUNA_VISAO`, `DS_MOTIVO`, `CO_USUARIO_ATUALIZACAO`, `DT_ATUALIZACAO`; chave
  (`CO_AREA`, `CO_RELATORIO`, `CO_COLUNA`). Sem linha = padrão.
- `public."TH_FONTE_COLUNA_PAINEL"`: cada troca, com a fonte de antes e a de depois, quem, quando
  e o motivo (3 a 500 caracteres).
- RLS ligada e sem policy (só as RPCs alcançam). Os códigos de relatório e de coluna válidos ficam
  numa função de catálogo (`private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"()`), espelho da tabela da
  seção 2 e conferida por teste contra `src/lib/relatorios-dos-paineis.ts`.

### 5. RPCs

- `listar_fontes_do_painel(p_area, p_relatorio)` — para cada coluna editável do relatório: a
  escolha da área (ou padrão), as opções compatíveis (visões do grão, com rótulos e colunas de
  tipo compatível) e o histórico recente. Exige `paineis_dados` ≥ Leitor e acesso à área.
- `salvar_fonte_da_coluna(p_area, p_relatorio, p_coluna, p_visao, p_coluna_visao, p_motivo)` —
  `p_visao` nulo = voltar ao padrão. Exige `paineis_dados` = Administrador e acesso à área.
  Valida contra o catálogo do PostgreSQL: a visão existe em `painel`, é do grão do relatório,
  tem a chave, tem comentário; a coluna existe, tem comentário e tipo compatível. Grava a
  configuração e o histórico na mesma transação.
- As três RPCs dos relatórios (migration nova, mesmas assinaturas): montam as linhas do padrão
  como hoje e, para cada coluna com fonte configurada na área, trocam o valor pelo da fonte com
  `left join painel.<visão>` na chave. Os nomes entram no SQL só por `format('%I')` e **depois de
  revalidados no catálogo na hora da leitura** (a configuração nunca é confiada). Fonte que
  deixou de existir: a coluna fica vazia e a resposta avisa. A resposta ganha
  `fontes: { <coluna>: { visao, coluna, rotulo } }` com a origem de cada coluna (padrão
  incluído).

### 6. Tela

```
[ Baixar CSV ] [ Baixar XLSX ] [ Fontes dos dados ]

Gaveta "Fontes dos dados — Editais por cargo · Saúde Indígena"
  Vagas imediatas        Origem: [ Padrão: título da vaga ▾ ]
                         Coluna: [ —                       ▾ ]
  Total de inscritos     Origem: [ Triagem ▾ ]  Coluna: [ Inscritos ▾ ]
  …
  Motivo da troca: [______________________]   [ Salvar ]  [ Voltar ao padrão ]
  Histórico: 13/11 14:02 · Fulano · Vagas imediatas: padrão → Vagas da convocação · "motivo"
```

- O botão fica na barra do relatório, ao lado dos downloads. Quem não é Administrador em
  Painéis abre a gaveta só para ver (sem os controles).
- A gaveta edita a área escolhida no menu; trocar de área no menu troca a gaveta.
- Depois de salvar, o relatório aberto é relido (como o Sincronizar).
- Coluna com fonte não padrão: marcador discreto no cabeçalho, com a fonte na dica.
- XLSX: aba "Fontes" (coluna → fonte usada). O CSV não muda.

### 7. Testes e documentação

- Lógica pura (compatibilidade de tipos, leitura das opções e das `fontes` da resposta) em
  `src/lib/` com teste; tela (gaveta, só leitura × edição, salvar, voltar ao padrão) em
  `tests/modulos/`.
- SQL em PGlite (`tests/apoio/banco-dos-robos.ts`, modelo `catalogo-dos-robos-no-banco.test.ts`):
  a validação recusa visão fora de `painel`, de outro grão, sem comentário, coluna de tipo
  incompatível e nomes com aspas/ponto-e-vírgula; a leitura troca só a coluna escolhida e só na
  área escolhida.
- Ensaio de cada migration; verificação só de leitura contra o banco (como a de 13/11): a soma
  dos aprovados por vaga continua igual ao total de Aprovados quando a coluna aprovados está no
  padrão.
- Aya (`docs/aya/regras-dos-paineis.md`), nota do módulo, `rpc-contrato.ts`.

## Respostas da revisão (decisões do construtor, marcadas para conferência)

1. **Chave repetida na hora da leitura.** As visões sobre histórico (retratos, Triagem) podem
   passar a repetir chave depois da migration. A RPC **nunca multiplica linhas**: junta a fonte
   já agrupada por chave; onde a chave vier repetida, a célula fica **vazia** (não escolhe uma
   linha ao acaso) e a resposta avisa quantas chaves vieram repetidas, para a tela mostrar.
   _(decisão do construtor)_
2. **Código da vaga.** A junção é pelo valor cru: `CO_VAGA` da visão = o código da vaga da linha
   do relatório 2 (o `CO_VAGA` da Seleção, que na Saúde Indígena é só dígitos). Quem normaliza é
   a visão, que deve entregar o código no formato da Seleção. Linha sem código fica vazia (seção
   1). _(decisão do construtor)_
3. **Área.** Já respondido pelo projeto: a página sempre mostra **uma** área, a escolhida no menu
   (o seletor de área troca entre as do usuário); as RPCs já recebem `p_area`. A gaveta edita essa
   área.
4. **Totais entre relatórios.** A tela não soma nem totaliza colunas (só "Mostrando N"). Com uma
   coluna fora do padrão, os totais entre relatórios podem deixar de fechar por desenho: o
   marcador no cabeçalho e a gaveta dizem isso ("fonte diferente do padrão"). _(decisão do
   construtor)_
5. **O padrão de cada coluna.** O texto do padrão ("Padrão: título da vaga", "Padrão: 1ª etapa do
   cronograma") vem do banco, em `FC_COLUNAS_EDITAVEIS_DO_PAINEL` (código, rótulo, tipo, texto do
   padrão), e volta em `fontes`. Fonte escolhida que traz nulo mostra **vazio**, não 0 (inclusive
   em vaga de Cadastro Reserva). _(decisão do construtor)_
6. **Quem edita e quem aparece no histórico.** O nível em `paineis_dados` é da matriz de acessos
   (global, por grupo ou pessoa); a área é o acesso à área (`FC_PODE_AREA`): salvar exige
   Administrador **e** acesso à área. `CO_USUARIO_ATUALIZACAO` é `auth.uid()`, como em `TB_ABA`; o
   histórico mostra o nome, juntando com `TB_PERFIL_USUARIO`. Já respondido pelo projeto / decisão
   do construtor.
7. **Schemas e grants.** `private` já existe (com `USAGE` para `authenticated`, sem exposição na
   API). O schema novo `painel` **não recebe grant nenhum** para `anon` nem `authenticated`
   (`revoke all on schema painel from public, anon, authenticated`): só as RPCs `SECURITY DEFINER`
   o leem. O ensaio confere `has_schema_privilege('authenticated', 'painel', 'USAGE') = false`.
   _(decisão do construtor)_
8. **Histórico e rollback.** `listar_fontes_do_painel` traz as 20 trocas mais recentes da área e do
   relatório. O rollback, em ordem: volta as três RPCs dos relatórios ao corpo de antes
   (`pg_get_functiondef` copiado antes de aplicar), apaga as RPCs de fontes, as tabelas de
   configuração e histórico, as visões e o schema `painel`. _(decisão do construtor)_

## Deixado para o construtor

- O SQL exato de cada visão do catálogo inicial e os rótulos.
- Como a RPC monta o SQL dinâmico (ex.: a consulta do padrão como base e as junções em volta,
  executadas com `EXECUTE format(...) USING`), desde que os nomes venham só do catálogo.
- O desenho fino da gaveta, dentro de `src/ui/`.
