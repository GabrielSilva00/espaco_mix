import { motion } from 'motion/react';
import {
  Smartphone,
  ArrowLeft,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GoogleIcon } from '../../components/GoogleIcon';

export function AuthView() {
  const {
    setCurrentView,
    authTab, setAuthTab,
    adminForm, setAdminForm,
    registerForm, setRegisterForm,
    adminError, setAdminError,
    verificationStep, setVerificationStep,
    verificationCode, setVerificationCode,
    forgotPasswordStep, setForgotPasswordStep,
    forgotPasswordData, setForgotPasswordData,
    registerStep, setRegisterStep,
    handleAdminLogin,
    handleRegister,
    handleVerifyCode,
    showToast,
  } = useApp();

  return (
    <div className="max-w-md mx-auto px-4 md:px-6 py-6 md:py-12 flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-[#0d0d0d] border border-white/10 p-6 md:p-8 rounded-2xl md:rounded-3xl relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37] opacity-5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>

        <div className="flex bg-white/5 p-1 rounded-xl mb-6">
          <button
            onClick={() => setAuthTab('login')}
            className={`flex-1 min-h-[44px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'login' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
          >
            Entrar
          </button>
          <button
            onClick={() => setAuthTab('register')}
            className={`flex-1 min-h-[44px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'register' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
          >
            Cadastrar
          </button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-lg md:text-2xl font-serif text-[#d4af37] mb-2">
            {authTab === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
          </h1>
          <p className="text-[9px] md:text-[10px] uppercase tracking-widest opacity-40">
            {authTab === 'login' ? 'Acesse sua conta para continuar' : 'Preencha os dados para se cadastrar'}
          </p>
        </div>

        {verificationStep ? (
          <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
            <Smartphone className="w-12 h-12 text-[#d4af37] mx-auto opacity-80" />
            <h2 className="text-xl font-serif text-[#d4af37]">Verificação de Celular</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
              Enviamos um código de 4 dígitos para<br/><span className="text-[#d4af37] mt-2 block">{registerForm.phone}</span>
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
                    if (e.target.value && idx < 3) document.getElementById(`code-${idx + 1}`)?.focus();
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
            <button
              onClick={() => setVerificationStep(false)}
              className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition mt-4"
            >
              Voltar e editar dados
            </button>
          </div>
        ) : forgotPasswordStep === 'none' ? (
            <>
              <form onSubmit={authTab === 'login' ? handleAdminLogin : handleRegister} className="space-y-4 md:space-y-5">
                {authTab === 'register' && registerStep === 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-5">
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Nome Completo</label>
                      <input
                        type="text"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="Seu nome"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail</label>
                      <input
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="contato@exemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Senha</label>
                      <input
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="••••••••"
                      />
                    </div>
                  </motion.div>
                )}
                {authTab === 'register' && registerStep === 2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-5">
                    <button
                      type="button"
                      onClick={() => setRegisterStep(1)}
                      className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-4"
                    >
                      <ArrowLeft className="w-3 h-3" /> Voltar
                    </button>
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Celular</label>
                      <input
                        type="tel"
                        value={registerForm.phone}
                        onChange={(e) => setRegisterForm({...registerForm, phone: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="(11) 90000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">CPF</label>
                      <input
                        type="text"
                        value={registerForm.cpf}
                        onChange={(e) => setRegisterForm({...registerForm, cpf: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Data de Nascimento</label>
                      <input
                        type="date"
                        value={registerForm.birthDate}
                        onChange={(e) => setRegisterForm({...registerForm, birthDate: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-white"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  </motion.div>
                )}
                {authTab === 'login' && (
                  <>
                    <div>
                      <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail / Usuário</label>
                      <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        value={adminForm.username}
                        onChange={(e) => setAdminForm({...adminForm, username: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
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
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => setForgotPasswordStep('email')}
                        className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:brightness-110 opacity-70 hover:opacity-100 transition"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  </>
                )}
                {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}

                <button
                  type="submit"
                  className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:brightness-110 transition mt-2"
                >
                  {authTab === 'login' ? 'Entrar' : registerStep === 1 ? 'Continuar' : 'Criar Conta e Continuar'}
                </button>

                {authTab === 'login' && (
                  <>
                    <div className="flex items-center gap-4 my-4 opacity-30">
                      <div className="h-[1px] flex-1 bg-white"></div>
                      <span className="text-[9px] uppercase tracking-widest">ou</span>
                      <div className="h-[1px] flex-1 bg-white"></div>
                    </div>
                    <button
                      type="button"
                      className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                    >
                      <GoogleIcon className="w-4 h-4" /> Entrar com Google
                    </button>
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
                  <Smartphone className="w-10 h-10 text-[#d4af37] mx-auto opacity-80 mb-4" />
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-center tracking-[1em]"
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
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

      <div className="flex flex-col gap-3 mt-8">
        <button
          onClick={() => setCurrentView('home')}
          className="inline-flex items-center justify-center min-h-[44px] px-8 bg-white/5 border border-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 hover:border-white/20 transition-all shadow-sm"
        >
          Voltar ao Site
        </button>
      </div>
    </div>
  );
}
