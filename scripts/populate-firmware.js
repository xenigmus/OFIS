const hre = require("hardhat");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info.json', 'utf8'));
  const contractAddress = deploymentInfo.contractAddress;
  
  const artifactPath = path.join(__dirname, '../artifacts/contracts/FirmwareRegistry.sol/FirmwareRegistry.json');
  const artifact = require(artifactPath);
  const contract = new hre.ethers.Contract(contractAddress, artifact.abi, signer);
  
  console.log("Publishing test firmware...\n");
  
  // Test firmware entries
  const testFirmware = [
    { device: "ESP32-DevKit", version: "1.0.0", data: "ESP32 Firmware v1.0.0" },
    { device: "ESP32-S3", version: "2.1.0", data: "ESP32-S3 Firmware v2.1.0" },
    { device: "esptest", version: "1.0.0", data: "ESP Test Firmware v1.0.0" }
  ];
  
  for (const fw of testFirmware) {
    const hash = "0x" + crypto.createHash('sha256').update(fw.data).digest('hex');
    
    console.log(`Publishing: ${fw.device} v${fw.version}`);
    console.log(`  Hash: ${hash}`);
    
    try {
      const tx = await contract.publishFirmware(fw.device, fw.version, hash);
      const receipt = await tx.wait();
      console.log(`  ✓ Block: ${receipt.blockNumber}`);
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
    }
    console.log("");
  }
}

main().catch(console.error);
