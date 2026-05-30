// Utilitários para captura e validação de dados de cartão

export interface CardData {
  number: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  installments: string;
}

export interface CardValidation {
  isValid: boolean;
  errors: {
    number?: string;
    holderName?: string;
    expiryMonth?: string;
    expiryYear?: string;
    cvv?: string;
  };
}

// Validar número de cartão (Luhn algorithm)
export function validateCardNumber(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(cleaned)) return false;

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// Validar data de expiração
export function validateExpiry(month: string, year: string): boolean {
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (monthNum < 1 || monthNum > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear() % 100; // Pega últimos 2 dígitos
  const currentMonth = now.getMonth() + 1;

  if (yearNum < currentYear) return false;
  if (yearNum === currentYear && monthNum < currentMonth) return false;

  return true;
}

// Validar CVV
export function validateCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

// Validar nome do titular
export function validateHolderName(name: string): boolean {
  if (name.trim().length < 5) return false;
  return /^[a-zA-ZÀ-ÿ\s']+$/.test(name);
}

// Validar dados completos do cartão
export function validateCardData(cardData: CardData): CardValidation {
  const errors: CardValidation['errors'] = {};

  if (!validateCardNumber(cardData.number)) {
    errors.number = 'Número de cartão inválido';
  }

  if (!validateHolderName(cardData.holderName)) {
    errors.holderName = 'Nome inválido (mínimo 5 caracteres)';
  }

  if (!validateExpiry(cardData.expiryMonth, cardData.expiryYear)) {
    errors.expiryMonth = 'Data de expiração inválida';
  }

  if (!validateCVV(cardData.cvv)) {
    errors.cvv = 'CVV inválido';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// Formatar número de cartão (adiciona espaços a cada 4 dígitos)
export function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\s/g, '');
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

// Detectar bandeira do cartão
export function detectCardBrand(cardNumber: string): 'visa' | 'mastercard' | 'amex' | 'elo' | 'unknown' {
  const cleaned = cardNumber.replace(/\s/g, '');

  if (/^4\d{12}(?:\d{3})?$/.test(cleaned)) return 'visa';
  if (/^5[1-5]\d{14}$/.test(cleaned)) return 'mastercard';
  if (/^3[47]\d{13}$/.test(cleaned)) return 'amex';
  if (/^6(?:011|5\d\d)\d{12}$/.test(cleaned)) return 'elo';

  return 'unknown';
}

// Tokenizar cartão com Mercado Pago SDK
export async function tokenizeCard(cardData: CardData): Promise<string | null> {
  const publicKey = localStorage.getItem('mp_public_key')
    || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_MERCADOPAGO_PUBLIC_KEY : null);

  if (!publicKey) {
    console.error('[CardTokenizer] Public Key do Mercado Pago não configurada');
    return null;
  }

  const validation = validateCardData(cardData);
  if (!validation.isValid) {
    console.error('[CardTokenizer] Dados do cartão inválidos:', validation.errors);
    return null;
  }

  try {
    const { loadMercadoPago } = await import('@mercadopago/sdk-js');
    const MercadoPagoConstructor = await loadMercadoPago() as any;
    if (!MercadoPagoConstructor) throw new Error('SDK do Mercado Pago não disponível');

    const mp = new MercadoPagoConstructor(publicKey);
    const expiryYear = cardData.expiryYear.length === 2
      ? `20${cardData.expiryYear}`
      : cardData.expiryYear;

    const result = await mp.createCardToken({
      cardNumber: cardData.number.replace(/\s/g, ''),
      cardholderName: cardData.holderName,
      cardExpirationMonth: cardData.expiryMonth.padStart(2, '0'),
      cardExpirationYear: expiryYear,
      securityCode: cardData.cvv,
    });

    console.log('[CardTokenizer] Token gerado:', result.id);
    return result.id ?? null;
  } catch (error) {
    console.error('[CardTokenizer] Erro ao tokenizar:', error);
    return null;
  }
}
