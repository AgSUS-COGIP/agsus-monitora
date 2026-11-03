/*
  CORREÇÃO DE DADOS — modalidade dos aprovados sem aspas (03/11/2026)

  Por quê: a importação da lista de aprovados pelo XLSX gravava a célula
  "Modalidade" como veio da planilha de resultado, com aspas:
  `"Ampla Concorrência"`, `"Ampla concorrência", "Pretos e pardos"`,
  `“PPQ”`, `Ampla Concorrência"`. Em 03/11/2026: 26.838 linhas de
  public."TB_CANDIDATO_APROVADO".modalidade (auditoria só de leitura contou
  26.784 dias antes; as listas novas continuavam chegando com aspas). A mesma
  modalidade aparecia de dois jeitos (`"Ampla Concorrência"` × `Ampla
  Concorrência`), e o que agrupa por modalidade (pendências, classificação da
  lista) separava o que é igual.

  A fonte foi corrigida no mesmo PR: src/lib/aprovados-import.ts
  (limparModalidade) limpa a célula antes de gravar. Esta correção aplica a
  MESMA regra ao que já está gravado:
    1. aspas que fecham e abrem com vírgula, ponto e vírgula ou espaço entre
       elas (`" , "`, `" "`) viram ";";
    2. as aspas que sobram (" “ ”) saem;
    3. separa por ";", tira os espaços das pontas, junta com "; " — o formato
       das modalidades múltiplas sem aspas que já existem
       (`Ampla Concorrência; Pretos e Pardos`).
  Vale para modalidade e modalidade_original (a do resultado publicado, nas
  alterações judiciais; hoje nenhuma com aspas).

  O que faz (uma transação):
    1. confere a conta do setor (administrador global ativo, auth.uid);
    2. separa as linhas com aspas, FORA do edital 114/2026
       (bcecfb08-88ef-4e06-8401-bcad6bf88fd0, congelado; hoje sem lista);
    3. mede ANTES: linhas com aspas (fora e no 114), total, e o md5 das
       modalidades do 114;
    4. grava a modalidade limpa, updated_by = conta do setor, updated_at = now();
       os gatilhos marcam o cache de APROVADOS e a versão da fonte;
    5. mede DEPOIS e reprova (raise exception → nada fica) se: sobrar aspas
       fora do 114; o número de linhas mudar; o 114 mudar; uma linha mudar
       além das separadas; uma modalidade ficar vazia; uma linha alterada não
       estiver assinada pela conta do setor.
  Nada é apagado. Retratos já gravados (TH_PUBLICACAO_APROVADO, pedidos de
  casamento em aberto) ficam como estão: são histórico.

  Assinada pela conta do setor Gestão da Informação de Pessoal
  (a01afddb-f64b-47d9-80e8-476a1ed14e43). Rode no SQL Editor (papel postgres)
  SÓ COM A AUTORIZAÇÃO do usuário. Idempotente: sem linha com aspas, não grava
  nada (as conferências passam com 0). Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261103-modalidade-sem-aspas.sql
  Ensaio (begin … rollback):
    supabase/ensaios/20261103-modalidade-sem-aspas.sql
  Para desfazer: não há volta automática (a forma com aspas não carrega
  informação); o ensaio mostra as contagens antes de aplicar.
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

-- A autoria desta transação: auth.uid() = conta do setor.
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $$
begin
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
  if auth.uid() is distinct from 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid then
    raise exception 'auth.uid() desta transação não é a conta do setor.';
  end if;
end;
$$;

-- A regra de src/lib/aprovados-import.ts (limparModalidade).
create function pg_temp.modalidade_limpa(p text) returns text language sql immutable as $f$
  select case when p is null then null else
    array_to_string(array(
      select btrim(t)
        from unnest(string_to_array(
               regexp_replace(regexp_replace(p, '["“”]\s*[,;]?\s*["“”]', ';', 'g'), '["“”]', '', 'g'),
               ';')) with ordinality u(t, ordem)
       where btrim(t) <> ''
       order by ordem), '; ') end;
$f$;

create temporary table tmp_modalidade on commit drop as
select c.id, c.modalidade, c.modalidade_original,
       pg_temp.modalidade_limpa(c.modalidade) as nova,
       pg_temp.modalidade_limpa(c.modalidade_original) as nova_original
  from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
 where (c.modalidade ~ '["“”]' or c.modalidade_original ~ '["“”]')
   -- Edital 114/2026 congelado: fora.
   and l.edital_id is distinct from 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

create temporary table tmp_contagens (
  momento text not null,
  linhas_total integer,
  com_aspas_fora_114 integer,
  com_aspas_114 integer,
  linhas_114 integer,
  md5_114 text,
  assinadas_pela_conta integer
) on commit drop;

create function pg_temp.contar(p_momento text) returns void language sql as $f$
  insert into tmp_contagens
  select p_momento,
         count(*),
         count(*) filter (where (c.modalidade ~ '["“”]' or c.modalidade_original ~ '["“”]')
                            and l.edital_id is distinct from 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'),
         count(*) filter (where (c.modalidade ~ '["“”]' or c.modalidade_original ~ '["“”]')
                            and l.edital_id = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'),
         count(*) filter (where l.edital_id = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'),
         md5(coalesce(string_agg(c.id::text || '=' || coalesce(c.modalidade, '') || '|' || coalesce(c.modalidade_original, ''), ',' order by c.id)
                        filter (where l.edital_id = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'), '')),
         count(*) filter (where c.id in (select t.id from tmp_modalidade t)
                            and c.updated_by = 'a01afddb-f64b-47d9-80e8-476a1ed14e43')
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id;
$f$;

select pg_temp.contar('antes');

update public."TB_CANDIDATO_APROVADO" c
   set modalidade = t.nova,
       modalidade_original = t.nova_original,
       updated_by = 'a01afddb-f64b-47d9-80e8-476a1ed14e43',
       updated_at = now()
  from tmp_modalidade t
 where c.id = t.id
   and (c.modalidade, c.modalidade_original) is distinct from (t.nova, t.nova_original);

select pg_temp.contar('depois');

do $$
declare
  a tmp_contagens;
  d tmp_contagens;
  v_separadas integer;
begin
  select * into a from tmp_contagens where momento = 'antes';
  select * into d from tmp_contagens where momento = 'depois';
  select count(*) into v_separadas from tmp_modalidade;
  if d.com_aspas_fora_114 <> 0 then
    raise exception 'Sobraram % linhas com aspas fora do 114: nada foi gravado.', d.com_aspas_fora_114;
  end if;
  if d.linhas_total <> a.linhas_total then
    raise exception 'O número de linhas mudou (% → %): nada foi gravado.', a.linhas_total, d.linhas_total;
  end if;
  if (d.linhas_114, d.com_aspas_114, d.md5_114) is distinct from (a.linhas_114, a.com_aspas_114, a.md5_114) then
    raise exception 'O edital 114/2026 mudou: nada foi gravado.';
  end if;
  if exists (select 1 from tmp_modalidade t
              where (t.modalidade is not null and coalesce(t.nova, '') = '')
                 or (t.modalidade_original is not null and coalesce(t.nova_original, '') = '')) then
    raise exception 'Uma modalidade ficaria vazia: nada foi gravado.';
  end if;
  if d.assinadas_pela_conta <> v_separadas then
    raise exception '% de % linhas alteradas assinadas pela conta do setor: nada foi gravado.', d.assinadas_pela_conta, v_separadas;
  end if;
end;
$$;
-- <<< correcao

select c.momento, c.linhas_total, c.com_aspas_fora_114, c.com_aspas_114, c.linhas_114,
       c.assinadas_pela_conta, (select count(*) from tmp_modalidade) as separadas
  from tmp_contagens c
 order by c.momento desc;

commit;
