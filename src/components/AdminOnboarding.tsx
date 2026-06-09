import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck, User, Building2, CreditCard, Mail, Check, ArrowRight, ArrowLeft,
  Loader2, AlertCircle, AlertTriangle, Eye, EyeOff, Copy, Plus, X,
  Upload, PartyPopper, Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  updateProfile, updateMyCredentials, updateSystemConfig, getSystemConfig,
  uploadAsset, getAccessTokenSafe,
} from '../lib/supabase';

const STEPS = [
  { id: 1, label: 'Seus dados', icon: User },
  { id: 2, label: 'Site/Empresa', icon: Building2 },
  { id: 3, label: 'Pagamento', icon: CreditCard },
  { id: 4, label: 'E-mail', icon: Mail },
];

const ONBOARDING_GUARD = 'eventix-onboarding-done';

async function authedFetch(path: string, body?: any, method = 'POST') {
  const token = await getAccessTokenSafe();
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Configuração inicial do administrador (4 etapas), exibida no primeiro acesso.
 * Salva cada etapa ao avançar (não perde progresso). Segredos vão criptografados
 * no servidor. Permite pular. Ao concluir, marca onboarding_completed.
 */
export function AdminOnboarding() {
  const { sessionUser, loggedInUserId, setSessionUser, setShowOnboarding, setSiteConfig, showToast } = useApp();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [stepDone, setStepDone] = useState<Record<number, boolean>>({});

  // ── Etapa 1 — admin
  const [name, setName] = useState(sessionUser?.name ?? '');
  const [email, setEmail] = useState(sessionUser?.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(sessionUser?.avatarUrl ?? '');
  const [showPwd, setShowPwd] = useState(false);

  // ── Etapa 2 — site/empresa
  const [siteName, setSiteName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [socialLinks, setSocialLinks] = useState<{ label: string; url: string }[]>([]);

  // ── Etapa 3 — pagamento
  const [mpToken, setMpToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpEnv, setMpEnv] = useState<'production' | 'test'>('production');
  const [showMpToken, setShowMpToken] = useState(false);
  const [mpConfigured, setMpConfigured] = useState(false);
  const webhookUrl = `${window.location.origin}/api/webhook/mercadopago`;

  // ── Etapa 4 — e-mail
  const [provider, setProvider] = useState<'resend' | 'smtp'>('resend');
  const [resendKey, setResendKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [senderName, setSenderName] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [notifyWebhook, setNotifyWebhook] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [testMsg, setTestMsg] = useState('');

  // Pré-preenche com o que já existir
  useEffect(() => {
    getSystemConfig().then(c => {
      setSiteName(c.site_name ?? '');
      setLogoPreview(c.site_logo_url ?? '');
      setCompanyName(c.company_name ?? '');
      setDocument(c.document ?? '');
      setAddress(c.address ?? '');
      setContactPhone(c.contact_phone ?? '');
      setContactEmail(c.contact_email ?? '');
      setSocialLinks(Array.isArray(c.social_links) ? c.social_links as any : []);
      setMpPublicKey(c.mp_public_key ?? '');
      setMpEnv((c.mp_environment as any) ?? 'production');
      setProvider((c.email_provider as any) ?? 'resend');
      setSmtpHost(c.smtp_host ?? '');
      setSmtpPort(c.smtp_port ? String(c.smtp_port) : '587');
      setSmtpUser(c.smtp_user ?? '');
      setSmtpSecure(c.smtp_secure ?? true);
      setSenderName(c.email_sender_name ?? '');
      setSenderAddress(c.email_sender_address ?? '');
      setNotifyWebhook(c.notify_webhook_url ?? '');
    }).catch(() => {});
    authedFetch('/api/admin/payment-status', undefined, 'GET').then(r => { if (r.ok) setMpConfigured(!!r.data.configured); }).catch(() => {});
    authedFetch('/api/admin/email-status', undefined, 'GET').then(r => { if (r.ok) setEmailConfigured(!!r.data.configured); }).catch(() => {});
  }, []);

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#d4af37] outline-none transition placeholder:text-white/20';

  // ── Salvamentos por etapa ──────────────────────────────────────────────
  const saveStep1 = async () => {
    if (!name.trim()) { showToast('Informe seu nome.', 'error'); return false; }
    if (newPassword && newPassword.length < 6) { showToast('A nova senha deve ter ao menos 6 caracteres.', 'error'); return false; }
    if (newPassword && newPassword !== confirmPassword) { showToast('As senhas não coincidem.', 'error'); return false; }
    try {
      let avatarUrl = avatarPreview;
      if (avatarFile) avatarUrl = await uploadAsset(avatarFile, 'avatars');
      if (loggedInUserId && loggedInUserId !== 'dev') {
        await updateProfile(loggedInUserId, { name: name.trim(), avatar_url: avatarUrl || undefined });
      }
      const creds: { email?: string; password?: string } = {};
      if (email && email !== sessionUser?.email) creds.email = email.trim();
      if (newPassword) creds.password = newPassword;
      if (creds.email || creds.password) await updateMyCredentials(creds);
      if (sessionUser) setSessionUser({ ...sessionUser, name: name.trim(), email: email || sessionUser.email, avatarUrl: avatarUrl || sessionUser.avatarUrl });
      setNewPassword(''); setConfirmPassword('');
      return true;
    } catch (e: any) { showToast(e?.message ?? 'Falha ao salvar seus dados.', 'error'); return false; }
  };

  const saveStep2 = async () => {
    if (!siteName.trim()) { showToast('Informe o nome do site.', 'error'); return false; }
    if (!companyName.trim()) { showToast('Informe a razão social.', 'error'); return false; }
    if (!document.trim()) { showToast('Informe o CNPJ.', 'error'); return false; }
    try {
      let logoUrl = logoPreview;
      if (logoFile) logoUrl = await uploadAsset(logoFile, 'branding');
      await updateSystemConfig({
        site_name: siteName.trim(),
        site_logo_url: logoUrl || undefined,
        company_name: companyName.trim(),
        document: document.trim(),
        address: address.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        social_links: socialLinks.filter(s => s.url.trim()),
      } as any);
      setSiteConfig(prev => ({ ...prev, platformName: siteName.trim(), platformLogo: logoUrl || prev.platformLogo }));
      return true;
    } catch (e: any) { showToast(e?.message ?? 'Falha ao salvar dados do site.', 'error'); return false; }
  };

  const saveStep3 = async () => {
    // Pagamento é opcional para avançar, mas se preencher o token, salva.
    if (!mpToken && !mpConfigured) {
      showToast('Você pode configurar o pagamento agora ou depois nas Configurações.', 'info');
      return true;
    }
    try {
      const r = await authedFetch('/api/admin/payment-credentials', {
        accessToken: mpToken || undefined,
        publicKey: mpPublicKey || undefined,
        environment: mpEnv,
      });
      if (!r.ok) { showToast(r.data.error || 'Falha ao salvar credenciais.', 'error'); return false; }
      setMpToken(''); setMpConfigured(true);
      return true;
    } catch { showToast('Erro de conexão ao salvar pagamento.', 'error'); return false; }
  };

  const saveStep4 = async () => {
    if (!senderAddress.trim()) { showToast('Informe o e-mail remetente.', 'error'); return false; }
    try {
      const r = await authedFetch('/api/admin/email-config', {
        provider,
        resendApiKey: provider === 'resend' ? (resendKey || undefined) : undefined,
        smtp: provider === 'smtp' ? { host: smtpHost, port: Number(smtpPort) || 587, user: smtpUser, password: smtpPassword || undefined, secure: smtpSecure } : undefined,
        senderName: senderName.trim(),
        senderAddress: senderAddress.trim(),
        notifyWebhookUrl: notifyWebhook.trim() || undefined,
      });
      if (!r.ok) { showToast(r.data.error || 'Falha ao salvar e-mail.', 'error'); return false; }
      setResendKey(''); setSmtpPassword(''); setEmailConfigured(true);
      return true;
    } catch { showToast('Erro de conexão ao salvar e-mail.', 'error'); return false; }
  };

  const saveCurrent = async () => {
    if (step === 1) return saveStep1();
    if (step === 2) return saveStep2();
    if (step === 3) return saveStep3();
    if (step === 4) return saveStep4();
    return true;
  };

  const next = async () => {
    setSaving(true);
    const ok = await saveCurrent();
    setSaving(false);
    if (!ok) return;
    setStepDone(prev => ({ ...prev, [step]: true }));
    setStep(s => Math.min(5, s + 1)); // 5 = conclusão
  };

  const handleTestEmail = async () => {
    setTestStatus('sending'); setTestMsg('');
    const saved = await saveStep4();
    if (!saved) { setTestStatus('err'); setTestMsg('Salve a configuração antes de testar.'); return; }
    const r = await authedFetch('/api/admin/test-email', { to: email || sessionUser?.email });
    if (r.ok) { setTestStatus('ok'); setTestMsg(r.data.message || 'E-mail de teste enviado!'); }
    else { setTestStatus('err'); setTestMsg(r.data.error || 'Falha ao enviar teste.'); }
    setTimeout(() => setTestStatus('idle'), 6000);
  };

  const closeOnboarding = (markDone: boolean) => {
    // Guard de localStorage é a fonte imediata: garante que NÃO reabra mesmo se a
    // escrita no banco falhar (ex.: coluna ainda não migrada).
    try { localStorage.setItem(ONBOARDING_GUARD, '1'); } catch { /* ignore */ }
    if (markDone) { updateSystemConfig({ onboarding_completed: true } as any).catch(() => {}); }
    setShowOnboarding(false);
  };

  const finish = () => { closeOnboarding(true); showToast('Configuração concluída!', 'success'); };
  const skip = () => { closeOnboarding(false); showToast('Você pode concluir depois nas Configurações.', 'info'); };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-[#0a0a0a]/95 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-2xl bg-[#0d0d0d] border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-4"
      >
        {/* Cabeçalho */}
        <div className="p-5 md:p-7 border-b border-white/5 text-center">
          <div className="w-11 h-11 rounded-2xl bg-[#d4af37]/10 flex items-center justify-center mx-auto mb-3">
            {step === 5 ? <PartyPopper className="w-5 h-5 text-[#d4af37]" /> : <ShieldCheck className="w-5 h-5 text-[#d4af37]" />}
          </div>
          <h1 className="text-lg md:text-xl font-serif text-[#d4af37]">
            {step === 5 ? 'Tudo pronto!' : 'Vamos configurar seu site'}
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-40 mt-1">
            {step === 5 ? 'Revise e conclua' : `Etapa ${step} de 4`}
          </p>
        </div>

        {/* Stepper */}
        {step < 5 && (
          <div className="flex items-center justify-center gap-1.5 py-4 px-4 flex-wrap">
            {STEPS.map((s, i) => {
              const Icon = s.icon; const active = step === s.id; const done = step > s.id || stepDone[s.id];
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => done && setStep(s.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition ${
                      active ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]'
                      : done ? 'border-green-500/40 bg-green-500/10 text-green-400'
                      : 'border-white/10 text-white/30'}`}
                  >
                    {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                    <span className="text-[9px] uppercase tracking-widest font-bold hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className={`w-3 h-px ${done ? 'bg-green-500/40' : 'bg-white/10'}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Conteúdo */}
        <div className="px-5 md:px-7 pb-2 space-y-4 max-h-[55vh] overflow-y-auto custom-scrollbar">
          {step === 1 && (
            <>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                  {avatarPreview ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-white/20" />}
                </div>
                <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#d4af37] cursor-pointer hover:brightness-110">
                  <Upload className="w-3.5 h-3.5" /> Foto de perfil (opcional)
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />
                </label>
              </div>
              <Field label="Nome completo *"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Nome do administrador" /></Field>
              <Field label="E-mail de acesso *"><input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nova senha (troque a padrão)">
                  <div className="relative">
                    <input className={inputCls} type={showPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </Field>
                <Field label="Confirmar senha"><input className={inputCls} type={showPwd ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" /></Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                  {logoPreview ? <img src={logoPreview} alt="" className="w-full h-full object-contain p-1" /> : <Building2 className="w-6 h-6 text-white/20" />}
                </div>
                <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#d4af37] cursor-pointer hover:brightness-110">
                  <Upload className="w-3.5 h-3.5" /> Logo do site (opcional)
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }} />
                </label>
              </div>
              <Field label="Nome do site *"><input className={inputCls} value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="Ex: Espaço Mix" /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Razão social *"><input className={inputCls} value={companyName} onChange={e => setCompanyName(e.target.value)} /></Field>
                <Field label="CNPJ *"><input className={inputCls} value={document} onChange={e => setDocument(e.target.value)} placeholder="00.000.000/0000-00" /></Field>
              </div>
              <Field label="Endereço completo"><input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Telefone de contato"><input className={inputCls} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(11) 99999-9999" /></Field>
                <Field label="E-mail público"><input className={inputCls} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} /></Field>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] uppercase tracking-[2px] opacity-50">Redes sociais (opcional)</label>
                  <button type="button" onClick={() => setSocialLinks([...socialLinks, { label: '', url: '' }])} className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#d4af37] hover:brightness-110"><Plus className="w-3 h-3" /> Adicionar</button>
                </div>
                <div className="space-y-2">
                  {socialLinks.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input className={inputCls + ' flex-[0.4]'} placeholder="Rede (ex: Instagram)" value={s.label} onChange={e => { const a = [...socialLinks]; a[i] = { ...a[i], label: e.target.value }; setSocialLinks(a); }} />
                      <input className={inputCls + ' flex-1'} placeholder="https://…" value={s.url} onChange={e => { const a = [...socialLinks]; a[i] = { ...a[i], url: e.target.value }; setSocialLinks(a); }} />
                      <button type="button" onClick={() => setSocialLinks(socialLinks.filter((_, j) => j !== i))} className="px-2 text-white/30 hover:text-red-400"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Use somente credenciais de <strong>produção</strong> (começam com <code>APP_USR-</code>). Credenciais de teste não processam pagamentos reais.</p>
              </div>
              {mpConfigured && !mpToken && <p className="text-[11px] text-green-400">✓ Já existe um Access Token salvo. Preencha de novo só se quiser trocar.</p>}
              <Field label="Access Token de produção">
                <div className="relative">
                  <input className={inputCls} type={showMpToken ? 'text' : 'password'} value={mpToken} onChange={e => setMpToken(e.target.value)} placeholder="APP_USR-…" />
                  <button type="button" onClick={() => setShowMpToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">{showMpToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </Field>
              <Field label="Public Key de produção"><input className={inputCls} value={mpPublicKey} onChange={e => setMpPublicKey(e.target.value)} placeholder="APP_USR-…" /></Field>
              <Field label="URL do Webhook (cole no painel do Mercado Pago)">
                <div className="flex gap-2">
                  <input className={inputCls + ' font-mono text-xs text-white/60'} value={webhookUrl} readOnly />
                  <button type="button" onClick={() => navigator.clipboard.writeText(webhookUrl)} className="px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/50"><Copy className="w-4 h-4" /></button>
                </div>
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <Field label="Provedor de e-mail">
                <div className="flex gap-2">
                  {(['resend', 'smtp'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setProvider(p)} className={`flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-bold border transition ${provider === p ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]' : 'bg-white/5 border-white/10 text-white/40'}`}>{p === 'resend' ? 'Resend' : 'SMTP'}</button>
                  ))}
                </div>
              </Field>
              {emailConfigured && <p className="text-[11px] text-green-400">✓ E-mail já configurado. Preencha os segredos de novo só para trocar.</p>}
              {provider === 'resend' ? (
                <Field label="Resend API Key">
                  <div className="relative">
                    <input className={inputCls} type={showSecrets ? 'text' : 'password'} value={resendKey} onChange={e => setResendKey(e.target.value)} placeholder="re_…" />
                    <button type="button" onClick={() => setShowSecrets(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">{showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </Field>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Host"><input className={inputCls} value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" /></Field>
                    <Field label="Porta"><input className={inputCls} value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" /></Field>
                    <Field label="TLS/SSL">
                      <button type="button" onClick={() => setSmtpSecure(v => !v)} className={`w-full py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold border ${smtpSecure ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]' : 'bg-white/5 border-white/10 text-white/40'}`}>{smtpSecure ? 'Ativado' : 'Desativado'}</button>
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Usuário"><input className={inputCls} value={smtpUser} onChange={e => setSmtpUser(e.target.value)} /></Field>
                    <Field label="Senha">
                      <div className="relative">
                        <input className={inputCls} type={showSecrets ? 'text' : 'password'} value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} />
                        <button type="button" onClick={() => setShowSecrets(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">{showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      </div>
                    </Field>
                  </div>
                </>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome do remetente *"><input className={inputCls} value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Espaço Mix" /></Field>
                <Field label="E-mail remetente *"><input className={inputCls} type="email" value={senderAddress} onChange={e => setSenderAddress(e.target.value)} placeholder="noreply@seudominio.com" /></Field>
              </div>
              <Field label="Webhook de notificações (Slack/Discord — opcional)"><input className={inputCls} value={notifyWebhook} onChange={e => setNotifyWebhook(e.target.value)} placeholder="https://…" /></Field>
              <div>
                <button type="button" onClick={handleTestEmail} disabled={testStatus === 'sending'} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest font-bold text-white/70 hover:bg-white/10 disabled:opacity-50">
                  {testStatus === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Testar envio
                </button>
                {testMsg && <p className={`text-[11px] mt-2 ${testStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{testMsg}</p>}
              </div>
            </>
          )}

          {step === 5 && (
            <div className="space-y-3 py-2">
              {[
                { n: 'Seus dados', ok: stepDone[1] },
                { n: 'Site e empresa', ok: stepDone[2] },
                { n: 'Pagamento (Mercado Pago)', ok: mpConfigured },
                { n: 'E-mail / notificações', ok: emailConfigured },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-sm text-white/80">{r.n}</span>
                  {r.ok ? <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-green-400 font-bold"><Check className="w-3.5 h-3.5" /> Configurado</span>
                        : <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-400 font-bold"><AlertCircle className="w-3.5 h-3.5" /> Incompleto</span>}
                </div>
              ))}
              <p className="text-[11px] text-white/40 text-center pt-2">Você poderá editar tudo depois em <strong>Configurações</strong>.</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-5 md:p-7 flex items-center justify-between gap-3 border-t border-white/5 mt-2">
          <div className="flex items-center gap-3">
            {step > 1 && step < 5 && (
              <button onClick={() => setStep(s => s - 1)} disabled={saving} className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" /> Voltar</button>
            )}
            {step === 5 && (
              <button onClick={() => setStep(1)} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white">Revisar</button>
            )}
            {step < 5 && (
              <button onClick={skip} disabled={saving} className="text-[10px] uppercase tracking-widest text-white/25 hover:text-white/60">Pular por agora</button>
            )}
          </div>
          {step < 5 ? (
            <button onClick={next} disabled={saving} className="flex items-center gap-2 bg-[#d4af37] text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} {step === 4 ? 'Revisar' : 'Continuar'}
            </button>
          ) : (
            <button onClick={finish} className="flex items-center gap-2 bg-[#d4af37] text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110">
              <Check className="w-4 h-4" /> Ir para o painel
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">{label}</label>
      {children}
    </div>
  );
}
