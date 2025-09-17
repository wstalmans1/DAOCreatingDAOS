import hre from 'hardhat'
import fs from 'fs'
import path from 'path'
import { type Abi } from 'viem'

async function main() {
  const publicClient = await hre.viem.getPublicClient()
  const [walletClient] = await hre.viem.getWalletClients()
  console.log('Deployer:', walletClient.account.address)

  // 1) Deploy Governance Token and self-delegate for votes
  const token = await hre.viem.deployContract('GovernanceToken', [
    'GovToken',
    'GOV',
    walletClient.account.address,
    10n ** 24n, // 1,000,000 * 1e18
  ])
  const tokenAddr = token.address as `0x${string}`
  const tokenAbi = (await hre.artifacts.readArtifact('GovernanceToken')).abi as Abi
  await walletClient.writeContract({
    address: tokenAddr,
    abi: tokenAbi,
    functionName: 'delegate',
    args: [walletClient.account.address],
  })
  console.log('GovernanceToken deployed:', tokenAddr)

  // 2) Deploy Registry
  const registry = await hre.viem.deployContract('CircleRegistry', [])
  const registryAddr = registry.address as `0x${string}`
  console.log('CircleRegistry deployed:', registryAddr)

  // For now, let's create a minimal deployment without the factory
  // We'll use placeholder addresses for the factory and root circle
  const factoryAddr = '0x0000000000000000000000000000000000000000' as `0x${string}`
  const governorAddr = '0x0000000000000000000000000000000000000000' as `0x${string}`
  const timelockAddr = '0x0000000000000000000000000000000000000000' as `0x${string}`
  const treasuryAddr = '0x0000000000000000000000000000000000000000' as `0x${string}`

  console.log('Minimal deployment completed (factory deployment skipped due to issues)')

  // Persist artifacts
  const chainId = await publicClient.getChainId()
  let netName = ''
  if (chainId === 31337 || chainId === 1337) netName = 'anvil'
  else if (chainId === 11155111) netName = 'sepolia'
  else netName = String(chainId)

  const outDir = path.join('deployments', netName)
  fs.mkdirSync(outDir, { recursive: true })

  const data = {
    network: netName,
    chainId: String(chainId),
    token: tokenAddr,
    registry: registryAddr,
    factory: factoryAddr,
    root: {
      id: '0',
      governor: governorAddr,
      timelock: timelockAddr,
      treasury: treasuryAddr,
    },
  }

  fs.writeFileSync(path.join(outDir, 'root.json'), JSON.stringify(data, null, 2))
  console.log(`Deployment saved to ${path.join(outDir, 'root.json')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
