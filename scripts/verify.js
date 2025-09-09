// Verify the deployed contract using address stored in deployments/<network>/MyToken.json
// Usage:
//   node scripts/verify.js --network sepolia
//   HARDHAT_NETWORK=sepolia node scripts/verify.js

require('dotenv').config()
const fs = require('fs')
const path = require('path')

async function main() {
  // Parse --network from args or use HARDHAT_NETWORK
  const args = process.argv.slice(2)
  const netArgIndex = args.findIndex((a) => a === '--network')
  let networkName = process.env.HARDHAT_NETWORK || null
  if (netArgIndex !== -1 && args[netArgIndex + 1]) {
    networkName = args[netArgIndex + 1]
  }

  if (!networkName) {
    throw new Error('Network not specified. Use --network <name> or set HARDHAT_NETWORK.')
  }

  const deploymentsFile = path.join('deployments', networkName, 'MyToken.json')
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(
      `Deployment file not found: ${deploymentsFile}. Deploy first or pass correct --network.`,
    )
  }

  const { address } = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'))
  if (!address) {
    throw new Error(`No address found in ${deploymentsFile}`)
  }

  const hre = require('hardhat')
  console.log(`Verifying MyToken at ${address} on ${networkName}...`)

  await hre.run('verify:verify', {
    address,
    constructorArguments: [],
  })

  console.log('Verification submitted successfully.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
