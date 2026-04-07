const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Deploying FirmwareRegistry contract...");

  const FirmwareRegistry = await hre.ethers.getContractFactory("FirmwareRegistry");
  const firmwareRegistry = await FirmwareRegistry.deploy();

  await firmwareRegistry.waitForDeployment();

  const address = await firmwareRegistry.getAddress();
  console.log(`FirmwareRegistry deployed to: ${address}`);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: address,
    network: hre.network.name,
    deployer: (await hre.ethers.getSigners())[0].address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    './deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Keep frontend deployment metadata and ABI in sync
  const uiPublicDir = path.join(__dirname, '../web-ui/public');
  if (fs.existsSync(uiPublicDir)) {
    fs.writeFileSync(
      path.join(uiPublicDir, 'deployment-info.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );

    const artifactPath = path.join(__dirname, '../artifacts/contracts/FirmwareRegistry.sol/FirmwareRegistry.json');
    if (fs.existsSync(artifactPath)) {
      fs.copyFileSync(artifactPath, path.join(uiPublicDir, 'FirmwareRegistry.json'));
    }

    console.log('Synced deployment-info.json and FirmwareRegistry.json to web-ui/public');
  }

  console.log("Deployment info saved to deployment-info.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
