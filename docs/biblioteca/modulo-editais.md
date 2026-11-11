---
tipo: modulo
area: modulo
atualizado: 2026-11-11
---

# Módulo: Editais (Equipe Núcleo)

Cadastro do edital e do cronograma, com tabela, alertas, formulário e linha do tempo, em React.
Rota `/<área>/editais` (`src/app/telas.tsx`); pasta `src/modulos/editais/`. Dela abre a página
[[modulo-regras-do-edital|Regras do edital]] (`/<área>/editais/<edital>/regras/<etapa>`).

## O que faz

- Cadastro do edital e do cronograma; importa cronograma e quadro de vagas do PDF de anexos.
- **Acompanhamento operacional** no topo da fila: oito indicadores (total, ativos, inativos, em
  andamento, sem cronograma, incompletos, próximos 7 dias, excepcionais); cada um filtra a fila.
- Retificação do cronograma a partir do PDF da errata (`lancar-retificacao.tsx`).
- Responsáveis pelo edital (`responsaveis-do-edital.tsx`, migration `20261104120000`): pessoas do
  sistema em `RL_RESPONSAVEL_EDITAL`; grava sozinho, à parte do "Salvar" do edital (que exige
  motivo para mexer no cronograma). A coluna antiga "responsavel" (USI/CORES) segue intocada.
  Quem pode editar vem do banco (`pode_editar`: gestor da área ou administrador global); banco sem
  as RPCs: o bloco não aparece.
- **Edital crítico** (`critico-do-edital.tsx`, #721, migration `20261110150000`): gestor,
  coordenador ou administrador global marca, altera o motivo ou desmarca, sempre com motivo
  (10 a 500 caracteres) e histórico em `TH_EDITAL_CRITICO`. Grava à parte do "Salvar"; a
  permissão vem do banco (`obter_critico_do_edital` → `pode_marcar`). Conta nos críticos da
  [[modulo-visao-geral]].
- **Validade do processo seletivo** (#57, `src/lib/validade-do-edital.ts`): anos (0 a 10), meses
  (0 a 11) e prorrogado, com o prazo calculado ao lado. O cálculo espelha
  `private."FC_VENCIMENTO_DO_EDITAL"` (data de encerramento + prazo em meses, em dobro se
  prorrogado; dia que não existe no mês de chegada vira o último dia dele; 0 = não vence) e
  "vencido" é o último dia antes de hoje em Brasília, como `FC_INATIVAR_LISTAS_VENCIDAS` (que
  inativa a lista vigente ao salvar e todo dia às 00:05). Ida: `nu_anos_validade`,
  `nu_meses_validade` e `st_prorrogado` no `p_payload` de `salvar_monitoramento_com_cronograma_v2`
  (cada chave só quando tem valor). Volta: `get_monitoramento_cronograma` → `monitoramento`, desde
  a migration `20261111200000`; sem ela, a validade fica "não lida": aviso, campos vazios e só vai o
  que a pessoa preencher (nada gravado é sobrescrito). Valor fora do limite mostra a mensagem no
  campo e o Salvar não envia.
- Abre o modal de listas da Lista de aprovados por `carregarTela("approved")`
  (`openImportModal(id, rótulo)`; ver [[modulo-aprovados]]).

## Arquivos

```
nucleo.tsx                 a tela; Regras do edital entram por lazy() (fora do pacote principal)
estado.ts                  estado fora do React: resumo, filtro do painel, modal aberto e ações
                           (as linhas e o catálogo de unidades vêm de dados-do-monitoramento.ts);
                           trocar de usuário na mesma aba apaga o que era da sessão anterior
resumo.ts                  get_nucleo_cronograma_resumo: uma linha por edital (alerta, nº de
                           etapas); alimenta indicadores e "copiar cronograma" com UMA carga, cache
                           curto, invalidada ao salvar um cronograma
painel-operacional.tsx     os indicadores
modal-do-edital.tsx        formulário e payload (de editais-do-nucleo.ts)
editor-de-cronograma.tsx   etapas do cronograma
importar-anexos.tsx        anexos do edital (PDF)
lancar-retificacao.tsx     retificação do cronograma
modal-linha-do-tempo.tsx   linha do tempo do edital
responsaveis-do-edital.tsx responsáveis (acima)
editais.css
```

## Regras puras (`src/lib/`)

- `editais-do-nucleo.ts` — a página sem DOM: ordem da fila (risco, vagas ociosas), tons de status e
  risco (também usados pelo mapa), unidades do formulário (catálogo + as que só existem nos
  editais, USI × CORES), rascunho e payload do edital, índice do resumo e filtro dos indicadores.
- `cronograma-do-edital.ts` — estado calculado pelas datas, validação antes de salvar (erros e
  avisos), modelo padrão, datas coladas em lote e situação na linha do tempo.
- `retificacao-do-cronograma.ts` — retificação em PDF (lida por `api/anexos-do-edital.py`):
  casamento das etapas do "Leia-se" com as gravadas, comparação (igual, data muda, nova, sumiu),
  ajustes, cronograma novo, número da errata e motivo com o SEI.
- `validade-do-edital.ts` — validade do processo seletivo: leitura, validação, payload e prazo.
- `responsavel-do-edital.ts`, `etapas-de-edital.ts`, `editais-das-linhas.ts`,
  `anexos-do-edital.ts`.

## Leitura do PDF (`api/anexos-do-edital.py`)

Função Python da Vercel (pdfplumber): lê o PDF de anexos e devolve cronograma (Anexo I) e quadro
de vagas (Anexo II) em JSON. Só usuário logado; não grava nada. Com `?tipo=retificacao`, lê a
retificação (nº, edital, SEI, assinatura, "Onde se lê" e "Leia-se", linhas em negrito e avisos das
datas). Ver [[funcoes-da-vercel]].

## Guias e histórias

- [Histórias de usuário de Editais](../historias-de-usuario/editais.md) (ED-1, ED-2), citadas em
  `tests/componentes/nucleo.test.ts` e `tests/editais-do-nucleo.test.js`.
- Explicações para quem usa: `docs/aya/regras-dos-editais.md` ([[aya-base-de-conhecimento]]).

## Relacionadas

- [[modulo-regras-do-edital]] — regras de cada etapa, abertas a partir de Editais
- [[modulo-cronograma]] — leitura dos cronogramas; salvar aqui invalida o cache de lá
- [[modulo-aprovados]] — modal de listas do edital
- [[funcoes-da-vercel]] — `anexos-do-edital.py` e a API `/api/editais`
- [[areas-do-sistema]] — o edital pertence a uma área
- [[nova-tela-react]] — como a tela é montada como rota
- [regras-dos-editais](../aya/regras-dos-editais.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
