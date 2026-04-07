# OT Firmware Integrity System

Blockchain-backed firmware publish/verify system for IoT/OT devices with:

- Solidity smart contract registry
- Node/Express backend API
- React web UI
- ESP32 client library and demo

## Architecture

```text
Firmware Build -> SHA-256 Hash -> Backend API -> Blockchain
                                                                                                                  |
                                                                                                      ESP32 Verify / OTA
```

## Local Quick Start (non-Nix)

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

## Nix Setup (integrated guide)

This repo includes `shell.nix` and `flake.nix` for reproducible dev shells.

### Option A: Classic nix-shell

```bash
nix-shell
npm install --legacy-peer-deps
cd web-ui && npm install --legacy-peer-deps && cd ..
```

### Option B: Flakes (nix develop)

```bash
nix develop
npm install --legacy-peer-deps
cd web-ui && npm install --legacy-peer-deps && cd ..
```

### Option C: direnv (auto-load)

```bash
direnv allow
```

Then run the same start flow (`npm run node`, `npm run deploy`, `npm run backend`, `cd web-ui && npm start`).

## Sepolia + Free Backend Deploy

1. Create `.env` from template:

```bash
cp .env.sepolia.example .env
```

2. Fill:
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`

3. Deploy contract:

```bash
npm run deploy:sepolia
```

4. Set backend env vars on your host (Render/Railway):
- `RPC_URL`
- `CONTRACT_ADDRESS`
- `HOST=0.0.0.0`
- `PORT` (platform value)

5. Start command:

```bash
npm start
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

## License

MIT (see `LICENSE`).
