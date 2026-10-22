/*
  ENSAIO de supabase/correcoes/20261002-pendencias-das-coordenadas-dos-projetos.sql — begin … rollback.

  Como rodar: depois de aplicar a migration 20261002190000_coordenadas_mapa_projetos.sql, cole
  este arquivo inteiro no SQL Editor do Supabase (papel postgres) e execute. Ele roda o corpo
  da carga (idêntico ao do arquivo da carga — tests/coordenadas-mapa-projetos-migration.test.js
  confere), confere que todo lugar das vagas tem coordenada ou pendência que diz por que não
  tem, que as coordenadas são as da tabela do IBGE (com tolerância: o jsonb arredonda), que
  cada pendência acha o seu lugar, que os candidatos estão no Brasil e que rodar de novo não
  duplica nada; termina em ROLLBACK: nada fica gravado.

  Resultado esperado: "ok C1" … "ok C4", "ENSAIO OK" e o resumo por motivo e por origem.
  Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.
*/
begin;

-- ═══ CORPO DA CARGA (início) ═══
do $$
begin
  if to_regclass('public."TB_COORDENADA_LOCAL_VAGA"') is null
     or to_regclass('private."TB_PENDENCIA_COORDENADA_LOCAL"') is null then
    raise exception 'Aplique antes supabase/migrations/20261002190000_coordenadas_mapa_projetos.sql.';
  end if;
end;
$$;

-- Sedes municipais do IBGE (as de src/lib/coordenadas-dos-municipios.js).
create temp table tmp_sede_ibge (ibge integer primary key, municipio text not null, uf text not null,
  lat double precision not null, lon double precision not null) on commit drop;
insert into tmp_sede_ibge (ibge, municipio, uf, lat, lon) values
  (1200203, 'Cruzeiro do Sul', 'AC', -7.6276, -72.6756),
  (1200401, 'Rio Branco', 'AC', -9.975, -67.8243),
  (2704302, 'Maceió', 'AL', -9.666, -35.735),
  (1300201, 'Atalaia do Norte', 'AM', -4.3705, -70.1967),
  (1302405, 'Lábrea', 'AM', -7.2641, -64.7948),
  (1302603, 'Manaus', 'AM', -3.1187, -60.0212),
  (1303403, 'Parintins', 'AM', -2.6374, -56.729),
  (1303809, 'São Gabriel da Cachoeira', 'AM', -0.1191, -67.084),
  (1304062, 'Tabatinga', 'AM', -4.2416, -69.9383),
  (1304203, 'Tefé', 'AM', -3.3682, -64.7193),
  (1600303, 'Macapá', 'AP', 0.0349, -51.0694),
  (2927408, 'Salvador', 'BA', -12.9718, -38.5011),
  (2304400, 'Fortaleza', 'CE', -3.7166, -38.5423),
  (5300108, 'Brasília', 'DF', -15.7795, -47.9297),
  (5221601, 'Uruaçu', 'GO', -14.5238, -49.1396),
  (2111300, 'São Luís', 'MA', -2.5387, -44.2825),
  (3127701, 'Governador Valadares', 'MG', -18.8545, -41.9555),
  (3170057, 'Ubaporanga', 'MG', -19.6351, -42.1059),
  (5002704, 'Campo Grande', 'MS', -20.4486, -54.6295),
  (5101803, 'Barra do Garças', 'MT', -15.8804, -52.264),
  (5102702, 'Canarana', 'MT', -13.5515, -52.2705),
  (5103205, 'Colíder', 'MT', -10.8135, -55.461),
  (5103403, 'Cuiabá', 'MT', -15.601, -56.0974),
  (5107859, 'São Félix do Araguaia', 'MT', -11.615, -50.6706),
  (1500602, 'Altamira', 'PA', -3.2041, -52.21),
  (1501402, 'Belém', 'PA', -1.4554, -48.4898),
  (1503606, 'Itaituba', 'PA', -4.2667, -55.9926),
  (1505031, 'Novo Progresso', 'PA', -7.1435, -55.3786),
  (1506138, 'Redenção', 'PA', -8.0253, -50.0317),
  (2507507, 'João Pessoa', 'PB', -7.1151, -34.8641),
  (2611606, 'Recife', 'PE', -8.0467, -34.8771),
  (4106902, 'Curitiba', 'PR', -25.4195, -49.2646),
  (4110706, 'Irati', 'PR', -25.4697, -50.6493),
  (3302254, 'Itatiaia', 'RJ', -22.4897, -44.5675),
  (3305554, 'Seropédica', 'RJ', -22.7526, -43.7155),
  (1100049, 'Cacoal', 'RO', -11.4343, -61.4562),
  (1100205, 'Porto Velho', 'RO', -8.7608, -63.8999),
  (1400100, 'Boa Vista', 'RR', 2.8238, -60.6753),
  (1400456, 'Pacaraima', 'RR', 4.4799, -61.1477),
  (4205407, 'Florianópolis', 'SC', -27.5945, -48.5477),
  (4211900, 'Palhoça', 'SC', -27.6455, -48.6697),
  (3513504, 'Cubatão', 'SP', -23.8911, -46.424),
  (3538006, 'Pindamonhangaba', 'SP', -22.9246, -45.4613),
  (3550308, 'São Paulo', 'SP', -23.5329, -46.6395),
  (1721000, 'Palmas', 'TO', -10.24, -48.3558),
  (1720978, 'Talismã', 'TO', -12.7949, -49.0896);

-- Centro de cada UF (média das sedes municipais).
create temp table tmp_centro_uf (uf text primary key, nome text not null,
  lat double precision not null, lon double precision not null) on commit drop;
insert into tmp_centro_uf (uf, nome, lat, lon) values
  ('AC', 'Acre', -9.4017, -69.7098),
  ('AL', 'Alagoas', -9.5154, -36.4828),
  ('AM', 'Amazonas', -3.9313, -63.2203),
  ('AP', 'Amapá', 0.9128, -51.3585),
  ('BA', 'Bahia', -12.911, -40.4106),
  ('CE', 'Ceará', -4.9409, -39.4942),
  ('DF', 'Distrito Federal', -15.7795, -47.9297),
  ('ES', 'Espírito Santo', -19.8864, -40.8154),
  ('GO', 'Goiás', -16.1978, -49.4475),
  ('MA', 'Maranhão', -4.2359, -44.9113),
  ('MG', 'Minas Gerais', -19.5842, -44.102),
  ('MS', 'Mato Grosso do Sul', -21.2376, -54.4798),
  ('MT', 'Mato Grosso', -13.6058, -55.5486),
  ('PA', 'Pará', -2.9668, -49.7614),
  ('PB', 'Paraíba', -7.0593, -36.6429),
  ('PE', 'Pernambuco', -8.2183, -36.6585),
  ('PI', 'Piauí', -6.7032, -42.4093),
  ('PR', 'Paraná', -24.3961, -51.878),
  ('RJ', 'Rio de Janeiro', -22.2889, -42.8243),
  ('RN', 'Rio Grande do Norte', -5.9785, -36.6061),
  ('RO', 'Rondônia', -11.1715, -62.321),
  ('RR', 'Roraima', 2.5756, -60.5275),
  ('RS', 'Rio Grande do Sul', -28.9607, -52.6113),
  ('SC', 'Santa Catarina', -27.2638, -50.7068),
  ('SE', 'Sergipe', -10.6177, -37.275),
  ('SP', 'São Paulo', -22.1385, -48.6441),
  ('TO', 'Tocantins', -9.2729, -48.1896);

-- Os lugares de hoje, com a sede achada pelo código, pelo nome/UF ou só em outra UF.
create temp table tmp_lugar on commit drop as
select f.lugar, f.ibge, f.municipio, f.uf, f.so_uf, f.ibges, f.lotacoes,
       por_codigo.ibge as codigo_sede, por_codigo.municipio as nome_sede_codigo,
       coalesce(por_codigo.ibge, por_nome.ibge) as ibge_resolvido,
       coalesce(por_codigo.lat, por_nome.lat) as sede_lat,
       coalesce(por_codigo.lon, por_nome.lon) as sede_lon,
       coalesce(por_codigo.municipio, por_nome.municipio) as sede_nome,
       (select jsonb_agg(jsonb_build_object('f', 'MUNICIPIO', 'n', o.municipio || '/' || o.uf, 'lat', o.lat, 'lon', o.lon))
          from tmp_sede_ibge o
         where not f.so_uf and o.uf <> f.uf
           and private."FC_TEXTO_BUSCA_RECURSO"(o.municipio) = split_part(f.lugar, '/', 1)) as outra_uf,
       centro.nome as uf_nome, centro.lat as centro_lat, centro.lon as centro_lon
  from private."FC_LUGARES_VAGA_PROJETO"() f
  left join tmp_sede_ibge por_codigo on por_codigo.ibge = f.ibge
  left join tmp_sede_ibge por_nome
    on por_nome.uf = f.uf and private."FC_TEXTO_BUSCA_RECURSO"(por_nome.municipio) || '/' || por_nome.uf = f.lugar
  left join tmp_centro_uf centro on centro.uf = f.uf;

-- 1. Coordenadas que faltam (nunca sobrescreve).
insert into public."TB_COORDENADA_LOCAL_VAGA"
  ("DS_CHAVE_LUGAR", "CO_MUNICIPIO_IBGE", "NO_MUNICIPIO", "SG_UF", "CG_LATITUDE", "CG_LONGITUDE", "TP_ORIGEM")
select l.lugar,
       case when l.so_uf then null else l.ibge_resolvido end,
       case when l.so_uf then null else coalesce(l.sede_nome, l.municipio) end,
       l.uf,
       case when l.so_uf then l.centro_lat else l.sede_lat end,
       case when l.so_uf then l.centro_lon else l.sede_lon end,
       case when l.so_uf then 'CENTRO_UF' else 'SEDE_IBGE' end
  from tmp_lugar l
 where (l.so_uf and l.centro_lat is not null) or (not l.so_uf and l.sede_lat is not null)
on conflict on constraint "UK_COORDLOCAL_LUGAR" do nothing;

-- A coordenada de cada lugar agora (a da carga ou a do editor).
create temp table tmp_coordenada on commit drop as
select l.lugar, c."CG_LATITUDE" as lat, c."CG_LONGITUDE" as lon, c."TP_ORIGEM" as origem
  from tmp_lugar l
  left join public."TB_COORDENADA_LOCAL_VAGA" c on c."DS_CHAVE_LUGAR" = l.lugar;

-- O mesmo município (código do IBGE) em mais de um lugar, com coordenadas a mais de 50 m.
create temp table tmp_repetido on commit drop as
select l.lugar, string_agg(o.lugar, ', ' order by o.lugar) as outros
  from tmp_lugar l
  join tmp_coordenada cl on cl.lugar = l.lugar
  join tmp_lugar o on o.ibge_resolvido = l.ibge_resolvido and o.lugar <> l.lugar
  join tmp_coordenada co on co.lugar = o.lugar
 where l.ibge_resolvido is not null
   and cl.lat is not null and co.lat is not null
   and 2 * 6371 * asin(sqrt(power(sin(radians(co.lat - cl.lat) / 2), 2)
         + cos(radians(cl.lat)) * cos(radians(co.lat)) * power(sin(radians(co.lon - cl.lon) / 2), 2))) > 0.05
 group by l.lugar;

-- Sedes dos DSEIs do mapa da Saúde Indígena (lmap), para os escritórios distritais.
create temp table tmp_sede_dsei on commit drop as
select d.value ->> 'n' as nome,
       (d.value ->> 'lat')::double precision as lat,
       (d.value ->> 'lon')::double precision as lon
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" c,
       jsonb_array_elements(coalesce(c.payload -> 'dsei', '[]'::jsonb)) d
 where c.chave = 'lmap'
   and jsonb_typeof(d.value -> 'lat') = 'number' and jsonb_typeof(d.value -> 'lon') = 'number';

-- 2. A pendência de cada lugar (a primeira regra que valer).
create temp table tmp_pendencia on commit drop as
select l.lugar,
       case when l.so_uf then coalesce(l.uf_nome, l.uf)
            else coalesce(l.sede_nome, l.municipio) || '/' || l.uf end as nome,
       case when l.so_uf then null else l.ibge_resolvido end as ibge,
       l.uf,
       case
         when not l.so_uf and l.sede_lat is null and l.outra_uf is not null then 'MUNICIPIO_DIVERGE'
         when not l.so_uf and l.codigo_sede is not null
              and private."FC_TEXTO_BUSCA_RECURSO"(l.nome_sede_codigo) <> split_part(l.lugar, '/', 1) then 'MUNICIPIO_DIVERGE'
         when c.lat is null then 'SEM_COORDENADA'
         when c.origem = 'MANUAL' then null
         when not (c.lat between -34.9 and 6.4 and c.lon between -74.2 and -32) then 'FORA_DO_BRASIL'
         when cardinality(l.ibges) > 1 or r.lugar is not null then 'LUGAR_DIVERGE'
         when l.so_uf and exists (select 1 from unnest(l.lotacoes) t where t ~* 'escrit') then 'ESCRITORIO_SO_UF'
         when l.so_uf then 'SO_UF'
         else 'SEDE_MUNICIPAL'
       end as motivo_tipo,
       l.lotacoes, l.ibges, l.outra_uf, l.nome_sede_codigo, r.outros,
       c.lat, c.lon,
       l.so_uf, l.sede_nome, l.sede_lat, l.sede_lon, l.uf_nome, l.centro_lat, l.centro_lon
  from tmp_lugar l
  join tmp_coordenada c on c.lugar = l.lugar
  left join tmp_repetido r on r.lugar = l.lugar;

insert into private."TB_PENDENCIA_COORDENADA_LOCAL"
  ("DS_CHAVE_LUGAR", "NO_LUGAR", "CO_MUNICIPIO_IBGE", "SG_UF", "TP_MOTIVO", "DS_MOTIVO", "DS_CANDIDATO")
select p.lugar, left(p.nome, 160), p.ibge, p.uf, p.motivo_tipo,
       case p.motivo_tipo
         when 'MUNICIPIO_DIVERGE' then
           case when p.outra_uf is not null and p.sede_lat is null
                then 'O município do nome da vaga não existe nesta UF na tabela do IBGE, mas existe em outra UF.'
                else format('O nome do município não bate com o do código do IBGE (%s).', p.nome_sede_codigo) end
         when 'SEM_COORDENADA' then 'Município não encontrado na tabela de sedes do IBGE: o lugar fica sem ponto no mapa.'
         when 'FORA_DO_BRASIL' then 'A coordenada está fora dos limites do Brasil.'
         when 'LUGAR_DIVERGE' then
           case when cardinality(p.ibges) > 1
                then format('O mesmo lugar aparece com códigos do IBGE diferentes (%s).', array_to_string(p.ibges, ', '))
                else format('O mesmo município aparece como outro lugar, com coordenada diferente (%s).', p.outros) end
         when 'ESCRITORIO_SO_UF' then
           format('O edital só diz a UF, mas a lotação é um escritório com endereço (%s); o ponto está no centro do estado.',
                  array_to_string(p.lotacoes, '; '))
         when 'SO_UF' then 'O edital só diz a UF; o ponto está no centro do estado (média das sedes municipais).'
         else format('O ponto é a sede do município (IBGE); o edital diz o município, não o endereço (%s).',
                     array_to_string(p.lotacoes[1:3], '; '))
       end,
       coalesce((
         select jsonb_agg(x.c order by x.ordem, x.c ->> 'n')
           from (
             select 1 as ordem, jsonb_build_object('f', 'MUNICIPIO', 'n', p.sede_nome || '/' || p.uf,
                                                   'lat', p.sede_lat, 'lon', p.sede_lon) as c
              where not p.so_uf and p.sede_lat is not null
             union all
             select 2, o.value from jsonb_array_elements(coalesce(p.outra_uf, '[]'::jsonb)) o
             union all
             select 3, jsonb_build_object('f', 'UF', 'n', p.uf_nome, 'lat', p.centro_lat, 'lon', p.centro_lon)
              where p.so_uf and p.centro_lat is not null
             union all
             select 4, jsonb_build_object('f', 'LUGAR', 'n', coalesce(s.sede_nome, s.municipio) || '/' || s.uf,
                                          'lat', sc.lat, 'lon', sc.lon)
               from tmp_lugar s
               join tmp_coordenada sc on sc.lugar = s.lugar
              where p.so_uf and not s.so_uf and s.uf = p.uf and sc.lat is not null
             union all
             select 5, jsonb_build_object('f', 'DSEI', 'n', 'Sede do DSEI ' || d.nome, 'lat', d.lat, 'lon', d.lon)
               from tmp_sede_dsei d
              where not p.so_uf and p.lat is not null
                and exists (select 1 from unnest(p.lotacoes) t where t ~* 'distrit')
                and 2 * 6371 * asin(sqrt(power(sin(radians(d.lat - p.lat) / 2), 2)
                      + cos(radians(p.lat)) * cos(radians(d.lat)) * power(sin(radians(d.lon - p.lon) / 2), 2))) <= 25
           ) x), '[]'::jsonb)
  from tmp_pendencia p
 where p.motivo_tipo is not null
on conflict on constraint "UK_PENDLOCAL_LUGAR" do update
   set "NO_LUGAR" = excluded."NO_LUGAR",
       "CO_MUNICIPIO_IBGE" = excluded."CO_MUNICIPIO_IBGE",
       "TP_MOTIVO" = excluded."TP_MOTIVO",
       "DS_MOTIVO" = excluded."DS_MOTIVO",
       "DS_CANDIDATO" = excluded."DS_CANDIDATO"
 where private."TB_PENDENCIA_COORDENADA_LOCAL"."ST_CONFERIDO" = 'N';
-- ═══ CORPO DA CARGA (fim) ═══

-- C1. Todo lugar das vagas tem coordenada, ou pendência que explica por que não tem; coordenadas no Brasil.
do $$
declare
  v_sem text;
  v_fora integer;
begin
  select string_agg(l.lugar, ', ') into v_sem
    from tmp_lugar l
   where not exists (select 1 from public."TB_COORDENADA_LOCAL_VAGA" c where c."DS_CHAVE_LUGAR" = l.lugar)
     and not exists (select 1 from private."TB_PENDENCIA_COORDENADA_LOCAL" p
                      where p."DS_CHAVE_LUGAR" = l.lugar and p."TP_MOTIVO" in ('SEM_COORDENADA', 'MUNICIPIO_DIVERGE'));
  if v_sem is not null then raise exception 'FALHOU C1: lugar sem coordenada e sem pendência: %', v_sem; end if;
  select count(*) into v_fora
    from public."TB_COORDENADA_LOCAL_VAGA" c
   where not (c."CG_LATITUDE" between -34.9 and 6.4 and c."CG_LONGITUDE" between -74.2 and -32)
     and not exists (select 1 from private."TB_PENDENCIA_COORDENADA_LOCAL" p
                      where p."DS_CHAVE_LUGAR" = c."DS_CHAVE_LUGAR" and p."TP_MOTIVO" = 'FORA_DO_BRASIL');
  if v_fora > 0 then raise exception 'FALHOU C1: % coordenadas fora do Brasil sem pendência', v_fora; end if;
  raise notice 'ok C1: % lugares; todos com coordenada ou pendência', (select count(*) from tmp_lugar);
end;
$$;

-- C2. As coordenadas da carga são as do IBGE (sede) e as do centro da UF (tolerância de 1e-6 grau).
do $$
declare
  v_ruins text;
begin
  select string_agg(c."DS_CHAVE_LUGAR", ', ') into v_ruins
    from public."TB_COORDENADA_LOCAL_VAGA" c
    left join tmp_sede_ibge s on s.ibge = c."CO_MUNICIPIO_IBGE"
    left join tmp_centro_uf u on u.uf = c."SG_UF"
   where (c."TP_ORIGEM" = 'SEDE_IBGE'
          and (s.ibge is null or abs(c."CG_LATITUDE" - s.lat) > 1e-6 or abs(c."CG_LONGITUDE" - s.lon) > 1e-6))
      or (c."TP_ORIGEM" = 'CENTRO_UF'
          and (c."DS_CHAVE_LUGAR" <> 'uf:' || c."SG_UF"
               or abs(c."CG_LATITUDE" - u.lat) > 1e-6 or abs(c."CG_LONGITUDE" - u.lon) > 1e-6));
  if v_ruins is not null then raise exception 'FALHOU C2: coordenada diferente da referência: %', v_ruins; end if;
  raise notice 'ok C2: % coordenadas iguais às da referência (IBGE / centro da UF)',
    (select count(*) from public."TB_COORDENADA_LOCAL_VAGA" where "TP_ORIGEM" <> 'MANUAL');
end;
$$;

-- C3. Pendências: lugar existente, motivo coerente, candidatos no formato e no Brasil.
do $$
declare
  v_ruins text;
  v_total integer;
  v_candidato_ruim integer;
begin
  select string_agg(p."DS_CHAVE_LUGAR", ', ') into v_ruins
    from private."TB_PENDENCIA_COORDENADA_LOCAL" p
   where not exists (select 1 from tmp_lugar l where l.lugar = p."DS_CHAVE_LUGAR");
  if v_ruins is not null then raise exception 'FALHOU C3: pendência sem lugar nas vagas: %', v_ruins; end if;
  select string_agg(l.lugar, ', ') into v_ruins
    from tmp_lugar l
    join tmp_coordenada c on c.lugar = l.lugar
   where c.origem is distinct from 'MANUAL'
     and not exists (select 1 from private."TB_PENDENCIA_COORDENADA_LOCAL" p where p."DS_CHAVE_LUGAR" = l.lugar);
  if v_ruins is not null then raise exception 'FALHOU C3: lugar da carga sem pendência: %', v_ruins; end if;
  select string_agg(p."DS_CHAVE_LUGAR", ', ') into v_ruins
    from private."TB_PENDENCIA_COORDENADA_LOCAL" p
   where (p."TP_MOTIVO" in ('SO_UF', 'ESCRITORIO_SO_UF') and p."DS_CHAVE_LUGAR" !~ '^uf:')
      or (p."TP_MOTIVO" = 'SEDE_MUNICIPAL' and not exists (
            select 1 from public."TB_COORDENADA_LOCAL_VAGA" c
             where c."DS_CHAVE_LUGAR" = p."DS_CHAVE_LUGAR" and c."TP_ORIGEM" = 'SEDE_IBGE'));
  if v_ruins is not null then raise exception 'FALHOU C3: motivo incoerente com o lugar: %', v_ruins; end if;
  -- A sede sugerida de cada SEDE_MUNICIPAL é a própria posição (o jsonb arredonda: tolerância).
  select string_agg(p."DS_CHAVE_LUGAR", ', ') into v_ruins
    from private."TB_PENDENCIA_COORDENADA_LOCAL" p
    join public."TB_COORDENADA_LOCAL_VAGA" c on c."DS_CHAVE_LUGAR" = p."DS_CHAVE_LUGAR"
   where p."TP_MOTIVO" = 'SEDE_MUNICIPAL'
     and not exists (select 1 from jsonb_array_elements(p."DS_CANDIDATO") x
                      where x.value ->> 'f' = 'MUNICIPIO'
                        and abs((x.value ->> 'lat')::double precision - c."CG_LATITUDE") < 1e-6
                        and abs((x.value ->> 'lon')::double precision - c."CG_LONGITUDE") < 1e-6);
  if v_ruins is not null then raise exception 'FALHOU C3: sede do município não sugerida: %', v_ruins; end if;
  select count(*) filter (where not (x.value ->> 'f' in ('MUNICIPIO', 'UF', 'DSEI', 'LUGAR')
                                     and nullif(x.value ->> 'n', '') is not null
                                     and (x.value ->> 'lat')::double precision between -34.9 and 6.4
                                     and (x.value ->> 'lon')::double precision between -74.2 and -32)),
         count(*)
    into v_candidato_ruim, v_total
    from private."TB_PENDENCIA_COORDENADA_LOCAL" p, jsonb_array_elements(p."DS_CANDIDATO") x;
  if v_candidato_ruim > 0 then raise exception 'FALHOU C3: % candidatos fora do formato ou do Brasil', v_candidato_ruim; end if;
  raise notice 'ok C3: % pendências, % candidatos no formato e no Brasil',
    (select count(*) from private."TB_PENDENCIA_COORDENADA_LOCAL"), v_total;
end;
$$;

-- C4. Rodar de novo não duplica nem sobrescreve.
do $$
declare
  v_linhas integer;
begin
  insert into public."TB_COORDENADA_LOCAL_VAGA"
    ("DS_CHAVE_LUGAR", "CO_MUNICIPIO_IBGE", "NO_MUNICIPIO", "SG_UF", "CG_LATITUDE", "CG_LONGITUDE", "TP_ORIGEM",
     "CO_USUARIO_ATUALIZACAO")
  select c."DS_CHAVE_LUGAR", c."CO_MUNICIPIO_IBGE", c."NO_MUNICIPIO", c."SG_UF", 0, 0, c."TP_ORIGEM",
         c."CO_USUARIO_ATUALIZACAO"
    from tmp_lugar l
    join public."TB_COORDENADA_LOCAL_VAGA" c on c."DS_CHAVE_LUGAR" = l.lugar
  on conflict on constraint "UK_COORDLOCAL_LUGAR" do nothing;
  get diagnostics v_linhas = row_count;
  if v_linhas <> 0 then raise exception 'FALHOU C4: a segunda carga de coordenadas inseriu % linhas', v_linhas; end if;
  insert into private."TB_PENDENCIA_COORDENADA_LOCAL"
    ("DS_CHAVE_LUGAR", "NO_LUGAR", "SG_UF", "TP_MOTIVO", "DS_MOTIVO")
  select p.lugar, p.nome, p.uf, p.motivo_tipo, 'Ensaio: repetida'
    from tmp_pendencia p
   where p.motivo_tipo is not null
  on conflict on constraint "UK_PENDLOCAL_LUGAR" do nothing;
  get diagnostics v_linhas = row_count;
  if v_linhas <> 0 then raise exception 'FALHOU C4: a segunda carga de pendências inseriu % linhas', v_linhas; end if;
  raise notice 'ok C4: segunda carga sem linha nova';
  raise notice 'ENSAIO OK';
end;
$$;

select 'pendencia' as tabela, p."TP_MOTIVO" as tipo, count(*) as linhas,
       sum(jsonb_array_length(p."DS_CANDIDATO")) as candidatos,
       count(*) filter (where jsonb_array_length(p."DS_CANDIDATO") = 0) as sem_candidato
  from private."TB_PENDENCIA_COORDENADA_LOCAL" p
 group by p."TP_MOTIVO"
union all
select 'coordenada', c."TP_ORIGEM", count(*), null, null
  from public."TB_COORDENADA_LOCAL_VAGA" c
 group by c."TP_ORIGEM"
 order by 1, 2;

rollback;
