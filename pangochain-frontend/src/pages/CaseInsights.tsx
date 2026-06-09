import { TrendingUp } from 'lucide-react'
import { FeatureScaffold } from '../components/FeatureScaffold'

export default function CaseInsights() {
  return (
    <FeatureScaffold
      icon={<TrendingUp className="w-5 h-5 text-[#1d6464]" />}
      title="Predictive Case Outcome Analysis"
      tagline="Data-driven outcome probabilities to set realistic client expectations."
      capabilities={[
        'Predicted outcome distribution (e.g. 68% settlement / 21% claimant win / 11% defendant win) with confidence intervals',
        'Key factors driving the prediction surfaced alongside the estimate',
        'Trained only on anonymised, aggregated case metadata — no document content ever leaves the platform',
        'Served via a Python inference endpoint that Spring Boot proxies',
      ]}
      dependencies={['Case Management', 'Document Versioning (DB)', 'Hearing Management']}
      infraNote="An offline scikit-learn / XGBoost training pipeline over a case_analytics_view and a Python FastAPI inference sidecar. Not provisioned in this environment."
    />
  )
}
