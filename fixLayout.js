const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The marker where grid starts
let markerStart = `{bookingType !== 'selection' && (
          <div className="max-w-7xl mx-auto px-4 lg:px-10 mt-6 md:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <button 
              onClick={() => {
                setBookingType('selection');
                setSelectedTables([]);
                setSingleTickets(0);
              }}
              className="inline-flex items-center gap-2 px-4 py-3 min-h-[44px] bg-white/5 border border-white/10 rounded-lg md:rounded-full text-[10px] uppercase font-bold tracking-[0.2em] text-white/80 hover:bg-white/10 hover:text-white transition mb-6 md:mb-8"
            >
              <ArrowLeft className="w-3 h-3" /> Voltar
            </button>

            <div className={\`grid grid-cols-1 gap-6 md:gap-8 \${bookingType === 'mesa' ? 'lg:grid-cols-12' : 'max-w-2xl mx-auto'}\`}>
              
              {bookingType === 'mesa' && (
                <div className="lg:col-span-8 space-y-6 flex flex-col p-1 border border-[#ffffff1a] bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] rounded-[1.5rem]">
                  <div className="pt-8 pb-8 pr-8 pl-[17px]">`;

let targetMapEnd = `{/* Avulso Selector */}
            {bookingType === 'ingresso' && (`;

let replaceContent = `
              {activeEvent?.hasTables && (
                <section className="mt-12 md:mt-16">
                  <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                    <Armchair className="w-5 h-5 text-[#d4af37]" />
                    <h2 className="text-sm md:text-base tracking-[0.2em] uppercase text-white font-bold">Reserva de Mesas</h2>
                  </div>
                  
                  <div className="space-y-6 flex flex-col p-1 border border-[#ffffff1a] bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] rounded-[1.5rem]">
                    <div className="pt-8 pb-8 pr-8 pl-[17px]">
`;

code = code.replace(markerStart, replaceContent);

// Remove the Avulso Selector because we merged it into top!
let startToRemove = `{/* Avulso Selector */}`;
let endOfRemoveIdx = code.indexOf(`{/* Resumo do Pedido */}`, code.indexOf(startToRemove));

code = code.substring(0, code.indexOf(startToRemove)) + code.substring(endOfRemoveIdx);

// Append event details
let summaryIndex = code.indexOf(`{/* Resumo do Pedido */}`);
let beforeSummary = code.substring(0, summaryIndex);
let targetSummaryEnd = `</button>
            </div>`;
let endSummaryIndex = code.indexOf(targetSummaryEnd, summaryIndex) + targetSummaryEnd.length;

let afterSummary = code.substring(endSummaryIndex);

// Close Left Column correctly!
let closeLeftCol = `
                </section>
              )}

              {/* Detalhes do Evento */}
              <section className="mt-12 md:mt-16 bg-[#0f0f0f] border border-white/5 rounded-[1.5rem] p-6 md:p-10">
                 <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                    <Info className="w-5 h-5 text-[#d4af37]" />
                    <h2 className="text-sm md:text-base tracking-[0.2em] uppercase text-white font-bold">Detalhes do Evento</h2>
                 </div>
                 
                 <div className="space-y-8">
                    {activeEvent?.description && (
                      <div>
                        <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-3">Sobre</h3>
                        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{activeEvent.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex gap-4">
                        <Calendar className="w-5 h-5 text-white/40" />
                        <div>
                          <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-1">Data e Hora</h3>
                          <p className="text-sm text-white/70">{new Date(activeEvent?.date || '').toLocaleDateString('pt-BR')} {activeEvent?.time ? \`às \${activeEvent.time}\` : ''}</p>
                        </div>
                      </div>
                      
                      {activeEvent?.location && (
                        <div className="flex gap-4">
                          <MapPin className="w-5 h-5 text-white/40" />
                          <div>
                            <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-1">Localização</h3>
                            <p className="text-sm text-white/70">{activeEvent.location}</p>
                          </div>
                        </div>
                      )}

                      {activeEvent?.ageRating && (
                        <div className="flex gap-4">
                          <Users className="w-5 h-5 text-white/40" />
                          <div>
                            <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-1">Classificação</h3>
                            <p className="text-sm text-white/70">{activeEvent.ageRating}</p>
                          </div>
                        </div>
                      )}
                      
                      {activeEvent?.posLocations && (
                        <div className="flex gap-4">
                          <Ticket className="w-5 h-5 text-white/40" />
                          <div>
                            <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-1">Pontos Físicos</h3>
                            <p className="text-sm text-white/70">{activeEvent.posLocations}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {activeEvent?.importantNotes && (
                      <div className="bg-[#d4af37]/5 border border-[#d4af37]/10 p-5 rounded-xl">
                        <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-3">Observações</h3>
                        <p className="text-sm text-[#d4af37]/80 leading-relaxed whitespace-pre-wrap">{activeEvent.importantNotes}</p>
                      </div>
                    )}
                    
                    {activeEvent?.entryRules && (
                      <div className="bg-red-500/5 border border-red-500/10 p-5 rounded-xl">
                        <h3 className="text-[10px] tracking-widest text-red-400 uppercase mb-3">Avisos e Regras</h3>
                        <p className="text-sm text-red-400/80 leading-relaxed whitespace-pre-wrap">{activeEvent.entryRules}</p>
                      </div>
                    )}

                 </div>
              </section>

            </div>
            
            {/* Right Column: Ingressos e Resumo */}
            <div className="lg:col-span-4 flex flex-col">
              <div className="sticky top-24 flex flex-col gap-8">
`;

// Also fix button at the end
let endSummaryContent = code.substring(summaryIndex, endSummaryIndex);

// Let's replace 'Confirmar Compra'/'Confirmar Reserva' with 'Ir para Pagamento'
endSummaryContent = endSummaryContent.replace("{bookingType === 'ingresso' ? 'Confirmar Compra' : 'Confirmar Reserva'}", "'Ir para Pagamento'");

code = beforeSummary + closeLeftCol + endSummaryContent + "\n</div>" + afterSummary;

// We also need to remove the closing tags of the old layout
let endOfFileIdx = code.indexOf("          </div>\n        </div>\n        )}", endSummaryIndex);
if (endOfFileIdx > -1) {
    code = code.substring(0, endOfFileIdx) + code.substring(endOfFileIdx + "          </div>\n        </div>\n        )}".length);
}

fs.writeFileSync('src/App.tsx', code, 'utf8');
