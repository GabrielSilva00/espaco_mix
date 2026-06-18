import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, LogOut, Ticket, X, Menu, Home, Phone, CalendarDays, ShoppingCart } from 'lucide-react';
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
    reservations, cartSelection,
  } = useApp();

  // Conta as reservas pendentes (banco) + a seleção local em andamento (item
  // virtual), para o badge refletir a seleção imediatamente — inclusive no mobile.
  const cartCount = reservations.filter(r => r.paymentStatus === 'pending').length
    + (cartSelection ? 1 : 0);

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#ffffff0a]">
        <div className="max-w-7xl mx-auto px-4 md:px-10 h-16 md:h-20 flex items-center justify-between">

          {/* Logo */}
          <button
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img
              src={siteConfig.platformLogo || '/logo-full.png'}
              alt={siteConfig.platformName || 'Espaço Mix'}
              className="h-10 md:h-12 w-auto object-contain"
            />
          </button>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4 lg:gap-8 text-[11px] tracking-[0.2em] uppercase opacity-70">
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
            {role && userRole === 'client' && (
              <button
                onClick={() => setCurrentView('cart')}
                className={`relative flex items-center gap-1.5 hover:text-[#d4af37] transition-colors ${currentView === 'cart' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}
              >
                <ShoppingCart className="w-4 h-4" /> Carrinho
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-[#d4af37] text-black text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{cartCount}</span>
                )}
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
                  <AnimatePresence>
                    {isUserDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                    aria-label="Sair da conta"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={() => { setAuthIntent('buy'); setAuthTab('login'); setCurrentView('admin-login'); }}
                title="Acesso Simples — entrar na sua conta de cliente"
                className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#d4af37] border border-[#d4af37] px-4 py-2 rounded-lg hover:bg-[#d4af37] hover:text-[#0a0a0a] transition-colors"
              >
                Entrar
              </button>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isMobileMenuOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isMobileMenuOpen
                ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-6 h-6" /></motion.span>
                : <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="w-6 h-6" /></motion.span>
              }
            </AnimatePresence>
          </button>
        </div>
      </nav>

      {/* ═══ MOBILE MENU — bottom sheet ═══ */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0d0d0d] rounded-t-3xl border-t border-[#ffffff0a] overflow-hidden"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              {/* User info */}
              {role ? (
                userRole === 'client' ? (
                  <div className="px-5 pt-3 pb-4 flex items-center gap-3 border-b border-white/5">
                    {sessionUser?.avatarUrl
                      ? <img src={sessionUser.avatarUrl} alt="Perfil" className="w-10 h-10 rounded-full object-cover border border-[#d4af37]/30 shrink-0" />
                      : (
                        <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-[#d4af37]" />
                        </div>
                      )
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{sessionUser?.name || 'Minha Conta'}</p>
                      <p className="text-[10px] text-white/40 truncate">{sessionUser?.email || ''}</p>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 pt-3 pb-4 flex items-center justify-between border-b border-white/5">
                    <div>
                      <p className="text-[9px] uppercase tracking-[2px] text-[#d4af37]/50 font-bold mb-0.5">
                        {userRole === 'admin' ? 'Administrador' : userRole === 'developer' ? 'Desenvolvedor' : isStaff ? 'Colaborador' : 'Produtor'}
                      </p>
                      <p className="text-sm font-bold text-white">
                        {userRole === 'developer' ? 'Admin / Dev' : userRole === 'admin' ? 'Admin Central' : isStaff ? staffAccounts.find(s => s.id === loggedInUserId)?.name || 'Equipe' : users.find(u => u.id === loggedInUserId)?.name || 'Sua Conta'}
                      </p>
                    </div>
                    <button
                      onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                      className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )
              ) : null}

              {/* Nav links */}
              <div className="px-3 py-3 space-y-1">

                {!isPreviewingEvent && (
                  <SheetItem
                    icon={<Home className="w-4 h-4" />}
                    label="Início"
                    active={currentView === 'home'}
                    onClick={() => { setCurrentView('home'); setIsMobileMenuOpen(false); }}
                  />
                )}

                {role && userRole === 'client' && (
                  <SheetItem
                    icon={<ShoppingCart className="w-4 h-4" />}
                    label={cartCount > 0 ? `Carrinho (${cartCount})` : 'Carrinho'}
                    active={currentView === 'cart'}
                    onClick={() => { setCurrentView('cart'); setIsMobileMenuOpen(false); }}
                  />
                )}

                {role && userRole === 'client' && (
                  <SheetItem
                    icon={<Ticket className="w-4 h-4" />}
                    label="Meus Ingressos"
                    active={currentView === 'reservations'}
                    onClick={() => { setCurrentView('reservations'); setIsMobileMenuOpen(false); }}
                  />
                )}

                {role && userRole === 'client' && (
                  <SheetItem
                    icon={<User className="w-4 h-4" />}
                    label="Meu Perfil"
                    active={currentView === 'profile'}
                    onClick={() => { setCurrentView('profile'); setIsMobileMenuOpen(false); }}
                  />
                )}

                {!isPreviewingEvent && !isStaff && (
                  <SheetItem
                    icon={<Phone className="w-4 h-4" />}
                    label="Contato"
                    active={currentView === 'contact'}
                    onClick={() => { setCurrentView('contact'); setIsMobileMenuOpen(false); }}
                  />
                )}

                {isAtLeast('admin') && !isPreviewingEvent && (
                  <>
                    <div className="h-px bg-white/5 my-2" />
                    <SheetItem
                      icon={<CalendarDays className="w-4 h-4" />}
                      label="Aprovações"
                      badge={pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined}
                      active={currentView === 'dashboard' && dashboardMode === 'approval-queue'}
                      onClick={() => { setCurrentView('dashboard'); setDashboardMode('approval-queue'); setIsMobileMenuOpen(false); }}
                    />
                  </>
                )}

              </div>

              {/* Login button (não logado) */}
              {!role && (
                <div className="px-5 pb-4">
                  <button
                    onClick={() => { setCurrentView('admin-login'); setIsMobileMenuOpen(false); }}
                    className="w-full py-4 text-sm font-bold tracking-[0.1em] uppercase text-[#0a0a0a] bg-[#d4af37] rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:brightness-110 active:scale-95 transition-all"
                  >
                    Entrar na Conta
                  </button>
                </div>
              )}

              {/* Logout (cliente logado) */}
              {role && userRole === 'client' && (
                <div className="px-5 pb-4">
                  <button
                    onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                    className="w-full py-3.5 text-xs font-bold tracking-[0.1em] uppercase text-red-400 border border-red-500/20 rounded-2xl hover:bg-red-500/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sair da Conta
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Componentes internos ─── */

function SheetItem({
  icon, label, active, badge, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors ${
        active
          ? 'bg-[#d4af37]/10 text-[#d4af37]'
          : 'text-white/60 hover:bg-white/5 hover:text-white active:bg-white/10'
      }`}
    >
      <span className={active ? 'text-[#d4af37]' : 'text-white/40'}>{icon}</span>
      <span className="text-sm font-medium flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="px-2 py-0.5 rounded-full bg-[#d4af37] text-black text-[9px] font-black">{badge}</span>
      )}
    </button>
  );
}
