/*
  ROLLBACK de 20261113230000_validade_dos_editais_pelo_texto_do_edital: zera a validade dos 121 editais e reativa as listas
  vigentes deles que esta migration inativou. As listas que já estavam
  inativas em 13/11/2026 (27, da SEDE) ficam como estavam.
*/
begin;

set local lock_timeout = '5s';

create temporary table tmp_validade (id uuid primary key, edital text, anos smallint, meses smallint, prorrogado boolean) on commit drop;
insert into tmp_validade values
    ('b45241a2-25a7-4b60-8444-ede8b8691a71'::uuid, '04/2026', 1::smallint, 0::smallint, false),  -- projetos, texto do edital; vence 2027-04-17
    ('4e9916f0-24ff-4354-af74-c0f275dfd996'::uuid, '23/2025', 0::smallint, 6::smallint, false),  -- projetos, texto do edital; vence 2026-01-18
    ('9e459f45-4034-47dc-b9c7-43988bfc4083'::uuid, '29/2025', 0::smallint, 6::smallint, false),  -- projetos, texto do edital; vence 2026-02-26
    ('25e0a8f7-5e32-4b0a-9222-209ca17161dd'::uuid, '30/2026', 1::smallint, 0::smallint, false),  -- projetos, texto do edital; vence 2027-07-09
    ('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'::uuid, '93/2026', 1::smallint, 0::smallint, false),  -- projetos, texto do edital; vence 2027-11-19
    ('6d25281f-a9d0-47b9-9283-e37450b5eea5'::uuid, '96/2025', 1::smallint, 0::smallint, false),  -- projetos, texto do edital; vence 2027-02-04
    ('63e82eaa-9f5b-4eb4-98b3-d6306df9774f'::uuid, '03/2025', 3::smallint, 0::smallint, false),  -- saude-indigena, texto do edital (3 anos); a confirmar com a DAIS; vence 2028-06-16
    ('ccc57e7a-0abc-411a-b11f-637ae79ba599'::uuid, '04/2025', 3::smallint, 0::smallint, false),  -- saude-indigena, texto do edital (3 anos); a confirmar com a DAIS; vence 2028-06-16
    ('5bf30394-0a36-45e6-819e-4aeaf1ea35c6'::uuid, '05/2025', 1::smallint, 0::smallint, true),  -- saude-indigena, comunicado de 11/06/2026: validade de 1 ano, prorrogada até 13/06/2027; vence 2027-06-16
    ('5b22b75c-d03c-49f3-bbfd-e7d0fdf81b04'::uuid, '06/2025', 3::smallint, 0::smallint, false),  -- saude-indigena, texto do edital (3 anos); a confirmar com a DAIS; vence 2028-06-16
    ('59ca62a1-130e-483a-9b0f-beb9845f62f2'::uuid, '06/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-12-05
    ('5ed99875-24b8-4eb2-b54b-bbaab35f1525'::uuid, '09/2025', 3::smallint, 0::smallint, false),  -- saude-indigena, texto do edital (3 anos); a confirmar com a DAIS; vence 2028-06-16
    ('f25c5934-e09f-4c97-af1f-72f70d7d0975'::uuid, '100/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-04-21
    ('5351378f-7b51-43b4-a9e2-54a2a1c57773'::uuid, '101/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-04-21
    ('0079ca2a-cc62-45b2-83ec-72985958ab99'::uuid, '102/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-10-21
    ('6a5386fe-9fc2-40a3-acab-e8205097bdc0'::uuid, '103/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-05-05
    ('0f8b8641-3a54-47dc-8e04-a3b72268d99c'::uuid, '105/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-06-03
    ('10bfbcf9-4f21-4b1e-8312-d428cd758f1f'::uuid, '107/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-11-12
    ('5fb89464-e47f-4960-9a42-f329468c45de'::uuid, '108/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-05-06
    ('467e1c32-d166-48b6-a8e2-d06238c10cab'::uuid, '109/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-11-25
    ('5bf46d79-7f2e-4b14-a511-07e0e7612e1b'::uuid, '11/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-04-01
    ('64811db4-bf03-4092-bb70-13b347906d46'::uuid, '110/2026', 2::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2028-11-25
    ('be4de98f-ba77-45f7-9a0e-103e5ed16156'::uuid, '111/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-11-18
    ('a22901ed-c247-4a4b-aa9c-c75824e2bdfb'::uuid, '112/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-05-19
    ('63d95670-e7db-448a-9e73-58968f1a4327'::uuid, '115/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-05-19
    ('d279249c-97f1-43dc-bad2-c0e38384a411'::uuid, '116/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-11-25
    ('48240cc5-8e1f-4169-92e2-52dbb57343fa'::uuid, '119/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-12-04
    ('fd1e7d6e-2bbc-496c-a49d-699e147fff1d'::uuid, '12/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-03-15
    ('5ffd6222-c942-4e7c-b751-422dc0ce55b0'::uuid, '120/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-12-10
    ('c48f73ed-c79c-4346-a90e-dab111833d17'::uuid, '122/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-06-16
    ('6f141527-320b-4a74-b5c7-a831af467022'::uuid, '123/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-12-22
    ('7e5a35fe-e5c1-49fb-85e2-e6a95be76662'::uuid, '13/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-08-02
    ('1be7def5-ae2c-4e10-84fa-d510155876e9'::uuid, '14/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-02-20
    ('f368fc46-bd91-4826-8edf-3dc64f42962d'::uuid, '14/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-05-13
    ('93177ee3-5428-492e-a47d-afd607e21511'::uuid, '15/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-02-20
    ('c53fa500-5338-4507-9892-d6d7a7c88776'::uuid, '22/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-06-08
    ('de87367e-4970-49e2-98ce-a1ee72c8104d'::uuid, '23/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-08-10
    ('41fff020-c32e-436f-9714-21743a71e4f9'::uuid, '34/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('a20696fd-cb4d-428d-860c-23a8311538f3'::uuid, '36/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-08-14
    ('2a564b46-4ab5-42d2-9a8a-eabe437f640d'::uuid, '37/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-03-15
    ('25432529-53d1-4c68-be10-4f6883ed81b5'::uuid, '38/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-08-21
    ('06825445-92e6-4931-b0b5-3b183d43c399'::uuid, '39/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-05-17
    ('4073003b-5477-413d-aa35-2d491d59a3e4'::uuid, '39/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('d2a698d3-afa0-4948-b1de-0c6a17aecd79'::uuid, '40/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('003e9b29-883f-4a5b-bc46-785f64bf2cca'::uuid, '41/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('603fd16c-f507-4611-96bd-03f06452575e'::uuid, '42/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('bc7fb347-f848-4450-a653-6205dfd459d1'::uuid, '43/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('56c46324-01ec-4708-948d-461a5c2a2aa6'::uuid, '44/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('3dd5e70e-6830-4d05-a177-d3bd1c81dfdf'::uuid, '45/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('a7b9647b-a43c-441f-89a0-10145f62eb27'::uuid, '46/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('d0ab7725-3bda-4c2b-aa65-e79837f4926a'::uuid, '47/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('304f34a7-5865-49ad-9706-89dc56d65ef9'::uuid, '48/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('98704c80-7f1e-4830-9d8c-4ce14f07c029'::uuid, '49/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('fcfe3936-61fe-44a2-9202-c98dce838227'::uuid, '50/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('63f926c0-948c-4521-8a90-8fe42e2e196b'::uuid, '51/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('6008c437-5cdc-4fde-bfdc-b5766376ebb9'::uuid, '52/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('83822129-b1a3-412b-81f0-766551872a23'::uuid, '53/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-05-17
    ('c25a651f-b97d-4835-a49c-c811aedb0658'::uuid, '53/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('cc68932c-fdab-4568-9bdc-168e26d19732'::uuid, '54/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('23afdf9e-fd10-4158-8109-dbef713e0173'::uuid, '55/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('d111d7c4-7c79-4f9d-9e2e-71b0076147d3'::uuid, '56/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('4e299480-c580-496e-9cb3-755c6b48ee34'::uuid, '57/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('067b5b4d-d00d-406c-aca7-ce431d81e05e'::uuid, '58/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('63d4829e-4e74-44aa-ba16-31c9204362aa'::uuid, '59/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('6f39377d-4299-441e-8f76-8504f8f2bed5'::uuid, '60/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('31de8338-714a-4af3-9987-4ac4632214c5'::uuid, '63/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('ffd0b24b-0c2b-4911-9edf-c10234d73173'::uuid, '64/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-06-03
    ('5368f993-bff5-4551-91da-db8795ce8532'::uuid, '64/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('acb814e2-3c35-4597-80e8-8a4b4931628c'::uuid, '65/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-05-17
    ('b971b5ed-375e-41dc-b51e-be4fd19e7c4b'::uuid, '65/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('86d9de1c-58ed-40fb-955f-924211d94838'::uuid, '66/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-05-17
    ('1a865133-874a-41f7-8174-1d1382da687e'::uuid, '66/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('f9db5109-c0ac-4eb5-b042-4a81cf054bf8'::uuid, '67/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('b31221bb-b579-4703-97d4-aaa5d765859b'::uuid, '68/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-05-17
    ('a728e20f-b691-447d-a3bf-20296ed9eb4b'::uuid, '68/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('4fcf9068-c43e-4f8f-9293-4236f7205ab7'::uuid, '69/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('45599564-cffd-4591-bbb1-a44a11124d3a'::uuid, '70/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-05-21
    ('116046c1-2d83-47b8-93ff-4e14ee8a2985'::uuid, '70/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-07-29
    ('8f18913f-4be3-430f-b032-00182944ad9e'::uuid, '71/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-05-21
    ('726003fa-e865-4fff-a0c6-d44156ac6450'::uuid, '71/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-01-29
    ('d22a1ffc-882b-4e7f-b073-d82d448924df'::uuid, '72/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-06-01
    ('1217be0d-54ab-451f-8815-9b7093000de6'::uuid, '72/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-02-28
    ('c3ac61c1-b44f-4b21-ada3-4ed042f850a8'::uuid, '74/2025', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-01-28
    ('e78f5b96-6a83-4a95-b9f1-fa28100ce572'::uuid, '74/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-03-08
    ('9f0e5f12-b40d-47ac-a96f-8cc6cb136afc'::uuid, '75/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-03-09
    ('7dfc525f-4cd4-4d03-87fd-c1e7a8441629'::uuid, '76/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-08-02
    ('f32bb3d2-17e7-4c8d-a467-ac31f197dc8b'::uuid, '76/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-08-31
    ('b5642afd-aff2-4e03-900e-318790da4160'::uuid, '78/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-06-08
    ('fee83924-2816-4178-9472-9b0e4885736f'::uuid, '79/2025', 0::smallint, 6::smallint, true),  -- saude-indigena, comunicado de 22/05/2026: prorrogado até 02/12/2026; vence 2027-01-12
    ('ac218242-73d2-44d6-9dfb-b817545589ba'::uuid, '79/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-03-23
    ('2961c99e-3a71-445a-910b-322668b7519a'::uuid, '80/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-06-08
    ('876fa232-c2c3-42cc-a1ae-3d9c11f5ccd7'::uuid, '81/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-03-03
    ('45e0b4f7-f277-4f2a-b16a-7f4fcd8a0f30'::uuid, '82/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-02-18
    ('7ba56b3a-4cc0-41d4-bc76-b29ee54bdddc'::uuid, '83/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-03-08
    ('0e160980-e0dd-403b-ac8e-afd60a8ae3ee'::uuid, '84/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-07-05
    ('7e7a9d1d-2b52-4209-93ca-46710a1f73a7'::uuid, '88/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-07-05
    ('02d50df9-1e6a-4b8a-bf5b-4b80bdb7332a'::uuid, '89/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-07-05
    ('078944f3-1176-4373-9cfe-cc042d1b197e'::uuid, '90/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-07-05
    ('ecbbe24b-cb85-4409-b805-0b582a23ef15'::uuid, '92/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-07-05
    ('62782387-8d05-4296-b043-dfddae5df381'::uuid, '92/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-04-06
    ('eae43c38-1f96-452a-a56b-b1aeb950ad0b'::uuid, '94/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-06-08
    ('ff0f2346-0b58-4a6a-815b-2713533773b8'::uuid, '94/2026', 1::smallint, 0::smallint, false),  -- saude-indigena, texto do edital; vence 2027-10-14
    ('9070a331-62c3-49f7-9f30-09078079bab7'::uuid, '95/2025', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2026-08-09
    ('8eb80bff-2400-402e-9eb8-adde2cfc0010'::uuid, '95/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-05-17
    ('10649332-b04e-4bec-ba46-a1f27886ba08'::uuid, '97/2026', 0::smallint, 6::smallint, false),  -- saude-indigena, texto do edital; vence 2027-04-07
    ('faa8696b-c7d5-4481-8bf0-dd375321bbe2'::uuid, '31/2025', 0::smallint, 6::smallint, false),  -- sede, texto do edital; vence 2026-05-03
    ('d99e8b95-32b6-415b-8b48-e0dec3e83977'::uuid, '33/2025', 0::smallint, 6::smallint, false),  -- sede, texto do edital; vence 2026-05-03
    ('76b5e655-3009-4bd6-867d-210381d8308a'::uuid, '35/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-11-03
    ('5cb9df0c-412e-463b-9287-d65410b75263'::uuid, '41/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-10-28
    ('23221b99-b2c6-44a5-a277-eb22b5631914'::uuid, '43/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-11-03
    ('a053a11a-d548-46e4-bc94-ca534a3a96f9'::uuid, '45/2025', 0::smallint, 6::smallint, false),  -- sede, texto do edital; vence 2026-05-03
    ('2eda9415-b89e-4dc8-bb54-f41c50b7d60c'::uuid, '46/2025', 0::smallint, 6::smallint, false),  -- sede, texto do edital; vence 2026-05-03
    ('bfa8370d-e314-46b3-9dda-fa34c8c1db99'::uuid, '48/2025', 0::smallint, 6::smallint, false),  -- sede, texto do edital; vence 2026-05-03
    ('c566aa5f-62d9-4edd-a993-dc653ed50830'::uuid, '50/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-10-28
    ('7d5cf8db-06fb-4867-8f31-41b56ae56488'::uuid, '51/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-10-28
    ('6c54a4e5-12c4-458f-b264-27dfe04accb9'::uuid, '52/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-10-28
    ('2f5b9907-04bf-4441-ae3a-b8d44726788f'::uuid, '56/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-10-28
    ('0d47c2ae-7b5c-4203-8023-82b7f81ca044'::uuid, '58/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-10-28
    ('5d63eccf-32db-497a-9c1b-480ee6faa8a5'::uuid, '59/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-10-28
    ('dbf33457-9ca1-4d4e-b45c-21cd03b7c01d'::uuid, '60/2025', 1::smallint, 0::smallint, false),  -- sede, texto do edital; vence 2026-10-28
    ('65f6f52a-615d-4072-a784-fca9e0f34454'::uuid, 'FGV 2025', 2::smallint, 0::smallint, false)  -- sede, texto do edital; vence 2027-12-12
;

update public."TB_LISTA_APROVADO" l
   set ativo = true, updated_at = now()
  from tmp_validade t
 where l.edital_id = t.id::text
   and l.vigente and not l.ativo
   and l.id not in ('3d22195d-4012-4edb-90d9-c7e5415ebdbd', '4c2933c3-ceed-4453-adf8-c27f06108739', 'd4452809-95d3-45c1-9752-eb7126abfbc8', 'b4ce0f4f-573a-402d-9182-71c0b02efaa1', '8eb62b3f-a9b6-4d14-a234-dabfa25c8083', '46f8a592-e327-411f-b9f0-a4032282fc67', '166ff43c-397e-46cf-8093-16173a922443', 'f7a09413-d7ff-4271-93cb-b9a167304d26', 'ecea4cfe-8749-458c-bbf4-6404c36e7752', 'ee61c404-03b0-4290-9259-3d58b3e10671', 'cd33ceea-5324-4f67-a5f8-35b2f825f222', '0b5d9e22-9447-427b-9fe6-c4fcc9a4337a', 'dbb7c720-5cfd-4bb9-9b60-c437e8bc98bb', '577890ca-dd2d-41a8-b6b1-8cbddd7ea69e', 'ab454b7a-9106-44e1-bec9-74158b23483e', '575ae580-4d4e-49ff-81f0-5158c4684681', 'faebd92f-f5d4-4235-8d86-f91fa9a82b89', 'b9a5db15-c920-4b08-9c51-e6ce23d70ead', '4b3ed3ea-f4ea-4c0a-955a-bc002bf33f35', '51b3473d-e9f6-4b4b-bb73-7d321bc783bb', '11873860-8962-4f32-b97b-8b37940b9632', '207065f7-6c71-4325-a60a-91ecfe0ea4d8', '7d6d84a0-d9be-4900-a1b9-4727b521138f', '08731277-b2d3-4ea0-af5a-34deff0f93e3', 'd4e6d076-6a4c-459d-82e3-528b05f60132', '65ff11a9-ad89-4155-8003-43b4f848d1ec', 'f159a221-d2eb-4415-94ca-7dbbc7cbb092');

update public."TB_MONITORAMENTO_INDIGENA" m
   set "NU_ANOS_VALIDADE" = 0, "NU_MESES_VALIDADE" = 0, "ST_PRORROGADO" = false
  from tmp_validade t
 where m.id = t.id;

commit;
