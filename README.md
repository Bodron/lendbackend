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
