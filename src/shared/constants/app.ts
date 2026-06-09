import type { Event } from '../../types';

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

// Observação: dados de mesas e compradores vêm exclusivamente do banco
// (reservations/ticket_items/sectors). Não há mais arrays fictícios aqui.
