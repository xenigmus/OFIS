const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info.json', 'utf8'));
  const contractAddress = deploymentInfo.contractAddress;
  
  const artifact = require('./artifacts/contracts/FirmwareRegistry.sol/FirmwareRegistry.json');
  const provider = new hre.ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const contract = new hre.ethers.Contract(contractAddress, artifact.abi, provider);
  
  console.log("Contract Address:", contractAddress);
  console.log("\nQuerying FirmwarePublished events...\n");
  
  try {
    const filter = contract.filters.FirmwarePublished();
    const events = await contract.queryFilter(filter);
    
    console.log(`Found ${events.length} FirmwarePublished events:`);
    console.log("");
    
    events.forEach((event, index) => {
      const args = event.args;
      console.log(`Event ${index + 1}:`);
      console.log(`  Device Model: ${args[0]}`);
      console.log(`  Version: ${args[1]}`);
      console.log(`  Hash: ${args[2]}`);
      console.log(`  Publisher: ${args[3]}`);
      console.log(`  Timestamp: ${args[4].toString()}`);
      console.log(`  Block: ${event.blockNumber}`);
      console.log("");
    });
    
    if (events.length === 0) {
      console.log("No events found!");
    }
    
  } catch (error) {
    console.error("Error querying events:", error.message);
  }
}

main().catch(console.error);
