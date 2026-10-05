# Regras do sistema

O que vale em todas as telas: Pessoas online, atualização do sistema e busca global. Fontes:
`src/lib/online-presence.js`, `src/app/presenca.js`,
`supabase/migrations/20261005151618_presenca_para_gestor.sql` (admin global e Gestor ativos),
`src/modules/legacy-app.js` (`navigate`),
`src/modules/pwa-lifecycle.js`, `src/lib/busca-global.js` e
`src/componentes/busca-global/busca-global.jsx`.

## Pessoas online

**perguntas:** o que mostra pessoas online | pessoas online | quem esta online | presenca online
**resposta:** Pessoas online fica no cabeçalho e só o administrador global e o Gestor veem (o chat está em teste com os dois). Mostra quem está com o MONITORA aberto: nome, foto ou iniciais, grupo e onde a pessoa está, como "Análises curriculares · Saúde Indígena" ou "Configurações › Acessos" (painel externo aparece como "Painel externo"). Atualiza a cada 45 segundos com a aba visível, e trocar de página, área ou seção avisa na hora.
**fonte:** src/lib/online-presence.js; src/modules/legacy-app.js

## Atualização do sistema

**perguntas:** como funciona a atualizacao do sistema | atualizacao do sistema | versao nova do sistema | o sistema recarregou sozinho | nova versao
**resposta:** O MONITORA procura versão nova ao voltar para a aba ou reconectar (no máximo a cada 15 minutos), sem aviso na tela. A versão nova fica esperando e só entra na próxima troca de página: depois da pergunta sobre alterações não salvas, a página recarrega e abre a tela que você pediu (com a permissão conferida de novo). Assim ninguém perde o que está digitando, como notas de entrevista ou a resposta de um recurso.
**fonte:** src/modules/pwa-lifecycle.js; src/modules/legacy-app.js (navigate)

## Busca global

**perguntas:** busca global | ctrl k | como buscar um edital | atalho de busca
**resposta:** Ctrl+K (ou Cmd+K) abre a busca global, com usuário conectado. Ela procura em edital, unidade, etapa, status, UF, risco, ciclo, responsável e observações e mostra até 12 resultados. Escolher um resultado limpa os filtros, filtra a unidade e o edital, abre o painel e destaca a linha na tabela; sem permissão, aparece um aviso. Quem não é administrador global só encontra editais das suas áreas.
**fonte:** src/lib/busca-global.js; src/componentes/busca-global/busca-global.jsx; src/lib/responsavel-do-edital.js
