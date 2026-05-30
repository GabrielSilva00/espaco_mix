import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { X, RefreshCcw, ShieldAlert } from 'lucide-react';

interface SessionRestoredNotificationProps {
  isVisible: boolean;
  sessionConflict: string[];
  onClose: () => void;
}

/**
 * Componente para exibir notificação de sessão restaurada
 * Com auto-dismiss de 5 segundos e botão de fechar funcional
 */
export function SessionRestoredNotification({
  isVisible,
  sessionConflict,
  onClose,
}: SessionRestoredNotificationProps) {
  useEffect(() => {
    if (!isVisible) return;

    // Auto-dismiss após 5 segundos
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    // Cleanup para evitar memory leaks
    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 20, x: '-50%' }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md"
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${sessionConflict.length > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
            {sessionConflict.length > 0 ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <RefreshCcw className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#d4af37]">
              {sessionConflict.length > 0 ? 'Conflito de Disponibilidade' : 'Sessão Restaurada'}
            </h4>
            <p className="text-[10px] opacity-60 leading-relaxed mt-0.5">
              {sessionConflict.length > 0
                ? `Notamos que ${sessionConflict.join(', ')} não estão mais disponíveis e foram removidos.`
                : 'Recuperamos o seu checkout anterior para sua conveniência.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center transition opacity-40 hover:opacity-100 flex-shrink-0"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
