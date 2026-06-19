import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { updateProfile, signOut } from '../lib/supabase';

/**
 * Modal bloqueante para completar dados obrigatórios ausentes (CPF/telefone/
 * nascimento). Disparado quando `needsProfileCompletion` é true — caso típico:
 * login via Google, que não fornece esses dados. Reutiliza `updateProfile`, que
 * roteia os campos sensíveis para /api/profile/sensitive (criptografia +
 * cpf_hash com dedupe). Não é dispensável; o único escape é sair da conta.
 */
export function CompleteProfileModal() {
  const { loggedInUserId, sessionUser, needsProfileCompletion, setNeedsProfileCompletion, showToast } = useApp();

  const [nationality, setNationality] = useState<'br' | 'foreign'>('br');
  const [cpf, setCpf] = useState('');
  const [country, setCountry] = useState('');
  const [passportDoc, setPassportDoc] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+55');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!needsProfileCompletion || !loggedInUserId) return null;

  const handleSave = async () => {
    setError('');
    if (nationality === 'br') {
      if (cpf.replace(/\D/g, '').length !== 11) { setError('CPF inválido — informe os 11 dígitos'); return; }
    } else {
      if (!country) { setError('Selecione seu país'); return; }
      if (!passportDoc.trim()) { setError('Informe o número do documento/passaporte'); return; }
    }
    if (phone.replace(/\D/g, '').length < 8) { setError('Informe um número de celular válido'); return; }
    if (!birthDate) { setError('Informe sua data de nascimento'); return; }
    if (!sex) { setError('Selecione seu sexo'); return; }

    setSaving(true);
    try {
      const updates: any = {
        nationality,
        sex,
        phone_country: phoneCountry,
        phone: phone.replace(/\D/g, ''),
        birth_date: birthDate,
      };
      if (nationality === 'br') {
        updates.cpf = cpf.replace(/\D/g, '');
      } else {
        updates.country = country;
        updates.passport_doc = passportDoc.trim().toUpperCase();
      }
      await updateProfile(loggedInUserId, updates);
      setNeedsProfileCompletion(false);
      showToast('Perfil completo! Bom proveito.', 'success');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try { await signOut(); } catch { /* ignore */ }
    setNeedsProfileCompletion(false);
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition';
  const labelCls = 'block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="bg-[#0d0d0d] border border-white/15 rounded-2xl p-6 max-w-md w-full my-auto"
      >
        <h3 className="text-lg font-serif text-[#d4af37] mb-1">Complete seu cadastro</h3>
        <p className="text-sm text-white/60 mb-5">
          Olá{sessionUser?.name ? `, ${sessionUser.name.split(' ')[0]}` : ''}! Para usar a plataforma e
          emitir ingressos, precisamos de mais alguns dados.
        </p>

        <div className="space-y-4">
          {/* Nacionalidade */}
          <div>
            <label className={labelCls}>Nacionalidade</label>
            <div className="flex gap-2">
              {([['br', 'Brasileiro'], ['foreign', 'Estrangeiro']] as const).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNationality(v)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition ${
                    nationality === v ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-white/5 border-white/10 text-white/70'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* CPF ou País + Passaporte */}
          {nationality === 'br' ? (
            <div>
              <label className={labelCls}>CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setCpf(v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'));
                }}
                className={inputCls}
                placeholder="000.000.000-00"
              />
            </div>
          ) : (
            <>
              <div>
                <label className={`${labelCls} flex items-center gap-1`}><Globe className="w-3 h-3" /> País</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-4 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition text-white appearance-none"
                >
                  <option value="">Selecione o país</option>
                  <option value="US">🇺🇸 United States</option>
                  <option value="AR">🇦🇷 Argentina</option>
                  <option value="CL">🇨🇱 Chile</option>
                  <option value="CO">🇨🇴 Colombia</option>
                  <option value="UY">🇺🇾 Uruguay</option>
                  <option value="PY">🇵🇾 Paraguay</option>
                  <option value="BO">🇧🇴 Bolivia</option>
                  <option value="VE">🇻🇪 Venezuela</option>
                  <option value="PE">🇵🇪 Peru</option>
                  <option value="PT">🇵🇹 Portugal</option>
                  <option value="ES">🇪🇸 Spain</option>
                  <option value="IT">🇮🇹 Italy</option>
                  <option value="DE">🇩🇪 Germany</option>
                  <option value="FR">🇫🇷 France</option>
                  <option value="GB">🇬🇧 United Kingdom</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Documento / Passaporte</label>
                <input
                  type="text"
                  value={passportDoc}
                  onChange={(e) => setPassportDoc(e.target.value.toUpperCase())}
                  className={inputCls}
                  placeholder="ABC123456"
                />
              </div>
            </>
          )}

          {/* Celular com DDI */}
          <div>
            <label className={labelCls}>Celular</label>
            <div className="flex gap-2">
              <select
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value)}
                className="bg-[#0d0d0d] border border-white/10 rounded-xl px-3 min-h-[44px] text-sm text-white focus:border-[#d4af37] outline-none transition appearance-none w-24 text-center"
              >
                <option value="+55">🇧🇷 +55</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+54">🇦🇷 +54</option>
                <option value="+56">🇨🇱 +56</option>
                <option value="+57">🇨🇴 +57</option>
                <option value="+598">🇺🇾 +598</option>
                <option value="+595">🇵🇾 +595</option>
                <option value="+591">🇧🇴 +591</option>
                <option value="+51">🇵🇪 +51</option>
                <option value="+351">🇵🇹 +351</option>
                <option value="+34">🇪🇸 +34</option>
                <option value="+39">🇮🇹 +39</option>
                <option value="+49">🇩🇪 +49</option>
                <option value="+33">🇫🇷 +33</option>
                <option value="+44">🇬🇧 +44</option>
              </select>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  const masked = phoneCountry === '+55'
                    ? (v.length <= 10
                        ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
                        : v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3'))
                    : v;
                  setPhone(masked);
                }}
                className={`flex-1 ${inputCls}`}
                placeholder={phoneCountry === '+55' ? '(11) 90000-0000' : '000000000'}
              />
            </div>
          </div>

          {/* Data de Nascimento */}
          <div>
            <label className={labelCls}>Data de Nascimento</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className={`${inputCls} text-white`}
            />
          </div>

          {/* Sexo */}
          <div>
            <label className={labelCls}>Sexo</label>
            <div className="flex gap-2">
              {[{ v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' }, { v: 'O', l: 'Outro' }].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setSex(opt.v)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition ${
                    sex === opt.v ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-white/5 border-white/10 text-white/70'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#d4af37] text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#e5c14e] transition disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Concluir cadastro'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-center text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition"
          >
            Sair da conta
          </button>
        </div>
      </motion.div>
    </div>
  );
}
