'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { storeApi } from '@/lib/api';
import {
    MessageCircle,
    X,
    Send,
    Bot,
    User,
    Copy,
    Check,
    Loader2,
    Sparkles
} from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    action?: {
        type: 'NAVIGATE' | 'SUGGEST_DESCRIPTION';
        path?: string;
        description?: string;
    };
}

export function AdminChatbot() {
    const router = useRouter();
    const { store } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Scroll to bottom whenever messages change
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const toggleChat = () => setIsOpen((prev) => !prev);

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy text', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !store || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const data = await storeApi.adminChat(store.id, {
                message: userMsg.content,
            });

            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.text,
                action: data.action,
            };

            setMessages((prev) => [...prev, botMsg]);

            // Handle NAVIGATE actions immediately if present
            if (data.action && data.action.type === 'NAVIGATE' && data.action.path) {
                setTimeout(() => {
                    router.push(data.action.path);
                    setIsOpen(false); // Optionally close chat on navigate
                }, 1500); // Small delay to let user read the message
            }

        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Sorry, I encountered an error communicating with the server. Please check your connection and try again.',
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!store) return null;

    return (
        <>
            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={toggleChat}
                    className="fixed bottom-6 right-6 p-4 rounded-full bg-primary-600 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-primary-700 transition-all duration-300 hover:scale-110 active:scale-95 animate-bounce z-50 flex items-center justify-center border border-primary-500/50"
                    aria-label="Open AI Assistant"
                >
                    <MessageCircle className="w-6 h-6" />
                </button>
            )}

            {/* Chat Window */}
            <div
                className={`fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[85vh] z-50 transition-all duration-300 ease-in-out transform ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-95 pointer-events-none'
                    }`}
            >
                <div className="w-full h-full flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <Bot className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-100 text-sm">Store Co-Pilot</h3>
                                <p className="text-xs text-slate-400">Powered by Gemini</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleChat}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-400 px-4">
                                <div className="p-4 bg-slate-800/50 rounded-full">
                                    <Sparkles className="w-8 h-8 text-indigo-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-200">How can I help you today?</p>
                                    <p className="text-sm mt-1">Ask me about your sales, navigate the dashboard, or help write product descriptions.</p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                                        }`}
                                >
                                    {/* Avatar */}
                                    <div className="flex-shrink-0 mt-1">
                                        {msg.role === 'user' ? (
                                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                                                <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                                <Bot className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Message Bubble */}
                                    <div
                                        className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'
                                            }`}
                                    >
                                        <div
                                            className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                                ? 'bg-primary-600 text-white rounded-tr-sm'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm border border-gray-200/50 dark:border-gray-700/50'
                                                }`}
                                        >
                                            {msg.content}
                                        </div>

                                        {/* Action Block Handling */}
                                        {msg.action && msg.action.type === 'SUGGEST_DESCRIPTION' && msg.action.description && (
                                            <div className="mt-2 w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 shadow-inner">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Suggested Description</span>
                                                    <button
                                                        onClick={() => copyToClipboard(msg.action!.description!, msg.id)}
                                                        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                                                    >
                                                        {copiedId === msg.id ? (
                                                            <>
                                                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                                <span className="text-emerald-400">Copied</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="w-3.5 h-3.5" />
                                                                <span>Copy</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{msg.action.description}</p>
                                            </div>
                                        )}

                                        {msg.action && msg.action.type === 'NAVIGATE' && msg.action.path && (
                                            <div className="mt-1 flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Navigating to {msg.action.path}...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Loading Indicator */}
                        {isLoading && (
                            <div className="flex gap-3 max-w-[85%]">
                                <div className="flex-shrink-0 mt-1">
                                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700/50 rounded-tl-sm flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-slate-900 border-t border-slate-800/60">
                        <form onSubmit={handleSubmit} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask your store co-pilot..."
                                disabled={isLoading}
                                className="flex-1 bg-slate-800 text-slate-100 placeholder-slate-400 rounded-xl px-4 py-3 text-sm border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600 flex items-center justify-center"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
