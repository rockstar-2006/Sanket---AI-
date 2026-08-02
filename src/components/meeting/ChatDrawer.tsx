'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, ShieldCheck } from 'lucide-react';
import { ChatMessage } from '@/hooks/useWebRTC';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  chatMessages,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive or drawer opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim());
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-slate-900 border-l border-slate-800 text-white z-50 flex flex-col shadow-2xl transition-transform duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <h3 className="font-semibold text-base flex items-center gap-2 font-heading">
          In-Meeting Chat
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-sm">
            <p>No messages yet in this consultation.</p>
            <p className="text-xs text-slate-600 mt-1 font-body">Encrypted LiveKit room initialized.</p>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-2xl max-w-[85%] font-body ${
                msg.isSelf
                  ? 'bg-orange-500 text-white ml-auto shadow-md'
                  : 'bg-slate-800 border border-slate-700/60 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`font-bold text-xs ${msg.isSelf ? 'text-slate-100' : 'text-orange-400'}`}>
                  {msg.sender}
                </span>
                <span className="text-[10px] opacity-75">
                  {msg.timestamp}
                </span>
              </div>
              <p className="text-xs leading-relaxed break-words">{msg.text}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Security Banner & Chat Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 space-y-3">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Real-time messages sent directly via LiveKit Data.</span>
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 font-body"
          />
          <button
            type="submit"
            className="p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
