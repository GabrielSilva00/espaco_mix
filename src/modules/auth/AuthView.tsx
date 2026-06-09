import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Mail,
  ArrowLeft,
  Eye,
  EyeOff,
  Globe,
  User,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GoogleIcon } from '../../components/GoogleIcon';
import { supabase } from '../../lib/supabase';

export function AuthView({ portal = false }: { portal?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    setCurrentView,
    setDashboardMode,
    authTab, setAuthTab,
    adminForm, setAdminForm,
    registerForm, setRegisterForm,
    adminError, setAdminError,
    verificationStep, setVerificationStep,
    verificationCode, setVerificationCode,
    totpPending, setTotpPending,
    totpInput, setTotpInput,
    forgotPasswordStep, setForgotPasswordStep,
    forgotPasswordData, setForgotPasswordData,
    registerStep, setRegisterStep,
    handleAdminLogin,
    handleStaffLogin,
    handleRegister,
    handleVerifyCode,
    handleResendCode,
    showToast,
    setUserRole,
    setIsApprovedEventCreator,
    setSessionUser,
    setLoggedInUserId,
  } = useApp();

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-6 md:py-10 flex flex-col items-center justify-center min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-[#0d0d0d] border border-white/10 p-4 md:p-5 rounded-2xl md:rounded-3xl relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37] opacity-5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>

        {/* Switcher de cliente (Entrar / Cadastrar) — só fora do modo portal */}
        {!portal && authTab !== 'staff' && !totpPending && !verificationStep && !(authTab === 'register' && registerStep === 2) && (
          <div className="flex bg-white/5 p-1 rounded-xl mb-6">
            <button
              onClick={() => setAuthTab('login')}
              className={`flex-1 min-h-[38px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'login' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => setAuthTab('register')}
              className={`flex-1 min-h-[38px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'register' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
            >
              Cadastrar
            </button>
          </div>
        )}

        {/* Switcher do portal interno (Administração / Portaria) */}
        {portal && !totpPending && (
          <div className="flex bg-white/5 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setAuthTab('login'); setAdminError(''); }}
              className={`flex-1 min-h-[38px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'login' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
            >
              Acesso Master
            </button>
            <button
              onClick={() => { setAuthTab('staff'); setAdminError(''); }}
              className={`flex-1 min-h-[38px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'staff' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
            >
              Portaria
            </button>
          </div>
        )}

        <div className="text-center mb-6">
          <h1 className="text-base md:text-lg font-serif text-[#d4af37] mb-2">
            {portal && authTab === 'login' ? 'Acesso Master'
              : authTab === 'staff' ? 'Acesso Colaborador'
              : authTab === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
          </h1>
          <p className="text-[9px] md:text-[10px] uppercase tracking-widest opacity-40">
             {portal && authTab === 'login' ? 'Administração e desenvolvimento'
               : authTab === 'staff' ? 'Entre com sua credencial da equipe'
               : authTab === 'login' ? 'Acesso Simples — sua conta de cliente' : ''}
          </p>
        </div>

        {totpPending ? (
          <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
            <ShieldCheck className="w-12 h-12 text-[#d4af37] mx-auto opacity-80" />
            <h2 className="text-xl font-serif text-[#d4af37]">Verificação em Dois Fatores</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">Insira o código do seu autenticador</p>
            <input
              type="text"
              value={totpInput}
              onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
              placeholder="000000"
              className="w-full text-center text-2xl font-mono tracking-[0.5em] bg-white/5 border border-white/20 rounded-xl px-4 py-4 text-white focus:border-[#d4af37] outline-none transition"
            />
            {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest">{adminError}</p>}
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/auth/dev-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: totpInput }),
                  });
                  const data = await res.json();
                  if (data.valid) {
                    setUserRole('developer');
                    setIsApprovedEventCreator(true);
                    setSessionUser({
                      id: 'dev',
                      email: adminForm.username,
                      name: 'Admin / Dev',
                      role: 'developer',
                      isApprovedEventCreator: true
                    });
                    setLoggedInUserId('dev');
                    setCurrentView('dashboard');
                    setDashboardMode('list');
                    setAdminError('');
                    setTotpPending(false);
                    setTotpInput('');
                  } else {
                    setAdminError('Token 2FA inválido');
                  }
                } catch {
                  setAdminError('Erro ao verificar token. Tente novamente.');
                }
              }}
              className="w-full bg-[#d4af37] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition"
            >
              Confirmar
            </button>
            <button onClick={() => { setTotpPending(false); setTotpInput(''); setAdminError(''); }} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition">
              Voltar
            </button>
          </div>
        ) : verificationStep ? (
          <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
            <Mail className="w-12 h-12 text-[#d4af37] mx-auto opacity-80" />
            <h2 className="text-xl font-serif text-[#d4af37]">Verificação de E-mail</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
              Enviamos um código de 6 dígitos para<br/><span className="text-[#d4af37] mt-2 block">{registerForm.email}</span>
            </p>

            <div className="flex justify-center gap-4 py-4">
              {verificationCode.map((digit, idx) => (
                <input
                  key={idx}
                  id={`code-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const newCode = [...verificationCode];
                    newCode[idx] = e.target.value.replace(/\D/g, '');
                    setVerificationCode(newCode);
                    if (e.target.value && idx < 5) document.getElementById(`code-${idx + 1}`)?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digit && idx > 0) {
                      document.getElementById(`code-${idx - 1}`)?.focus();
                    }
                  }}
                  className="w-12 h-14 bg-white/5 border border-white/20 rounded-xl text-center text-xl font-bold focus:border-[#d4af37] outline-none text-white transition-all"
                />
              ))}
            </div>
            {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}

            <button
              onClick={handleVerifyCode}
              className="w-full bg-[#d4af37] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 shadow-[0_0_20px_rgba(212,175,55,0.2)] transition"
            >
              Confirmar Cadastro
            </button>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Não recebeu?{' '}
              <button
                type="button"
                onClick={handleResendCode}
                className="text-[#d4af37] hover:brightness-110 transition font-bold"
              >
                Reenviar código
              </button>
            </p>
            <button
              onClick={() => setVerificationStep(false)}
              className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition mt-4"
            >
              Voltar e editar dados
            </button>
          </div>
        ) : forgotPasswordStep === 'none' ? (
            <>
              <form onSubmit={authTab === 'staff' ? handleStaffLogin : authTab === 'login' ? handleAdminLogin : handleRegister} className="space-y-3">
                {authTab === 'register' && registerStep === 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                    {/* Brasileiro / Estrangeiro */}
                    <div className="flex gap-4 py-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="nationality"
                          checked={registerForm.nationality === 'br'}
                          onChange={() => setRegisterForm({ ...registerForm, nationality: 'br', country: '', passportDoc: '' })}
                          className="accent-[#d4af37] w-4 h-4"
                        />
                        <User className="w-3.5 h-3.5 text-white/50" />
                        <span className="text-[11px] uppercase tracking-widest text-white/70">Brasileiro</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="nationality"
                          checked={registerForm.nationality === 'foreign'}
                          onChange={() => setRegisterForm({ ...registerForm, nationality: 'foreign', cpf: '' })}
                          className="accent-[#d4af37] w-4 h-4"
                        />
                        <Globe className="w-3.5 h-3.5 text-white/50" />
                        <span className="text-[11px] uppercase tracking-widest text-white/70">Estrangeiro</span>
                      </label>
                    </div>

                    {/* Nome Completo */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">Nome Completo</label>
                      <input
                        type="text"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="Seu nome completo"
                      />
                    </div>

                    {/* E-mail */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">E-mail</label>
                      <input
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="contato@exemplo.com"
                      />
                    </div>

                    {/* CPF ou País + Passaporte */}
                    {registerForm.nationality === 'br' ? (
                      <div>
                        <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">CPF</label>
                        <input
                          type="text"
                          value={registerForm.cpf}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                            const masked = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                            setRegisterForm({ ...registerForm, cpf: masked });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition"
                          placeholder="000.000.000-00"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> País
                          </label>
                          <select
                            value={registerForm.country}
                            onChange={(e) => setRegisterForm({ ...registerForm, country: e.target.value })}
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
                          <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">Documento / Passaporte</label>
                          <input
                            type="text"
                            value={registerForm.passportDoc}
                            onChange={(e) => setRegisterForm({ ...registerForm, passportDoc: e.target.value.toUpperCase() })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition"
                            placeholder="ABC123456"
                          />
                        </div>
                      </>
                    )}

                    {/* Celular com DDI */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">Celular</label>
                      <div className="flex gap-2">
                        <select
                          value={registerForm.phoneCountry}
                          onChange={(e) => setRegisterForm({ ...registerForm, phoneCountry: e.target.value })}
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
                          value={registerForm.phone}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                            const masked = registerForm.phoneCountry === '+55'
                              ? (v.length <= 10
                                  ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
                                  : v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3'))
                              : v;
                            setRegisterForm({ ...registerForm, phone: masked });
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition"
                          placeholder={registerForm.phoneCountry === '+55' ? '(11) 90000-0000' : '000000000'}
                        />
                      </div>
                    </div>

                    {/* Data de Nascimento */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">Data de Nascimento</label>
                      <input
                        type="date"
                        value={registerForm.birthDate}
                        onChange={(e) => setRegisterForm({ ...registerForm, birthDate: e.target.value })}
                        style={{ colorScheme: 'dark' }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition text-white"
                      />
                    </div>

                    {/* Sexo */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">Sexo</label>
                      <div className="flex gap-2">
                        {[{ v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' }, { v: 'O', l: 'Outro' }].map(opt => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => setRegisterForm({ ...registerForm, sex: opt.v })}
                            className={`flex-1 min-h-[40px] rounded-xl text-[10px] uppercase tracking-widest font-bold border transition ${registerForm.sex === opt.v ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30'}`}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                {authTab === 'register' && registerStep === 2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setRegisterStep(1)}
                      className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-2"
                    >
                      <ArrowLeft className="w-3 h-3" /> Voltar
                    </button>

                    {/* Senha */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">Senha</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 pr-12 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition"
                          placeholder="Mínimo 6 caracteres"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirmação de senha */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-[2px] opacity-50 mb-1.5 ml-1">Confirmar Senha</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={registerForm.confirmPassword}
                          onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 pr-12 min-h-[44px] text-sm focus:border-[#d4af37] outline-none transition"
                          placeholder="Repita a senha"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowConfirmPassword(v => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
                {(authTab === 'login' || authTab === 'staff') && (
                  <>
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail / Usuário</label>
                      <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        value={adminForm.username}
                        onChange={(e) => setAdminForm({...adminForm, username: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[42px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Senha</label>
                      <input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        value={adminForm.password}
                        onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[42px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="••••••••"
                      />
                    </div>
                    {authTab === 'login' && (
                      <div className="flex justify-start">
                        <button
                          type="button"
                          onClick={() => setForgotPasswordStep('email')}
                          className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:brightness-110 opacity-70 hover:opacity-100 transition"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                    )}
                  </>
                )}
                {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}

                <button
                  type="submit"
                  className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:brightness-110 transition mt-1"
                >
                  {(authTab === 'login' || authTab === 'staff') ? 'Entrar' : registerStep === 1 ? 'Continuar' : 'Criar Conta e Continuar'}
                </button>

                {!portal && authTab === 'login' && (
                  <>
                    <div className="flex items-center gap-4 my-2 opacity-30">
                      <div className="h-[1px] flex-1 bg-white"></div>
                      <span className="text-[9px] uppercase tracking-widest">ou</span>
                      <div className="h-[1px] flex-1 bg-white"></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
                      className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                    >
                      <GoogleIcon className="w-4 h-4" /> Entrar com Google
                    </button>
                    <div className="mt-6 pt-5 border-t border-white/5">
                      <p className="text-[9px] uppercase tracking-widest opacity-40 text-center mb-3 flex items-center justify-center gap-1.5">
                        <HelpCircle className="w-3 h-3" /> Ajuda ao cliente
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setCurrentView('contact')}
                          className="flex-1 min-h-[40px] rounded-xl border border-white/10 text-[10px] uppercase tracking-widest font-bold text-white/50 hover:text-white hover:border-white/25 transition"
                        >
                          Suporte
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentView('terms')}
                          className="flex-1 min-h-[40px] rounded-xl border border-white/10 text-[10px] uppercase tracking-widest font-bold text-white/50 hover:text-white hover:border-white/25 transition"
                        >
                          Termos e Políticas
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {authTab === 'register' && registerStep === 1 && (
                  <>
                    <div className="flex items-center gap-4 my-4 opacity-30">
                      <div className="h-[1px] flex-1 bg-white"></div>
                      <span className="text-[9px] uppercase tracking-widest">ou</span>
                      <div className="h-[1px] flex-1 bg-white"></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
                      className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                    >
                      <GoogleIcon className="w-4 h-4" /> Cadastrar com Google
                    </button>
                  </>
                )}
              </form>
            </>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (forgotPasswordStep === 'email') {
                 if (!forgotPasswordData.email) {
                   setAdminError('Preencha o e-mail');
                   return;
                 }
                 setAdminError('');
                 setForgotPasswordStep('code');
              } else if (forgotPasswordStep === 'code') {
                 if (!forgotPasswordData.code) {
                   setAdminError('Preencha o código');
                   return;
                 }
                 setAdminError('');
                 setForgotPasswordStep('new_password');
              } else if (forgotPasswordStep === 'new_password') {
                 if (!forgotPasswordData.newPassword) {
                   setAdminError('Preencha a nova senha');
                   return;
                 }
                 setAdminError('');
                 setForgotPasswordStep('none');
                 setForgotPasswordData({ email: '', code: '', newPassword: '' });
                 showToast('Senha redefinida com sucesso!', 'success');
              }
            }} className="space-y-4 md:space-y-5 animate-in fade-in zoom-in duration-300">
               <button
                  type="button"
                  onClick={() => {
                    if (forgotPasswordStep === 'email') setForgotPasswordStep('none');
                    else if (forgotPasswordStep === 'code') setForgotPasswordStep('email');
                    else if (forgotPasswordStep === 'new_password') setForgotPasswordStep('code');
                  }}
                  className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-4"
                >
                  <ArrowLeft className="w-3 h-3" /> Voltar
               </button>

               <div className="text-center mb-6">
                  <Mail className="w-10 h-10 text-[#d4af37] mx-auto opacity-80 mb-4" />
                  <h2 className="text-xl font-serif text-[#d4af37] mb-2">Recuperar Senha</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                     {forgotPasswordStep === 'email' && 'Informe seu e-mail de acesso'}
                     {forgotPasswordStep === 'code' && `Enviamos um código para ${forgotPasswordData.email}`}
                     {forgotPasswordStep === 'new_password' && 'Crie sua nova senha de acesso'}
                  </p>
               </div>

               {forgotPasswordStep === 'email' && (
                  <div>
                    <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail</label>
                    <input
                      type="email"
                      value={forgotPasswordData.email}
                      onChange={(e) => setForgotPasswordData({...forgotPasswordData, email: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[42px] text-sm focus:border-[#d4af37] outline-none transition"
                      placeholder="contato@exemplo.com"
                    />
                  </div>
               )}

               {forgotPasswordStep === 'code' && (
                  <div>
                    <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Código de Verificação</label>
                    <input
                      type="text"
                      value={forgotPasswordData.code}
                      onChange={(e) => setForgotPasswordData({...forgotPasswordData, code: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[42px] text-sm focus:border-[#d4af37] outline-none transition text-center tracking-[1em]"
                      placeholder="0000"
                      maxLength={4}
                    />
                  </div>
               )}

               {forgotPasswordStep === 'new_password' && (
                  <div>
                    <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Nova Senha</label>
                    <input
                      type="password"
                      value={forgotPasswordData.newPassword}
                      onChange={(e) => setForgotPasswordData({...forgotPasswordData, newPassword: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[42px] text-sm focus:border-[#d4af37] outline-none transition"
                      placeholder="••••••••"
                    />
                  </div>
               )}

               {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}

               <button
                  type="submit"
                  className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:brightness-110 transition mt-4"
                >
                  {forgotPasswordStep === 'email' ? 'Enviar Código' : forgotPasswordStep === 'code' ? 'Verificar Código' : 'Redefinir Senha'}
                </button>
            </form>
          )}
      </motion.div>

    </div>
  );
}
