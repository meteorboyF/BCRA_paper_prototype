# PangoChain — Local Development Setup Guide

Follow these steps **in order** after cloning the repository. The whole process takes about 10–15 minutes on a fresh machine.

---

## Prerequisites

### Clickable teammate setup

For a fresh teammate machine, use the click-to-run setup helper first:

- **Windows:** double-click `SETUP_WINDOWS.bat`.
- **macOS:** double-click `SETUP_MAC.command`.

These helpers install/check Java, Node.js, Docker tooling, frontend packages, and Docker images where possible. Docker Desktop still has to be opened manually the first time on both Windows and macOS. See `TEAMMATE_SETUP.md` for the short teammate-facing instructions.

Install these tools before starting. Tick each one off as you go.

| Tool | Version | Download |
|------|---------|----------|
| **Git** | Any recent | https://git-scm.com |
| **Java JDK** | 20 or 21 | https://adoptium.net (choose **Temurin 21 LTS** or **20**) |
| **Node.js** | 18 or 20 (LTS) | https://nodejs.org |
| **Docker Desktop** | Latest | https://www.docker.com/products/docker-desktop |

> **Windows tip:** After installing Java, make sure `JAVA_HOME` is set. Open a new terminal and run `java -version` — you should see version 20 or 21.

---

## Step 1 — Clone the Repo

```bash
git clone <your-repo-url>
cd Pangochain_AOOP
```

---

## Step 2 — Start the Database & IPFS (Docker)

### One-terminal startup (recommended)

From the repository root, run:

```bash
bash scripts/dev.sh
```

This starts PostgreSQL, both IPFS nodes, the Fabric network/chaincode when needed, the Spring Boot
backend, and the Vite frontend. It also follows the backend/frontend logs in the same terminal.
Press `Ctrl+C` to stop watching logs; the services keep running in the background.

Useful follow-up commands:

```bash
bash scripts/dev.sh status    # show tracked PIDs and ports
bash scripts/dev.sh logs      # follow backend/frontend logs again
bash scripts/dev.sh restart   # restart backend/frontend cleanly
bash scripts/dev.sh stop      # stop backend/frontend started by the script
```

The script fixes the common stale-PID annoyance: if a saved backend/frontend PID no longer exists,
it removes the stale PID file; if the backend is already healthy on port 8080, it reuses it instead
of trying to launch a duplicate process.

To skip Fabric for a lightweight DB/IPFS-only development run:

```bash
PANGOCHAIN_WITH_FABRIC=0 bash scripts/dev.sh
```

### Manual startup

This starts PostgreSQL (port 5432) and IPFS (port 5001). You need Docker Desktop running first.

```bash
docker compose up postgres ipfs -d
```

If your Docker installation only has the legacy Compose binary, use `docker-compose` in place of
`docker compose`.

Wait about 15 seconds, then verify both containers are healthy:

```bash
docker compose ps
```

You should see `(healthy)` next to both `pangochain-postgres` and `pangochain-ipfs`.

> **Troubleshooting:** If Docker says "port already in use", stop any existing PostgreSQL or IPFS services on your machine.

---

## Step 3 — Start the Backend (Spring Boot)

Open a **new terminal window** and run:

**Windows:**
```cmd
cd pangochain-backend
mvnw.cmd spring-boot:run
```

**Mac / Linux:**
```bash
cd pangochain-backend
chmod +x mvnw
./mvnw spring-boot:run
```

The first run downloads Maven dependencies (~2 minutes). On subsequent runs it starts in ~10 seconds.

**The backend is ready when you see:**
```
Started PangochainApplication in X.XXX seconds
```

It runs on **http://localhost:8080**

> **What happens on first start:** Liquibase runs database migrations automatically and a DataSeeder seeds demo users, cases, and documents. You do NOT need to run any SQL manually.

---

## Step 4 — Start the Frontend (React / Vite)

Open **another new terminal window** and run:

```bash
cd pangochain-frontend
npm install
npm run dev
```

The frontend is ready when you see:
```
  ➜  Local:   http://localhost:3000/
```

---

## Step 5 — Open the App

Go to **http://localhost:3000** in your browser.

---

## Demo Accounts (Seeded Automatically)

| Role | Email | Password |
|------|-------|----------|
| Managing Partner (Admin) | `admin@pangolawfirm.com` | `Admin123!` |
| Senior Associate (Lawyer) | `lawyer@pangolawfirm.com` | `Lawyer123!` |
| Paralegal | `paralegal@pangolawfirm.com` | `Paralegal123!` |
| Primary Client | `client@demo.com` | `Client123!` |
| Secondary Client | `client2@demo.com` | `Client123!` |

---

## Stopping Everything

If you used the one-terminal launcher:

```bash
bash scripts/dev.sh stop
```

If you started services manually, stop the frontend and backend with `Ctrl+C` in each terminal.

To stop Docker containers:
```bash
docker compose down
```

To stop Docker **and wipe the database** (fresh start):
```bash
docker compose down -v
```

---

## Project Structure

```
Pangochain_AOOP/
├── docker-compose.yml          ← PostgreSQL + IPFS config
├── pangochain-backend/         ← Spring Boot 3.2 (Java 20)
│   ├── mvnw / mvnw.cmd         ← Maven wrapper (no Maven install needed)
│   ├── src/main/
│   │   ├── java/               ← Java source code
│   │   └── resources/
│   │       ├── application.yml ← Config (ports, DB, JWT settings)
│   │       └── db/changelog/   ← Liquibase SQL migrations
│   └── pom.xml
└── pangochain-frontend/        ← React 18 + Vite + Tailwind
    ├── src/
    │   ├── pages/              ← Page components
    │   ├── components/         ← Shared UI components
    │   ├── lib/api.ts          ← Axios API client
    │   └── store/authStore.ts  ← Zustand auth state
    └── vite.config.ts          ← Dev server + proxy to :8080
```

---

## How It Works (Architecture Overview)

```
Browser (localhost:3000)
    │
    │  /api/* requests → Vite proxy
    ▼
Spring Boot (localhost:8080)
    │
    ├── PostgreSQL (localhost:5432)   ← Users, cases, documents, audit logs
    └── IPFS (localhost:5001)         ← Encrypted document storage
```

- **Authentication:** JWT (15-min access token, 7-day refresh token)
- **Document encryption:** AES-256-GCM in the browser via WebCrypto API — the server never sees plaintext
- **Database migrations:** Managed by Liquibase (runs automatically on startup)
- **Blockchain:** Hyperledger Fabric integration is optional — disabled by default (`fabric.enabled=false`)

---

## Environment Variables (Optional Overrides)

The backend works with defaults. Override via environment variables if needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `pangochain` | Database name |
| `DB_USER` | `pangochain` | DB username |
| `DB_PASSWORD` | `pangochain_secret` | DB password |
| `JWT_SECRET` | *(built-in dev key)* | Must be 256+ bits in production |
| `FABRIC_ENABLED` | `false` | Set to `true` only if Fabric network is running |
| `IPFS_API_HOST` | `http://localhost` | IPFS API host |
| `IPFS_API_PORT` | `5001` | IPFS API port |

---

## Common Issues & Fixes

### ❌ `Port 8080 already in use`
First ask the one-terminal launcher what it knows:

```bash
bash scripts/dev.sh status
bash scripts/dev.sh stop
```

If the process was started outside the launcher, another backend instance is running. Kill it:
- **Windows:** `netstat -ano | findstr :8080` → note the PID → `taskkill /PID <pid> /F`
- **Mac/Linux:** `lsof -ti:8080 | xargs kill -9`

### ❌ `Port 5432 already in use`
A local PostgreSQL service is running. Either stop it or change the port in `docker-compose.yml`.

### ❌ Backend fails with `Failed to initialize pool`
Docker is not running, or the `postgres` container isn't healthy yet. Run:
```bash
docker compose up postgres ipfs -d
docker compose ps   # wait until both show "(healthy)"
```
Then restart the backend.

### ❌ `JAVA_HOME is not set`
Set it to your JDK directory. On Windows, find it with:
```cmd
where java
```
Then set `JAVA_HOME` to the JDK folder (without `\bin`).

### ❌ Frontend shows "An unexpected error occurred" on Cases / Documents / Messages
Make sure the **backend is running** on port 8080 and you are logged in with one of the demo accounts above. The Vite dev server proxies all `/api` calls to the backend.

### ❌ `mvnw: Permission denied` (Mac/Linux only)
```bash
chmod +x pangochain-backend/mvnw
```

---

## Database GUI (Optional)

To browse the PostgreSQL database visually, install **pgAdmin 4** (free):  
https://www.pgadmin.org/download/

Connection settings:
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `pangochain`
- **Username:** `pangochain`
- **Password:** `pangochain_secret`

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| Backend | Spring Boot 3.2.5, Java 20, Spring Security, Spring Data JPA |
| Database | PostgreSQL 16 (via Docker) |
| Migrations | Liquibase |
| Storage | IPFS / Kubo (via Docker) |
| Auth | JWT (HS512), PBKDF2 password hashing |
| Encryption | WebCrypto API (AES-256-GCM, ECDH P-256) |
| Blockchain | Hyperledger Fabric (optional, disabled by default) |
