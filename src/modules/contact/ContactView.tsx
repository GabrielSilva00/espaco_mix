import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WHATSAPP_LINK } from '../../shared/constants/app';

export function ContactView() {
  const { setCurrentView } = useApp();

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 mt-12 mb-20">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-10 h-10 border border-[#d4af37]/30 bg-[#d4af37]/10 flex items-center justify-center rounded-full">
          <MessageCircle className="w-5 h-5 text-[#d4af37]" />
        </div>
        <div>
          <h1 className="text-xl font-serif text-[#d4af37]">Central de Atendimento</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">Como podemos ajudar você hoje?</p>
        </div>
      </div>

      <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-12 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#d4af37] opacity-[0.03] blur-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full" />

        <div className="relative z-10">
          <h2 className="text-xl md:text-2xl font-serif text-white mb-4 md:mb-6">Suporte ao Cliente</h2>
          <p className="text-sm md:text-base opacity-60 mb-8 md:mb-10 max-w-md mx-auto leading-relaxed">
            Caso você queira entrar em contato com o suporte ou tirar dúvidas sobre o evento, nossa equipe está disponível via WhatsApp para um atendimento ágil.
          </p>

          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center min-h-[48px] gap-3 px-8 bg-[#25D366] text-white rounded-xl md:rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs hover:brightness-110 hover:shadow-[0_0_25px_rgba(37,211,102,0.3)] transition-all transform hover:-translate-y-1 w-full sm:w-auto"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            Conversar com suporte
          </a>

          <div className="mt-10 md:mt-12 pt-8 md:pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-left">
            <div>
              <h4 className="text-[10px] uppercase tracking-widest text-[#d4af37] mb-2 font-bold">Horário de Atendimento</h4>
              <p className="text-xs opacity-50">Segunda a Sexta: 09:00 às 18:00</p>
              <p className="text-xs opacity-50">Sábado: 10:00 às 14:00</p>
            </div>
            <div>
              <h4 className="text-[10px] uppercase tracking-widest text-[#d4af37] mb-2 font-bold">E-mail Corporativo</h4>
              <p className="text-xs opacity-50 underline">suporte@espacomix.com.br</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setCurrentView('booking')}
        className="w-full mt-6 md:mt-8 min-h-[48px] border border-white/10 rounded-xl md:rounded-full text-[10px] md:text-xs uppercase tracking-widest text-white/40 hover:bg-white/5 hover:text-white transition"
      >
        Retornar ao Evento
      </button>
    </div>
  );
}
