/*
  CORREÇÃO DE DADOS — matrículas trocadas no edital 66/2025 (DSEI Kaiapó do Mato Grosso) (04/11/2026)

  Por quê: na conferência MONITORA × folha de 04/11/2026, três linhas da vaga 132583
  (Técnico de Enfermagem — DSEI Kaiapó do Mato Grosso) estavam com matrículas trocadas em cadeia:
    - BENEDITA CAMPOS        estava 292607 → na folha é 292603 (admitida 19/11/2025, desligada 10/02/2026);
    - CLAUDIA DE SOUSA SILVA estava 292618 → na folha é 292607 (admitida 19/11/2025, desligada 09/03/2026);
      (292618 é de outra pessoa na folha, de outro cargo);
    - GIDEAO PEIXOTO MARTINS estava Contratado com 292603 (que é da Benedita) e não está na folha.
      O usuário confirmou em 04/11/2026: não foi contratado → volta a Aprovado (sem status), sem matrícula.
  Ficou fora da correção 20261104-contratados-pela-folha porque corrigir uma linha só deixaria duas
  pessoas com a mesma matrícula.

  O que faz (uma transação): confere a conta do setor; confere que as 3 linhas estão exatamente como
  acima; grava o histórico (TH_CANDIDATO_APROVADO, como alterar_status_candidato_aprovado) e depois as
  linhas; recalcula os contratados do edital; reprova (nada fica) se o resultado não for o esperado ou se
  alguma das matrículas novas for de outra pessoa Contratado/Migração.
  Assinada pela conta do setor (a01afddb-f64b-47d9-80e8-476a1ed14e43). Rode SÓ COM A AUTORIZAÇÃO do
  usuário. Não é idempotente de propósito. Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261104-matriculas-66-2025.sql
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

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

create temporary table tmp_66 (
  id uuid primary key, nome text not null,
  status_antes text, matricula_antes text, status_novo text, matricula_nova text
) on commit drop;

insert into tmp_66 values
  ('dd279d1c-47c0-4c25-be13-3556c7bb3a5c', 'BENEDITA CAMPOS',        'Contratado', '292607', 'Contratado', '292603'),
  ('3546d668-54bc-4968-823a-fb8d4c9267c7', 'CLAUDIA DE SOUSA SILVA', 'Contratado', '292618', 'Contratado', '292607'),
  ('67b9b982-e8d9-41a2-b5e9-107a9b32ea73', 'GIDEAO PEIXOTO MARTINS', 'Contratado', '292603', null,         null);

do $$
declare v_n integer;
begin
  select count(*) into v_n
    from tmp_66 t
    join public."TB_CANDIDATO_APROVADO" c on c.id = t.id
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
   where l.vigente and c.removido_em is null
     and l.edital_id::text = '86d9de1c-58ed-40fb-955f-924211d94838'
     and c.nome = t.nome
     and c.status is not distinct from t.status_antes
     and btrim(c.matricula) = t.matricula_antes;
  if v_n <> 3 then
    raise exception '% de 3 linhas ainda estão como na conferência: nada foi gravado.', v_n;
  end if;
end;
$$;

insert into public."TH_CANDIDATO_APROVADO"(
  candidato_id, lista_id, status_anterior, status_novo, processo_sei, matricula, alterado_por, "DT_CONVOCACAO")
select c.id, c.lista_id, c.status, t.status_novo, c.processo_sei, t.matricula_nova,
       'a01afddb-f64b-47d9-80e8-476a1ed14e43', c."DT_CONVOCACAO"
  from tmp_66 t join public."TB_CANDIDATO_APROVADO" c on c.id = t.id;

update public."TB_CANDIDATO_APROVADO" c
   set status = t.status_novo,
       matricula = t.matricula_nova,
       updated_by = 'a01afddb-f64b-47d9-80e8-476a1ed14e43',
       updated_at = now()
  from tmp_66 t
 where c.id = t.id;

select private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"('86d9de1c-58ed-40fb-955f-924211d94838'::uuid);

do $$
declare v_ok integer;
begin
  select count(*) into v_ok
    from tmp_66 t join public."TB_CANDIDATO_APROVADO" c on c.id = t.id
   where c.status is not distinct from t.status_novo
     and nullif(btrim(c.matricula), '') is not distinct from t.matricula_nova
     and c.updated_by = 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  if v_ok <> 3 then
    raise exception '% de 3 linhas gravadas: nada foi gravado.', v_ok;
  end if;
  if exists (select 1 from tmp_66 t
               join public."TB_CANDIDATO_APROVADO" o on btrim(o.matricula) = t.matricula_nova and o.id <> t.id
                and o.status in ('Contratado', 'Migração') and o.removido_em is null
              where t.matricula_nova is not null) then
    raise exception 'Uma matrícula nova já é de outra pessoa Contratado/Migração: nada foi gravado.';
  end if;
end;
$$;
-- <<< correcao

select t.nome, t.status_antes, t.matricula_antes, t.status_novo, t.matricula_nova from tmp_66 t order by t.nome;

commit;
