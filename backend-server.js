const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/firmware', express.static(path.join(__dirname, 'firmware')));

// Blockchain connection setup
let provider;
let contract;
let contractAddress;

// Load deployment info and initialize contract
function initializeContract() {
  try {
    if (CONTRACT_ADDRESS) {
      contractAddress = CONTRACT_ADDRESS;
    } else {
      const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info.json', 'utf8'));
      contractAddress = deploymentInfo.contractAddress;
    }

    // Connect to configured RPC node (local or hosted)
    provider = new ethers.JsonRpcProvider(RPC_URL);

    // Load contract ABI
    const contractArtifact = require('./artifacts/contracts/FirmwareRegistry.sol/FirmwareRegistry.json');
    contract = new ethers.Contract(contractAddress, contractArtifact.abi, provider);

    console.log(`Connected to contract at: ${contractAddress}`);
    console.log(`Using RPC URL: ${RPC_URL}`);
  } catch (error) {
    console.error('Failed to initialize contract:', error.message);
    console.log('Set CONTRACT_ADDRESS and RPC_URL env vars for cloud deployment, or deploy locally with: npm run deploy');
  }
}

// Initialize on startup
initializeContract();

async function getAllPublishedFirmwareEvents() {
  if (!contract) {
    throw new Error('Contract not initialized');
  }

  const filter = contract.filters.FirmwarePublished();
  const events = await contract.queryFilter(filter, 0, 'latest');

  return events.map((event) => {
    const args = event.args;
    return {
      deviceModel: args[0],
      version: args[1],
      firmwareHash: args[2],
      publisher: args[3],
      timestamp: Number(args[4]),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    };
  });
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    contractAddress: contractAddress || 'Not deployed',
    rpcUrl: RPC_URL,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get all published firmware records by scanning historical events
 */
app.get('/api/firmware', async (req, res) => {
  try {
    if (!contract) {
      return res.status(503).json({ error: 'Contract not initialized' });
    }

    const firmware = await getAllPublishedFirmwareEvents();
    firmware.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      total: firmware.length,
      records: firmware
    });
  } catch (error) {
    console.error('Error fetching firmware list:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get firmware record from blockchain
 */
app.get('/api/firmware/:deviceModel/:version', async (req, res) => {
  try {
    const { deviceModel, version } = req.params;

    if (!contract) {
      return res.status(503).json({ error: 'Contract not initialized' });
    }

    const record = await contract.getFirmwareRecord(deviceModel, version);

    if (!record[3]) { // exists flag
      return res.status(404).json({ error: 'Firmware record not found' });
    }

    res.json({
      deviceModel: deviceModel,
      version: version,
      firmwareHash: record[0],
      timestamp: Number(record[1]),
      publisher: record[2],
      exists: record[3]
    });
  } catch (error) {
    console.error('Error fetching firmware record:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify firmware hash
 */
app.post('/api/verify', async (req, res) => {
  try {
    const { deviceModel, version, firmwareHash } = req.body;

    if (!deviceModel || !firmwareHash) {
      return res.status(400).json({ error: 'Missing required fields: deviceModel, firmwareHash (version is optional)' });
    }

    if (!contract) {
      return res.status(503).json({ error: 'Contract not initialized' });
    }

    const providedHash = firmwareHash.startsWith('0x') ? firmwareHash : `0x${firmwareHash}`;

    // First preference: exact model+version check (if version was provided)
    if (version) {
      const record = await contract.getFirmwareRecord(deviceModel, version);

      if (record[3]) {
        const storedHash = record[0];
        const isValid = storedHash.toLowerCase() === providedHash.toLowerCase();

        return res.json({
          valid: isValid,
          matchType: 'EXACT_VERSION',
          deviceModel,
          version,
          storedHash,
          providedHash,
          timestamp: Number(record[1]),
          publisher: record[2]
        });
      }
    }

    // Fallback: historical scan across all publish transactions
    const allPublished = await getAllPublishedFirmwareEvents();
    const deviceHistory = allPublished.filter((item) => item.deviceModel === deviceModel);

    if (deviceHistory.length === 0) {
      return res.status(404).json({
        valid: false,
        error: 'Firmware record not found',
        reason: 'NO_RECORD',
        checkedHistory: true
      });
    }

    const hashMatch = deviceHistory.find(
      (item) => item.firmwareHash.toLowerCase() === providedHash.toLowerCase()
    );

    if (hashMatch) {
      return res.json({
        valid: true,
        matchType: 'HISTORICAL_HASH',
        checkedHistory: true,
        deviceModel: hashMatch.deviceModel,
        version: hashMatch.version,
        storedHash: hashMatch.firmwareHash,
        providedHash,
        timestamp: hashMatch.timestamp,
        publisher: hashMatch.publisher,
        blockNumber: hashMatch.blockNumber,
        transactionHash: hashMatch.transactionHash
      });
    }

    // Device exists in history, but hash does not match any published version
    const latest = deviceHistory.sort((a, b) => b.timestamp - a.timestamp)[0];

    return res.json({
      valid: false,
      matchType: 'HISTORICAL_MISMATCH',
      checkedHistory: true,
      deviceModel,
      version: version || latest.version,
      storedHash: latest.firmwareHash,
      providedHash,
      timestamp: latest.timestamp,
      publisher: latest.publisher
    });
  } catch (error) {
    console.error('Error verifying firmware:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * OTA metadata endpoint for ESP32
 */
app.get('/api/ota/:deviceModel', async (req, res) => {
  try {
    const { deviceModel } = req.params;
    const currentVersion = req.query.version || 'latest';

    if (!contract) {
      return res.status(503).json({ error: 'Contract not initialized' });
    }

    const allPublished = await getAllPublishedFirmwareEvents();
    const deviceRecords = allPublished
      .filter((record) => record.deviceModel === deviceModel)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (deviceRecords.length === 0) {
      return res.status(404).json({
        error: 'No firmware published for this device model',
        deviceModel,
        updateAvailable: false
      });
    }

    const latest = deviceRecords[0];
    const updateAvailable = currentVersion !== latest.version;
    const host = req.get('host');
    const protocol = req.protocol || 'http';
    const firmwareUrl = `${protocol}://${host}/firmware/${encodeURIComponent(deviceModel)}/${encodeURIComponent(latest.version)}/firmware.bin`;

    res.json({
      deviceModel,
      currentVersion,
      version: latest.version,
      firmwareHash: latest.firmwareHash,
      firmwareUrl,
      firmwareSize: 0,
      updateAvailable,
      publishedAt: latest.timestamp,
      transactionHash: latest.transactionHash
    });
  } catch (error) {
    console.error('Error fetching OTA metadata:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  const interfaces = os.networkInterfaces();
  const lanIps = Object.values(interfaces)
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);

  console.log(`Backend server running on http://${HOST}:${PORT}`);
  if (lanIps.length > 0) {
    console.log(`LAN access URLs: ${lanIps.map((ip) => `http://${ip}:${PORT}`).join(', ')}`);
  }
  console.log(`Contract address: ${contractAddress || 'Not deployed'}`);
});

module.exports = app;
