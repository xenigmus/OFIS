# OT Firmware Integrity System

A blockchain-backed firmware verification framework for IoT/OT devices that ensures authenticity, integrity, and trust across firmware distribution pipelines.

## Key Features

- Tamper-proof firmware validation using SHA-256 hashing
- On-chain firmware registry via Solidity smart contracts
- REST API backend for publishing and verification workflows
- Web dashboard for managing firmware records
- Reproducible dev environments with Nix support

## Architecture

```text
Firmware Build -> SHA-256 Hashing -> Backend API (Node/Express) -> Smart Contract (Blockchain)
```

Smart Contract: Solidity  
Backend API: Node.js + Express  
Frontend: React  
Blockchain: Local (Hardhat) / Sepolia

## Quick Start

```bash
# 1) Install dependencies
npm install --legacy-peer-deps
cd web-ui && npm install --legacy-peer-deps && cd ..

# 2) Start local chain (Terminal 1)
npm run node

# 3) Deploy contract (Terminal 2)
npm run compile
npm run deploy

# 4) Start backend (Terminal 2)
npm run backend

# 5) Start web UI (Terminal 3)
cd web-ui
npm start
```

Backend health:

```bash
curl -s http://localhost:3001/api/health
```

## Nix Setup

This repo includes `shell.nix` and `flake.nix` for reproducible dev shells.

```bash
# Option A
nix-shell

# Option B
nix develop
```

## Sepolia + Render Deploy Guide

1. Create `.env` from template:

```bash
cp .env.sepolia.example .env
```

2. Fill `.env` with:
      - `SEPOLIA_RPC_URL`
      - `PRIVATE_KEY`

3. Deploy contract:

```bash
npm run deploy:sepolia
```

4. Confirm `deployment-info.json` contains your deployed Sepolia address.
      - This backend version reads contract address directly from `deployment-info.json`.

5. Push this `github-release` repo to GitHub.

6. On **Render** create a **Web Service**:
      - Runtime: **Node**
      - Root directory: `github-release`
      - Build command:

```bash
npm install --legacy-peer-deps && npm run compile
```

      - Start command:

```bash
npm start
```

7. Add Render environment variables:
      - `HOST=0.0.0.0`
      - `PORT=10000` (or default platform value)
      - `RPC_URL=<your_sepolia_rpc_url>`

      Do **not** set `CONTRACT_ADDRESS` for this version.

8. Deploy and test:

```bash
curl -s https://<your-render-service>.onrender.com/api/health
```

Expected: `status: "ok"` and your Sepolia `contractAddress`.

9. Update ESP32 `secrets.h`:

```cpp
#define BACKEND_BASE_URL "https://<your-render-service>.onrender.com"
```

## Troubleshooting

- Dependency conflicts:

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

- Port 8545 busy:

```bash
lsof -ti:8545 | xargs kill -9
```

- ESP transport error:
  - Ensure `BACKEND_BASE_URL` uses current host IP/domain.
  - If using hotspot/router, disable client/AP isolation.

## Roadmap

- Firmware signing (ECDSA / Ed25519)
- OTA update pipeline integration
- Multi-chain support
- Device identity + attestation
- CI/CD firmware verification hooks

## Contributing

Contributions are welcome. Please:

- Fork the repository
- Create a feature branch
- Submit a pull request

## License

MIT (see `LICENSE`).
