import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle, RefreshCcw, Download, DollarSign, Wallet, FileText, AlertCircle } from 'lucide-react';

export const PayoutDashboard = () => {
  const [activeTab, setActiveTab] = useState<'disponivel' | 'historico'>('disponivel');

  // MOCK DATA
  const balance = {
    available: 12450.00,
    locked: 45000.00, // Pending events
    nextPayoutDate: '2026-05-15'
  };

  const pastPayouts = [
    { id: 'TRF-001', date: '01 Mai 2026', amount: 8400.00, status: 'paid', method: 'PIX (***.431.233-**)', event: 'Sunset Open Air' },
    { id: 'TRF-002', date: '15 Abr 2026', amount: 3200.50, status: 'paid', method: 'PIX (***.431.233-**)', event: 'Jazz Night' },
    { id: 'TRF-003', date: '01 Abr 2026', amount: 15400.00, status: 'paid', method: 'TED (Bco 341)', event: 'Festival de Inverno' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#d4af37] mb-1">Meus Repasses</h2>
          <p className="text-[11px] uppercase tracking-widest opacity-50">Transparência total dos seus recebíveis</p>
        </div>
        <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> Relatório Financeiro
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Saldo Disponível */}
        <div className="bg-[#0a0a0a] border border-[#d4af37]/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(212,175,55,0.05)]">
          <div className="w-10 h-10 bg-[#d4af37]/10 rounded-full flex items-center justify-center mb-4">
            <DollarSign className="w-5 h-5 text-[#d4af37]" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37] mb-1">Saldo Disponível para Saque</p>
          <h3 className="text-3xl font-serif text-white">R$ 12.450,00</h3>
          
          <button className="w-full mt-6 bg-[#d4af37] text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            Solicitar Saque (PIX)
          </button>
        </div>

        {/* Saldo Retido/A Receber */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6">
          <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">A Receber (Após Eventos)</p>
          <h3 className="text-3xl font-serif text-white">R$ 45.000,00</h3>
          <p className="text-[10px] opacity-40 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Liberado 2 dias após a realização do evento
          </p>
        </div>

        {/* Dados Cadastrados */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 hidden md:block">
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-5 h-5 text-white/50" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">Conta Principal (PIX)</p>
          <div className="space-y-2 text-sm font-mono opacity-80">
            <p>CPF: ***.431.233-**</p>
            <p>Titular: GABRIEL F*** S***</p>
          </div>
          <button className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:underline mt-4">
            Alterar Dados
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 mt-8">
        <button 
          onClick={() => setActiveTab('disponivel')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-widest transition border-b-2 ${activeTab === 'disponivel' ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/40 hover:text-white'}`}
        >
          Extrato e Tarifas
        </button>
        <button 
          onClick={() => setActiveTab('historico')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-widest transition border-b-2 ${activeTab === 'historico' ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/40 hover:text-white'}`}
        >
          Histórico de Repasses
        </button>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden min-h-[300px]">
        {activeTab === 'historico' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-[9px] uppercase tracking-widest text-white/40 border-b border-white/10">
                  <th className="p-4 font-bold">ID / Protocolo</th>
                  <th className="p-4 font-bold">Data</th>
                  <th className="p-4 font-bold">Evento Vinculado</th>
                  <th className="p-4 font-bold">Destino</th>
                  <th className="p-4 font-bold">Valor Líquido</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-center">NF/Recibo</th>
                </tr>
              </thead>
              <tbody>
                {pastPayouts.map(po => (
                  <tr key={po.id} className="border-b border-white/5 hover:bg-white/5 transition text-sm">
                    <td className="p-4 font-mono text-white/60">{po.id}</td>
                    <td className="p-4">{po.date}</td>
                    <td className="p-4">{po.event}</td>
                    <td className="p-4 text-xs font-mono">{po.method}</td>
                    <td className="p-4 font-bold text-green-400">R$ {po.amount.toFixed(2)}</td>
                    <td className="p-4">
                      <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" /> Concluído
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition" title="Baixar NF">
                        <FileText className="w-4 h-4 text-white/60" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center flex flex-col items-center justify-center h-full">
            <RefreshCcw className="w-8 h-8 text-white/20 mb-3" />
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Seu extrato ficará disponível após iniciar as vendas</p>
          </div>
        )}
      </div>

    </div>
  );
};
