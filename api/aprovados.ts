/*
  GET /api/aprovados — a Lista de aprovados: os candidatos da lista VIGENTE de
  cada edital ativo (todas as áreas), sem os removidos (formato em
  src/lib/aprovados-e-cronograma-da-api.ts; leitura `listar_aprovados_da_api`,
  migration 20261105150000).

  Acesso: sem login, pela mesma chave fixa de /api/editais
  (`Authorization: Bearer <EDITAIS_API_CHAVE>`; ver api/_rota-com-chave.ts).
  A resposta tem DADOS PESSOAIS (nome, matrícula): guarde a chave só no
  servidor da outra aplicação e trate os dados conforme a LGPD.

  COMO USAR EM OUTRA APLICAÇÃO

  1. A chamada (JavaScript):

       const resposta = await fetch(
         "https://agsus-monitora.vercel.app/api/aprovados?status=convocado",
         { headers: { Authorization: `Bearer ${CHAVE_DA_API}` } },
       );
       const { aprovados, totais } = await resposta.json();

     Pela linha de comando:

       curl -H "Authorization: Bearer <chave>" \
         "https://agsus-monitora.vercel.app/api/aprovados?edital_id=<id>"

  2. Filtros opcionais:
       ?edital_id=  ?status=  ?modalidade=  ?area=   igual (sem caixa nem acento)
       ?edital=  ?unidade=  ?cargo=  ?nome=          contém o trecho
     `edital_id` é o "id" de /api/editais.
     "area" é a área do edital: "Saúde Indígena", "SEDE" ou "Projetos".
     ?area= aceita o nome ou o código (saude-indigena, sede, projetos).

  3. A resposta (200, JSON):

       {
         "aprovados": [
           { "edital_id": "6f1c…", "edital": "001/2026",
             "unidade": "DSEI Yanomami", "area": "Saúde Indígena",
             "cargo": "Enfermeiro",
             "classificacao": 1, "nota": 87.5, "nome": "Maria da Silva",
             "modalidade": "Ampla concorrência", "status": "Contratado",
             "matricula": "12345", "processo_sei": "25000.000000/2026-00",
             "codigo_vaga": "ENF-01", "sub_judice": false }
         ],
         "totais": { "linhas": 1 }
       }

     classificacao e nota vêm null quando vazias; os textos, "".

  4. Erros (JSON { "erro": "<código>" }):
       401 chave_invalida       sem Bearer, ou chave diferente da combinada
       405 metodo_nao_permitido só GET
       500 configuracao_ausente faltam as variáveis na Vercel
       502 falha_na_leitura     o banco não respondeu; tente de novo
*/

import {
  RPC_DOS_APROVADOS,
  respostaDosAprovados,
} from "../src/lib/aprovados-e-cronograma-da-api.js";
import { criarRotaComChave } from "./_rota-com-chave.js";

export default criarRotaComChave({
  rpc: RPC_DOS_APROVADOS,
  montar: respostaDosAprovados,
});
