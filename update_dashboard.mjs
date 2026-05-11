import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');

const startStr = "{dashboardMode === 'details' ? (";
const endStr = ") : dashboardMode === 'check-in' ? (";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find boundaries.");
  process.exit(1);
}

const before = content.slice(0, startIndex + startStr.length);
const after = content.slice(endIndex);

const newDashboardContent = `
              <div className="px-4 xl:px-0 space-y-8 animate-in fade-in duration-500 pb-20">
                {/* Cabeçalho do Detalhe */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       <span className="bg-[#d4af37]/20 text-[#d4af37] px-3 py-1 rounded-full text-[9px] uppercase font-bold tracking-widest border border-[#d4af37]/30 flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 bg-[#d4af37] rounded-full animate-pulse"></div> Live
                       </span>
                       <span className="text-white/40 text-xs font-mono">ID: #DK92-80</span>
                    </div>
                    <h2 className="text-2xl font-serif text-white flex items-center gap-2">
                      Midnight Soirée
                    </h2>
                  </div>
                  <div className="flex text-right flex-col items-end">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#d4af37] mb-1">Status do Evento</p>
                    <h3 className="text-xl font-bold font-mono text-white">Faltam 5 Dias</h3>
                  </div>
                </div>

                {/* Smart Alerts */}
                <div className="bg-[#d4af37]/5 border-l-2 border-[#d4af37] rounded-r-2xl p-4 flex items-start sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-[#d4af37]" />
                      <p className="text-xs text-[#d4af37]/80">
                        <strong className="text-[#d4af37]">Alerta Inteligente:</strong> 80% das Mesas VIP vendidas. A demanda está alta. Considere um lote extra.
                      </p>
                   </div>
                   <button className="text-[10px] uppercase tracking-widest font-bold bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] px-3 py-1.5 rounded transition whitespace-nowrap">
                     Ajustar Lotes
                   </button>
                </div>

                {/* KPIs Modernos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* KPI 1 */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                         <DollarSign className="w-4 h-4" />
                       </div>
                       <span className="text-[9px] uppercase tracking-widest font-bold text-green-400">+12% vs última ed.</span>
                     </div>
                     <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Receita Gerada</p>
                     <h3 className="text-3xl font-serif text-white">R$ 15.450</h3>
                     <div className="mt-3 flex gap-4 border-t border-white/5 pt-3">
                       <div>
                         <p className="text-[9px] uppercase opacity-30">Pista</p>
                         <p className="text-xs text-white/80 font-mono">R$ 5.450</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase opacity-30">Mesas</p>
                         <p className="text-xs text-[#d4af37] font-mono">R$ 10.000</p>
                       </div>
                     </div>
                  </div>

                  {/* KPI 2 */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                         <Users className="w-4 h-4" />
                       </div>
                       <span className="text-[9px] uppercase tracking-widest font-bold text-blue-400">Alta Proc.</span>
                     </div>
                     <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Lotação Atual</p>
                     <div className="flex items-baseline gap-2">
                       <h3 className="text-3xl font-serif text-white">148</h3>
                       <span className="text-sm opacity-40">/ 500 cap.</span>
                     </div>
                     <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-4">
                        <div className="h-full bg-blue-500 w-[30%]"></div>
                     </div>
                  </div>

                  {/* KPI 3 */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                         <MapPin className="w-4 h-4" />
                       </div>
                       <span className="text-[9px] uppercase tracking-widest font-bold opacity-40">Portaria Live</span>
                     </div>
                     <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Check-ins Feitos</p>
                     <div className="flex items-baseline gap-2">
                       <h3 className="text-3xl font-serif text-white">0</h3>
                       <span className="text-sm opacity-40">/ 148 previstos</span>
                     </div>
                     <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-4">
                        <div className="h-full bg-[#d4af37] w-[0%]"></div>
                     </div>
                  </div>

                  {/* KPI 4 */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                         <Activity className="w-4 h-4" />
                       </div>
                     </div>
                     <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Conversão Carrinho</p>
                     <h3 className="text-3xl font-serif text-white">24.5%</h3>
                     <p className="text-[9px] uppercase opacity-30 mt-3 pt-3 border-t border-white/5">25 checkouts abandonados</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Esquerda: Gráfico + Tabela */}
                  <div className="lg:col-span-2 space-y-8">
                    
                    {/* Gráfico de Vendas */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 h-[340px] flex flex-col">
                       <div className="flex justify-between items-center mb-6">
                         <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] flex items-center gap-2">
                           <TrendingUp className="w-4 h-4" /> Evolução de Vendas
                         </h3>
                         <select className="bg-white/5 border border-white/10 rounded-lg text-xs px-3 py-1.5 focus:outline-none">
                           <option>Últimos 7 dias</option>
                           <option>Últimos 30 dias</option>
                         </select>
                       </div>
                       <div className="flex-1 w-full relative">
                         {(() => {
                            const chartData = [
                              { name: 'Seg', ingressos: 15, mesas: 2 },
                              { name: 'Ter', ingressos: 30, mesas: 3 },
                              { name: 'Qua', ingressos: 25, mesas: 1 },
                              { name: 'Qui', ingressos: 40, mesas: 5 },
                              { name: 'Sex', ingressos: 60, mesas: 8 },
                              { name: 'Sab', ingressos: 95, mesas: 12 },
                              { name: 'Dom', ingressos: 120, mesas: 18 }
                            ];
                            return (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="colorIngressos" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorMesas" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#fff" stopOpacity={0.1}/>
                                      <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                  <XAxis dataKey="name" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                                  <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                  />
                                  <Area type="monotone" dataKey="ingressos" stroke="#d4af37" strokeWidth={2} fillOpacity={1} fill="url(#colorIngressos)" />
                                  <Area type="monotone" dataKey="mesas" stroke="#ffffff40" strokeWidth={2} fillOpacity={1} fill="url(#colorMesas)" />
                                </AreaChart>
                              </ResponsiveContainer>
                            );
                         })()}
                       </div>
                    </div>

                    {/* Console de Acessos Recentes */}
                     <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-base font-serif text-white flex items-center gap-2">
                          Console de Entradas & Vendas
                        </h2>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="relative flex-1 sm:flex-initial">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                            <input 
                              type="text" 
                              placeholder="Buscar ingresso/nome..." 
                              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs w-full sm:w-64 focus:border-[#d4af37] outline-none"
                            />
                          </div>
                          <button className="p-2.5 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                            <Filter className="w-4 h-4 opacity-50" />
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Data Compra</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Comprador</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Tipo</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Status Acesso</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {buyers.slice(0, 4).map((buyer, idx) => (
                              <tr key={buyer.id} className="hover:bg-white/[0.03] transition relative group">
                                <td className="px-6 py-4">
                                   <div className="text-[11px] font-mono text-white/50">
                                     {new Date(Date.now() - idx * 3600000).toLocaleDateString('pt-BR')}
                                   </div>
                                </td>
                                <td className="px-6 py-4 flex flex-col justify-center">
                                  <span className="text-[13px] font-medium text-white line-clamp-1">{buyer.name}</span>
                                  <span className="text-[10px] opacity-40 lowercase line-clamp-1">{buyer.email}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-block px-2 py-0.5 bg-white/5 rounded border border-white/10 text-[9px] uppercase tracking-widest font-bold">
                                    {buyer.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {buyer.checkedIn ? (
                                    <span className="text-[9px] uppercase tracking-widest font-bold text-green-500 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Presente
                                    </span>
                                  ) : idx === 3 ? (
                                    <span className="text-[9px] uppercase tracking-widest font-bold text-yellow-500 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div> Cancelado
                                    </span>
                                  ) : (
                                    <span className="text-[9px] uppercase tracking-widest font-bold opacity-30 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div> Aguardando
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <button className="text-[10px] text-[#d4af37] hover:underline uppercase tracking-widest font-bold">Visualizar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-4 border-t border-white/5 text-center bg-white/[0.01]">
                        <button className="text-[10px] uppercase font-bold tracking-widest opacity-50 hover:opacity-100 transition">Carregar mais operações</button>
                      </div>
                    </div>
                  </div>

                  {/* Direita: Sidebar Actions */}
                  <div className="space-y-6">
                    {/* Botões Operacionais Primários */}
                    <div className="grid grid-cols-2 gap-4">
                       <button className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">
                         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                           <Download className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-[#d4af37] transition" />
                         </div>
                         <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">Lista PDF</span>
                       </button>
                       <button className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">
                         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                           <Mail className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition" />
                         </div>
                         <span className="text-[9px] uppercase tracking-widest font-bold opacity-70 text-center">Aviso a todos</span>
                       </button>
                       <button className="col-span-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-4 hover:bg-red-500/20 transition flex items-center justify-center gap-3 group">
                         <StopCircle className="w-4 h-4" />
                         <span className="text-[10px] uppercase tracking-widest font-bold">Pausar Vendas de Emergência</span>
                       </button>
                    </div>

                    {/* Distribuição Melhorada */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6">
                      <h3 className="text-[11px] uppercase tracking-widest font-bold opacity-50 mb-6 flex items-center gap-2">
                        Ticket Mix (%)
                      </h3>
                      <div className="space-y-5">
                        {[
                          { l: 'Mesas VIP', v: '65', c: 'bg-[#d4af37]' },
                          { l: 'Pista Lote 1', v: '20', c: 'bg-white/40' },
                          { l: 'Pista Lote 2', v: '10', c: 'bg-white/20' },
                          { l: 'Cortesia/Staff', v: '5', c: 'bg-green-500/40' },
                        ].map((item, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline mb-2">
                              <span className="text-[10px] uppercase font-bold tracking-widest">{item.l}</span>
                              <span className="text-[10px] opacity-50">{item.v}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={\`h-full \${item.c}\`} style={{ width: \`\${item.v}%\` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Histórico Atividade Rápido */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6">
                      <h3 className="text-[11px] uppercase tracking-widest font-bold opacity-50 mb-6">Atividade Log</h3>
                      <div className="space-y-4">
                         <div className="flex gap-4 relative">
                            <div className="w-px h-full bg-white/10 absolute left-1 top-2 bottom-0"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-[#d4af37] relative z-10 shrink-0 mt-1"></div>
                            <div>
                               <p className="text-xs text-white">Lote de Ingressos Pista Esgotado</p>
                               <span className="text-[9px] uppercase tracking-widest opacity-40">Sistema • 2h atrás</span>
                            </div>
                         </div>
                         <div className="flex gap-4 relative">
                            <div className="w-px h-full bg-white/10 absolute left-1 top-2 bottom-0"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 relative z-10 shrink-0 mt-1"></div>
                            <div>
                               <p className="text-xs text-white">Disparo Mkt: "Últimas Mesas"</p>
                               <span className="text-[9px] uppercase tracking-widest opacity-40">Admin • 4h atrás</span>
                            </div>
                         </div>
                         <div className="flex gap-4 relative">
                            <div className="w-2.5 h-2.5 rounded-full bg-white/20 relative z-10 shrink-0 mt-1"></div>
                            <div>
                               <p className="text-xs text-white">Edição V2 do mapa publicada</p>
                               <span className="text-[9px] uppercase tracking-widest opacity-40">Gabriel S. • Ontem</span>
                            </div>
                         </div>
                      </div>
                      <button className="w-full mt-6 py-2 border border-white/10 rounded-xl text-[9px] uppercase tracking-widest font-bold hover:bg-white/5 transition">
                        Ver histórico completo
                      </button>
                    </div>

                  </div>
                </div>
              </div>
`;

fs.writeFileSync('src/App.tsx', before + newDashboardContent + after, 'utf8');

console.log("Successfully updated App.tsx");
