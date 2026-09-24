begin;

-- Área de cada painel externo.
--
-- O MONITORA passa a atender Saúde Indígena, SEDE e Projetos, e a barra lateral
-- agrupa os painéis por área (`src/lib/areas-da-navegacao.js`). Todos os painéis
-- que existem hoje são da Saúde Indígena, por isso o default.
--
-- O frontend tolera o banco sem esta coluna: `loadPanels` repete a leitura sem
-- `area` quando recebe 42703 e põe tudo na Saúde Indígena. Aplicar esta
-- migration antes ou depois do deploy dá no mesmo.
--
-- A lista do check é espelhada em `AREAS` de `src/lib/areas-da-navegacao.js`;
-- `tests/areas-da-navegacao.test.js` compara as duas.
--
-- Rollback: `alter table public."TB_PAINEL_EXTERNO" drop column area;`

alter table public."TB_PAINEL_EXTERNO"
  add column if not exists area text not null default 'saude_indigena';

alter table public."TB_PAINEL_EXTERNO"
  drop constraint if exists painel_externo_area_check;

alter table public."TB_PAINEL_EXTERNO"
  add constraint painel_externo_area_check
  check (area in ('saude_indigena', 'sede', 'projetos'));

comment on column public."TB_PAINEL_EXTERNO".area is
  'Área da barra lateral onde o painel aparece: saude_indigena, sede ou projetos.';

commit;
