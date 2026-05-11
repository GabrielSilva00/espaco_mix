import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, AlertCircle, ChevronRight, Check } from 'lucide-react';

type StepStatus = 'completed' | 'current' | 'pending' | 'review' | 'rejected';

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

export const ProducerOnboardingStepper = ({ 
  currentStatus = 'review',
  rejectionReason = ''
}) => {
  const steps: Step[] = [
    { id: 'account', title: 'Conta Criada', description: 'Dados básicos e e-mail verificado.', status: 'completed' },
    { id: 'kyc', title: 'Identidade (KYC)', description: 'Documentos e dados fiscais enviados.', status: 'completed' },
    { id: 'profile', title: 'Perfil Público', description: 'Página da produtora configurada.', status: 'completed' },
    { id: 'banking', title: 'Dados Bancários', description: 'Chave PIX ou conta validada.', status: 'completed' },
    { 
      id: 'approval', 
      title: 'Análise de Segurança', 
      description: currentStatus === 'rejected' ? 'Problemas encontrados.' : 'Equipe revisando seus dados.', 
      status: currentStatus as StepStatus 
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 relative z-10">
      
      {/* Visual Stepper */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-6">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex-1 flex flex-row md:flex-col items-center gap-4 relative w-full">
              {/* Connector Line (Desktop) */}
              {idx < steps.length - 1 && (
                <div className={`hidden md:block absolute top-[24px] left-[50%] w-full h-[2px] ${step.status === 'completed' ? 'bg-[#d4af37]' : 'bg-white/10'}`}></div>
              )}
              
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors duration-500 shadow-xl
                ${step.status === 'completed' ? 'bg-[#d4af37] text-black' : 
                  step.status === 'review' ? 'bg-blue-500 text-white animate-pulse' : 
                  step.status === 'rejected' ? 'bg-red-500 text-white' : 
                  'bg-white/5 border-2 border-white/10 text-white/40'}`}
              >
                {step.status === 'completed' ? <Check className="w-6 h-6" /> : 
                 step.status === 'review' ? <Clock className="w-6 h-6" /> :
                 step.status === 'rejected' ? <AlertCircle className="w-6 h-6" /> :
                 <span className="font-bold">{idx + 1}</span>}
              </div>
              
              <div className="text-left md:text-center flex-1">
                <p className={`text-sm font-bold uppercase tracking-widest ${step.status !== 'pending' ? 'text-white' : 'text-white/40'}`}>{step.title}</p>
                <p className="text-[10px] text-white/50 mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic Status Content */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-1">
        {currentStatus === 'review' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-10 text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 opacity-10 blur-[100px] rounded-full"></div>
             <Clock className="w-16 h-16 text-blue-400 mx-auto mb-6" />
             <h2 className="text-3xl font-serif text-white mb-4">Tudo certo, João! Sua conta está em análise.</h2>
             <p className="text-white/70 max-w-2xl mx-auto leading-relaxed text-sm mb-6">
               Recebemos todos os seus documentos e dados bancários. Nossa equipe de compliance está realizando as verificações sistêmicas (Receita Federal e Banco Central). 
               Este processo costuma levar <strong>até 2 dias úteis</strong>.
             </p>
             <div className="bg-[#050505]/50 border border-white/5 inline-flex flex-col items-start p-6 rounded-2xl text-left">
                <p className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-3">O que você já pode fazer:</p>
                <ul className="space-y-3 text-sm text-white/60">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#d4af37]" /> Acessar o rascunho da sua página pública</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#d4af37]" /> Criar e salvar eventos (como rascunho)</li>
                  <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-white/20 shrink-0"></div> Vender ingressos (Apenas após aprovação)</li>
                </ul>
             </div>
          </div>
        )}

        {currentStatus === 'rejected' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-10 text-center">
             <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
             <h2 className="text-3xl font-serif text-red-400 mb-4">Ação Necessária: Análise Pendente</h2>
             <p className="text-white/70 max-w-2xl mx-auto leading-relaxed text-sm mb-6">
               Identificamos uma inconsistência nos dados enviados que impede a aprovação imediata do seu cadastro para vendas. Não se preocupe, isso é fácil de resolver!
             </p>
             <div className="bg-[#050505]/50 border border-red-500/20 p-6 rounded-2xl max-w-md mx-auto mb-8 text-left">
                <p className="text-xs font-bold text-red-400 mb-2 uppercase tracking-widest">Motivo apontado pela equipe:</p>
                <p className="text-sm text-white">{rejectionReason || 'O documento de identidade enviado está inelegível ou cortado. Por favor, envie uma nova foto.'}</p>
             </div>
             <button className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition">
               Corrigir Dados Agora
             </button>
          </div>
        )}
      </motion.div>

    </div>
  );
};
