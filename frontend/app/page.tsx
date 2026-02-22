'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Plus, Scale, BookOpen, Loader2, MessageSquare, ExternalLink, FileText, AlertCircle, CheckCircle, Clock, Info, Brain, Lightbulb, ChevronDown, ChevronUp, Edit2, Check, X } from 'lucide-react';

// ─── Colour Tokens ───────────────────────────────────────────────────────────
// bg-page    : #ede8de   (warm parchment)
// bg-sidebar : #e2dbd0   (slightly darker beige)
// bg-card    : #ffffff   (white)
// bg-card-alt: #f7f3ec   (cream card)
// accent     : #74603e   (rich brown – matches the user's original colour)
// accent-dk  : #5c4b2f   (darker brown for hover)
// text-head  : #2d1f0e   (very dark brown, almost black)
// text-body  : #4a3728   (medium brown)
// text-muted : #8a7462   (muted tan)
// border     : rgba(116,96,62,0.20)
// ─────────────────────────────────────────────────────────────────────────────

// Types
interface ReasoningStep {
  step_number: number;
  step_type: string;
  title: string;
  explanation: string;
  confidence: number;
  supporting_sources: string[];
  legal_provisions: string[];
}

interface PrecedentExplanation {
  precedent_title: string;
  similarity_score: number;
  matching_factors: string[];
  different_factors: string[];
  key_excerpt: string;
  relevance_explanation: string;
  citation: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  messageType?: 'clarification' | 'information_gathering' | 'final_response';
  infoCollected?: Record<string, string>;
  infoNeeded?: string[];
  reasoningSteps?: ReasoningStep[];
  precedentExplanations?: PrecedentExplanation[];
}

interface Conversation {
  conversation_id: string;
  last_modified: string;
  message_count: number;
  status: 'analyzing' | 'gathering_info' | 'completed';
  user_intent: string;
  has_reasoning: boolean;
}

const LegalAssistChat: React.FC = () => {
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<any[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<string>('ready');
  const [infoCollected, setInfoCollected] = useState<Record<string, string>>({});
  const [infoNeeded, setInfoNeeded] = useState<string[]>([]);
  const [editingInfo, setEditingInfo] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const API_BASE = 'http://localhost:8000';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, streamingMessage]);
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const loadThreads = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setThreads(data.conversations || []);
    } catch (err) {
      console.error('Failed to load threads:', err);
      setError('Unable to load conversation history');
    }
  };

  const createNewThread = () => {
    setCurrentThreadId(`conv_${Date.now()}`);
    setMessages([]);
    setSources([]);
    setStreamingMessage('');
    setError(null);
    setInput('');
    setInfoCollected({});
    setInfoNeeded([]);
    setConversationStatus('ready');
  };

  const loadThread = async (threadId: string) => {
    try {
      setError(null);
      setStreamingMessage('');
      const res = await fetch(`${API_BASE}/history/${threadId}`);
      if (!res.ok) throw new Error('Failed to load conversation');
      const data = await res.json();
      setCurrentThreadId(threadId);

      const savedMessages = data.messages || [];
      const savedState = data.state || {};
      const savedReasoning = savedState.reasoning_steps || [];
      const savedPrecedents = savedState.precedent_explanations || [];
      const savedInfoCollected = savedState.info_collected || {};

      const formattedMessages: Message[] = savedMessages.map((msg: any, idx: number) => {
        let content = msg.content || '';
        if (msg.role === 'AIMessage' && content.includes('{"extracted_answer"')) {
          const jsonMatch = content.match(/^\s*\{[^}]*"extracted_answer"[^}]*\}/);
          if (jsonMatch) content = content.replace(jsonMatch[0], '').trim();
        }

        const isLastAssistantMsg = msg.role === 'AIMessage' && idx === savedMessages.length - 1;
        const message: Message = {
          role: msg.role === 'HumanMessage' ? 'user' : 'assistant',
          content,
          timestamp: new Date(),
        };

        if (isLastAssistantMsg && savedReasoning.length > 0) {
          message.reasoningSteps = savedReasoning;
          message.precedentExplanations = savedPrecedents;
          message.messageType = 'final_response';
        } else if (msg.role === 'AIMessage') {
          const isGatheringMsg = savedState.in_gathering_phase || Object.keys(savedInfoCollected).length > 0;
          if (isGatheringMsg && idx < savedMessages.length - 1) {
            message.messageType = 'information_gathering';
            message.infoCollected = savedInfoCollected;
          }
        }
        return message;
      });

      setMessages(formattedMessages);
      setSources([]);
      setInfoCollected(savedInfoCollected);
      setInfoNeeded(savedState.info_needed || []);
      if (savedState.has_sufficient_info) setConversationStatus('completed');
      else if (savedState.in_gathering_phase) setConversationStatus('gathering_info');
      else setConversationStatus('analyzing');
    } catch (err) {
      console.error('Failed to load thread:', err);
      setError('Unable to load this conversation');
    }
  };

  const deleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;
    try {
      const res = await fetch(`${API_BASE}/history/${threadId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      loadThreads();
      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        setMessages([]);
        setSources([]);
        setStreamingMessage('');
        setInfoCollected({});
        setInfoNeeded([]);
        setConversationStatus('ready');
      }
    } catch (err) {
      console.error('Failed to delete thread:', err);
      setError('Unable to delete conversation');
    }
  };

  const updateCollectedInfo = async (key: string, newValue: string) => {
    const updatedInfo = { ...infoCollected, [key]: newValue };
    setInfoCollected(updatedInfo);
    setEditingInfo(null);
    sendMessage(`I need to correct the ${key.replace('_', ' ')}: it should be "${newValue}"`);
  };

  const sendMessage = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const threadId = currentThreadId || `conv_${Date.now()}`;
    if (!currentThreadId) setCurrentThreadId(threadId);

    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    setInput('');
    setIsLoading(true);
    setStreamingMessage('');
    setSources([]);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, conversation_id: threadId, include_reasoning: true, include_prediction: true })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulatedText = '';
      let messageType: string | null = null;
      let reasoningSteps: ReasoningStep[] = [];
      let precedentExplanations: PrecedentExplanation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'clarification') {
              accumulatedText = data.content; messageType = 'clarification';
              setStreamingMessage(accumulatedText); setConversationStatus('clarifying');
            } else if (data.type === 'information_gathering') {
              accumulatedText = data.content; messageType = 'information_gathering';
              setInfoCollected(data.info_collected || {}); setInfoNeeded(data.info_needed || []);
              setStreamingMessage(accumulatedText); setConversationStatus('gathering_info');
            } else if (data.type === 'token') {
              accumulatedText += data.content; messageType = 'final_response';
              setStreamingMessage(accumulatedText); setConversationStatus('generating');
            } else if (data.type === 'sources') {
              setSources(data.sources || []);
            } else if (data.type === 'reasoning') {
              reasoningSteps = data.steps || [];
            } else if (data.type === 'precedent_explanations') {
              precedentExplanations = data.explanations || [];
            } else if (data.type === 'done') {
              messageType = data.message_type || 'final_response';
              if (accumulatedText) {
                const newMessage: Message = {
                  role: 'assistant', content: accumulatedText, timestamp: new Date(),
                  messageType: messageType as any,
                  reasoningSteps: data.reasoning_steps || reasoningSteps,
                  precedentExplanations: data.precedent_explanations || precedentExplanations
                };
                if (messageType === 'information_gathering') {
                  newMessage.infoCollected = data.info_collected;
                  newMessage.infoNeeded = data.info_needed;
                }
                setMessages(prev => [...prev, newMessage]);
              }
              setStreamingMessage('');
              if (messageType === 'final_response') setConversationStatus('completed');
              else if (messageType === 'information_gathering') setConversationStatus('gathering_info');
              else setConversationStatus('clarifying');
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (parseErr) { console.warn('Parse error:', parseErr); }
        }
      }
      loadThreads();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to get response. Please try again.');
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ I apologize, but I encountered an error. Please try again.', timestamp: new Date() }]);
      setStreamingMessage('');
    } finally { setIsLoading(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatMessage = (text: string): string => {
    if (!text) return '';
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/```([\s\S]*?)```/g, '<pre class="bg-[#f0ebe1] border border-[#c8b89a] p-3 rounded-lg my-2 overflow-x-auto text-[#2d1f0e]"><code>$1</code></pre>');
    text = text.replace(/`([^`]+)`/g, '<code class="bg-[#f0ebe1] border border-[#c8b89a] px-2 py-0.5 rounded text-sm text-[#74603e]">$1</code>');
    text = text.replace(/\n/g, '<br/>');
    return text;
  };

  const formatTime = (date?: Date): string => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'analyzing': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'gathering_info': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'clarifying': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'generating': return 'bg-[#f0ebe1] text-[#74603e] border-[#c8b89a]';
      default: return 'bg-stone-100 text-stone-600 border-stone-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'analyzing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'gathering_info': return <Info className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'clarifying': return <AlertCircle className="w-4 h-4" />;
      case 'generating': return <Loader2 className="w-4 h-4 animate-spin" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'analyzing': return 'Analyzing';
      case 'gathering_info': return 'Gathering Info';
      case 'completed': return 'Completed';
      case 'clarifying': return 'Clarifying';
      case 'generating': return 'Generating';
      default: return 'Ready';
    }
  };

  const getConfidenceColor = (c: number) => c >= 0.85 ? 'text-green-700' : c >= 0.70 ? 'text-yellow-700' : 'text-orange-700';
  const getConfidenceEmoji = (c: number) => c >= 0.85 ? '🟢' : c >= 0.70 ? '🟡' : '🟠';

  // ── Sub-components ─────────────────────────────────────────────────────────

  const ReasoningStepCard: React.FC<{ step: ReasoningStep; index: number }> = ({ step, index }) => {
    const [expanded, setExpanded] = useState(index === 0);
    return (
      <div className="bg-white rounded-xl border border-[rgba(116,96,62,0.20)] overflow-hidden shadow-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#f7f3ec] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-[#74603e] font-semibold">Step {step.step_number}</span>
            <span className="text-[#2d1f0e] font-medium">{step.title}</span>
            <span className={`text-sm ${getConfidenceColor(step.confidence)}`}>
              {getConfidenceEmoji(step.confidence)} {(step.confidence * 100).toFixed(0)}%
            </span>
          </div>
          {expanded
            ? <ChevronUp className="w-5 h-5 text-[#8a7462]" />
            : <ChevronDown className="w-5 h-5 text-[#8a7462]" />}
        </button>
        {expanded && (
          <div className="p-4 pt-0 space-y-3 border-t border-[rgba(116,96,62,0.10)]">
            <p className="text-[#4a3728]">{step.explanation}</p>
            {step.legal_provisions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {step.legal_provisions.map((p, i) => (
                  <span key={i} className="px-3 py-1 bg-[#f0ebe1] text-[#74603e] rounded-full text-sm border border-[#c8b89a]">
                    📜 {p}
                  </span>
                ))}
              </div>
            )}
            {step.supporting_sources.length > 0 && (
              <div className="text-sm text-[#8a7462]">📚 Based on {step.supporting_sources.length} precedent(s)</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const PrecedentCard: React.FC<{ precedent: PrecedentExplanation; index: number }> = ({ precedent, index }) => {
    const [expanded, setExpanded] = useState(false);
    return (
      <div className="bg-white rounded-xl border border-[rgba(116,96,62,0.20)] overflow-hidden shadow-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#f7f3ec] transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-[#74603e] font-semibold">#{index + 1}</span>
            <span className="text-[#2d1f0e] font-medium truncate">{precedent.precedent_title}</span>
            <span className="text-sm text-[#74603e] font-medium">{(precedent.similarity_score * 100).toFixed(0)}% match</span>
          </div>
          {expanded
            ? <ChevronUp className="w-5 h-5 text-[#8a7462]" />
            : <ChevronDown className="w-5 h-5 text-[#8a7462]" />}
        </button>
        {expanded && (
          <div className="p-4 pt-0 space-y-4 border-t border-[rgba(116,96,62,0.10)]">
            <div>
              <h4 className="text-sm font-semibold text-[#74603e] mb-2">Why This Matters:</h4>
              <p className="text-[#4a3728] text-sm">{precedent.relevance_explanation}</p>
            </div>
            {precedent.matching_factors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2">✓ Similarities:</h4>
                <ul className="space-y-1">
                  {precedent.matching_factors.map((f, i) => (
                    <li key={i} className="text-sm text-[#4a3728] flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {precedent.different_factors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-orange-700 mb-2">⚠ Differences:</h4>
                <ul className="space-y-1">
                  {precedent.different_factors.map((f, i) => (
                    <li key={i} className="text-sm text-[#4a3728] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {precedent.key_excerpt && (
              <div className="bg-[#f7f3ec] p-3 rounded-lg border-l-4 border-[#74603e]">
                <p className="text-sm text-[#4a3728] italic">"{precedent.key_excerpt}"</p>
              </div>
            )}
            {precedent.citation && (
              <a href={precedent.citation} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#74603e] hover:text-[#5c4b2f] text-sm font-medium">
                <ExternalLink className="w-4 h-4" /> View Full Precedent
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  const InfoCollectedSummary: React.FC<{ collectedInfo: Record<string, string> }> = ({ collectedInfo }) => {
    if (!collectedInfo || Object.keys(collectedInfo).length === 0) return null;
    const collected = Object.keys(collectedInfo).length;
    return (
      <div className="bg-[#f7f3ec] border border-[#c8b89a] rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-[#74603e]" />
            <h3 className="text-[#2d1f0e] font-semibold">Information Collected</h3>
          </div>
          <div className="px-3 py-1 rounded-lg border border-green-300 bg-green-50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">{collected} items collected</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(collectedInfo)
            .filter(([key]) => key !== 'additional_info')
            .map(([key, value]) => (
              <div key={key} className="bg-white rounded-lg p-3 border border-[rgba(116,96,62,0.15)] shadow-sm">
                <div className="text-sm text-[#74603e] font-medium mb-1">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="text-[#2d1f0e] text-sm">{value}</div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  const renderInfoProgress = (msg: Message) => {
    if (msg.messageType !== 'information_gathering') return null;
    const collected = Object.keys(msg.infoCollected || {}).length;
    const needed = (msg.infoNeeded || []).length;
    const total = collected + needed;
    if (total === 0) return null;
    return (
      <div className="mt-3 p-3 bg-[#f7f3ec] rounded-lg border border-[#c8b89a]">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-[#74603e]" />
          <span className="text-sm font-medium text-[#74603e]">Information Collection Progress</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[#8a7462]">
            <span>Collected: {collected}</span>
            <span>Remaining: {needed}</span>
          </div>
          <div className="w-full bg-[#e2dbd0] rounded-full h-2">
            <div className="bg-[#74603e] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(collected / total) * 100}%` }} />
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#ede8de] relative">

      {/* ── Decorative background ─────────────────────────── */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden" style={{ zIndex: 0, pointerEvents: 'none' }}>
        {/* Top-right brown blob */}
        <div className="fixed -top-[10%] -right-[10%] w-[50%] h-[70%] rounded-full"
          style={{ background: '#74603e38', filter: 'blur(75px)' }} />
        {/* Bottom-right amber blob */}
        <div className="fixed -bottom-[10%] right-[20%] w-[30%] h-[40%] rounded-full"
          style={{ background: '#d4812e2a', filter: 'blur(75px)' }} />
        {/* Dot-grid pattern */}
        <div className="fixed top-0 left-0 w-full h-full"
          style={{
            opacity: 0.04,
            backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />
      </div>

      {/* ── Layout (above background) ──────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden" style={{ zIndex: 1 }}>

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <div className="w-80 bg-[#e2dbd0]/90 border-r border-[#c8b89a] flex flex-col shadow-md backdrop-blur-sm">

          {/* Logo + New Chat button */}
          <div className="p-6 border-b border-[#c8b89a] bg-[#d8d0c4]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#74603e]/15 rounded-lg border border-[#c8b89a]">
                <Scale className="w-6 h-6 text-[#74603e]" />
              </div>
              <div>
                <h1 className="text-lg font-bold  text-black text-semibold">Family Law</h1>
                <p className="text-xs text-gray-600">Legal Assistant</p>
              </div>
            </div>
            <button
              onClick={createNewThread}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-900 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              New Consultation
            </button>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {threads.length === 0 ? (
              <div className="text-center text-[#8a7462] py-12 px-4">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.conversation_id}
                  onClick={() => loadThread(thread.conversation_id)}
                  className={`group p-3.5 rounded-lg cursor-pointer transition-all border ${currentThreadId === thread.conversation_id
                    ? 'bg-white border-[#74603e]/50 shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-white/60 hover:border-[#c8b89a]'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText className="w-4 h-4 text-[#74603e] flex-shrink-0" />
                        <p className="text-[#2d1f0e] font-medium text-sm truncate">
                          {thread.user_intent || 'New Case'}
                        </p>
                        {thread.has_reasoning && (
                          <span title="Has reasoning">
                            <Brain className="w-3.5 h-3.5 text-[#74603e]" />
                          </span>
                        )}
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs mb-1.5 border ${getStatusColor(thread.status)}`}>
                        {getStatusIcon(thread.status)}
                        <span>{getStatusText(thread.status)}</span>
                      </div>
                      <p className="text-[#8a7462] text-xs">
                        {new Date(thread.last_modified).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteThread(thread.conversation_id, e)}
                      className="ml-2 p-1.5 text-[#8a7462] hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Main Chat ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header */}
          <div className="bg-white border-b border-[#c8b89a] px-6 py-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-[#74603e]/10 rounded-xl border border-[#c8b89a]">
                <BookOpen className="w-5 h-5 text-[#74603e]" />
              </div>
              <div className="flex-1">
                <h2 className="text-[#2d1f0e] font-semibold text-base">AI Legal Consultation</h2>
                <p className="text-xs text-[#8a7462] mt-0.5">
                  Transparent reasoning • Precedent analysis • Step-by-step guidance
                </p>
              </div>
              {currentThreadId && (
                <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${getStatusColor(conversationStatus)}`}>
                  {getStatusIcon(conversationStatus)}
                  {getStatusText(conversationStatus)}
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

            {/* Error banner */}
            {error && (
              <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 font-medium">Error</p>
                  <p className="text-red-600 text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Welcome */}
            {messages.length === 0 && !streamingMessage && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md px-4">
                  <div className="inline-flex p-5 bg-[#74603e]/10 rounded-2xl border border-[#c8b89a] mb-5">
                    <Scale className="w-14 h-14 text-[#74603e]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#2d1f0e] mb-2">Welcome to Your Legal Assistant</h3>
                  <p className="text-[#8a7462] text-sm leading-relaxed">
                    I'll provide transparent, explainable legal advice with clear reasoning and precedent analysis.
                  </p>
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, idx) => {
              const isGatheringMessage = msg.messageType === 'information_gathering';
              const nextMessage = idx < messages.length - 1 ? messages[idx + 1] : null;
              const nextIsFinalResponse = nextMessage?.messageType === 'final_response';
              const showInfoSummaryAfter = isGatheringMessage && nextIsFinalResponse;
              const infoToDisplay = showInfoSummaryAfter ? (msg.infoCollected || infoCollected) : null;

              return (
                <React.Fragment key={idx}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className="max-w-4xl w-full">
                      <div
                        className={`rounded-2xl shadow-sm overflow-hidden border ${msg.role === 'user'
                          ? 'ml-auto max-w-2xl bg-amber-900 border-amber-950 text-white'
                          : msg.messageType === 'clarification'
                            ? 'bg-amber-50 border-amber-200 text-[#2d1f0e]'
                            : msg.messageType === 'information_gathering'
                              ? 'bg-[#f7f3ec] border-[#c8b89a] text-[#2d1f0e]'
                              : 'bg-white border-[rgba(116,96,62,0.20)] text-[#2d1f0e]'
                          }`}
                      >
                        <div className="px-5 py-4">
                          {msg.messageType === 'clarification' && (
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-200">
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Need Clarification</span>
                            </div>
                          )}
                          {msg.messageType === 'information_gathering' && (
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#c8b89a]">
                              <Info className="w-4 h-4 text-[#74603e]" />
                              <span className="text-xs font-semibold text-[#74603e] uppercase tracking-wide">Gathering Information</span>
                            </div>
                          )}
                          <div
                            dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                            className={`prose max-w-none text-sm leading-relaxed ${msg.role === 'user' ? 'prose-invert' : ''}`}
                          />
                          {renderInfoProgress(msg)}
                        </div>
                        {msg.timestamp && (
                          <div className={`px-5 py-1.5 border-t ${msg.role === 'user' ? 'border-white/10 bg-black/10' : 'border-[rgba(116,96,62,0.10)] bg-[#f7f3ec]/50'
                            }`}>
                            <p className={`text-xs ${msg.role === 'user' ? 'text-white/50' : 'text-[#8a7462]'}`}>{formatTime(msg.timestamp)}</p>
                          </div>
                        )}
                      </div>

                      {/* Reasoning Steps */}
                      {msg.messageType === 'final_response' && msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                        <div className="mt-4 space-y-2.5">
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="w-5 h-5 text-[#74603e]" />
                            <h3 className="text-[#2d1f0e] font-semibold">How I Reached This Conclusion</h3>
                          </div>
                          {msg.reasoningSteps.map((step, i) => <ReasoningStepCard key={i} step={step} index={i} />)}
                        </div>
                      )}

                      {/* Precedent Explanations */}
                      {msg.messageType === 'final_response' && msg.precedentExplanations && msg.precedentExplanations.length > 0 && (
                        <div className="mt-4 space-y-2.5">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-5 h-5 text-[#74603e]" />
                            <h3 className="text-[#2d1f0e] font-semibold">Why These Precedents Matter</h3>
                          </div>
                          {msg.precedentExplanations.map((p, i) => <PrecedentCard key={i} precedent={p} index={i} />)}
                        </div>
                      )}
                    </div>
                  </div>

                  {showInfoSummaryAfter && infoToDisplay && Object.keys(infoToDisplay).length > 0 && (
                    <div className="animate-fade-in my-4 max-w-4xl">
                      <InfoCollectedSummary collectedInfo={infoToDisplay} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Streaming message */}
            {streamingMessage && (
              <div className="flex justify-start animate-fade-in">
                <div className="max-w-3xl bg-white border border-[rgba(116,96,62,0.20)] rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4">
                    <div
                      dangerouslySetInnerHTML={{ __html: formatMessage(streamingMessage) }}
                      className="prose max-w-none text-[#2d1f0e] text-sm leading-relaxed"
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <Loader2 className="w-4 h-4 animate-spin text-[#74603e]" />
                      <span className="text-xs text-[#74603e]">Processing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sources */}
            {sources.length > 0 && !streamingMessage && (
              <div className="max-w-3xl mx-auto bg-[#f7f3ec] border border-[#c8b89a] rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-[#74603e]" />
                  <span className="text-sm font-semibold text-[#74603e]">Legal References</span>
                </div>
                <div className="space-y-2.5">
                  {sources.map((source, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3.5 border border-[rgba(116,96,62,0.15)] shadow-sm">
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noopener noreferrer"
                          className="text-[#74603e] hover:text-[#5c4b2f] font-medium flex items-center gap-2">
                          <span>{source.title}</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-[#2d1f0e] font-medium">{source.title}</span>
                      )}
                      {source.category && (
                        <span className="inline-block mt-2 px-2.5 py-0.5 bg-[#f0ebe1] text-[#74603e] text-xs rounded-full border border-[#c8b89a]">
                          {source.category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="bg-white border-t border-[#c8b89a] px-6 py-4 shadow-md">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Describe your legal situation..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 px-4 py-3 bg-[#f7f3ec] border border-[#c8b89a] rounded-xl text-[#2d1f0e] placeholder-[#8a7462] resize-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#74603e]/40 focus:border-[#74603e] transition-colors text-sm"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="px-5 py-3 bg-amber-900  text-white rounded-xl transition-colors shadow-sm font-medium flex items-center gap-2 text-sm"
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">Processing</span></>
                    : <><Send className="w-4 h-4" /><span className="hidden sm:inline">Send</span></>}
                </button>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in { animation: fade-in 0.25s ease-out; }
        `}</style>

      </div>{/* end layout wrapper */}
    </div>);
};

export default LegalAssistChat;