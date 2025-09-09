import { ethers } from 'hardhat'
import fs from 'fs'
import path from 'path'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deployer:', deployer.address)

  // 1) Deploy Governance Token and self-delegate for votes
  const Token = await ethers.getContractFactory('GovernanceToken')
  const initialSupply = ethers.parseUnits('1000000', 18)
  const token = await Token.deploy('GovToken', 'GOV', deployer.address, initialSupply)
  await token.waitForDeployment()
  const tokenAddr = await token.getAddress()
  // Self-delegate to activate voting power
  const delegateTx = await token.connect(deployer).delegate(deployer.address)
  await delegateTx.wait()
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

  const setFactoryTx = await registry.setFactory(factoryAddr)
  await setFactoryTx.wait()

  // 4) Create Root Circle
  const params = {
    parentId: 0n,
    name: 'Root Circle',
    token: tokenAddr as `0x${string}`,
    votingDelay: 1n, // 1 block
    votingPeriod: 10n, // 10 blocks
    proposalThreshold: 0n,
    quorumNumerator: 4n, // 4%
    timelockDelay: 60n, // 60 seconds
  }

  // Read return values via callStatic, then execute for real
  const preview = await factory.callStatic.createCircle(params)
  const tx = await factory.createCircle(params)
  await tx.wait()

  const [rootId, governor, timelock, treasury] = preview
  console.log('Root circle created:', { id: rootId.toString(), governor, timelock, treasury })

  // Persist artifacts
  const net = await ethers.provider.getNetwork()
  let netName = net?.name && net.name !== 'unknown' ? net.name : ''
  if (!netName) {
    if (net.chainId === 31337n) netName = 'localhost'
    else if (net.chainId === 11155111n) netName = 'sepolia'
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
