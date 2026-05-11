const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const startIndex = content.indexOf(") : dashboardMode === 'check-in' ? (");
const endIndex = content.indexOf(") : dashboardMode === 'edit' && formEvent ? (");
if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `) : dashboardMode === 'check-in' ? (
              <div className="max-w-4xl mx-auto space-y-4 px-2 sm:px-0 pb-32">
                {/* Header KPI Check-in */}
                <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 sm:p-6 mb-4 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-4 z-40 shadow-2xl">
                   <div className="flex items-center gap-4 w-full sm:w-auto">
                     <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 flex items-center justify-center border border-[#d4af37]/20">
                       <ShieldCheck className="w-6 h-6 text-[#d4af37]" />
                     </div>
                     <div>
                       <h2 className="text-sm uppercase tracking-widest font-black text-[#d4af37]">Check-in Operacional</h2>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase font-bold opacity-60">Operador: Gabriel</span>
                       </div>
                     </div>
                   </div>
                   <div className="flex items-center gap-6 w-full sm:w-auto bg-white/5 p-3 rounded-xl">
                      <div className="text-center">
                         <p className="text-[9px] uppercase tracking-widest opacity-50 mb-1">Entraram</p>
                         <p className="text-2xl font-black text-green-400 leading-none">{buyers.filter(b => b.checkedIn).length}</p>
                      </div>
                      <div className="w-px h-8 bg-white/10"></div>
                      <div className="text-center">
                         <p className="text-[9px] uppercase tracking-widest opacity-50 mb-1">Restam</p>
                         <p className="text-2xl font-black text-white leading-none">{buyers.filter(b => !b.checkedIn && b.status === "Pago").length}</p>
                      </div>
                   </div>
                </div>

                {/* Main Tabs */}
                <div className="flex bg-[#0d0d0d] border border-white/10 p-1 rounded-xl w-full mb-6 relative z-30">
                  <button 
                    onClick={() => setCheckinTab('scanner')} 
                    className={\`flex-1 py-3 text-xs uppercase font-black tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all \${checkinTab === 'scanner' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/50 hover:bg-white/5'}\`}
                  >
                    <QrCode className="w-4 h-4" /> SCANNER
                  </button>
                  <button 
                    onClick={() => setCheckinTab('list')} 
                    className={\`flex-1 py-3 text-xs uppercase font-black tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all \${checkinTab === 'list' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/50 hover:bg-white/5'}\`}
                  >
                    <Users className="w-4 h-4" /> LISTA MANUAL
                  </button>
                </div>

                {checkinTab === 'scanner' && (
                  <div className="space-y-4">
                    {/* Scanner Area */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden relative shadow-xl">
                       <div className="relative aspect-[4/5] sm:aspect-video w-full bg-black flex items-center justify-center">
                          <Scanner 
                            onScan={(detectedCodes) => { if(detectedCodes?.[0]?.rawValue) handleCheckIn(detectedCodes[0].rawValue); }} 
                            formats={['qr_code']}
                            components={{ audio: false }}
                            allowMultiple={false}
                          />
                          
                          {/* Full Screen Overlay for Results */}
                          <AnimatePresence>
                            {checkInResult && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                className={\`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center \${
                                  checkInResult.type === 'success' ? 'bg-green-500/95 backdrop-blur-xl' :
                                  checkInResult.type === 'warning' ? 'bg-amber-500/95 backdrop-blur-xl' :
                                  'bg-red-500/95 backdrop-blur-xl'
                                }\`}
                              >
                                {checkInResult.type === 'success' ? <ShieldCheck className="w-24 h-24 text-white mb-6 drop-shadow-xl" /> : 
                                 checkInResult.type === 'warning' ? <Activity className="w-24 h-24 text-white mb-6 drop-shadow-xl" /> : 
                                 <X className="w-24 h-24 text-white mb-6 drop-shadow-xl" />}
                                <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-wider drop-shadow-xl mb-4 leading-tight">{checkInResult.message}</h1>
                                
                                {checkInResult.data && (
                                  <div className="bg-black/20 p-6 rounded-2xl w-full max-w-sm mt-4 backdrop-blur-sm border border-white/10 shadow-inner">
                                    <p className="text-lg font-bold text-white mb-1 uppercase drop-shadow-md">{checkInResult.data.name}</p>
                                    <div className="flex items-center justify-center gap-3">
                                      <span className="text-sm font-black bg-white text-black px-3 py-1 rounded uppercase tracking-widest">{checkInResult.data.type}</span>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                       </div>
                    </div>

                    <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6">
                       <h3 className="text-xs font-serif text-[#d4af37] mb-4 uppercase tracking-widest leading-none">Busca Rápida</h3>
                       <div className="flex flex-col sm:flex-row gap-3">
                         <input 
                           type="text" 
                           placeholder="Digite o CPF (000.000.000-00) ou ID..."
                           value={checkInInput}
                           onChange={(e) => setCheckInInput(e.target.value)}
                           onKeyPress={(e) => e.key === 'Enter' && handleCheckIn(checkInInput)}
                           className="w-full sm:flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-[#d4af37] outline-none transition-colors text-white"
                         />
                         <button 
                           onClick={() => handleCheckIn(checkInInput)}
                           className="w-full sm:w-auto px-10 py-4 bg-[#d4af37] text-black font-black text-[10px] uppercase tracking-[0.1em] rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#d4af371a] flex items-center justify-center"
                         >
                           <Search className="w-4 h-4 mr-2" /> Validar
                         </button>
                       </div>
                    </div>
                  </div>
                )}

                {checkinTab === 'list' && (
                  <div className="space-y-4">
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div className="w-full sm:max-w-xs relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-white" />
                          <input 
                             type="text" 
                             placeholder="Buscar por nome ou CPF..." 
                             value={checkInSearch}
                             onChange={(e) => setCheckInSearch(e.target.value)}
                             className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs focus:border-[#d4af37] outline-none text-white"
                          />
                        </div>
                        <div className="flex bg-white/5 rounded-xl p-1 w-full sm:w-auto overflow-x-auto custom-scrollbar">
                           <button onClick={() => setCheckInFilter('all')} className={\`px-4 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg whitespace-nowrap \${checkInFilter === 'all' ? 'bg-white/10 text-white' : 'text-white/40'}\`}>Todos</button>
                           <button onClick={() => setCheckInFilter('pendentes')} className={\`px-4 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg whitespace-nowrap \${checkInFilter === 'pendentes' ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'text-white/40'}\`}>Pendentes</button>
                           <button onClick={() => setCheckInFilter('check-ins')} className={\`px-4 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg whitespace-nowrap \${checkInFilter === 'check-ins' ? 'bg-green-500/20 text-green-400' : 'text-white/40'}\`}>Check-in</button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 custom-scrollbar">
                         {buyers
                            .filter(b => checkInFilter === 'all' || (checkInFilter === 'pendentes' ? !b.checkedIn : b.checkedIn))
                            .filter(b => b.name.toLowerCase().includes(checkInSearch.toLowerCase()) || b.cpf.replace(/\\D/g, '').includes(checkInSearch.replace(/\\D/g, '')))
                            .map(b => (
                            <div key={b.id} className={\`flex items-center justify-between p-3 sm:p-4 border rounded-2xl transition-all \${b.checkedIn ? 'bg-green-500/5 border-green-500/10' : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5'}\`}>
                              <div className="flex items-center gap-3">
                                <div className={\`w-10 h-10 flex items-center justify-center rounded-xl \${b.checkedIn ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/50'}\`}>
                                   {b.checkedIn ? <Check className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col">
                                  <p className={\`text-sm font-bold leading-tight \${b.checkedIn ? 'text-green-100' : 'text-white'}\`}>{b.name}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-white/40 uppercase tracking-widest font-bold">{b.type}</span>
                                    <span className="text-[8px] opacity-40">{b.cpf}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center">
                                {!b.checkedIn ? (
                                  <button onClick={() => handleCheckIn(b.id)} className="px-4 py-2.5 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#ffe380] active:scale-95 transition-all">
                                    ENTRAR
                                  </button>
                                ) : (
                                  <button onClick={() => handleUndoCheckIn(b.id)} className="px-3 py-2 text-[9px] uppercase tracking-widest font-bold text-white/40 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all">
                                    Desfazer
                                  </button>
                                )}
                              </div>
                            </div>
                         ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Feed / History */}
                <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6">
                  <h3 className="text-xs flex items-center font-serif text-white mb-6 uppercase tracking-widest opacity-40"><Activity className="w-4 h-4 mr-2" /> Feed Ao Vivo</h3>
                  <div className="space-y-3">
                     {checkInHistory.length > 0 ? checkInHistory.map((h) => (
                       <div key={h.id + h.time.getTime()} className="flex items-center justify-between p-3 border border-white/5 bg-white/[0.02] rounded-xl flex-wrap gap-4">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                             <Check className="w-4 h-4 text-green-500" />
                           </div>
                           <div>
                             <p className="text-xs font-bold text-white">{h.name}</p>
                             <p className="text-[9px] opacity-40 uppercase tracking-widest">{h.type} • Agora</p>
                           </div>
                         </div>
                         <button onClick={() => handleUndoCheckIn(h.id)} className="text-[9px] uppercase tracking-widest font-bold text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-lg transition-all flex items-center">
                            <RefreshCcw className="w-3 h-3 mr-1" /> Desfazer
                         </button>
                       </div>
                     )) : (
                       <p className="text-xs opacity-30 italic text-center py-4">Aguardando scan...</p>
                     )}
                  </div>
                </div>
              </div>
`;
  
  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync('src/App.tsx', newContent, 'utf-8');
  console.log("Replaced checkin section successfully!");
} else {
  console.error("Tags not found", { startIndex, endIndex });
}
