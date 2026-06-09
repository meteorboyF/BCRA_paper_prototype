import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User as UserIcon, Sparkles, ChevronRight, CornerDownLeft, Lock, Loader2 } from 'lucide-react'
import { ConstellationBg } from '../components/ui/SvgAssets'

interface Message {
  id: string
  sender: 'ai' | 'user'
  text: string
  createdAt: string
  typing?: boolean
}

// Custom typewriter component for premium printing effect
function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    let index = 0
    const interval = setInterval(() => {
      setDisplayed((prev) => prev + text.charAt(index))
      index++
      if (index >= text.length) {
        clearInterval(interval)
        if (onComplete) onComplete()
      }
    }, 12) // fast typing speed

    return () => clearInterval(interval)
  }, [text, onComplete])

  return <p className="text-sm whitespace-pre-wrap leading-relaxed">{displayed}</p>
}

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      sender: 'ai',
      text: "Greetings. I am PangoChain Intelligence. I can query case documents, inspect Fabric block registries, and analyze timelines. How shall I assist your council today?",
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const suggestedPrompts = [
    "Verify integrity of Exhibit C in Sterling Matter",
    "Identify discrepancies in Vance patent claims",
    "Summarize recent audit events for IT governance",
    "Analyze scheduling risk for hearings next week"
  ]

  const handleSend = (textToSend: string) => {
    if (!textToSend.trim()) return
    
    const userMsg: Message = {
      id: `m-u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate AI response based on input
    setTimeout(() => {
      let responseText = "I've searched your active matter documents. No evidence tampering was detected, and all hashes match the Hyperledger Fabric ledger."
      
      const lower = textToSend.toLowerCase()
      if (lower.includes('exhibit c') || lower.includes('sterling')) {
        responseText = "Analyzing **Exhibit C** for **Sterling Class Action Defense**:\n- Decrypted locally using Sarah Sterling's public key.\n- SHA-256: `a94f31...b8e9` matched transaction block #1408 on Hyperledger Fabric.\n- Integrity status: **VERIFIED**. Opposing counsel's claims of document alteration are cryptographically invalid."
      } else if (lower.includes('discrepancies') || lower.includes('vance')) {
        responseText = "Reviewing claims for **Vance Patent Dispute**:\n- Cross-referenced depositions with patent filing metadata.\n- Inconsistency found: Deposition statement on page 14 contradicts claim 3 of Exhibit B regarding filing timeline.\n- Recommended motion: Motion to Strike deposition testimony due to prior art disclosures."
      } else if (lower.includes('audit') || lower.includes('governance')) {
        responseText = "Extracting Fabric ledger audit telemetry:\n- Active nodes: 4.\n- Total audited block events: 3,412.\n- Suspicious activity: 0 entries.\n- All document key exchanges validated using ECIES P-256 envelopes."
      } else if (lower.includes('hearings') || lower.includes('schedule')) {
        responseText = "Docket Scheduling Analytics:\n- Pre-Trial Conference scheduled for **June 12**.\n- Evidentiary filing deadline overlap on **June 18**.\n- Counsel workload warning: Sarah Sterling has a conflicting trial schedule. Recommended action: Petition for a 3-day filing extension."
      }

      const aiMsg: Message = {
        id: `m-ai-${Date.now()}`,
        sender: 'ai',
        text: responseText,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
    }, 1800)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-4xl mx-auto text-text-primary selection:bg-gold-500/20 selection:text-gold-300">
      
      {/* Top Banner with pulsing constellation */}
      <div className="relative h-24 border border-gold-500/10 bg-navy-900/60 rounded-t-2xl overflow-hidden px-6 flex items-center justify-between shrink-0">
        <ConstellationBg density={15} />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-950 border border-gold-500/20 shadow-gold-sm p-1.5 overflow-hidden">
            <img src="/logo-mark.png" alt="PangoChain Logo" className="h-full w-auto filter-gold animate-pulse" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-gold-300 flex items-center gap-2">
              PangoChain Intelligence
            </h2>
            <p className="text-[9px] font-mono text-text-secondary uppercase tracking-widest">Case-aware Cognitive RAG Agent</p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-1.5 text-[9px] font-mono font-bold text-emerald-400 bg-success/15 border border-success/30 px-2.5 py-1 rounded-lg">
          <Lock className="w-3 h-3 text-emerald-500" />
          TLS Decrypted Client-Side Session
        </div>
      </div>

      {/* Main chat space */}
      <div className="flex-1 overflow-y-auto scrollbar-thin border-x border-gold-500/10 bg-navy-950/40 p-6 space-y-6">
        <AnimatePresence>
          {messages.map((m) => {
            const isUser = m.sender === 'user'
            return (
              <div key={m.id} className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {/* AI Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-navy-900 border border-gold-500/20 flex items-center justify-center shrink-0 shadow-gold-sm">
                    <Sparkles className="w-4 h-4 text-gold-400" />
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-2xl relative ${
                    isUser
                      ? 'bg-navy-900/60 border border-gold-500/10 text-text-primary shadow-glass'
                      : 'border-l-2 border-gold-500 bg-gold-500/5 text-gold-300'
                  }`}>
                    {/* Render simulated typewriter for the newest message, regular text for older */}
                    {!isUser && m.id === messages[messages.length - 1].id && m.id !== 'm-1' ? (
                      <TypewriterText text={m.text} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    )}
                  </div>
                  <span className="text-[9px] text-text-muted mt-1.5 font-mono">
                    {m.createdAt}
                  </span>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-600 to-navy-950 border border-gold-500/20 flex items-center justify-center shrink-0 shadow-gold-sm">
                    <UserIcon className="w-4 h-4 text-gold-300" />
                  </div>
                )}
              </div>
            )
          })}
        </AnimatePresence>

        {isTyping && (
          <div className="flex gap-3.5 justify-start items-center">
            <div className="w-8 h-8 rounded-lg bg-navy-900 border border-gold-500/20 flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />
            </div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest animate-pulse">
              Consulting RAG embeddings...
            </span>
          </div>
        )}
      </div>

      {/* Suggested prompt chips */}
      <div className="border-x border-gold-500/10 bg-navy-950/20 px-6 py-4 shrink-0 flex flex-wrap gap-2.5 items-center justify-center border-t border-gold-500/5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-text-secondary">Suggested Queries:</span>
        {suggestedPrompts.map((p, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * i }}
            onClick={() => handleSend(p)}
            className="text-[10px] font-semibold tracking-wider text-gold-300 bg-gold-500/5 hover:bg-gold-500/10 border border-gold-500/15 hover:border-gold-500/30 px-3 py-1.5 rounded-xl transition-all duration-300"
          >
            {p}
          </motion.button>
        ))}
      </div>

      {/* Input panel at bottom */}
      <div className="border border-gold-500/10 bg-navy-900/80 p-4 rounded-b-2xl shrink-0 flex items-center gap-3">
        <input
          className="input flex-1 py-3 text-xs border-gold-500/10 focus:border-gold-500 focus:ring-gold-500/10"
          placeholder="Query case telemetry or search legal evidence..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(input)
          }}
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim()}
          className="btn-primary p-3 rounded-xl disabled:opacity-50 shadow-gold-sm shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
