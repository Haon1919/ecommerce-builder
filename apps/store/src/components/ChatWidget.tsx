'use client';
/**
 * AI Chat Widget powered by Gemini.
 * Features:
 * - Persistent session across page navigations
 * - Action handling (product display, cart, navigation)
 * - Event planning ("Get me what I need for X event")
 * - Minimizable floating widget
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Minimize2, ShoppingCart, Mic, Square } from 'lucide-react';
import { chatApi } from '@/lib/api';
import { useCartStore } from '@/lib/cart';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: ChatAction | null;
  productRecs?: ProductRec[];
  timestamp: Date;
}

interface ChatAction {
  type: string;
  productIds?: string[];
  productId?: string;
  quantity?: number;
  page?: string;
  category?: string;
}

interface ProductRec {
  id: string;
  product?: { name: string; price: number; images: string[] };
  reason: string;
}

interface Props {
  storeId: string;
  storeName: string;
  storeSlug: string;
}

const SUGGESTIONS = [
  "What's on sale?",
  "Help me find a gift",
  "What do I need for a birthday party?",
  "Tell me about your return policy",
];

export function ChatWidget({ storeId, storeName, storeSlug }: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Add initial greeting
  useEffect(() => {
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: `Hi! I'm your personal shopping assistant for ${storeName}. I can help you find products, answer questions, or even help you plan for a specific event. What can I help you with today?`,
      timestamp: new Date(),
    }]);
  }, [storeName]);

  const handleAction = useCallback(async (action: ChatAction) => {
    switch (action.type) {
      case 'GO_TO_PAGE':
        if (action.page) router.push(`/${storeSlug}/${action.page}`);
        break;
      case 'SHOW_CATEGORY':
        if (action.category) router.push(`/${storeSlug}/products?category=${encodeURIComponent(action.category)}`);
        break;
      case 'ADD_TO_CART': {
        if (action.productId) {
          // Fetch product details
          try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stores/${storeId}/products/${action.productId}`);
            const product = await res.json();
            addItem({
              productId: product.id,
              name: product.name,
              price: Number(product.price),
              quantity: action.quantity ?? 1,
              image: product.images?.[0],
            });
          } catch { }
        }
        break;
      }
    }
  }, [router, storeSlug, storeId, addItem]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        stream.getTracks().forEach((track) => track.stop());

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Audio = base64data.split(',')[1];
          await sendMessage(undefined, { data: base64Audio, mimeType: mediaRecorder.mimeType });
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendMessage = async (text?: string, audioData?: { data: string, mimeType: string }) => {
    const content = audioData ? '🎙️ Audio message' : (text ?? input.trim());
    if ((!content && !audioData) || isLoading) return;

    if (!audioData) setInput('');
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((msgs) => [...msgs, userMsg]);
    setIsLoading(true);

    try {
      const data = await chatApi.sendMessage(storeId, audioData ? undefined : content, audioData, sessionId);
      if (!sessionId) setSessionId(data.sessionId);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        action: data.action,
        timestamp: new Date(),
      };
      setMessages((msgs) => [...msgs, assistantMsg]);

      // Handle action
      if (data.action) {
        await handleAction(data.action);
        // If SHOW_PRODUCTS, fetch and attach
        if (data.action.type === 'SHOW_PRODUCTS' && data.action.productIds?.length) {
          const products = await Promise.allSettled(
            data.action.productIds.map((id: string) =>
              fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stores/${storeId}/products/${id}`).then((r) => r.json())
            )
          );
          const recs: ProductRec[] = data.action.productIds.map((id: string, i: number) => ({
            id,
            product: products[i].status === 'fulfilled' ? products[i].value : null,
            reason: '',
          }));
          setMessages((msgs) => msgs.map((m) => m.id === assistantMsg.id ? { ...m, productRecs: recs } : m));
        }
      }

      if (!isOpen || isMinimized) {
        setUnreadCount((c) => c + 1);
      }
    } catch {
      setMessages((msgs) => [...msgs, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const openChat = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
  };

  return (
    <>
      {/* Floating button */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={openChat}
          aria-label="Open AI Chat Assistant"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl text-white flex items-center justify-center hover:scale-110 transition-transform"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat window */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-slide-in">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, black))` }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">{storeName} Assistant</p>
                <p className="text-xs text-white/70">AI-powered • Instant replies</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <Minimize2 className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user'
                  ? 'text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                  }`} style={msg.role === 'user' ? { backgroundColor: 'var(--primary)' } : {}}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Product recommendations */}
                  {msg.productRecs && msg.productRecs.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.productRecs.filter((r) => r.product).map((rec) => (
                        <div key={rec.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100">
                          {rec.product?.images?.[0] && (
                            <img src={rec.product.images[0]} alt={rec.product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{rec.product?.name}</p>
                            <p className="text-xs text-gray-500">${Number(rec.product?.price).toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => addItem({ productId: rec.id, name: rec.product!.name, price: Number(rec.product!.price), quantity: 1, image: rec.product!.images?.[0] })}
                            className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-primary/10"
                            style={{ color: 'var(--primary)' }}
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)', animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)', animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-100 bg-white flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask me anything..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
              disabled={isLoading}
            />
            {isRecording ? (
              <button
                onClick={stopRecording}
                aria-label="Stop Voice Input"
                className="w-9 h-9 rounded-xl text-white flex items-center justify-center transition-opacity flex-shrink-0 bg-red-500 animate-pulse"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={isLoading}
                aria-label="Voice Input"
                className="w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center disabled:opacity-50 transition-colors flex-shrink-0"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center disabled:opacity-50 transition-opacity flex-shrink-0"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center pb-2 text-xs text-gray-400">Powered by Gemini AI</div>
        </div>
      )}
    </>
  );
}
