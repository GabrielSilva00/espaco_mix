import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { User, Edit2, Save, X, Camera, Phone, FileText, Calendar, Mail, ShieldCheck, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { updateProfile } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

export function ProfileView() {
  const { sessionUser, setSessionUser, loggedInUserId, userRole, setCurrentView, showToast } = useApp();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: sessionUser?.name || '',
    phone: '',
    cpf: '',
    birth_date: '',
  });

  const startEdit = () => {
    setForm({ name: sessionUser?.name || '', phone: '', cpf: '', birth_date: '' });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveProfile = async () => {
    if (!loggedInUserId) return;
    if (!form.name.trim()) { showToast('Nome é obrigatório', 'error'); return; }
    setSaving(true);
    try {
      const updated = await updateProfile(loggedInUserId, {
        name: form.name.trim(),
        phone: form.phone || undefined,
        cpf: form.cpf || undefined,
        birth_date: form.birth_date || undefined,
      });
      setSessionUser(prev => prev ? { ...prev, name: updated.name } : prev);
      showToast('Perfil atualizado com sucesso!', 'success');
      setEditing(false);
    } catch (err: any) {
      showToast('Erro ao salvar: ' + (err?.message || String(err)), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !loggedInUserId) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${loggedInUserId}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile(loggedInUserId, { avatar_url: publicUrl });
      setSessionUser(prev => prev ? { ...prev, avatarUrl: publicUrl } : prev);
      showToast('Foto atualizada!', 'success');
    } catch (err: any) {
      showToast('Erro ao enviar foto: ' + (err?.message || String(err)), 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const roleLabelMap: Record<string, string> = {
    admin: 'Administrador',
    developer: 'Desenvolvedor',
    client: 'Cliente',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header com avatar */}
        <div className="relative h-28 bg-gradient-to-br from-[#d4af37]/20 to-transparent border-b border-white/5">
          <div className="absolute -bottom-12 left-8">
            <div className="relative w-24 h-24 rounded-full border-4 border-[#0d0d0d] bg-[#1a1a1a] flex items-center justify-center overflow-hidden group">
              {sessionUser?.avatarUrl ? (
                <img src={sessionUser.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white/30" />
              )}
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
        </div>

        <div className="px-8 pt-16 pb-8">
          {/* Nome e role */}
          <div className="flex items-start justify-between mb-8 gap-4">
            <div>
              <h1 className="text-xl font-serif text-white">{sessionUser?.name || 'Usuário'}</h1>
              <div className="flex items-center gap-2 mt-1">
                <ShieldCheck className="w-3 h-3 text-[#d4af37]" />
                <span className="text-[10px] uppercase tracking-widest text-[#d4af37]">
                  {roleLabelMap[userRole || 'client'] || 'Cliente'}
                </span>
              </div>
            </div>
            {!editing ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/5 transition text-white/70"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-2 border border-white/10 rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/5 transition text-white/50"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#d4af37] text-black rounded-xl text-[10px] uppercase tracking-widest font-bold hover:bg-[#c9a227] transition disabled:opacity-60"
                >
                  {saving ? <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </button>
              </div>
            )}
          </div>

          {/* Campos */}
          <div className="space-y-4">
            {/* E-mail (sempre read-only) */}
            <Field icon={<Mail className="w-4 h-4" />} label="E-mail">
              <p className="text-sm text-white/70">{sessionUser?.email || '—'}</p>
            </Field>

            {/* Nome */}
            <Field icon={<User className="w-4 h-4" />} label="Nome Completo">
              {editing ? (
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#d4af37] transition"
                />
              ) : (
                <p className="text-sm text-white">{sessionUser?.name || '—'}</p>
              )}
            </Field>

            {/* Telefone */}
            <Field icon={<Phone className="w-4 h-4" />} label="Telefone">
              {editing ? (
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#d4af37] transition"
                />
              ) : (
                <p className="text-sm text-white/70">{form.phone || '—'}</p>
              )}
            </Field>

            {/* CPF */}
            <Field icon={<FileText className="w-4 h-4" />} label="CPF">
              {editing ? (
                <input
                  value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#d4af37] transition"
                />
              ) : (
                <p className="text-sm text-white/70">{form.cpf || '—'}</p>
              )}
            </Field>

            {/* Data de nascimento */}
            <Field icon={<Calendar className="w-4 h-4" />} label="Data de Nascimento">
              {editing ? (
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#d4af37] transition"
                />
              ) : (
                <p className="text-sm text-white/70">{form.birth_date ? new Date(form.birth_date).toLocaleDateString('pt-BR') : '—'}</p>
              )}
            </Field>
          </div>

          {/* Privacidade */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <button
              onClick={() => setCurrentView('profile-privacy')}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/[0.03] hover:bg-[#d4af37]/[0.06] transition group"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-[#d4af37]/60 group-hover:text-[#d4af37] transition" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-white/70 group-hover:text-white transition">Privacidade & Dados</p>
                  <p className="text-[10px] text-white/30">Consentimentos, exportar dados, excluir conta</p>
                </div>
              </div>
              <span className="text-[#d4af37]/40 group-hover:text-[#d4af37] transition text-lg leading-none">›</span>
            </button>
          </div>

          {/* Voltar */}
          <button
            onClick={() => setCurrentView('home')}
            className="mt-4 text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition"
          >
            ← Voltar ao site
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
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
