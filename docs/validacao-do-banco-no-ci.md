# Validacao do banco no CI

O Quality Gate distingue as verificacoes estaticas, os testes com dados simulados e o contrato RPC contra o catalogo real.

## Pull requests

Os testes de Python, frontend, build, navegador simulado e arquitetura continuam obrigatorios conforme as protecoes configuradas. O job de banco real fica **skipped**, e o resumo informa **NAO EXECUTADO**. Nenhuma credencial de banco e entregue ao codigo de um PR.

## Execucao real

Executar manualmente o workflow `AgSUS Monitora Quality Gate` na branch `main`, depois da revisao do codigo. Configurar `SUPABASE_DB_URL_DEV` diretamente nos segredos do GitHub, com uma conexao exclusivamente de desenvolvimento. Nao enviar a credencial em mensagens, commits ou logs.

A ausencia dessa configuracao faz o job falhar antes da instalacao e da consulta. Nao existe mais `exit 0` para transformar a falta do banco em aprovacao. O resumo so registra sucesso depois de `check:rpc-contract:db` terminar com codigo zero.

Este ajuste nao cria um banco de desenvolvimento e nao substitui ensaios de RLS, Storage, gravacao, rollback ou testes de ponta a ponta. Migrations continuam exigindo ensaio proprio e registro manual. Nunca apontar o segredo de desenvolvimento para producao.
