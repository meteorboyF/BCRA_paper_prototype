import { Video } from 'lucide-react'
import { FeatureScaffold } from '../components/FeatureScaffold'

export default function VideoConsultations() {
  return (
    <FeatureScaffold
      icon={<Video className="w-5 h-5 text-[#1d6464]" />}
      title="Secure Video Consultation"
      tagline="Encrypted lawyer–client video meetings booked and joined inside the platform."
      capabilities={[
        'Schedule a consultation tied to a case; both parties receive a reminder and a join link',
        'End-to-end encrypted WebRTC media — the server only brokers the connection',
        'Optional consent-based recording, encrypted and stored like any other case document',
        'Each session start/end anchored to the audit trail for an attributable record',
      ]}
      dependencies={['Hearing Management', 'E2E Messaging', 'Real-Time Notifications']}
      infraNote="A WebRTC signalling server plus STUN/TURN for NAT traversal. Real-time media infrastructure is not provisioned in this environment."
    />
  )
}
