const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentInfo = JSON.parse(fs.readFileSync('./deployment-info.json', 'utf8'));
  const contractAddress = deploymentInfo.contractAddress;
  
  const artifactPath = path.join(__dirname, '../artifacts/contracts/FirmwareRegistry.sol/FirmwareRegistry.json');
  const artifact = require(artifactPath);
  const provider = new hre.ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const contract = new hre.ethers.Contract(contractAddress, artifact.abi, provider);
  
  console.log("Contract Address:", contractAddress);
  console.log("\nQuerying FirmwarePublished events...\n");
  
  try {
    const filter = contract.filters.FirmwarePublished();
    // Query across the whole chain (from block 0) to ensure events are returned
    const events = await contract.queryFilter(filter, 0, 'latest');
    
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
      console.log("No events found via contract.queryFilter. Falling back to provider.getLogs to inspect raw logs...");

      // Fallback: use the interface to parse logs and compute the event topic by signature
      const iface = new hre.ethers.Interface(artifact.abi);
      const signature = 'FirmwarePublished(string,string,bytes32,address,uint256)';
      // Compute the topic using keccak256 of the event signature (works across ethers versions)
      const topic = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(signature));

      const logs = await provider.getLogs({
        address: contractAddress,
        fromBlock: 0,
        toBlock: 'latest',
        topics: [topic]
      });

      console.log(`Found ${logs.length} raw logs for FirmwarePublished (provider.getLogs).`);

      if (logs.length > 0) {
        logs.forEach((log, i) => {
          const parsed = iface.parseLog(log);
          const args = parsed.args;
          console.log(`Raw Event ${i + 1}:`);
          console.log(`  Device Model: ${args[0]}`);
          console.log(`  Version: ${args[1]}`);
          console.log(`  Hash: ${args[2]}`);
          console.log(`  Publisher: ${args[3]}`);
          console.log(`  Timestamp: ${args[4].toString()}`);
          console.log(`  Block: ${log.blockNumber}`);
          console.log('');
        });
      } else {
        console.log('No raw logs found either.');
      }
    }
    
  } catch (error) {
    console.error("Error querying events:", error.message);
  }
}

main().catch(console.error);
