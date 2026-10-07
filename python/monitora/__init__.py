"""
Base Python comum do MONITORA (guia: docs/python-no-monitora.md).

    monitora.config        leitura de variáveis de ambiente com erro claro
    monitora.mascaramento  tira e-mail, CPF, telefone, token e segredo do texto
    monitora.registro      logging que passa tudo pelo mascaramento
    monitora.supabase_rpc  chamadas às RPCs com a service_role (jobs)
    monitora.execucao      disparo, identificador e resumo da execução no Actions

Só biblioteca padrão: o pacote não pesa nas funções da Vercel nem nos jobs.
Quem importa: scripts/robo-empregare/, scripts/conferencias/,
scripts/pre_classificacao/, scripts/expurgo_anexos_chat/ e as funções
api/*.py que precisarem (sys.path + "includeFiles" no vercel.json).
"""
