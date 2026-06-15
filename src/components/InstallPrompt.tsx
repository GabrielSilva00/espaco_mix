import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode() {
  return (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    // Não exibe se já está instalado como app
    if (isInStandaloneMode()) return;

    const ios = isIOS();
    setIsApple(ios);

    if (ios) {
      // iOS: exibe instrução manual após 3 segundos
      const dismissed = sessionStorage.getItem('pwa-ios-dismissed');
      if (!dismissed) {
        const t = setTimeout(() => setVisible(true), 3000);
        return () => clearTimeout(t);
      }
      return;
    }

    // Android/Desktop: aguarda o evento do browser
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem('pwa-dismissed');
      if (!dismissed) setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'dismissed') {
      localStorage.setItem('pwa-dismissed', '1');
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    if (isApple) {
      sessionStorage.setItem('pwa-ios-dismissed', '1');
    } else {
      localStorage.setItem('pwa-dismissed', '1');
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[9999]"
        >
          <div className="bg-[#111111] border border-[#d4af37]/30 rounded-2xl p-4 shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex gap-4 items-start">
            {/* Ícone */}
            <div className="w-12 h-12 rounded-xl bg-[#d4af37] rotate-0 flex items-center justify-center shrink-0 overflow-hidden">
              <span className="text-[#0a0a0a] font-bold text-xl font-serif">E</span>
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-xs tracking-wide">
                Instalar Espaço Mix
              </p>

              {isApple ? (
                <p className="text-white/50 text-[10px] mt-1 leading-relaxed normal-case tracking-normal font-normal">
                  Toque em{' '}
                  <Share className="inline w-3 h-3 text-[#d4af37]" />{' '}
                  e depois em <strong className="text-white/70">Adicionar à Tela de Início</strong>
                </p>
              ) : (
                <>
                  <p className="text-white/50 text-[10px] mt-1 leading-relaxed normal-case tracking-normal font-normal">
                    Adicione à tela inicial para acesso rápido, sem precisar abrir o navegador.
                  </p>
                  <button
                    onClick={handleInstall}
                    className="mt-3 flex items-center gap-2 bg-[#d4af37] text-[#0a0a0a] text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg hover:brightness-110 transition"
                  >
                    <Download className="w-3 h-3" />
                    Instalar
                  </button>
                </>
              )}
            </div>

            {/* Fechar */}
            <button
              onClick={handleDismiss}
              className="text-white/30 hover:text-white/70 transition shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
