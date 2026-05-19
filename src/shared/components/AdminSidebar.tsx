import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye, Calendar as CalendarIcon, PlusCircle, Users, ShieldCheck, BarChart3,
  LinkIcon, Bell, AlertCircle, Code2, Settings, User, LogOut, ChevronLeft,
  ChevronRight, X, Menu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function AdminSidebar() {
  const {
    siteConfig, isAdminSidebarCollapsed, setIsAdminSidebarCollapsed,
    isMobileMenuOpen, setIsMobileMenuOpen, currentView, dashboardMode,
    setCurrentView, setDashboardMode, userRole, isAtLeast, isStaff,
    staffAccounts, loggedInUserId, users, formEvent, handleCreateEvent,
    handleLogout, showToast, pendingApprovalsCount,
  } = useApp();

  const navClass = (active: boolean) =>
    `nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group ${
      active ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'
    }`;

  const iconClass = (active: boolean) =>
    `w-5 h-5 shrink-0 ${active ? 'text-[#d4af37]' : 'text-white/40 group-hover:text-white'}`;

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed md:relative top-0 left-0 h-screen bg-[#0d0d0d] border-r border-[#ffffff0a] z-50 flex flex-col transition-[width,transform] duration-200 ease-in-out ${isAdminSidebarCollapsed ? 'w-[80px] md:w-[80px]' : 'w-[280px]'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Header */}
        <div className={`h-20 flex items-center ${isAdminSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-6'} border-b border-[#ffffff0a]`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-[#d4af37] rotate-45 flex items-center justify-center shrink-0 overflow-hidden">
              {siteConfig.platformLogo
                ? <img src={siteConfig.platformLogo} alt="logo" className="w-full h-full object-contain -rotate-45 scale-[1.4]" />
                : <span className="text-[#0a0a0a] font-bold -rotate-45 leading-none mt-1 text-base">{siteConfig.platformName.charAt(0).toUpperCase()}</span>
              }
            </div>
            {!isAdminSidebarCollapsed && <span className="text-lg font-display tracking-widest text-[#d4af37] uppercase whitespace-nowrap animate-in fade-in">{siteConfig.platformName}</span>}
          </div>
          <button
            onClick={() => setIsAdminSidebarCollapsed(!isAdminSidebarCollapsed)}
            className={`hidden md:flex text-white/40 hover:text-white transition ${isAdminSidebarCollapsed ? 'absolute right-[-14px] top-6 bg-[#0d0d0d] border border-white/10 rounded-full p-1' : ''}`}
          >
            {isAdminSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-white/40 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar ${isAdminSidebarCollapsed ? 'py-6 px-3' : 'py-6 px-4'} space-y-8`}>
          <div className="mb-4">
            <button
              onClick={() => setCurrentView('home')}
              className={`w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group border border-[#d4af37]/30 text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/10`}
              title={isAdminSidebarCollapsed ? 'Visualizar Site' : ''}
            >
              <Eye className="w-5 h-5 shrink-0 text-[#d4af37]" />
              {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Ver Site (Público)</span>}
            </button>
          </div>

          {/* Eventos */}
          <div>
            {!isAdminSidebarCollapsed && <h4 className="px-2 text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-3">Eventos</h4>}
            <div className="space-y-1">
              <button
                onClick={() => { setCurrentView('dashboard'); setDashboardMode('list'); setIsMobileMenuOpen(false); }}
                className={navClass(currentView === 'dashboard' && dashboardMode === 'list')}
                title={isAdminSidebarCollapsed ? 'Eventos Ativos' : ''}
              >
                <CalendarIcon className={iconClass(currentView === 'dashboard' && dashboardMode === 'list')} />
                {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Meus Eventos</span>}
              </button>
              <button
                onClick={() => { setCurrentView('dashboard'); handleCreateEvent(); setIsMobileMenuOpen(false); }}
                className={navClass(currentView === 'dashboard' && dashboardMode === 'edit' && !formEvent?.id)}
                title={isAdminSidebarCollapsed ? 'Criar Evento' : ''}
              >
                <PlusCircle className={iconClass(currentView === 'dashboard' && dashboardMode === 'edit' && !formEvent?.id)} />
                {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Criar Novo</span>}
              </button>
            </div>
          </div>

          {/* Operação */}
          <div>
            {!isAdminSidebarCollapsed && <h4 className="px-2 text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-3">Operação</h4>}
            <div className="space-y-1">
              <button
                onClick={() => { setCurrentView('dashboard'); setDashboardMode('staff'); setIsMobileMenuOpen(false); }}
                className={navClass(currentView === 'dashboard' && dashboardMode === 'staff')}
                title={isAdminSidebarCollapsed ? 'Equipe' : ''}
              >
                <Users className={iconClass(currentView === 'dashboard' && dashboardMode === 'staff')} />
                {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Equipe</span>}
              </button>
              {isAtLeast('admin') && (
                <button
                  onClick={() => showToast('Em Desenvolvimento', 'info')}
                  className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group text-white/40 hover:bg-white/5 cursor-not-allowed`}
                  title={isAdminSidebarCollapsed ? 'Aprovações KYC' : ''}
                >
                  <ShieldCheck className="w-5 h-5 shrink-0 text-white/20 group-hover:text-white/40" />
                  {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap opacity-60">Aprovações KYC</span>}
                </button>
              )}
            </div>
          </div>

          {/* Gestão */}
          <div>
            {!isAdminSidebarCollapsed && <h4 className="px-2 text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-3">Gestão</h4>}
            <div className="space-y-1">
              {[
                { icon: BarChart3, label: 'Relatórios Financeiros' },
                { icon: LinkIcon, label: 'Integrações' },
                { icon: Bell, label: 'Notificações' },
                { icon: AlertCircle, label: 'Suporte ao Produtor' },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group text-white/40 hover:bg-white/5 cursor-not-allowed`}
                  title={isAdminSidebarCollapsed ? label : ''}
                >
                  <Icon className="w-5 h-5 shrink-0 text-white/20 group-hover:text-white/40" />
                  {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap opacity-60">{label}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Desenvolvedor */}
          {userRole === 'developer' && (
            <div>
              {!isAdminSidebarCollapsed && <h4 className="px-2 text-[10px] font-bold tracking-[0.2em] uppercase text-[#d4af37]/40 mb-3">Desenvolvedor</h4>}
              <div className="space-y-1">
                <button
                  onClick={() => { setCurrentView('dashboard'); setDashboardMode('developer-panel'); setIsMobileMenuOpen(false); }}
                  className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group ${currentView === 'dashboard' && dashboardMode === 'developer-panel' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-[#d4af37]/50 hover:bg-[#d4af37]/5 hover:text-[#d4af37]'}`}
                  title={isAdminSidebarCollapsed ? 'Painel do Desenvolvedor' : ''}
                >
                  <Code2 className={`w-5 h-5 shrink-0 ${currentView === 'dashboard' && dashboardMode === 'developer-panel' ? 'text-[#d4af37]' : 'text-[#d4af37]/30 group-hover:text-[#d4af37]'}`} />
                  {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Dev Panel</span>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`border-t border-[#ffffff0a] space-y-2 ${isAdminSidebarCollapsed ? 'p-3' : 'p-4'}`}>
          <button
            onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); setIsMobileMenuOpen(false); }}
            className={navClass(currentView === 'dashboard' && dashboardMode === 'settings')}
            title={isAdminSidebarCollapsed ? 'Configurações Globais' : ''}
          >
            <Settings className={iconClass(currentView === 'dashboard' && dashboardMode === 'settings')} />
            {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Configurações</span>}
          </button>

          <div className={`mt-2 rounded-xl flex items-center group transition ${isAdminSidebarCollapsed ? 'justify-center' : 'justify-between bg-gradient-to-br from-white/5 to-transparent border border-white/5 p-3'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 flex flex-col items-center justify-center shrink-0">
                <User className="w-4 h-4 text-[#d4af37]" />
              </div>
              {!isAdminSidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {userRole === 'admin' ? 'Admin Central' : userRole === 'developer' ? 'Admin / Dev' : isStaff ? staffAccounts.find(s => s.id === loggedInUserId)?.name || 'Equipe' : users.find(u => u.id === loggedInUserId)?.name || 'Sua Conta'}
                  </p>
                  <p className="text-[9px] uppercase tracking-[1px] text-[#d4af37] font-semibold mt-0.5">
                    {userRole === 'admin' ? 'Administrador' : userRole === 'developer' ? 'Desenvolvedor' : isStaff ? 'Colaborador' : 'Produtor'}
                  </p>
                </div>
              )}
            </div>
            {!isAdminSidebarCollapsed && (
              <button onClick={handleLogout} className="p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition" title="Sair">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {isAdminSidebarCollapsed && (
            <button onClick={handleLogout} className="w-full flex items-center justify-center p-3 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-xl transition" title="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full h-16 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#ffffff0a] z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-[#d4af37] rotate-45 flex items-center justify-center shrink-0 overflow-hidden">
            {siteConfig.platformLogo
              ? <img src={siteConfig.platformLogo} alt="logo" className="w-full h-full object-contain -rotate-45 scale-[1.4]" />
              : <span className="text-[#0a0a0a] font-bold -rotate-45 leading-none mt-1 text-xs">{siteConfig.platformName.charAt(0).toUpperCase()}</span>
            }
          </div>
          <span className="text-sm font-serif tracking-widest text-[#d4af37] uppercase">{siteConfig.platformName} Admin</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white/70 hover:text-white transition">
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </>
  );
}
