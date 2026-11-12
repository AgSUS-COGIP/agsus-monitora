/*
  O ESTILO DO PAINEL DA TELA DE ACESSO (SÓLIDO OU VIDRO)

  Pedido de 12/11/2026: além da cor, o painel da tela de acesso pode ser de
  vidro (translúcido sobre a arte, com desfoque). A escolha é a chave
  `auth_access_painel_estilo` de TB_CONFIGURACAO ("solido" ou "vidro"),
  gravada por salvar_configuracoes_e_paineis_v2 como as outras (aceita
  qualquer chave; nada muda nela).

  O QUE MUDA
    public.obter_branding_acesso_publico() devolve também
    `auth_access_painel_estilo`. A função lê a identidade da tela antes do
    login (anon), com lista de chaves fixa: sem a chave na lista, o visitante
    nunca veria o vidro. Mesma assinatura, mesmo retorno (jsonb), mesmas
    permissões; só a lista cresce. Sem dado de pessoa ou sessão.

  GUARDAS (a migration não aplica nada se falhar)
    O md5 é do corpo sem ``: o corpo vigente foi gravado com quebras de
    linha CRLF (conferido no banco em 12/11/2026), e o retrato e este arquivo
    usam LF. O conteúdo é o mesmo; só a quebra de linha muda o md5.
    - Já aplicada: o corpo vigente é o desta migration (md5 09273be0dc2f3b56b7c7426264afb48c).
    - O corpo vigente não é o que esta migration conhece (md5 aa86cbdf60488563a3c93d6cad3d9a23,
      retrato supabase/esquema-atual.sql de 12/11/2026): alguém o mudou
      depois; junte as mudanças antes de aplicar.

  Dependentes: src/lib/access-branding-publico.ts (lê a chave nova; sem ela,
  o painel fica sólido). Ordem: aplicar antes do merge do front que a usa,
  ou depois — o front sem a chave só não mostra o vidro antes do login.

  Ensaio: supabase/ensaios/20261112180000_vidro_no_painel_de_acesso.sql
  Rollback: supabase/rollback/20261112180000_vidro_no_painel_de_acesso.sql
  Teste: tests/vidro-no-painel-de-acesso.test.ts
*/
begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_md5 text := md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.obter_branding_acesso_publico()')), chr(13), ''));
begin
  if v_md5 = '09273be0dc2f3b56b7c7426264afb48c' then
    raise exception 'A migration 20261112180000 já foi aplicada (obter_branding_acesso_publico já devolve o estilo do painel).';
  end if;
  if v_md5 is distinct from 'aa86cbdf60488563a3c93d6cad3d9a23' then
    raise exception 'obter_branding_acesso_publico mudou depois de 12/11/2026 (md5 %): junte as mudanças antes de aplicar.', v_md5;
  end if;
end;
$guarda$;

create or replace function public.obter_branding_acesso_publico()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
 set statement_timeout to '3s'
as $$
  select coalesce(
    jsonb_object_agg(c.chave, c.valor)
      filter (where c.valor is not null and btrim(c.valor) <> ''),
    '{}'::jsonb
  )
  from public."TB_CONFIGURACAO" as c
  where c.chave in (
    'auth_access_background_url',
    'auth_access_logo_url',
    'auth_access_panel_color',
    'auth_access_greeting',
    'auth_access_instruction',
    'auth_google_button_text',
    'auth_access_texto_modo',
    'auth_access_painel_estilo'
  );
$$;

comment on function public.obter_branding_acesso_publico() is 'Identidade da tela de acesso para visitantes não autenticados. Lista de chaves fixa, sem dado de pessoa ou sessão (desde 20261112180000, também o estilo do painel: sólido ou vidro).';

commit;
