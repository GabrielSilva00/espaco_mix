import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');


// Buttons
content = content.replace(
  '<input \n                              type="text" \n                              placeholder="Buscar ingresso/nome..." \n                              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs w-full sm:w-64 focus:border-[#d4af37] outline-none"\n                            />',
  '<input type="text" placeholder="Buscar ingresso/nome..." onChange={(e) => { if(e.target.value.length > 2) showToast("Buscando por: " + e.target.value, "info"); }} className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs w-full sm:w-64 focus:border-[#d4af37] outline-none" />'
);

content = content.replace(
  '<button className="p-2.5 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">\n                            <Filter className="w-4 h-4 opacity-50" />\n                          </button>',
  '<button onClick={() => showToast("Abrindo os filtros da tabela...", "info")} className="p-2.5 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">\n                            <Filter className="w-4 h-4 opacity-50" />\n                          </button>'
);

content = content.replace(
  '<button className="text-[10px] text-[#d4af37] hover:underline uppercase tracking-widest font-bold">Visualizar</button>',
  '<button onClick={() => showToast("Abrindo Drawer de detalhes do ingresso...", "info")} className="text-[10px] text-[#d4af37] hover:underline uppercase tracking-widest font-bold">Visualizar</button>'
);

content = content.replace(
  '<button className="text-[10px] uppercase font-bold tracking-widest opacity-50 hover:opacity-100 transition">Carregar mais operações</button>',
  '<button onClick={() => { showToast("Carregando mais operações...", "info"); setTimeout(() => showToast("Registros carregados com sucesso.", "success"), 1500); }} className="text-[10px] uppercase font-bold tracking-widest opacity-50 hover:opacity-100 transition">Carregar mais operações</button>'
);

content = content.replace(
  '<button className="text-[10px] uppercase tracking-widest font-bold bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] px-3 py-1.5 rounded transition whitespace-nowrap">\n                     Ajustar Lotes\n                   </button>',
  '<button onClick={() => showToast("Módulo de transição de lote em desenvolvimento...", "success")} className="text-[10px] uppercase tracking-widest font-bold bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] px-3 py-1.5 rounded transition whitespace-nowrap">\n                     Ajustar Lotes\n                   </button>'
);

content = content.replace(
  '<button className="w-full mt-6 py-2 border border-white/10 rounded-xl text-[9px] uppercase tracking-widest font-bold hover:bg-white/5 transition">\n                        Ver histórico completo\n                      </button>',
  '<button onClick={() => showToast("Abrindo logs completos em nova tela...", "info")} className="w-full mt-6 py-2 border border-white/10 rounded-xl text-[9px] uppercase tracking-widest font-bold hover:bg-white/5 transition">\n                        Ver histórico completo\n                      </button>'
);

content = content.replace(
  '<button className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">\n                         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">\n                           <Download className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-[#d4af37] transition" />\n                         </div>\n                         <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">Lista PDF</span>\n                       </button>',
  '<button onClick={() => showToast("Gerando exportação em PDF da lista de confirmados...", "success")} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">\n                         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">\n                           <Download className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-[#d4af37] transition" />\n                         </div>\n                         <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">Lista PDF</span>\n                       </button>'
);

content = content.replace(
  '<button className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">\n                         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">\n                           <Mail className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition" />\n                         </div>\n                         <span className="text-[9px] uppercase tracking-widest font-bold opacity-70 text-center">Aviso a todos</span>\n                       </button>',
  '<button onClick={() => showToast("Carregando audiência para disparo em massa...", "info")} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">\n                         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">\n                           <Mail className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition" />\n                         </div>\n                         <span className="text-[9px] uppercase tracking-widest font-bold opacity-70 text-center">Aviso a todos</span>\n                       </button>'
);

content = content.replace(
  '<button className="col-span-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-4 hover:bg-red-500/20 transition flex items-center justify-center gap-3 group">\n                         <StopCircle className="w-4 h-4" />\n                         <span className="text-[10px] uppercase tracking-widest font-bold">Pausar Vendas de Emergência</span>\n                       </button>',
  '<button onClick={() => showToast("ALERTA CRÍTICO: VENDAS FORAM PAUSADAS IMEDIATAMENTE!", "error")} className="col-span-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-4 hover:bg-red-500/20 transition flex items-center justify-center gap-3 group">\n                         <StopCircle className="w-4 h-4" />\n                         <span className="text-[10px] uppercase tracking-widest font-bold">Pausar Vendas de Emergência</span>\n                       </button>'
);

// We need to replace all instances of Visualizar
content = content.split('<button className="text-[10px] text-[#d4af37] hover:underline uppercase tracking-widest font-bold">Visualizar</button>').join('<button onClick={() => showToast("Abrindo Drawer de detalhes...", "info")} className="text-[10px] text-[#d4af37] hover:underline uppercase tracking-widest font-bold">Visualizar</button>');

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('App.tsx buttons patched');
