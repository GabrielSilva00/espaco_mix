# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Instruções de Idioma
- Responda sempre em português brasileiro.
- Use termos técnicos em inglês quando apropriado para programação.

## Project Overview

**Eventix** is a full-stack event ticketing platform built with React + Express, featuring:
- User registration and authentication via Firebase
- Event management and ticket sales
- Multiple payment methods (PIX, Credit/Debit Card, Boleto)
- Producer onboarding and KYC verification
- Admin dashboard for event management
- Security-first architecture with rate limiting and input validation

## Essential Commands

```bash
# Development
npm run dev           # Start Vite dev server (http://localhost:5173)
npm run dev:server   # Start Express backend (http://localhost:3000)

# Building
npm run build        # Build frontend for production
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # Type-check with TypeScript

# Database/Setup
npm run seed:admin   # Seed admin user (requires configured Firebase)
```

**Development Setup:** Run both servers in separate terminals:
```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

## Architecture

### Frontend (React + Vite)
- **Entry:** `src/main.tsx` → `src/App.tsx`
- **Styling:** Tailwind CSS with custom theme (src/index.css)
- **State Management:** Firebase Realtime Database + local component state
- **Key Components:**
  - `Home`: Landing page and main entry point
  - `ProducerOnboardingFlow`: Multi-step producer registration (KYC, Banking)
  - `ProducerDashboard`: Producer event management interface
  - `ApprovalQueue`: Admin interface for reviewing producer applications
  - `AdminSettings`: Admin configuration panel

### Backend (Express.js + Node.js)
- **Server:** `server.ts` - Single Express instance handling both API and frontend serving
- **Architecture:**
  - Security middleware (Helmet, CORS, Rate Limiting)
  - Firebase authentication verification
  - REST API endpoints for orders, payments, and user management
  - Vite dev server proxy in development; static files in production

### Database & Auth
- **Firebase:** Authentication, user data, and event storage
- **Firestore:** Planned for order persistence (currently logged but not persisted)
- **Auth Flow:** Firebase ID tokens validated server-side via Google's tokeninfo endpoint

### Payment Integration
- **Providers:** Stripe, Mercado Pago (with PIX support)
- **Current Status:** Mock implementation ready for gateway integration
- **Payment Methods:** PIX, Credit Card, Debit Card, Boleto
- **Note:** Set `PAYMENT_PROVIDER` env var to enable real payment processing

## API Routes

### Public Routes
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check with environment info |
| GET | `/api/privacy-policy` | LGPD privacy policy |
| POST | `/api/validate-cpf` | Validate Brazilian CPF (rate limited) |
| POST | `/api/users/register` | User registration with LGPD consent |

### Authenticated Routes (require Firebase ID token in `Authorization: Bearer <token>`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/orders` | Create order for event tickets |
| POST | `/api/create-payment-intent` | Initialize payment (PIX/Cards/Boleto) |
| GET | `/api/admin/settings` | Admin settings (role check required server-side) |
| POST | `/api/producer/rejection-email` | Queue rejection notification email |

## Environment Variables

### Firebase Configuration (VITE_ prefix = exposed to frontend)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_ID
```

### Server Configuration (backend only, .env)
```
NODE_ENV              # "development" or "production"
PORT                  # Default: 3000
APP_URL              # Required in production (for CORS)
PAYMENT_PROVIDER     # "mock" (dev) or "stripe"/"mercadopago" (production)
ALLOW_MOCK_PAYMENTS  # "true" to allow mock payments in production
GEMINI_API_KEY       # For Google GenAI integration
```

## Key Implementation Details

### Rate Limiting
- **Global:** 200 requests per 15 minutes
- **Auth:** 20 attempts per 15 minutes
- **Payments:** 10 attempts per 10 minutes

### CPF Validation
- Server-side validation checks digit verification algorithm
- Format: accepts only digits, strips formatting
- Required for user registration and payment processing

### Security Headers
- **Production:** CSP enabled with strict directives
- **Development:** CSP disabled for easier debugging
- CORS restricted to `APP_URL` in production; unrestricted in development

### Firebase Integration Notes
- ID token verification uses Google's tokeninfo endpoint (lightweight)
- TODO: Implement Firebase Admin SDK for production token verification
- Dev mode allows mock tokens when Firebase not configured
- Firestore integration commented out—requires Firebase Admin setup

### Payment Flow
1. Frontend calls `/api/create-payment-intent` with guest data
2. Server validates and returns provider-specific response
3. For PIX: returns QR code and copy-paste key
4. For Cards: returns Stripe/Mercado Pago client secret
5. Frontend handles UI rendering per payment method

## File Structure Highlights

```
espaco_mix/
├── server.ts              # Express backend + Vite dev proxy
├── vite.config.ts         # Frontend build config
├── src/
│   ├── main.tsx           # React app entry
│   ├── App.tsx            # Main component (routing logic)
│   ├── index.css          # Global Tailwind styles
│   └── components/        # React components
├── scripts/
│   └── seed-admin.ts      # Admin seeding script
├── dist/                  # Build output (production)
├── firestore.rules        # Firestore security rules (in progress)
└── firebase-blueprint.json # Firebase project config
```

## Common Development Tasks

### Adding a New API Endpoint
1. Add route handler in `server.ts` with appropriate middleware
2. Apply rate limiting if user-facing
3. Validate all inputs server-side
4. Log sensitive data redacted (mask emails, etc.)
5. Return proper HTTP status codes (201 for creation, 400 for validation, 401 for auth)

### Adding a New React Component
- Place in `src/components/`
- Use Tailwind classes for styling (no inline CSS)
- Handle Firebase auth state via `onAuthStateChanged`
- Call API endpoints with Bearer token in Authorization header

### Testing Payment Integration
- Set `NODE_ENV=development` and `PAYMENT_PROVIDER=mock`
- Mock implementation returns fake transaction IDs and URLs
- No real charges are made in mock mode

## Known Limitations & TODOs

1. **Firestore Persistence:** Orders are logged but not persisted to database
2. **Firebase Admin SDK:** Not installed; switch to server-side token verification when adding
3. **Real Payment Gateway:** Stripe/Mercado Pago integration stubbed; implement when providers configured
4. **Admin Role Verification:** Currently not enforced; requires Firestore user roles collection
5. **Rejection Email:** Queued but not sent; implement email service integration

## Troubleshooting

**CORS errors in development?**
- Ensure `npm run dev:server` runs before `npm run dev`
- Frontend should connect to `http://localhost:3000` (backend), not the Vite port

**Firebase token verification failing?**
- Check `VITE_FIREBASE_PROJECT_ID` is set in `.env`
- Dev mode without Firebase credentials defaults to mock auth (`dev-user`)

**Payment button disabled?**
- Verify `PAYMENT_PROVIDER` is not `disabled` in `.env`
- Check `ALLOW_MOCK_PAYMENTS=true` if using mock in production

**TypeScript errors?**
- Run `npm run lint` to see all type issues
- Check imports use correct paths (no relative path issues with aliases)
