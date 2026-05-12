# Setup Guide

## Prerequisites

Install these before starting:

1. **Docker Desktop** — https://www.docker.com/products/docker-desktop/
2. **Node.js 20+** — https://nodejs.org/
3. **ngrok** — https://ngrok.com/download (sign up for a free account)

## Step 1: Install frontend dependencies

```
cd client
npm install
cd ..
```

## Step 2: Start the backend

Make sure Docker Desktop is running, then:

```
docker compose up --build
```

Wait until you see both servers logging "Server running on port 3000".

## Step 3: Start the frontend

Open a second terminal in the project folder:

```
cd client
npm run dev
```

Wait for Vite to show the https://localhost:5173 URL.

## Step 4: Access locally

Open https://localhost:5173 in your browser.

## Step 5: Expose to the internet (ngrok)

Open a third terminal and run:

```
ngrok config add-authtoken YOUR_TOKEN_HERE
ngrok http https://localhost:5173
```

Replace YOUR_TOKEN_HERE with your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken

Share the ngrok URL (e.g. https://something.ngrok-free.app) with anyone who needs access.

## What's running

| Terminal | Command                        | What it does                                          |
|----------|--------------------------------|-------------------------------------------------------|
| 1        | docker compose up --build      | Backend: PostgreSQL, Redis, 2 Node.js servers, Nginx  |
| 2        | npm run dev (in client/)       | Frontend: Vite dev server on https://localhost:5173    |
| 3        | ngrok http https://localhost:5173 | Tunnel: public URL pointing to your laptop         |

## Notes

- First visitor to the ngrok link sees a warning page — click "Visit Site" once.
- The ngrok URL changes every time you restart it. No code changes needed, just share the new URL.
- Free ngrok sessions last about 2 hours.
- Frontend changes hot-reload instantly. Backend changes require `docker compose up --build`.
- The database persists between restarts. To reset it, run `docker compose down -v` then start again.
