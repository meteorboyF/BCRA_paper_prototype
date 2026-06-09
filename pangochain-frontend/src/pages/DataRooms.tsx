import { DoorOpen } from 'lucide-react'
import { FeatureScaffold } from '../components/FeatureScaffold'

export default function DataRooms() {
  return (
    <FeatureScaffold
      icon={<DoorOpen className="w-5 h-5 text-[#1d6464]" />}
      title="Cross-Firm Secure Data Room"
      tagline="Share discovery documents with external counsel through a sandboxed, audited viewer."
      capabilities={[
        'Create a data room from a case, select documents, and set an expiry date',
        'Invite an external party via a time-limited token; they authenticate and view (not download) in a sandbox',
        'Document keys re-wrapped under a data-room key, itself wrapped to the invitee — keeping the E2E model intact',
        'Every external access written to both audit stores and anchored on the ledger',
      ]}
      dependencies={['Two-Layer ACL', 'Document Encryption Upload', 'Team Access Panel', 'E2E Messaging']}
      infraNote="External-identity onboarding (time-limited invitation tokens), a sandboxed viewer, and a RecordDataRoomAccess chaincode function. Cross-firm federation is not provisioned in this environment."
    />
  )
}
