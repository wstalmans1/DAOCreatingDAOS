import hre from 'hardhat'
import fs from 'fs'
import path from 'path'

async function main() {
  const [walletClient] = await hre.viem.getWalletClients()
  console.log('Deployer:', walletClient.account.address)

  // Get the registry address from the existing deployment
  const deploymentFile = path.join('deployments', 'anvil', 'root.json')
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'))
  const registryAddr = deployment.registry as `0x${string}`

  console.log('Registry address:', registryAddr)

  // Try to deploy CircleFactory with higher gas limit
  try {
    const factory = await hre.viem.deployContract('CircleFactory', [registryAddr], {
      gas: 10000000n, // 10M gas limit
    })
    const factoryAddr = factory.address as `0x${string}`
    console.log('CircleFactory deployed:', factoryAddr)

    // Update the deployment file
    deployment.factory = factoryAddr
    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2))
    console.log('Updated deployment file with factory address')
  } catch (error) {
    console.error('CircleFactory deployment failed:', error)
    console.log('This might be due to contract size or complexity issues')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
