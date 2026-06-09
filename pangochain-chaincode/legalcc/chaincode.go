package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// LegalContract implements all chaincode functions for PangoChain.
type LegalContract struct {
	contractapi.Contract
}

// ─── RegisterDocument ────────────────────────────────────────────────────────

// RegisterDocument anchors a document's hash and IPFS CID to the ledger and
// initialises its ACL with the owner's full capability.
func (c *LegalContract) RegisterDocument(
	ctx contractapi.TransactionContextInterface,
	docID, caseID, documentHash, ipfsCID, ownerID, ownerOrg, timestamp string,
) error {
	key := docKey(docID)
	if exists, _ := assetExists(ctx, key); exists {
		return fmt.Errorf("document %s already registered", docID)
	}

	ownerGrant := &Grant{
		Capability:    CapOwner,
		SubjectOrg:    ownerOrg,
		GrantedBy:     ownerID,
		GrantedAt:     timestamp,
		WrappedKeyRef: "",
		Status:        StatusActive,
	}

	doc := &DocumentAsset{
		DocID:        docID,
		CaseID:       caseID,
		DocumentHash: documentHash,
		IpfsCID:      ipfsCID,
		OwnerID:      ownerID,
		OwnerOrg:     ownerOrg,
		Timestamp:    timestamp,
		Status:       StatusActive,
		Version:      1,
		ACL:          map[string]*Grant{ownerID: ownerGrant},
	}

	if err := putAsset(ctx, key, doc); err != nil {
		return err
	}

	ctx.GetStub().SetEvent("DOC_REGISTERED", mustJSON(map[string]string{
		"docId": docID, "caseId": caseID, "ownerId": ownerID, "ownerOrg": ownerOrg,
	}))

	return c.logAuditInternal(ctx, "DOC_REGISTERED", ownerID, ownerOrg, docID,
		fmt.Sprintf(`{"caseId":"%s","hash":"%s","cid":"%s"}`, caseID, documentHash, ipfsCID))
}

// ─── GrantAccess ─────────────────────────────────────────────────────────────

// GrantAccess adds or updates an access capability for a target subject.
// Stores the ECIES-wrapped document key reference for that subject.
func (c *LegalContract) GrantAccess(
	ctx contractapi.TransactionContextInterface,
	docID, targetSubject, subjectOrg, capability, expiresAt, wrappedKeyRef, grantorID string,
) error {
	doc, err := getDocument(ctx, docID)
	if err != nil {
		return err
	}

	mspID, err := callerMSP(ctx)
	if err != nil {
		return err
	}

	// Only owner or owner-org admin may grant
	ownerGrant, ownerOK := doc.ACL[doc.OwnerID]
	if !ownerOK || (grantorID != doc.OwnerID && mspID != doc.OwnerOrg) {
		return fmt.Errorf("only the document owner may grant access")
	}
	_ = ownerGrant

	if capability != CapOwner && capability != CapWrite && capability != CapRead {
		return fmt.Errorf("invalid capability %q: must be owner|write|read", capability)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	doc.ACL[targetSubject] = &Grant{
		Capability:    capability,
		SubjectOrg:    subjectOrg,
		GrantedBy:     grantorID,
		GrantedAt:     now,
		ExpiresAt:     expiresAt,
		WrappedKeyRef: wrappedKeyRef,
		Status:        StatusActive,
	}

	if err := putAsset(ctx, docKey(docID), doc); err != nil {
		return err
	}

	ctx.GetStub().SetEvent("ACCESS_GRANTED", mustJSON(map[string]string{
		"docId": docID, "subject": targetSubject, "capability": capability,
	}))

	return c.logAuditInternal(ctx, "ACCESS_GRANTED", grantorID, mspID, docID,
		fmt.Sprintf(`{"subject":"%s","capability":"%s","expiresAt":"%s"}`, targetSubject, capability, expiresAt))
}

// ─── RevokeAccess ────────────────────────────────────────────────────────────

// RevokeAccess marks a subject's capability as REVOKED and emits a
// KEY_ROTATION_REQUIRED event so the backend can trigger re-encryption.
func (c *LegalContract) RevokeAccess(
	ctx contractapi.TransactionContextInterface,
	docID, targetSubject, revokerID string,
) error {
	doc, err := getDocument(ctx, docID)
	if err != nil {
		return err
	}

	mspID, err := callerMSP(ctx)
	if err != nil {
		return err
	}

	if revokerID != doc.OwnerID && mspID != doc.OwnerOrg {
		return fmt.Errorf("only the document owner may revoke access")
	}

	grant, ok := doc.ACL[targetSubject]
	if !ok {
		return fmt.Errorf("no access grant found for subject %s", targetSubject)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	grant.Status = StatusRevoked
	grant.RevokedAt = now

	if err := putAsset(ctx, docKey(docID), doc); err != nil {
		return err
	}

	// Signal key rotation required (Spring Boot listens for this)
	ctx.GetStub().SetEvent("KEY_ROTATION_REQUIRED", mustJSON(map[string]string{
		"docId": docID, "revokedSubject": targetSubject, "revokerOrg": mspID,
	}))
	ctx.GetStub().SetEvent("ACCESS_REVOKED", mustJSON(map[string]string{
		"docId": docID, "subject": targetSubject,
	}))

	return c.logAuditInternal(ctx, "ACCESS_REVOKED", revokerID, mspID, docID,
		fmt.Sprintf(`{"revokedSubject":"%s","revokedAt":"%s"}`, targetSubject, now))
}

// ─── CheckAccess ─────────────────────────────────────────────────────────────

// CheckAccess evaluates whether a user has an active, non-expired capability
// on a document. Called on EVERY document request (Layer 2 ACL check).
// Returns "true" or "false" as a string (evaluate transaction).
func (c *LegalContract) CheckAccess(
	ctx contractapi.TransactionContextInterface,
	docID, userID, userOrg string,
) (string, error) {
	doc, err := getDocument(ctx, docID)
	if err != nil {
		return "false", err
	}

	if doc.Status != StatusActive {
		return "false", nil
	}

	now := time.Now().UTC()

	// Check user-level grant first
	if grant, ok := doc.ACL[userID]; ok && grant.Status == StatusActive {
		if grant.ExpiresAt == "" {
			return "true", nil
		}
		exp, err := time.Parse(time.RFC3339, grant.ExpiresAt)
		if err == nil && now.Before(exp) {
			return "true", nil
		}
		// Expired — mark it
		grant.Status = StatusExpired
		_ = putAsset(ctx, docKey(docID), doc)
		return "false", nil
	}

	// Check org-level ownership
	if doc.OwnerOrg == userOrg {
		return "true", nil
	}

	// Check if any org-level grant exists for userOrg
	orgKey := "ORG:" + userOrg
	if grant, ok := doc.ACL[orgKey]; ok && grant.Status == StatusActive {
		if grant.ExpiresAt == "" {
			return "true", nil
		}
		exp, err := time.Parse(time.RFC3339, grant.ExpiresAt)
		if err == nil && now.Before(exp) {
			return "true", nil
		}
	}

	return "false", nil
}

// ─── GetAccessList ───────────────────────────────────────────────────────────

// GetAccessList returns the full ACL for a document (evaluate transaction).
func (c *LegalContract) GetAccessList(
	ctx contractapi.TransactionContextInterface,
	docID string,
) (*DocumentAsset, error) {
	return getDocument(ctx, docID)
}

// ─── GetHistoryForKey ────────────────────────────────────────────────────────

// GetDocumentHistory returns the full transaction history for a document key.
func (c *LegalContract) GetDocumentHistory(
	ctx contractapi.TransactionContextInterface,
	docID string,
) ([]map[string]interface{}, error) {
	iter, err := ctx.GetStub().GetHistoryForKey(docKey(docID))
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var records []map[string]interface{}
	for iter.HasNext() {
		mod, err := iter.Next()
		if err != nil {
			return nil, err
		}
		record := map[string]interface{}{
			"txId":      mod.TxId,
			"timestamp": mod.Timestamp.String(),
			"isDelete":  mod.IsDelete,
			"value":     string(mod.Value),
		}
		records = append(records, record)
	}
	return records, nil
}

// ─── UpdateDocument ──────────────────────────────────────────────────────────

// UpdateDocument records a new IPFS CID and hash after re-encryption / versioning.
func (c *LegalContract) UpdateDocument(
	ctx contractapi.TransactionContextInterface,
	docID, newIpfsCID, newDocumentHash, updaterID string,
) error {
	doc, err := getDocument(ctx, docID)
	if err != nil {
		return err
	}

	mspID, err := callerMSP(ctx)
	if err != nil {
		return err
	}

	// Must be owner or have write access
	if ok, _ := c.CheckAccess(ctx, docID, updaterID, mspID); ok != "true" {
		return fmt.Errorf("updater %s does not have write access to document %s", updaterID, docID)
	}

	doc.IpfsCID = newIpfsCID
	doc.DocumentHash = newDocumentHash
	doc.Version++

	if err := putAsset(ctx, docKey(docID), doc); err != nil {
		return err
	}

	return c.logAuditInternal(ctx, "DOC_UPDATED", updaterID, mspID, docID,
		fmt.Sprintf(`{"newCid":"%s","version":%d}`, newIpfsCID, doc.Version))
}

// ─── RegisterCase ────────────────────────────────────────────────────────────

// RegisterCase anchors a new legal case to the ledger.
func (c *LegalContract) RegisterCase(
	ctx contractapi.TransactionContextInterface,
	caseID, firmID, title, creatorID, timestamp string,
) error {
	key := fmt.Sprintf("%s:%s", CasePrefix, caseID)
	if exists, _ := assetExists(ctx, key); exists {
		return fmt.Errorf("case %s already registered", caseID)
	}

	cas := &CaseAsset{
		CaseID:    caseID,
		FirmID:    firmID,
		Title:     title,
		CreatorID: creatorID,
		Timestamp: timestamp,
		Status:    StatusActive,
	}

	mspID, _ := callerMSP(ctx)
	if err := putAsset(ctx, key, cas); err != nil {
		return err
	}

	return c.logAuditInternal(ctx, "CASE_REGISTERED", creatorID, mspID, caseID,
		fmt.Sprintf(`{"firmId":"%s","title":"%s"}`, firmID, title))
}

// ─── LogAuditEvent ───────────────────────────────────────────────────────────

// LogAuditEvent records an application-layer audit event with SHA-256 chaining.
// prevAuditHash is the SHA-256 hash of the previous audit event payload.
func (c *LegalContract) LogAuditEvent(
	ctx contractapi.TransactionContextInterface,
	eventType, actorID, actorOrg, resourceID, contextJSON, prevAuditHash string,
) error {
	return c.logAuditInternal(ctx, eventType, actorID, actorOrg, resourceID, contextJSON)
}

func (c *LegalContract) logAuditInternal(
	ctx contractapi.TransactionContextInterface,
	eventType, actorID, actorOrg, resourceID, contextJSON string,
) error {
	txID := ctx.GetStub().GetTxID()
	ts, _ := ctx.GetStub().GetTxTimestamp()
	timestamp := time.Unix(ts.Seconds, 0).UTC().Format(time.RFC3339)

	payload := fmt.Sprintf(`{"eventType":"%s","actorId":"%s","resourceId":"%s","txId":"%s","timestamp":"%s"}`,
		eventType, actorID, resourceID, txID, timestamp)
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(payload)))

	event := &AuditEvent{
		EventID:     txID + ":" + eventType,
		EventType:   eventType,
		ActorID:     actorID,
		ActorOrg:    actorOrg,
		ResourceID:  resourceID,
		ContextJSON: contextJSON,
		Timestamp:   timestamp,
	}

	key := fmt.Sprintf("%s:%s:%s", AuditPrefix, resourceID, txID)
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState(key, data); err != nil {
		return err
	}

	// Emit audit event for off-chain indexing
	ctx.GetStub().SetEvent("AUDIT_EVENT", mustJSON(map[string]string{
		"eventType":  eventType,
		"actorId":    actorID,
		"resourceId": resourceID,
		"hash":       hash,
		"timestamp":  timestamp,
	}))

	return nil
}

// ─── RevokeUserCertificate ───────────────────────────────────────────────────

// RevokeUserCertificate records an MSP-level revocation on the ledger.
func (c *LegalContract) RevokeUserCertificate(
	ctx contractapi.TransactionContextInterface,
	userID, revokerOrg string,
) error {
	mspID, err := callerMSP(ctx)
	if err != nil {
		return err
	}

	return c.logAuditInternal(ctx, "USER_CERT_REVOKED", userID, mspID, userID,
		fmt.Sprintf(`{"revokerOrg":"%s"}`, revokerOrg))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func docKey(docID string) string {
	return fmt.Sprintf("%s:%s", DocPrefix, docID)
}

func assetExists(ctx contractapi.TransactionContextInterface, key string) (bool, error) {
	data, err := ctx.GetStub().GetState(key)
	return data != nil, err
}

func getDocument(ctx contractapi.TransactionContextInterface, docID string) (*DocumentAsset, error) {
	data, err := ctx.GetStub().GetState(docKey(docID))
	if err != nil {
		return nil, fmt.Errorf("failed to read document %s: %w", docID, err)
	}
	if data == nil {
		return nil, fmt.Errorf("document %s not found", docID)
	}
	var doc DocumentAsset
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

func putAsset(ctx contractapi.TransactionContextInterface, key string, obj interface{}) error {
	data, err := json.Marshal(obj)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(key, data)
}

func callerMSP(ctx contractapi.TransactionContextInterface) (string, error) {
	id, err := ctx.GetClientIdentity().GetMSPID()
	return id, err
}

func mustJSON(v interface{}) []byte {
	data, _ := json.Marshal(v)
	return data
}
