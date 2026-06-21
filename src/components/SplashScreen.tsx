import { useEffect } from 'react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  // Remove o splash HTML inline (index.html) assim que o React monta
  useEffect(() => {
    const htmlSplash = document.getElementById('html-splash');
    if (htmlSplash) {
      htmlSplash.style.opacity = '0';
      setTimeout(() => htmlSplash.remove(), 400);
    }
  }, []);
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0a]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Glow de fundo */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 1.2], opacity: [0, 0.8, 0] }}
        transition={{ duration: 2.2, ease: 'easeOut', times: [0, 0.5, 1] }}
      />

      {/* Logo container */}
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 0.8,
          ease: [0.16, 1, 0.3, 1], // spring-like
        }}
        onAnimationComplete={() => {
          // Aguarda um momento após a animação finalizar antes de sair
          setTimeout(onComplete, 1200);
        }}
      >
        {/* Logo */}
        <motion.img
          src="/logo-splash.png"
          alt="Espaço Mix"
          className="w-56 h-56 md:w-72 md:h-72 object-contain drop-shadow-[0_0_40px_rgba(212,175,55,0.3)]"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
        />

        {/* Linha dourada decorativa */}
        <motion.div
          className="h-[1px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mt-4"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 160, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
        />
      </motion.div>
    </motion.div>
  );
}
