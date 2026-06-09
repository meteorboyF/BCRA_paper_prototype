package main

// DocumentAsset is the on-chain representation of a registered document.
type DocumentAsset struct {
	DocID         string            `json:"docId"`
	CaseID        string            `json:"caseId"`
	DocumentHash  string            `json:"documentHash"`  // SHA-256 of plaintext
	IpfsCID       string            `json:"ipfsCid"`
	OwnerID       string            `json:"ownerId"`
	OwnerOrg      string            `json:"ownerOrg"`
	Timestamp     string            `json:"timestamp"`
	Status        string            `json:"status"`        // ACTIVE | DELETED | SUPERSEDED
	PrevVersionID string            `json:"prevVersionId"` // empty if first version
	Version       int               `json:"version"`
	ACL           map[string]*Grant `json:"acl"`           // subject -> Grant
}

// Grant represents an access capability for one subject on a document.
type Grant struct {
	Capability      string `json:"capability"`      // owner | write | read
	SubjectOrg      string `json:"subjectOrg"`
	GrantedBy       string `json:"grantedBy"`
	GrantedAt       string `json:"grantedAt"`
	ExpiresAt       string `json:"expiresAt"`       // RFC3339, empty = no expiry
	WrappedKeyRef   string `json:"wrappedKeyRef"`   // base64 ECIES-wrapped doc key
	Status          string `json:"status"`          // ACTIVE | REVOKED | EXPIRED
	RevokedAt       string `json:"revokedAt"`
}

// AuditEvent is a SHA-256 chained audit record stored on the ledger.
type AuditEvent struct {
	EventID       string `json:"eventId"`
	EventType     string `json:"eventType"`
	ActorID       string `json:"actorId"`
	ActorOrg      string `json:"actorOrg"`
	ResourceID    string `json:"resourceId"`
	ContextJSON   string `json:"contextJson"`
	PrevAuditHash string `json:"prevAuditHash"` // SHA-256 of previous event payload
	Timestamp     string `json:"timestamp"`
}

// CaseAsset is the on-chain record of a legal case/matter.
type CaseAsset struct {
	CaseID    string `json:"caseId"`
	FirmID    string `json:"firmId"`
	Title     string `json:"title"`
	CreatorID string `json:"creatorId"`
	Timestamp string `json:"timestamp"`
	Status    string `json:"status"` // ACTIVE | CLOSED | ARCHIVED
}

// Composite key prefixes
const (
	DocPrefix   = "DOC"
	CasePrefix  = "CASE"
	AuditPrefix = "AUDIT"

	StatusActive    = "ACTIVE"
	StatusRevoked   = "REVOKED"
	StatusExpired   = "EXPIRED"
	StatusDeleted   = "DELETED"
	StatusSuperseded = "SUPERSEDED"

	CapOwner = "owner"
	CapWrite = "write"
	CapRead  = "read"
)
