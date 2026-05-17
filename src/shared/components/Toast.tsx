import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function Toast() {
  const { actionToast } = useApp();

  return (
    <AnimatePresence>
      {actionToast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl text-[11px] font-bold uppercase tracking-widest backdrop-blur-md border max-w-xs md:max-w-sm text-center"
          style={{
            background: actionToast.type === 'success'
              ? 'rgba(16,185,129,0.15)'
              : actionToast.type === 'error'
                ? 'rgba(239,68,68,0.15)'
                : actionToast.type === 'warning'
                  ? 'rgba(245,158,11,0.15)'
                  : 'rgba(212,175,55,0.15)',
            borderColor: actionToast.type === 'success'
              ? 'rgba(16,185,129,0.3)'
              : actionToast.type === 'error'
                ? 'rgba(239,68,68,0.3)'
                : actionToast.type === 'warning'
                  ? 'rgba(245,158,11,0.3)'
                  : 'rgba(212,175,55,0.3)',
            color: actionToast.type === 'success'
              ? '#10b981'
              : actionToast.type === 'error'
                ? '#ef4444'
                : actionToast.type === 'warning'
                  ? '#f59e0b'
                  : '#d4af37',
          }}
        >
          {actionToast.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
          {actionToast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
          {actionToast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {actionToast.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
          {actionToast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
