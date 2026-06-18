import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye, Calendar as CalendarIcon, PlusCircle, Users, ShieldCheck, BarChart3,
  LinkIcon, Bell, AlertCircle, Code2, Settings, LogOut, ChevronLeft,
  ChevronRight, LayoutDashboard, MonitorDot, FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function AdminSidebar() {
  const {
    siteConfig, isAdminSidebarCollapsed, setIsAdminSidebarCollapsed,
    setIsMobileMenuOpen, currentView, dashboardMode,
    setCurrentView, setDashboardMode, userRole, isAtLeast, isStaff,
    staffAccounts, loggedInUserId, users, formEvent, handleCreateEvent,
    handleLogout, showToast, pendingApprovalsCount, developerConfig,
  } = useApp();

  const modules = developerConfig.adminModules;
  const staffOnly = userRole === 'staff';

  const navClass = (active: boolean) =>
    `nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group relative ${
      active
        ? 'bg-[#d4af37]/10 text-[#d4af37]'
        : 'text-white/60 hover:bg-white/5 hover:text-white'
    }`;

  const iconClass = (active: boolean) =>
    `w-5 h-5 shrink-0 ${active ? 'text-[#d4af37]' : 'text-white/40 group-hover:text-white'}`;

  /* ─── Active indicator pill (collapsed only) ─── */
  const ActivePill = ({ active }: { active: boolean }) =>
    active && isAdminSidebarCollapsed ? (
      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#d4af37] rounded-full" />
    ) : null;

  return (
    <>
      {/* ═══ DESKTOP SIDEBAR ═══ */}
      <aside
        className={`hidden md:flex flex-col fixed md:relative top-0 left-0 h-screen bg-[#0d0d0d] border-r border-[#ffffff0a] z-50 transition-[width] duration-200 ease-in-out ${isAdminSidebarCollapsed ? 'w-[72px]' : 'w-[272px]'}`}
      >
        {/* Header */}
        <div className={`h-20 flex items-center shrink-0 ${isAdminSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-5'} border-b border-[#ffffff0a]`}>
          <div className="flex items-center gap-3 overflow-hidden">
            {isAdminSidebarCollapsed ? (
              // Menu recolhido → logo redonda
              <img src="/logo-round.png" alt={siteConfig.platformName || 'Espaço Mix'} className="w-14 h-14 object-contain shrink-0" />
            ) : (
              // Menu expandido → logo retangular (maior)
              <img src={siteConfig.platformLogo || '/logo-rect.png'} alt={siteConfig.platformName || 'Espaço Mix'} className="h-16 w-auto max-w-[210px] object-contain shrink-0 animate-in fade-in" />
            )}
          </div>
          <button
            onClick={() => setIsAdminSidebarCollapsed(!isAdminSidebarCollapsed)}
            className={`hidden md:flex items-center justify-center text-white/40 hover:text-white transition-colors ${
              isAdminSidebarCollapsed
                ? 'absolute right-[-14px] top-6 w-7 h-7 bg-[#0d0d0d] border border-[#ffffff15] rounded-full'
                : 'w-7 h-7 rounded-lg hover:bg-white/5'
            }`}
          >
            {isAdminSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar ${isAdminSidebarCollapsed ? 'py-5 px-2.5' : 'py-5 px-3'} space-y-6`}>

          {staffOnly ? (
            /* Equipe de portaria: acesso EXCLUSIVO ao Controle de Portaria */
            <div>
              <button
                onClick={() => { setCurrentView('dashboard'); setDashboardMode('check-in'); setIsMobileMenuOpen(false); }}
                className={navClass(currentView === 'dashboard' && dashboardMode === 'check-in')}
                title={isAdminSidebarCollapsed ? 'Controle de Portaria' : ''}
              >
                <ActivePill active={currentView === 'dashboard' && dashboardMode === 'check-in'} />
                <ShieldCheck className={iconClass(currentView === 'dashboard' && dashboardMode === 'check-in')} />
                {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Controle de Portaria</span>}
              </button>
            </div>
          ) : (
          <>
          {/* Ver Site */}
          <div>
            <button
              onClick={() => setCurrentView('home')}
              className={`w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group border border-[#d4af37]/20 text-[#d4af37]/70 bg-[#d4af37]/5 hover:bg-[#d4af37]/10 hover:text-[#d4af37] relative`}
              title={isAdminSidebarCollapsed ? 'Ver Site (Público)' : ''}
            >
              <Eye className="w-5 h-5 shrink-0 text-[#d4af37]/70 group-hover:text-[#d4af37] transition-colors" />
              {!isAdminSidebarCollapsed && <span className="text-[11px] font-semibold tracking-widest uppercase whitespace-nowrap">Ver Site (Público)</span>}
            </button>
          </div>

          {/* Visão Geral */}
          {isAtLeast('admin') && (
            <div>
              {!isAdminSidebarCollapsed
                ? <p className="px-2 text-[9px] font-bold tracking-[0.2em] uppercase text-white/25 mb-2">Visão Geral</p>
                : <div className="w-6 h-px bg-white/10 mx-auto mb-2" />
              }
              <div className="space-y-0.5">
                <button
                  onClick={() => { setCurrentView('dashboard'); setDashboardMode('admin-overview'); setIsMobileMenuOpen(false); }}
                  className={navClass(currentView === 'dashboard' && dashboardMode === 'admin-overview')}
                  title={isAdminSidebarCollapsed ? 'Dashboard Admin' : ''}
                >
                  <ActivePill active={currentView === 'dashboard' && dashboardMode === 'admin-overview'} />
                  <LayoutDashboard className={iconClass(currentView === 'dashboard' && dashboardMode === 'admin-overview')} />
                  {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Dashboard</span>}
                </button>
                {userRole === 'developer' && (
                  <button
                    onClick={() => { setCurrentView('dashboard'); setDashboardMode('dev-overview'); setIsMobileMenuOpen(false); }}
                    className={navClass(currentView === 'dashboard' && dashboardMode === 'dev-overview')}
                    title={isAdminSidebarCollapsed ? 'Dashboard Dev' : ''}
                  >
                    <ActivePill active={currentView === 'dashboard' && dashboardMode === 'dev-overview'} />
                    <MonitorDot className={iconClass(currentView === 'dashboard' && dashboardMode === 'dev-overview')} />
                    {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Dashboard Dev</span>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Eventos */}
          <div>
            {!isAdminSidebarCollapsed
              ? <p className="px-2 text-[9px] font-bold tracking-[0.2em] uppercase text-white/25 mb-2">Eventos</p>
              : <div className="w-6 h-px bg-white/10 mx-auto mb-2" />
            }
            <div className="space-y-0.5">
              <button
                onClick={() => { setCurrentView('dashboard'); setDashboardMode('list'); setIsMobileMenuOpen(false); }}
                className={navClass(currentView === 'dashboard' && dashboardMode === 'list')}
                title={isAdminSidebarCollapsed ? 'Meus Eventos' : ''}
              >
                <ActivePill active={currentView === 'dashboard' && dashboardMode === 'list'} />
                <CalendarIcon className={iconClass(currentView === 'dashboard' && dashboardMode === 'list')} />
                {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Meus Eventos</span>}
              </button>
              <button
                onClick={() => { setCurrentView('dashboard'); handleCreateEvent(); setIsMobileMenuOpen(false); }}
                className={navClass(currentView === 'dashboard' && dashboardMode === 'edit' && !formEvent?.id)}
                title={isAdminSidebarCollapsed ? 'Criar Novo Evento' : ''}
              >
                <ActivePill active={currentView === 'dashboard' && dashboardMode === 'edit' && !formEvent?.id} />
                <PlusCircle className={iconClass(currentView === 'dashboard' && dashboardMode === 'edit' && !formEvent?.id)} />
                {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Criar Novo</span>}
              </button>
            </div>
          </div>

          {/* Operação */}
          <div>
            {!isAdminSidebarCollapsed
              ? <p className="px-2 text-[9px] font-bold tracking-[0.2em] uppercase text-white/25 mb-2">Operação</p>
              : <div className="w-6 h-px bg-white/10 mx-auto mb-2" />
            }
            <div className="space-y-0.5">
              <button
                onClick={() => { setCurrentView('dashboard'); setDashboardMode('staff'); setIsMobileMenuOpen(false); }}
                className={navClass(currentView === 'dashboard' && dashboardMode === 'staff')}
                title={isAdminSidebarCollapsed ? 'Equipe' : ''}
              >
                <ActivePill active={currentView === 'dashboard' && dashboardMode === 'staff'} />
                <Users className={iconClass(currentView === 'dashboard' && dashboardMode === 'staff')} />
                {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Equipe</span>}
              </button>
            </div>
          </div>

          {/* Desenvolvedor */}
          {userRole === 'developer' && (
            <div>
              {!isAdminSidebarCollapsed
                ? <p className="px-2 text-[9px] font-bold tracking-[0.2em] uppercase text-[#d4af37]/30 mb-2">Desenvolvedor</p>
                : <div className="w-6 h-px bg-[#d4af37]/20 mx-auto mb-2" />
              }
              <div className="space-y-0.5">
                <button
                  onClick={() => { setCurrentView('dashboard'); setDashboardMode('developer-panel'); setIsMobileMenuOpen(false); }}
                  className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group relative ${currentView === 'dashboard' && dashboardMode === 'developer-panel' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-[#d4af37]/40 hover:bg-[#d4af37]/5 hover:text-[#d4af37]'}`}
                  title={isAdminSidebarCollapsed ? 'Painel do Desenvolvedor' : ''}
                >
                  {currentView === 'dashboard' && dashboardMode === 'developer-panel' && isAdminSidebarCollapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#d4af37] rounded-full" />
                  )}
                  <Code2 className={`w-5 h-5 shrink-0 ${currentView === 'dashboard' && dashboardMode === 'developer-panel' ? 'text-[#d4af37]' : 'text-[#d4af37]/30 group-hover:text-[#d4af37]'}`} />
                  {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Dev Panel</span>}
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* Footer — sem botão de perfil para admin/developer */}
        <div className={`border-t border-[#ffffff0a] space-y-1 ${isAdminSidebarCollapsed ? 'p-2.5' : 'p-3'}`}>
          {!staffOnly && (
            <button
              onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); setIsMobileMenuOpen(false); }}
              className={navClass(currentView === 'dashboard' && dashboardMode === 'settings')}
              title={isAdminSidebarCollapsed ? 'Configurações' : ''}
            >
              <ActivePill active={currentView === 'dashboard' && dashboardMode === 'settings'} />
              <Settings className={iconClass(currentView === 'dashboard' && dashboardMode === 'settings')} />
              {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Configurações</span>}
            </button>
          )}

          <div className={`mt-1 rounded-xl flex items-center transition ${isAdminSidebarCollapsed ? 'justify-center' : 'justify-between bg-white/[0.03] border border-white/5 px-3 py-2.5'}`}>
            {!isAdminSidebarCollapsed && (
              <div className="flex flex-col min-w-0 mr-2">
                <p className="text-[11px] font-bold text-white/80 truncate">
                  {userRole === 'admin' ? 'Admin Central' : userRole === 'developer' ? 'Admin / Dev' : isStaff ? staffAccounts.find(s => s.id === loggedInUserId)?.name || 'Equipe' : users.find(u => u.id === loggedInUserId)?.name || 'Sua Conta'}
                </p>
                <p className="text-[9px] uppercase tracking-[1.5px] text-[#d4af37]/60 font-semibold mt-0.5">
                  {userRole === 'admin' ? 'Administrador' : userRole === 'developer' ? 'Desenvolvedor' : isStaff ? 'Colaborador' : 'Produtor'}
                </p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`${isAdminSidebarCollapsed ? 'w-full flex items-center justify-center p-3 rounded-xl' : 'p-1.5 rounded-lg shrink-0'} text-red-400/70 hover:bg-red-500/15 hover:text-red-400 transition-colors`}
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ MOBILE TOP HEADER ═══ */}
      <div className="md:hidden fixed top-0 w-full h-14 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#ffffff0a] z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-[#d4af37] rounded-md flex items-center justify-center shrink-0 overflow-hidden">
            {siteConfig.platformLogo
              ? <img src={siteConfig.platformLogo} alt="logo" className="w-full h-full object-cover" />
              : <span className="text-[#0a0a0a] font-bold leading-none text-xs">{siteConfig.platformName.charAt(0).toUpperCase()}</span>
            }
          </div>
          <span className="text-sm font-serif tracking-widest text-[#d4af37] uppercase">{siteConfig.platformName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentView('home')}
            className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center text-white/40 hover:text-[#d4af37] rounded-lg transition-colors"
            title="Ver site público"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ═══ MOBILE BOTTOM TAB BAR ═══ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d]/97 backdrop-blur-xl border-t border-[#ffffff0a]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch h-[60px]">

          {staffOnly ? (
            <button
              onClick={() => { setCurrentView('dashboard'); setDashboardMode('check-in'); }}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:scale-95"
            >
              <ShieldCheck className={`w-5 h-5 transition-colors ${currentView === 'dashboard' && dashboardMode === 'check-in' ? 'text-[#d4af37]' : 'text-white/35'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${currentView === 'dashboard' && dashboardMode === 'check-in' ? 'text-[#d4af37]' : 'text-white/35'}`}>Portaria</span>
            </button>
          ) : (
          <>
          {/* Dashboard */}
          <button
            onClick={() => { setCurrentView('dashboard'); setDashboardMode(isAtLeast('admin') ? 'admin-overview' : 'list'); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:scale-95"
          >
            <LayoutDashboard className={`w-5 h-5 transition-colors ${currentView === 'dashboard' && (dashboardMode === 'admin-overview' || dashboardMode === 'dev-overview') ? 'text-[#d4af37]' : 'text-white/35'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${currentView === 'dashboard' && (dashboardMode === 'admin-overview' || dashboardMode === 'dev-overview') ? 'text-[#d4af37]' : 'text-white/35'}`}>Painel</span>
          </button>

          {/* Eventos */}
          <button
            onClick={() => { setCurrentView('dashboard'); setDashboardMode('list'); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:scale-95"
          >
            <CalendarIcon className={`w-5 h-5 transition-colors ${currentView === 'dashboard' && dashboardMode === 'list' ? 'text-[#d4af37]' : 'text-white/35'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${currentView === 'dashboard' && dashboardMode === 'list' ? 'text-[#d4af37]' : 'text-white/35'}`}>Eventos</span>
          </button>

          {/* Criar Evento — botão central destacado */}
          <button
            onClick={() => { setCurrentView('dashboard'); handleCreateEvent(); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 -mt-3 active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 bg-[#d4af37] rounded-full flex items-center justify-center shadow-[0_0_16px_rgba(212,175,55,0.35)]">
              <PlusCircle className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#d4af37]/60">Novo</span>
          </button>

          {/* Equipe */}
          <button
            onClick={() => { setCurrentView('dashboard'); setDashboardMode('staff'); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:scale-95"
          >
            <Users className={`w-5 h-5 transition-colors ${currentView === 'dashboard' && dashboardMode === 'staff' ? 'text-[#d4af37]' : 'text-white/35'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${currentView === 'dashboard' && dashboardMode === 'staff' ? 'text-[#d4af37]' : 'text-white/35'}`}>Equipe</span>
          </button>

          {/* Configurações */}
          <button
            onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:scale-95"
          >
            <Settings className={`w-5 h-5 transition-colors ${currentView === 'dashboard' && dashboardMode === 'settings' ? 'text-[#d4af37]' : 'text-white/35'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${currentView === 'dashboard' && dashboardMode === 'settings' ? 'text-[#d4af37]' : 'text-white/35'}`}>Config</span>
          </button>
          </>
          )}

        </div>
      </nav>
    </>
  );
}
