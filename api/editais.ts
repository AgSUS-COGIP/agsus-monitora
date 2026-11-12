/*
  GET /api/editais — os editais do monitoramento: unidade, edital, status,
  etapa, vagas, contratados, ociosas, risco, link do edital e área — Saúde
  Indígena, SEDE ou Projetos (formato em
  src/lib/editais-da-api.ts).

  Acesso: sem login. Quem chama manda a chave fixa da API
  (`Authorization: Bearer <EDITAIS_API_CHAVE>`). A função lê
  `listar_editais_da_api` (migration 20261105170000) com a chave de servidor do Supabase
  (SUPABASE_SERVICE_ROLE_KEY), que nunca sai daqui, e devolve as linhas
  ativas de todas as áreas. Trocar a chave = mudar EDITAIS_API_CHAVE na Vercel
  e fazer um novo deploy; a chave antiga para de valer. A mesma chave vale
  para /api/aprovados e /api/cronograma (api/_rota-com-chave.ts).

  Variáveis na Vercel (Settings › Environment Variables):
    VITE_SUPABASE_URL           já existe (a do app)
    SUPABASE_SERVICE_ROLE_KEY   chave de servidor do Supabase (secreta)
    EDITAIS_API_CHAVE           a chave que se entrega ao outro sistema
                                (gere uma longa e aleatória, ex.:
                                `openssl rand -hex 32`)

  Filtros opcionais na query: ?edital=&unidade= (contém) e
  ?status=&etapa=&risco=&area= (igual, sem caixa nem acento; ?area= aceita o
  nome ou o código: saude-indigena, sede, projetos).

  COMO USAR EM OUTRA APLICAÇÃO

  1. A chamada (JavaScript), com a chave que o MONITORA entregou:

       const resposta = await fetch(
         "https://yeende.vercel.app/api/editais?risco=alto",
         { headers: { Authorization: `Bearer ${CHAVE_DA_API}` } },
       );
       const { editais, totais } = await resposta.json();

     Pela linha de comando:

       curl -H "Authorization: Bearer <chave>" \
         "https://yeende.vercel.app/api/editais?unidade=yanomami"

     Guarde a chave no servidor da outra aplicação (variável de ambiente), não
     no código do navegador: quem tem a chave lê os editais.

  2. A resposta (200, JSON):

       {
         "editais": [
           { "id": 1, "unidade": "DSEI Yanomami", "area": "Saúde Indígena",
             "edital": "001/2026",
             "status": "Em andamento", "etapa": "Análise curricular",
             "vagas": 10, "contratados": 4, "ociosas": 6, "risco": "Alto",
             "link": "https://.../edital-001-2026.pdf" }
         ],
         "totais": { "linhas": 1, "vagas": 10, "contratados": 4, "ociosas": 6 }
       }

     vagas, contratados e ociosas são sempre números (0 quando vazio); os
     textos vêm "" quando o campo está vazio no MONITORA. "link" é o
     endereço do edital publicado; os anexos não vêm na API.

  3. Erros (JSON { "erro": "<código>" }):
       401 chave_invalida       sem Bearer, ou chave diferente da combinada
       405 metodo_nao_permitido só GET
       500 configuracao_ausente faltam as variáveis acima na Vercel
       502 falha_na_leitura     o banco não respondeu; tente de novo

  A rota só existe no site publicado na Vercel (não no `npm run dev`). A
  resposta não é guardada em cache (Cache-Control: private, no-store).
*/

import {
  RPC_DOS_EDITAIS,
  editaisDaApi,
  filtrosDaApi,
  totaisDaApi,
} from "../src/lib/editais-da-api.js";
import { criarRotaComChave } from "./_rota-com-chave.js";

export default criarRotaComChave({
  rpc: RPC_DOS_EDITAIS,
  montar(payload, query) {
    const editais = editaisDaApi(payload, filtrosDaApi(query));
    return { editais, totais: totaisDaApi(editais) };
  },
});
