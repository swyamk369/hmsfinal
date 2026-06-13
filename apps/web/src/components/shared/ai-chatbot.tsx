'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage, isTextUIPart } from 'ai';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send } from 'lucide-react';

import { apiBaseUrl } from '@/lib/api-url';
import { getFirebaseIdToken } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

const API_URL = apiBaseUrl();
const PATIENT_TENANT_STORE = 'hms_portal_tenant';

function messageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('');
}

/** True when the assistant is invoking a tool (e.g. creating a support ticket). */
function hasToolActivity(message: UIMessage): boolean {
  return message.role === 'assistant' && message.parts.some((part) => part.type.startsWith('tool-'));
}

const FRIENDLY_ERROR =
  'I could not reach the HMS Assistant just now. Please check your connection and try again. If this keeps happening, raise a support ticket from the Support page.';

export function AiChatbot() {
  const { activeTenantId } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/ai/chat`,
        fetch: async (url, options) => {
          const token = await getFirebaseIdToken().catch(() => null);
          const headers = new Headers(options?.headers);
          if (token) headers.set('Authorization', `Bearer ${token}`);
          const patientTenantId =
            !activeTenantId && pathname?.startsWith('/patient') && typeof window !== 'undefined'
              ? window.localStorage.getItem(PATIENT_TENANT_STORE)
              : null;
          const tenantId = activeTenantId || patientTenantId;
          if (tenantId) headers.set('X-Tenant-Id', tenantId);
          if (pathname) headers.set('X-HMS-Path', pathname);

          return fetch(url, { ...options, headers });
        },
      }),
    [activeTenantId, pathname],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === 'submitted' || status === 'streaming';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage({ text });
  }

  if (!isOpen) {
    return (
      <button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
        onClick={() => setIsOpen(true)}
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] max-h-[80vh] bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          HMS Assistant
        </h3>
        <button
          className="h-8 w-8 text-primary-foreground hover:bg-primary/90 rounded-md flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-gray-500 mt-10">
              <p>Hi! I'm the HMS Assistant.</p>
              <p>How can I help you today?</p>
              <p className="text-xs mt-2 text-gray-400">You can ask me to raise a support ticket if you find a bug!</p>
            </div>
          ) : (
            messages.map((m) => {
              const text = messageText(m);
              // Hide assistant turns that are pure tool plumbing with no text
              // yet; the "working" indicator below covers that state.
              if (!text && m.role === 'assistant' && !hasToolActivity(m)) return null;
              return (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-gray-100 text-gray-900 rounded-bl-none'
                    }`}
                  >
                    {hasToolActivity(m) && !text ? (
                      <span className="text-gray-500 italic">Working on it (raising your support ticket)...</span>
                    ) : (
                      text
                    )}
                  </div>
                </div>
              );
            })
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 text-sm rounded-lg rounded-bl-none px-3 py-2 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg rounded-bl-none bg-gray-100 px-3 py-2 text-sm text-gray-900">
                {FRIENDLY_ERROR}
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t bg-gray-50 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-primary text-white p-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
