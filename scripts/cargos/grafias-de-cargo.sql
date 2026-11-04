-- Grafias de cargo em texto livre no MONITORA, com a tabela e a área de cada uma e o número de
-- ocorrências. SÓ LEITURA. Entrada de scripts/cargos/previa_do_casamento.py (tabela de cargos,
-- 20261104150000). TB_MONITORAMENTO_INDIGENA.cargos é a lista "cargo - local | cargo - local";
-- TM_DASHBOARD_MONIT_INDIG.cargos_json, um array de textos. A área do aprovado vem do edital da lista.
with m as (select id, "CO_AREA" area from public."TB_MONITORAMENTO_INDIGENA"),
o as (
  select 'TB_CANDIDATO_APROVADO' tabela, m.area, c.cargo grafia
    from public."TB_CANDIDATO_APROVADO" c
    left join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    left join m on m.id::text = l.edital_id
  union all select 'TB_ENTREVISTA', e."CO_AREA", e."NO_CARGO" from public."TB_ENTREVISTA" e
  union all select 'TB_LOCAL_VAGA_EDITAL', m.area, x."NO_CARGO" from public."TB_LOCAL_VAGA_EDITAL" x left join m on m.id = x."CO_MONITORAMENTO"
  union all select 'TB_QUADRO_VAGA_EDITAL', m.area, x."NO_CARGO" from public."TB_QUADRO_VAGA_EDITAL" x left join m on m.id = x."CO_MONITORAMENTO"
  union all select 'TB_PRE_CLASSIF_VAGA', m.area, x."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" x left join m on m.id = x."CO_MONITORAMENTO"
  union all select 'TB_SELECAO_VAGA', x."CO_AREA", x."NO_CARGO" from public."TB_SELECAO_VAGA" x
  union all select 'TB_VAGA_IMEDIATA', m.area, x."NO_CARGO" from public."TB_VAGA_IMEDIATA" x left join m on m.id::text = x."CO_EDITAL"
  union all select 'TB_RECURSO_CANDIDATO', m.area, x."NO_CARGO_INFORMADO" from public."TB_RECURSO_CANDIDATO" x left join m on m.id = x."CO_MONITORAMENTO"
  union all select 'TB_MONITORAMENTO_INDIGENA', t."CO_AREA", btrim(p) from public."TB_MONITORAMENTO_INDIGENA" t, unnest(string_to_array(t.cargos, '|')) p
  union all select 'TM_DASHBOARD_MONIT_INDIG', null, c from public."TM_DASHBOARD_MONIT_INDIG" d, jsonb_array_elements_text(case when jsonb_typeof(d.cargos_json) = 'array' then d.cargos_json else '[]'::jsonb end) c
)
select grafia, tabela, coalesce(area, '') area, count(*) ocorrencias
  from o where grafia is not null and btrim(grafia) <> ''
 group by 1, 2, 3 order by 4 desc
;
