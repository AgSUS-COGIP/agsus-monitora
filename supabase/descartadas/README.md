# `supabase/descartadas/` — migrations que NUNCA devem ser aplicadas

Ficam aqui, e não em `supabase/migrations/`, para que nenhuma ferramenta (Supabase CLI,
`scripts/estado-das-migrations.mjs`, quem procura "o que falta aplicar") as trate como
pendentes. São mantidas só para que a decisão fique rastreável no Git: o que se propôs, por
que foi descartado e quando.

**Não aplicar nenhum arquivo desta pasta**, nem em ambiente de teste. Se um dia a decisão
mudar, o caminho é uma migration nova em `supabase/migrations/`, revisada do zero (nomenclatura
MAD, `search_path = ''`, grants mínimos), e não mover o arquivo de volta. O teste
`tests/migrations-pasta-limpa.test.js` falha se algum destes arquivos voltar para
`supabase/migrations/`.

Movidas em 20/10/2026. Nenhuma está registrada em `public.migracoes_aplicadas` (no registro de
13/10/2026, `supabase/correcoes/20261013-registro-das-migrations.sql`, todas aparecem como
"pendente, de propósito").

| Arquivo                                          | Decisão                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Data       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `20260929190000_acesso_basico_institucional.sql` | Criava `public.garantir_acesso_basico()`: qualquer conta `@agenciasus.org.br` sem perfil ganharia acesso de leitura sozinha. **Decisão do responsável pelo sistema: acesso só por convite.** O front parou de chamar a função em 01/10/2026 (`src/lib/solicitacao-de-acesso.js`, com teste em `tests/solicitacao-de-acesso.test.js`). O registro a marca como "NÃO APLICAR".                                                                                                                    | 01/10/2026 |
| `20260918120000_registro_do_bridge_da_aya.sql`   | Registro do túnel da IA local da Aya (`aya_bridge`, `registrar_bridge_aya` executável por `anon`, `obter_bridge_aya`, `definir_segredo_bridge_aya`). **A IA local foi abandonada em 02/10/2026** (`docs/aya-sem-ia-local.md`): a Aya responde só pela base de conhecimento. Chegou a rodar em 18/09; a padronização renomeou a tabela para `TB_BRIDGE_AYA` e `20261006150000_auditoria_permissoes_e_sobrecarga.sql` removeu as três funções. Reaplicar recriaria uma função com grant a `anon`. | 02/10/2026 |
| `20260922160000_permissoes_por_modulo.sql`       | Primeira versão da permissão por módulo, sobre a tabela antiga `perfis_usuarios`. Nunca chegou ao banco (nenhum dos objetos que cria existe, e nenhuma migration os remove): foi substituída no dia seguinte por `20260923181135_permissoes_modulos_paineis.sql` (`TB_PERMISSAO_RECURSO`) e depois pelos grupos de acesso (`20260929121000_grupos_de_acesso.sql`).                                                                                                                              | 23/09/2026 |

Não havia ensaio (`supabase/ensaios/`) nem rollback (`supabase/rollback/`) destes arquivos.
