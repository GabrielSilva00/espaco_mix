import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, Building, User, Lock, FileText, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Utilitários de Validação ---

export const validateCPF = (cpf: string): boolean => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
};

export const validateCNPJ = (cnpj: string): boolean => {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  tamanho += 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;
  return true;
};

// --- Componente Principal ---

type KYCType = 'PF' | 'PJ' | null;

export const KYCForm = ({ 
  onComplete,
  initialStatus = 'NOT_STARTED' // 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED'
}: { 
  onComplete?: (data: any) => void;
  initialStatus?: string;
}) => {
  const [kycType, setKycType] = useState<KYCType>(null);
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  // Formulário compartilhado e específico
  const [form, setForm] = useState({
    cpf: '',
    cnpj: '',
    nomeCompleto: '',
    razaoSocial: '',
    nomeFantasia: '',
    dataNascimento: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    representanteLegal: '',
    cpfRepresentante: '',
    documentoFile: null as File | null,
    documentoProtocolo: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Formatação de Máscaras
  const formatCPF = (val: string) => {
    return val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
  };

  const formatCNPJ = (val: string) => {
    return val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2').substring(0, 18);
  };

  const formatCEP = (val: string) => {
    return val.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
  };

  // Integração BrasilAPI (CEP)
  const fetchCEP = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    
    setLoadingCep(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
      if (!res.ok) throw new Error('CEP não encontrado');
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        endereco: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        estado: data.state || ''
      }));
      setErrors(prev => ({ ...prev, cep: '' }));
    } catch (err) {
      setErrors(prev => ({ ...prev, cep: 'CEP inválido ou não encontrado' }));
    } finally {
      setLoadingCep(false);
    }
  };

  // Integração BrasilAPI (CNPJ)
  const fetchCNPJ = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    if (!validateCNPJ(cleanCnpj)) {
       setErrors(prev => ({ ...prev, cnpj: 'CNPJ Inválido' }));
       return;
    }
    
    setLoadingCnpj(true);
    setErrors(prev => ({ ...prev, cnpj: '' }));
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!res.ok) throw new Error('Falha ao consultar CNPJ');
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || data.razao_social || '',
        cep: formatCEP(data.cep?.toString() || ''),
        endereco: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.municipio || '',
        estado: data.uf || ''
      }));
    } catch (err) {
      setErrors(prev => ({ ...prev, cnpj: 'Erro ao buscar dados do CNPJ' }));
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, documentoFile: 'O arquivo deve ter no máximo 5MB' }));
        return;
      }
      setForm(prev => ({ ...prev, documentoFile: file }));
      setErrors(prev => ({ ...prev, documentoFile: '' }));
    }
  };

  const removeFile = () => setForm(prev => ({...prev, documentoFile: null}));

  const validate18Years = (dateString: string) => {
    if (!dateString) return false;
    const birthDate = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 18;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (kycType === 'PF') {
      if (!validateCPF(form.cpf)) newErrors.cpf = 'CPF inválido';
      if (!form.nomeCompleto) newErrors.nomeCompleto = 'Nome obrigatório';
      if (!validate18Years(form.dataNascimento)) newErrors.dataNascimento = 'Você deve ter mais de 18 anos';
    } else {
      if (!validateCNPJ(form.cnpj)) newErrors.cnpj = 'CNPJ inválido';
      if (!form.razaoSocial) newErrors.razaoSocial = 'Razão Social obrigatória';
      if (!form.representanteLegal) newErrors.representanteLegal = 'Nome do representante obrigatório';
      if (!validateCPF(form.cpfRepresentante)) newErrors.cpfRepresentante = 'CPF do representante inválido';
    }

    if (!form.cep) newErrors.cep = 'CEP obrigatório';
    if (!form.numero) newErrors.numero = 'Número obrigatório';
    if (!form.documentoFile) newErrors.documentoFile = 'Você deve enviar um documento';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to first error
      return;
    }

    setLoading(true);
    try {
      // Simulação de Upload no Firebase Storage
      // const storageRef = ref(storage, \`kyc/\${auth.currentUser.uid}/\${form.documentoFile.name}\`);
      // await uploadBytes(storageRef, form.documentoFile);
      // const dURL = await getDownloadURL(storageRef);
      
      // Simulação de delay de envio
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStatus('PENDING');
      if (onComplete) onComplete(form);

    } catch (err) {
      setErrors({ global: 'Falha ao enviar documentos. Tente novamente mais tarde.' });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'PENDING') {
    return (
      <div className="bg-[#0f0f0f] border border-[#d4af37]/30 rounded-3xl p-8 text-center">
        <div className="w-16 h-16 bg-[#d4af37]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-[#d4af37]" />
        </div>
        <h2 className="text-2xl font-serif text-[#d4af37] mb-2">Documentos em Análise</h2>
        <p className="text-white/60 mb-6 text-sm">
          Sua identidade está sendo verificada pela nossa equipe de compliance automátioco e manual.
          <br/>Esse processo é exigido pelo Banco Central e costuma levar <strong>até 2 dias úteis</strong>.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left max-w-sm mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-[#d4af37] mb-2 font-bold">O que acontece agora?</p>
          <ul className="text-xs text-white/50 space-y-2">
            <li className="flex items-start gap-2"><CheckCircle className="w-3 h-3 mt-0.5 shrink-0" /> Você já pode criar eventos e salvá-los como rascunho.</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-3 h-3 mt-0.5 shrink-0" /> Não é possível iniciar as vendas até a aprovação.</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-3 h-3 mt-0.5 shrink-0" /> Notificaremos você por e-mail assim que finalizado.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto relative z-10">
       <div className="mb-8 text-center">
         <h1 className="text-2xl font-serif text-[#d4af37] mb-2 flex items-center justify-center gap-2">
           <ShieldCheck className="w-6 h-6 text-[#d4af37]" />
           Verificação de Identidade (KYC)
         </h1>
         <p className="text-[11px] uppercase tracking-[0.1em] opacity-50 px-4">
           Para garantir a segurança da plataforma e processar seus recebimentos conforme normas do Banco Central, precisamos confirmar seus dados.
         </p>
       </div>

       {errors.global && (
         <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 items-starts mb-6">
           <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
           <p className="text-xs text-red-400 font-bold">{errors.global}</p>
         </div>
       )}

       <form onSubmit={handleSubmit} className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37] opacity-5 blur-[100px] rounded-full pointer-events-none"></div>

         {!kycType ? (
           <div className="space-y-6">
             <p className="text-sm font-bold opacity-80 text-center mb-6">Como você irá atuar no Espaço Mix?</p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <button
                 type="button"
                 onClick={() => setKycType('PF')}
                 className="flex flex-col items-center gap-4 p-8 border border-white/10 rounded-2xl hover:border-[#d4af37] hover:bg-[#d4af37]/5 transition group"
               >
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-[#d4af37]/20 transition">
                   <User className="w-8 h-8 text-white/50 group-hover:text-[#d4af37] transition" />
                 </div>
                 <div className="text-center">
                   <span className="block font-bold text-white mb-1">Pessoa Física</span>
                   <span className="text-[10px] uppercase tracking-widest opacity-40">Uso de CPF</span>
                 </div>
               </button>
               <button
                 type="button"
                 onClick={() => setKycType('PJ')}
                 className="flex flex-col items-center gap-4 p-8 border border-white/10 rounded-2xl hover:border-[#d4af37] hover:bg-[#d4af37]/5 transition group"
               >
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-[#d4af37]/20 transition">
                   <Building className="w-8 h-8 text-white/50 group-hover:text-[#d4af37] transition" />
                 </div>
                 <div className="text-center">
                   <span className="block font-bold text-white mb-1">Pessoa Jurídica</span>
                   <span className="text-[10px] uppercase tracking-widest opacity-40">Empresa (CNPJ / MEI)</span>
                 </div>
               </button>
             </div>
           </div>
         ) : (
           <AnimatePresence mode="wait">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
               
               {/* Head - Alterar Tipo */}
               <div className="flex justify-between items-center pb-4 border-b border-white/10">
                 <div className="flex items-center gap-3">
                   {kycType === 'PF' ? <User className="text-[#d4af37]" /> : <Building className="text-[#d4af37]" />}
                   <span className="font-bold uppercase tracking-widest text-[#d4af37] text-sm">
                     Cadastro {kycType === 'PF' ? 'Pessoa Física' : 'Representante Legal'}
                   </span>
                 </div>
                 <button type="button" onClick={() => setKycType(null)} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition">
                   Alterar
                 </button>
               </div>

               {/* Campos Específicos PF vs PJ */}
               {kycType === 'PF' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="md:col-span-2">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Nome Completo (Conforme Documento)</label>
                     <input 
                       type="text" 
                       value={form.nomeCompleto}
                       onChange={e => setForm({...form, nomeCompleto: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                     />
                     {errors.nomeCompleto && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.nomeCompleto}</p>}
                   </div>
                   <div>
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">CPF</label>
                     <input 
                       type="text" 
                       value={form.cpf}
                       onChange={e => setForm({...form, cpf: formatCPF(e.target.value)})}
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                       placeholder="000.000.000-00"
                     />
                     {errors.cpf && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.cpf}</p>}
                   </div>
                   <div>
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Data de Nascimento</label>
                     <input 
                       type="date" 
                       value={form.dataNascimento}
                       onChange={e => setForm({...form, dataNascimento: e.target.value})}
                       style={{ colorScheme: 'dark' }}
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-white"
                     />
                     {errors.dataNascimento && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.dataNascimento}</p>}
                   </div>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="md:col-span-2">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">CNPJ</label>
                     <div className="relative">
                       <input 
                         type="text" 
                         value={form.cnpj}
                         onChange={e => setForm({...form, cnpj: formatCNPJ(e.target.value)})}
                         onBlur={(e) => fetchCNPJ(e.target.value)}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                         placeholder="00.000.000/0000-00"
                       />
                       {loadingCnpj && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] opacity-50">Buscando...</span>}
                     </div>
                     {errors.cnpj && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.cnpj}</p>}
                   </div>
                   <div>
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Razão Social</label>
                     <input 
                       type="text" 
                       value={form.razaoSocial}
                       onChange={e => setForm({...form, razaoSocial: e.target.value})}
                       className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition opacity-70"
                       readOnly
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Nome Fantasia</label>
                     <input 
                       type="text" 
                       value={form.nomeFantasia}
                       onChange={e => setForm({...form, nomeFantasia: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                     />
                   </div>
                   <div className="md:col-span-2 mt-4">
                     <h3 className="text-xs uppercase tracking-widest font-bold text-[#d4af37] mb-4">Dados do Representante Legal</h3>
                   </div>
                   <div>
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Nome do Representante</label>
                     <input 
                       type="text" 
                       value={form.representanteLegal}
                       onChange={e => setForm({...form, representanteLegal: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                     />
                     {errors.representanteLegal && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.representanteLegal}</p>}
                   </div>
                   <div>
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">CPF do Representante</label>
                     <input 
                       type="text" 
                       value={form.cpfRepresentante}
                       onChange={e => setForm({...form, cpfRepresentante: formatCPF(e.target.value)})}
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                     />
                     {errors.cpfRepresentante && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.cpfRepresentante}</p>}
                   </div>
                 </div>
               )}

               {/* Endereço - Comum a ambos */}
               <div className="space-y-4 pt-6 border-t border-white/5 relative z-20">
                 <h3 className="text-xs uppercase tracking-widest font-bold text-[#d4af37] mb-4">Endereço</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="md:col-span-1">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">CEP</label>
                     <div className="relative">
                       <input 
                         type="text" 
                         value={form.cep}
                         onChange={e => setForm({...form, cep: formatCEP(e.target.value)})}
                         onBlur={(e) => fetchCEP(e.target.value)}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                         placeholder="00000-000"
                       />
                       {loadingCep && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] opacity-50">...</span>}
                     </div>
                     {errors.cep && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.cep}</p>}
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Logradouro / Rua</label>
                     <input 
                       type="text" 
                       value={form.endereco}
                       onChange={e => setForm({...form, endereco: e.target.value})}
                       className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition opacity-70"
                     />
                   </div>
                   <div className="md:col-span-1">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Número</label>
                     <input 
                       type="text" 
                       value={form.numero}
                       onChange={e => setForm({...form, numero: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                     />
                     {errors.numero && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.numero}</p>}
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Complemento (Opcional)</label>
                     <input 
                       type="text" 
                       value={form.complemento}
                       onChange={e => setForm({...form, complemento: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                     />
                   </div>
                   <div className="md:col-span-1">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Bairro</label>
                     <input 
                       type="text" 
                       value={form.bairro}
                       readOnly
                       className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 min-h-[48px] text-sm opacity-70"
                     />
                   </div>
                   <div className="md:col-span-1">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Cidade</label>
                     <input 
                       type="text" 
                       value={form.cidade}
                       readOnly
                       className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 min-h-[48px] text-sm opacity-70"
                     />
                   </div>
                   <div className="md:col-span-1">
                     <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Estado (UF)</label>
                     <input 
                       type="text" 
                       value={form.estado}
                       readOnly
                       className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 min-h-[48px] text-sm opacity-70"
                     />
                   </div>
                 </div>
               </div>

               {/* Documentos */}
               <div className="space-y-4 pt-6 border-t border-white/5">
                 <h3 className="text-xs uppercase tracking-widest font-bold text-[#d4af37] mb-4">Upload de Documento</h3>
                 <p className="text-xs opacity-50 mb-2">
                   {kycType === 'PF' ? 'Envie uma foto digitalizada CNH ou frente/verso do seu RG.' : 'Envie o Contrato Social da Empresa ou Certificado Condição MEI (CCMEI).'}
                 </p>
                 
                 {!form.documentoFile ? (
                   <div className="relative border-2 border-dashed border-white/20 hover:border-[#d4af37]/50 rounded-2xl p-8 text-center transition bg-white/5 hover:bg-[#d4af37]/5 group">
                     <input 
                       type="file" 
                       accept=".jpg,.jpeg,.png,.pdf"
                       onChange={handleDocumentUpload}
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                     />
                     <Upload className="w-8 h-8 text-white/30 group-hover:text-[#d4af37] mx-auto mb-3 transition" />
                     <span className="block text-sm font-bold text-white mb-1">Arraste ou clique para enviar</span>
                     <span className="text-[10px] uppercase tracking-widest opacity-40">JPG, PNG ou PDF (Máx. 5MB)</span>
                   </div>
                 ) : (
                   <div className="flex items-center justify-between p-4 bg-white/5 border border-[#d4af37]/30 rounded-xl">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-[#d4af37]/10 rounded-lg flex items-center justify-center">
                         {form.documentoFile.type.includes('pdf') ? <FileText className="text-[#d4af37] w-5 h-5" /> : <Upload className="text-[#d4af37] w-5 h-5" />}
                       </div>
                       <div>
                         <p className="text-sm font-bold truncate max-w-[200px]">{form.documentoFile.name}</p>
                         <p className="text-[10px] opacity-50">{(form.documentoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                       </div>
                     </div>
                     <button type="button" onClick={removeFile} className="p-2 hover:bg-white/10 rounded-lg transition" title="Remover">
                       <X className="w-4 h-4 opacity-50 hover:opacity-100" />
                     </button>
                   </div>
                 )}
                 {errors.documentoFile && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.documentoFile}</p>}
               </div>

               {/* LGPD e Termos Específicos KYC */}
               <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex gap-3 items-start mt-6">
                 <Lock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                 <p className="text-xs text-blue-400/80 leading-relaxed font-medium">
                   <strong>Por que pedimos isso?</strong> Seus dados e documentos são protegidos com criptografia de ponta a ponta e processados <strong>exclusivamente</strong> para conformidade financeira e prevenção à fraude (Circulares Nº 3.978 do Banco Central do Brasil). Não compartilhamos com terceiros para fins de marketing.
                 </p>
               </div>

               <button 
                 type="submit"
                 disabled={loading}
                 className="w-full py-5 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_30px_rgba(212,175,55,0.2)] rounded-2xl hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed mt-8 flex items-center justify-center gap-2"
               >
                 {loading ? (
                   <>Enviando Dados...</>
                 ) : (
                   <>Finalizar Verificação de Identidade</>
                 )}
               </button>

             </motion.div>
           </AnimatePresence>
         )}
       </form>
    </div>
  );
};

// Para usar no arquivo App.tsx crie uma View ou Step 'kyc' e renderize `&lt;KYCForm /&gt;`

const Clock = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
