package main

import (
	"crypto/x509"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-chaincode-go/shimtest"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Mock ClientIdentity ──────────────────────────────────────────────────────

type mockClientIdentity struct {
	mspID string
}

func (m *mockClientIdentity) GetMSPID() (string, error)                      { return m.mspID, nil }
func (m *mockClientIdentity) GetID() (string, error)                         { return "mock-client-id", nil }
func (m *mockClientIdentity) GetX509Certificate() (*x509.Certificate, error) { return nil, nil }
func (m *mockClientIdentity) GetAttributeValue(attrName string) (string, bool, error) {
	return "", false, nil
}
func (m *mockClientIdentity) AssertAttributeValue(attrName, attrValue string) error { return nil }

// ─── Mock Transaction Context ─────────────────────────────────────────────────

type testContext struct {
	stub *shimtest.MockStub
	cid  *mockClientIdentity
}

func (tc *testContext) GetStub() shim.ChaincodeStubInterface {
	return tc.stub
}

func (tc *testContext) GetClientIdentity() cid.ClientIdentity {
	return tc.cid
}

// Compile-time check: testContext satisfies contractapi.TransactionContextInterface
var _ contractapi.TransactionContextInterface = (*testContext)(nil)

// ─── Test Helpers ─────────────────────────────────────────────────────────────

func setupCtx(t *testing.T, txID string) (*testContext, *shimtest.MockStub) {
	t.Helper()
	stub := shimtest.NewMockStub("legalcc", &LegalContract{})
	stub.MockTransactionStart(txID)
	ctx := &testContext{
		stub: stub,
		cid:  &mockClientIdentity{mspID: "TestMSP"},
	}
	return ctx, stub
}

func commitTx(stub *shimtest.MockStub, txID string) {
	stub.MockTransactionEnd(txID)
}

func mustGetDoc(t *testing.T, stub *shimtest.MockStub, docID string) *DocumentAsset {
	t.Helper()
	data, err := stub.GetState(docKey(docID))
	if err != nil {
		t.Fatalf("GetState(%s): %v", docID, err)
	}
	if data == nil {
		t.Fatalf("document %s not in state", docID)
	}
	var doc DocumentAsset
	if err := json.Unmarshal(data, &doc); err != nil {
		t.Fatalf("unmarshal doc: %v", err)
	}
	return &doc
}

func mustGetCase(t *testing.T, stub *shimtest.MockStub, caseID string) *CaseAsset {
	t.Helper()
	key := fmt.Sprintf("%s:%s", CasePrefix, caseID)
	data, err := stub.GetState(key)
	if err != nil {
		t.Fatalf("GetState(%s): %v", key, err)
	}
	if data == nil {
		t.Fatalf("case %s not in state", caseID)
	}
	var cas CaseAsset
	if err := json.Unmarshal(data, &cas); err != nil {
		t.Fatalf("unmarshal case: %v", err)
	}
	return &cas
}

func nowTS() string { return time.Now().UTC().Format(time.RFC3339) }

// ─── RegisterCase ─────────────────────────────────────────────────────────────

func TestRegisterCase(t *testing.T) {
	ctx, stub := setupCtx(t, "tx-reg-case")
	contract := &LegalContract{}

	if err := contract.RegisterCase(ctx, "case-001", "firm-001", "Smith v Jones", "lawyer-001", nowTS()); err != nil {
		t.Fatalf("RegisterCase: %v", err)
	}
	commitTx(stub, "tx-reg-case")

	cas := mustGetCase(t, stub, "case-001")
	if cas.CaseID != "case-001" {
		t.Errorf("caseId: got %s, want case-001", cas.CaseID)
	}
	if cas.Status != StatusActive {
		t.Errorf("status: got %s, want %s", cas.Status, StatusActive)
	}
	if cas.Title != "Smith v Jones" {
		t.Errorf("title: got %s, want 'Smith v Jones'", cas.Title)
	}
}

func TestRegisterCase_Duplicate(t *testing.T) {
	ctx, stub := setupCtx(t, "tx-dup-1")
	contract := &LegalContract{}

	if err := contract.RegisterCase(ctx, "dup-001", "firm-001", "Title", "lawyer", nowTS()); err != nil {
		t.Fatalf("first RegisterCase: %v", err)
	}
	commitTx(stub, "tx-dup-1")

	// Start a new transaction for the duplicate attempt
	stub.MockTransactionStart("tx-dup-2")
	ctx2 := &testContext{stub: stub, cid: &mockClientIdentity{mspID: "TestMSP"}}
	err := contract.RegisterCase(ctx2, "dup-001", "firm-001", "Title", "lawyer", nowTS())
	if err == nil {
		t.Fatal("expected error on duplicate RegisterCase, got nil")
	}
	commitTx(stub, "tx-dup-2")
}

// ─── RegisterDocument ─────────────────────────────────────────────────────────

func TestRegisterDocument(t *testing.T) {
	ctx, stub := setupCtx(t, "tx-reg-doc")
	contract := &LegalContract{}

	err := contract.RegisterDocument(ctx,
		"doc-001", "case-001", "sha256hexhash", "QmCID001",
		"owner-001", "TestMSP", nowTS())
	if err != nil {
		t.Fatalf("RegisterDocument: %v", err)
	}
	commitTx(stub, "tx-reg-doc")

	doc := mustGetDoc(t, stub, "doc-001")
	if doc.DocumentHash != "sha256hexhash" {
		t.Errorf("hash: got %s, want sha256hexhash", doc.DocumentHash)
	}
	if doc.IpfsCID != "QmCID001" {
		t.Errorf("cid: got %s, want QmCID001", doc.IpfsCID)
	}
	grant, ok := doc.ACL["owner-001"]
	if !ok || grant.Capability != CapOwner {
		t.Errorf("owner ACL entry missing or wrong capability")
	}
}

// ─── CheckAccess ──────────────────────────────────────────────────────────────

func TestCheckAccess_Granted(t *testing.T) {
	ctx, stub := setupCtx(t, "tx-acl-1")
	contract := &LegalContract{}

	_ = contract.RegisterDocument(ctx, "doc-acl", "case-001", "hash", "Qm1", "owner-001", "TestMSP", nowTS())
	_ = contract.GrantAccess(ctx, "doc-acl", "user-002", "TestMSP", CapRead, "", "wrapped-key", "owner-001")
	commitTx(stub, "tx-acl-1")

	stub.MockTransactionStart("tx-acl-check")
	checkCtx := &testContext{stub: stub, cid: &mockClientIdentity{mspID: "TestMSP"}}

	// Owner should have access
	result, err := contract.CheckAccess(checkCtx, "doc-acl", "owner-001", "TestMSP")
	if err != nil || result != "true" {
		t.Errorf("owner should have access: got %q err=%v", result, err)
	}

	// Granted user should have access
	result, err = contract.CheckAccess(checkCtx, "doc-acl", "user-002", "TestMSP")
	if err != nil || result != "true" {
		t.Errorf("grantee user-002 should have access: got %q err=%v", result, err)
	}
	commitTx(stub, "tx-acl-check")
}

func TestCheckAccess_Denied(t *testing.T) {
	ctx, stub := setupCtx(t, "tx-acl-deny")
	contract := &LegalContract{}

	_ = contract.RegisterDocument(ctx, "doc-deny", "case-001", "hash", "Qm2", "owner-001", "TestMSP", nowTS())
	commitTx(stub, "tx-acl-deny")

	stub.MockTransactionStart("tx-acl-deny-check")
	checkCtx := &testContext{stub: stub, cid: &mockClientIdentity{mspID: "OtherMSP"}}
	result, err := contract.CheckAccess(checkCtx, "doc-deny", "user-999", "OtherMSP")
	if err != nil {
		t.Fatalf("CheckAccess: %v", err)
	}
	if result != "false" {
		t.Errorf("expected 'false' for unknown user, got %q", result)
	}
	commitTx(stub, "tx-acl-deny-check")
}

// ─── LogAuditEvent ────────────────────────────────────────────────────────────

func TestRecordAuditEvent(t *testing.T) {
	ctx, stub := setupCtx(t, "tx-audit")
	contract := &LegalContract{}

	err := contract.LogAuditEvent(ctx,
		"DOC_VIEWED", "user-001", "TestMSP", "doc-001",
		`{"action":"download"}`, "")
	if err != nil {
		t.Fatalf("LogAuditEvent: %v", err)
	}
	commitTx(stub, "tx-audit")

	// Verify an AUDIT: key was written to state
	iter, err := stub.GetStateByRange("AUDIT:", "AUDIT:~")
	if err != nil {
		t.Fatalf("GetStateByRange: %v", err)
	}
	defer iter.Close()

	found := false
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			break
		}
		var event AuditEvent
		if jsonErr := json.Unmarshal(kv.Value, &event); jsonErr == nil && event.EventType == "DOC_VIEWED" {
			found = true
			break
		}
	}
	if !found {
		t.Error("audit event DOC_VIEWED not found in ledger")
	}
}

// ─── GetDocumentHistory ───────────────────────────────────────────────────────

func TestGetHistoryForKey(t *testing.T) {
	ctx, stub := setupCtx(t, "tx-hist-1")
	contract := &LegalContract{}

	// Version 1: register document
	_ = contract.RegisterDocument(ctx, "doc-hist", "case-001", "hash-v1", "Qm-v1", "owner-001", "TestMSP", nowTS())
	commitTx(stub, "tx-hist-1")

	// Version 2: update document
	stub.MockTransactionStart("tx-hist-2")
	ctx2 := &testContext{stub: stub, cid: &mockClientIdentity{mspID: "TestMSP"}}
	_ = contract.UpdateDocument(ctx2, "doc-hist", "Qm-v2", "hash-v2", "owner-001")
	commitTx(stub, "tx-hist-2")

	// Query history
	stub.MockTransactionStart("tx-hist-query")
	queryCtx := &testContext{stub: stub, cid: &mockClientIdentity{mspID: "TestMSP"}}
	history, err := contract.GetDocumentHistory(queryCtx, "doc-hist")
	commitTx(stub, "tx-hist-query")

	if err != nil {
		t.Fatalf("GetDocumentHistory: %v", err)
	}
	if len(history) == 0 {
		t.Error("expected at least one history entry, got 0")
	}
}
