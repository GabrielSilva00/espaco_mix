import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Globe, Instagram, CalendarDays, CheckCircle, Share2, Users } from 'lucide-react';

// Interfaces mockadas com base nas informações discutidas
interface EventPreview {
  id: string;
  name: string;
  date: string;
  location: string;
  imageUrl?: string;
  status: 'active' | 'past';
}

interface ProducerProfile {
  slug: string;
  name: string;
  bio: string;
  category: string;
  cidadeBase: string;
  logoUrl?: string;
  bannerUrl?: string;
  socials: {
    instagram?: string;
    site?: string;
  };
  isVerified: boolean;
  followersCount: number;
  eventsCount: number;
  events: EventPreview[];
}

export const PublicProducerPage = ({ profile }: { profile: ProducerProfile }) => {
  const [activeTab, setActiveTab] = useState<'ativos' | 'passados'>('ativos');

  const filteredEvents = profile.events.filter(e =>
    activeTab === 'ativos' ? e.status === 'active' : e.status === 'past'
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Navbar simplificada para vista pública */}
      <nav className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-6 h-6 bg-[#d4af37] rotate-45 flex items-center justify-center">
              <span className="text-black font-bold -rotate-45 text-xs">E</span>
            </div>
            <span className="font-serif text-[#d4af37] tracking-widest text-sm">ESPAÇO MIX</span>
          </div>
        </div>
      </nav>

      {/* Banner Area */}
      <div className="w-full h-48 md:h-80 relative mt-16 bg-[#111]">
        {profile.bannerUrl ? (
          <>
            <img src={profile.bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-[#d4af37]/20 to-[#0a0a0a] flex items-center justify-center">
             <Globe className="w-20 h-20 text-white/5" />
          </div>
        )}
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-8 pb-20 relative">
        {/* Info Header */}
        <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-8 -mt-16 md:-mt-20 relative z-10 mb-10">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#050505] bg-[#1a1a1a] flex items-center justify-center overflow-hidden shrink-0 shadow-2xl">
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-serif text-[#d4af37]">{profile.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          
          <div className="flex-1 pt-4 md:pb-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-5xl font-serif text-white mb-2 flex items-center gap-3">
                  {profile.name}
                  {profile.isVerified && <span title="Produtor Verificado"><CheckCircle className="w-6 h-6 text-blue-400" /></span>}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm uppercase tracking-widest font-bold">
                  <span className="text-[#d4af37]">{profile.category}</span>
                  {profile.cidadeBase && (
                    <span className="flex items-center gap-1 text-white/50"><MapPin className="w-4 h-4" /> {profile.cidadeBase}</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition" title="Compartilhar">
                  <Share2 className="w-5 h-5 text-white" />
                </button>
                <button className="bg-[#d4af37] hover:brightness-110 text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs transition shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                  Seguir Produtor
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Column - Events */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex border-b border-white/10">
              <button 
                onClick={() => setActiveTab('ativos')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest transition border-b-2 ${activeTab === 'ativos' ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/40 hover:text-white'}`}
              >
                Eventos Ativos
              </button>
              <button 
                onClick={() => setActiveTab('passados')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest transition border-b-2 ${activeTab === 'passados' ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/40 hover:text-white'}`}
              >
                Eventos Passados
              </button>
            </div>

            <div className="space-y-4">
              {filteredEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredEvents.map(event => (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={event.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group cursor-pointer hover:border-[#d4af37]/50 transition">
                      <div className="h-40 bg-[#d4af37]/10 relative overflow-hidden">
                        {event.imageUrl && <img src={event.imageUrl} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />}
                        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
                          {event.date}
                        </div>
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-bold mb-2 group-hover:text-[#d4af37] transition">{event.name}</h3>
                        <p className="text-xs text-white/50 flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-white/5 rounded-2xl border border-white/5 border-dashed">
                  <CalendarDays className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <p className="text-white/40 text-sm uppercase tracking-widest font-bold">Nenhum evento {activeTab === 'ativos' ? 'ativo' : 'passado'} no momento.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Bio & Stats */}
          <div className="space-y-8">
            {/* Bio Box */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37] opacity-5 blur-3xl rounded-full"></div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#d4af37] mb-4">Sobre a Caixa</h3>
              <p className="text-sm text-white/70 leading-relaxed max-w-none prose prose-invert">
                {profile.bio || 'Produtor cadastrado na Espaço Mix.'}
              </p>
              
              <div className="mt-6 pt-6 border-t border-white/5 flex gap-4">
                {profile.socials.instagram && (
                  <a href={`https://instagram.com/${profile.socials.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-full hover:bg-[#d4af37]/20 hover:text-[#d4af37] transition">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {profile.socials.site && (
                  <a href={profile.socials.site} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-full hover:bg-[#d4af37]/20 hover:text-[#d4af37] transition">
                    <Globe className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>

            {/* Stats Box */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 text-center">
                <Users className="w-6 h-6 text-[#d4af37] mx-auto mb-2 opacity-50" />
                <span className="block text-2xl font-serif text-white">{profile.followersCount}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/40">Seguidores</span>
              </div>
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 text-center">
                <CalendarDays className="w-6 h-6 text-[#d4af37] mx-auto mb-2 opacity-50" />
                <span className="block text-2xl font-serif text-white">{profile.eventsCount}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/40">Realizados</span>
              </div>
            </div>
            
            {profile.isVerified && (
               <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3 items-center">
                 <CheckCircle className="w-5 h-5 text-blue-400 shrink-0" />
                 <p className="text-xs text-blue-400 font-medium">
                   A identidade e documentação deste produtor foram verificadas pela Espaço Mix.
                 </p>
               </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
