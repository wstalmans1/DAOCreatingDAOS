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

  // 3) Deploy Factory and set it on the registry
  const factory = await hre.viem.deployContract('CircleFactory', [registryAddr])
  const factoryAddr = factory.address as `0x${string}`
  console.log('CircleFactory deployed:', factoryAddr)

  const registryAbi = (await hre.artifacts.readArtifact('CircleRegistry')).abi as Abi
  await walletClient.writeContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'setFactory',
    args: [factoryAddr],
  })

  // 4) Create Root Circle
  const params = {
    parentId: 0n,
    name: 'Root Circle',
    token: tokenAddr,
    votingDelay: 1n,
    votingPeriod: 10n,
    proposalThreshold: 0n,
    quorumNumerator: 4n,
    timelockDelay: 60n,
  }

  const factoryAbi = (await hre.artifacts.readArtifact('CircleFactory')).abi as Abi
  await walletClient.writeContract({
    address: factoryAddr,
    abi: factoryAbi,
    functionName: 'createCircle',
    args: [params],
  })

  // Fetch created root from registry
  const total = (await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'totalCircles',
  })) as bigint
  const root = (await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'circles',
    args: [total],
  })) as any
  const rootId = total
  const governor = (root.governor ?? root[2]) as `0x${string}`
  const timelock = (root.timelock ?? root[3]) as `0x${string}`
  const treasury = (root.treasury ?? root[4]) as `0x${string}`
  console.log('Root circle created:', { id: rootId.toString(), governor, timelock, treasury })

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
      id: rootId.toString(),
      governor,
      timelock,
      treasury,
    },
  }

  fs.writeFileSync(path.join(outDir, 'root.json'), JSON.stringify(data, null, 2))
  console.log(`Deployment saved to ${path.join(outDir, 'root.json')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
