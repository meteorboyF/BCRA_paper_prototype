import { MessagesSquare } from 'lucide-react'
import { FeatureScaffold } from '../../components/FeatureScaffold'

export default function ClientAssistant() {
  return (
    <FeatureScaffold
      icon={<MessagesSquare className="w-5 h-5 text-[#1d6464]" />}
      title="AI Case Chatbot"
      tagline="Plain-language answers about your case, available any time."
      capabilities={[
        'Ask questions like “When is my next hearing?” or “What does this filing mean?” and get clear answers',
        'Grounded in your own case timeline, hearings, and documents you already have access to',
        'Explains legal terms in everyday language without giving advice beyond your matter',
        'Escalates to your legal team when a question needs a human',
      ]}
      dependencies={['My Case', 'Document Vault', 'Real-Time Notifications']}
      infraNote="The same retrieval + LLM endpoint as the lawyer-side assistant, scoped to the client's own data. Not provisioned in this environment."
    />
  )
}
