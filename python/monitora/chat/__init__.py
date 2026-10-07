"""
Chat do MONITORA em Python.

    monitora.chat.expurgo  tira do Storage os arquivos da fila de expurgo dos anexos
                           (TB_EXPURGO_ANEXO_CHAT), em lotes, com a service_role

Quem usa: o job diário scripts/expurgo_anexos_chat/ (GitHub Actions). A tela
Configurações › Mensagens (chat) faz o mesmo em JavaScript
(src/modulos/configuracoes/estado-das-mensagens-do-chat.js) quando um
administrador global a abre.
"""
