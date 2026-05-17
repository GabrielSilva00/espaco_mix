import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, LogOut, Ticket, X, Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function Navbar() {
  const {
    siteConfig, currentView, setCurrentView, dashboardMode, setDashboardMode,
    role, userRole, isAtLeast, isStaff, isPreviewingEvent,
    sessionUser, staffAccounts, loggedInUserId, users,
    isMobileMenuOpen, setIsMobileMenuOpen,
    isUserDropdownOpen, setIsUserDropdownOpen, userDropdownRef,
    handleLogout, showToast, pendingApprovalsCount,
    setAuthIntent, setAuthTab, isApprovedEventCreator,
  } = useApp();

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#ffffff0a]">
      <div className="max-w-7xl mx-auto px-4 md:px-10 h-16 md:h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 md:w-8 md:h-8 bg-[#d4af37] rotate-45 flex items-center justify-center overflow-hidden">
            {siteConfig.platformLogo
              ? <img src={siteConfig.platformLogo} alt="logo" className="w-full h-full object-contain -rotate-45 scale-[1.4]" />
              : <span className="text-[#0a0a0a] font-bold -rotate-45 leading-none mt-1 text-xs md:text-base">{siteConfig.platformName.charAt(0).toUpperCase()}</span>
            }
          </div>
          <span className="text-base md:text-lg font-serif tracking-widest text-[#d4af37] uppercase">{siteConfig.platformName}</span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.2em] uppercase opacity-70">
          {!isPreviewingEvent && (
            <>
              <button
                onClick={() => setCurrentView('home')}
                className={`hover:text-[#d4af37] transition-colors ${currentView === 'home' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}
              >
                Início
              </button>
              {isAtLeast('admin') && (
                <>
                  <button
                    onClick={() => { setCurrentView('dashboard'); setDashboardMode('approval-queue'); }}
                    className={`hover:text-[#d4af37] transition-colors ${currentView === 'dashboard' && dashboardMode === 'approval-queue' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}
                  >
                    Aprovações
                    {pendingApprovalsCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#d4af37] text-black text-[9px] font-black">{pendingApprovalsCount}</span>
                    )}
                  </button>
                  <button
                    onClick={() => { setCurrentView('dashboard'); setDashboardMode('staff'); }}
                    className={`hover:text-[#d4af37] transition-colors ${currentView === 'dashboard' && dashboardMode === 'staff' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}
                  >
                    Colaboradores
                  </button>
                  <button
                    onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); }}
                    className={`hover:text-[#d4af37] transition-colors ${currentView === 'dashboard' && dashboardMode === 'settings' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}
                  >
                    Configurações
                  </button>
                </>
              )}
            </>
          )}
          {role && (
            <button
              onClick={() => setCurrentView('reservations')}
              className={`hover:text-[#d4af37] transition-colors ${currentView === 'reservations' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}
            >
              Minhas Reservas
            </button>
          )}
          {!isPreviewingEvent && !isStaff && (
            <button
              onClick={() => setCurrentView('contact')}
              className={`hover:text-[#d4af37] transition-colors ${currentView === 'contact' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}
            >
              Contato
            </button>
          )}
        </div>

        {/* Desktop Auth Area */}
        <div className="hidden md:flex items-center gap-4">
          {role ? (
            userRole === 'client' ? (
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-80 transition"
                >
                  {sessionUser?.avatarUrl ? (
                    <img src={sessionUser.avatarUrl} alt="Perfil" className="w-9 h-9 rounded-full object-cover border border-[#d4af37]/30" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-[#d4af37]" />
                    </div>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">
                    {sessionUser?.name?.split(' ')[0] || 'Conta'}
                  </span>
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    <button
                      onClick={() => { setCurrentView('profile'); setIsUserDropdownOpen(false); }}
                      className="w-full px-4 py-3 text-left text-[10px] uppercase tracking-widest text-white/60 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 flex items-center gap-2"
                    >
                      <User className="w-3 h-3" /> Meu Perfil
                    </button>
                    <button
                      onClick={() => { setCurrentView('reservations'); setIsUserDropdownOpen(false); }}
                      className="w-full px-4 py-3 text-left text-[10px] uppercase tracking-widest text-white/60 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 flex items-center gap-2"
                    >
                      <Ticket className="w-3 h-3" /> Meus Ingressos
                    </button>
                    <button
                      onClick={() => { handleLogout(); setIsUserDropdownOpen(false); }}
                      className="w-full px-4 py-3 text-left text-[10px] uppercase tracking-widest text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-3 h-3" /> Sair da Conta
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <p className="text-[8px] uppercase tracking-[2px] opacity-30 font-bold leading-none mb-1">
                    {userRole === 'admin' ? 'Administrador' : userRole === 'developer' ? 'Desenvolvedor' : isStaff ? 'Colaborador' : 'Perfil'}
                  </p>
                  <p className="text-[10px] font-bold text-white/80">
                    {userRole === 'developer' ? 'Admin / Dev' : userRole === 'admin' ? 'Admin Central' : isStaff ? staffAccounts.find(s => s.id === loggedInUserId)?.name || 'Equipe' : users.find(u => u.id === loggedInUserId)?.name || 'Sua Conta'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 border border-red-500/20 text-red-500 rounded-lg hover:bg-red-500 transition duration-300 hover:text-white"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )
          ) : (
            <button
              onClick={() => { setAuthIntent('buy'); setAuthTab('login'); setCurrentView('admin-login'); }}
              className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#d4af37] border border-[#d4af37] px-4 py-2 rounded-lg hover:bg-[#d4af37] hover:text-[#0a0a0a] transition-colors"
            >
              Entrar
            </button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-lg transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-[#0d0d0d] border-b border-white/5"
          >
            <div className="flex flex-col p-2 bg-gradient-to-b from-transparent to-[#d4af37]/5">
              {!isPreviewingEvent && (
                <button
                  onClick={() => { setCurrentView('home'); setIsMobileMenuOpen(false); }}
                  className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'home' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                >
                  Início
                </button>
              )}
              {role && (
                <button
                  onClick={() => { setCurrentView('reservations'); setIsMobileMenuOpen(false); }}
                  className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'reservations' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                >
                  Minhas Reservas
                </button>
              )}
              {!isPreviewingEvent && !isStaff && (
                <button
                  onClick={() => { setCurrentView('contact'); setIsMobileMenuOpen(false); }}
                  className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'contact' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                >
                  Contato
                </button>
              )}

              {(isStaff || isApprovedEventCreator || isAtLeast('admin')) && !isPreviewingEvent && isAtLeast('admin') && (
                <>
                  <button
                    onClick={() => showToast('Em Desenvolvimento', 'info')}
                    className="py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 text-white/30 cursor-not-allowed opacity-60"
                  >
                    Aprovações KYC
                  </button>
                  <button
                    onClick={() => { setCurrentView('dashboard'); setDashboardMode('staff'); setIsMobileMenuOpen(false); }}
                    className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'dashboard' && dashboardMode === 'staff' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                  >
                    Equipe
                  </button>
                  <button
                    onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); setIsMobileMenuOpen(false); }}
                    className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'dashboard' && dashboardMode === 'settings' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                  >
                    Configurações
                  </button>
                </>
              )}

              <div className="p-6">
                {role ? (
                  userRole === 'client' ? (
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3 mb-4">
                        {sessionUser?.avatarUrl ? (
                          <img src={sessionUser.avatarUrl} alt="Perfil" className="w-10 h-10 rounded-full object-cover border border-[#d4af37]/30" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center">
                            <User className="w-5 h-5 text-[#d4af37]" />
                          </div>
                        )}
                        <p className="text-sm font-bold text-white">{sessionUser?.name?.split(' ')[0] || 'Conta'}</p>
                      </div>
                      <div className="space-y-1">
                        <button
                          onClick={() => { setCurrentView('profile'); setIsMobileMenuOpen(false); }}
                          className="w-full py-2.5 px-3 text-left text-[10px] uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <User className="w-3 h-3" /> Meu Perfil
                        </button>
                        <button
                          onClick={() => { setCurrentView('reservations'); setIsMobileMenuOpen(false); }}
                          className="w-full py-2.5 px-3 text-left text-[10px] uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Ticket className="w-3 h-3" /> Meus Ingressos
                        </button>
                        <button
                          onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                          className="w-full py-2.5 px-3 text-left text-[10px] uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <LogOut className="w-3 h-3" /> Sair da Conta
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                      <div className="flex flex-col">
                        <p className="text-[9px] uppercase tracking-[2px] opacity-40 font-bold leading-none mb-1">
                          {userRole === 'admin' ? 'Administrador' : userRole === 'developer' ? 'Desenvolvedor' : isStaff ? 'Colaborador' : 'Perfil'}
                        </p>
                        <p className="text-xs font-bold text-white">
                          {userRole === 'developer' ? 'Admin / Dev' : userRole === 'admin' ? 'Admin Central' : isStaff ? staffAccounts.find(s => s.id === loggedInUserId)?.name || 'Equipe' : users.find(u => u.id === loggedInUserId)?.name || 'Sua Conta'}
                        </p>
                      </div>
                      <button
                        onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                        className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition duration-300"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => { setCurrentView('admin-login'); setIsMobileMenuOpen(false); }}
                    className="w-full py-4 text-xs font-bold tracking-[0.1em] uppercase text-[#0a0a0a] bg-[#d4af37] rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:brightness-110 active:scale-95 transition-all"
                  >
                    Entrar na Conta
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
