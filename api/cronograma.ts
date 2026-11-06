/*
  GET /api/cronograma — o Cronograma: as etapas de cada edital ativo (todas as
  áreas), na ordem do edital (formato em
  src/lib/aprovados-e-cronograma-da-api.ts; leitura `listar_cronograma_da_api`,
  migration 20261105150000).

  Acesso: sem login, pela mesma chave fixa de /api/editais
  (`Authorization: Bearer <EDITAIS_API_CHAVE>`; ver api/_rota-com-chave.ts).

  COMO USAR EM OUTRA APLICAÇÃO

  1. A chamada (JavaScript):

       const resposta = await fetch(
         "https://agsus-monitora.vercel.app/api/cronograma?unidade=yanomami",
         { headers: { Authorization: `Bearer ${CHAVE_DA_API}` } },
       );
       const { etapas, totais } = await resposta.json();

     Pela linha de comando:

       curl -H "Authorization: Bearer <chave>" \
         "https://agsus-monitora.vercel.app/api/cronograma?edital_id=<id>"

  2. Filtros opcionais:
       ?edital_id=  ?area=                      igual (sem caixa nem acento)
       ?edital=  ?unidade=  ?atividade=         contém o trecho
     `edital_id` é o "id" de /api/editais.
     "area" é a área do edital: "Saúde Indígena", "SEDE" ou "Projetos".
     ?area= aceita o nome ou o código (saude-indigena, sede, projetos).

  3. A resposta (200, JSON):

       {
         "etapas": [
           { "edital_id": "6f1c…", "edital": "001/2026",
             "unidade": "DSEI Yanomami", "area": "Saúde Indígena", "ordem": 1,
             "atividade": "Publicação do edital",
             "data_inicio": "2026-03-02", "data_fim": "2026-03-02" }
         ],
         "totais": { "linhas": 1 }
       }

     Datas em AAAA-MM-DD (null quando vazias).

  4. Erros (JSON { "erro": "<código>" }):
       401 chave_invalida       sem Bearer, ou chave diferente da combinada
       405 metodo_nao_permitido só GET
       500 configuracao_ausente faltam as variáveis na Vercel
       502 falha_na_leitura     o banco não respondeu; tente de novo
*/

import {
  RPC_DO_CRONOGRAMA,
  respostaDoCronograma,
} from "../src/lib/aprovados-e-cronograma-da-api.js";
import { criarRotaComChave } from "./_rota-com-chave.js";

export default criarRotaComChave({
  rpc: RPC_DO_CRONOGRAMA,
  montar: respostaDoCronograma,
});
