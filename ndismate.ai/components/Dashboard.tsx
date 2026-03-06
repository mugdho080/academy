import React, { useState, useRef } from 'react';
import { MOCK_PLAN } from '../constants';
import { BudgetCategory, NDISPlan } from '../types';
import { BudgetOverviewChart, CategoryPieChart } from './Charts';
import Mascot from './Mascot';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { fileToGenerativePart } from '../utils/fileUtils';
import { parsePlanWithGemini } from '../utils/planParser';
import { ArrowUpTrayIcon, DocumentTextIcon, BanknotesIcon, ChatBubbleLeftRightIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';

const getCategoryStyles = (category: BudgetCategory) => {
  switch (category) {
    case BudgetCategory.CORE:
      return {
        badge: 'bg-blue-100 text-blue-700',
        border: 'border-blue-500',
      };
    case BudgetCategory.CAPACITY:
      return {
        badge: 'bg-purple-100 text-purple-700',
        border: 'border-purple-500',
      };
    case BudgetCategory.CAPITAL:
      return {
        badge: 'bg-orange-100 text-orange-700',
        border: 'border-orange-500',
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-700',
        border: 'border-slate-200',
      };
  }
};

const Dashboard: React.FC = () => {
  const [plan, setPlan] = useState<NDISPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices'>('overview');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { connect, disconnect, toggleMute, isConnected, isSpeaking, isMuted, volume, error } = useGeminiLive({
    plan: plan
  });

  const toggleVoice = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError("Please upload a valid PDF file.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const filePart = await fileToGenerativePart(file);
      const parsedData = await parsePlanWithGemini(filePart);

      // Merge with default/empty structure for safety
      const newPlan: NDISPlan = {
        participantName: parsedData.participantName || "Participant",
        ndisNumber: parsedData.ndisNumber || "Unknown",
        startDate: parsedData.startDate || new Date().toISOString().split('T')[0],
        endDate: parsedData.endDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        goals: parsedData.goals || [],
        budgets: parsedData.budgets?.map(b => ({
            ...b,
            // Ensure category matches enum, fallback to Core if AI hallucinates
            category: Object.values(BudgetCategory).includes(b.category as BudgetCategory) 
              ? b.category as BudgetCategory 
              : BudgetCategory.CORE
        })) || [],
        invoices: [] // PDF usually doesn't have structured invoices, start empty
      };

      setPlan(newPlan);
    } catch (err: any) {
      console.error("Parsing failed", err);
      setUploadError(err?.message || "Failed to analyze the plan. Please ensure it's a clear NDIS plan PDF.");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center relative overflow-hidden">
          {isUploading && (
            <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
               <p className="text-teal-800 font-bold animate-pulse">Analyzing Plan PDF...</p>
               <p className="text-slate-400 text-xs mt-2">Extracting budgets, goals, and dates</p>
            </div>
          )}

          <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <DocumentTextIcon className="w-10 h-10 text-teal-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome to NDISmate</h1>
          <p className="text-slate-500 mb-8">Upload your NDIS plan PDF. I'll read it and set up your dashboard instantly.</p>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="application/pdf" 
            className="hidden" 
          />
          
          <div 
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group" 
            onClick={triggerFileInput}
          >
            <ArrowUpTrayIcon className="w-8 h-8 text-slate-400 group-hover:text-teal-500 mx-auto mb-2 transition-colors" />
            <p className="text-sm font-medium text-slate-600 group-hover:text-teal-700">Click to upload Plan PDF</p>
            <p className="text-xs text-slate-400 mt-1">Supports standard NDIS Plan PDFs</p>
          </div>
          
          {uploadError && (
             <div className="mt-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-lg border border-rose-100">
               {uploadError}
             </div>
          )}

          <div className="mt-8 text-xs text-slate-400">
            <p>Your plan is analyzed by AI in real-time. Data is processed securely.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 md:h-screen sticky top-0 z-20">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-teal-600 tracking-tight">NDISmate<span className="text-slate-800">.ai</span></h1>
          <p className="text-xs text-slate-400 mt-1">Digital Support Coordinator</p>
        </div>
        
        <div className="p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-teal-50 text-teal-700 font-semibold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <DocumentTextIcon className="w-5 h-5" />
            Plan Overview
          </button>
          <button 
            onClick={() => setActiveTab('invoices')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'invoices' ? 'bg-teal-50 text-teal-700 font-semibold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <BanknotesIcon className="w-5 h-5" />
            Invoices & Claims
          </button>
        </div>

        <div className="p-4 mt-auto">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
             <h4 className="font-bold text-blue-900 text-sm mb-1">Plan Period</h4>
             <div className="flex justify-between text-xs text-blue-700">
               <span>Start</span>
               <span>{plan.startDate}</span>
             </div>
             <div className="flex justify-between text-xs text-blue-700 mt-1">
               <span>End</span>
               <span>{plan.endDate}</span>
             </div>
          </div>
          <button onClick={() => setPlan(null)} className="mt-4 w-full text-xs text-slate-400 hover:text-rose-500 flex items-center justify-center gap-1">
            <ArrowPathIcon className="w-3 h-3" /> Upload different plan
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Hi, {plan.participantName.split(' ')[0]} 👋</h2>
            <p className="text-slate-500">Here's what's happening with your plan today.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wide">
               Active Plan
             </div>
             <div className="text-sm text-slate-400">NDIS: {plan.ndisNumber}</div>
          </div>
        </header>

        {/* AI Assistant Section - Sticky or Prominent */}
        <section className="mb-8 bg-gradient-to-br from-blue-700 via-blue-600 to-teal-500 rounded-3xl p-6 md:p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-shrink-0">
               <Mascot volume={volume} isSpeaking={isSpeaking} isListening={isConnected && !isSpeaking && !isMuted} />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-3xl font-black mb-3">Talk to Matey</h3>
              <p className="text-blue-50 mb-8 max-w-lg text-lg opacity-90">
                I can explain your budget, suggest providers, or answer questions like "Can I use my funding for gym classes?"
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center md:justify-start">
                <div className="flex gap-3">
                  <button 
                    onClick={toggleVoice}
                    className={`flex items-center gap-3 px-8 py-4 rounded-full font-black shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${isConnected ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'}`}
                  >
                    {isConnected ? (
                      <><StopIcon className="w-6 h-6" /> End Session</>
                    ) : (
                      <><MicrophoneIcon className="w-6 h-6" /> Talk to Matey</>
                    )}
                  </button>

                  {isConnected && (
                    <button 
                      onClick={toggleMute}
                      className={`flex items-center justify-center w-14 h-14 rounded-full font-bold shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${isMuted ? 'bg-amber-500 text-white' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md'}`}
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <span className="text-2xl">🔇</span> : <MicrophoneIcon className="w-7 h-7" />}
                    </button>
                  )}
                </div>

                {isConnected && (
                  <div className={`inline-flex items-center gap-3 text-sm font-bold px-4 py-2 rounded-full transition-all backdrop-blur-sm ${isMuted ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' : 'bg-white/10 text-white border border-white/20'}`}>
                    <div className={`w-3 h-3 rounded-full ${isMuted ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`}></div>
                    {isMuted ? 'MIC MUTED' : 'MATEY IS LISTENING'}
                  </div>
                )}
              </div>
              {error && <p className="mt-4 text-rose-200 text-sm font-bold bg-rose-900/40 border border-rose-500/30 px-4 py-2 rounded-xl inline-block">{error}</p>}
            </div>
          </div>
          
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>
        </section>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                 <h4 className="text-slate-400 text-sm font-medium mb-1">Total Budget</h4>
                 <div className="text-3xl font-bold text-slate-800">
                   ${plan.budgets.reduce((sum, b) => sum + b.allocated, 0).toLocaleString()}
                 </div>
                 <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-blue-500 rounded-full"
                     style={{ width: `${plan.budgets.reduce((sum, b) => sum + b.allocated, 0) > 0 ? (plan.budgets.reduce((sum, b) => sum + b.spent, 0) / plan.budgets.reduce((sum, b) => sum + b.allocated, 0)) * 100 : 0}%` }}
                   ></div>
                 </div>
                 <p className="text-xs text-slate-500 mt-2 text-right">
                   {plan.budgets.reduce((sum, b) => sum + b.allocated, 0) > 0 
                     ? Math.round((plan.budgets.reduce((sum, b) => sum + b.spent, 0) / plan.budgets.reduce((sum, b) => sum + b.allocated, 0)) * 100) 
                     : 0}% Spent
                 </p>
               </div>
               
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                 <h4 className="text-slate-400 text-sm font-medium mb-1">Top Goal (Short-term)</h4>
                 <p className="text-slate-800 font-medium leading-relaxed">
                   "{plan.goals.find(g => g.type === 'Short-term')?.text || plan.goals[0]?.text || 'No goals extracted'}"
                 </p>
               </div>

               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                 <h4 className="text-slate-400 text-sm font-medium mb-1">Alerts</h4>
                 {plan.budgets.some(b => b.remaining < b.allocated * 0.1) ? (
                    <div className="flex items-start gap-3 mt-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-600 font-bold">!</span>
                      </div>
                      <div>
                        <p className="text-sm text-slate-700">Some budgets are running low.</p>
                      </div>
                    </div>
                 ) : (
                    <div className="flex items-start gap-3 mt-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 font-bold">✓</span>
                      </div>
                      <div>
                        <p className="text-sm text-slate-700">Budgets look healthy.</p>
                      </div>
                    </div>
                 )}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Budget Breakdown</h3>
                <BudgetOverviewChart budgets={plan.budgets} />
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Allocation by Category</h3>
                <CategoryPieChart budgets={plan.budgets} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {plan.budgets.map((budget, idx) => {
                const styles = getCategoryStyles(budget.category);
                return (
                  <div key={budget.id || idx} className={`bg-white p-6 rounded-2xl shadow-sm border-x border-b border-slate-100 border-t-4 ${styles.border} hover:shadow-md transition-shadow`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${styles.badge}`}>
                        {budget.category}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-1">{budget.name}</h4>
                    <p className="text-xs text-slate-500 h-10 overflow-hidden text-ellipsis">{budget.description}</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between">
                      <span className="text-slate-500 text-sm">Remaining</span>
                      <span className="font-bold text-teal-600 text-sm">${budget.remaining.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Invoices Tab Content */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Recent Invoices</h3>
            </div>
            <div className="p-8 text-center text-slate-400">
                <p>No invoices connected yet.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;