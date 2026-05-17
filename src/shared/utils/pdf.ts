import type { Buyer, Event } from '../../types';

export function downloadPDFList(buyers: Buyer[], event: Event | undefined): void {
  const win = window.open('', '_blank');
  if (!win) return;

  const rows = buyers
    .map(
      (b) => `
      <tr>
        <td>${b.purchaseDate ? new Date(b.purchaseDate).toLocaleDateString('pt-BR') : '—'}</td>
        <td><div class="name">${b.name}</div><div class="sub">${b.email}</div></td>
        <td>${b.phone || '—'}</td>
        <td class="badge">${b.type}</td>
        <td class="status" style="color:${b.status === 'Pago' ? '#4ade80' : b.status === 'Cancelado' ? '#f87171' : '#fbbf24'}">${b.status}</td>
        <td class="status" style="color:${b.checkedIn ? '#4ade80' : '#aaa'}">${b.checkedIn ? 'Presente' : 'Aguardando'}</td>
      </tr>`
    )
    .join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lista de Participantes</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Georgia,serif;background:#0a0a0a;color:#fff;padding:40px}
      header{border-bottom:1px solid #d4af3740;padding-bottom:20px;margin-bottom:24px}
      h1{color:#d4af37;font-size:24px;margin-bottom:4px}
      .meta{font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:#555;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{padding:10px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:#555;border-bottom:1px solid #222;font-family:sans-serif}
      td{padding:10px 14px;border-bottom:1px solid #1a1a1a;vertical-align:middle}
      .name{font-weight:600;color:#fff;font-size:13px}
      .sub{font-size:10px;color:#555;margin-top:2px}
      .badge{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#d4af37}
      .status{font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:600}
      @media print{body{background:#fff;color:#000}h1{color:#333}.meta,.sub{color:#999}td{border-color:#eee}.name{color:#000}.badge,.status{color:#333 !important}}
    </style>
  </head><body>
    <header>
      <h1>${event?.title || 'Lista de Participantes'}</h1>
      <p class="meta">Total: ${buyers.length} participante${buyers.length !== 1 ? 's' : ''} &nbsp;•&nbsp; Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    </header>
    <table>
      <thead><tr><th>Data Compra</th><th>Comprador</th><th>Celular</th><th>Lote / Tipo</th><th>Status Pgto</th><th>Check-in</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=function(){setTimeout(function(){window.print();window.close();},700);};</script>
  </body></html>`);
  win.document.close();
}

export function downloadTicketPDF(ticket: { id: string; name: string; ownerName?: string }): void {
  const win = window.open('', '_blank');
  if (!win) return;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticket.id)}`;

  win.document.write(`<!DOCTYPE html><html><head><title>Ingresso</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Georgia,serif;background:#0a0a0a;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:24px}
    .ticket{background:linear-gradient(135deg,#111,#1a1a1a);border:1px solid #d4af37;border-radius:16px;padding:40px;max-width:420px;width:100%;text-align:center}
    .brand{color:#d4af37;font-size:10px;letter-spacing:.35em;text-transform:uppercase;margin-bottom:20px}
    .event{color:#d4af37;font-size:22px;margin-bottom:4px}
    .type{color:rgba(255,255,255,.5);font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:24px}
    .qr-wrap{background:#fff;padding:12px;border-radius:12px;display:inline-block;margin-bottom:16px}
    .qr-wrap img{display:block;width:200px;height:200px}
    .tid{font-family:monospace;font-size:9px;color:rgba(255,255,255,.4);letter-spacing:.15em;margin-bottom:20px}
    hr{border:none;border-top:1px solid rgba(212,175,55,.3);margin:20px 0}
    .lbl{font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:4px}
    .owner{font-size:16px;color:#fff}
    @media print{body{background:#fff}.ticket{background:#fff;color:#000;border-color:#000}.event,.brand{color:#000}.tid,.lbl{color:#666}.owner{color:#000}hr{border-color:#ccc}}
  </style></head><body><div class="ticket">
    <p class="brand">Espaço Mix</p>
    <h1 class="event">Midnight Soirée</h1>
    <p class="type">${ticket.name}</p>
    <div class="qr-wrap"><img src="${qrUrl}" alt="QR"/></div>
    <p class="tid">${ticket.id}</p>
    ${ticket.ownerName ? `<hr><p class="lbl">Portador</p><p class="owner">${ticket.ownerName}</p>` : ''}
  </div><script>window.onload=function(){setTimeout(function(){window.print();window.close();},600);};</script></body></html>`);
  win.document.close();
}
