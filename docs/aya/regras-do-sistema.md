# Regras do sistema

O que vale em todas as telas: Pessoas online, atualização do sistema e busca global. Fontes:
`src/lib/sessao/online-presence.ts`, `src/app/presenca.ts`,
`supabase/migrations/20261005151618_presenca_para_gestor.sql` (admin global e Gestor ativos),
`supabase/migrations/20261005200000_foto_do_google_no_perfil.sql` (foto do perfil),
`src/app/navegacao.ts` (`navigate`), `src/componentes/pessoas-online/`,
`src/modules/pwa-lifecycle.ts`, `sw.js`, `src/app/aviso-de-versao.ts`, `src/lib/navegacao/busca-global.ts` e
`src/componentes/busca-global/busca-global.tsx`.

## Pessoas online

**perguntas:** o que mostra pessoas online | pessoas online | quem esta online | presenca online
**resposta:** Pessoas online fica no menu da conta (clique no seu nome, no alto à direita) e só o administrador global e o Gestor veem. Mostra quem está com o Yeendé aberto: nome, foto ou iniciais, grupo e onde a pessoa está, como "Análises curriculares · Saúde Indígena" ou "Configurações › Acessos" (painel externo aparece como "Painel externo"). A presença de cada pessoa é avisada a cada 2 minutos e meio com a aba visível (e na hora de trocar de página, área ou seção); quem fecha ou esconde a aba sai da lista em até 6 minutos. A contagem do botão se atualiza a cada 10 minutos, e a lista aberta, a cada 2 minutos e meio.
**fonte:** src/lib/sessao/online-presence.ts; src/app/presenca.ts; src/componentes/pessoas-online/pessoas-online.tsx; src/lib/acessos/access-roles.ts (podeVerPessoasOnline)

## Atualização do sistema

**perguntas:** como funciona a atualizacao do sistema | atualizacao do sistema | versao nova do sistema | o sistema recarregou sozinho | nova versao | ha uma versao nova | o yeende foi atualizado | atualizar agora | atualize para continuar
**resposta:** Quando sai uma versão nova do Yeendé, aparece no canto de baixo da página (no celular, embaixo, na largura da tela) o cartão "O Yeendé foi atualizado", com "Agora não" e "Atualizar". "Agora não" fecha o cartão, que só volta numa versão mais nova. "Atualizar" vira "Atualizando…" e recarrega a página uma vez, já com a versão nova. Se a versão trouxe uma mudança que importa, o cartão diz o que é, como "Novo: motivo padronizado na reabertura". O sistema confere a versão a cada 5 minutos com a aba aberta e ao voltar para ela, sem consultar o banco. Nada recarrega à força: com rascunho ou alteração não salva, "Atualizar" pede para salvar antes. Se uma ação falhar porque a tela é de uma versão anterior, o cartão fica amarelo, pede "Atualize para continuar" e não tem "Agora não". Só uma tela que não consegue abrir por ser da versão antiga recarrega sozinha, uma vez.
**fonte:** src/app/aviso-de-versao.ts; src/componentes/aviso-de-versao/aviso-de-versao.tsx; src/lib/base/versao-do-sistema.ts; src/lib/base/novidades.ts; src/lib/carga/importar-com-recarga.ts; src/modules/pwa-lifecycle.ts; src/app/navegacao.ts (navigate)

## Sem internet

**perguntas:** funciona sem internet | sem internet | sem conexao | offline | modo offline | abrir sem rede | instalar o yeende | usar no campo | dados de | copia no aparelho | dados guardados no celular
**resposta:** Depois de aberto uma vez com internet, o Yeendé guarda no aparelho o necessário para abrir todas as telas, mesmo as que você ainda não abriu. Sem conexão, aparece o aviso "Sem conexão com a internet" e você continua trocando de tela, recarregando a página e até abrindo o Yeendé de novo: até 48 horas depois da última entrada com internet, ele entra com o seu perfil guardado no aparelho e confere as suas permissões no banco quando a conexão volta (se o acesso tiver sido retirado, o Yeendé fecha e apaga o que guardou). Os dados vêm do banco: sem internet, Análises, Seleção, Entrevistas (o painel, a fila do dia e a ficha) e a Lista de aprovados mostram o que o aparelho guardou da última vez que foram abertas com internet, com a data no alto, como "Dados de 17/11, 10:14"; dá para consultar, não para gravar. Essas cópias ficam só no aparelho, sem CPF nem contatos, valem 48 horas e saem ao Sair, ao perder o acesso ou quando outra pessoa entra no navegador. Mapas de terras e DSEIs precisam de internet. Quando a conexão volta, aparece "Conexão restabelecida". O Yeendé se instala pelo navegador, no celular e no computador; não há aplicativo de loja.
**fonte:** sw.js; sw-policy.js; src/lib/carga/cache-do-service-worker.ts; src/app/casca/aviso-de-conexao.tsx; src/lib/carga/cache-de-payload.ts; src/lib/sessao/sessao-sem-rede.ts; src/app/sessao.ts; src/app/copias-da-conducao.ts

## Busca global

**perguntas:** busca global | ctrl k | como buscar um edital | atalho de busca
**resposta:** Ctrl+K (ou Cmd+K) abre a busca global, com usuário conectado. Ela procura em edital, unidade, etapa, status, UF, risco, ciclo, responsável e observações e mostra até 12 resultados. Escolher um resultado limpa os filtros, filtra a unidade e o edital, abre o painel e destaca a linha na tabela; sem permissão, aparece um aviso. Quem não é administrador global só encontra editais das suas áreas.
**fonte:** src/lib/navegacao/busca-global.ts; src/componentes/busca-global/busca-global.tsx; src/lib/editais/responsavel-do-edital.ts

## Foto do perfil

**perguntas:** foto do perfil | minha foto nao aparece | foto do google | trocar minha foto | avatar | iniciais no lugar da foto
**resposta:** A foto que aparece para os colegas (em Pessoas online e em Acessos) é a da conta Google com que você entra. O Yeendé a copia para o seu perfil quando o perfil é criado ou ligado à sua conta e, depois, sempre que ela muda (no sinal de presença enviado enquanto o sistema está aberto); só vale endereço https. Não há escolha de foto dentro do Yeendé: para trocar, troque a foto da conta Google. Sem foto no Google, aparecem as iniciais.
**fonte:** supabase/migrations/20261005200000_foto_do_google_no_perfil.sql
