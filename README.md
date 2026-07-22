# Sistema-Comissionamento
Sistema que calcula o comissionamento de colaboradores da empresa MADM Brasil.

passo á passo do sistema

acesso 2FN
    login e-mail
    senha 

informações principais
    login:
        nome do cloaborador
        equipe

    comissionamento:
        emitidos
        assinados
        ganhos
        perdidos
        Meta
        Bonus
        Comissão

-----------------------------------------------------------------------------------------

controle

    Informações de interesse do Banco (Usuários)
        - internal_id
        - colaborador
        - e_mail
        - id_equipe
        - equipe
        - grupo (Desativado, Elite, Supervisor, AnÃ¡lise de segurado, Concomitante, Juridico, Ultravita, SAC, QuinquÃªnio, Ultravita, Coordenador, ProntuÃ¡rio, CEO, Salesops, Administrativo, Diligencia, ComunicaÃ§Ã£o, Ganho, Marketing, Contrato, GerÃªncia, Dr. Felipe Marx, NULL, Assistente)
        - status (Comercial, Desativado, JurÃdico, Infoproduto, Backoffice)
    
    Não consultar

        -GRUPO: Desativado, Juridico, Ultravita, ProntuÃ¡rio, Diligencia, ComunicaÃ§Ã£o, Ganho, Marketing, Dr. Felipe Marx, NULL

            validar: Administrativo, Assistente, GerÃªncia

        -STATUS: Desativado, JurÃdico, Infoproduto, 


    Nivel de acesso (hierarquia)
       
            Nivel          |                Grupo
---------------------------|-------------------------------------------------------------
    Desc                   | Desativado, Juridico, Ultravita, ProntuÃ¡rio, Diligencia,   
                           | ComunicaÃ§Ã£o, Ganho, Marketing, Dr. Felipe Marx, NULL
                           |
    Assessor               | Elite, AnÃ¡lise de segurado, Concomitante, QuinquÃªnio
                           |
    Supervisão             | Supervisor
                           |
    Coordenador            | Coordenador
                           |
    Administrativo         | Salesops, CEO, administrativo(validar)

    
   Permissões:

    Desc            =     Não mostrar, sem acesso  --- Pode ser solucionado se o sistema não fazer a consulta desse grupo 
    Assessor        =     Visualizar 
    Supervisão      =     Visão equipe + anterior 
    Coordenador     =     Visão equipes + ajuste peso meta + anterior 
    Administrativo  =     Ajuste bônus + anterior

select internal_id, colaborador, e_mail, equipe, grupo , status, periodo
  from madm.colaboradores
  WHERE 
  periodo = '2026-04' and
  grupo in ('Elite','Supervisor','Análise de segurado','Concomitante','Salesops','Quinquenio','Coordenador','CEO','Diretoria')

-----------------------------------------------------------------------------------------

Cores

 * Primary: #09175b | Success: #34a853 | Ice: #c8eaed | Emerald: #045b5b | Gold: #ffcc00

-----------------------------------------------------------------------------------------

Calculo do peso da meta na página de relatório:

    Para um intervalo de 14 dias com meta diária = 3, a meta total deveria ser 3 × 14.

    Para um intervalo de 10 semanas com meta semanal = 15, a meta total deveria ser 15 × 10.

    Para um intervalo de 3 meses com meta mensal = 60, a meta total deveria ser 60 × 3.

Exemplo:

    Para um mês completo (30 dias): meta diária = 3 × 30 = 90; meta semanal = 15 × 4.3 ≈ 64.5; meta mensal = 60 × 1 = 60.

    Para uma semana exata (7 dias): meta diária = 3 × 7 = 21; meta semanal = 15 × 1 = 15; meta mensal = 60 × 0.23 ≈ 14 (arredondado).

    Para um dia único: meta diária = 3 × 1 = 3; meta semanal = 15 × 0.14 ≈ 2; meta mensal = 60 × 0.03 ≈ 2.


Comentário typscript

 {/*validar    ---------------------------------------------------------------------------------------------------------------------------------------------------------*/}


SQL

/*----- PESOS -----*/

/*
metrica_id
id_assessor
email
email_normalizado
senha_colaborador_hash
data_metrica
comissao_colaborador
comissao_bonus
peso_meta_assinados_diario
peso_meta_ganho_diario
peso_meta_assinados_semanal
peso_meta_ganho_semanal
peso_meta_assinados_mensal
peso_meta_ganho_mensal
*/

SELECT * 
   FROM app_comissionamento.metricas_assessores
   WHERE
     email ='larissa.santos@madmbrasil.com.br'
     and data_metrica ='2026-06-01'

UPDATE app_comissionamento.metricas_assessores
      SET email = 'larissa.santos@madmbrasil.com.br'
	  WHERE email = '';

INSERT INTO app_comissionamento.metricas_assessores (email)
VALUES ('');

DELETE FROM app_comissionamento.metricas_assessores 
WHERE metrica_id = '117';

CREATE TABLE metricas_eq (
    Coluna1 TipoDeDado Restricoes,
    Coluna2 TipoDeDado Restricoes,
    Coluna3 TipoDeDado Restricoes
);

/*----- COLABORACORES E EQUIPES -----*/

SELECT internal_id, id_crm, colaborador, e_mail, senha_app_comissionamento, id_equipe, equipe, grupo , status, periodo
  from madm.colaboradores
    WHERE 
	  e_mail ='larissa.santos@madmbrasil.com.br' and
      periodo = '2026-06'
   
SELECT internal_id, id_crm, colaborador, e_mail, senha_app_comissionamento, id_equipe, equipe, grupo , status, periodo
  from madm.colaboradores
    WHERE 
      periodo = '2026-05' and
      grupo in ('Elite','Supervisor','Análise de segurado','Concomitante','Salesops','Quinquenio','Quinquênio ','Coordenador','CEO','Diretoria')
	ORDER BY id_equipe;

SELECT DISTINCT id_equipe, equipe
	FROM madm.colaboradores
	  WHERE 
 	   periodo = '2026-05' AND
  	   id_equipe IS NOT NULL AND
 	   grupo IN ('Elite','Supervisor','Análise de segurado','Concomitante','Salesops','Quinquenio','Quinquênio ','Coordenador','CEO','Diretoria')
	ORDER BY id_equipe;

/*----- EMISSÕES -----*/

select internal_id, data_envio,nome,cpf,status,data_assinatura,consultor_responsavel_emissao,equipe_responsavel_emissao,data_atual,produto
  from madm.emitidos_e_assinados
    WHERE
	   data_assinatura = /*BETWEEN '2026-05-27' AND*/ current_date
	   AND produto ='';

/*----- ASSINADOS -----*/

select internal_id, data_envio,nome,cpf,status,data_assinatura,consultor_responsavel_assinatura,
       equipe_responsavel_assinatura,data_atual,produto
  from madm.emitidos_e_assinados
      WHERE
	   status = 'signed' 
	   AND equipe_responsavel_assinatura IN ('Equipe Jennifer')
	   /*AND equipe_responsavel_assinatura IN ('Equipe Ariana') */
	   AND data_assinatura between '2026-06-01' and current_date;

select COUNT(*)
  from madm.emitidos_e_assinados
      WHERE
	   status = 'signed' AND
	   produto ='Auxilio Acidente'  AND
	   data_assinatura = '2026-05-18';

/*----- PROTOCOLADOS -----*/

select id, produtos,lead_usuario_responsavel, funil_vendas, etapa_lead, resp_analise_segurado, 
       status_contrato, data_analise_segurado, data_assinatura, data_protocolo_juridico_auditoria 
  from madm.kommo_leads
    WHERE	   
	   data_protocolo_juridico_auditoria BETWEEN '2026-05-20' AND '2026-05-20';

/*----- GANHOS -----*/
/*COUNT(*)*/

select id, nome, produtos,lead_usuario_responsavel, funil_vendas, etapa_lead, resp_analise_segurado, 
       status_contrato, data_analise_segurado, data_assinatura, data_ganho, data_protocolo_juridico_auditoria
  from madm.kommo_leads
	where data_ganho between '2026-06-01' and current_date
	    /*and lead_usuario_responsavel = 'Tabata Juliana Ferreira de Lima'*/
		/*and resp_analise_segurado = 'Ellen dos Santos Amorim'*/
		and funil_vendas IN ('AUDITORIA DE GANHO', 'JURIDICO AUDITORIA DE GANHO', 'NOVO - AUDITORIA DE GANHO', 'PRO')
		and etapa_lead IN ('Venda ganha', 'PROTOCOLADO', 'AG PROTOCOLO','ENTRADA',
						  'E-MAIL NÃO RESPONDIDO','E-MAIL RESPONDIDO','AÇÃO DO CLIENTE','
						  ASSINATURA DO ADV','AG PRONTUÁRIO','PENDÊNCIA PRO','VALIDAÇÃO SUPERVISOR',
						  'protocolado');
 
/*----- PERDIDOS -----*/

select id, produtos,lead_usuario_responsavel, funil_vendas, etapa_lead, resp_analise_segurado, 
       status_contrato, data_analise_segurado, data_assinatura, data_ganho, data_protocolo_juridico_auditoria
  from madm.kommo_leads
    WHERE
	   etapa_lead = 'Venda perdida' AND
	   data_ganho BETWEEN '2026-05-01' AND '2026-05-31';
	   
/*------LEADS RECEBIDOS-----*/

select id, produtos,data_qualificacao,lead_usuario_responsavel, funil_vendas, etapa_lead, resp_analise_segurado, 
       status_contrato, data_analise_segurado, data_assinatura, data_ganho, data_protocolo_juridico_auditoria
  from madm.kommo_leads
    WHERE
	   data_qualificacao = '2026-05-11' AND
	   lead_usuario_responsavel = '' AND
	   etapa_lead = ''

/*----- VALORES PARA VERIFICAR -----*/

/*Total*/

SELECT 
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_qualificacao BETWEEN '2026-06-01' AND current_date) AS leads_recebidos,
    (SELECT COUNT(*) FROM madm.emitidos_e_assinados WHERE data_envio BETWEEN '2026-06-01' AND current_date) AS emitidos,
    (SELECT COUNT(*) FROM madm.emitidos_e_assinados WHERE data_assinatura BETWEEN '2026-06-01' AND current_date) AS assinados,
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_protocolo_juridico_auditoria BETWEEN '2026-06-01' AND current_date) AS protocolados,
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE
	                      data_ganho BETWEEN '2026-06-01' AND current_date
						  and produtos IN ('Auxílio Acidente')
						  and funil_vendas in ('AUDITORIA DE GANHO', 'JURIDICO AUDITORIA DE GANHO', 'NOVO - AUDITORIA DE GANHO', 'PRO')
		                  and etapa_lead IN ('Venda ganha', 'PROTOCOLADO', 'AG PROTOCOLO','ENTRADA',
						  'E-MAIL NÃO RESPONDIDO','E-MAIL RESPONDIDO','AÇÃO DO CLIENTE','
						  ASSINATURA DO ADV','AG PRONTUÁRIO','PENDÊNCIA PRO','VALIDAÇÃO SUPERVISOR',
						  'protocolado')) AS ganhos,
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_ganho BETWEEN '2026-06-01' AND current_date AND etapa_lead IN ('Venda perdida')) AS perdidos;

/*Hoje*/

SELECT 
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_qualificacao IN (current_date)) AS leads_recebidos,
    (SELECT COUNT(*) FROM madm.emitidos_e_assinados WHERE data_envio IN (current_date)) AS emitidos,
    (SELECT COUNT(*) FROM madm.emitidos_e_assinados WHERE data_assinatura IN (current_date)) AS assinados,
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_protocolo_juridico_auditoria IN (current_date)) AS protocolados,
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE
	                      data_ganho  IN (current_date)
						  and produtos IN ('Auxílio Acidente')
						  and funil_vendas IN ('AUDITORIA DE GANHO', 'JURIDICO AUDITORIA DE GANHO', 'NOVO - AUDITORIA DE GANHO', 'PRO')
		                  and etapa_lead IN ('Venda ganha', 'PROTOCOLADO', 'AG PROTOCOLO','ENTRADA',
						  'E-MAIL NÃO RESPONDIDO','E-MAIL RESPONDIDO','AÇÃO DO CLIENTE','
						  ASSINATURA DO ADV','AG PRONTUÁRIO','PENDÊNCIA PRO','VALIDAÇÃO SUPERVISOR',
						  'protocolado')) AS ganhos,
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_ganho IN (current_date) AND etapa_lead IN ('Venda perdida')) AS perdidos;


/*----- TESTE -----*/


SELECT * FROM madm.view_base_olos_temp

SELECT 
    a.email AS email_metricas,
    c.e_mail AS email_colab,
    a.email = c.e_mail AS igualdade_direta,
    LOWER(TRIM(a.email)) = LOWER(TRIM(c.e_mail)) AS igualdade_normalizada,
    c.colaborador,
    c.equipe
FROM app_comissionamento.metricas_assessores a
LEFT JOIN madm.colaboradores c 
    ON LOWER(TRIM(a.email)) = LOWER(TRIM(c.e_mail))
    AND c.periodo = '2026-06'
WHERE TO_CHAR(a.data_metrica::date, 'YYYY-MM') = '2026-06'
ORDER BY a.email
LIMIT 10;

SELECT 
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_qualificacao BETWEEN '2026-06-01' AND current_date
	                      /*AND lead_usuario_responsavel = 'Mayara Dias Ribeiro'*/) AS leads_recebidos,
						  
    (SELECT COUNT(*) FROM madm.emitidos_e_assinados WHERE data_envio BETWEEN '2026-06-01' AND current_date
	                       /*AND consultor_responsavel_assinatura IN ('Mayara Dias Ribeiro')*/) AS emitidos,
						  
    (SELECT COUNT(*) FROM madm.emitidos_e_assinados WHERE data_assinatura BETWEEN '2026-06-01' AND current_date
	                      /*AND consultor_responsavel_assinatura IN ('Mayara Dias Ribeiro')*/) AS assinados,
						  
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_protocolo_juridico_auditoria BETWEEN '2026-06-01' AND current_date
	                      /*AND lead_usuario_responsavel = 'Mayara Dias Ribeiro'*/) AS protocolados,
						  
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE
	                      data_ganho BETWEEN '2026-06-01' AND current_date
						  AND produtos IN ('Auxílio Acidente')
						  AND funil_vendas in ('AUDITORIA DE GANHO', 'JURIDICO AUDITORIA DE GANHO', 'NOVO - AUDITORIA DE GANHO', 'PRO')
		                  AND etapa_lead IN ('Venda ganha', 'PROTOCOLADO', 'AG PROTOCOLO','ENTRADA',
						  'E-MAIL NÃO RESPONDIDO','E-MAIL RESPONDIDO','AÇÃO DO CLIENTE','
						  ASSINATURA DO ADV','AG PRONTUÁRIO','PENDÊNCIA PRO','VALIDAÇÃO SUPERVISOR',
						  'protocolado')
						  /*AND lead_usuario_responsavel = 'Mayara Dias Ribeiro'*/) AS ganhos,
						  
    (SELECT COUNT(*) FROM madm.kommo_leads WHERE data_ganho BETWEEN '2026-06-01' AND current_date AND etapa_lead IN ('Venda perdida')
	                      /*AND lead_usuario_responsavel = 'Mayara Dias Ribeiro'*/) AS perdidos;


SELECT SUM(peso_meta_assinados_diario) AS total FROM  app_comissionamento.metricas_assessores
   WHERE classificacao_operacional in ('Discador','Judit')
    AND data_metrica ='2026-07-01';


/*---Atualizar judit---*/
UPDATE app_comissionamento.metricas_assessores
SET classificacao_operacional = 'Discador'
WHERE classificacao_operacional ='Judit'
and data_metrica = '2026-0-01'

SELECT * FROM  app_comissionamento.metricas_assessores
   WHERE colaborador IN ('')
AND data_metrica = '2026-0-01'
   ORDER BY colaborador ASC;

/*---Atualizar Desligados---*/
UPDATE app_comissionamento.metricas_assessores
SET classificacao_operacional = 'Desativado'
WHERE colaborador IN ('')

/*---Atualizar meta protocoladas---*/
UPDATE app_comissionamento.metricas_assessores
SET peso_meta_protocolados_mensal = ROUND(peso_meta_assinados_mensal * 0.6)
WHERE data_metrica = '2026-07-01';

/*---Inserir dados planilha---*/
INSERT INTO app_comissionamento.metricas_assessores (id_assessor,email,data_metrica,comissao_bonus,colaborador,classificacao_operacional)
VALUES (0,'@madmbrasil.com.br','2026-07-01',1,'nome','classOp')

/*-----------Sessões----------*/
SELECT * FROM  app_comissionamento.sessoes_app

DELETE FROM app_comissionamento.sessoes_app

SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 's%3AL45VjWV9TU6pL-s-p1c9NEZsdsRfoF6D.AEuCUDBTMt1kOYEfcW2gMj4svsY4zn3yhl3TEa2fmHI' 
  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app_comissionamento');
