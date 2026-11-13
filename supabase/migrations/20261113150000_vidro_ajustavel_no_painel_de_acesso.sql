/*
  A COR E O DESFOQUE DO PAINEL DE VIDRO, AJUSTÁVEIS EM CONFIGURAÇÕES

  Pedido de 13/11/2026: o vidro da tela de acesso mudou quatro vezes no mesmo
  dia (cor a 78%, a 70%, sem cor, sem desfoque), cada uma com código e PR.
  Agora a cor do vidro (0% a 90% da cor do painel) e o desfoque da arte
  (nenhum, leve ou forte) se escolhem em Configurações › Aparência, como o
  estilo do painel. As escolhas são as chaves `auth_access_vidro_cor` e
  `auth_access_vidro_desfoque` de TB_CONFIGURACAO, gravadas por
  salvar_configuracoes_e_paineis_v2 como as outras (aceita qualquer chave;
  nada muda nela).

  O QUE MUDA
    public.obter_branding_acesso_publico() devolve também as duas chaves. A
    função lê a identidade da tela antes do login (anon), com lista de chaves
    fixa: sem elas na lista, o visitante veria o vidro padrão (sem cor e sem
    desfoque) até entrar. Mesma assinatura, mesmo retorno (jsonb), mesmas
    permissões; só a lista cresce. Sem dado de pessoa ou sessão.

  GUARDAS (a migration não aplica nada se falhar)
    md5 do corpo sem chr(13) (o banco guarda corpos com CRLF).
    - Já aplicada: o corpo vigente é o desta migration (md5 cfa755e6a28e40111283afe33a450eb2).
    - O corpo vigente não é o que esta migration conhece (md5 09273be0dc2f3b56b7c7426264afb48c,
      o de 20261112180000, conferido no retrato supabase/esquema-atual.sql
      em 13/11/2026): alguém o mudou depois; junte as mudanças antes.

  Dependentes: src/lib/access-branding-publico.ts (lê as chaves novas). Ordem:
  qualquer uma; o front sem as chaves na leitura pública só mostra o vidro
  padrão antes do login, e a configuração carregada depois do login acerta.

  Ensaio: supabase/ensaios/20261113150000_vidro_ajustavel_no_painel_de_acesso.sql
  Rollback: supabase/rollback/20261113150000_vidro_ajustavel_no_painel_de_acesso.sql
  Teste: tests/vidro-ajustavel-no-painel-de-acesso.test.ts
*/
begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_md5 text := md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.obter_branding_acesso_publico()')), chr(13), ''));
begin
  if v_md5 = 'cfa755e6a28e40111283afe33a450eb2' then
    raise exception 'A migration 20261113150000 já foi aplicada (obter_branding_acesso_publico já devolve a cor e o desfoque do vidro).';
  end if;
  if v_md5 is distinct from '09273be0dc2f3b56b7c7426264afb48c' then
    raise exception 'obter_branding_acesso_publico mudou depois de 13/11/2026 (md5 %): junte as mudanças antes de aplicar.', v_md5;
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
    'auth_access_painel_estilo',
    'auth_access_vidro_cor',
    'auth_access_vidro_desfoque'
  );
$$;

comment on function public.obter_branding_acesso_publico() is 'Identidade da tela de acesso para visitantes não autenticados. Lista de chaves fixa, sem dado de pessoa ou sessão (desde 20261112180000, também o estilo do painel: sólido ou vidro; desde 20261113150000, a cor e o desfoque do vidro).';

commit;
