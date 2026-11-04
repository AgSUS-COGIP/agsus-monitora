/*
  CORREÇÃO DE DADOS — tabela de cargos pela lista atualizada da planilha (04/11/2026)

  Por quê: a planilha "CARGOS SI - SIP" ganhou uma segunda lista (colunas D/E),
  a atualizada. Em relação aos 92 cargos do banco:
    - novo: 76 MEDICO ESPECIALISTA - MFC (o usuário confirmou);
    - nome mudou: 47 ASSISTENTE SOCIAL → ASSISTENTE SOCIAL 30 H; 63 ENFERMEIRO → ENFERMEIRO 40H; 95 TECNICO DE ENFERMAGEM → TECNICO EM ENFERMAGEM 40H;
    - os que não aparecem na lista nova (18, 46, 50, 54 e os sintéticos 9994 a
      9999) CONTINUAM VALENDO, confirmado pelo usuário: nada é desativado.

  O que faz (uma transação):
    1. confere a conta do setor (administrador global ativo, auth.uid), que a
       tabela de cargos existe, que os cargos novos ainda não estão nela e que
       os renomeados ainda têm o nome anterior;
    2. inclui os cargos novos (saude-indigena), criados pela conta do setor;
    3. troca o nome oficial dos renomeados e grava cada nome anterior como
       apelido MANUAL confirmado (3), para "ENFERMEIRO", "ASSISTENTE SOCIAL"
       e "TECNICO DE ENFERMAGEM" continuarem casando em FC_CARGO_DA_GRAFIA;
    4. grava os apelidos automáticos novos de alta confiança dos cargos novos,
       só de grafias que aparecem na Saúde Indígena: 0. Ocorrências
       das grafias que o casamento liga a cada cargo novo, por área:
         76 MEDICO ESPECIALISTA - MFC: projetos 2917, sede 1591
       Só as da Saúde Indígena entram; as de SEDE e Projetos ("Agora Tem
       Especialistas", PPIQ) ficam para a fase 3 (cargos dessas áreas);
    5. reprova (raise exception → nada fica) se algum número não bater ou se
       FC_CARGO_DA_GRAFIA não devolver o código esperado.

  Assinada pela conta do setor Gestão da Informação de Pessoal
  (a01afddb-f64b-47d9-80e8-476a1ed14e43). Rode SÓ COM A AUTORIZAÇÃO do
  usuário. Não é idempotente de propósito: rodar de novo falha no passo 1.
  Ensaio: supabase/ensaios/20261104-cargos-lista-atualizada.sql.
  Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261104-cargos-lista-atualizada.sql
  Para desfazer: os nomes anteriores estão acima; os cargos e apelidos novos
  são os criados pela conta do setor nesta data.
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
  if to_regclass('public."TD_CARGO_APELIDO"') is null
     or to_regprocedure('private."FC_CARGO_DA_GRAFIA"(text, text)') is null then
    raise exception 'Aplique antes a migration 20261104150000_tabela_de_cargos.sql.';
  end if;
end;
$$;

create temporary table tmp_cargo_novo (codigo integer not null, nome text not null, sintetico text not null) on commit drop;
insert into tmp_cargo_novo (codigo, nome, sintetico) values
  (76, 'MEDICO ESPECIALISTA - MFC', 'N');

create temporary table tmp_nome_anterior (codigo integer not null, anterior text not null, atual text not null) on commit drop;
insert into tmp_nome_anterior (codigo, anterior, atual) values
  (47, 'ASSISTENTE SOCIAL', 'ASSISTENTE SOCIAL 30 H'),
  (63, 'ENFERMEIRO', 'ENFERMEIRO 40H'),
  (95, 'TECNICO DE ENFERMAGEM', 'TECNICO EM ENFERMAGEM 40H');

create temporary table tmp_apelido_de_cargo (grafia text not null, codigo integer not null,
  regra text not null, confianca numeric(4, 3) not null) on commit drop;
-- Nenhum apelido automático novo: as grafias dos cargos novos não aparecem na Saúde Indígena.

do $$
declare
  v_n integer;
  v_cargos integer := (select count(*) from public."TD_CARGO");
begin
  if exists (select 1 from public."TD_CARGO" c join tmp_cargo_novo t on t.codigo in (c."CO_CARGO", c."CO_CARGO_SIP")) then
    raise exception 'Algum cargo novo já está em TD_CARGO.';
  end if;
  if (select count(*) from tmp_nome_anterior t join public."TD_CARGO" c
       on c."CO_CARGO" = t.codigo and c."NO_CARGO" = t.anterior and c."CO_AREA" = 'saude-indigena') <> 3 then
    raise exception 'Algum cargo renomeado não tem mais o nome anterior.';
  end if;
  if exists (select 1 from public."TD_CARGO_APELIDO" a
              where a."CO_AREA" = 'saude-indigena'
                and a."DS_GRAFIA_NORMALIZADA" in (select private."FC_NORMALIZAR_GRAFIA_CARGO"(anterior) from tmp_nome_anterior
                                                  union select grafia from tmp_apelido_de_cargo)) then
    raise exception 'Há grafia que já tem apelido.';
  end if;
  if exists (select 1 from tmp_apelido_de_cargo
              where grafia is distinct from private."FC_NORMALIZAR_GRAFIA_CARGO"(grafia)) then
    raise exception 'Há grafia que não está normalizada.';
  end if;

  insert into public."TD_CARGO" ("CO_CARGO", "CO_CARGO_SIP", "NO_CARGO", "CO_AREA", "ST_SINTETICO",
    "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO")
  select t.codigo, t.codigo, t.nome, 'saude-indigena', t.sintetico, auth.uid(), auth.uid() from tmp_cargo_novo t;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Incluiu % cargos (esperado 1).', v_n; end if;

  update public."TD_CARGO" c
     set "NO_CARGO" = t.atual, "CO_USUARIO_ATUALIZACAO" = auth.uid(), "DT_ATUALIZACAO" = now()
    from tmp_nome_anterior t
   where c."CO_CARGO" = t.codigo and c."NO_CARGO" = t.anterior;
  get diagnostics v_n = row_count;
  if v_n <> 3 then raise exception 'Renomeou % cargos (esperado 3).', v_n; end if;

  insert into public."TD_CARGO_APELIDO" ("CO_AREA", "DS_GRAFIA_NORMALIZADA", "CO_CARGO", "TP_ORIGEM",
    "ST_CONFIRMADO", "CO_USUARIO_CONFIRMACAO", "DT_CONFIRMACAO", "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO")
  select 'saude-indigena', private."FC_NORMALIZAR_GRAFIA_CARGO"(t.anterior), t.codigo, 'MANUAL', 'S', auth.uid(), now(),
         auth.uid(), auth.uid()
    from tmp_nome_anterior t;
  get diagnostics v_n = row_count;
  if v_n <> 3 then raise exception 'Gravou % nomes anteriores (esperado 3).', v_n; end if;

  insert into public."TD_CARGO_APELIDO" ("CO_AREA", "DS_GRAFIA_NORMALIZADA", "CO_CARGO", "TP_ORIGEM",
    "TP_REGRA", "VL_CONFIANCA", "ST_CONFIRMADO", "CO_USUARIO_CONFIRMACAO", "DT_CONFIRMACAO",
    "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO")
  select 'saude-indigena', t.grafia, t.codigo, 'AUTOMATICO', t.regra, t.confianca, 'S', auth.uid(), now(),
         auth.uid(), auth.uid()
    from tmp_apelido_de_cargo t;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'Gravou % apelidos automáticos (esperado 0).', v_n; end if;

  if (select count(*) from public."TD_CARGO") <> v_cargos + 1 then
    raise exception 'O número de cargos não bate.';
  end if;
  if exists (select 1 from tmp_cargo_novo t
              where private."FC_CARGO_DA_GRAFIA"(t.nome, 'saude-indigena') is distinct from t.codigo)
     or exists (select 1 from tmp_nome_anterior t
                 where private."FC_CARGO_DA_GRAFIA"(t.anterior, 'saude-indigena') is distinct from t.codigo
                    or private."FC_CARGO_DA_GRAFIA"(t.atual, 'saude-indigena') is distinct from t.codigo)
     or exists (select 1 from tmp_apelido_de_cargo t
                 where private."FC_CARGO_DA_GRAFIA"(t.grafia, 'saude-indigena') is distinct from t.codigo) then
    raise exception 'FC_CARGO_DA_GRAFIA não devolve o código esperado para alguma grafia.';
  end if;
end;
$$;
-- <<< correcao

commit;
