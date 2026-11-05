/*
  CORREÇÃO DE DADOS — linha "TOTAL" gravada como vaga no quadro (39/2025 e 53/2025) (RASCUNHO de 05/11/2026 — NÃO APLICADO)

  Por quê: auditoria site × MONITORA de 05/11/2026. Nos quadros dos editais 39/2025 (CASAI Brasília)
  e 53/2025 (CASAI São Paulo) há uma linha com NO_CARGO = 'TOTAL' (a última linha do Anexo II, que é a
  soma), gravada como se fosse vaga: o quadro soma 18 e 42, o dobro do edital (9 e 21, iguais ao
  vagas_total). A correção desativa só essa linha (ST_REGISTRO_ATIVO = 'N', como a tela faz ao
  substituir um quadro) e reprova se a soma depois não for o vagas_total.

  2 linhas mudam (uma por edital). As diferenças de cadastro reserva do 39/2025 (Assistente Social,
  Assistente/Auxiliar Administrativo e Técnico de Enfermagem: "01+CR" na retificação, sem CR no
  MONITORA) ficaram fora — só relatadas.

  Assinada pela conta do setor (a01afddb-f64b-47d9-80e8-476a1ed14e43). Rode SÓ COM A AUTORIZAÇÃO do usuário, e o ensaio antes.
  Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261105-quadro-sem-linha-total.sql
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

-- A autoria desta transação: auth.uid() = conta do setor.
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}', true);

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

create function pg_temp.tirar_total(p_id uuid, p_edital text, p_vagas int)
returns void language plpgsql as $f$
declare
  v_n int;
  v_soma int;
begin
  update public."TB_QUADRO_VAGA_EDITAL"
     set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now(), "CO_USUARIO_ATUALIZACAO" = auth.uid()
   where "CO_MONITORAMENTO" = p_id and "ST_REGISTRO_ATIVO" = 'S' and upper(btrim("NO_CARGO")) = 'TOTAL'
     and "QT_VAGA_IMEDIATA" = p_vagas;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Edital %: a linha TOTAL casou % linhas (esperado 1).', p_edital, v_n; end if;
  select coalesce(sum("QT_VAGA_IMEDIATA"), 0) into v_soma
    from public."TB_QUADRO_VAGA_EDITAL" where "CO_MONITORAMENTO" = p_id and "ST_REGISTRO_ATIVO" = 'S';
  if v_soma <> p_vagas or v_soma <> (select vagas_total from public."TB_MONITORAMENTO_INDIGENA" where id = p_id) then
    raise exception 'Edital %: o quadro soma % depois da correção (esperado %).', p_edital, v_soma, p_vagas;
  end if;
end;
$f$;

-- 39/2025 — CASAI Brasília: a linha "TOTAL" do Anexo II foi gravada como vaga (9 vagas a mais)
select pg_temp.tirar_total('06825445-92e6-4931-b0b5-3b183d43c399', '39/2025', 9);

-- 53/2025 — CASAI São Paulo: a linha "TOTAL" do Anexo II foi gravada como vaga (21 vagas a mais)
select pg_temp.tirar_total('83822129-b1a3-412b-81f0-766551872a23', '53/2025', 21);
-- <<< correcao

commit;
