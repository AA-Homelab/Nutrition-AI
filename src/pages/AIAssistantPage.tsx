import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  User as UserIcon,
  Send,
  Sparkles,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Plus,
  RefreshCw,
  Info,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { DailyNutritionSummary, MealType } from '../types.ts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export const AIAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        `Hello ${user?.display_name?.split(' ')[0] || 'there'}! I'm your AI Nutrition Assistant powered by Gemini. I can help you plan meals that fit your remaining calorie and macro targets, brainstorm high-protein snacks, or answer any diet questions. How can I support your nutrition goals today?`,
      time: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    'High Protein Meal',
    'Dinner Under 700 Calories',
    'Breakfast Ideas',
    'Low Calorie Snack',
    'Use My Remaining Macros',
  ];

  const fetchTodayData = async () => {
    try {
      const data = await api.getDashboard();
      setSummary(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTodayData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputText).trim();
    if (!message || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await api.sendAIChat(message, historyPayload);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content:
          'I apologize, but I encountered an error connecting to the AI service. Please try again shortly.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="ai-assistant-view" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gemini Pro Nutritionist</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          AI Nutrition Assistant
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Context-aware guidance synchronized in real-time with your daily calorie and macronutrient targets.
        </p>
      </div>

      {/* Top Banner: Today's Remaining Nutrition Context */}
      {summary && (
        <div id="ai-context-banner" className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
              Live Daily Budget Context (Today)
            </span>
            <span className="text-[11px] text-slate-400">Fed directly to Gemini</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10">
              <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-semibold">Calories</span>
              </div>
              <div className="text-xl font-black">{summary.calories.remaining}</div>
              <span className="text-[10px] text-slate-300">kcal remaining</span>
            </div>

            <div className="p-3 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10">
              <div className="flex items-center justify-center space-x-1 text-blue-400 mb-1">
                <Beef className="w-4 h-4" />
                <span className="text-xs font-semibold">Protein</span>
              </div>
              <div className="text-xl font-black">{summary.protein.remaining}g</div>
              <span className="text-[10px] text-slate-300">remaining</span>
            </div>

            <div className="p-3 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10">
              <div className="flex items-center justify-center space-x-1 text-amber-400 mb-1">
                <Wheat className="w-4 h-4" />
                <span className="text-xs font-semibold">Carbs</span>
              </div>
              <div className="text-xl font-black">{summary.carbohydrates.remaining}g</div>
              <span className="text-[10px] text-slate-300">remaining</span>
            </div>

            <div className="p-3 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10">
              <div className="flex items-center justify-center space-x-1 text-rose-400 mb-1">
                <Droplet className="w-4 h-4" />
                <span className="text-xs font-semibold">Fat</span>
              </div>
              <div className="text-xl font-black">{summary.fat.remaining}g</div>
              <span className="text-[10px] text-slate-300">remaining</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Prompt Chips */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Quick Prompts</p>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(chip)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[520px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={index}
                className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isUser ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
                  }`}
                >
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-2xs whitespace-pre-wrap leading-relaxed ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-xs'
                  }`}
                >
                  <p>{msg.content}</p>
                  <div
                    className={`text-[10px] mt-1.5 font-medium ${
                      isUser ? 'text-emerald-100 text-right' : 'text-slate-400'
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 text-sm flex items-center space-x-2 text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Gemini is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              id="ai-chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask a question or request a customized recipe..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs disabled:opacity-50"
            />
            <button
              type="submit"
              id="btn-send-chat"
              disabled={isLoading || !inputText.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-2 text-center">
            <span className="text-[10px] text-slate-400">
              AI recommendations are for informational purposes only. Consult with a qualified healthcare professional or dietitian for clinical guidance.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
