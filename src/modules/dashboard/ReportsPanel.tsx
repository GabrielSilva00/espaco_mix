import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { DollarSign, TrendingUp, Users, BarChart3, Filter, ChevronDown } from 'lucide-react';
import type { Event, Reservation } from '../../types';

function CustomSelect<T extends string | number>({
  value, onChange, options, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as unknown as T)}
        className="w-full appearance-none bg-[#0d0d0d] border border-white/10 text-white text-[11px] uppercase tracking-widest font-bold rounded-xl px-4 py-2.5 pr-8 focus:outline-none focus:border-[#d4af37]/50 transition cursor-pointer hover:border-white/20"
      >
        {options.map(o => (
          <option key={String(o.value)} value={o.value} className="bg-[#0d0d0d] text-white normal-case tracking-normal font-normal">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
    </div>
  );
}

interface ReportsPanelProps {
  events: Event[];
  reservations: Reservation[];
  gatewayFeePercent: number;
  platformFeePercent: number;
  platformFeeType: 'percentage' | 'fixed';
}

type FilterType = 'all' | 'event' | 'month' | 'year';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PIE_COLORS = ['#d4af37', '#C9A84C', '#8B7000', '#F0D060'];

export function ReportsPanel({ events, reservations, gatewayFeePercent, platformFeePercent, platformFeeType }: ReportsPanelProps) {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedEventId, setSelectedEventId] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const filtered = useMemo(() => {
    const paid = reservations.filter(r => r.paymentStatus === 'approved');
    if (filterType === 'event' && selectedEventId !== 'all') {
      return paid.filter(r => r.eventId === selectedEventId);
    }
    if (filterType === 'month') {
      return paid.filter(r => {
        if (!r.createdAt) return false;
        const d = new Date(r.createdAt);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
    }
    if (filterType === 'year') {
      return paid.filter(r => {
        if (!r.createdAt) return false;
        return new Date(r.createdAt).getFullYear() === selectedYear;
      });
    }
    return paid;
  }, [reservations, filterType, selectedEventId, selectedMonth, selectedYear]);

  // Relatório 1 — Financeiro
  // platformFee/netAmount vêm do banco (gravados por venda). Quando ausentes,
  // o fallback usa a TAXA CONFIGURADA (não mais um 10% fixo), igual ao painel de
  // controle (AdminOverviewPanel). A taxa do gateway (MP) não é gravada por
  // venda, então é aplicada aqui sobre o líquido pós-plataforma.
  const platformFeeOf = (total: number) =>
    platformFeeType === 'fixed' ? platformFeePercent : total * (platformFeePercent / 100);
  const grossRevenue = filtered.reduce((s, r) => s + r.total, 0);
  const platformFees = filtered.reduce((s, r) => s + (r.platformFee ?? platformFeeOf(r.total)), 0);
  const netAfterPlatform = filtered.reduce((s, r) => s + (r.netAmount ?? (r.total - platformFeeOf(r.total))), 0);
  const gatewayFees = netAfterPlatform * (gatewayFeePercent / 100);
  const netRevenue = netAfterPlatform - gatewayFees;
  const totalFees = platformFees + gatewayFees;
  const platformFeeLabel = platformFeeType === 'fixed' ? `R$ ${platformFeePercent.toFixed(2)}/venda` : `${platformFeePercent}%`;

  const byMethod = [
    { name: 'PIX', value: filtered.filter(r => r.paymentMethod === 'pix').reduce((s, r) => s + r.total, 0) },
    { name: 'Crédito', value: filtered.filter(r => r.paymentMethod === 'credit_card').reduce((s, r) => s + r.total, 0) },
    { name: 'Débito', value: filtered.filter(r => r.paymentMethod === 'debit_card').reduce((s, r) => s + r.total, 0) },
  ].filter(m => m.value > 0);

  // Relatório 2 — Vendas por tipo de ingresso
  const byTicketType = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      (r.ticketsObj ?? []).forEach(item => {
        map[item.name] = (map[item.name] ?? 0) + 1;
      });
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  // Relatório 3 — Check-in por evento
  const checkinByEvent = useMemo(() => {
    return events.slice(0, 8).map(ev => {
      const evRes = filtered.filter(r => r.eventId === ev.id);
      const total = evRes.length;
      const checkedIn = evRes.filter(r => r.checkedIn).length;
      return { name: ev.title.slice(0, 16) + (ev.title.length > 16 ? '…' : ''), checkedIn, total };
    }).filter(e => e.total > 0);
  }, [filtered, events]);

  const years = Array.from(new Set([
    new Date().getFullYear(),
    ...reservations.map(r => r.createdAt ? new Date(r.createdAt).getFullYear() : null).filter(Boolean) as number[],
  ])).sort((a, b) => b - a);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="px-4 xl:px-0 pb-20 animate-in fade-in duration-500 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#d4af37]" />
          </div>
          <h2 className="text-2xl md:text-3xl font-serif text-[#d4af37]">Relatórios</h2>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-white/30" />
          {(['all', 'event', 'month', 'year'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-widest transition ${filterType === f ? 'bg-[#d4af37] text-black' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              {f === 'all' ? 'Tudo' : f === 'event' ? 'Evento' : f === 'month' ? 'Mês' : 'Ano'}
            </button>
          ))}

          {filterType === 'event' && (
            <CustomSelect
              value={selectedEventId}
              onChange={v => setSelectedEventId(v === 'all' ? 'all' : Number(v))}
              options={[
                { value: 'all' as string | number, label: 'Todos os eventos' },
                ...events.map(ev => ({ value: ev.id as string | number, label: ev.title })),
              ]}
            />
          )}
          {filterType === 'month' && (
            <div className="flex gap-2">
              <CustomSelect
                value={selectedMonth}
                onChange={v => setSelectedMonth(Number(v))}
                options={MONTHS.map((m, i) => ({ value: i, label: m }))}
              />
              <CustomSelect
                value={selectedYear}
                onChange={v => setSelectedYear(Number(v))}
                options={years.map(y => ({ value: y, label: String(y) }))}
              />
            </div>
          )}
          {filterType === 'year' && (
            <CustomSelect
              value={selectedYear}
              onChange={v => setSelectedYear(Number(v))}
              options={years.map(y => ({ value: y, label: String(y) }))}
            />
          )}
        </div>
      </div>

      {/* Relatório 1 — Financeiro */}
      <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
        <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-6 flex items-center gap-3">
          <DollarSign className="w-4 h-4" /> Financeiro &amp; Faturamento
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Faturamento Bruto', value: fmt(grossRevenue), color: 'text-[#d4af37]' },
            { label: `Taxas (plataforma ${platformFeeLabel} + MP ${gatewayFeePercent}%)`, value: fmt(totalFees), color: 'text-red-400' },
            { label: 'Faturamento Líquido', value: fmt(netRevenue), color: 'text-green-400' },
          ].map(card => (
            <div key={card.label} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
              <p className="text-[9px] uppercase tracking-widest opacity-40 mb-1">{card.label}</p>
              <p className={`text-xl font-serif font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {byMethod.length > 0 ? (
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {byMethod.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3 flex-1">
              {byMethod.map((m, i) => (
                <div key={m.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm text-white/60">{m.name}</span>
                  </div>
                  <span className="text-sm font-serif text-white">{fmt(m.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/20 text-center py-8">Nenhuma venda aprovada no período</p>
        )}
      </div>

      {/* Relatório 2 — Vendas por Tipo de Ingresso */}
      <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
        <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-6 flex items-center gap-3">
          <TrendingUp className="w-4 h-4" /> Vendas por Tipo de Ingresso
        </h3>
        {byTicketType.length > 0 ? (
          <div className="space-y-3">
            {byTicketType.map(t => (
              <div key={t.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/60">{t.name}</span>
                  <span className="text-white/40">{t.count} ({t.pct}%)</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#d4af37] rounded-full transition-all" style={{ width: `${t.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/20 text-center py-8">Nenhum ingresso no período</p>
        )}
      </div>

      {/* Relatório 3 — Check-in Operacional por Evento */}
      <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
        <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-6 flex items-center gap-3">
          <Users className="w-4 h-4" /> Check-in por Evento
        </h3>
        {checkinByEvent.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={checkinByEvent} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#d4af37', fontSize: 11 }}
              />
              <Bar dataKey="total" name="Total" fill="rgba(212,175,55,0.2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="checkedIn" name="Check-in" fill="#d4af37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-white/20 text-center py-8">Nenhum dado de check-in no período</p>
        )}
      </div>
    </div>
  );
}
