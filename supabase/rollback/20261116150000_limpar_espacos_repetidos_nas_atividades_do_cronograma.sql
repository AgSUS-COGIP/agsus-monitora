/*
  ROLLBACK de 20261116150000_limpar_espacos_repetidos_nas_atividades_do_cronograma: devolve o texto de antes (com os espaços repetidos)
  às 30 etapas, só onde o texto ainda é o que a migration gravou.
*/
begin;

set local lock_timeout = '5s';

update public."TB_CRONOGRAMA_MONIT_INDIG" c
   set atividade = v.antes,
       updated_at = now()
  from (values
  ('bb202ec6-7c21-46ea-a7ed-8b28af803548'::uuid, 'Consulta à situação final da solicitação de atendimento especializado', 'Consulta  à  situação  final  da  solicitação  de  atendimento especializado'),
  ('5353f7e1-6598-48b2-a3a6-351a2049dad9'::uuid, 'Divulgação do horário da prova e das orientações adicionais', 'Divulgação  do  horário  da  prova  e  das  orientações  adicionais'),
  ('ecf0f10e-66ed-4be6-b51e-0d1b99a8ff51'::uuid, 'Envio do link (endereço eletrônico) para o e‐mail do candidato', 'Envio do link (endereço eletrônico) para o e‐mail do  candidato'),
  ('1fa54291-1cce-4682-bb11-93b5c96045a2'::uuid, 'Disponibilização do link de acesso e teste do equipamento', 'Disponibilização  do  link  de  acesso  e  teste  do  equipamento'),
  ('db967d97-d510-49e1-a52a-39790e941a04'::uuid, 'Consulta individual aos gabaritos oficiais preliminares da prova objetiva', 'Consulta  individual  aos  gabaritos  oficiais  preliminares da prova objetiva'),
  ('78d24e81-cf39-4dd4-988c-caf13028a862'::uuid, 'Prazo para a interposição de recursos quanto às questões formuladas e(ou) aos gabaritos oficiais preliminares divulgados', 'Prazo  para  a  interposição  de  recursos  quanto  às  questões  formuladas  e(ou)  aos  gabaritos  oficiais  preliminares divulgados'),
  ('bf6b78ac-cf6f-40d4-94b1-cdefd7db57af'::uuid, 'Divulgação dos gabaritos oficiais preliminares da prova objetiva', 'Divulgação  dos  gabaritos  oficiais  preliminares  da  prova objetiva'),
  ('bbef9f75-e1ef-416b-bc25-ae23b02d1412'::uuid, 'Divulgação do edital de resultado final na prova objetiva e de convocação para o procedimento de confirmação da autodeclaração dos candidatos negros', 'Divulgação  do  edital  de  resultado  final  na  prova  objetiva e de convocação para o procedimento de  confirmação  da  autodeclaração  dos  candidatos  negros'),
  ('be803b97-53bb-48c2-bec6-0f700bebaa6b'::uuid, 'Realização do procedimento de confirmação complementar à autodeclaração para candidatos negros (pretos e pardos)', 'Realização  do  procedimento  de  confirmação complementar  à  autodeclaração  para  candidatos  negros (pretos e pardos)'),
  ('3b198109-d914-4f7d-9213-8389074b9a7c'::uuid, 'Divulgação do edital de resultado provisório na análise documental dos candidatos às vagas reservadas', 'Divulgação  do  edital  de  resultado  provisório  na  análise  documental  dos  candidatos  às  vagas  reservadas'),
  ('d13d0fee-80f9-45a5-9ba9-7eebdcb31fdc'::uuid, 'Prazo para a interposição de recursos contra o resultado provisório na análise documental dos candidatos às vagas reservadas', 'Prazo  para  a  interposição  de  recursos  contra  o  resultado  provisório  na  análise  documental  dos  candidatos  às  vagas  reservadas'),
  ('642b9c39-72ab-41e6-980b-a0f237d56bf0'::uuid, 'Divulgação do edital de resultado final no processo seletivo', 'Divulgação  do  edital  de  resultado  final  no processo seletivo'),
  ('19db0dcf-f2af-4d41-b4fe-a9c29cafc045'::uuid, 'Disponibilização do link para verificação de deferimento da foto encaminhada na inscrição e prazo para novo envio de foto', 'Disponibilização  do  link  para  verificação  de  deferimento  da  foto  encaminhada  na  inscrição  e  prazo  para  novo  envio  de  foto  '),
  ('9e722475-2797-411f-9496-85af583d0797'::uuid, 'Relação provisória dos candidatos que solicitaram concorrer na cotas', 'Relação  provisória  dos  candidatos  que  solicitaram  concorrer na cotas'),
  ('1ee7e63e-e28c-4602-b314-b23c209adb74'::uuid, 'Prazo para a interposição de recursos contra a relação provisória dos candidatos que solicitaram concorrer nas cotas', 'Prazo  para  a  interposição  de  recursos  contra  a  relação  provisória  dos  candidatos  que  solicitaram  concorrer nas cotas'),
  ('2eae7e12-0210-4363-8fcb-bf7ea9b29f20'::uuid, 'Relação final dos candidatos que solicitaram concorrer nas cotas', 'Relação  final  dos  candidatos  que  solicitaram  concorrer nas cotas'),
  ('7d49b8f9-3f13-4a9d-8dd0-95f627f8acfa'::uuid, 'Prazo para a interposição de recursos quanto às questões formuladas e(ou) aos gabaritos oficiais preliminares', 'Prazo  para  a  interposição  de  recursos  quanto  às  questões  formuladas  e(ou)  aos  gabaritos  oficiais  preliminares'),
  ('6d601e2e-6a7f-40d9-82c4-f33e80a77a9f'::uuid, 'Divulgação dos gabaritos oficiais preliminares da prova objetiva', 'Divulgação  dos  gabaritos  oficiais  preliminares  da  prova objetiva'),
  ('25ac2fa0-06b3-45ed-8b50-a7e00e03dc84'::uuid, 'Divulgação do edital de resultado final na prova', 'Divulgação  do  edital  de  resultado  final  na  prova'),
  ('d6212a0f-53e6-4693-a10c-46e939a7ed81'::uuid, 'Consulta à situação final da solicitação de atendimento especializado', 'Consulta  à  situação  final  da  solicitação  de  atendimento especializado'),
  ('561bc4fd-3724-4467-95b7-6676e1d8417e'::uuid, 'Divulgação do horário da prova e das orientações adicionais', 'Divulgação  do  horário  da  prova  e  das  orientações  adicionais'),
  ('712c7c86-c66f-4f8c-846c-fccce39c3bf8'::uuid, 'Envio do link (endereço eletrônico) para o e‐mail do candidato', 'Envio do link (endereço eletrônico) para o e‐mail do  candidato'),
  ('a84b71d2-6a54-4476-8d6f-33c89c5a9a18'::uuid, 'Consulta individual aos gabaritos oficiais preliminares da prova objetiva', 'Consulta  individual  aos  gabaritos  oficiais  preliminares da prova objetiva'),
  ('fb167915-23d5-4e98-9a9d-f619f8fff5d8'::uuid, 'Prazo para a interposição de recursos quanto às questões formuladas e(ou) aos gabaritos oficiais preliminares divulgados', 'Prazo  para  a  interposição  de  recursos  quanto  às  questões  formuladas  e(ou)  aos  gabaritos  oficiais  preliminares divulgados'),
  ('f59dadb6-8d74-411e-8d45-62de2fd21ece'::uuid, 'Divulgação dos gabaritos oficiais preliminares da prova objetiva', 'Divulgação  dos  gabaritos  oficiais  preliminares  da  prova objetiva'),
  ('84071f39-4499-4118-9a00-990e79c2438b'::uuid, 'Divulgação do edital de resultado final na prova objetiva e de convocação para o procedimento de confirmação da autodeclaração dos candidatos negros', 'Divulgação  do  edital  de  resultado  final  na  prova  objetiva e de convocação para o procedimento de  confirmação  da  autodeclaração  dos  candidatos  negros'),
  ('7065b511-82ee-4c2b-9116-16ad22498c06'::uuid, 'Realização do procedimento de confirmação complementar à autodeclaração para candidatos negros (pretos e pardos)', 'Realização  do  procedimento  de  confirmação complementar  à  autodeclaração  para  candidatos  negros (pretos e pardos)'),
  ('e1e1c4d2-1848-490c-9581-1bc0d516fc04'::uuid, 'Divulgação do edital de resultado provisório na análise documental dos candidatos às vagas reservadas', 'Divulgação  do  edital  de  resultado  provisório  na  análise  documental  dos  candidatos  às  vagas  reservadas'),
  ('be4d6ae9-af6e-4d44-bb39-a25046b53fbb'::uuid, 'Prazo para a interposição de recursos contra o resultado provisório na análise documental dos candidatos às vagas reservadas', 'Prazo  para  a  interposição  de  recursos  contra  o  resultado  provisório  na  análise  documental  dos  candidatos  às  vagas  reservadas'),
  ('4bac84a0-5174-4eae-932d-1487f11eef50'::uuid, 'Divulgação do edital de resultado final no processo seletivo', 'Divulgação  do  edital  de  resultado  final  no processo seletivo')
  ) as v(id, depois, antes)
 where c.id = v.id and c.atividade = v.depois;

commit;
