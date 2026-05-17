import React from 'react';
import { useApp } from '../../context/AppContext';

export function ProfileView() {
  const { sessionUser, loggedInUserId, userRole, setCurrentView, setDashboardMode } = useApp();

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 mt-12 mb-20">
      <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 md:p-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-serif text-[#d4af37]">Meu Perfil</h1>
          <button
            onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); }}
            className="px-4 py-2 border border-white/10 rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/5 transition"
          >
            Voltar
          </button>
        </div>
        <div className="space-y-4 text-sm">
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Nome</p>
            <p className="text-white">{sessionUser?.name || 'Usuário'}</p>
          </div>
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">E-mail</p>
            <p className="text-white">{sessionUser?.email || '-'}</p>
          </div>
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Perfil</p>
            <p className="text-white">{userRole || 'client'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
