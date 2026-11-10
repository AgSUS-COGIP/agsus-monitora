# Auditoria das sedes dos 34 DSEIs — 2026-09-16

## Escopo

Auditoria das 34 sedes carregadas pela chave `lmap` da tabela
`mapa_saude_indigena_config`, confrontadas com a lista oficial de locais de
apresentação dos DSEIs publicada pelo Ministério da Saúde em 2025.

Fonte oficial principal:

- Ministério da Saúde — **DSEI – Locais de Apresentação dos Médicos Selecionados**:
  https://www.gov.br/saude/pt-br/acesso-a-informacao/participacao-social/chamamentos-publicos/2025/chamamento-publico-conjunto-saps-sgtes-ms-no-7-2025-mais-medicos/dsei-locais-de-apresentacao-dos-medicos-selecionados

Fonte adicional usada para validar a divergência encontrada:

- PDSI 2024–2027 — DSEI Interior Sul:
  https://www.gov.br/saude/pt-br/composicao/sesai/planos-distritais-2024-2027/plano-distrital-interior-sul
- CNES 7336764 — DSEI Interior Sul:
  https://cnes2.datasus.gov.br/Mod_Conjunto.asp?VCo_Unidade=4216607336764

## Resultado

Os 34 municípios-sede oficiais foram comparados com as coordenadas atuais do
`lmap`.

- **33 de 34** já apontavam para o município-sede oficial correto.
- **1 de 34** estava em município incorreto: **Interior Sul**.
- O `lmap` continua com **34 DSEIs** após a correção.
- Nenhum outro campo do registro de Interior Sul foi alterado.

### Divergência corrigida

| DSEI | Antes | Fonte oficial | Depois |
| --- | --- | --- | --- |
| Interior Sul | Florianópolis/SC, `-27.5949,-48.5482` | Rua Capitão Pedro Leite, 530, Barreiros, São José/SC | `-27.5741,-48.6094` |

O PDSI identifica explicitamente **São José/SC** como município-sede e o CNES
vigente registra o DSEI no mesmo endereço. A coordenada corrigida corresponde ao
logradouro informado pelas duas fontes.

## Municípios-sede conferidos

| DSEI | Município-sede oficial |
| --- | --- |
| Alagoas e Sergipe | Maceió/AL |
| Altamira | Altamira/PA |
| Alto Rio Juruá | Cruzeiro do Sul/AC |
| Alto Rio Negro | São Gabriel da Cachoeira/AM |
| Alto Rio Purus | Rio Branco/AC |
| Alto Rio Solimões | Tabatinga/AM |
| Amapá e Norte do Pará | Macapá/AP |
| Araguaia | São Félix do Araguaia/MT |
| Bahia | Salvador/BA |
| Ceará | Fortaleza/CE |
| Cuiabá | Cuiabá/MT |
| Guamá-Tocantins | Belém/PA |
| Interior Sul | São José/SC |
| Kaiapó de Mato Grosso | Colíder/MT |
| Kaiapó do Pará | Redenção/PA |
| Leste de Roraima | Boa Vista/RR |
| Litoral Sul | Curitiba/PR |
| Manaus | Manaus/AM |
| Maranhão | São Luís/MA |
| Mato Grosso do Sul | Campo Grande/MS |
| Médio Rio Purus | Lábrea/AM |
| Médio Rio Solimões e Afluentes | Tefé/AM |
| Minas Gerais e Espírito Santo | Governador Valadares/MG |
| Parintins | Parintins/AM |
| Pernambuco | Recife/PE |
| Porto Velho | Porto Velho/RO |
| Potiguara | João Pessoa/PB |
| Rio Tapajós | Itaituba/PA |
| Tocantins | Palmas/TO |
| Vale do Javari | Atalaia do Norte/AM |
| Vilhena | Cacoal/RO |
| Xavante | Barra do Garças/MT |
| Xingu | Canarana/MT |
| Yanomami | Boa Vista/RR |

## Salvaguarda e verificação

Antes da alteração foi preservada a cópia
`lmap_backup_20260916_pre_sedes_dsei` no próprio banco.

A comparação pós-alteração confirmou que a única diferença entre o `lmap`
atual e esse backup, na coleção `dsei`, é `lat`/`lon` do registro **Interior
Sul**. Todos os demais campos do registro permaneceram iguais.

## Observação sobre precisão

Esta auditoria fecha a correspondência entre **DSEI e município-sede** para os
34 distritos e corrige a divergência objetiva encontrada. Ela não transforma
coordenadas municipais históricas em coordenadas de porta sem uma fonte
rastreável. Quando houver endereço oficial e georreferenciamento confiável, a
posição de cada sede pode ser refinada mantendo a mesma regra: fonte declarada,
backup antes da escrita e alteração mínima do `lmap`.
