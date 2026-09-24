# Lend Backend

NestJS API with MongoDB.

## Run with Docker

```bash
cd backend
docker compose up --build
```

API health check:

```bash
curl http://localhost:3000/api/health
```

MongoDB is exposed on `localhost:27017` and uses the `lend` database.

## Run locally

Start MongoDB first, then:

```bash
cd backend
copy .env.example .env
npm install
npm run start:dev
```

The default local URL is `http://localhost:3000/api`.

## Rental verification and payment holds

Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and
`STRIPE_WEBHOOK_SECRET` in `backend/.env`.

Configure the Stripe webhook at `/api/payments/webhook` for
`payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
`payment_intent.canceled`, `payment_intent.payment_failed`,
`charge.refunded`, `refund.updated`, and
`identity.verification_session.verified`.
The Identity status endpoint also checks Stripe directly when the user returns
from verification.

New card payments are authorized and held for up to 48 hours. The renter must
complete Stripe Identity (document and matching selfie) before
the owner receives the actionable request. The owner must do the same before
accepting. Acceptance captures the held amount; rejection or expiry cancels
the authorization. Previously captured orders are refunded on rejection.
Stripe test and live identity results are kept separate. Document images are
not stored in MongoDB.

For the in-app iOS and Android Identity sheet, enable **Native Mobile SDKs**
in Stripe Identity settings. The authenticated
`POST /api/payments/identity/native/start` endpoint returns the verification
session ID and a single-use ephemeral key; the app does not store this key.
Serve this endpoint over HTTPS outside local development.
The Flutter web and desktop builds use Stripe's hosted verification URL.
Install iOS pods on macOS after updating the project.
