// Utilitários para captura e validação de dados de cartão

export interface CardData {
  number: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  installments: string;
  holderCpf?: string;
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
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  const mpTestNames = ['APRO', 'OTHE', 'CONT', 'CALL', 'FUND', 'SECU', 'EXPI', 'FORM'];
  if (mpTestNames.includes(trimmed.toUpperCase())) return true;
  return /^[a-zA-ZÀ-ÿ\s']+$/.test(trimmed);
}

// Validar dados completos do cartão
export function validateCardData(cardData: CardData): CardValidation {
  const errors: CardValidation['errors'] = {};

  if (!validateCardNumber(cardData.number)) {
    errors.number = 'Número de cartão inválido';
  }

  if (!validateHolderName(cardData.holderName)) {
    errors.holderName = 'Nome inválido (mínimo 2 caracteres)';
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

// Detectar bandeira do cartão.
// A detecção é por prefixo (BIN). A ordem importa: Elo compartilha faixas 50xx/65xx
// com Mastercard/Discover, então é checada antes. Mastercard cobre 51-55, a faixa
// nova 2221-2720 e os BINs 50xx usados pelos cartões de teste do Mercado Pago
// (ex.: 5031 7557…), que a regex antiga `^5[1-5]` classificava como "unknown".
export function detectCardBrand(cardNumber: string): 'visa' | 'mastercard' | 'amex' | 'elo' | 'unknown' {
  const cleaned = cardNumber.replace(/\D/g, '');

  // Amex e Elo primeiro: Elo tem BINs que começam com 4 (Visa) e 5/6 (Mastercard).
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^(4011|4312|4389|438935|451416|457393|45763[12]|504175|5041|5066|5067|509|627780|636297|636368|650|6516|6550)/.test(cleaned)) return 'elo';
  if (/^4/.test(cleaned)) return 'visa';
  if (/^(5[0-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(cleaned)) return 'mastercard';

  return 'unknown';
}

// Tokenizar cartão com Mercado Pago SDK.
// Além do token, resolve o payment_method_id REAL consultando o próprio MP
// (mp.getPaymentMethods({ bin })). Isso elimina a detecção frágil por regex:
// p.ex. um BIN Elo que começa com 4 era classificado como Visa e o backend
// montava 'debvisa' em vez de 'debelo', fazendo o MP rejeitar o débito.
export async function tokenizeCard(
  cardData: CardData,
  opts: { isDebit?: boolean } = {}
): Promise<{ token: string; paymentMethodId: string | null } | null> {
  // A env é a fonte da verdade (igual ao backend, que usa MERCADOPAGO_ACCESS_TOKEN
  // da env antes do runtime). Sem env, usa a public key configurada pelo admin no
  // painel (salva em system_config.mp_public_key — não-secreta). localStorage é
  // fallback legado. Assim a public key do front bate com a conta do servidor.
  const envKey = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_MERCADOPAGO_PUBLIC_KEY : null);
  let dbKey: string | undefined;
  if (!envKey) {
    try { const { getSystemConfig } = await import('./supabase'); dbKey = (await getSystemConfig())?.mp_public_key; } catch { /* ignore */ }
  }
  const publicKey = envKey || dbKey || localStorage.getItem('mp_public_key');

  if (!publicKey) {
    console.error('[CardTokenizer] Public Key do Mercado Pago não configurada');
    return null;
  }

  const validation = validateCardData(cardData);
  if (!validation.isValid) {
    console.error('[CardTokenizer] Dados do cartão inválidos:', validation.errors);
    return null;
  }

  const tokenPromise = (async () => {
    const { loadMercadoPago } = await import('@mercadopago/sdk-js');
    const MercadoPagoConstructor = await loadMercadoPago() as any;
    if (!MercadoPagoConstructor) throw new Error('SDK do Mercado Pago não disponível');

    const mp = new MercadoPagoConstructor(publicKey);
    const expiryYear = cardData.expiryYear.length === 2
      ? `20${cardData.expiryYear}`
      : cardData.expiryYear;

    const cpf = (cardData.holderCpf || '').replace(/\D/g, '');

    const cleanNumber = cardData.number.replace(/\s/g, '');
    const result = await mp.createCardToken({
      cardNumber: cleanNumber,
      cardholderName: cardData.holderName,
      cardExpirationMonth: cardData.expiryMonth.padStart(2, '0'),
      cardExpirationYear: expiryYear,
      securityCode: cardData.cvv,
      identificationType: 'CPF',
      identificationNumber: cpf || '12345678909',
    });

    if (!result.id) return null;

    // Pergunta ao MP o payment_method_id exato para este BIN (ex.: 'debelo').
    // Falha aqui não impede o pagamento — o backend cai no mapa de fallback.
    let paymentMethodId: string | null = null;
    try {
      const wantType = opts.isDebit ? 'debit_card' : 'credit_card';
      const pm = await mp.getPaymentMethods({ bin: cleanNumber.slice(0, 8) });
      const results: any[] = pm?.results ?? [];
      const match = results.find(m => m.payment_type_id === wantType) ?? results[0];
      paymentMethodId = match?.id ?? null;
    } catch (e) {
      console.warn('[CardTokenizer] getPaymentMethods falhou, usando fallback no backend:', e);
    }

    return { token: result.id, paymentMethodId };
  })();

  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout ao tokenizar cartão (15s)')), 15000)
  );

  try {
    return await Promise.race([tokenPromise, timeoutPromise]);
  } catch (error) {
    console.error('[CardTokenizer] Erro:', error);
    return null;
  }
}
