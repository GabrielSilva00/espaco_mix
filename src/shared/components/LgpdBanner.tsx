import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';

export function LgpdBanner() {
  const { showLgpdBanner, acceptLgpd } = useApp();

  return (
    <AnimatePresence>
      {showLgpdBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0d0d0d] border-t border-white/10 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl"
        >
          <p className="text-[10px] text-white/50 uppercase tracking-widest text-center sm:text-left">
            Usamos cookies e tecnologias para melhorar sua experiência. Ao continuar, você concorda com nossa{' '}
            <a href="/api/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#d4af37] underline hover:brightness-110">
              Política de Privacidade
            </a>{' '}
            (LGPD).
          </p>
          <button
            onClick={acceptLgpd}
            className="shrink-0 bg-[#d4af37] text-[#0a0a0a] px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition"
          >
            Aceitar e Continuar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
