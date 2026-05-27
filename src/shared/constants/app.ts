import type { Event, TableDef } from '../../types';

export const WHATSAPP_NUMBER = '5511999999999';
export const WHATSAPP_MESSAGE = encodeURIComponent('Olá! Gostaria de mais informações sobre o evento.');
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

export const EVENT_TICKET_PRICE = 50;

export const MAX_TICKETS_PER_ORDER = 10;
export const CART_EXPIRATION_MS = 10 * 60 * 1000;

export const STATUS_TO_DB: Record<Event['status'], string> = {
  Rascunho:         'draft',
  'Em breve':       'upcoming',
  Ativo:            'active',
  'Vendas liberadas': 'sales_open',
  Finalizado:       'ended',
  Pausado:          'paused',
};

export const STATUS_FROM_DB: Record<string, Event['status']> = {
  draft:         'Rascunho',
  upcoming:      'Em breve',
  active:        'Ativo',
  sales_open:    'Vendas liberadas',
  ended:         'Finalizado',
  paused:        'Pausado',
  Rascunho:      'Rascunho',
  'Em breve':    'Em breve',
  Ativo:         'Ativo',
  'Vendas liberadas': 'Vendas liberadas',
  Finalizado:    'Finalizado',
  Pausado:       'Pausado',
};

export const mockTables: TableDef[] = [
  ...Array.from({ length: 20 }).map((_, i) => ({
    id: i + 1,
    capacity: 4,
    status: [3, 5, 8, 12, 15, 18].includes(i + 1) ? ('reserved' as const) : ('available' as const),
    price: 300,
  })),
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: 21 + i,
    capacity: 2,
    status: [23].includes(21 + i) ? ('reserved' as const) : ('available' as const),
    price: 150,
  })),
];

export const MOCK_BUYERS = [
  { id: '1', name: 'Gabriel Silva', email: 'gab@email.com', cpf: '123.456.789-00', phone: '(11) 98765-4321', type: 'Mesa #12', value: 300, status: 'Pago' as const, checkedIn: false, purchaseDate: '2026-05-15T22:30:00' },
  { id: '2', name: 'Ana Oliveira', email: 'ana@email.com', cpf: '234.567.890-11', phone: '(11) 97654-3210', type: '2x Ingressos', value: 100, status: 'Pago' as const, checkedIn: false, purchaseDate: '2026-05-15T18:00:00' },
  { id: '3', name: 'Marcos Costa', email: 'marcos@email.com', cpf: '345.678.901-22', phone: '(11) 96543-2109', type: 'Mesa #05', value: 300, status: 'Pendente' as const, checkedIn: false, purchaseDate: '2026-05-14T14:20:00' },
  { id: '4', name: 'Juliana Lima', email: 'ju@email.com', cpf: '456.789.012-33', phone: '(11) 95432-1098', type: '1x Ingresso', value: 50, status: 'Cancelado' as const, checkedIn: false, purchaseDate: '2026-05-13T09:45:00' },
  { id: '5', name: 'Ricardo Dias', email: 'ric@email.com', cpf: '567.890.123-44', phone: '(11) 94321-0987', type: 'Mesa #18', value: 300, status: 'Pago' as const, checkedIn: false, purchaseDate: '2026-05-12T16:10:00' },
];
