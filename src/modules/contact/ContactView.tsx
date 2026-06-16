import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, Phone, Clock, MapPin, MessageCircle, Check, ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getSystemConfig, SystemConfig } from '../../lib/supabase';

const PLACEHOLDER = '[A PREENCHER]';

const ESTADOS_BR = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

interface FormData {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  estado: string;
  evento: string;
  mensagem: string;
}

const INITIAL_FORM: FormData = {
  nome: '', email: '', telefone: '', cidade: '', estado: '', evento: '', mensagem: '',
};

const INPUT_CLASS =
  'w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#B5E254]/40 focus:bg-white/[0.06] transition-all duration-200';
const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5 block';

export function ContactView() {
  const { setCurrentView } = useApp();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [config, setConfig] = useState<Partial<SystemConfig>>({});

  useEffect(() => {
    const prev = document.title;
    document.title = 'Contato | Espaço Mix';
    getSystemConfig().then(setConfig).catch(() => {});
    return () => { document.title = prev; };
  }, []);

  const contactEmail  = config.contact_email  || config.support_email || PLACEHOLDER;
  const contactPhone  = config.contact_phone  || PLACEHOLDER;
  const supportPhone  = config.support_phone  || PLACEHOLDER;
  const contactAddr   = config.address        || PLACEHOLDER;
  const whatsappRaw   = config.contact_phone?.replace(/\D/g, '');
  const whatsappLink  = whatsappRaw ? `https://wa.me/55${whatsappRaw}` : null;
  const mapsLink      = config.address
    ? `https://maps.google.com/?q=${encodeURIComponent(config.address)}`
    : null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).error || 'Não foi possível enviar sua mensagem.');
      }
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Falha ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const infoCards = [
    {
      icon: Mail,
      label: 'E-mail de Atendimento',
      content: contactEmail !== PLACEHOLDER ? (
        <a
          href={`mailto:${contactEmail}`}
          className="text-sm text-[#B5E254]/80 hover:text-[#B5E254] transition-colors duration-200"
        >
          {contactEmail}
        </a>
      ) : (
        <span className="text-sm text-white/30 italic">{PLACEHOLDER}</span>
      ),
    },
    {
      icon: Phone,
      label: 'Telefone',
      content: (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-white/60">{contactPhone}</span>
          {supportPhone !== PLACEHOLDER && (
            <span className="text-sm text-white/60">{supportPhone}</span>
          )}
        </div>
      ),
    },
    {
      icon: Clock,
      label: 'Horário de Atendimento',
      content: (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-white/60">
            Segunda à sexta: 08h às 18h{' '}
            <span className="text-[10px] text-white/30">(exceto feriados)</span>
          </span>
          <span className="text-sm text-white/60">Sábado: 10h às 14h</span>
        </div>
      ),
    },
    {
      icon: MapPin,
      label: 'Endereço',
      content: (
        <span className="text-sm text-white/60 leading-relaxed">{contactAddr}</span>
      ),
    },
  ];

  const InfoBlock = (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-serif text-white mb-3">Entre em Contato</h1>
        <p className="text-sm text-white/50 leading-relaxed max-w-sm">
          Se você tem dúvidas sobre nosso sistema, eventos ou deseja fazer uma sugestão,
          entre em contato.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {infoCards.map(({ icon: Icon, label, content }) => (
          <div
            key={label}
            className="flex items-start gap-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4"
          >
            <div className="w-9 h-9 rounded-xl bg-[#B5E254]/[0.08] border border-[#B5E254]/20 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-[#B5E254]/70" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
                {label}
              </p>
              {content}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {mapsLink && (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3 border border-white/10 text-white/60 text-[11px] font-bold uppercase tracking-widest rounded-full hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-200"
          >
            <MapPin className="w-4 h-4" />
            Ver no Google Maps
          </a>
        )}
        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#25D366]/[0.08] border border-[#25D366]/30 text-[#25D366]/90 text-[11px] font-bold uppercase tracking-widest rounded-full hover:bg-[#25D366]/[0.15] hover:border-[#25D366]/50 transition-all duration-200"
          >
            <MessageCircle className="w-4 h-4" />
            Atendimento via WhatsApp
          </a>
        )}
      </div>
    </div>
  );

  const FormBlock = (
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-3xl p-6 md:p-8">
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center text-center py-12 gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-[#B5E254]/[0.08] border border-[#B5E254]/30 flex items-center justify-center">
              <Check className="w-8 h-8 text-[#B5E254]" />
            </div>
            <h3 className="text-xl font-serif text-white">Mensagem enviada!</h3>
            <p className="text-sm text-white/50 max-w-xs leading-relaxed">
              Recebemos sua mensagem e responderemos em breve pelo e-mail informado.
            </p>
            <button
              onClick={() => { setForm(INITIAL_FORM); setSubmitted(false); }}
              className="mt-4 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition border border-white/10 rounded-full px-4 py-2"
            >
              Enviar outra mensagem
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            noValidate={false}
            className="flex flex-col gap-5"
          >
            <h2 className="text-lg font-serif text-white mb-1">Envie sua mensagem</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Nome Completo</label>
                <input
                  required
                  type="text"
                  name="nome"
                  value={form.nome}
                  onChange={handleChange}
                  placeholder="Seu nome completo"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>E-mail</label>
                <input
                  required
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Telefone</label>
                <input
                  required
                  type="tel"
                  name="telefone"
                  value={form.telefone}
                  onChange={handleChange}
                  placeholder="(00) 00000-0000"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Cidade</label>
                <input
                  required
                  type="text"
                  name="cidade"
                  value={form.cidade}
                  onChange={handleChange}
                  placeholder="Sua cidade"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Estado</label>
              <select
                required
                name="estado"
                value={form.estado}
                onChange={handleChange}
                className={`${INPUT_CLASS} appearance-none`}
              >
                <option value="">Selecione o estado</option>
                {ESTADOS_BR.map(e => (
                  <option key={e.uf} value={e.uf}>
                    {e.nome} ({e.uf})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Para qual evento você precisa de ajuda?</label>
              <input
                required
                type="text"
                name="evento"
                value={form.evento}
                onChange={handleChange}
                placeholder="Nome do evento ou 'Informações gerais'"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Mensagem</label>
              <textarea
                required
                name="mensagem"
                value={form.mensagem}
                onChange={handleChange}
                placeholder="Descreva sua dúvida ou sugestão..."
                rows={4}
                className={`${INPUT_CLASS} resize-none`}
              />
            </div>

            {submitError && (
              <p className="text-xs text-red-400 text-center">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-[#B5E254] text-black font-black text-[11px] uppercase tracking-widest rounded-full hover:brightness-105 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              {submitting ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 md:py-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/30 mb-10">
        <button
          onClick={() => setCurrentView('home')}
          className="hover:text-white/60 transition-colors duration-200"
        >
          Início
        </button>
        <ChevronRight className="w-3 h-3 text-white/20" />
        <span className="text-white/50">Contato</span>
      </nav>

      {/* Grid: no mobile, formulário vem antes; no desktop, info à esquerda, form à direita */}
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-16">
        <div className="order-last lg:order-first">{InfoBlock}</div>
        <div className="order-first lg:order-last">{FormBlock}</div>
      </div>
    </div>
  );
}
