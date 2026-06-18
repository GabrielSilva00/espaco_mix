import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck, User, Building2, Check, ArrowRight, ArrowLeft,
  Loader2, AlertCircle, Eye, EyeOff, Plus, X,
  Upload, PartyPopper,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  updateProfile, updateMyCredentials, updateSystemConfig, getSystemConfigAdmin,
  uploadAsset,
} from '../lib/supabase';

const STEPS = [
  { id: 1, label: 'Seus dados', icon: User },
  { id: 2, label: 'Site/Empresa', icon: Building2 },
];

const ONBOARDING_GUARD = 'eventix-onboarding-done';

/**
 * Configuração inicial do administrador (2 etapas: seus dados + site/empresa),
 * exibida no primeiro acesso. Ao informar os dados da empresa, as configurações
 * básicas (incl. e-mail de contato e remetente) já ficam prontas — pagamento e
 * e-mail são ajustados depois nas Configurações. Permite pular. Ao concluir,
 * marca onboarding_completed.
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

  // Remetente de e-mail já configurado (se houver) — usado para não sobrescrever
  // ao autopreencher a partir do e-mail da empresa no item 10.
  const [existingSender, setExistingSender] = useState<{ name: string; address: string }>({ name: '', address: '' });

  // Pré-preenche com o que já existir
  useEffect(() => {
    getSystemConfigAdmin().then(c => {
      setSiteName(c.site_name ?? '');
      setLogoPreview(c.site_logo_url ?? '');
      setCompanyName(c.company_name ?? '');
      setDocument(c.document ?? '');
      setAddress(c.address ?? '');
      setContactPhone(c.contact_phone ?? '');
      setContactEmail(c.contact_email ?? '');
      setSocialLinks(Array.isArray(c.social_links) ? c.social_links as any : []);
      setExistingSender({ name: c.email_sender_name ?? '', address: c.email_sender_address ?? '' });
    }).catch(() => {});
  }, []);

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#d4af37] outline-none transition placeholder:text-white/20';

  // Traduz mensagens conhecidas do Supabase para PT-BR (credenciais opcionais).
  const friendlyAuthError = (msg: string): string => {
    const m = (msg || '').toLowerCase();
    if (m.includes('different from the old password')) return 'A nova senha deve ser diferente da atual.';
    if (m.includes('already registered') || m.includes('already been registered') || m.includes('email address is already')) return 'Este e-mail já está em uso por outra conta.';
    if (m.includes('email') && m.includes('invalid')) return 'E-mail inválido.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns instantes e tente de novo.';
    return msg || 'Não foi possível atualizar e-mail/senha.';
  };

  // ── Salvamentos por etapa ──────────────────────────────────────────────
  // Só o NOME é obrigatório. Avatar, e-mail e senha são opcionais: se algum
  // falhar (RLS de storage, senha igual à atual, e-mail em uso, confirmação de
  // troca de e-mail), avisamos mas NÃO travamos a conclusão do onboarding.
  const saveStep1 = async () => {
    if (!name.trim()) { showToast('Informe seu nome.', 'error'); return false; }
    if (newPassword && newPassword.length < 6) { showToast('A nova senha deve ter ao menos 6 caracteres.', 'error'); return false; }
    if (newPassword && newPassword !== confirmPassword) { showToast('As senhas não coincidem.', 'error'); return false; }

    // Avatar (opcional) — falha não impede salvar o nome.
    let avatarUrl = avatarPreview;
    if (avatarFile) {
      try { avatarUrl = await uploadAsset(avatarFile, 'avatars'); }
      catch { showToast('Não foi possível enviar a foto agora — você pode adicioná-la depois em Configurações.', 'warning'); avatarUrl = avatarPreview; }
    }

    // Nome (essencial) — se falhar, aborta a etapa.
    try {
      if (loggedInUserId && loggedInUserId !== 'dev') {
        await updateProfile(loggedInUserId, { name: name.trim(), avatar_url: avatarUrl || undefined });
      }
    } catch (e: any) { showToast(e?.message ?? 'Falha ao salvar seus dados.', 'error'); return false; }

    // E-mail/senha (opcionais) — falha vira aviso, não bloqueia a conclusão.
    const creds: { email?: string; password?: string } = {};
    if (email && email !== sessionUser?.email) creds.email = email.trim();
    if (newPassword) creds.password = newPassword;
    if (creds.email || creds.password) {
      try { await updateMyCredentials(creds); }
      catch (e: any) { showToast(friendlyAuthError(e?.message) + ' Seus demais dados foram salvos; ajuste isso depois em Configurações.', 'warning'); }
    }

    if (sessionUser) setSessionUser({ ...sessionUser, name: name.trim(), email: email || sessionUser.email, avatarUrl: avatarUrl || sessionUser.avatarUrl });
    setNewPassword(''); setConfirmPassword('');
    return true;
  };

  const saveStep2 = async () => {
    if (!siteName.trim()) { showToast('Informe o nome do site.', 'error'); return false; }
    if (!companyName.trim()) { showToast('Informe a razão social.', 'error'); return false; }
    if (!document.trim()) { showToast('Informe o CNPJ.', 'error'); return false; }
    try {
      let logoUrl = logoPreview;
      if (logoFile) logoUrl = await uploadAsset(logoFile, 'branding');
      const publicEmail = contactEmail.trim();
      await updateSystemConfig({
        site_name: siteName.trim(),
        site_logo_url: logoUrl || undefined,
        company_name: companyName.trim(),
        document: document.trim(),
        address: address.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_email: publicEmail || undefined,
        // Item 10 — autopreenche o remetente com o e-mail da empresa quando ainda
        // não há um configurado; o admin pode trocar depois em Configurações.
        email_sender_address: existingSender.address || publicEmail || undefined,
        email_sender_name: existingSender.name || siteName.trim() || undefined,
        social_links: socialLinks.filter(s => s.url.trim()),
      } as any);
      setSiteConfig(prev => ({ ...prev, platformName: siteName.trim(), platformLogo: logoUrl || prev.platformLogo }));
      return true;
    } catch (e: any) { showToast(e?.message ?? 'Falha ao salvar dados do site.', 'error'); return false; }
  };

  // Valida os campos da etapa sem chamar APIs — dados são salvos só no finish()
  const validateCurrent = (): boolean => {
    if (step === 1) {
      if (!name.trim()) { showToast('Informe seu nome.', 'error'); return false; }
      if (newPassword && newPassword.length < 6) { showToast('A nova senha deve ter ao menos 6 caracteres.', 'error'); return false; }
      if (newPassword && newPassword !== confirmPassword) { showToast('As senhas não coincidem.', 'error'); return false; }
    }
    if (step === 2) {
      if (!siteName.trim()) { showToast('Informe o nome do site.', 'error'); return false; }
      if (!companyName.trim()) { showToast('Informe a razão social.', 'error'); return false; }
      if (!document.trim()) { showToast('Informe o CNPJ.', 'error'); return false; }
    }
    return true;
  };

  const next = () => {
    if (!validateCurrent()) return;
    setStepDone(prev => ({ ...prev, [step]: true }));
    // Só há 2 etapas (1 e 2); da 2 vai direto para a conclusão (5).
    setStep(s => (s >= 2 ? 5 : s + 1));
  };

  const closeOnboarding = (markDone: boolean) => {
    // Guard de localStorage é a fonte imediata: garante que NÃO reabra mesmo se a
    // escrita no banco falhar (ex.: coluna ainda não migrada).
    try { localStorage.setItem(ONBOARDING_GUARD, '1'); } catch { /* ignore */ }
    if (markDone) { updateSystemConfig({ onboarding_completed: true } as any).catch(() => {}); }
    setShowOnboarding(false);
  };

  const finish = async () => {
    setSaving(true);
    const ok1 = await saveStep1();
    if (!ok1) { setSaving(false); setStep(1); return; }
    const ok2 = await saveStep2();
    if (!ok2) { setSaving(false); setStep(2); return; }
    setSaving(false);
    closeOnboarding(true);
    showToast('Configuração concluída!', 'success');
  };
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
            {step === 5 ? 'Revise e conclua' : `Etapa ${step} de 2`}
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

          {step === 5 && (
            <div className="space-y-3 py-2">
              {[
                { n: 'Seus dados', ok: stepDone[1] },
                { n: 'Site e empresa', ok: stepDone[2] },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-sm text-white/80">{r.n}</span>
                  {r.ok ? <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-green-400 font-bold"><Check className="w-3.5 h-3.5" /> Configurado</span>
                        : <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-400 font-bold"><AlertCircle className="w-3.5 h-3.5" /> Incompleto</span>}
                </div>
              ))}
              <p className="text-[11px] text-white/40 text-center pt-2">Pronto! Pagamento (Mercado Pago) e e-mail são ajustados quando quiser em <strong>Configurações</strong>.</p>
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
              <button onClick={() => setStep(2)} disabled={saving} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white">Revisar</button>
            )}
            {step < 5 && (
              <button onClick={skip} disabled={saving} className="text-[10px] uppercase tracking-widest text-white/25 hover:text-white/60">Pular por agora</button>
            )}
          </div>
          {step < 5 ? (
            <button onClick={next} disabled={saving} className="flex items-center gap-2 bg-[#d4af37] text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} {step === 2 ? 'Revisar' : 'Continuar'}
            </button>
          ) : (
            <button onClick={finish} disabled={saving} className="flex items-center gap-2 bg-[#d4af37] text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widests hover:brightness-110 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Concluir configuração
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
