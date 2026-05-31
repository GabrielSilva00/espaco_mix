import React, { useEffect, useState } from 'react';
import { getSystemConfig, SystemConfig } from '../lib/supabase';
import type { CurrentView } from '../types';

interface FooterProps {
  onNavigate: (view: CurrentView) => void;
  showCookies: boolean;
}

export function Footer({ onNavigate, showCookies }: FooterProps) {
  const [config, setConfig] = useState<Partial<SystemConfig>>({});

  useEffect(() => {
    getSystemConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);

  const siteName = config.trade_name || config.site_name || 'Espaço Mix Eventos';
  const instagram = config.social_instagram?.replace('@', '');
  const whatsappRaw = config.contact_phone?.replace(/\D/g, '');
  const whatsappLink = whatsappRaw ? `https://wa.me/55${whatsappRaw}` : null;
  const instagramLink = instagram ? `https://instagram.com/${instagram}` : null;
  const documentLabel = config.person_type === 'pj' ? 'CNPJ' : config.person_type === 'pf' ? 'CPF' : 'Documento';

  return (
    <footer className="border-t border-[#ffffff1a] bg-[#0a0a0a]/80 backdrop-blur-sm relative z-40">

      {/* Corpo principal */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Coluna 1 — Empresa */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xs uppercase tracking-[0.25em] font-bold text-[#d4af37]">
              {siteName}
            </h3>

            {config.address && (
              <p className="text-[11px] text-white/40 leading-relaxed">
                {config.address}
              </p>
            )}

            {config.document && (
              <p className="text-[11px] text-white/40 font-mono">
                {documentLabel}: {config.document}
              </p>
            )}

            {/* Selos de pagamento */}
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { label: 'PIX', color: 'text-[#32bcad]' },
                { label: 'Visa', color: 'text-white/50' },
                { label: 'Master', color: 'text-white/50' },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className={`text-[9px] uppercase tracking-widest border border-white/10 rounded px-2 py-0.5 ${color}`}
                >
                  {label}
                </span>
              ))}
              <span className="text-[9px] uppercase tracking-widest border border-white/10 rounded px-2 py-0.5 text-green-400/70 flex items-center gap-1">
                <svg className="w-2 h-2" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L7.5 4.5H11L8.25 6.75L9.25 10.5L6 8.25L2.75 10.5L3.75 6.75L1 4.5H4.5L6 1Z" fill="currentColor" />
                </svg>
                SSL
              </span>
            </div>
          </div>

          {/* Coluna 2 — Navegação */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/30 mb-1">
              Navegação
            </h4>
            {[
              { label: 'Início', view: 'home' as CurrentView },
              { label: 'Contato', view: 'contact' as CurrentView },
            ].map(({ label, view }) => (
              <button
                key={view}
                onClick={() => onNavigate(view)}
                className="text-left text-[11px] text-white/50 hover:text-[#d4af37] transition-colors uppercase tracking-wider"
              >
                {label}
              </button>
            ))}

            <div className="w-full h-px bg-white/5 my-1" />

            <h4 className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/30 mb-1">
              Legal
            </h4>
            <button
              onClick={() => onNavigate('privacy')}
              className="text-left text-[11px] text-white/50 hover:text-[#d4af37] transition-colors uppercase tracking-wider"
            >
              Política de Privacidade
            </button>
            <button
              onClick={() => onNavigate('terms')}
              className="text-left text-[11px] text-white/50 hover:text-[#d4af37] transition-colors uppercase tracking-wider"
            >
              Termos de Uso
            </button>
            {showCookies && (
              <button
                onClick={() => onNavigate('profile-privacy')}
                className="text-left text-[11px] text-white/50 hover:text-[#d4af37] transition-colors uppercase tracking-wider"
              >
                Preferências de Cookies
              </button>
            )}
          </div>

          {/* Coluna 3 — Contato */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/30 mb-1">
              Contato
            </h4>

            {config.contact_email && (
              <a
                href={`mailto:${config.contact_email}`}
                className="flex items-center gap-2 text-[11px] text-white/50 hover:text-[#d4af37] transition-colors group"
              >
                <svg className="w-3 h-3 shrink-0 text-white/20 group-hover:text-[#d4af37]/60 transition-colors" viewBox="0 0 16 16" fill="none">
                  <path d="M2 3h12a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1 4l7 5 7-5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                {config.contact_email}
              </a>
            )}

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[11px] text-white/50 hover:text-green-400 transition-colors group"
              >
                <svg className="w-3 h-3 shrink-0 text-white/20 group-hover:text-green-400/60 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                {config.contact_phone}
              </a>
            )}

            {config.support_email && config.support_email !== config.contact_email && (
              <a
                href={`mailto:${config.support_email}`}
                className="flex items-center gap-2 text-[11px] text-white/40 hover:text-[#d4af37] transition-colors"
              >
                <span className="text-[9px] uppercase tracking-widest border border-white/10 rounded px-1.5 py-0.5 text-white/25">
                  Suporte
                </span>
                {config.support_email}
              </a>
            )}

            <p className="text-[10px] text-white/25 mt-1 leading-relaxed">
              Seg–Sex: 09h às 18h
              <br />
              Sáb: 10h às 14h
            </p>
          </div>

          {/* Coluna 4 — Redes Sociais */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/30 mb-1">
              Redes Sociais
            </h4>

            {instagramLink ? (
              <a
                href={instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-[11px] text-white/50 hover:text-[#d4af37] transition-colors group"
              >
                <span className="w-7 h-7 rounded-lg border border-white/10 group-hover:border-[#d4af37]/30 flex items-center justify-center transition-colors bg-white/5 group-hover:bg-[#d4af37]/5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                @{instagram}
              </a>
            ) : (
              <p className="text-[10px] text-white/20 italic">
                Nenhuma rede configurada
              </p>
            )}
          </div>

        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-[#ffffff0d] px-6 md:px-10 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-center">
            <p className="text-[9px] text-white/30 uppercase tracking-widest">
              © 2026 {siteName}. Todos os direitos reservados.
            </p>
            <span className="hidden sm:block text-white/10">·</span>
            <p className="text-[9px] text-white/20 uppercase tracking-widest">
              Desenvolvido por{' '}
              <span className="text-[#d4af37]/40 font-bold">NEXO SOLUÇÕES DIGITAIS</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-[9px] text-white/50 uppercase tracking-[0.2em]">Reservas Ativas</span>
          </div>
        </div>
      </div>

    </footer>
  );
}
