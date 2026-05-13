import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Image as ImageIcon, Link as LinkIcon, Instagram, Facebook, Youtube, Music, MapPin, CheckCircle, AlertCircle, Eye, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock hook para disponibilidade de slug
const useSlugAvailability = (slug: string) => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!slug) {
      setIsAvailable(null);
      return;
    }
    const timer = setTimeout(() => {
      setChecking(true);
      // Simulação: "eventix" e "sunset" estão indisponíveis
      setTimeout(() => {
        setIsAvailable(slug !== 'eventix' && slug !== 'sunset');
        setChecking(false);
      }, 500);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [slug]);

  return { isAvailable, checking };
};

export const ProducerProfileForm = ({ onComplete }: { onComplete?: (data: any) => void }) => {
  const [form, setForm] = useState({
    nomeArtistico: '',
    slug: '',
    bio: '',
    categoria: '',
    cidadeBase: '',
    instagram: '',
    site: '',
    whatsapp: '',
    whatsappPublic: false,
    logoUrl: '', // URL local preview
    bannerUrl: '' // URL local preview
  });

  const { isAvailable: slugAvailable, checking: slugChecking } = useSlugAvailability(form.slug);
  const [showPreview, setShowPreview] = useState(window.innerWidth >= 1024);

  // Auto-generate slug from name if slug is empty or user is typing name (and slug hasn't been manually heavily edited)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(prev => {
      const isSlugEmptyOrAuto = prev.slug === '' || prev.slug === prev.nomeArtistico.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const newSlug = isSlugEmptyOrAuto ? val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : prev.slug;
      return { ...prev, nomeArtistico: val, slug: newSlug };
    });
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setForm(prev => ({ ...prev, slug: val }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 2MB.');
        return;
      }
      const url = URL.createObjectURL(file);
      setForm(prev => ({ ...prev, [type === 'logo' ? 'logoUrl' : 'bannerUrl']: url }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nomeArtistico || !form.slug || !form.categoria) {
      alert('Preencha os campos obrigatórios (Nome, URL e Categoria).');
      return;
    }
    if (slugAvailable === false) {
      alert('A URL escolhida não está disponível.');
      return;
    }
    if (onComplete) onComplete(form);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl mx-auto relative z-10">
      
      {/* Formulário */}
      <div className="flex-1 lg:max-w-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-serif text-[#d4af37] mb-2 flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#d4af37]" />
            Seu Perfil Público
          </h1>
          <p className="text-[11px] uppercase tracking-[0.1em] opacity-50">
            É assim que os compradores verão sua página. Construa sua marca.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
          
          {/* Sessão: Básico */}
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37] border-b border-white/10 pb-2">Informações Básicas</h2>
            
            <div>
              <label className="block text-[10px] uppercase tracking-[2px] opacity-70 mb-1 ml-1">Nome da Produtora *</label>
              <input 
                type="text" 
                value={form.nomeArtistico}
                onChange={handleNameChange}
                placeholder="Ex: Sunset Events"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[2px] opacity-70 mb-1 ml-1">URL Personalizada (Slug) *</label>
              <div className="flex items-center">
                <span className="bg-white/5 border border-white/10 border-r-0 rounded-l-xl px-3 h-[48px] flex items-center text-sm opacity-50 font-mono">
                  espacomix.com.br/p/
                </span>
                <input 
                  type="text" 
                  value={form.slug}
                  onChange={handleSlugChange}
                  placeholder="sua-produtora"
                  className={`flex-1 bg-white/5 border ${slugAvailable === false ? 'border-red-500' : 'border-white/10'} border-l-0 rounded-r-xl px-2 h-[48px] text-sm focus:border-[#d4af37] outline-none transition font-mono`}
                />
              </div>
              <div className="mt-1 ml-1 min-h-[16px] flex items-center">
                {slugChecking && <span className="text-[10px] opacity-50">Verificando disponibilidade...</span>}
                {!slugChecking && slugAvailable === true && <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> URL disponível</span>}
                {!slugChecking && slugAvailable === false && <span className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> URL já em uso</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] opacity-70 mb-1 ml-1">Categoria Principal *</label>
                <select 
                  value={form.categoria}
                  onChange={e => setForm({...form, categoria: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition appearance-none"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="">Selecione...</option>
                  <option value="Festas Eletrônicas">Festas Eletrônicas</option>
                  <option value="Shows e Concertos">Shows e Concertos</option>
                  <option value="Festivais">Festivais</option>
                  <option value="Teatro">Teatro</option>
                  <option value="Gastronomia">Gastronomia</option>
                  <option value="Eventos Corporativos">Eventos Corporativos</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] opacity-70 mb-1 ml-1">Cidade Base</label>
                <input 
                  type="text" 
                  value={form.cidadeBase}
                  onChange={e => setForm({...form, cidadeBase: e.target.value})}
                  placeholder="Ex: São Paulo, SP"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                />
              </div>
            </div>
          </section>

          {/* Sessão: Visual Identity */}
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37] border-b border-white/10 pb-2">Identidade Visual</h2>
            
            <div className="flex gap-4 items-center">
              <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-white/5 overflow-hidden group cursor-pointer hover:border-[#d4af37]">
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 opacity-30 group-hover:text-[#d4af37] transition" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold mb-1">Logo da Produtora</p>
                <p className="text-[10px] opacity-50 uppercase tracking-widest">Recomendado: 400x400px. Máx: 2MB.</p>
              </div>
            </div>

            <div className="relative w-full h-32 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center bg-white/5 overflow-hidden group cursor-pointer hover:border-[#d4af37]">
               <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
               {form.bannerUrl ? (
                 <img src={form.bannerUrl} alt="Banner preview" className="w-full h-full object-cover" />
               ) : (
                 <>
                   <ImageIcon className="w-8 h-8 opacity-30 group-hover:text-[#d4af37] transition mb-2" />
                   <p className="text-xs font-bold mb-1">Capa / Banner da Página</p>
                   <p className="text-[10px] opacity-50 uppercase tracking-widest">Padrão 3:1 (Ex: 1200x400px). Máx: 2MB.</p>
                 </>
               )}
            </div>
          </section>

          {/* Sessão: Sobre */}
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37] border-b border-white/10 pb-2">Sobre</h2>
            <div>
              <label className="block text-[10px] uppercase tracking-[2px] opacity-70 mb-1 ml-1">Biografia (Máx 500 caract.)</label>
              <textarea 
                value={form.bio}
                onChange={e => setForm({...form, bio: e.target.value.substring(0, 500)})}
                placeholder="Conte a história da produtora, estilo de eventos, missão..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-sm focus:border-[#d4af37] outline-none transition resize-none custom-scrollbar"
              />
              <div className="text-right text-[10px] opacity-40 mt-1">{form.bio.length} / 500</div>
            </div>
          </section>

          {/* Sessão: Links Sociais */}
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37] border-b border-white/10 pb-2">Links e Contato (Opcional)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input 
                  type="text" 
                  value={form.instagram}
                  onChange={e => setForm({...form, instagram: e.target.value})}
                  placeholder="@seuperfil"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                />
              </div>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input 
                  type="text" 
                  value={form.site}
                  onChange={e => setForm({...form, site: e.target.value})}
                  placeholder="https://seusite.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                />
              </div>
            </div>
          </section>

          <button 
            type="submit"
            className="w-full py-5 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_30px_rgba(212,175,55,0.2)] rounded-2xl hover:brightness-110 transition"
          >
            Salvar e Publicar Perfil
          </button>
        </form>
      </div>

      {/* Botão Mobile para Preview */}
      <button 
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#d4af37] text-black px-6 py-3 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 z-50 uppercase tracking-widest"
        onClick={() => setShowPreview(!showPreview)}
      >
        <Eye className="w-4 h-4" /> {showPreview ? 'Ocultar Preview' : 'Ver Preview'}
      </button>

      {/* Preview em Tempo Real */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className={`flex-1 ${!showPreview ? 'hidden lg:block' : 'block fixed inset-0 z-40 bg-[#050505] lg:relative lg:bg-transparent overflow-y-auto lg:overflow-visible'}`}
          >
            <div className="sticky top-24 pt-16 lg:pt-0 px-4 lg:px-0">
               <h3 className="hidden lg:block text-[10px] uppercase tracking-widest font-bold text-white/40 mb-4 text-center">Preview em Tempo Real</h3>
               
               {/* Simulação do Card do Perfil Público */}
               <div className="w-full max-w-sm mx-auto bg-[#111] rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
                 {/* Banner */}
                 <div className="w-full h-32 bg-white/5 relative">
                   {form.bannerUrl ? (
                     <img src={form.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full bg-gradient-to-tr from-[#d4af37]/20 to-black/50"></div>
                   )}
                 </div>

                 {/* Avatar */}
                 <div className="absolute top-20 left-6 w-20 h-20 rounded-full border-4 border-[#111] bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
                   {form.logoUrl ? (
                     <img src={form.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                   ) : (
                     <span className="text-xl font-serif text-[#d4af37]">{form.nomeArtistico ? form.nomeArtistico.charAt(0).toUpperCase() : 'E'}</span>
                   )}
                 </div>

                 <div className="p-6 pt-12 text-left">
                   <div className="flex items-start justify-between mb-4">
                     <div>
                       <h2 className="text-xl font-serif text-white flex items-center gap-2">
                         {form.nomeArtistico || 'Nome da Produtora'} 
                         <CheckCircle className="w-4 h-4 text-blue-400" />
                       </h2>
                       <p className="text-xs text-[#d4af37]">{form.categoria || 'Categoria'}</p>
                     </div>
                     <button className="bg-white/10 text-white text-[10px] px-4 py-2 rounded-full uppercase tracking-widest font-bold">Seguir</button>
                   </div>

                   <div className="flex gap-4 mb-4 text-white/50 text-xs">
                     <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {form.cidadeBase || 'Cidade'}</span>
                     <span><strong>0</strong> seguidores</span>
                   </div>

                   <p className="text-xs text-white/70 line-clamp-3 mb-6 relative">
                     {form.bio || 'Sua biografia aparecerá aqui na página principal do produtor. Escreva um pouco sobre a história e o estilo dos seus eventos...'}
                   </p>

                   {/* Eventos Mock */}
                   <div className="border-t border-white/10 pt-4">
                     <h4 className="text-[10px] uppercase font-bold text-white/40 mb-3">Próximos Eventos</h4>
                     <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                        {[1, 2].map(i => (
                          <div key={i} className="min-w-[120px] bg-white/5 rounded-xl border border-white/10 overflow-hidden hide-scrollbar">
                            <div className="h-16 bg-[#d4af37]/10"></div>
                            <div className="p-2 text-[9px] truncate">Nome do Evento {i}</div>
                          </div>
                        ))}
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
