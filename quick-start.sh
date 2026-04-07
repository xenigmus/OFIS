#!/bin/bash

# QUICK START SCRIPT - OT Firmware Integrity System

set -e

echo "=========================================="
echo "OT FIRMWARE INTEGRITY SYSTEM"
echo "Quick Start Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Project root
PROJECT_ROOT="/home/eni9ma/dev/oop/ot-firmware-integrity-system"

echo -e "${YELLOW}[STEP 1]${NC} Starting Hardhat Node..."
cd "$PROJECT_ROOT"
npx hardhat node > hardhat.log 2>&1 &
HARDHAT_PID=$!
echo -e "${GREEN}✓${NC} Hardhat node started (PID: $HARDHAT_PID)"
sleep 3

echo ""
echo -e "${YELLOW}[STEP 2]${NC} Checking if contract is deployed..."
if [ ! -f "$PROJECT_ROOT/deployment-info.json" ]; then
    echo "  Deploying contract..."
    npm run deploy > /dev/null 2>&1
    echo -e "${GREEN}✓${NC} Contract deployed"
else
    echo -e "${GREEN}✓${NC} Contract already deployed"
fi

echo ""
echo -e "${YELLOW}[STEP 3]${NC} Starting Backend Server..."
node "$PROJECT_ROOT/backend-server.js" > backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓${NC} Backend server started (PID: $BACKEND_PID)"
sleep 2

echo ""
echo -e "${YELLOW}[STEP 4]${NC} Starting Frontend..."
cd "$PROJECT_ROOT/web-ui"
BROWSER=none npm start > web-ui.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓${NC} Frontend started (PID: $FRONTEND_PID)"
sleep 5

echo ""
echo "=========================================="
echo -e "${GREEN}✓ SYSTEM READY${NC}"
echo "=========================================="
echo ""
echo "Services Running:"
echo -e "  ${GREEN}✓${NC} Hardhat Node:  http://localhost:8545"
echo -e "  ${GREEN}✓${NC} Backend API:   http://localhost:3001"
echo -e "  ${GREEN}✓${NC} Frontend UI:   http://localhost:3000"
echo ""
echo "Next Steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Click 'CONNECT METAMASK'"
echo "  3. Start publishing and verifying firmware!"
echo ""
echo "Process IDs (for cleanup):"
echo "  Hardhat:  $HARDHAT_PID"
echo "  Backend:  $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo "To stop all services:"
echo "  kill $HARDHAT_PID $BACKEND_PID $FRONTEND_PID"
echo ""
