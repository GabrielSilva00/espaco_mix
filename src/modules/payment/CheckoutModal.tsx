import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Check, CreditCard, Copy, AlertCircle, QrCode, ChevronRight, ChevronLeft,
  Smartphone, User, Lock, AlertTriangle, StopCircle, MessageCircle,
  ShieldAlert, RefreshCcw, Clock, Info, Edit2, ArrowLeft, ShieldCheck,
  Download, FileText, Mail, Ticket,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GoogleIcon } from '../../components/GoogleIcon';
import { EVENT_TICKET_PRICE } from '../../shared/constants/app';
import { downloadTicketPDF } from '../../shared/utils/pdf';
import { signIn, getMyProfile } from '../../lib/supabase';
import { CardData, validateCardData, formatCardNumber } from '../../lib/cardUtils';
import { SessionRestoredNotification } from './SessionRestoredNotification';
import { CreditCardForm } from './CreditCardForm';
import type { PaymentMethod } from '../../types';

export function CheckoutModal() {
  const [cardData, setCardData] = useState<CardData>({
    number: '',
    holderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    installments: '1',
  });

  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [localPaymentMethod, setLocalPaymentMethod] = useState<PaymentMethod | null>(null);

  const {
    isCheckoutOpen, setIsCheckoutOpen,
    checkoutStep, setCheckoutStep,
    paymentStatus, setPaymentStatus,
    guestData, setGuestData,
    selectedTables, singleTickets, maleTickets, femaleTickets,
    grandTotal, subTotal, taxAmount, ticketsTotal, tablesTotal,
    previewSectors,
    derivedTables,
    activeEvent,
    pixData, setPixData,
    role, userRole, sessionUser,
    authTab, setAuthTab,
    adminForm, setAdminForm,
    registerForm, setRegisterForm,
    registerStep, setRegisterStep,
    verificationStep, setVerificationStep,
    verificationCode, setVerificationCode,
    forgotPasswordStep, setForgotPasswordStep,
    forgotPasswordData, setForgotPasswordData,
    totpPending, setTotpPending,
    totpInput, setTotpInput,
    adminError, setAdminError,
    handleAdminLogin, handleRegister, handleVerifyCode,
    handleConfirmReservation, handleCreateReservation,
    showToast,
    setCurrentView, setAuthIntent,
    siteConfig,
    cartTimeLeft,
    selectedBuyerForDetails, setSelectedBuyerForDetails,
    sessionRestored, setSessionRestored, sessionConflict, setSessionConflict,
    errors, setErrors,
    isProcessingPayment,
    users, setUsers, setUserRole, setSessionUser, setLoggedInUserId, setIsApprovedEventCreator,
    setSelectedTables, setSingleTickets,
    reservations,
    handleCheckIn,
  } = useApp();

  const selectedTablesData = derivedTables.filter(t => selectedTables.includes(t.id));

  if (!isCheckoutOpen) return null;

  return (
    <>
      {/* Modal / Checkout State Simples */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f0f] border border-white/10 w-full max-w-md rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-[0_0_50px_rgba(212,175,55,0.05)] relative mx-auto my-auto overflow-y-auto max-h-[95vh]"
            >
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                disabled={paymentStatus !== 'idle'}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition z-50 disabled:opacity-0"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* Progress Indicator */}
              {paymentStatus === 'idle' && checkoutStep !== 'success' && checkoutStep !== 'processing' && (
                <div className="flex items-center justify-between mb-5 px-2 max-w-[200px] mx-auto mt-2 relative">
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -translate-y-1/2 z-0"></div>
                  <div className="absolute top-1/2 left-0 h-[1px] bg-[#d4af37] -translate-y-1/2 z-0 transition-all duration-500" style={{ width: checkoutStep === 'selection' ? '0%' : (checkoutStep === 'login-form') ? '50%' : '100%' }}></div>
                  
                  {['selection', 'login-form', 'payment-method'].map((step, idx) => {
                     const isCurrent = checkoutStep === step || (idx === 1 && checkoutStep === 'login-form');
                     const isPast = (idx === 0 && checkoutStep !== 'selection') || (idx === 1 && checkoutStep === 'payment-method');
                     return (
                      <div key={idx} className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${isCurrent || isPast ? 'bg-[#0f0f0f] border-[#d4af37] text-[#d4af37]' : 'bg-[#0f0f0f] border-white/20 text-white/30'}`}>
                         {isPast ? <Check className="w-3 h-3" /> : idx + 1}
                      </div>
                     )
                  })}
                </div>
              )}
              
              {paymentStatus === 'idle' && checkoutStep === 'selection' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-lg md:text-xl font-serif text-[#d4af37] mb-2 text-center">Resumo do Pedido</h2>
                  <p className="text-[10px] md:text-[11px] uppercase opacity-50 tracking-widest text-center mb-4">Confirme seus itens antes de prosseguir</p>
                  
                  {cartTimeLeft !== null && cartTimeLeft > 0 && (
                    <div className={`p-3 rounded-xl mb-4 flex items-center justify-center gap-3 transition-colors ${cartTimeLeft < 120000 ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-white/5 border border-white/10 text-white/70'}`}>
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] uppercase font-bold tracking-widest">
                        {cartTimeLeft < 120000 ? 'Reserva Expirando:' : 'Sua mesa está garantida por:'}
                      </span>
                      <span className="font-mono font-bold">
                        {Math.floor(cartTimeLeft / 60000).toString().padStart(2, '0')}:
                        {Math.floor((cartTimeLeft % 60000) / 1000).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                    {selectedTablesData.length > 0 && (
                      <div className="flex justify-between items-start text-sm group">
                        <span className="opacity-60 uppercase text-[10px] tracking-widest leading-relaxed">Mesas ({selectedTablesData.length})</span>
                        <span className="text-white font-serif whitespace-nowrap ml-4">R$ {tablesTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {activeEvent?.priceType === 'gender' ? (
                      <>
                        {maleTickets > 0 && (
                          <div className="flex justify-between items-start text-sm group">
                            <span className="opacity-60 uppercase text-[10px] tracking-widest leading-relaxed">Ingressos Masc. ({maleTickets})</span>
                            <span className="text-white font-serif whitespace-nowrap ml-4">R$ {(maleTickets * (previewSectors[0]?.priceMale || 0)).toFixed(2)}</span>
                          </div>
                        )}
                        {femaleTickets > 0 && (
                          <div className="flex justify-between items-start text-sm group">
                            <span className="opacity-60 uppercase text-[10px] tracking-widest leading-relaxed">Ingressos Fem. ({femaleTickets})</span>
                            <span className="text-white font-serif whitespace-nowrap ml-4">R$ {(femaleTickets * (previewSectors[0]?.priceFemale || 0)).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {singleTickets > 0 && (
                          <div className="flex justify-between items-start text-sm group">
                            <span className="opacity-60 uppercase text-[10px] tracking-widest leading-relaxed">{previewSectors[0]?.name || 'Ingressos'} ({singleTickets})</span>
                            <span className="text-white font-serif whitespace-nowrap ml-4">R$ {(singleTickets * (previewSectors[0]?.price || EVENT_TICKET_PRICE)).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="pt-4 border-t border-white/10 flex justify-between items-center opacity-60">
                      <span className="text-[10px] md:text-[11px] uppercase tracking-widest">Subtotal</span>
                      <span className="text-sm font-serif text-white whitespace-nowrap">R$ {subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-start opacity-60">
                      <div>
                        <span className="text-[10px] md:text-[11px] uppercase tracking-widest flex items-center gap-1">
                          Taxa de conveniência (10%) <Info className="w-3 h-3" />
                        </span>
                        <p className="text-[9px] normal-case tracking-normal text-white/40 mt-0.5 max-w-[180px]">
                          Cobre os custos operacionais e segurança da transação.
                        </p>
                      </div>
                      <span className="text-sm font-serif text-white whitespace-nowrap ml-4">R$ {taxAmount.toFixed(2)}</span>
                    </div>

                    <div className="pt-2 mt-2 border-t border-white/5 flex justify-between items-center">
                      <span className="text-[11px] uppercase opacity-80 tracking-[0.2em] font-bold text-[#d4af37]">Total</span>
                      <span className="text-white text-2xl font-serif whitespace-nowrap">R$ {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      if (role) {
                        setCheckoutStep('payment-method');
                      } else {
                        setAuthTab('login');
                        setCheckoutStep('login-form');
                      }
                    }}
                    className="w-full py-3 md:py-4 mt-2 text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-full hover:brightness-110 transition flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={() => setIsCheckoutOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 border border-[#d4af37]/50 bg-[#d4af37]/10 rounded-xl text-[#d4af37] text-[10px] uppercase font-bold tracking-widest hover:bg-[#d4af37]/20 transition mx-auto mt-4"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar Itens
                  </button>
                </motion.div>
              )}

              {paymentStatus === 'idle' && checkoutStep === 'payment-method' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <button 
                    onClick={() => setCheckoutStep('selection')}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition mb-6"
                  >
                    <ArrowLeft className="w-3 h-3" /> Voltar ao resumo
                  </button>

                  <h2 className="text-xl md:text-2xl font-serif text-[#d4af37] mb-1">Forma de Pagamento</h2>
                  <p className="text-[10px] uppercase opacity-50 tracking-widest mb-4">Escolha como deseja pagar (R$ {grandTotal.toFixed(2)})</p>

                  <div className="space-y-2 mb-4">
                    {/* PIX - DESTAQUE */}
                    <button 
                      onClick={() => {
                        setLocalPaymentMethod('pix');
                        setErrors(prev => ({ ...prev, payment: '' }));
                      }}
                      className={`w-full p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between group ${localPaymentMethod === 'pix' ? 'bg-[#d4af37]/10 border-[#d4af37]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition ${localPaymentMethod === 'pix' ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white'}`}>
                          <Smartphone className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2">
                            PIX 
                            <span className="bg-green-500 text-black text-[8px] px-1.5 py-0.5 rounded font-black animate-pulse">RECOMENDADO</span>
                          </p>
                          <p className="text-[9px] md:text-[10px] opacity-40">Aprovação instantânea 24/7</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center ${localPaymentMethod === 'pix' ? 'border-[#d4af37] bg-[#d4af37]' : 'border-white/10'}`}>
                        {localPaymentMethod === 'pix' && <Check className="w-3 h-3 text-black" />}
                      </div>
                    </button>

                    {/* Cartão de Crédito */}
                    <AnimatePresence>
                      <button 
                        onClick={() => {
                          setLocalPaymentMethod('credit_card');
                          setErrors(prev => ({ ...prev, payment: '' }));
                        }}
                        className={`w-full p-3 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between group ${localPaymentMethod === 'credit_card' ? 'bg-[#d4af37]/10 border-[#d4af37]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition ${localPaymentMethod === 'credit_card' ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white'}`}>
                            <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Cartão de Crédito</p>
                            <p className="text-[9px] md:text-[10px] opacity-40">Até 12x no cartão</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${localPaymentMethod === 'credit_card' ? 'border-[#d4af37] bg-[#d4af37]' : 'border-white/10'}`}>
                          {localPaymentMethod === 'credit_card' && <Check className="w-3 h-3 text-black" />}
                        </div>
                      </button>

                      {localPaymentMethod === 'credit_card' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-2 pb-2 overflow-hidden"
                        >
                          <CreditCardForm 
                            cardData={cardData}
                            onCardDataChange={(newCardData) => {
                              setCardData(newCardData);
                              // Clear errors when user starts typing
                              if (Object.keys(cardErrors).length > 0) {
                                setCardErrors({});
                              }
                            }}
                            cardErrors={cardErrors}
                            grandTotal={grandTotal}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Cartão de Débito */}
                    <button 
                      onClick={() => {
                        setLocalPaymentMethod('debit_card');
                        setErrors(prev => ({ ...prev, payment: '' }));
                      }}
                      className={`w-full p-3 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between group ${localPaymentMethod === 'debit_card' ? 'bg-[#d4af37]/10 border-[#d4af37]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition ${localPaymentMethod === 'debit_card' ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white'}`}>
                          <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Cartão de Débito</p>
                          <p className="text-[9px] md:text-[10px] opacity-40">Débito à vista</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center ${localPaymentMethod === 'debit_card' ? 'border-[#d4af37] bg-[#d4af37]' : 'border-white/10'}`}>
                        {localPaymentMethod === 'debit_card' && <Check className="w-3 h-3 text-black" />}
                      </div>
                    </button>

                  </div>

                  <button 
                    onClick={() => {
                      if (localPaymentMethod === 'credit_card') {
                        // Validar dados do cartão
                        const validation = validateCardData(cardData);
                        if (!validation.isValid) {
                          setCardErrors(validation.errors);
                          showToast('Verifique os dados do cartão', 'error');
                          return;
                        }
                        setCardErrors({});
                      }
                      handleConfirmReservation(localPaymentMethod === 'credit_card' ? cardData : undefined, localPaymentMethod);
                    }}
                    disabled={!localPaymentMethod || isProcessingPayment}
                    className="w-full py-3 md:py-4 mt-2 text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-full hover:brightness-110 transition flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Confirmar e Pagar <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="mt-4 p-3 md:p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3 md:gap-4 text-left">
                    <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-blue-400 mt-0.5" />
                    <div>
                       <p className="text-[9px] md:text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Ambiente 100% Seguro</p>
                       <p className="text-[9px] md:text-[10px] opacity-60 leading-relaxed">Sua transação é protegida com criptografia de ponta a ponta seguindo normas PCI-DSS.</p>
                    </div>
                  </div>
                  {errors.payment && <p className="text-[10px] text-red-500 mt-2 text-center font-bold uppercase">{errors.payment}</p>}
                </motion.div>
              )}

              {paymentStatus === 'idle' && checkoutStep === 'login-form' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <button 
                    onClick={() => setCheckoutStep('selection')}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition mb-6"
                  >
                    <ArrowLeft className="w-3 h-3" /> Voltar às opções
                  </button>

                  <div className="flex bg-white/5 p-1 rounded-xl mb-8">
                    <button 
                      onClick={() => setAuthTab('login')}
                      className={`flex-1 min-h-[44px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'login' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
                    >
                      Entrar
                    </button>
                    <button 
                      onClick={() => setAuthTab('register')}
                      className={`flex-1 min-h-[44px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'register' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
                    >
                      Cadastrar
                    </button>
                  </div>

                  <h2 className="text-2xl font-serif text-[#d4af37] mb-2 text-center">
                    {authTab === 'login' ? 'Acessar Conta' : 'Criar Nova Conta'}
                  </h2>
                  <p className="text-[11px] uppercase opacity-50 tracking-widest mb-8 text-center text-balance">
                    {authTab === 'login' ? 'Acesse para continuar sua compra' : 'Preencha os dados obrigatórios'}
                  </p>

                  {verificationStep ? (
                    <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
                      <Mail className="w-12 h-12 text-[#d4af37] mx-auto opacity-80" />
                      <h2 className="text-xl font-serif text-[#d4af37]">Verificação de E-mail</h2>
                      <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                        Enviamos um código de 4 dígitos para<br/><span className="text-[#d4af37] mt-2 block">{registerForm.email}</span>
                      </p>
                      
                      <div className="flex justify-center gap-4 py-4">
                        {verificationCode.map((digit, idx) => (
                          <input 
                            key={`checkout-code-${idx}`}
                            id={`checkout-code-${idx}`}
                            type="text"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => {
                              const newCode = [...verificationCode];
                              newCode[idx] = e.target.value.replace(/\D/g, '');
                              setVerificationCode(newCode);
                              if (e.target.value && idx < 3) document.getElementById(`checkout-code-${idx + 1}`)?.focus();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !digit && idx > 0) {
                                document.getElementById(`checkout-code-${idx - 1}`)?.focus();
                              }
                            }}
                            className="w-12 h-14 bg-white/5 border border-white/20 rounded-xl text-center text-xl font-bold focus:border-[#d4af37] outline-none text-white transition-all"
                          />
                        ))}
                      </div>
                      {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}
                      
                      <button 
                        onClick={() => {
                          if (verificationCode.join('').length < 4) {
                            setAdminError('Preencha o código completo (4 dígitos)');
                            return;
                          }
                          setAdminError('');
                          setTimeout(() => {
                            const newUser = {
                              id: Math.random().toString(36).substr(2, 9),
                              name: registerForm.name,
                              email: registerForm.email,
                              phone: registerForm.phone,
                              cpf: registerForm.cpf,
                              birthDate: registerForm.birthDate,
                              // Senha nunca armazenada em memória
                            };
                            setUsers([...users, newUser]);
                            setUserRole('client');
                            setSessionUser({
                              id: newUser.id,
                              email: newUser.email,
                              name: newUser.name || 'Conta',
                              role: 'client',
                              isApprovedEventCreator: false,
                            });
                            setLoggedInUserId(newUser.id);
                            setGuestData({ name: newUser.name || 'Usuário', email: newUser.email, cpf: newUser.cpf || '000.000.000-00' });
                            setVerificationStep(false);
                            setRegisterForm({ name: '', email: '', phone: '', cpf: '', birthDate: '', password: '' });
                            setVerificationCode(['', '', '', '']);
                            setAdminForm({ username: '', password: '' });
                            showToast(`Bem-vindo(a), ${newUser.name.split(' ')[0]}!`, 'success');
                            setCheckoutStep('payment-method');
                          }, 500);
                        }}
                        className="w-full bg-[#d4af37] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 shadow-[0_0_20px_rgba(212,175,55,0.2)] transition"
                      >
                        Confirmar Cadastro
                      </button>
                      <button 
                        onClick={() => setVerificationStep(false)}
                        className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition mt-4"
                      >
                        Voltar e editar dados
                      </button>
                    </div>
                  ) : forgotPasswordStep === 'none' ? (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (authTab === 'login') {
                        try {
                          const data = await signIn(adminForm.username, adminForm.password);
                          const profile = await getMyProfile();
                          setUserRole((profile?.role as any) ?? 'client');
                          setIsApprovedEventCreator(profile?.is_approved_event_creator ?? false);
                          setSessionUser({
                            id: data.user.id,
                            email: data.user.email!,
                            name: profile?.name || 'Usuário',
                            role: (profile?.role as any) ?? 'client',
                            isApprovedEventCreator: profile?.is_approved_event_creator ?? false,
                            avatarUrl: profile?.avatar_url,
                          });
                          setLoggedInUserId(data.user.id);
                          setAdminError('');
                          setGuestData({ name: profile?.name || 'Usuário', email: data.user.email!, cpf: '' });
                          setCheckoutStep('payment-method');
                        } catch (err: any) {
                          setAdminError(err?.message ?? 'Usuário ou senha incorretos');
                        }
                      } else {
                        handleRegister(e);
                      }
                    }} className="space-y-4 md:space-y-5">
                      {authTab === 'register' && registerStep === 1 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-5">
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Nome Completo</label>
                            <input 
                              type="text" 
                              value={registerForm.name}
                              onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="Seu nome"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail</label>
                            <input 
                              type="email" 
                              value={registerForm.email}
                              onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="contato@exemplo.com"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Senha</label>
                            <input 
                              type="password" 
                              value={registerForm.password}
                              onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="••••••••"
                            />
                          </div>
                        </motion.div>
                      )}
                      {authTab === 'register' && registerStep === 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-5">
                          <button 
                            type="button"
                            onClick={() => setRegisterStep(1)}
                            className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-4"
                          >
                            <ArrowLeft className="w-3 h-3" /> Voltar
                          </button>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Celular</label>
                            <input 
                              type="tel" 
                              value={registerForm.phone}
                              onChange={(e) => setRegisterForm({...registerForm, phone: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="(11) 90000-0000"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">CPF</label>
                            <input 
                              type="text" 
                              value={registerForm.cpf}
                              onChange={(e) => setRegisterForm({...registerForm, cpf: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="000.000.000-00"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Data de Nascimento</label>
                            <input 
                              type="date" 
                              value={registerForm.birthDate}
                              onChange={(e) => setRegisterForm({...registerForm, birthDate: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-white"
                              style={{ colorScheme: 'dark' }}
                            />
                          </div>
                        </motion.div>
                      )}
                      {authTab === 'login' && (
                        <>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail / Usuário</label>
                            <input
                              type="text"
                              name="username"
                              autoComplete="username"
                              value={adminForm.username}
                              onChange={(e) => setAdminForm({...adminForm, username: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="seu@email.com"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Senha</label>
                            <input
                              type="password"
                              name="password"
                              autoComplete="current-password"
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="••••••••"
                            />
                          </div>
                          <div className="flex justify-start">
                            <button
                              type="button"
                              onClick={() => setForgotPasswordStep('email')}
                              className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:brightness-110 opacity-70 hover:opacity-100 transition"
                            >
                              Esqueci minha senha
                            </button>
                          </div>
                        </>
                      )}
                      {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}
                      
                      <button 
                        type="submit"
                        className="w-full py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-full hover:brightness-110 transition flex items-center justify-center gap-2 mb-2 mt-2"
                      >
                        {authTab === 'login' ? 'Entrar e Prosseguir' : registerStep === 1 ? 'Próximo Passo' : 'Cadastrar e Entrar'}
                      </button>
                      
                      {authTab === 'login' && (
                        <>
                          <div className="flex items-center gap-4 mb-3 mt-1 opacity-30">
                            <div className="h-[1px] flex-1 bg-white"></div>
                            <span className="text-[9px] uppercase tracking-widest">ou</span>
                            <div className="h-[1px] flex-1 bg-white"></div>
                          </div>
                          <button 
                            type="button"
                            className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                          >
                            <GoogleIcon className="w-4 h-4" /> Entrar com Google
                          </button>
                        </>
                      )}
                      
                      {authTab === 'register' && registerStep === 1 && (
                        <>
                          <div className="flex items-center gap-4 mb-3 mt-1 opacity-30">
                            <div className="h-[1px] flex-1 bg-white"></div>
                            <span className="text-[9px] uppercase tracking-widest">ou</span>
                            <div className="h-[1px] flex-1 bg-white"></div>
                          </div>
                          <button 
                            type="button"
                            className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                          >
                            <GoogleIcon className="w-4 h-4" /> Cadastrar com Google
                          </button>
                        </>
                      )}
                    </form>
                  ) : (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (forgotPasswordStep === 'email') {
                         if (!forgotPasswordData.email) {
                           setAdminError('Preencha o e-mail');
                           return;
                         }
                         setAdminError('');
                         setForgotPasswordStep('code');
                      } else if (forgotPasswordStep === 'code') {
                         if (!forgotPasswordData.code) {
                           setAdminError('Preencha o código');
                           return;
                         }
                         setAdminError('');
                         setForgotPasswordStep('new_password');
                      } else if (forgotPasswordStep === 'new_password') {
                         if (!forgotPasswordData.newPassword) {
                           setAdminError('Preencha a nova senha');
                           return;
                         }
                         setAdminError('');
                         setForgotPasswordStep('none');
                         setForgotPasswordData({ email: '', code: '', newPassword: '' });
                         showToast('Senha redefinida com sucesso!', 'success');
                      }
                    }} className="space-y-4 md:space-y-5 animate-in fade-in zoom-in duration-300">
                       <button
                          type="button"
                          onClick={() => {
                            if (forgotPasswordStep === 'email') setForgotPasswordStep('none');
                            else if (forgotPasswordStep === 'code') setForgotPasswordStep('email');
                            else if (forgotPasswordStep === 'new_password') setForgotPasswordStep('code');
                          }}
                          className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-4"
                        >
                          <ArrowLeft className="w-3 h-3" /> Voltar
                       </button>

                       <div className="text-center mb-6">
                          <Smartphone className="w-10 h-10 text-[#d4af37] mx-auto opacity-80 mb-4" />
                          <h2 className="text-xl font-serif text-[#d4af37] mb-2">Recuperar Senha</h2>
                          <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                             {forgotPasswordStep === 'email' && 'Informe seu e-mail de acesso'}
                             {forgotPasswordStep === 'code' && `Enviamos um código para ${forgotPasswordData.email}`}
                             {forgotPasswordStep === 'new_password' && 'Crie sua nova senha de acesso'}
                          </p>
                       </div>

                       {forgotPasswordStep === 'email' && (
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail</label>
                            <input 
                              type="email" 
                              value={forgotPasswordData.email}
                              onChange={(e) => setForgotPasswordData({...forgotPasswordData, email: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="contato@exemplo.com"
                            />
                          </div>
                       )}

                       {forgotPasswordStep === 'code' && (
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Código de Verificação</label>
                            <input 
                              type="text" 
                              value={forgotPasswordData.code}
                              onChange={(e) => setForgotPasswordData({...forgotPasswordData, code: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-center tracking-[1em]"
                              placeholder="0000"
                              maxLength={4}
                            />
                          </div>
                       )}

                       {forgotPasswordStep === 'new_password' && (
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Nova Senha</label>
                            <input 
                              type="password" 
                              value={forgotPasswordData.newPassword}
                              onChange={(e) => setForgotPasswordData({...forgotPasswordData, newPassword: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="••••••••"
                            />
                          </div>
                       )}

                       {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}

                       <button 
                          type="submit"
                          className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:brightness-110 transition mt-4"
                        >
                          {forgotPasswordStep === 'email' ? 'Enviar Código' : forgotPasswordStep === 'code' ? 'Verificar Código' : 'Redefinir Senha'}
                        </button>
                    </form>
                  )}
                </motion.div>
              )}

              {paymentStatus === 'processing' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-6"
                >
                  {localPaymentMethod === 'pix' && pixData ? (
                    <div className="text-center w-full">
                      <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-xl">
                        <img src={pixData.qrCode} alt="PIX QR Code" className="w-48 h-48 mx-auto" />
                      </div>
                      <h3 className="text-xl font-serif text-[#d4af37] mb-2">Escaneie o QR Code</h3>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-6">Aguardando confirmação do pagamento...</p>
                      
                      <div className="space-y-4">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                           <p className="text-[9px] uppercase tracking-widest opacity-40 mb-2">Pix Copia e Cola</p>
                           <div className="flex gap-2">
                              <input 
                                readOnly 
                                value={pixData.copyPaste}
                                className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-[#d4af37] outline-none"
                              />
                              <button 
                                onClick={() => navigator.clipboard.writeText(pixData.copyPaste)}
                                className="bg-[#d4af37] text-black px-4 rounded-lg font-bold text-[10px] hover:brightness-110"
                              >
                                COPIAR
                              </button>
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-center gap-3 py-4">
                           <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-ping"></div>
                           <p className="text-[10px] uppercase font-bold text-[#d4af37] animate-pulse">Sincronizando com Banco Central...</p>
                        </div>

                        <button 
                           onClick={() => {
                             setPaymentStatus('success');
                           }}
                           className="w-full py-4 border border-[#d4af37]/30 text-[#d4af37] text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-[#d4af37]/10 transition"
                        >
                          Já realizei o pagamento
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="relative w-20 h-20 mb-6 mx-auto">
                        <div className="absolute inset-0 rounded-full border-t-2 border-[#d4af37] border-r-2 border-transparent border-b-2 border-transparent border-l-2 border-[#d4af37]/30 animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-t-2 border-transparent border-r-2 border-[#d4af37]/50 border-b-2 border-transparent border-l-2 border-[#d4af37] animate-[spin_1.5s_linear_infinite_reverse]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-[#d4af37] animate-pulse" />
                        </div>
                      </div>
                      <h3 className="text-xl font-serif text-[#d4af37] mb-2">Processando {localPaymentMethod?.replace('_', ' ')}</h3>
                      <p className="text-[10px] uppercase tracking-widest opacity-50">Por favor aguarde...</p>
                    </div>
                  )}
                </motion.div>
              )}

              {paymentStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <X className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-serif text-white mb-2">Ops! Algo deu errado</h3>
                  <p className="text-[11px] text-white/60 mb-8 max-w-[280px] mx-auto">
                    {errors.payment || "Não conseguimos processar seu pagamento neste momento. Por favor, verifique seus dados ou tente outra forma de pagamento."}
                  </p>
                  
                  <div className="w-full space-y-4">
                    <button 
                      onClick={() => {
                        setPaymentStatus('idle');
                        setErrors(prev => ({ ...prev, payment: '' }));
                      }}
                      className="w-full py-4 bg-[#d4af37] text-black rounded-full text-[11px] font-bold uppercase tracking-widest hover:brightness-110 transition flex items-center justify-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4" /> Tentar Novamente
                    </button>
                    
                    <button 
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        setPaymentStatus('idle');
                      }}
                      className="w-full py-4 bg-white/5 text-white/40 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition"
                    >
                      Voltar depois
                    </button>
                  </div>
                </motion.div>
              )}

              {paymentStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center pt-2"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-16 h-16 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full flex items-center justify-center mb-4 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-green-500/20 blur-xl animate-pulse"></div>
                    <Check className="w-8 h-8 relative z-10" />
                  </motion.div>
                  
                  <h3 className="text-xl font-serif text-white mb-1">Compra Concluída!</h3>
                  <p className="text-[9px] uppercase tracking-widest text-[#d4af37] mb-6 text-center">Seu ingresso foi enviado para <br/>{guestData.email || 'seu e-mail'}</p>

                  {reservations[0]?.ticketsObj?.some(t => t.isTable) && (
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/30 p-4 rounded-xl mb-6 text-center w-full shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <p className="text-[11px] text-amber-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2 justify-center mb-2"><AlertCircle className="w-4 h-4" /> Importante</p>
                      <p className="text-[10px] text-amber-500/80 leading-relaxed uppercase">Para facilitar a entrada, informe agora os dados de cada ocupante da sua mesa.</p>
                      <button 
                        onClick={() => {
                          setIsCheckoutOpen(false);
                          setSelectedTables([]);
                          setSingleTickets(0);
                          setCurrentView('reservations');
                          setPaymentStatus('idle');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="mt-4 w-full bg-amber-500/20 text-amber-400 text-[9px] uppercase font-bold tracking-widest py-2 rounded-lg hover:bg-amber-500/30 transition border border-amber-500/20"
                      >
                        Informar Ocupantes Agora
                      </button>
                    </motion.div>
                  )}

                  {/* MULTIPLE QR CODES */}
                  <div className={`grid grid-cols-2 gap-4 w-full pb-2 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar p-1`}>
                    {reservations[0]?.ticketsObj && reservations[0].ticketsObj.length > 0 ? (
                      reservations[0].ticketsObj.map((tkt, idx) => (
                        <div key={tkt.id} className="flex flex-col items-center gap-2">
                          <div className="bg-white p-3 rounded-xl relative group w-full flex flex-col items-center border-[3px] border-white shadow-xl">
                            <div className="text-[#0a0a0a] text-[8px] font-bold uppercase tracking-widest mb-2 border-b border-black/10 pb-2 w-full text-center truncate px-1">
                              {tkt.name}
                            </div>
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${tkt.id}`} alt={`QR Code ${tkt.id}`} className="w-20 h-20 mx-auto" loading="lazy" decoding="async" />
                            <p className="text-black/40 text-[7px] font-mono tracking-widest text-center mt-2">{tkt.id}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex w-full flex-col items-center justify-center gap-4 col-span-2">
                        <div className="bg-white p-4 rounded-2xl relative group">
                          <div className="absolute inset-0 bg-[#d4af37]/10 opacity-0 group-hover:opacity-100 transition rounded-2xl"></div>
                          <QrCode className="w-20 h-20 text-black mx-auto" strokeWidth={1.5} />
                          <p className="text-black/40 text-[8px] font-bold uppercase tracking-widest text-center mt-4">Reserva de Mesa(s)</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-3 w-full mb-6">
                    <button
                      onClick={() => {
                        const tickets = reservations[0]?.ticketsObj;
                        if (!tickets?.length) return;
                        tickets.forEach(tkt => downloadTicketPDF({ id: tkt.id, name: tkt.name, ownerName: tkt.ownerName }));
                      }}
                      className="w-full bg-[#1a1a1a] hover:bg-[#222] border border-white/10 rounded-xl py-3 flex items-center justify-center gap-2 group transition"
                    >
                      <Download className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] uppercase tracking-widest font-bold text-white/50 group-hover:text-white transition">Baixar PDFs</span>
                    </button>
                  </div>

                  <div className="w-full pt-4 border-t border-white/10">
                    <button 
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        setSelectedTables([]);
                        setSingleTickets(0);
                        setCurrentView('reservations');
                        setPaymentStatus('idle');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full py-4 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-full hover:brightness-110 transition flex items-center justify-center gap-2"
                    >
                      Acessar Minhas Reservas
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Participant Details Modal */}
      <AnimatePresence>
        {selectedBuyerForDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0a0a0a] border border-white/10 w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl relative"
            >
              {/* Header with Visual Decor */}
              <div className="relative h-32 md:h-40 bg-[#d4af37] flex items-end px-8 pb-6">
                <div className="absolute top-6 right-8 z-10">
                  <button 
                    onClick={() => setSelectedBuyerForDetails(null)}
                    className="w-10 h-10 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all hover:rotate-90"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Abstract Pattern Overlay */}
                <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                   <div className="absolute -top-1/2 -left-1/4 w-full h-full bg-white rotate-12 blur-3xl rounded-full"></div>
                   <div className="absolute -bottom-1/2 -right-1/4 w-full h-full bg-black -rotate-12 blur-3xl rounded-full"></div>
                </div>

                <div className="relative z-10 flex items-center gap-6">
                   <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-[#0a0a0a]">
                      <User className="w-10 h-10 md:w-12 md:h-12 text-[#0a0a0a]" />
                   </div>
                   <div className="mb-2">
                      <h2 className="text-xl md:text-3xl font-serif text-[#0a0a0a] leading-none mb-1">{selectedBuyerForDetails.name}</h2>
                      <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-[#0a0a0a]/60">#{selectedBuyerForDetails.id.substring(0, 12)}</p>
                   </div>
                </div>
              </div>

              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Personal Information */}
                <div>
                   <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-[#d4af37] mb-5 flex items-center gap-2">
                     <div className="w-4 h-[1px] bg-[#d4af37]/30"></div>
                     Dados Pessoais
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                         <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold ml-1">CPF</p>
                         <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                            <FileText className="w-4 h-4 text-[#d4af37] opacity-60" />
                            <span className="text-sm font-mono tracking-wider">{selectedBuyerForDetails.cpf}</span>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold ml-1">E-mail</p>
                         <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-4 overflow-hidden">
                            <Mail className="w-4 h-4 text-[#d4af37] opacity-60 shrink-0" />
                            <span className="text-sm truncate">{selectedBuyerForDetails.email}</span>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold ml-1">Contato</p>
                         <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                            <Smartphone className="w-4 h-4 text-[#d4af37] opacity-60" />
                            <span className="text-sm">{selectedBuyerForDetails.phone || '(Não informado)'}</span>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold ml-1">Status de Cadastro</p>
                         <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/10 rounded-2xl p-4">
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-[10px] uppercase font-black tracking-widest text-green-500">Verificado</span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Purchase Information */}
                <div>
                   <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-[#d4af37] mb-5 flex items-center gap-2">
                     <div className="w-4 h-[1px] bg-[#d4af37]/30"></div>
                     Dados da Compra
                   </h3>
                   <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                         <Ticket className="w-32 h-32 rotate-12" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-8 relative z-10">
                         <div>
                            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-2">Item Reservado</p>
                            <p className="text-xl md:text-2xl font-serif text-white leading-tight">{selectedBuyerForDetails.type}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-2">Valor Pago</p>
                            <p className="text-xl md:text-2xl font-serif text-[#d4af37]">R$ {selectedBuyerForDetails.value.toFixed(2)}</p>
                         </div>
                         <div>
                            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-2">Forma de Pagamento</p>
                            <div className="flex items-center gap-2">
                               <CreditCard className="w-4 h-4 opacity-50" />
                               <span className="text-[10px] uppercase tracking-widest font-bold">Cartão de Crédito</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-2">Data da Compra</p>
                            <p className="text-[10px] uppercase tracking-widest font-bold">24 de Abril, 2026</p>
                         </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${selectedBuyerForDetails.status === 'Pago' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <span className="text-[9px] uppercase tracking-[0.2em] font-black opacity-60">Status: {selectedBuyerForDetails.status}</span>
                         </div>
                         <button className="text-[9px] uppercase tracking-[0.2em] font-black text-[#d4af37] hover:underline flex items-center gap-2">
                           <Download className="w-3 h-3" /> Segunda Via Recibo
                         </button>
                      </div>
                   </div>
                </div>

                {/* Bottom Action */}
                <div className="flex gap-4">
                   <button 
                     onClick={() => setSelectedBuyerForDetails(null)}
                     className="flex-1 py-5 border border-white/10 rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] hover:bg-white/5 transition-all transition-colors"
                   >
                     Fechar Detalhes
                   </button>
                   {!selectedBuyerForDetails.checkedIn && (
                      <button 
                        onClick={() => {
                          handleCheckIn(selectedBuyerForDetails.id);
                          setSelectedBuyerForDetails(null);
                        }}
                        className="flex-1 py-5 bg-[#d4af37] text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-110 shadow-lg shadow-[#d4af374d] transition-all"
                      >
                        Confirmar Check-in
                      </button>
                   )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Restored / Conflict Notification - FIX: Auto-dismiss and proper cleanup */}
      <AnimatePresence>
        {(sessionRestored || sessionConflict.length > 0) && (
          <SessionRestoredNotification 
            isVisible={sessionRestored || sessionConflict.length > 0}
            sessionConflict={sessionConflict}
            onClose={() => {
              setSessionRestored(false);
              setSessionConflict([]);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
