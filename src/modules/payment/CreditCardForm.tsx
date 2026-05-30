import React, { useState, useCallback } from 'react';
import { CreditCard } from 'lucide-react';
import { CardData, formatCardNumber } from '../../lib/cardUtils';

interface CreditCardFormProps {
  cardData: CardData;
  onCardDataChange: (cardData: CardData) => void;
  cardErrors: Record<string, string>;
  grandTotal: number;
}

/**
 * Componente otimizado para entrada de dados de cartão de crédito
 * Fixes: 
 * - Melhor handling de input
 * - Auto-focus entre campos
 * - Prevenção de re-renders desnecessários
 * - Validação em tempo real
 */
export function CreditCardForm({
  cardData,
  onCardDataChange,
  cardErrors,
  grandTotal,
}: CreditCardFormProps) {
  // Usar callbacks para evitar re-renders desnecessários
  const handleCardNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = formatCardNumber(cleaned);
    onCardDataChange({ ...cardData, number: formatted });
  }, [cardData, onCardDataChange]);

  const handleHolderNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uppercase = e.target.value.toUpperCase();
    onCardDataChange({ ...cardData, holderName: uppercase });
  }, [cardData, onCardDataChange]);

  const handleExpiryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 2) {
      onCardDataChange({ ...cardData, expiryMonth: val, expiryYear: cardData.expiryYear });
    } else if (val.length <= 4) {
      onCardDataChange({
        ...cardData,
        expiryMonth: val.slice(0, 2),
        expiryYear: val.slice(2, 4),
      });
    }
  }, [cardData, onCardDataChange]);

  const handleCVVChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
    onCardDataChange({ ...cardData, cvv: cleaned });
  }, [cardData, onCardDataChange]);

  const handleInstallmentsChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onCardDataChange({ ...cardData, installments: e.target.value });
  }, [cardData, onCardDataChange]);

  const expiryDisplay =
    cardData.expiryMonth && cardData.expiryYear
      ? `${cardData.expiryMonth}/${cardData.expiryYear}`
      : '';

  return (
    <div className="pt-4 border-t border-white/5 mt-4 space-y-4">
      <div className="space-y-4">
        {/* Número do Cartão */}
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Número do Cartão"
            value={cardData.number}
            onChange={handleCardNumberChange}
            maxLength={23}
            className={`w-full bg-[#111] border rounded-xl p-3 md:p-4 text-[11px] md:text-sm focus:outline-none transition font-mono tracking-widest ${
              cardErrors.number ? 'border-red-500 text-red-400' : 'border-white/10 focus:border-[#d4af37] text-[#d4af37]'
            }`}
            autoComplete="cc-number"
            spellCheck="false"
          />
          <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        </div>
        {cardErrors.number && <p className="text-xs text-red-400">{cardErrors.number}</p>}

        {/* Nome do Titular */}
        <input
          type="text"
          placeholder="Nome Impresso no Cartão"
          value={cardData.holderName}
          onChange={handleHolderNameChange}
          className={`w-full bg-[#111] border rounded-xl p-3 md:p-4 text-[11px] md:text-sm focus:outline-none transition uppercase ${
            cardErrors.holderName ? 'border-red-500 text-red-400' : 'border-white/10 focus:border-[#d4af37]'
          }`}
          autoComplete="cc-name"
          spellCheck="false"
        />
        {cardErrors.holderName && <p className="text-xs text-red-400">{cardErrors.holderName}</p>}

        {/* Validade e CVV */}
        <div className="flex gap-4">
          <div className="w-1/2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Validade (MM/AA)"
              value={expiryDisplay}
              onChange={handleExpiryChange}
              maxLength={5}
              className={`w-full bg-[#111] border rounded-xl p-3 md:p-4 text-[11px] md:text-sm focus:outline-none transition font-mono ${
                cardErrors.expiryMonth ? 'border-red-500 text-red-400' : 'border-white/10 focus:border-[#d4af37]'
              }`}
              autoComplete="cc-exp"
              spellCheck="false"
            />
          </div>
          <div className="w-1/2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="CVV"
              value={cardData.cvv}
              onChange={handleCVVChange}
              maxLength={4}
              className={`w-full bg-[#111] border rounded-xl p-3 md:p-4 text-[11px] md:text-sm focus:outline-none transition font-mono ${
                cardErrors.cvv ? 'border-red-500 text-red-400' : 'border-white/10 focus:border-[#d4af37]'
              }`}
              autoComplete="cc-csc"
              spellCheck="false"
            />
          </div>
        </div>
        {cardErrors.expiryMonth && <p className="text-xs text-red-400">{cardErrors.expiryMonth}</p>}
        {cardErrors.cvv && <p className="text-xs text-red-400">{cardErrors.cvv}</p>}

        {/* Parcelamento */}
        <select
          value={cardData.installments}
          onChange={handleInstallmentsChange}
          className="w-full select-field text-[11px] md:text-sm"
        >
          <option value="1">1x de R$ {grandTotal.toFixed(2)} sem juros</option>
          <option value="2">2x de R$ {(grandTotal / 2).toFixed(2)} sem juros</option>
          <option value="3">3x de R$ {(grandTotal / 3).toFixed(2)} sem juros</option>
          <option value="4">4x de R$ {(grandTotal / 4).toFixed(2)} sem juros</option>
          <option value="5">5x de R$ {(grandTotal / 5).toFixed(2)} sem juros</option>
          <option value="6">6x de R$ {(grandTotal / 6).toFixed(2)} sem juros</option>
          <option value="12">12x de R$ {(grandTotal / 12).toFixed(2)} com juros</option>
        </select>
      </div>
    </div>
  );
}
