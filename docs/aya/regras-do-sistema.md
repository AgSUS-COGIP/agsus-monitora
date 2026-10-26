# Regras do sistema

O que vale em todas as telas: Pessoas online, atualização do sistema e busca global. Fontes:
`src/lib/online-presence.js`, `src/app/presenca.js`,
`supabase/migrations/20261005151618_presenca_para_gestor.sql` (admin global e Gestor ativos),
`supabase/migrations/20261005200000_foto_do_google_no_perfil.sql` (foto do perfil),
`src/app/navegacao.js` (`navigate`), `src/componentes/pessoas-online/`,
`src/modules/pwa-lifecycle.js`, `src/app/aviso-de-versao.ts`, `src/lib/busca-global.ts` e
`src/componentes/busca-global/busca-global.tsx`.

## Pessoas online

**perguntas:** o que mostra pessoas online | pessoas online | quem esta online | presenca online
**resposta:** Pessoas online fica no cabeçalho e só o administrador global e o Gestor veem. Mostra quem está com o MONITORA aberto: nome, foto ou iniciais, grupo e onde a pessoa está, como "Análises curriculares · Saúde Indígena" ou "Configurações › Acessos" (painel externo aparece como "Painel externo"). A presença de cada pessoa é avisada a cada 90 segundos com a aba visível (e na hora de trocar de página, área ou seção); a contagem do botão se atualiza a cada 10 minutos, e a lista aberta, a cada 90 segundos.
**fonte:** src/lib/online-presence.js; src/app/presenca.js; src/componentes/pessoas-online/pessoas-online.tsx; src/lib/access-roles.ts (podeVerPessoasOnline)

## Atualização do sistema

**perguntas:** como funciona a atualizacao do sistema | atualizacao do sistema | versao nova do sistema | o sistema recarregou sozinho | nova versao | ha uma versao nova | atualizar agora | atualize para continuar
**resposta:** Quando sai uma versão nova do MONITORA, aparece no topo da página a faixa "Há uma versão nova do MONITORA.", com "Atualizar agora" e o X para fechar (fechada, ela só volta numa versão mais nova). Se a versão trouxe uma mudança que importa, a faixa diz o que é, como "Novo: motivo padronizado na reabertura". O sistema confere a versão a cada 5 minutos com a aba aberta e ao voltar para ela, sem consultar o banco. Nada recarrega à força: com rascunho ou alteração não salva, "Atualizar agora" pede para salvar antes. Se uma ação falhar porque a tela é de uma versão anterior, a faixa fica amarela e pede "Atualize para continuar". Só uma tela que não consegue abrir por ser da versão antiga recarrega sozinha, uma vez.
**fonte:** src/app/aviso-de-versao.ts; src/componentes/aviso-de-versao/aviso-de-versao.tsx; src/lib/versao-do-sistema.ts; src/lib/novidades.ts; src/lib/importar-com-recarga.js; src/modules/pwa-lifecycle.js; src/app/navegacao.js (navigate)

## Busca global

**perguntas:** busca global | ctrl k | como buscar um edital | atalho de busca
**resposta:** Ctrl+K (ou Cmd+K) abre a busca global, com usuário conectado. Ela procura em edital, unidade, etapa, status, UF, risco, ciclo, responsável e observações e mostra até 12 resultados. Escolher um resultado limpa os filtros, filtra a unidade e o edital, abre o painel e destaca a linha na tabela; sem permissão, aparece um aviso. Quem não é administrador global só encontra editais das suas áreas.
**fonte:** src/lib/busca-global.ts; src/componentes/busca-global/busca-global.tsx; src/lib/responsavel-do-edital.js

## Foto do perfil

**perguntas:** foto do perfil | minha foto nao aparece | foto do google | trocar minha foto | avatar | iniciais no lugar da foto
**resposta:** A foto que aparece para os colegas (em Pessoas online e em Acessos) é a da conta Google com que você entra. O MONITORA a copia para o seu perfil quando o perfil é criado ou ligado à sua conta e, depois, sempre que ela muda (no sinal de presença enviado enquanto o sistema está aberto); só vale endereço https. Não há escolha de foto dentro do MONITORA: para trocar, troque a foto da conta Google. Sem foto no Google, aparecem as iniciais.
**fonte:** supabase/migrations/20261005200000_foto_do_google_no_perfil.sql
