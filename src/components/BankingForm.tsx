import React, { useState } from 'react';
import { Landmark, QrCode, ShieldCheck, AlertCircle, Building2, User, HelpCircle, Lock } from 'lucide-react';

type MethodType = 'PIX' | 'TED';
type PixType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export const BankingForm = ({ onComplete }: { onComplete?: (data: any) => void }) => {
  const [method, setMethod] = useState<MethodType>('PIX');
  const [pixType, setPixType] = useState<PixType>('cpf');
  
  const [form, setForm] = useState({
    // Pix Fields
    pixKey: '',
    pixKeyConfirm: '',
    pixHolderName: '',
    
    // Bank Fields
    bankCode: '',
    accountType: 'corrente',
    agency: '',
    account: '',
    accountHolderCpfCnpj: '',
    accountHolderName: '',

    // Settings
    payoutSchedule: 'after_event'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Masks
  const handlePixKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (pixType === 'cpf') {
      val = val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
    } else if (pixType === 'cnpj') {
      val = val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2').substring(0, 18);
    } else if (pixType === 'phone') {
      val = val.replace(/\D/g, '').substring(0, 11);
      if (val.length > 2) val = `(${val.substring(0, 2)}) ${val.substring(2)}`;
      if (val.length > 9) val = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
    }
    setForm(prev => ({ ...prev, pixKey: val }));
  };

  const bancos = [
    { code: '001', name: '001 - Banco do Brasil S.A.' },
    { code: '033', name: '033 - Banco Santander (Brasil) S.A.' },
    { code: '104', name: '104 - Caixa Econômica Federal' },
    { code: '237', name: '237 - Banco Bradesco S.A.' },
    { code: '341', name: '341 - Itaú Unibanco S.A.' },
    { code: '260', name: '260 - Nubank' },
    { code: '077', name: '077 - Banco Inter' },
    { code: '336', name: '336 - C6 Bank' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (method === 'PIX') {
      if (!form.pixKey) newErrors.pixKey = 'Chave PIX obrigatória';
      if (form.pixKey !== form.pixKeyConfirm) newErrors.pixKeyConfirm = 'As chaves PIX não conferem';
      if (!form.pixHolderName) newErrors.pixHolderName = 'Nome do titular obrigatório';
    } else {
      if (!form.bankCode) newErrors.bankCode = 'Selecione o banco';
      if (!form.agency) newErrors.agency = 'Agência obrigatória';
      if (!form.account) newErrors.account = 'Conta obrigatória';
      if (!form.accountHolderCpfCnpj) newErrors.accountHolderCpfCnpj = 'Documento obrigatório';
      if (!form.accountHolderName) newErrors.accountHolderName = 'Nome do titular obrigatório';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    // Submit to backend
    setTimeout(() => {
      setLoading(false);
      if (onComplete) onComplete({ method, pixType, ...form });
    }, 1500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto relative z-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-serif text-[#d4af37] mb-2 flex items-center justify-center gap-2">
          <Landmark className="w-6 h-6 text-[#d4af37]" />
          Dados Financeiros e Repasse
        </h1>
        <p className="text-[11px] uppercase tracking-[0.1em] opacity-50 px-4">
          Onde você quer receber pelas suas vendas?
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37] opacity-5 blur-[100px] rounded-full pointer-events-none"></div>

        {/* Método Selection */}
        <div className="space-y-6 mb-8 relative z-10">
          <p className="text-sm font-bold opacity-80 mb-4">Escolha a forma de recebimento principal:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setMethod('PIX'); setErrors({}); }}
              className={`flex flex-col items-center gap-3 p-6 border rounded-2xl transition group ${method === 'PIX' ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-white/10 hover:border-[#d4af37]/50'}`}
            >
              <QrCode className={`w-8 h-8 ${method === 'PIX' ? 'text-[#d4af37]' : 'text-white/30 group-hover:text-[#d4af37]'} transition`} />
              <div className="text-center">
                <span className="block font-bold text-white mb-1">PIX</span>
                <span className="text-[10px] uppercase tracking-widest opacity-40">Repasse mais rápido (Recomendado)</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setMethod('TED'); setErrors({}); }}
              className={`flex flex-col items-center gap-3 p-6 border rounded-2xl transition group ${method === 'TED' ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-white/10 hover:border-[#d4af37]/50'}`}
            >
              <Building2 className={`w-8 h-8 ${method === 'TED' ? 'text-[#d4af37]' : 'text-white/30 group-hover:text-[#d4af37]'} transition`} />
              <div className="text-center">
                <span className="block font-bold text-white mb-1">Transferência Bancária</span>
                <span className="text-[10px] uppercase tracking-widest opacity-40">Conta Corrente ou Poupança</span>
              </div>
            </button>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 relative z-10">
          {method === 'PIX' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Tipo de Chave PIX</label>
                <div className="flex flex-wrap gap-2">
                  {(['cpf', 'cnpj', 'email', 'phone', 'random'] as PixType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setPixType(type); setForm(f => ({...f, pixKey: '', pixKeyConfirm: ''})); setErrors({}); }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition ${pixType === type ? 'bg-[#d4af37] text-black shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}
                    >
                      {type === 'phone' ? 'Celular' : type === 'random' ? 'Aleatória' : type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Chave PIX</label>
                  <input 
                    type={pixType === 'email' ? 'email' : 'text'}
                    value={form.pixKey}
                    onChange={handlePixKeyChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition font-mono"
                    placeholder="Digite sua chave..."
                  />
                  {errors.pixKey && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.pixKey}</p>}
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Confirmar Chave PIX</label>
                  <input 
                    type={pixType === 'email' ? 'email' : 'text'}
                    value={form.pixKeyConfirm}
                    onPaste={e => e.preventDefault()} // Security friction
                    onChange={e => { setForm({...form, pixKeyConfirm: e.target.value}); setErrors({...errors, pixKeyConfirm: ''}); }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition font-mono"
                    placeholder="Digite novamente..."
                  />
                  {errors.pixKeyConfirm && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.pixKeyConfirm}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Nome do Titular da Conta</label>
                  <input 
                    type="text"
                    value={form.pixHolderName}
                    onChange={e => setForm({...form, pixHolderName: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                    placeholder="Como consta no banco (Deve bater com o KYC)"
                  />
                  {errors.pixHolderName && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.pixHolderName}</p>}
                  <p className="text-[10px] text-amber-500/70 mt-2 flex items-start gap-1 ml-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    A conta destino deve obrigatoriamente estar no mesmo documento (CPF/CNPJ) verificado na Etapa 2. Repasses para terceiros não são permitidos.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Banco</label>
                  <select
                    value={form.bankCode}
                    onChange={e => setForm({...form, bankCode: e.target.value})}
                    className="w-full select-field min-h-[48px]"
                  >
                    <option value="">Selecione o banco...</option>
                    {bancos.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                    <option value="other">Outro (Listar todos)</option>
                  </select>
                  {errors.bankCode && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.bankCode}</p>}
                </div>
                
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Tipo de Conta</label>
                  <select
                    value={form.accountType}
                    onChange={e => setForm({...form, accountType: e.target.value})}
                    className="w-full select-field min-h-[48px]"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                  </select>
                </div>
                
                <div className="flex gap-2">
                  <div className="w-1/3">
                    <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Agência</label>
                    <input 
                      type="text"
                      value={form.agency}
                      onChange={e => setForm({...form, agency: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition font-mono"
                      placeholder="Sem dígito"
                    />
                    {errors.agency && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.agency}</p>}
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Conta (com dígito)</label>
                    <input 
                      type="text"
                      value={form.account}
                      onChange={e => setForm({...form, account: e.target.value.replace(/[^0-9-xX]/g, '')})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition font-mono"
                      placeholder="Ex: 12345-6"
                    />
                    {errors.account && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.account}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">CPF / CNPJ do Titular</label>
                  <input 
                    type="text"
                    value={form.accountHolderCpfCnpj}
                    onChange={e => setForm({...form, accountHolderCpfCnpj: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition font-mono"
                  />
                  {errors.accountHolderCpfCnpj && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.accountHolderCpfCnpj}</p>}
                </div>
                
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] opacity-50 mb-1 ml-1">Nome do Titular</label>
                  <input 
                    type="text"
                    value={form.accountHolderName}
                    onChange={e => setForm({...form, accountHolderName: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                  />
                  {errors.accountHolderName && <p className="text-red-400 text-[10px] uppercase tracking-widest mt-1 ml-1">{errors.accountHolderName}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Informação sobre split e segurança */}
        <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
             <ShieldCheck className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
             <p className="text-xs text-blue-400/80 leading-relaxed font-medium">
               <strong>Split de Pagamentos Ativo.</strong> Suas vendas processadas já descontarão automaticamente a taxa da plataforma, enviando o saldo líquido para suas "Receitas a Receber".
             </p>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-start gap-3">
             <Lock className="w-5 h-5 opacity-40 mt-0.5 shrink-0" />
             <p className="text-[11px] text-white/50 leading-relaxed">
               Dados financeiros armazenados de forma criptografada seguindo diretrizes do PCI-DSS e Bacen. Nenhum funcionário do suporte tem acesso à chave completa da conta bancária.
             </p>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full py-5 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_30px_rgba(212,175,55,0.2)] rounded-2xl hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed mt-8 flex items-center justify-center gap-2"
        >
          {loading ? 'Salvando Dados...' : 'Salvar Dados Bancários e Concluir'}
        </button>
      </form>
    </div>
  );
};
