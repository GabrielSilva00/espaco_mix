import type { GuestData } from '../../types';

export function validateGuestData(guestData: GuestData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!guestData.name.trim()) errors.name = 'Nome obrigatório';
  if (!guestData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errors.email = 'E-mail inválido';
  if (!isValidCpf(guestData.cpf)) errors.cpf = 'CPF inválido';
  return errors;
}

export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(digits[10]);
}

export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
