import React, { useEffect, useState } from 'react';
import { getSystemConfig, SystemConfig } from '../lib/supabase';
import type { CurrentView } from '../types';

interface FooterProps {
  onNavigate: (view: CurrentView) => void;
  showCookies: boolean;
  isAuthenticated: boolean;
}

// ─── Ícone SVG de Instagram ───────────────────────────────────────────────────
function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─── Ícone SVG de Facebook ────────────────────────────────────────────────────
function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

// ─── Ícone SVG de YouTube ─────────────────────────────────────────────────────
function IconYouTube({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
    </svg>
  );
}

// ─── Ícone SVG de TikTok ──────────────────────────────────────────────────────
function IconTikTok({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    </svg>
  );
}

// ─── Ícone de WhatsApp ────────────────────────────────────────────────────────
function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// ─── Botão de link de navegação com underline animado ─────────────────────────
function NavLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative text-left text-[11px] text-white/50 hover:text-white transition-colors duration-200 uppercase tracking-wider group w-fit"
    >
      {label}
      <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[#B5E254] group-hover:w-full transition-all duration-200 ease-out" />
    </button>
  );
}

// ─── Ícone de rede social (com ou sem link) ───────────────────────────────────
function SocialIcon({
  icon,
  href,
  label,
}: {
  icon: React.ReactNode;
  href?: string | null;
  label: string;
}) {
  const base =
    'w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200';

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={`${base} border-white/10 text-white/40 hover:border-[#B5E254]/50 hover:text-[#B5E254] hover:bg-[#B5E254]/5`}
      >
        {icon}
      </a>
    );
  }

  return (
    <span
      aria-label={`${label} (em breve)`}
      title={`${label} — em breve`}
      className={`${base} border-white/5 text-white/15 cursor-default select-none`}
    >
      {icon}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function Footer({ onNavigate, showCookies, isAuthenticated }: FooterProps) {
  const [config, setConfig] = useState<Partial<SystemConfig>>({});

  useEffect(() => {
    getSystemConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);

  const siteName = config.trade_name || config.site_name || 'Espaço Mix';
  const instagram = config.social_instagram?.replace('@', '');
  const instagramLink = instagram ? `https://instagram.com/${instagram}` : null;

  // Navega normalmente para rotas públicas; redireciona ao login para rotas protegidas
  const navigateProtected = (view: CurrentView) => {
    if (!isAuthenticated) {
      onNavigate('admin-login');
      return;
    }
    onNavigate(view);
  };

  return (
    <footer className="bg-[#111111] border-t border-white/[0.06] relative z-40">

      {/* ── Corpo principal ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Coluna 1 — Marca */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-base font-bold uppercase tracking-[0.2em] text-white">
                {siteName}
              </p>
            </div>

            {/* Selos de pagamento */}
            <div className="flex flex-col gap-2.5">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                Pagamentos aceitos
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {/* PIX */}
                <span className="flex items-center gap-1.5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-[#32bcad] bg-[#32bcad]/5">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden>
                    <path d="M5.73 12.48L3.08 9.83a.75.75 0 010-1.06l2.65-2.65a.75.75 0 011.06 0L9.44 8.77a.75.75 0 010 1.06L6.79 12.48a.75.75 0 01-1.06 0zM18.27 12.48l-2.65-2.65a.75.75 0 010-1.06l2.65-2.65a.75.75 0 011.06 0l2.65 2.65a.75.75 0 010 1.06l-2.65 2.65a.75.75 0 01-1.06 0zM12 6.21L9.35 3.56a.75.75 0 010-1.06l2.65-2.65a.75.75 0 011.06 0l2.65 2.65a.75.75 0 010 1.06L12.53 6.21a.75.75 0 01-1.06 0H12zM12 21.15l-2.65-2.65a.75.75 0 010-1.06l2.65-2.65a.75.75 0 011.06 0l2.65 2.65a.75.75 0 010 1.06L12.53 21.15a.75.75 0 01-1.06 0H12z" />
                  </svg>
                  PIX
                </span>
                {/* Visa */}
                <span className="flex items-center border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white/50 tracking-wider">
                  VISA
                </span>
                {/* Mastercard */}
                <span className="flex items-center gap-1 border border-white/10 rounded-lg px-2.5 py-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/70 -mr-1.5" />
                  <span className="w-3 h-3 rounded-full bg-orange-400/70" />
                  <span className="text-[9px] font-bold text-white/40 ml-1.5">MC</span>
                </span>
              </div>
              {/* Selo SSL */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <svg viewBox="0 0 20 20" className="w-3 h-3 text-[#B5E254]/60 fill-current" aria-hidden>
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-[9px] uppercase tracking-widest text-white/25">
                  Conexão SSL segura
                </span>
              </div>
            </div>
          </div>

          {/* Coluna 2 — Navegação */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#B5E254]">
              Navegação
            </h4>
            <div className="flex flex-col gap-3">
              <NavLink label="Início" onClick={() => onNavigate('home')} />
              <NavLink label="Eventos" onClick={() => navigateProtected('home')} />
              <NavLink label="Ingressos" onClick={() => navigateProtected('reservations')} />
              <NavLink label="Contato" onClick={() => onNavigate('contact')} />
            </div>

            <div className="w-full h-px bg-white/[0.06] my-1" />

            <h4 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#B5E254]">
              Legal
            </h4>
            <div className="flex flex-col gap-3">
              <NavLink label="Política de Privacidade" onClick={() => onNavigate('privacy')} />
              <NavLink label="Termos de Uso" onClick={() => onNavigate('terms')} />
              {showCookies && (
                <NavLink label="Preferências de Cookies" onClick={() => onNavigate('profile-privacy')} />
              )}
            </div>
          </div>

          {/* Coluna 3 — Contato */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#B5E254]">
              Contato
            </h4>

            <p className="text-[11px] text-white/40 leading-relaxed">
              Dúvidas sobre eventos, ingressos ou reservas? Nossa equipe está pronta para ajudar.
            </p>

            <button
              onClick={() => onNavigate('contact')}
              className="w-fit flex items-center gap-2 border border-[#B5E254]/40 text-[#B5E254]/80 text-[10px] font-bold uppercase tracking-widest rounded-full px-4 py-2 hover:bg-[#B5E254]/[0.08] hover:border-[#B5E254]/60 hover:text-[#B5E254] transition-all duration-200"
            >
              Fale Conosco
            </button>
          </div>

          {/* Coluna 4 — Redes Sociais */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#B5E254]">
              Redes Sociais
            </h4>

            <div className="flex flex-wrap gap-2">
              <SocialIcon
                icon={<IconInstagram className="w-4 h-4" />}
                href={instagramLink}
                label="Instagram"
              />
              <SocialIcon
                icon={<IconFacebook className="w-4 h-4" />}
                href={null}
                label="Facebook"
              />
              <SocialIcon
                icon={<IconYouTube className="w-4 h-4" />}
                href={null}
                label="YouTube"
              />
              <SocialIcon
                icon={<IconTikTok className="w-4 h-4" />}
                href={null}
                label="TikTok"
              />
            </div>

            {instagramLink && (
              <a
                href={instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-white/30 hover:text-[#B5E254] transition-colors duration-200 mt-0.5"
              >
                @{instagram}
              </a>
            )}

            <p className="text-[10px] text-white/20 leading-relaxed mt-1">
              Siga-nos e fique por dentro dos próximos eventos.
            </p>
          </div>

        </div>
      </div>

      {/* ── Barra legal inferior ───────────────────────────────────────── */}
      <div className="bg-[#0c0c0c] border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4">

            {/* Esquerda — dados legais */}
            <p className="text-[10px] text-white/30 leading-relaxed">
              © 2026{' '}
              {config.company_name || '[A PREENCHER]'}
              {' — CNPJ: '}
              {config.document || '[A PREENCHER]'}
            </p>

            {/* Direita — crédito */}
            <p className="text-[9px] text-white/20 uppercase tracking-widest whitespace-nowrap shrink-0">
              Desenvolvido por{' '}
              <a
                href="https://nexosolucoes.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#B5E254]/40 hover:text-[#B5E254]/70 transition-colors duration-200 font-bold"
              >
                Nexo Soluções Digitais
              </a>
            </p>

          </div>
        </div>
      </div>

    </footer>
  );
}
