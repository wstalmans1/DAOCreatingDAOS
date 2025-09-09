import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy();
  await myToken.waitForDeployment();

  const address = await myToken.getAddress();
  console.log("MyToken deployed to:", address);

  // Save contract address for frontend
  const fs = require('fs');
  const contractInfo = {
    address: address,
    abi: JSON.parse(myToken.interface.format('json') as string)
  };
  
  fs.writeFileSync(
    './src/contracts/MyToken.json',
    JSON.stringify(contractInfo, null, 2)
  );
  
  console.log("Contract ABI saved to src/contracts/MyToken.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
