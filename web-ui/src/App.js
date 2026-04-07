import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

function App() {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  
  // Publish form state
  const [deviceModel, setDeviceModel] = useState('');
  const [version, setVersion] = useState('');
  const [firmwareHash, setFirmwareHash] = useState('');
  const [publishResult, setPublishResult] = useState('');
  
  // Verify form state
  const [verifyDeviceModel, setVerifyDeviceModel] = useState('');
  const [verifyVersion, setVerifyVersion] = useState('');
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState('');
  
  // Firmware list and stats
  const [firmwareList, setFirmwareList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, devices: 0, lastPublished: null });
  
  // Hash calculator state
  const [calculatorFile, setCalculatorFile] = useState(null);
  const [calculatedHash, setCalculatedHash] = useState('');
  const [calculating, setCalculating] = useState(false);
  
  // Active tab
  const [activeTab, setActiveTab] = useState('publish');

  useEffect(() => {
    loadDeploymentInfo();
  }, []);

  useEffect(() => {
    if (contract) {
      fetchAllFirmware();
      setupEventListeners();
    }
  }, [contract]);

  useEffect(() => {
    // Load historical list from backend on initial page load (wallet not required)
    fetchAllFirmware();
  }, []);

  const loadDeploymentInfo = async () => {
    try {
      // Prefer backend-reported address to avoid stale frontend static files
      const healthResponse = await fetch('http://localhost:3001/api/health');
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        if (health.contractAddress && health.contractAddress !== 'Not deployed') {
          setContractAddress(health.contractAddress);
          return;
        }
      }

      // Fallback to static deployment-info.json served by frontend
      const response = await fetch('/deployment-info.json');
      const data = await response.json();
      setContractAddress(data.contractAddress);
    } catch (error) {
      console.error('Could not load deployment info:', error);
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!');
        return;
      }

      if (!contractAddress) {
        alert('[ERROR] Contract address not loaded. Make sure deployment-info.json is available.');
        return;
      }

      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      setAccount(accounts[0]);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const abiResponse = await fetch('/FirmwareRegistry.json');
      if (!abiResponse.ok) {
        throw new Error('Failed to load contract ABI');
      }
      const abi = await abiResponse.json();
      
      const firmwareContract = new ethers.Contract(
        contractAddress,
        abi.abi,
        signer
      );
      
      setContract(firmwareContract);
      alert('[SUCCESS] Wallet connected!');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('[ERROR] Failed to connect wallet: ' + error.message);
    }
  };

  const setupEventListeners = () => {
    if (!contract) return;
    
    contract.on('FirmwarePublished', (...args) => {
      console.log('New firmware published:', args);
      // Refresh list after a short delay to ensure block is confirmed
      setTimeout(() => fetchAllFirmware(), 1000);
    });
  };

  const fetchAllFirmware = async () => {
    setLoading(true);
    try {
      // Prefer backend historical endpoint (works without wallet and scans full chain history)
      const response = await fetch('http://localhost:3001/api/firmware');
      if (!response.ok) {
        throw new Error(`Backend list fetch failed: ${response.status}`);
      }

      const data = await response.json();
      const firmware = Array.isArray(data.records) ? data.records : [];

      setFirmwareList(firmware);
      updateStats(firmware);
    } catch (error) {
      console.error('Error fetching firmware from backend, trying direct contract query:', error);

      // Fallback: direct chain query via connected wallet contract
      try {
        if (!contract) {
          setFirmwareList([]);
          updateStats([]);
          setLoading(false);
          return;
        }

        const filter = contract.filters.FirmwarePublished();
        const events = await contract.queryFilter(filter, 0, 'latest');

        const firmware = events.map(event => {
          const args = event.args;
          return {
            deviceModel: typeof args[0] === 'string' ? args[0] : args.deviceModel,
            version: typeof args[1] === 'string' ? args[1] : args.version,
            firmwareHash: args[2],
            publisher: args[3],
            timestamp: Number(args[4])
          };
        });

        setFirmwareList(firmware);
        updateStats(firmware);
      } catch (fallbackError) {
        console.error('Fallback contract event query failed:', fallbackError);
        setFirmwareList([]);
        updateStats([]);
      }
    }
    setLoading(false);
  };

  const updateStats = (firmwareArray) => {
    const uniqueDevices = new Set(firmwareArray.map(f => f.deviceModel)).size;
    const lastPublished = firmwareArray.length > 0 
      ? new Date(Math.max(...firmwareArray.map(f => f.timestamp * 1000)))
      : null;
    
    setStats({
      total: firmwareArray.length,
      devices: uniqueDevices,
      lastPublished
    });
  };

  const publishFirmware = async (e) => {
    e.preventDefault();
    
    if (!contract) {
      alert('[ERROR] Please connect your wallet first');
      return;
    }

    try {
      setPublishResult('[PROCESSING] Publishing to blockchain...');
      
      // Sanitize hash: remove all whitespace
      const cleanHash = firmwareHash.replace(/\s/g, '').trim();
      const hashBytes = cleanHash.startsWith('0x') ? cleanHash : `0x${cleanHash}`;
      
      if (hashBytes.length !== 66) {
        throw new Error(`Invalid hash length: ${hashBytes.length} (expected 66)`);
      }
      
      const tx = await contract.publishFirmware(deviceModel, version, hashBytes);
      setPublishResult('[PENDING] Transaction submitted. Waiting for confirmation...');
      
      const receipt = await tx.wait();
      setPublishResult(`[SUCCESS] Published successfully!\n\nTransaction: ${receipt.hash}\nBlock: ${receipt.blockNumber}`);
      
      setDeviceModel('');
      setVersion('');
      setFirmwareHash('');
      
      setTimeout(() => fetchAllFirmware(), 2000);
    } catch (error) {
      console.error('Error publishing firmware:', error);
      setPublishResult(`[ERROR] ${error.message}`);
    }
  };

  const verifyFirmware = async (e) => {
    e.preventDefault();
    
    try {
      setVerifyResult('[PROCESSING] Verifying firmware integrity...');
      
      // Sanitize hash: remove all whitespace
      const cleanHash = verifyHash.replace(/\s/g, '').trim();
      
      const response = await fetch('http://localhost:3001/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceModel: verifyDeviceModel,
          version: verifyVersion,
          firmwareHash: cleanHash
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.valid) {
        const matchNote = data.matchType === 'HISTORICAL_HASH'
          ? '\n[MATCH] Found in previous published transaction history'
          : '';

        setVerifyResult(`[VERIFIED] Firmware integrity confirmed!${matchNote}

Device Model: ${data.deviceModel}
Version: ${data.version}
Hash: ${data.storedHash}
Publisher: ${data.publisher}
Published: ${new Date(data.timestamp * 1000).toLocaleString()}

[STATUS] SAFE TO INSTALL`);
      } else {
        const historyNote = data.checkedHistory ? '\n[HISTORY] Checked previous transactions for this device' : '';

        setVerifyResult(`[REJECTED] Firmware hash mismatch detected!${historyNote}

Expected: ${data.storedHash || 'NOT FOUND'}
Provided: ${data.providedHash}

[WARNING] DO NOT INSTALL THIS FIRMWARE
[STATUS] POTENTIAL SECURITY BREACH`);
      }
    } catch (error) {
      console.error('Error verifying firmware:', error);
      setVerifyResult(`[ERROR] Verification failed: ${error.message}`);
    }
  };

  const computeFileHash = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(`0x${hashHex}`);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (e, target) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (target === 'publish') {
      try {
        const hash = await computeFileHash(file);
        setFirmwareHash(hash);
      } catch (error) {
        console.error('Error computing hash:', error);
        alert('[ERROR] Failed to compute hash');
      }
    } else if (target === 'verify') {
      try {
        const hash = await computeFileHash(file);
        setVerifyHash(hash);
      } catch (error) {
        console.error('Error computing hash:', error);
        alert('[ERROR] Failed to compute hash');
      }
    }
  };

  const handleCalculatorUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setCalculatorFile(file);
    setCalculating(true);
    
    try {
      const hash = await computeFileHash(file);
      setCalculatedHash(hash);
    } catch (error) {
      console.error('Error computing hash:', error);
      alert('[ERROR] Failed to compute hash');
    }
    
    setCalculating(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('[SUCCESS] Copied to clipboard!');
  };

  const formatHash = (hash) => {
    if (!hash) return '';
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(38)}`;
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>OT FIRMWARE INTEGRITY SYSTEM</h1>
        <p>BLOCKCHAIN-BASED VERIFICATION PROTOCOL</p>
      </header>

      <div className="container">
        <section className="card">
          <h2>WALLET CONNECTION</h2>
          {account ? (
            <div className="wallet-info">
              <p>[CONNECTED] {formatAddress(account)}</p>
              <p>[CONTRACT] {formatAddress(contractAddress)}</p>
            </div>
          ) : (
            <button onClick={connectWallet} className="btn-primary">
              CONNECT METAMASK
            </button>
          )}
        </section>

        {contract && (
          <section className="card stats-card">
            <h2>SYSTEM STATISTICS</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total Firmware</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.devices}</div>
                <div className="stat-label">Device Models</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.lastPublished ? 'ACTIVE' : 'NONE'}</div>
                <div className="stat-label">Last Published</div>
              </div>
            </div>
          </section>
        )}

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'publish' ? 'active' : ''}`}
            onClick={() => setActiveTab('publish')}
          >
            PUBLISH
          </button>
          <button 
            className={`tab ${activeTab === 'verify' ? 'active' : ''}`}
            onClick={() => setActiveTab('verify')}
          >
            VERIFY
          </button>
          <button 
            className={`tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            FIRMWARE LIST
          </button>
          <button 
            className={`tab ${activeTab === 'calculator' ? 'active' : ''}`}
            onClick={() => setActiveTab('calculator')}
          >
            HASH CALCULATOR
          </button>
        </div>

        {activeTab === 'publish' && (
          <section className="card">
            <h2>PUBLISH FIRMWARE HASH</h2>
            <form onSubmit={publishFirmware}>
              <div className="form-group">
                <label>Device Model:</label>
                <input
                  type="text"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  placeholder="ESP32-DevKit"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Firmware Version:</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Firmware Hash (SHA256):</label>
                <input
                  type="text"
                  value={firmwareHash}
                  onChange={(e) => setFirmwareHash(e.target.value)}
                  placeholder="0x..."
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Upload Firmware File:</label>
                <input
                  type="file"
                  onChange={(e) => handleFileUpload(e, 'publish')}
                  accept=".bin,.hex,.elf"
                  className="file-input"
                />
                <small>Automatically computes SHA-256 hash</small>
              </div>
              
              <button type="submit" className="btn-primary" disabled={!account}>
                {account ? 'PUBLISH TO BLOCKCHAIN' : 'CONNECT WALLET FIRST'}
              </button>
            </form>
            
            {publishResult && (
              <div className="result-box">
                <pre>{publishResult}</pre>
              </div>
            )}
          </section>
        )}

        {activeTab === 'verify' && (
          <section className="card">
            <h2>VERIFY FIRMWARE INTEGRITY</h2>
            <form onSubmit={verifyFirmware}>
              <div className="form-group">
                <label>Device Model:</label>
                <input
                  type="text"
                  value={verifyDeviceModel}
                  onChange={(e) => setVerifyDeviceModel(e.target.value)}
                  placeholder="ESP32-DevKit"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Firmware Version:</label>
                <input
                  type="text"
                  value={verifyVersion}
                  onChange={(e) => setVerifyVersion(e.target.value)}
                  placeholder="1.0.0"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Firmware Hash:</label>
                <input
                  type="text"
                  value={verifyHash}
                  onChange={(e) => setVerifyHash(e.target.value)}
                  placeholder="0x..."
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Upload Firmware File:</label>
                <input
                  type="file"
                  onChange={(e) => handleFileUpload(e, 'verify')}
                  accept=".bin,.hex,.elf"
                  className="file-input"
                />
              </div>
              
              <button type="submit" className="btn-secondary">
                VERIFY FIRMWARE
              </button>
            </form>
            
            {verifyResult && (
              <div className="result-box">
                <pre>{verifyResult}</pre>
              </div>
            )}
          </section>
        )}

        {activeTab === 'list' && (
          <section className="card">
            <h2>PUBLISHED FIRMWARE RECORDS</h2>
            <button onClick={fetchAllFirmware} className="btn-refresh">
              REFRESH LIST
            </button>
            
            {loading ? (
              <p>[LOADING] Fetching firmware records...</p>
            ) : firmwareList.length === 0 ? (
              <div className="empty-state">
                <p>[EMPTY]</p>
                <p>No firmware records in database</p>
                <p>Publish your first firmware to initialize the registry</p>
              </div>
            ) : (
              <div className="firmware-table">
                <table>
                  <thead>
                    <tr>
                      <th>DEVICE MODEL</th>
                      <th>VERSION</th>
                      <th>HASH</th>
                      <th>PUBLISHER</th>
                      <th>PUBLISHED</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firmwareList.map((firmware, index) => (
                      <tr key={index}>
                        <td><strong>{firmware.deviceModel}</strong></td>
                        <td><span className="version-badge">{firmware.version}</span></td>
                        <td>
                          <code className="hash-display" title={firmware.firmwareHash}>
                            {formatHash(firmware.firmwareHash)}
                          </code>
                        </td>
                        <td>
                          <code>{formatAddress(firmware.publisher)}</code>
                        </td>
                        <td>{new Date(firmware.timestamp * 1000).toLocaleDateString()}</td>
                        <td>
                          <button 
                            onClick={() => copyToClipboard(firmware.firmwareHash)}
                            className="btn-small"
                          >
                            COPY
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'calculator' && (
          <section className="card">
            <h2>FIRMWARE HASH CALCULATOR</h2>
            <p>Upload firmware file to compute SHA-256 hash</p>
            
            <div className="calculator-section">
              <div className="form-group">
                <label>Select Firmware File:</label>
                <input
                  type="file"
                  onChange={handleCalculatorUpload}
                  className="file-input-large"
                />
              </div>
              
              {calculatorFile && (
                <div className="file-info">
                  <p><strong>FILE:</strong> {calculatorFile.name}</p>
                  <p><strong>SIZE:</strong> {(calculatorFile.size / 1024).toFixed(2)} KB</p>
                  <p><strong>TYPE:</strong> {calculatorFile.type || 'application/octet-stream'}</p>
                </div>
              )}
              
              {calculating && (
                <div className="calculating">
                  <div className="spinner"></div>
                  <p>[PROCESSING] Computing SHA-256 hash...</p>
                </div>
              )}
              
              {calculatedHash && !calculating && (
                <div className="hash-result">
                  <h3>[COMPUTED HASH]</h3>
                  <div className="hash-display-large">
                    <code>{calculatedHash}</code>
                    <button 
                      onClick={() => copyToClipboard(calculatedHash)}
                      className="btn-copy"
                    >
                      COPY
                    </button>
                  </div>
                  
                  <div className="hash-actions">
                    <button 
                      onClick={() => {
                        setFirmwareHash(calculatedHash);
                        setActiveTab('publish');
                      }}
                      className="btn-primary"
                    >
                      USE IN PUBLISH
                    </button>
                    <button 
                      onClick={() => {
                        setVerifyHash(calculatedHash);
                        setActiveTab('verify');
                      }}
                      className="btn-secondary"
                    >
                      USE IN VERIFY
                    </button>
                  </div>
                  
                  <div className="hash-visualization">
                    <h4>[VISUAL REPRESENTATION]</h4>
                    <div className="hash-grid">
                      {calculatedHash.substring(2).match(/.{2}/g).map((byte, i) => (
                        <div 
                          key={i} 
                          className="hash-byte"
                          style={{
                            backgroundColor: `hsl(${parseInt(byte, 16) * 1.4}, 80%, 50%)`
                          }}
                          title={`BYTE ${i}: 0x${byte}`}
                        >
                          {byte}
                        </div>
                      ))}
                    </div>
                    <small>[INFO] Each cell represents one byte of the hash</small>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="card info">
          <h2>SYSTEM INFORMATION</h2>
          <div className="info-grid">
            <div className="info-item">
              <h3>[1] PUBLISH</h3>
              <p>Vendor computes SHA256 hash and publishes to immutable blockchain ledger</p>
            </div>
            <div className="info-item">
              <h3>[2] STORAGE</h3>
              <p>Hash stored permanently with cryptographic timestamp and publisher signature</p>
            </div>
            <div className="info-item">
              <h3>[3] VERIFICATION</h3>
              <p>Devices verify firmware integrity before installation using blockchain records</p>
            </div>
            <div className="info-item">
              <h3>[4] AUDIT</h3>
              <p>Complete audit trail ensures traceability and non-repudiation</p>
            </div>
          </div>
        </section>
      </div>

      <footer>
        <p>OT FIRMWARE INTEGRITY SYSTEM</p>
        <p>POWERED BY ETHEREUM SMART CONTRACTS</p>
      </footer>
    </div>
  );
}

export default App;
