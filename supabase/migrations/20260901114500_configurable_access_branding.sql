begin;

insert into public.configuracoes (chave, valor, descricao)
values
  (
    'auth_access_background_url',
    '/assets/access-background-default.svg',
    'Arte institucional da tela de acesso'
  ),
  ('auth_access_logo_url', '/assets/agsus-logo.webp', 'Logo da AgSUS na tela de acesso'),
  ('auth_access_panel_color', '#c296eb', 'Cor do painel da tela de acesso'),
  ('auth_access_greeting', 'Seja bem-vindo(a) à AgSUS', 'Saudação da tela de acesso'),
  ('auth_access_instruction', 'Acesse com sua conta institucional.', 'Instrução da tela de acesso')
on conflict (chave) do nothing;

commit;
