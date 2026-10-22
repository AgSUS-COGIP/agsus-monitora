-- Desfaz 20261014210000: o bloco que não pontua no nível volta a valer (as pendências voltam a pedir a situação dele).
-- FC_BLOCO_SE_APLICA volta à versão de 20261014150000 (com o nao_se_aplica do cargo).
begin;

set local lock_timeout = '10s';

CREATE OR REPLACE FUNCTION private."FC_BLOCO_SE_APLICA"(p_bloco jsonb, p_lancamento jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
           when p_bloco -> 'nao_se_aplica' = 'true'::jsonb then false
           when coalesce(p_bloco ->> 'condicao', case when p_bloco ->> 'tipo' = 'PONTUACAO' then 'INDIGENA' end) is null then true
           when coalesce(p_bloco ->> 'condicao', 'INDIGENA') = 'INDIGENA' then coalesce((p_lancamento ->> 'indigena')::boolean, false)
           else upper(coalesce(p_lancamento ->> 'modalidade', '')) = upper(split_part(p_bloco ->> 'condicao', '=', 2))
         end;
$function$;
comment on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) is
  'O bloco vale para o candidato (condição INDIGENA ou MODALIDADE=…; o critério étnico só para quem se declarou indígena; o bloco marcado nao_se_aplica pela diferença do cargo, FC_BLOCO_DO_CARGO, não vale), como blocoSeAplica (ficha.js).';
revoke all on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) from public, anon, authenticated, service_role;

drop function if exists private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(jsonb, text);

commit;
