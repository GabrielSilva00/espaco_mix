import React, { useEffect, useState } from 'react';
import {
  Settings, Image as ImageIcon, Save, Check, Filter,
  Shield, Calendar, Ticket, Repeat, XCircle, Bell, BarChart2, Info, Building2, Trash2, RefreshCcw, CreditCard, Mail, Loader2
} from 'lucide-react';
import { getSystemConfig, updateSystemConfig, updateMyCredentials, getMyFullProfile, updateProfile } from '../lib/supabase';
import { User, Phone, FileText } from 'lucide-react';
import { UserRole, usePermissions } from '../hooks/usePermissions';
import { MercadoPagoSettings } from './MercadoPagoSettings';

export function AdminSettings({
  userRole,
  onSettingsSaved,
}: {
  userRole: UserRole;
  onSettingsSaved?: (platformName: string, platformLogo: string | null, settings?: any) => void;
}) {
  const { can } = usePermissions(userRole);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'conta'>('general');
  const [credForm, setCredForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [credStatus, setCredStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [credError, setCredError] = useState('');

  // ── Meus Dados (perfil do admin) ─────────────────────────────────────────
  const [myProfile, setMyProfile] = useState<{ id: string; email: string; username?: string } | null>(null);
  const [profileData, setProfileData] = useState({ name: '', phone: '', cpf: '', birth_date: '' });
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', cpf: '', birth_date: '' });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (activeTab !== 'conta') return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getMyFullProfile();
        if (!p || cancelled) return;
        setMyProfile({ id: p.id, email: p.email, username: p.username });
        const loaded = {
          name: p.name || '',
          phone: p.phone || '',
          cpf: p.cpf || '',
          birth_date: p.birth_date || '',
        };
        setProfileData(loaded);
        setProfileForm(loaded);
      } catch { /* ignora */ }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  const saveMyProfile = async () => {
    if (!myProfile) return;
    if (!profileForm.name.trim()) { setProfileError('Nome é obrigatório'); return; }
    setProfileError('');
    setProfileSaving(true);
    try {
      await updateProfile(myProfile.id, {
        name: profileForm.name.trim(),
        phone: profileForm.phone || undefined,
        cpf: profileForm.cpf || undefined,
        birth_date: profileForm.birth_date || undefined,
      });
      setProfileData({ ...profileForm, name: profileForm.name.trim() });
      setProfileEditing(false);
    } catch (err: any) {
      setProfileError(err?.message || 'Erro ao salvar dados.');
    } finally {
      setProfileSaving(false);
    }
  };

  const defaultSettings = {
    // General
    platformName: 'Espaço Mix Eventos de Luxo',
    supportEmail: 'contato@eventix.com.br',
    supportPhone: '+55 11 99999-9999',
    mainUrl: 'https://eventix.com.br',

    // Organização
    personType: 'pf' as 'pf' | 'pj',
    companyName: '',
    tradeName: '',
    address: '',
    document: '',
    contactEmail: '',
    contactPhone: '',
    socialInstagram: '',

    // Payment
    paymentMode: 'split',
    paymentGateway: 'mercadopago',
    gatewayFee: '4.99',
    gatewayFeeType: 'percentage',
    feePayer: 'buyer',
    feeType: 'percentage',
    platformFee: '10',
    showFeeToBuyer: true,

    // Security
    requireCPF: true,
    blockSimultaneous: true,
    verifyEmail: false,

    // Events
    allowScheduled: true,
    defaultEventStatus: 'draft',
    venueMaxCapacity: 1500,

    // Tickets
    maxTicketsPerPurchase: '8',
    cartExpirationTime: '15',
    lateParticipantInfo: true,
    sameOwnerForAll: false,
    ticketRequireCPF: true,
    ticketRequireName: true,
    ticketRequireEmail: false,

    // Transfers
    allowTransfer: true,
    transferMaxDelay: '24',
    multipleTransfers: false,
    transferRequireEmail: true,

    // Cancellation
    allowCancellation: true,
    cancelMaxDelay: '48',
    autoCancel: true,
    refundType: 'total',
    cancelFee: '0',
    refundProcessTime: '3',

    // Notifications
    notifyPurchase: true,
    notifyTransfer: true,
    notifyCancel: true,
    notifyReminder: true,

    // Admin
    enableReports: true,
    allowExport: true,
    showSensitiveData: false,

    // Email
    emailSenderName: 'Espaço Mix',
    emailSenderAddress: '',
    emailPurchaseSubject: 'Confirmação: seu ingresso para {{event_title}}',
    emailPurchaseBody: '',
    emailReminderSubject: 'Lembrete: {{event_title}} é amanhã!',
    emailReminderBody: '',
  };

  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    if (!userRole) return;
    getSystemConfig()
      .then((c) => {
        setSettings((prev) => ({
          ...prev,
          platformName:         c.site_name              ?? prev.platformName,
          supportEmail:         c.support_email          ?? prev.supportEmail,
          supportPhone:         c.support_phone          ?? prev.supportPhone,
          mainUrl:              c.main_url               ?? prev.mainUrl,
          venueMaxCapacity:     c.venue_max_capacity     ?? prev.venueMaxCapacity,
          platformFee:          String(c.platform_fee_percent    ?? prev.platformFee),
          gatewayFee:           String(c.gateway_fee_percent     ?? prev.gatewayFee),
          feePayer:             c.fee_payer              ?? prev.feePayer,
          showFeeToBuyer:       c.show_fee_to_buyer      ?? prev.showFeeToBuyer,
          paymentGateway:       c.payment_provider       ?? prev.paymentGateway,
          maxTicketsPerPurchase: String(c.max_tickets_per_purchase ?? prev.maxTicketsPerPurchase),
          cartExpirationTime:   String(c.cart_expiration_minutes  ?? prev.cartExpirationTime),
          allowScheduled:       c.allow_scheduled        ?? prev.allowScheduled,
          defaultEventStatus:   c.default_event_status   ?? prev.defaultEventStatus,
          requireCPF:           c.require_cpf            ?? prev.requireCPF,
          blockSimultaneous:    c.block_simultaneous     ?? prev.blockSimultaneous,
          verifyEmail:          c.verify_email           ?? prev.verifyEmail,
          lateParticipantInfo:  c.late_participant_info  ?? prev.lateParticipantInfo,
          ticketRequireName:    c.ticket_require_name    ?? prev.ticketRequireName,
          ticketRequireEmail:   c.ticket_require_email   ?? prev.ticketRequireEmail,
          sameOwnerForAll:      c.same_owner_for_all     ?? prev.sameOwnerForAll,
          allowTransfer:        c.allow_transfer         ?? prev.allowTransfer,
          transferMaxDelay:     String(c.transfer_max_delay_hours ?? prev.transferMaxDelay),
          multipleTransfers:    c.allow_multiple_transfers ?? prev.multipleTransfers,
          transferRequireEmail: c.transfer_require_email  ?? prev.transferRequireEmail,
          allowCancellation:    c.allow_cancellation     ?? prev.allowCancellation,
          cancelMaxDelay:       String(c.cancel_max_delay_hours ?? prev.cancelMaxDelay),
          autoCancel:           c.auto_refund            ?? prev.autoCancel,
          refundType:           c.refund_type            ?? prev.refundType,
          cancelFee:            String(c.cancel_fee_percent ?? prev.cancelFee),
          refundProcessTime:    String(c.refund_process_days ?? prev.refundProcessTime),
          notifyPurchase:       c.notify_purchase        ?? prev.notifyPurchase,
          notifyTransfer:       c.notify_transfer        ?? prev.notifyTransfer,
          notifyCancel:         c.notify_cancel          ?? prev.notifyCancel,
          notifyReminder:       c.notify_reminder        ?? prev.notifyReminder,
          enableReports:        c.enable_reports         ?? prev.enableReports,
          allowExport:          c.allow_export           ?? prev.allowExport,
          showSensitiveData:    c.show_sensitive_data    ?? prev.showSensitiveData,
          personType:           (c.person_type as 'pf' | 'pj') ?? prev.personType,
          companyName:          c.company_name           ?? prev.companyName,
          tradeName:            c.trade_name             ?? prev.tradeName,
          address:              c.address                ?? prev.address,
          document:             c.document               ?? prev.document,
          contactEmail:         c.contact_email          ?? prev.contactEmail,
          contactPhone:         c.contact_phone          ?? prev.contactPhone,
          socialInstagram:      c.social_instagram       ?? prev.socialInstagram,
          emailSenderName:      c.email_sender_name      ?? prev.emailSenderName,
          emailSenderAddress:   c.email_sender_address   ?? prev.emailSenderAddress,
          emailPurchaseSubject: c.email_purchase_subject ?? prev.emailPurchaseSubject,
          emailPurchaseBody:    c.email_purchase_body    ?? prev.emailPurchaseBody,
          emailReminderSubject: c.email_reminder_subject ?? prev.emailReminderSubject,
          emailReminderBody:    c.email_reminder_body    ?? prev.emailReminderBody,
        }));
      })
      .catch((err) => console.error('[AdminSettings] Erro ao carregar config:', (err as Error)?.message));
  }, [userRole]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let val: any = value;
    if (type === 'checkbox') {
      val = (e.target as HTMLInputElement).checked;
    }
    setSettings(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateSystemConfig({
        // Geral
        site_name:               settings.platformName,
        support_email:           settings.supportEmail,
        support_phone:           settings.supportPhone,
        main_url:                settings.mainUrl,
        // Eventos
        venue_max_capacity:      Number(settings.venueMaxCapacity) || undefined,
        allow_scheduled:         settings.allowScheduled,
        default_event_status:    settings.defaultEventStatus,
        // Pagamento
        platform_fee_percent:    Number(settings.platformFee) || undefined,
        gateway_fee_percent:     Number(settings.gatewayFee) || undefined,
        fee_payer:               settings.feePayer as 'buyer' | 'seller',
        show_fee_to_buyer:       settings.showFeeToBuyer,
        payment_provider:        settings.paymentGateway as any,
        // Segurança
        require_cpf:             settings.requireCPF,
        block_simultaneous:      settings.blockSimultaneous,
        verify_email:            settings.verifyEmail,
        // Ingressos
        max_tickets_per_purchase: Number(settings.maxTicketsPerPurchase) || undefined,
        cart_expiration_minutes:  Number(settings.cartExpirationTime) || undefined,
        late_participant_info:    settings.lateParticipantInfo,
        ticket_require_name:      settings.ticketRequireName,
        ticket_require_email:     settings.ticketRequireEmail,
        same_owner_for_all:       settings.sameOwnerForAll,
        // Transferências
        allow_transfer:           settings.allowTransfer,
        transfer_max_delay_hours: Number(settings.transferMaxDelay) || undefined,
        allow_multiple_transfers: settings.multipleTransfers,
        transfer_require_email:   settings.transferRequireEmail,
        // Cancelamento
        allow_cancellation:       settings.allowCancellation,
        cancel_max_delay_hours:   Number(settings.cancelMaxDelay) || undefined,
        auto_refund:              settings.autoCancel,
        refund_type:              settings.refundType as 'total' | 'partial',
        cancel_fee_percent:       Number(settings.cancelFee) || undefined,
        refund_process_days:      Number(settings.refundProcessTime) || undefined,
        // Notificações
        notify_purchase:          settings.notifyPurchase,
        notify_transfer:          settings.notifyTransfer,
        notify_cancel:            settings.notifyCancel,
        notify_reminder:          settings.notifyReminder,
        // Relatórios
        enable_reports:           settings.enableReports,
        allow_export:             settings.allowExport,
        show_sensitive_data:      settings.showSensitiveData,
        // Organização
        person_type:              settings.personType,
        company_name:             settings.companyName || undefined,
        trade_name:               settings.tradeName || undefined,
        address:                  settings.address || undefined,
        document:                 settings.document || undefined,
        contact_email:            settings.contactEmail || undefined,
        contact_phone:            settings.contactPhone || undefined,
        social_instagram:         settings.socialInstagram || undefined,
        // Email
        email_sender_name:        settings.emailSenderName || undefined,
        email_sender_address:     settings.emailSenderAddress || undefined,
        email_purchase_subject:   settings.emailPurchaseSubject || undefined,
        email_purchase_body:      settings.emailPurchaseBody || undefined,
        email_reminder_subject:   settings.emailReminderSubject || undefined,
        email_reminder_body:      settings.emailReminderBody || undefined,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      onSettingsSaved?.(settings.platformName, logoPreview, settings);
    } catch (err) {
      setSaveError((err as Error)?.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja restaurar as configurações originais? Isso apagará suas alterações não salvas.')) {
      setSettings(defaultSettings);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  const handleLogoRemove = () => {
    setLogoPreview(null);
  };

  const renderToggle = (name: keyof typeof settings, label: string, description?: string) => (
    <label className="flex items-start gap-4 cursor-pointer group w-full p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition">
      <div className="flex-1">
         <span className="text-xs uppercase tracking-widest font-bold block mb-1">{label}</span>
         {description && <span className="text-[10px] text-white/50 block leading-relaxed">{description}</span>}
      </div>
      <div className="relative shrink-0 mt-1">
        <input
          type="checkbox"
          name={name}
          checked={settings[name] as boolean}
          onChange={handleChange}
          className="peer sr-only"
        />
        <div className="w-10 h-6 bg-white/10 rounded-full peer-checked:bg-[#d4af37] transition-colors relative">
          <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${(settings[name] as boolean) ? 'translate-x-4' : 'translate-x-0'}`}></div>
        </div>
      </div>
    </label>
  );

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-32">
      <div className="flex items-center justify-between gap-3 sticky top-0 z-30 bg-[#0a0a0a] py-3 md:py-4 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37] shrink-0">
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-xl font-serif text-[#d4af37] leading-tight truncate">Painel de Controle</h2>
            <p className="text-[9px] uppercase tracking-widest opacity-40 hidden sm:block">Configuração de regras e operação</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition flex items-center gap-1.5"
          >
            <RefreshCcw className="w-4 h-4" />
            <span className="hidden sm:inline text-[10px] uppercase tracking-widest font-bold">Restaurar</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3 md:px-6 py-2 md:py-3 rounded-xl transition duration-300 shadow-[0_0_20px_rgba(212,175,55,0.2)] disabled:opacity-70 disabled:cursor-not-allowed ${isSaved ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-[#d4af37] text-black hover:brightness-110'}`}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span className="text-[10px] uppercase tracking-widest font-bold">
              <span className="hidden sm:inline">{isSaving ? 'Salvando...' : isSaved ? 'Salvo' : 'Salvar Alterações'}</span>
              <span className="sm:hidden">{isSaving ? '...' : isSaved ? '✓' : 'Salvar'}</span>
            </span>
          </button>
        </div>
      </div>
      {saveError && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400">{saveError}</p>
        </div>
      )}

      {/* Abas — sem sticky; scroll horizontal em mobile */}
      <div className="bg-[#0a0a0a] py-3 border-b border-white/5 flex gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-1.5 px-3 md:px-6 py-2 rounded-lg font-bold text-[10px] md:text-xs uppercase tracking-widest transition whitespace-nowrap shrink-0 ${
            activeTab === 'general'
              ? 'bg-[#d4af37] text-black shadow-[0_0_20px_rgba(212,175,55,0.2)]'
              : 'hover:bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          Geral
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-1.5 px-3 md:px-6 py-2 rounded-lg font-bold text-[10px] md:text-xs uppercase tracking-widest transition whitespace-nowrap shrink-0 ${
            activeTab === 'payments'
              ? 'bg-[#d4af37] text-black shadow-[0_0_20px_rgba(212,175,55,0.2)]'
              : 'hover:bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Pagamentos
        </button>
        <button
          onClick={() => setActiveTab('conta')}
          className={`flex items-center gap-1.5 px-3 md:px-6 py-2 rounded-lg font-bold text-[10px] md:text-xs uppercase tracking-widest transition whitespace-nowrap shrink-0 ${
            activeTab === 'conta'
              ? 'bg-[#d4af37] text-black shadow-[0_0_20px_rgba(212,175,55,0.2)]'
              : 'hover:bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          Minha Conta
        </button>
      </div>

      {/* Conteúdo de Abas */}
      <div className="space-y-10 pt-8">
        {activeTab === 'general' ? (
          // SEÇÕES GERAIS
          <>
            {/* 1. Configurações Gerais */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Building2 className="w-40 h-40" />
          </div>
          <div className="relative z-10">
            <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
              <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Building2 className="w-4 h-4" /></span>
              Configurações Gerais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Nome da Plataforma</label>
                <input
                  type="text" name="platformName" value={settings.platformName} onChange={handleChange} required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
                />
              </div>
              <div className="group relative">
                <label className="flex items-center gap-2 text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">
                  URL Principal
                  <span title="URL do domínio principal que abriga seu e-commerce"><Info className="w-3 h-3 cursor-help mb-0.5" /></span>
                  {userRole !== 'developer' && (
                    <span title="Somente DEV pode alterar este campo" className="opacity-60 cursor-help"><Shield className="w-3 h-3 inline-block text-[#d4af37]/60" /></span>
                  )}
                </label>
                <input
                  type="url" name="mainUrl" value={settings.mainUrl} onChange={handleChange} required pattern="https://.*"
                  placeholder="https://exemplo.com.br"
                  disabled={userRole !== 'developer'}
                  className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono invalid:border-red-500/50 ${userRole !== 'developer' ? 'opacity-40 cursor-not-allowed select-none' : ''}`}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">E-mail de Suporte</label>
                <input
                  type="email" name="supportEmail" value={settings.supportEmail} onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">WhatsApp de Suporte</label>
                <input
                  type="tel" name="supportPhone" value={settings.supportPhone} onChange={handleChange}
                  placeholder="+55 11 99999-9999"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono"
                />
              </div>
            </div>

            {/* Dados da Organização */}
            <div className="mt-8 border-t border-white/5 pt-8 space-y-6">
              <h4 className="text-[11px] uppercase tracking-widest font-bold opacity-60">Dados da Organização / Responsável</h4>

              {/* Tipo de Pessoa */}
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Tipo de Pessoa *</label>
                <select
                  name="personType"
                  value={settings.personType}
                  onChange={(e) => {
                    const tipo = e.target.value as 'pf' | 'pj';
                    setSettings(prev => ({
                      ...prev,
                      personType: tipo,
                      document: '',
                      ...(tipo === 'pf' ? { companyName: '', tradeName: '' } : {}),
                    }));
                  }}
                  className="w-full select-field"
                >
                  <option value="pf">Pessoa Física</option>
                  <option value="pj">Pessoa Jurídica</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {settings.personType === 'pj' && (
                  <div>
                    <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Razão Social *</label>
                    <input
                      type="text" name="companyName" value={settings.companyName} onChange={handleChange} required
                      placeholder="Razão Social da empresa"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Nome Fantasia *</label>
                  <input
                    type="text" name="tradeName" value={settings.tradeName} onChange={handleChange} required
                    placeholder="Nome comercial / fantasia"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">
                    {settings.personType === 'pj' ? 'CNPJ *' : 'CPF *'}
                  </label>
                  <input
                    type="text" name="document" value={settings.document} onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      let formatted = raw;
                      if (settings.personType === 'pj') {
                        if (raw.length <= 2) formatted = raw;
                        else if (raw.length <= 5) formatted = raw.slice(0,2) + '.' + raw.slice(2);
                        else if (raw.length <= 8) formatted = raw.slice(0,2) + '.' + raw.slice(2,5) + '.' + raw.slice(5);
                        else if (raw.length <= 12) formatted = raw.slice(0,2) + '.' + raw.slice(2,5) + '.' + raw.slice(5,8) + '/' + raw.slice(8);
                        else formatted = raw.slice(0,2) + '.' + raw.slice(2,5) + '.' + raw.slice(5,8) + '/' + raw.slice(8,12) + '-' + raw.slice(12,14);
                      } else {
                        if (raw.length <= 3) formatted = raw;
                        else if (raw.length <= 6) formatted = raw.slice(0,3) + '.' + raw.slice(3);
                        else if (raw.length <= 9) formatted = raw.slice(0,3) + '.' + raw.slice(3,6) + '.' + raw.slice(6);
                        else formatted = raw.slice(0,3) + '.' + raw.slice(3,6) + '.' + raw.slice(6,9) + '-' + raw.slice(9,11);
                      }
                      setSettings(prev => ({ ...prev, document: formatted }));
                    }}
                    placeholder={settings.personType === 'pj' ? 'XX.XXX.XXX/XXXX-XX' : 'XXX.XXX.XXX-XX'}
                    maxLength={settings.personType === 'pj' ? 18 : 14}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">E-mail de Contato *</label>
                  <input
                    type="email" name="contactEmail" value={settings.contactEmail} onChange={handleChange} required
                    placeholder="contato@suaempresa.com.br"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Telefone / Contato *</label>
                  <input
                    type="tel" name="contactPhone" value={settings.contactPhone} onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      let formatted = raw;
                      if (raw.length <= 2) formatted = raw.length ? '(' + raw : '';
                      else if (raw.length <= 7) formatted = '(' + raw.slice(0,2) + ') ' + raw.slice(2);
                      else formatted = '(' + raw.slice(0,2) + ') ' + raw.slice(2,7) + '-' + raw.slice(7,11);
                      setSettings(prev => ({ ...prev, contactPhone: formatted }));
                    }}
                    placeholder="(XX) XXXXX-XXXX"
                    maxLength={15}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Endereço Completo *</label>
                <input
                  type="text" name="address" value={settings.address} onChange={handleChange} required
                  placeholder="Rua, número, bairro, cidade, estado, CEP"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                />
                <p className="text-[9px] opacity-30 mt-1.5">Este endereço será sugerido como localização padrão ao criar novos eventos.</p>
              </div>

              {/* Instagram */}
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Instagram do Espaço</label>
                <input
                  type="text" name="socialInstagram" value={settings.socialInstagram} onChange={handleChange}
                  placeholder="@espacomix"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                />
                <p className="text-[9px] opacity-30 mt-1.5">Será exibido no rodapé do site. Use o formato @usuario ou o handle completo.</p>
              </div>
            </div>

            <div className="mt-8 border-t border-white/5 pt-8">
              <label className="block text-[10px] uppercase opacity-40 mb-4 font-bold tracking-[0.2em]">Logo da Plataforma</label>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon className="w-8 h-8 opacity-20" />
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <label className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer text-center font-bold">
                     Fazer Upload
                     <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {logoPreview && (
                    <button onClick={handleLogoRemove} className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-red-400 hover:text-red-300 transition">
                      <Trash2 className="w-3 h-3" /> Remover imagem
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Pagamentos (Config Financeiras) */}
        {can('manage_gateways') && (
          <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Filter className="w-40 h-40" />
          </div>
          <div className="relative z-10">
            <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
               <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Filter className="w-4 h-4" /></span>
               Pagamentos e Finanças
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="space-y-6">
                <h4 className="text-[11px] uppercase tracking-widest font-bold opacity-60 border-b border-white/10 pb-2">Processamento</h4>

                <div>
                  <label className="flex items-center gap-2 text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">
                    Modo de Recebimento
                    <span title="Split Automático envia o valor direto para o organizador. Retenção mantém na plataforma até liberação manual."><Info className="w-3 h-3 cursor-help" /></span>
                  </label>
                  <select name="paymentMode" value={settings.paymentMode} onChange={handleChange} className="w-full select-field">
                    <option value="split">Split Automático (Recomendado)</option>
                    <option value="retained">Retenção pela Plataforma</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                    <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Gateway</label>
                    <select name="paymentGateway" value={settings.paymentGateway} onChange={handleChange} className="w-full select-field">
                      <option value="mercadopago">Mercado Pago</option>
                      <option value="pagarme">Pagar.me</option>
                      <option value="stripe">Stripe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Taxa do Gateway</label>
                    <input type="number" min="0" step="0.01" name="gatewayFee" value={settings.gatewayFee} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#d4af37]/50 transition" />
                  </div>
                </div>

                <div>
                   <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Quem Paga a Taxa do Gateway?</label>
                   <select name="feePayer" value={settings.feePayer} onChange={handleChange} className="w-full select-field">
                     <option value="buyer">Comprador (Add ao valor do ingresso)</option>
                     <option value="organizer">Organizador (Descontado no split)</option>
                   </select>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[11px] uppercase tracking-widest font-bold opacity-60 border-b border-white/10 pb-2">Taxação da Plataforma</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Tipo de Taxa</label>
                    <select name="feeType" value={settings.feeType} onChange={handleChange} className="w-full select-field">
                      <option value="percentage">Percentual (%)</option>
                      <option value="fixed">Valor Fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Valor da Taxa</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 font-mono text-sm">{settings.feeType === 'percentage' ? '%' : 'R$'}</span>
                      <input type="number" min="0" step="0.01" name="platformFee" value={settings.platformFee} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono" />
                    </div>
                  </div>
                </div>

                {renderToggle('showFeeToBuyer', 'Mostrar taxas separadas no checkout (Exibir "+ Taxa")', 'Ocultar esta opção embutirá as taxas no preço final visível.')}

              </div>
            </div>
          </div>
        </section>
        )}

        {/* 3. Segurança */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Shield className="w-40 h-40" />
          </div>
          <div className="relative z-10">
            <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
               <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Shield className="w-4 h-4" /></span>
               Segurança e Antifraude
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {renderToggle('requireCPF', 'Validar CPF na Compra', 'Verifica obrigatoriedade e formatação do CPF via Receita durante checkout.')}
                {renderToggle('blockSimultaneous', 'Bloquear compras simultâneas', 'Mecanismo Anti-bot: bloqueia requisições em massa do mesmo IP/Sessão.')}
                {renderToggle('verifyEmail', 'Exigir verificação de e-mail', 'O usuário só compra se confirmar o e-mail previamente.')}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Eventos */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
           <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
               <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Calendar className="w-4 h-4" /></span>
               Gerenciamento de Eventos
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                {renderToggle('allowScheduled', 'Agendamento de publicação', 'Permite definir data e hora futuras para início das vendas.')}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 h-max">
                 <label className="block text-[10px] uppercase opacity-40 mb-3 font-bold tracking-[0.2em]">Status Padrão da Criação do Evento</label>
                 <select name="defaultEventStatus" value={settings.defaultEventStatus} onChange={handleChange} className="w-full select-field">
                    <option value="draft">Rascunho (Requer publicação manual)</option>
                    <option value="published">Publicado Imediatamente</option>
                 </select>
                 <div className="mt-6">
                   <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Lotação Máxima do Local</label>
                   <p className="text-[10px] text-white/50 mb-2">Capacidade total do espaço físico. Usada como teto para todos os eventos.</p>
                   <input
                     type="number"
                     min={1}
                     value={settings.venueMaxCapacity || ''}
                     onChange={(e) => setSettings(prev => ({ ...prev, venueMaxCapacity: Number(e.target.value) || 0 }))}
                     placeholder="Ex: 1500"
                     className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono"
                   />
                 </div>
              </div>
           </div>
        </section>

        {/* 5. Ingressos */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
           <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
               <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Ticket className="w-4 h-4" /></span>
               Regras de Ingressos (Avançado)
           </h3>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Itens Limite por Carrinho</label>
                <input type="number" min="1" step="1" name="maxTicketsPerPurchase" value={settings.maxTicketsPerPurchase} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono" />
              </div>
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Expiração da Reserva (Min)</label>
                <input type="number" min="1" step="1" name="cartExpirationTime" value={settings.cartExpirationTime} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono" />
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
               {renderToggle('lateParticipantInfo', 'Permitir nomeação posterior', 'O ingresso pode ser comprado sem dados e preenchido depois.')}
               {renderToggle('sameOwnerForAll', 'Mesmo titular para todos (Padrão)', 'Sugere preencher os dados do comprador principal para todos os tickets.')}
             </div>
             <div className="space-y-4 border border-white/10 p-6 rounded-xl bg-[#d4af37]/5">
               <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] mb-4 text-[#d4af37] opacity-80">Dados Obrigatórios por Ingresso Nominal</h4>
               {renderToggle('ticketRequireCPF', 'Exigir CPF nominal', 'Trava a entrada ao CPF exato daquele titular.')}
               {renderToggle('ticketRequireName', 'Exigir Nome nominal', '')}
               {renderToggle('ticketRequireEmail', 'Exigir Email nominal', 'Essencial se for enviar convites individuais.')}
             </div>
           </div>
        </section>

        {/* 6. Transferências */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
           <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
               <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Repeat className="w-4 h-4" /></span>
               Transferências e Repasses
           </h3>

           <div className="mb-6">
              {renderToggle('allowTransfer', 'Habilitar Módulo de Transferência', 'Permite que usuários transfiram a titularidade via plataforma.')}
           </div>

           {settings.allowTransfer && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                <div>
                  <label className="flex items-center gap-2 text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">
                    Prazo Max. para Transferência (Horas)
                    <span title="Quantas horas antes do evento interromper as transferências?"><Info className="w-3 h-3 cursor-help mb-0.5" /></span>
                  </label>
                  <input type="number" min="0" step="1" name="transferMaxDelay" value={settings.transferMaxDelay} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono" />
                </div>
                <div className="space-y-4">
                  {renderToggle('multipleTransfers', 'Múltiplas transferências no mesmo ingresso', 'Se falso, o ingresso só pode mudar de dono 1 vez.')}
                  {renderToggle('transferRequireEmail', 'Exigir aceite por email na transferência', 'A transferência só conclui quando o bedeficiário aceita.')}
                </div>
             </div>
           )}
        </section>

        {/* 7. Cancelamentos */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
           <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
               <span className="p-2 bg-[#d4af37]/10 rounded-lg"><XCircle className="w-4 h-4 text-red-500" /></span>
               Regras de Cancelamento
           </h3>

           <div className="mb-6">
              {renderToggle('allowCancellation', 'Permitir Cancelamento pelo App', 'Usuários podem solicitar cancelamento dentro das regras, sem contatar o suporte.')}
           </div>

           {settings.allowCancellation && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Prazo limite (Horas antes do evento)</label>
                    <input type="number" min="0" step="1" name="cancelMaxDelay" value={settings.cancelMaxDelay} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono" />
                  </div>
                  <div>
                     <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Tempo Estimado Reembolso (Dias)</label>
                     <input type="number" min="0" step="1" name="refundProcessTime" value={settings.refundProcessTime} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition font-mono" />
                  </div>
                </div>

                <div className="space-y-6">
                   <div>
                      <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Política de Reembolso</label>
                      <select name="refundType" value={settings.refundType} onChange={handleChange} className="w-full select-field">
                         <option value="total">Integral (Boleto/PIX/Cartão)</option>
                         <option value="partial">Parcial (Dedução de taxa)</option>
                         <option value="no-fee">Valor Nominal (Sem devolução da taxa Espaço Mix)</option>
                      </select>
                   </div>
                   {settings.refundType === 'partial' && (
                     <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Multa de Cancelamento (%)</label>
                        <input type="number" min="0" max="100" step="1" name="cancelFee" value={settings.cancelFee} onChange={handleChange} className="w-full bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/80 transition font-mono" />
                     </div>
                   )}
                </div>
             </div>
           )}
        </section>

        {/* 8. Notificações */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
           <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
               <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Bell className="w-4 h-4" /></span>
               Notificações Automáticas
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderToggle('notifyPurchase', 'Enviar E-mail de Compra', 'Recibo e orientações disparados no sucesso do pagamento.')}
              {renderToggle('notifyTransfer', 'Alertas de Transferência', 'Informar titular antigo e novo na concretização.')}
              {renderToggle('notifyCancel', 'Aviso de Cancelamento/Estorno', 'Formalizar devoluções de crédito.')}
              {renderToggle('notifyReminder', 'Lembrete do Evento (24h)', 'Email automático 24h antes para participantes confirmados.')}
           </div>
        </section>

        {/* 9. Templates de Email */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
          <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
            <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Mail className="w-4 h-4" /></span>
            Templates de Email
          </h3>

          {/* Remetente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Nome do Remetente</label>
              <input
                type="text"
                name="emailSenderName"
                value={settings.emailSenderName}
                onChange={handleChange}
                placeholder="Ex: Espaço Mix"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">E-mail do Remetente</label>
              <input
                type="email"
                name="emailSenderAddress"
                value={settings.emailSenderAddress}
                onChange={handleChange}
                placeholder="onboarding@resend.dev (padrão dev)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
              />
              <p className="text-[11px] text-white/30 mt-1.5">Para produção, verifique seu domínio em resend.com.</p>
            </div>
          </div>

          {/* Variáveis disponíveis */}
          <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3">Variáveis disponíveis nos templates</p>
            <div className="flex flex-wrap gap-2">
              {['{{buyer_name}}','{{event_title}}','{{event_date}}','{{event_time}}','{{event_location}}','{{reservation_id}}','{{total}}','{{payment_method}}'].map(v => (
                <code key={v} className="text-[11px] bg-white/10 text-[#d4af37] px-2 py-1 rounded-md font-mono">{v}</code>
              ))}
            </div>
          </div>

          {/* Email de confirmação */}
          <div className="mb-8 p-5 border border-white/10 rounded-2xl">
            <h4 className="text-xs uppercase tracking-widest font-bold text-white/50 mb-5">Email de Confirmação de Compra</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Assunto</label>
                <input
                  type="text"
                  name="emailPurchaseSubject"
                  value={settings.emailPurchaseSubject}
                  onChange={handleChange}
                  placeholder="Confirmação: seu ingresso para {{event_title}}"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Corpo do Email (HTML — deixe vazio para usar template padrão)</label>
                <textarea
                  name="emailPurchaseBody"
                  value={settings.emailPurchaseBody}
                  onChange={e => setSettings(prev => ({ ...prev, emailPurchaseBody: e.target.value }))}
                  placeholder="Cole seu HTML personalizado aqui..."
                  rows={7}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20 resize-y font-mono"
                />
              </div>
            </div>
          </div>

          {/* Email de lembrete */}
          <div className="p-5 border border-white/10 rounded-2xl">
            <h4 className="text-xs uppercase tracking-widest font-bold text-white/50 mb-5">Lembrete do Evento (24h antes)</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Assunto</label>
                <input
                  type="text"
                  name="emailReminderSubject"
                  value={settings.emailReminderSubject}
                  onChange={handleChange}
                  placeholder="Lembrete: {{event_title}} é amanhã!"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Corpo do Email (HTML — deixe vazio para usar template padrão)</label>
                <textarea
                  name="emailReminderBody"
                  value={settings.emailReminderBody}
                  onChange={e => setSettings(prev => ({ ...prev, emailReminderBody: e.target.value }))}
                  placeholder="Cole seu HTML personalizado aqui..."
                  rows={7}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20 resize-y font-mono"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 10. Relatórios (Admin) */}
        <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
           <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
               <span className="p-2 bg-[#d4af37]/10 rounded-lg"><BarChart2 className="w-4 h-4" /></span>
               Gestão Administrativa (Relatórios)
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderToggle('enableReports', 'Painel de Relatórios Ativo', 'Liberar a visão de Analytics para os organizadores e staffs master.')}
              {renderToggle('allowExport', 'Ativar Exportação (CSV/Excel)', 'Permitir downloads das listas de presença e extratos.')}
              <div className="md:col-span-2 mt-4 bg-red-500/5 border border-red-500/20 p-4 rounded-xl">
                 {renderToggle('showSensitiveData', 'Permitir visualização de dados PII (Master)', 'Forçar exibição completa de documentos e cartões para suporte N3. Útil para auditorias, logado.')}
              </div>
           </div>
        </section>
          </>
        ) : activeTab === 'payments' ? (
          // ABA DE PAGAMENTOS
          <MercadoPagoSettings />
        ) : (
          // ABA MINHA CONTA
          <div className="space-y-6">
          {/* Meus Dados */}
          <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] flex items-center gap-3">
                <span className="p-2 bg-[#d4af37]/10 rounded-lg"><User className="w-4 h-4" /></span>
                Meus Dados
              </h3>
              {!profileEditing ? (
                <button
                  onClick={() => { setProfileForm(profileData); setProfileEditing(true); }}
                  className="px-4 py-2 border border-white/10 rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/5 transition text-white/70"
                >Editar</button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setProfileEditing(false); setProfileError(''); }}
                    className="px-3 py-2 border border-white/10 rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/5 transition text-white/50"
                  >Cancelar</button>
                  <button
                    onClick={saveMyProfile}
                    disabled={profileSaving}
                    className="px-4 py-2 bg-[#d4af37] text-black rounded-xl text-[10px] uppercase tracking-widest font-bold hover:brightness-110 transition disabled:opacity-60"
                  >{profileSaving ? 'Salvando…' : 'Salvar'}</button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <ProfileRow icon={<User className="w-4 h-4" />} label="Nome Completo">
                {profileEditing ? (
                  <input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]/50 transition" />
                ) : <p className="text-sm text-white">{profileData.name || '—'}</p>}
              </ProfileRow>
              <ProfileRow icon={<Shield className="w-4 h-4" />} label="Usuário">
                <p className="text-sm text-white/70">{myProfile?.username || '—'}</p>
              </ProfileRow>
              <ProfileRow icon={<Mail className="w-4 h-4" />} label="E-mail">
                <p className="text-sm text-white/70">{myProfile?.email || '—'}</p>
              </ProfileRow>
              <ProfileRow icon={<Phone className="w-4 h-4" />} label="Telefone">
                {profileEditing ? (
                  <input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]/50 transition" />
                ) : <p className="text-sm text-white/70">{profileData.phone || '—'}</p>}
              </ProfileRow>
              <ProfileRow icon={<FileText className="w-4 h-4" />} label="CPF">
                {profileEditing ? (
                  <input value={profileForm.cpf} onChange={e => setProfileForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" maxLength={14}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]/50 transition" />
                ) : <p className="text-sm text-white/70">{profileData.cpf || '—'}</p>}
              </ProfileRow>
              <ProfileRow icon={<Calendar className="w-4 h-4" />} label="Data de Nascimento">
                {profileEditing ? (
                  <input type="date" value={profileForm.birth_date} onChange={e => setProfileForm(f => ({ ...f, birth_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]/50 transition" />
                ) : <p className="text-sm text-white/70">{profileData.birth_date ? new Date(profileData.birth_date).toLocaleDateString('pt-BR') : '—'}</p>}
              </ProfileRow>
              {profileError && <p className="text-red-400 text-xs">{profileError}</p>}
            </div>
          </section>

          {/* Alterar Credenciais */}
          <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg">
            <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-8 flex items-center gap-3">
              <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Shield className="w-4 h-4" /></span>
              Alterar Credenciais de Acesso
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Novo E-mail / Usuário</label>
                <input
                  type="email"
                  name="new-credential-email"
                  autoComplete="off"
                  placeholder="Deixe em branco para não alterar"
                  value={credForm.email}
                  onChange={e => setCredForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Nova Senha</label>
                <input
                  type="password"
                  name="new-credential-password"
                  autoComplete="new-password"
                  placeholder="Deixe em branco para não alterar"
                  value={credForm.password}
                  onChange={e => setCredForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Confirmar Nova Senha</label>
                <input
                  type="password"
                  name="confirm-credential-password"
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  value={credForm.confirmPassword}
                  onChange={e => setCredForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
                />
              </div>

              {credError && (
                <p className="text-red-400 text-xs">{credError}</p>
              )}

              <button
                disabled={credStatus === 'saving'}
                onClick={async () => {
                  setCredError('');
                  const updates: { email?: string; password?: string } = {};
                  if (credForm.email.trim()) updates.email = credForm.email.trim();
                  if (credForm.password) {
                    if (credForm.password.length < 6) { setCredError('A senha deve ter no mínimo 6 caracteres.'); return; }
                    if (credForm.password !== credForm.confirmPassword) { setCredError('As senhas não coincidem.'); return; }
                    updates.password = credForm.password;
                  }
                  if (!Object.keys(updates).length) { setCredError('Preencha ao menos um campo para alterar.'); return; }
                  setCredStatus('saving');
                  try {
                    await updateMyCredentials(updates);
                    setCredStatus('saved');
                    setCredForm({ email: '', password: '', confirmPassword: '' });
                    setTimeout(() => setCredStatus('idle'), 3000);
                  } catch (err: any) {
                    setCredError(err.message || 'Erro ao atualizar credenciais.');
                    setCredStatus('error');
                    setTimeout(() => setCredStatus('idle'), 3000);
                  }
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest bg-[#d4af37] text-black hover:brightness-110 disabled:opacity-50 transition"
              >
                {credStatus === 'saving' ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : credStatus === 'saved' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {credStatus === 'saved' ? 'Salvo!' : 'Salvar Credenciais'}
              </button>

              <p className="text-white/30 text-[11px]">
                Se alterar o e-mail, você precisará fazer login novamente com o novo endereço.
              </p>
            </div>
          </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-white/8 bg-white/[0.02]">
      <div className="flex items-center gap-2 mb-2 text-white/30">
        {icon}
        <p className="text-[9px] uppercase tracking-widest">{label}</p>
      </div>
      {children}
    </div>
  );
}

