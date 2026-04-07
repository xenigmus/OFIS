{
  description = "OT Firmware Integrity & Blockchain Audit System";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          name = "ot-firmware-integrity-dev";
          
          buildInputs = with pkgs; [
            # Node.js ecosystem
            nodejs_20
            nodePackages.npm
            nodePackages.yarn
            
            # Python for node-gyp
            python3
            
            # Build essentials
            gcc
            gnumake
            pkg-config
            
            # Development tools
            git
            curl
            wget
            jq
            
            # Optional: Uncomment for ESP32 development
            # arduino
            # platformio
          ];

          shellHook = ''
            echo " OT Firmware Integrity System"
            echo "================================"
            echo ""
            echo "Environment Ready:"
            echo "  Node.js: $(node --version)"
            echo "  npm: $(npm --version)"
            echo "  Python: $(python3 --version | head -n1)"
            echo ""
            echo " Install Dependencies:"
            echo "  npm install --legacy-peer-deps"
            echo "  cd web-ui && npm install --legacy-peer-deps && cd .."
            echo ""
            echo " Start Development:"
            echo "  Terminal 1: npm run node"
            echo "  Terminal 2: npm run compile && npm run deploy && npm run backend"
            echo "  Terminal 3: cd web-ui && npm start"
            echo ""
            
            # Set environment variables
            export NPM_CONFIG_LEGACY_PEER_DEPS=true
            export NODE_OPTIONS="--max-old-space-size=4096"
            export PYTHON="${pkgs.python3}/bin/python3"
            export PATH="$PWD/node_modules/.bin:$PATH"
          '';

          NIX_ENFORCE_PURITY = 0;
        };
      }
    );
}
