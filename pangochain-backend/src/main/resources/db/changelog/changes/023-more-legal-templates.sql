--liquibase formatted sql

--changeset pangochain:023-more-legal-templates
INSERT INTO document_templates (template_key, name, category, version, description, fields_json, body) VALUES
('demand-letter', 'Pre-Litigation Demand Letter', 'CORRESPONDENCE', 1,
 'Formal demand letter for payment, performance, or corrective action before filing suit.',
 '[{"name":"recipient","label":"Recipient name","type":"text"},{"name":"clientName","label":"Client name","type":"text"},{"name":"matterSummary","label":"Matter summary","type":"textarea"},{"name":"demand","label":"Demand requested","type":"textarea"},{"name":"deadlineDate","label":"Response deadline","type":"date"},{"name":"lawFirm","label":"Law firm","type":"text"}]',
 'PRE-LITIGATION DEMAND LETTER

To: {{recipient}}

We represent {{clientName}} concerning the following matter:

{{matterSummary}}

Our client demands the following corrective action:

{{demand}}

Please respond no later than {{deadlineDate}}. If no acceptable response is received, our client may pursue all available legal remedies.

Sincerely,
{{lawFirm}}'),
('affidavit', 'Witness Affidavit', 'EVIDENCE', 1,
 'Sworn factual statement for a witness or declarant.',
 '[{"name":"witnessName","label":"Witness full name","type":"text"},{"name":"jurisdiction","label":"Jurisdiction","type":"text"},{"name":"statement","label":"Statement of facts","type":"textarea"},{"name":"dateSigned","label":"Date signed","type":"date"},{"name":"notaryName","label":"Notary / commissioner","type":"text"}]',
 'WITNESS AFFIDAVIT

I, {{witnessName}}, of lawful age, declare under oath in {{jurisdiction}} as follows:

{{statement}}

I affirm that the foregoing is true and correct to the best of my knowledge.

Date: {{dateSigned}}

_____________________________
{{witnessName}}

Sworn before me:
{{notaryName}}'),
('motion-extension', 'Motion for Extension of Time', 'PLEADING', 1,
 'Court motion requesting additional time for a filing, response, or procedural step.',
 '[{"name":"courtName","label":"Court name","type":"text"},{"name":"caseCaption","label":"Case caption","type":"text"},{"name":"movingParty","label":"Moving party","type":"text"},{"name":"currentDeadline","label":"Current deadline","type":"date"},{"name":"requestedDeadline","label":"Requested deadline","type":"date"},{"name":"reason","label":"Reason for extension","type":"textarea"}]',
 'MOTION FOR EXTENSION OF TIME

IN THE {{courtName}}

{{caseCaption}}

{{movingParty}} respectfully moves for an extension of time from {{currentDeadline}} to {{requestedDeadline}}.

Grounds for this request:

{{reason}}

Respectfully submitted.'),
('client-consent', 'Client Consent to Share Documents', 'GENERAL', 1,
 'Client authorization for sharing selected case documents with named recipients.',
 '[{"name":"clientName","label":"Client name","type":"text"},{"name":"recipientNames","label":"Authorized recipients","type":"textarea"},{"name":"documentScope","label":"Document scope","type":"textarea"},{"name":"expiryDate","label":"Access expiry date","type":"date"},{"name":"effectiveDate","label":"Effective date","type":"date"}]',
 'CLIENT CONSENT TO SHARE DOCUMENTS

I, {{clientName}}, authorize my legal team to share the following case documents:

{{documentScope}}

Authorized recipients:

{{recipientNames}}

This authorization is effective {{effectiveDate}} and expires {{expiryDate}} unless revoked earlier in writing.

_____________________________
{{clientName}}');
