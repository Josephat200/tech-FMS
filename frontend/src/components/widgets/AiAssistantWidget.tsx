import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { assistantApi, AssistantHistoryItem } from '../../api/assistantApi';

type Message = {
  role: 'assistant' | 'user';
  text: string;
};

function createReply(input: string, route: string): string {
  const text = input.toLowerCase();

  if (text.includes('explain') || text.includes('what is') || text.includes('define')) {
    return 'I can explain that clearly. Share the exact topic and I will break it into definition, how it works, practical example, and key takeaways.';
  }

  if (text.includes('compare') || text.includes('difference')) {
    return 'I can compare them for you using differences, pros/cons, best use cases, and a recommendation.';
  }

  if (text.includes('write') || text.includes('email') || text.includes('message') || text.includes('proposal')) {
    return 'I can draft that. Tell me audience, tone, and objective, and I will generate a complete draft plus a concise version.';
  }

  if (text.includes('code') || text.includes('bug') || text.includes('debug')) {
    return 'I can help debug it. Provide the code, expected output, and current error, and I will give a direct fix and explanation.';
  }

  if (text.includes('math') || text.includes('calculate') || /\d+\s*[+\-*/]/.test(text)) {
    return 'I can solve calculations step by step. Share the full expression and I will compute and verify it.';
  }

  if (text.includes('print')) {
    return 'Use the Print button on the current page, then choose printer or Save as PDF. The print view hides navigation and widgets automatically.';
  }

  if (route.includes('reports') || text.includes('report') || text.includes('analysis')) {
    return 'For fast analysis, compare cashflow against net income trend and watch bars with sudden drops or spikes. Export monthly snapshots for audit packs.';
  }

  if (route.includes('invoices') || text.includes('invoice')) {
    return 'Prioritize pending invoices near due date and review AR/AP balance daily. Aged receivables above 30 days should be escalated to collections workflow.';
  }

  if (route.includes('ledger') || text.includes('ledger') || text.includes('journal')) {
    return 'For ledger review, reconcile debits and credits by period, then inspect unusual entries with round amounts or weekend posting timestamps.';
  }

  if (route.includes('payroll') || text.includes('payroll')) {
    return 'Payroll checks: verify gross-to-net variance, tax deductions, and approval status before final run. Use monthly trend charts to spot anomalies.';
  }

  if (route.includes('budgets') || text.includes('budget')) {
    return 'Track variance % by department and focus on categories above 5% over plan. Pair variance with month-over-month spend growth to predict risk.';
  }

  if (text.includes('password') || text.includes('login')) {
    return 'Admins can reset other users passwords from Settings. After reset, users should sign in again with the new password.';
  }

  return 'I can help with system workflows and general questions on many topics. Ask your exact question and I will provide a direct answer.';
}

export function AiAssistantWidget() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
        text: 'AI Assistant ready. Ask any question and I will help across financial workflows, technical tasks, writing, and general knowledge.',
    },
  ]);

  const quickPrompts = useMemo(
    () => [
      'How do I print this page?',
      'What should I check in this report?',
      'Help me with a task step by step',
    ],
    [],
  );

  useEffect(() => {
    if (!isOpen || historyLoaded) {
      return;
    }

    const loadHistory = async () => {
      try {
        const response = await assistantApi.history(12);
        const history = [...response.data]
          .reverse()
          .flatMap((item: AssistantHistoryItem) => [
            { role: 'user' as const, text: item.prompt },
            { role: 'assistant' as const, text: item.response },
          ]);

        if (history.length > 0) {
          setMessages((prev) => [prev[0], ...history]);
        }
      } catch {
        // Do not block the assistant if history retrieval fails.
      } finally {
        setHistoryLoaded(true);
      }
    };

    void loadHistory();
  }, [historyLoaded, isOpen]);

  const submitPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setDraft('');

    setIsSending(true);
    try {
      const response = await assistantApi.ask({ prompt: trimmed, route: location.pathname });
      setMessages((prev) => [...prev, { role: 'assistant', text: response.data.answer }]);
    } catch {
      const fallback = createReply(trimmed, location.pathname);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: fallback,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitPrompt(draft);
  };

  return (
    <div className="assistant-widget no-print">
      {isOpen && (
        <section className="assistant-panel card">
          <header className="assistant-header">
            <strong>AI Assistant</strong>
            <button className="btn ghost" type="button" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </header>

          <div className="assistant-messages">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`assistant-msg ${message.role}`}>
                {message.text}
              </div>
            ))}
          </div>

          <div className="assistant-prompts">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                className="btn ghost"
                type="button"
                onClick={() => void submitPrompt(prompt)}
                disabled={isSending}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form className="assistant-form" onSubmit={onSubmit}>
            <input
              className="input"
              placeholder="Ask the assistant..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={isSending}
            />
            <button className="btn primary" type="submit" disabled={isSending}>
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </section>
      )}

      {!isOpen && (
        <button className="btn primary assistant-open" type="button" onClick={() => setIsOpen(true)}>
          Open AI Assistant
        </button>
      )}
    </div>
  );
}
