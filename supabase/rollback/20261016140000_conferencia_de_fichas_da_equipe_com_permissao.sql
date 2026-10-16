/* Rollback de 20261016140000: a função do gatilho volta a rodar com o papel de quem chama. */
alter function private."FC_TG_EQUIPE_COM_FICHAS"() security invoker;
