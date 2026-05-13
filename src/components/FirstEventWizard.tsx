import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, DollarSign, Tag, CheckCircle2, Copy, PartyPopper } from 'lucide-react';
import Confetti from 'react-confetti';

export const FirstEventWizard = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  const [isPublished, setIsPublished] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: '',
    location: '',
    batchName: 'Lote 1',
    sectorName: 'Pista',
    price: ''
  });

  const handlePublish = () => {
    setIsPublished(true);
    setTimeout(() => {
      onComplete();
    }, 6000); // Wait for confetti to finish before returning
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  if (isPublished) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-12 text-center relative max-w-2xl mx-auto mt-10">
        <Confetti recycle={false} numberOfPieces={500} gravity={0.15} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
          <div className="w-24 h-24 bg-[#d4af37]/20 rounded-full flex items-center justify-center mb-6 mx-auto">
            <PartyPopper className="w-12 h-12 text-[#d4af37]" />
          </div>
        </motion.div>
        <h2 className="text-4xl font-serif text-white mb-4">Evento Publicado!</h2>
        <p className="text-white/60 text-lg mb-8">
          Seu primeiro evento está no ar. Você já pode compartilhar o link e começar a vender e acompanhar os resultados no seu painel.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-3 rounded-xl max-w-md w-full">
            <span className="text-white/40 text-xs truncate flex-1">https://espacomix.com.br/e/{form.title.toLowerCase().replace(/\s+/g, '-')}</span>
            <button className="text-[#d4af37] hover:text-white transition p-2 bg-white/5 rounded-lg" title="Copiar link">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button onClick={onComplete} className="bg-[#d4af37] text-black px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:brightness-110 transition whitespace-nowrap">
            Ir para Dashboard
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-serif text-[#d4af37] mb-2">Primeiro Evento</h1>
        <p className="text-white/40">Siga estes passos rápidos para lançar seu evento na plataforma.</p>
      </div>

      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/10 -translate-y-1/2 z-0"></div>
        <div className="absolute top-1/2 left-0 h-[2px] bg-[#d4af37] -translate-y-1/2 z-0 transition-all duration-500" style={{ width: `${(step - 1) * 50}%` }}></div>
        
        {[1, 2, 3].map(i => (
          <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 transition-colors duration-300 ${step >= i ? 'bg-[#d4af37] text-black' : 'bg-[#1a1a1a] text-white/40 border-2 border-white/10'}`}>
            {step > i ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold text-sm">{i}</span>}
          </div>
        ))}
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl relative overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Calendar className="w-5 h-5 text-[#d4af37]" /> Informações Básicas</h2>
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Nome do Evento</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#d4af37] outline-none text-white transition" placeholder="Ex: Baile da Saudade" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Data</label>
                  <input type="datetime-local" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#d4af37] outline-none text-white transition" style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Local</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-[#d4af37] outline-none text-white transition" placeholder="Nome do local" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Tag className="w-5 h-5 text-[#d4af37]" /> Primeiro Lote e Setor</h2>
              <p className="text-xs text-white/50 mb-4">Você poderá adicionar mais setores e lotes depois no painel completo.</p>
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Nome do Setor</label>
                <input type="text" value={form.sectorName} onChange={e => setForm({...form, sectorName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#d4af37] outline-none text-white transition" placeholder="Ex: Pista, Camarote..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Nome do Lote</label>
                  <input type="text" value={form.batchName} onChange={e => setForm({...form, batchName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#d4af37] outline-none text-white transition" placeholder="Lote Promocional" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Preço (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-[#d4af37] outline-none text-white transition" placeholder="0.00" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-center py-6">
              <h2 className="text-2xl font-serif text-[#d4af37] mb-2">Tudo pronto!</h2>
              <p className="text-white/60 max-w-md mx-auto mb-8">
                Seu evento "{form.title || 'Evento'}" está configurado e pronto para ser publicado para o mundo. O processo é imediato e você já pode começar a vender.
              </p>
              
              <div className="bg-white/5 p-6 rounded-2xl max-w-sm mx-auto text-left space-y-4 mb-8">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-xs text-white/40 uppercase tracking-widest">Resumo</span>
                  <span className="text-xs text-[#d4af37]">{form.date && new Date(form.date).toLocaleDateString()}</span>
                </div>
                <div>
                  <p className="font-bold text-white text-lg">{form.title}</p>
                  <p className="text-xs text-white/50">{form.location}</p>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-white/80">{form.sectorName} ({form.batchName})</span>
                  <span className="text-white font-serif">R$ {form.price || '0.00'}</span>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 flex justify-between items-center border-t border-white/10 pt-6">
          <button onClick={prevStep} disabled={step === 1} className={`px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition ${step === 1 ? 'opacity-0 cursor-default' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
            Voltar
          </button>
          
          {step < 3 ? (
            <button onClick={nextStep} disabled={!form.title && step === 1} className="bg-[#d4af37] text-black px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:brightness-110 transition disabled:opacity-50">
              Próximo
            </button>
          ) : (
            <button onClick={handlePublish} className="bg-gradient-to-r from-[#d4af37] to-amber-600 text-black px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:brightness-110 transition shadow-[0_0_20px_rgba(212,175,55,0.3)]">
              Publicar Agora
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
