import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Search, MapPin, Calendar, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  location: string;
  status: 'Ativo' | 'Em breve' | 'Vendas liberadas' | 'Rascunho' | 'Finalizado' | 'Pausado';
  img: string;
  assignedStaffIds: string[];
  priceType: 'unique' | 'gender';
  batches: any[];
  hasTables: boolean;
  tableConfig?: any;
  ageRating?: string;
  importantNotes?: string;
  isFeatured?: boolean;
}

interface HomeProps {
  events: Event[];
  onEventClick: (event: Event) => void;
}

export function Home({ events, onEventClick }: HomeProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [visibleCount, setVisibleCount] = useState(12);

  // Filter events
  const publicEvents = events.filter(e => e.status !== 'Rascunho');
  const featuredEvents = publicEvents.filter(e => e.isFeatured).length > 0
    ? publicEvents.filter(e => e.isFeatured)
    : publicEvents.slice(0, 5); // Fallback to first 5

  const filteredEvents = useMemo(() => {
    return publicEvents.filter(event => {
      if (searchTerm && !event.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      if (filterDate !== 'all') {
        const eventDate = new Date(event.date);
        const today = new Date();
        const thisWeekend = new Date();
        thisWeekend.setDate(today.getDate() + (6 - today.getDay())); // Saturday
        
        if (filterDate === 'weekend' && eventDate > thisWeekend) return false;
        if (filterDate === 'month' && eventDate.getMonth() !== today.getMonth()) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [publicEvents, searchTerm, filterDate]);

  const displayedEvents = filteredEvents.slice(0, visibleCount);

  // Embla setup
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000, stopOnInteraction: false })]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi, setSelectedIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  return (
    <div className="w-full min-h-screen bg-[#111111] text-white overflow-hidden pb-24">
      {/* Sec 2: Destaques (Carrossel) */}
      {featuredEvents.length > 0 && (
        <section className="relative w-full h-[420px] md:h-[500px] bg-[#0a0a0a]">
          <div className="overflow-hidden w-full h-full" ref={emblaRef}>
            <div className="flex w-full h-full">
              {featuredEvents.map((event) => (
                <div key={event.id} className="relative flex-[0_0_100%] h-full group" onClick={() => onEventClick(event)}>
                  <img
                    src={event.img || "https://picsum.photos/seed/event/1920/1080"}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-[10s] ease-out group-hover:scale-105 will-change-transform"
                    loading="eager"
                  />
                  {/* Overlay gradiente */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/60 to-transparent" />
                  
                  <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 md:pl-20 max-w-7xl mx-auto flex flex-col justify-end h-full">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
                      <span className="inline-block px-3 py-1 bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#d4af37] text-[10px] uppercase font-bold tracking-[0.2em] rounded-full mb-4">
                        Destaque
                      </span>
                      <h2 className="text-4xl md:text-6xl font-serif text-[#d4af37] mb-3 leading-tight tracking-wide drop-shadow-xl" style={{ textShadow: '0 4px 24px rgba(0,0,0,0.9)' }}>
                        {event.title}
                      </h2>
                      <div className="flex flex-wrap gap-4 text-xs md:text-sm text-white/80 uppercase tracking-widest font-bold mb-6">
                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-[#d4af37]" /> {new Date(event.date).toLocaleDateString('pt-BR')}</span>
                        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#d4af37]" /> {event.location}</span>
                      </div>
                      <button className="px-8 py-3.5 bg-[#d4af37] text-black text-xs uppercase font-bold tracking-widest rounded-xl hover:bg-white transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                        Ver Ingressos
                      </button>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Controles do Carrossel */}
          <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 flex items-center gap-4 z-10">
            <div className="flex gap-2">
              {featuredEvents.map((_, i) => (
                <button
                  key={i}
                  className={`w-12 h-1 rounded-full transition-all duration-300 ${i === selectedIndex ? 'bg-[#d4af37]' : 'bg-white/20'}`}
                  onClick={() => emblaApi?.scrollTo(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
            <div className="hidden md:flex gap-2 ml-4">
              <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-[#d4af37] hover:text-black border border-white/10 text-white backdrop-blur-md transition-all" onClick={() => emblaApi?.scrollPrev()}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-[#d4af37] hover:text-black border border-white/10 text-white backdrop-blur-md transition-all" onClick={() => emblaApi?.scrollNext()}>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Sec 3: Filtros e Listagem */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 md:mt-20">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10">
          <div>
            <h3 className="text-2xl md:text-4xl font-serif text-[#d4af37] mb-2">Próximos Eventos</h3>
            <p className="text-xs text-white/50 uppercase tracking-widest font-bold">Encontre sua próxima experiência</p>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar evento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-3 bg-[#1a1a1a] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/30"
              />
            </div>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="select-field text-xs uppercase tracking-widest font-bold"
            >
              <option value="all">Qualquer Data</option>
              <option value="weekend">Este Fim de Semana</option>
              <option value="month">Este Mês</option>
            </select>
            {(searchTerm || filterDate !== 'all') && (
              <button 
                onClick={() => { setSearchTerm(''); setFilterDate('all'); }}
                className="px-4 py-3 text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Grade de Eventos */}
        {displayedEvents.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayedEvents.map(event => {
                // Verificar se está esgotado baseado nos lotes
                const allBatchesTokens = event.batches?.flatMap(b => b.sectors) || [];
                const isSoldOut = allBatchesTokens.length > 0 && allBatchesTokens.every(s => (s.sold || 0) >= s.quantity);
                const cheapestSector = allBatchesTokens.length > 0 ? allBatchesTokens.reduce((prev, curr) => prev.price < curr.price ? prev : curr) : null;
                const minPrice = cheapestSector?.price || 0;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    className="group bg-[#1e1e1e] border border-white/5 rounded-2xl overflow-hidden cursor-pointer flex flex-col hover:border-[#d4af37]/30 transition-colors"
                    onClick={() => onEventClick(event)}
                  >
                    {/* Imagem (proporção 3:4) */}
                    <div className="relative w-full aspect-[4/5] overflow-hidden bg-black">
                      <img
                        src={event.img || "https://picsum.photos/seed/card/800/1000"}
                        alt={event.title}
                        className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isSoldOut ? 'grayscale opacity-70' : 'opacity-90'}`}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-transparent to-transparent opacity-80" />
                      
                      {/* Badge ESGOTADO */}
                      {isSoldOut && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                           <span className="px-4 py-2 bg-red-600 text-white font-bold text-xs uppercase tracking-[0.2em] transform -rotate-12 border border-red-400/50 shadow-2xl">Esgotado</span>
                        </div>
                      )}

                      {/* Info Overlay Top */}
                      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                        <div className="bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-center">
                          <span className="block text-[#d4af37] text-[10px] font-bold uppercase tracking-widest">{new Date(event.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                          <span className="block text-white text-lg font-bold leading-none mt-1">{new Date(event.date).getDate()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-lg font-serif text-[#d4af37] mb-2 line-clamp-2">{event.title}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-white/50 mb-4 max-w-full">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-end justify-between mt-4 pb-2 border-b border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-widest text-white/40 mb-1">A partir de</span>
                          <span className="text-sm font-bold text-white">
                            {minPrice === 0 ? <span className="text-green-400">Gratuito</span> : `R$ ${minPrice.toFixed(2).replace('.', ',')}`}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#111] group-hover:bg-[#d4af37] group-hover:text-black text-white/40 border border-white/10 flex items-center justify-center transition-colors">
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Carregar Mais */}
            {visibleCount < filteredEvents.length && (
              <div className="mt-16 flex justify-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 12)}
                  className="px-8 py-3 bg-transparent border border-white/20 text-white text-xs uppercase font-bold tracking-widest rounded-xl hover:bg-white/5 transition-all"
                >
                  Carregar mais eventos
                </button>
              </div>
            )}
          </>
        ) : (
          /* Estado Vazio */
          <div className="w-full py-20 flex flex-col items-center justify-center text-center bg-[#1e1e1e] border border-white/5 rounded-3xl">
            <Search className="w-12 h-12 text-white/10 mb-6" />
            <h4 className="text-xl font-serif text-[#d4af37] mb-2">Nenhum evento encontrado</h4>
            <p className="text-sm text-white/40 max-w-sm mb-6">Não achamos nenhum evento que corresponda aos filtros selecionados. Que tal tentar outra busca?</p>
            <button 
              onClick={() => { setSearchTerm(''); setFilterDate('all'); }}
              className="px-6 py-2 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 text-xs uppercase font-bold tracking-widest rounded-xl hover:bg-[#d4af37]/20 transition-all"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
