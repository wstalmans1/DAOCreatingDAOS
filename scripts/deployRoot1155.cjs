/* eslint-disable */
// Deploy a root circle using the Soulbound1155Votes token for voting power (id = 1).
const fs = require('fs')
const path = require('path')

async function main() {
  if (!process.env.HARDHAT_NETWORK) process.env.HARDHAT_NETWORK = 'localhost'
  const hre = require('hardhat')
  const { ethers } = hre

  const [deployer] = await ethers.getSigners()
  console.log('Deployer:', deployer.address)

  // 1) Deploy Soulbound1155Votes and mint + delegate
  const Token = await ethers.getContractFactory('Soulbound1155Votes')
  const token = await Token.deploy('ipfs://SBT/{id}.json')
  await token.waitForDeployment()
  const tokenAddr = await token.getAddress()
  await (await token.mint(deployer.address, 1n)).wait()
  // Delegation uses Votes; delegate to self for voting power
  const ivotes = new ethers.Contract(tokenAddr, ['function delegate(address) external'], deployer)
  await (await ivotes.delegate(deployer.address)).wait()
  console.log('Soulbound1155Votes deployed:', tokenAddr)

  // 2) Deploy Registry + Factory and set factory
  const Registry = await ethers.getContractFactory('CircleRegistry')
  const registry = await Registry.deploy()
  await registry.waitForDeployment()
  const registryAddr = await registry.getAddress()

  const Factory = await ethers.getContractFactory('CircleFactory')
  const factory = await Factory.deploy(registryAddr)
  await factory.waitForDeployment()
  const factoryAddr = await factory.getAddress()
  await (await registry.setFactory(factoryAddr)).wait()

  // 3) Create Root Circle
  const params = {
    parentId: 0n,
    name: 'Root Circle (1155)',
    token: tokenAddr,
    votingDelay: 1n,
    votingPeriod: 10n,
    proposalThreshold: 0n,
    quorumNumerator: 4n,
    timelockDelay: 60n,
  }
  await (await factory.createCircle(params)).wait()

  const rootId = await registry.totalCircles()
  const root = await registry.circles(rootId)
  console.log('Root circle created (1155):', {
    id: rootId.toString(),
    governor: root[2],
    timelock: root[3],
    treasury: root[4],
  })

  // 4) Persist to deployments
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
    root: { id: rootId.toString(), governor: root[2], timelock: root[3], treasury: root[4] },
  }
  fs.writeFileSync(path.join(outDir, 'root-1155.json'), JSON.stringify(data, null, 2))
  console.log(`Deployment saved to ${path.join(outDir, 'root-1155.json')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
