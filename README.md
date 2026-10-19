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

Același Compose pornește și panoul Next.js la `http://localhost:3001`.
Setează un `JWT_SECRET` sigur în `.env`; imaginea API rulează în modul production și respinge valoarea demonstrativă.

`GET /api/app-version` returns the public Android and iOS update settings from
`APP_LATEST_VERSION_*`, `APP_MINIMUM_VERSION_*`, and `APP_UPDATE_URL_*` in the
backend environment. Empty values disable prompts. The Flutter app uses these
settings to show an optional or required update dialog.

MongoDB is external and configured through `MONGODB_URI` in `.env`. The Compose file starts the API and admin panel; the API becomes healthy only after it connects to MongoDB. Check with `docker compose ps` and `GET /api/health`.

## Run locally

Start MongoDB first, then:

```bash
cd backend
copy .env.example .env
npm install
npm run start:dev
```

The default local URL is `http://localhost:3000/api`.

## PINLEND legal documents

`GET /api/legal/documents?lang=ro` (or `lang=en`) serves the four versioned
PINLEND documents. `GET /api/legal/status` and `POST /api/legal/accept` require
a bearer token. The accept request contains the exact `id`, `version`, and
`hash` values returned by the documents endpoint. MongoDB stores one
timestamped acceptance per user and document version; old records remain when
a document changes. The mobile app asks users to read and accept the current
documents after sign-in and shows accepted dates in the profile.

The text in `src/legal/legal-documents.ts` is an adapted draft. Updating text in
either language changes its hash and requires fresh acceptance. The legal
drafts need review before publication.

## Paid viewings and alternative times

A viewing request is unpaid until the owner accepts it. The owner can accept,
reject, or propose another date and time. A proposal stays open for at most 24
hours and closes one hour before the proposed time. The visitor can accept or
decline it. Accepting a paid viewing moves it to `awaiting_payment`; payment and
both identity checks happen afterward.
The existing push service notifies the other participant when a request,
proposal, decision, or cancellation is saved. Opening a viewing notification
takes the user to the listing. The listing also refreshes its viewings when the
app returns to the foreground.

Rejecting an unpaid request needs no refund. If the owner cancels after a
successful viewing payment, the full charge, including the service fee, is
refunded to the original payment method. The existing Stripe refund webhook
updates the refund status shown in the app. A refund in progress is marked
`refund_pending` for retry by the reconciliation job if the initial Stripe
request fails.

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
