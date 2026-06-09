--liquibase formatted sql

-- Sprint 3: Smart Contract Template Engine. Versioned, parameterised legal-document templates
-- (NDA, Retainer, Settlement). A template body uses {{variable}} placeholders; the fields_json
-- column describes the guided form. When a lawyer generates a document from a template the filled
-- text is encrypted and uploaded through the normal pipeline; a template_generations row records
-- which template version was used against which case, plus a SHA-256 hash of the parameters, so the
-- exact instrument is reproducible and is anchored on the ledger (TEMPLATE_GENERATED audit event).

--changeset pangochain:018-document-templates
CREATE TABLE document_templates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(40)  NOT NULL,
    name         VARCHAR(120) NOT NULL,
    category     VARCHAR(40)  NOT NULL DEFAULT 'CONTRACT',
    version      INT          NOT NULL DEFAULT 1,
    description  VARCHAR(400),
    fields_json  TEXT         NOT NULL,
    body         TEXT         NOT NULL,
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_doc_templates_key_version ON document_templates(template_key, version);

--changeset pangochain:018-template-generations
CREATE TABLE template_generations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id      UUID NOT NULL REFERENCES document_templates(id),
    template_key     VARCHAR(40) NOT NULL,
    template_version INT NOT NULL,
    case_id          UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    document_id      UUID REFERENCES documents(id) ON DELETE SET NULL,
    param_hash       VARCHAR(64) NOT NULL,
    generated_by     UUID REFERENCES users(id),
    fabric_tx_id     VARCHAR(120),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_template_generations_case ON template_generations(case_id);

--changeset pangochain:018-seed-templates
INSERT INTO document_templates (template_key, name, category, version, description, fields_json, body) VALUES
('nda', 'Mutual Non-Disclosure Agreement', 'CONTRACT', 1,
 'A reciprocal confidentiality agreement between two parties exchanging confidential information.',
 '[{"name":"partyA","label":"Party A (full legal name)","type":"text"},{"name":"partyB","label":"Party B (full legal name)","type":"text"},{"name":"effectiveDate","label":"Effective date","type":"date"},{"name":"purpose","label":"Purpose of disclosure","type":"textarea"},{"name":"termYears","label":"Confidentiality term (years)","type":"number"},{"name":"governingLaw","label":"Governing law / jurisdiction","type":"text"}]',
 'MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the "Agreement") is entered into on {{effectiveDate}} by and between {{partyA}} ("Party A") and {{partyB}} ("Party B"), collectively the "Parties".

1. PURPOSE. The Parties wish to explore the following purpose: {{purpose}}, in connection with which each Party may disclose Confidential Information to the other.

2. CONFIDENTIAL INFORMATION. "Confidential Information" means any non-public information disclosed by one Party to the other, whether orally, in writing, or by inspection of tangible objects.

3. OBLIGATIONS. Each Party shall hold the other Party Confidential Information in strict confidence and shall not disclose it to any third party without prior written consent.

4. TERM. The obligations of confidentiality under this Agreement shall survive for {{termYears}} years from the Effective Date.

5. GOVERNING LAW. This Agreement shall be governed by and construed in accordance with the laws of {{governingLaw}}.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.

_____________________________          _____________________________
{{partyA}}                              {{partyB}}'),
('retainer', 'Legal Services Retainer Agreement', 'CONTRACT', 1,
 'Engagement agreement setting out the scope of representation and fee arrangement between firm and client.',
 '[{"name":"firmName","label":"Law firm name","type":"text"},{"name":"clientName","label":"Client full legal name","type":"text"},{"name":"matter","label":"Matter / scope of representation","type":"textarea"},{"name":"hourlyRate","label":"Hourly rate (currency + amount)","type":"text"},{"name":"retainerAmount","label":"Initial retainer amount","type":"text"},{"name":"effectiveDate","label":"Effective date","type":"date"},{"name":"governingLaw","label":"Governing law / jurisdiction","type":"text"}]',
 'LEGAL SERVICES RETAINER AGREEMENT

This Retainer Agreement is made on {{effectiveDate}} between {{firmName}} (the "Firm") and {{clientName}} (the "Client").

1. SCOPE OF REPRESENTATION. The Firm agrees to represent the Client in connection with the following matter: {{matter}}.

2. FEES. The Client agrees to pay the Firm at the rate of {{hourlyRate}} per hour. Fees are billed against time recorded on the matter.

3. RETAINER. The Client shall deposit an initial retainer of {{retainerAmount}}, to be held and applied against fees and disbursements as they are incurred.

4. CONFIDENTIALITY. All communications between the Firm and the Client are protected by legal professional privilege.

5. GOVERNING LAW. This Agreement is governed by the laws of {{governingLaw}}.

Accepted and agreed:

_____________________________          _____________________________
{{firmName}}                            {{clientName}}'),
('settlement', 'Settlement Agreement & Release', 'CONTRACT', 1,
 'A full and final settlement and mutual release resolving a dispute between two parties.',
 '[{"name":"claimant","label":"Claimant full legal name","type":"text"},{"name":"respondent","label":"Respondent full legal name","type":"text"},{"name":"caseReference","label":"Case / matter reference","type":"text"},{"name":"settlementAmount","label":"Settlement amount","type":"text"},{"name":"paymentDays","label":"Payment due (days from signing)","type":"number"},{"name":"effectiveDate","label":"Effective date","type":"date"},{"name":"governingLaw","label":"Governing law / jurisdiction","type":"text"}]',
 'SETTLEMENT AGREEMENT AND RELEASE

This Settlement Agreement (the "Agreement") is made on {{effectiveDate}} between {{claimant}} (the "Claimant") and {{respondent}} (the "Respondent") in relation to matter {{caseReference}}.

1. SETTLEMENT SUM. The Respondent shall pay the Claimant the sum of {{settlementAmount}} within {{paymentDays}} days of the date of this Agreement, in full and final settlement of all claims.

2. RELEASE. Upon receipt of the Settlement Sum, the Claimant releases and forever discharges the Respondent from all claims arising out of the matter described above.

3. NO ADMISSION. This Agreement is entered into without any admission of liability by either Party.

4. CONFIDENTIALITY. The terms of this Agreement shall remain confidential save as required by law.

5. GOVERNING LAW. This Agreement is governed by the laws of {{governingLaw}}.

IN WITNESS WHEREOF, the Parties have executed this Agreement.

_____________________________          _____________________________
{{claimant}}                            {{respondent}}');
--rollback DROP TABLE template_generations; DROP TABLE document_templates;
