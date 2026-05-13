import React, { useState } from 'react';
import { PlusCircle, Calendar, Users, DollarSign, ExternalLink, ArrowRight, CheckCircle2, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FirstEventWizard } from './FirstEventWizard';

export const ProducerDashboard = () => {
  const [showConfetti, setShowConfetti] = useState(true); // Control flow for first login
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  if (isCreatingEvent) {
    return (
      <div className="w-full relative z-10 animate-in slide-in-from-right duration-500">
        <FirstEventWizard onComplete={() => setIsCreatingEvent(false)} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 relative z-10">
      
      {/* Welcome Banner (Post Approval First State) */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-r from-[#d4af37] to-amber-600 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.2)]">
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none opacity-50 bg-[url('https://cdn.pixabay.com/photo/2021/09/12/08/49/confetti-6617637_1280.png')] bg-cover mix-blend-screen"></div>
        )}
        <div className="relative z-10 text-black max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
            <CheckCircle2 className="w-3 h-3" /> Conta Verificada
          </div>
          <h1 className="text-3xl md:text-5xl font-serif mb-4 text-black">Bem-vindo ao Espaço Mix! Seu cadastro foi aprovado.</h1>
          <p className="text-black/80 text-sm md:text-base leading-relaxed mb-6 font-medium">
            Você já pode publicar eventos, configurar lotes e iniciar suas vendas. A melhor experiência em gestão de eventos foca no que importa: o seu público. Nós cuidamos do resto.
          </p>
          <button onClick={() => setIsCreatingEvent(true)} className="bg-black text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#1a1a1a] transition shadow-2xl flex items-center gap-2 group">
            <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition duration-300" /> Crie seu primeiro evento
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content - Empty State Events */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[400px]">
             <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
               <Ticket className="w-10 h-10 text-white/20" />
             </div>
             <h3 className="text-2xl font-serif text-white mb-2">Comece por aqui</h3>
             <p className="text-white/50 max-w-md mx-auto text-sm mb-8">
               Seu painel está vazio porque você ainda não realizou nenhum evento. Vamos mudar isso? A criação do evento leva menos de 2 minutos.
             </p>
             <div className="flex gap-4">
               <button onClick={() => setIsCreatingEvent(true)} className="bg-[#d4af37] text-black px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:brightness-110 transition shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                 Criar Evento
               </button>
             </div>
          </div>
        </div>

        {/* Sidebar - Checklist & Quick Stats */}
        <div className="space-y-6">
          
          {/* Primeros Passos Checklist */}
          <div className="bg-[#0a0a0a] border border-[#d4af37]/30 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37] opacity-5 blur-3xl rounded-full pointer-events-none"></div>
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37] mb-6">Guia de Início Rápido</h3>
            
            <div className="space-y-4">
              {[
                { label: 'Perfil de Organizador', done: true },
                { label: 'Identidade e Banco Validados', done: true },
                { label: 'Crie seu primeiro Evento', done: false, active: true },
                { label: 'Configure seus lotes', done: false },
                { label: 'Publique e Compartilhe', done: false },
              ].map((item, idx) => (
                <div key={idx} className={`flex items-start gap-3 ${item.done ? 'opacity-50' : 'opacity-100'}`}>
                  <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${item.done ? 'border-[#d4af37] bg-[#d4af37]' : item.active ? 'border-[#d4af37]' : 'border-white/20'}`}>
                    {item.done && <CheckCircle2 className="w-3 h-3 text-black" />}
                    {!item.done && item.active && <div className="w-2 h-2 rounded-full bg-[#d4af37]"></div>}
                  </div>
                  <p className={`text-xs ${item.done ? 'line-through text-white/50' : item.active ? 'text-white font-bold' : 'text-white/70'}`}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 w-full bg-white/5 h-2 rounded-full overflow-hidden">
               <div className="bg-[#d4af37] w-2/5 h-full"></div>
            </div>
            <p className="text-[10px] text-white/40 mt-2 text-center uppercase tracking-widest">40% Concluído</p>
          </div>

          {/* Quick Stats (Zero State) */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/50 mb-6">Métricas (Últimos 30 dias)</h3>
            <div className="space-y-6">
              <div>
                <p className="text-white/40 text-xs flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4" /> Vendas Brutas</p>
                <p className="text-2xl font-serif">R$ 0,00</p>
              </div>
              <div>
                <p className="text-white/40 text-xs flex items-center gap-2 mb-1"><Users className="w-4 h-4" /> Ingressos Vendidos</p>
                <p className="text-2xl font-serif">0</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
