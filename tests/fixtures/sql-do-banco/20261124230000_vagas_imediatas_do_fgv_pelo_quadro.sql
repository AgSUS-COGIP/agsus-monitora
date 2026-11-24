/*
  VAGAS IMEDIATAS DO FGV 2025 PELO QUADRO DO EDITAL (24/11/2026)

  POR QUE
  Na configuração da convocação do edital FGV 2025 (SEDE), as 15 vagas estavam com
  10.000 vagas imediatas cada, e o padrão do edital também (TB_VAGA_IMEDIATA e
  TB_CONVOCACAO_EDITAL, gravados direto no banco em 07/10/2026; a tela só aceita de 0 a
  9.999). A Lista de aprovados da SEDE mostrava "Vagas imediatas 150.000" e contava todos
  os aprovados como vaga imediata ("A convocar" inflado). O quadro do edital
  (TB_QUADRO_VAGA_EDITAL) traz as vagas de verdade: 130 no total.

  O QUE MUDA
    TB_VAGA_IMEDIATA do FGV 2025: cada vaga recebe as vagas imediatas da linha do quadro
    do mesmo cargo (Administrativo 45, Saúde Pública 40, Auxiliar de Gestão 24, Advogado 4,
    Contabilidade 3, Psicologia 3, Tecnologia da Informação 3 e as demais 1).
    TB_CONVOCACAO_EDITAL do FGV 2025: o padrão de vagas imediatas volta a 0 (cada vaga tem
    o seu número).
    Antes de trocar, os valores de hoje vão para arquivo."TB_VAGA_IMEDIATA_FGV_ANTES"
    (fora da Data API), para o rollback.
    Nada mais muda: modelo de convocação, quadro do edital, listas e candidatos ficam.

  GUARDA: só aplica se o edital ainda tiver exatamente estas 15 vagas com 10.000 e o padrão
  10.000; senão, nada é gravado (alguém já mudou a configuração pela tela).

  IDEMPOTENTE: rodar de novo, já aplicada, para na guarda sem mudar nada.
  DESFAZER: supabase/rollback/20261124230000_vagas_imediatas_do_fgv_pelo_quadro.sql.
  ENSAIO:   supabase/ensaios/20261124230000_vagas_imediatas_do_fgv_pelo_quadro.sql.
*/
begin;

set local lock_timeout = '5s';

create temporary table tmp_vagas_do_fgv (
  vaga text primary key,
  imediatas integer not null
) on commit drop;

insert into tmp_vagas_do_fgv (vaga, imediatas) values
  ('ANALISTA DE GESTÃO - AGSUS - ADMINISTRATIVO', 45),
  ('ANALISTA DE GESTÃO - AGSUS - ADVOGADO', 4),
  ('ANALISTA DE GESTÃO - AGSUS - ARQUITETO', 1),
  ('ANALISTA DE GESTÃO - AGSUS - COMUNICAÇÃO SOCIAL', 1),
  ('ANALISTA DE GESTÃO - AGSUS - CONTABILIDADE', 3),
  ('ANALISTA DE GESTÃO - AGSUS - DESIGNER GRÁFICO', 1),
  ('ANALISTA DE GESTÃO - AGSUS - ENFERMEIRO DO TRABALHO', 1),
  ('ANALISTA DE GESTÃO - AGSUS - ENGENHARIA CIVIL', 1),
  ('ANALISTA DE GESTÃO - AGSUS - ENGENHARIA DE SEGURANÇA NO TRABALHO', 1),
  ('ANALISTA DE GESTÃO - AGSUS - ENGENHARIA ELÉTRICA', 1),
  ('ANALISTA DE GESTÃO - AGSUS - MEDICINA DO TRABALHO', 1),
  ('ANALISTA DE GESTÃO - AGSUS - PSICOLOGIA', 3),
  ('ANALISTA DE GESTÃO - AGSUS - SAÚDE PÚBLICA', 40),
  ('ANALISTA DE GESTÃO - AGSUS - TECNOLOGIA DA INFORMAÇÃO', 3),
  ('AUXILIAR DE GESTÃO - AGSUS - AUXILIAR DE GESTÃO', 24);

do $$
declare
  v_edital constant text := '65f6f52a-615d-4072-a784-fca9e0f34454';
  v_vagas integer;
  v_com_dez_mil integer;
  v_padrao integer;
begin
  select count(*), count(*) filter (where v."QT_VAGA_IMEDIATA" = 10000)
    into v_vagas, v_com_dez_mil
    from public."TB_VAGA_IMEDIATA" v
   where v."CO_EDITAL" = v_edital;
  select c."QT_PADRAO_IMEDIATA" into v_padrao
    from public."TB_CONVOCACAO_EDITAL" c
   where c."CO_EDITAL" = v_edital;
  if v_vagas <> 15 or v_com_dez_mil <> 15 or v_padrao is distinct from 10000
     or exists (
       select 1 from public."TB_VAGA_IMEDIATA" v
        where v."CO_EDITAL" = v_edital
          and not exists (select 1 from tmp_vagas_do_fgv t where t.vaga = v."CO_VAGA")
     ) then
    raise exception 'A configuração da convocação do FGV 2025 não é a esperada (% vagas, % com 10.000, padrão %): nada foi gravado.',
      v_vagas, v_com_dez_mil, v_padrao;
  end if;
end;
$$;

create table if not exists arquivo."TB_VAGA_IMEDIATA_FGV_ANTES" (
  "CO_EDITAL" text not null,
  "CO_VAGA" text not null,
  "QT_VAGA_IMEDIATA" integer not null,
  "QT_PADRAO_IMEDIATA" integer not null,
  "DT_COPIA" timestamp with time zone not null default now(),
  constraint "PK_VAGA_IMEDIATA_FGV_ANTES" primary key ("CO_EDITAL", "CO_VAGA")
);

comment on table arquivo."TB_VAGA_IMEDIATA_FGV_ANTES" is
  'Vagas imediatas da convocação do FGV 2025 antes de seguir o quadro do edital (migration 20261124230000). Só para o rollback; fora da Data API.';
comment on column arquivo."TB_VAGA_IMEDIATA_FGV_ANTES"."CO_EDITAL" is 'O edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column arquivo."TB_VAGA_IMEDIATA_FGV_ANTES"."CO_VAGA" is 'A vaga (TB_VAGA_IMEDIATA.CO_VAGA).';
comment on column arquivo."TB_VAGA_IMEDIATA_FGV_ANTES"."QT_VAGA_IMEDIATA" is 'As vagas imediatas da vaga antes da troca.';
comment on column arquivo."TB_VAGA_IMEDIATA_FGV_ANTES"."QT_PADRAO_IMEDIATA" is 'O padrão do edital (TB_CONVOCACAO_EDITAL) antes da troca.';
comment on column arquivo."TB_VAGA_IMEDIATA_FGV_ANTES"."DT_COPIA" is 'Quando a cópia foi feita.';

revoke all on table arquivo."TB_VAGA_IMEDIATA_FGV_ANTES" from public;

insert into arquivo."TB_VAGA_IMEDIATA_FGV_ANTES" ("CO_EDITAL", "CO_VAGA", "QT_VAGA_IMEDIATA", "QT_PADRAO_IMEDIATA")
select v."CO_EDITAL", v."CO_VAGA", v."QT_VAGA_IMEDIATA", c."QT_PADRAO_IMEDIATA"
  from public."TB_VAGA_IMEDIATA" v
  join public."TB_CONVOCACAO_EDITAL" c on c."CO_EDITAL" = v."CO_EDITAL"
 where v."CO_EDITAL" = '65f6f52a-615d-4072-a784-fca9e0f34454'
on conflict ("CO_EDITAL", "CO_VAGA") do nothing;

update public."TB_VAGA_IMEDIATA" v
   set "QT_VAGA_IMEDIATA" = t.imediatas,
       "DT_ATUALIZACAO" = now()
  from tmp_vagas_do_fgv t
 where v."CO_EDITAL" = '65f6f52a-615d-4072-a784-fca9e0f34454'
   and v."CO_VAGA" = t.vaga;

update public."TB_CONVOCACAO_EDITAL"
   set "QT_PADRAO_IMEDIATA" = 0,
       "DT_ATUALIZACAO" = now()
 where "CO_EDITAL" = '65f6f52a-615d-4072-a784-fca9e0f34454';

commit;
