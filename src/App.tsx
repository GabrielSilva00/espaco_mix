import React, { Suspense } from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './shared/components/Navbar';
import { Toast } from './shared/components/Toast';
import { ConsentBanner } from './shared/components/ConsentBanner';
import { Home } from './components/Home';
import { Footer } from './components/Footer';
import { BookingView } from './modules/booking/BookingView';
import { ReservationsView } from './modules/reservations/ReservationsView';
import { ContactView } from './modules/contact/ContactView';
import { AuthView } from './modules/auth/AuthView';
import { ProfileView } from './modules/profile/ProfileView';
import { PrivacySettingsView } from './modules/profile/PrivacySettingsView';
import { LegalView } from './modules/legal/LegalView';
import { InstallPrompt } from './components/InstallPrompt';
const CheckoutModal = React.lazy(() =>
  import('./modules/payment/CheckoutModal').then(m => ({ default: m.CheckoutModal }))
);

export function App() {
  const {
    currentView, consentData, role,
    setCurrentView, events, loadingEvents, setFormEvent,
  } = useApp();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans selection:bg-[#d4af37]/30">

      {/* Skip link — acessibilidade para navegação por teclado */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[9999] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-[#d4af37] focus-visible:text-black focus-visible:rounded-lg focus-visible:font-bold focus-visible:text-xs focus-visible:uppercase focus-visible:tracking-widest"
      >
        Pular para conteúdo principal
      </a>

      <Navbar />

      <div className="w-full flex flex-col">
        <main id="main-content" className="pt-16 md:pt-20 pb-24 px-0 md:px-0 flex-1">

          {currentView === 'home' && (
            <Home
              events={events}
              loading={loadingEvents}
              onEventClick={event => {
                setFormEvent({ ...event });
                setCurrentView('booking');
              }}
            />
          )}

          {currentView === 'booking' && <BookingView />}
          {currentView === 'reservations' && <ReservationsView />}
          {currentView === 'contact' && <ContactView />}
          {currentView === 'admin-login' && <AuthView />}
          {currentView === 'profile' && <ProfileView />}
          {currentView === 'profile-privacy' && <PrivacySettingsView />}
          {currentView === 'privacy' && <LegalView initialTab="privacy" />}
          {currentView === 'terms' && <LegalView initialTab="terms" />}

        </main>

        <Footer onNavigate={setCurrentView} showCookies={!!consentData} isAuthenticated={role} />
      </div>

      <ConsentBanner />

      <Suspense fallback={null}>
        <CheckoutModal />
      </Suspense>
      <Toast />
      <InstallPrompt />
    </div>
  );
}
