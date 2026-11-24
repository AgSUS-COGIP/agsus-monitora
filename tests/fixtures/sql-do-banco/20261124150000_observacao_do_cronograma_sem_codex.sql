/*
  OBSERVAÇÃO DAS ETAPAS DO CRONOGRAMA SEM "CODEX" (24/11/2026)

  POR QUE
  Na conferência dos cronogramas de 17/11/2026, as observações das etapas
  foram gravadas com "Conferido por Codex, a pedido de <pessoa>, em
  17/11/2026. Fonte: …". O texto aparece para todos na página do edital
  (aba Etapas) e não pode citar a ferramenta usada nem quem pediu. Eram 506
  etapas de 33 editais (leitura de 24/11/2026).

  O QUE MUDA
    Só o começo da observação (TB_CRONOGRAMA_MONIT_INDIG.observacao):
      "Conferido por Codex, a pedido de <pessoa>, em 17/11/2026. Fonte: …"
      vira "Conferido em 17/11/2026. Fonte: …"
    (também a variante sem vírgulas). A data da conferência, a fonte e as
    datas publicadas ficam. Datas, ordem, atividade e quem atualizou não
    mudam; o status dos editais também não (sai das datas).
    Antes de trocar, a observação de cada etapa é copiada para
    arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES" (fora da Data API), para o
    rollback devolver o texto exato.
    Os históricos de auditoria (TH_*) não mudam: eles registram o que
    aconteceu.

  TRAVA: no fim, nenhuma observação do cronograma pode citar "Codex"; se
  sobrar alguma (um formato que a troca não cobre), nada é gravado.

  IDEMPOTENTE: rodar de novo não muda nada (não sobra o que trocar; a cópia
  não é sobrescrita).
  DESFAZER: supabase/rollback/20261124150000_observacao_do_cronograma_sem_codex.sql.
  ENSAIO:   supabase/ensaios/20261124150000_observacao_do_cronograma_sem_codex.sql.
*/
begin;

set local lock_timeout = '5s';

create table if not exists arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES" (
  "CO_ETAPA" uuid not null,
  "DS_OBSERVACAO" text not null,
  "DT_COPIA" timestamp with time zone not null default now(),
  constraint "PK_OBSERVACAO_CRONOGRAMA_ANTES" primary key ("CO_ETAPA")
);

comment on table arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES" is
  'Observações das etapas do cronograma antes de tirar "Codex" do texto (migration 20261124150000). Só para o rollback; fora da Data API.';
comment on column arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES"."CO_ETAPA" is
  'A etapa (TB_CRONOGRAMA_MONIT_INDIG.id).';
comment on column arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES"."DS_OBSERVACAO" is
  'A observação como estava antes da troca.';
comment on column arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES"."DT_COPIA" is
  'Quando a cópia foi feita.';

revoke all on table arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES" from public;

-- A cópia do texto de antes (a primeira vale: rodar de novo não a sobrescreve).
insert into arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES" ("CO_ETAPA", "DS_OBSERVACAO")
select c.id, c.observacao
  from public."TB_CRONOGRAMA_MONIT_INDIG" c
 where c.observacao ilike '%codex%'
on conflict ("CO_ETAPA") do nothing;

-- "Conferido por Codex[,] a pedido de <pessoa>[,] em dd/mm/aaaa" -> "Conferido em dd/mm/aaaa".
-- O nome não atravessa vírgula, ponto nem dígito: a troca nunca chega à "Fonte".
update public."TB_CRONOGRAMA_MONIT_INDIG" c
   set observacao = regexp_replace(
         c.observacao,
         '^Conferido por Codex,? a pedido de [^,.0-9]+,? em ([0-9]{2}/[0-9]{2}/[0-9]{4})',
         'Conferido em \1'
       )
 where c.observacao ilike '%codex%';

do $$
declare
  v_restam integer;
begin
  select count(*) into v_restam
    from public."TB_CRONOGRAMA_MONIT_INDIG"
   where observacao ilike '%codex%';
  if v_restam > 0 then
    raise exception 'Ainda há % observação(ões) do cronograma com "Codex" num formato que a troca não cobre; nada foi gravado.', v_restam;
  end if;
end;
$$;

commit;
