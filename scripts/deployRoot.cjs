/* eslint-disable */
// Minimal CJS deploy script targeting a running localhost Hardhat node.
// Uses ethers to match the TS viem-based script, but without TS/ESM.
const fs = require('fs')
const path = require('path')

async function main() {
  // Prefer localhost network
  if (!process.env.HARDHAT_NETWORK) process.env.HARDHAT_NETWORK = 'localhost'
  const hre = require('hardhat')
  const { ethers } = hre

  const [deployer] = await ethers.getSigners()
  console.log('Deployer:', deployer.address)

  // 1) Deploy Governance Token and self-delegate for votes
  const Token = await ethers.getContractFactory('GovernanceToken')
  const token = await Token.deploy('GovToken', 'GOV', deployer.address, 10n ** 24n)
  await token.waitForDeployment()
  await (await token.delegate(deployer.address)).wait()
  const tokenAddr = await token.getAddress()
  console.log('GovernanceToken deployed:', tokenAddr)

  // 2) Deploy Registry
  const Registry = await ethers.getContractFactory('CircleRegistry')
  const registry = await Registry.deploy()
  await registry.waitForDeployment()
  const registryAddr = await registry.getAddress()
  console.log('CircleRegistry deployed:', registryAddr)

  // 3) Deploy Factory and set it on the registry
  const Factory = await ethers.getContractFactory('CircleFactory')
  const factory = await Factory.deploy(registryAddr)
  await factory.waitForDeployment()
  const factoryAddr = await factory.getAddress()
  console.log('CircleFactory deployed:', factoryAddr)
  await (await registry.setFactory(factoryAddr)).wait()

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
  await (await factory.createCircle(params)).wait()

  const total = await registry.totalCircles()
  const root = await registry.circles(total)
  const rootId = total
  const governor = root[2]
  const timelock = root[3]
  const treasury = root[4]
  console.log('Root circle created:', { id: rootId.toString(), governor, timelock, treasury })

  // Persist artifacts
  const net = await ethers.provider.getNetwork()
  let netName = net?.name && net.name !== 'unknown' ? net.name : ''
  if (!netName) {
    if (net.chainId === 31337n || net.chainId === 1337n) netName = 'localhost'
    else netName = net.chainId.toString()
  }
  const outDir = path.join('deployments', netName)
  fs.mkdirSync(outDir, { recursive: true })

  const data = {
    network: netName,
    chainId: net.chainId.toString(),
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
