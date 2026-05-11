import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, Phone, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import { signUp, supabase } from '../lib/supabase';

export const RegisterProducerStep1 = ({
  onBack,
  onSuccess
}: {
  onBack: () => void;
  onSuccess: () => void;
}) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    termsAccepted: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: '', color: 'bg-white/10' });

  useEffect(() => {
    const calcStrength = (pwd: string) => {
      let score = 0;
      if (pwd.length > 7) score += 1;
      if (/[A-Z]/.test(pwd)) score += 1;
      if (/[0-9]/.test(pwd)) score += 1;
      if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

      switch(score) {
        case 0: return { score: 0, text: '', color: 'bg-white/10' };
        case 1: return { score: 1, text: 'Fraca', color: 'bg-red-500' };
        case 2: return { score: 2, text: 'Razoável', color: 'bg-yellow-500' };
        case 3: return { score: 3, text: 'Boa', color: 'bg-blue-500' };
        case 4: return { score: 4, text: 'Forte', color: 'bg-green-500' };
        default: return { score: 0, text: '', color: 'bg-white/10' };
      }
    };
    setPasswordStrength(calcStrength(form.password));
  }, [form.password]);

  const validatePhone = (value: string) => {
    let raw = value.replace(/\D/g, '');
    raw = raw.substring(0, 11);
    let formatted = raw;
    if (raw.length > 2) formatted = `(${raw.substring(0, 2)}) ${raw.substring(2)}`;
    if (raw.length > 7) formatted = `(${raw.substring(0, 2)}) ${raw.substring(2, 7)}-${raw.substring(7)}`;
    setForm({ ...form, phone: formatted });
  };

  const handleEmailBlur = async () => {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrors(prev => ({ ...prev, email: 'E-mail inválido' }));
      return;
    }
    setCheckingEmail(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', form.email)
        .maybeSingle();
      if (data) {
        setErrors(prev => ({ ...prev, email: 'E-mail já cadastrado. Que tal fazer login?' }));
      } else {
        setErrors(prev => ({ ...prev, email: '' }));
      }
    } catch {
      // Silently ignore — duplicate check is best-effort
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!form.email.trim()) newErrors.email = 'E-mail é obrigatório';
    if (form.password.length < 8) newErrors.password = 'A senha deve ter no mínimo 8 caracteres';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'As senhas não coincidem';
    if (form.phone.length < 14) newErrors.phone = 'Telefone inválido';
    if (!form.termsAccepted) newErrors.termsAccepted = 'Você deve aceitar os termos';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await signUp(form.email, form.password, form.name, { phone: form.phone } as any);
      onSuccess();
    } catch (err: any) {
      const msg = err?.message || 'Erro ao criar conta';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        setErrors({ email: 'E-mail já cadastrado. Que tal fazer login?' });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto relative z-10 p-6 md:p-8 bg-[#0d0d0d] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
       <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37] opacity-5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>

       <button onClick={onBack} className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white transition flex items-center gap-2 mb-6">
         <ArrowLeft className="w-3 h-3" /> Voltar
       </button>

       <div className="mb-8">
         <h1 className="text-2xl font-serif text-[#d4af37] mb-2 flex items-center gap-2">
           <ShieldCheck className="w-5 h-5 text-[#d4af37]" />
           Conta de Produtor
         </h1>
         <p className="text-[11px] uppercase tracking-[0.1em] opacity-50">Crie e gerencie seus eventos com a Eventix.</p>
       </div>

       <form onSubmit={handleSubmit} className="space-y-4">
         <button
           type="button"
           className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2 mb-6"
         >
           <GoogleIcon className="w-4 h-4" /> Continuar com Google
         </button>

         <div className="flex items-center gap-4 my-6 opacity-30">
           <div className="h-[1px] flex-1 bg-white"></div>
           <span className="text-[9px] uppercase tracking-widest">ou use seu e-mail</span>
           <div className="h-[1px] flex-1 bg-white"></div>
         </div>

         <div className="space-y-4">
           {/* Nome */}
           <div>
             <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Nome Completo</label>
             <div className="relative">
               <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
               <input
                 autoFocus
                 type="text"
                 value={form.name}
                 onChange={e => {setForm({...form, name: e.target.value}); setErrors({...errors, name: ''})}}
                 className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                 placeholder="Como devemos chamá-lo?"
               />
             </div>
             {errors.name && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.name}</p>}
           </div>

           {/* Email */}
           <div>
             <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">E-mail Profissional</label>
             <div className="relative">
               <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
               <input
                 type="email"
                 value={form.email}
                 onBlur={handleEmailBlur}
                 onChange={e => {setForm({...form, email: e.target.value}); setErrors({...errors, email: ''})}}
                 className={`w-full bg-white/5 border ${errors.email ? 'border-red-500' : 'border-white/10'} rounded-xl pl-10 pr-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition`}
                 placeholder="contato@suaprodutora.com"
               />
               {checkingEmail && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] opacity-50">Verificando...</span>}
             </div>
             {errors.email && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.email}</p>}
           </div>

           {/* Grid de Senhas */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
               <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Senha</label>
               <div className="relative">
                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                 <input
                   type="password"
                   value={form.password}
                   onChange={e => {setForm({...form, password: e.target.value}); setErrors({...errors, password: ''})}}
                   className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                   placeholder="••••••••"
                 />
               </div>

               {/* Indicador de Força */}
               <div className="mt-2 flex items-center gap-2 px-1">
                 <div className="flex-1 flex gap-1 h-1">
                   {[1, 2, 3, 4].map(idx => (
                     <div key={idx} className={`flex-1 rounded-full bg-white/10 transition-colors ${idx <= passwordStrength.score ? passwordStrength.color : ''}`}></div>
                   ))}
                 </div>
                 <span className={`text-[8px] uppercase tracking-widest font-bold ${passwordStrength.color.replace('bg-', 'text-')}`}>{passwordStrength.text}</span>
               </div>
               {errors.password && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.password}</p>}
             </div>

             <div>
               <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Confirmar Senha</label>
               <div className="relative">
                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                 <input
                   type="password"
                   value={form.confirmPassword}
                   onChange={e => {setForm({...form, confirmPassword: e.target.value}); setErrors({...errors, confirmPassword: ''})}}
                   className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                   placeholder="••••••••"
                 />
               </div>
               {errors.confirmPassword && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.confirmPassword}</p>}
             </div>
           </div>

           {/* Telefone */}
           <div>
             <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">WhatsApp / Telefone</label>
             <div className="relative">
               <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
               <input
                 type="tel"
                 value={form.phone}
                 onChange={e => {validatePhone(e.target.value); setErrors({...errors, phone: ''})}}
                 className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                 placeholder="(11) 90000-0000"
               />
             </div>
             {errors.phone && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.phone}</p>}
           </div>

           {/* Termos de Uso */}
           <div className="flex items-start gap-3 mt-4 px-1">
             <input
               type="checkbox"
               id="terms"
               checked={form.termsAccepted}
               onChange={e => {setForm({...form, termsAccepted: e.target.checked}); setErrors({...errors, termsAccepted: ''})}}
               className="mt-1 accent-[#d4af37]"
             />
             <label htmlFor="terms" className="text-xs opacity-70 leading-relaxed cursor-pointer">
               Li e aceito os <a href="#" className="text-[#d4af37] hover:underline">Termos de Uso</a> e a <a href="#" className="text-[#d4af37] hover:underline">Política de Privacidade</a> da Eventix.
             </label>
           </div>
           {errors.termsAccepted && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.termsAccepted}</p>}

         </div>

         {errors.form && (
           <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex gap-2 items-start">
             <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
             <p className="text-xs text-red-400 font-bold">{errors.form}</p>
           </div>
         )}

         <button
           type="submit"
           disabled={loading}
           className="w-full py-4 mt-6 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-xl hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
         >
           {loading ? 'Criando conta...' : 'Criar minha conta de produtor'}
         </button>
       </form>
    </div>
  );
};
