import hre from 'hardhat'
import fs from 'fs'
import path from 'path'

async function main() {
  const publicClient = await hre.viem.getPublicClient()
  const [walletClient] = await hre.viem.getWalletClients()
  console.log('Deployer:', walletClient.account.address)

  // 1) Deploy Governance Token
  const token = await hre.viem.deployContract('GovernanceToken', [
    'GovToken',
    'GOV',
    walletClient.account.address,
    10n ** 24n, // 1,000,000 * 1e18
  ])
  const tokenAddr = token.address as `0x${string}`
  console.log('GovernanceToken deployed:', tokenAddr)

  // 2) Deploy Registry
  const registry = await hre.viem.deployContract('CircleRegistry', [])
  const registryAddr = registry.address as `0x${string}`
  console.log('CircleRegistry deployed:', registryAddr)

  // 3) Deploy MinimalTreasury
  const treasury = await hre.viem.deployContract('MinimalTreasury', [])
  const treasuryAddr = treasury.address as `0x${string}`
  console.log('MinimalTreasury deployed:', treasuryAddr)

  // 4) Deploy CircleGovernor
  const governor = await hre.viem.deployContract('CircleGovernor', [
    'Root Circle Governor',
    tokenAddr,
    1n, // voting delay
    10n, // voting period
    0n, // proposal threshold
    4n, // quorum numerator
    treasuryAddr,
    60n, // timelock delay
  ])
  const governorAddr = governor.address as `0x${string}`
  console.log('CircleGovernor deployed:', governorAddr)

  // 5) Deploy TimelockController
  const timelock = await hre.viem.deployContract('TimelockController', [
    60n, // min delay
    [governorAddr], // proposers
    [governorAddr], // executors
    walletClient.account.address, // admin
  ])
  const timelockAddr = timelock.address as `0x${string}`
  console.log('TimelockController deployed:', timelockAddr)

  // 6) Deploy CircleFactory
  const factory = await hre.viem.deployContract('CircleFactory', [registryAddr])
  const factoryAddr = factory.address as `0x${string}`
  console.log('CircleFactory deployed:', factoryAddr)

  // 7) Set factory on registry
  const registryAbi = (await hre.artifacts.readArtifact('CircleRegistry')).abi
  await walletClient.writeContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'setFactory',
    args: [factoryAddr],
  })

  // 8) Create root circle
  const factoryAbi = (await hre.artifacts.readArtifact('CircleFactory')).abi
  await walletClient.writeContract({
    address: factoryAddr,
    abi: factoryAbi,
    functionName: 'createCircle',
    args: [
      {
        parentId: 0n,
        name: 'Root Circle',
        token: tokenAddr,
        votingDelay: 1n,
        votingPeriod: 10n,
        proposalThreshold: 0n,
        quorumNumerator: 4n,
        timelockDelay: 60n,
      },
    ],
  })

  // Get the created root circle
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
  const rootGovernor = (root.governor ?? root[2]) as `0x${string}`
  const rootTimelock = (root.timelock ?? root[3]) as `0x${string}`
  const rootTreasury = (root.treasury ?? root[4]) as `0x${string}`

  console.log('Root circle created:', {
    id: rootId.toString(),
    governor: rootGovernor,
    timelock: rootTimelock,
    treasury: rootTreasury,
  })

  // Save deployment
  const chainId = await publicClient.getChainId()
  const outDir = path.join('deployments', 'anvil')
  fs.mkdirSync(outDir, { recursive: true })

  const data = {
    network: 'anvil',
    chainId: String(chainId),
    token: tokenAddr,
    registry: registryAddr,
    factory: factoryAddr,
    root: {
      id: rootId.toString(),
      governor: rootGovernor,
      timelock: rootTimelock,
      treasury: rootTreasury,
    },
  }

  fs.writeFileSync(path.join(outDir, 'root.json'), JSON.stringify(data, null, 2))
  console.log(`Deployment saved to ${path.join(outDir, 'root.json')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
