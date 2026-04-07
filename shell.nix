{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "ot-firmware-integrity-dev";
  
  buildInputs = with pkgs; [
    # Node.js and package managers
    nodejs_20
    nodePackages.npm
    nodePackages.yarn
    
    # Python for node-gyp native builds
    python3
    
    # Build tools
    gcc
    gnumake
    pkg-config
    
    # Git for version control
    git
    
    # Additional utilities
    curl
    wget
    jq
    
    # Optional: Arduino IDE for ESP32 development
    # arduino
    
    # Optional: VS Code or other editors
    # vscode
  ];

  shellHook = ''
    echo "OT Firmware Integrity System - Development Environment"
    echo "=================================================="
    echo ""
    echo "Node.js version: $(node --version)"
    echo "npm version: $(npm --version)"
    echo ""
    echo "Quick Setup:"
    echo "  1. npm install --legacy-peer-deps"
    echo "  2. cd web-ui && npm install --legacy-peer-deps && cd .."
    echo "  3. npm run node          # Terminal 1"
    echo "  4. npm run deploy        # Terminal 2"
    echo "  5. npm run backend       # Terminal 2"
    echo "  6. cd web-ui && npm start  # Terminal 3"
    echo ""
    echo "Documentation:"
    echo "  - README.md for overview"
    echo "  - QUICKSTART.md for 10-minute setup"
    echo "  - INSTALLATION_GUIDE.md for troubleshooting"
    echo ""
    echo "Troubleshooting:"
    echo "  - Use --legacy-peer-deps flag for all npm commands"
    echo "  - Port 8545 must be free for Hardhat blockchain"
    echo "  - MetaMask: Chain ID 1337, RPC http://127.0.0.1:8545"
    echo ""
    echo "=================================================="
    echo ""
    
    # Set npm to use legacy peer deps by default for this shell
    export NPM_CONFIG_LEGACY_PEER_DEPS=true
    
    # Increase Node.js memory limit for compilation
    export NODE_OPTIONS="--max-old-space-size=4096"
    
    # Set Python for node-gyp
    export PYTHON="${pkgs.python3}/bin/python3"
    
    # Add node_modules/.bin to PATH for local binaries
    export PATH="$PWD/node_modules/.bin:$PATH"
    
    # Create .nvmrc equivalent indicator
    echo "20" > .node-version
  '';

  # Environment variables
  NIX_ENFORCE_PURITY = 0;  # Allow network access for npm install
}
