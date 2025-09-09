import hre from 'hardhat'
import fs from 'fs'
import path from 'path'

const GOVERNOR_ABI = [
  'function name() view returns (string)',
  'function propose(address[] targets,uint256[] values,bytes[] calldatas,string description) returns (uint256)',
  'function getProposalId(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash) view returns (uint256)',
  'function proposalSnapshot(uint256 proposalId) view returns (uint256)',
  'function proposalDeadline(uint256 proposalId) view returns (uint256)',
  'function castVote(uint256 proposalId,uint8 support) returns (uint256)',
  'function queue(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash) returns (uint256)',
  'function execute(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash) payable returns (uint256)',
]

const FACTORY_ABI = [
  'function createCircle((uint256 parentId,string name,address token,uint48 votingDelay,uint32 votingPeriod,uint256 proposalThreshold,uint256 quorumNumerator,uint48 timelockDelay) p) returns (uint256,address,address,address)',
]

const REGISTRY_ABI = [
  'function totalCircles() view returns (uint256)',
  'function circles(uint256 id) view returns (uint256 id_, uint256 parentId, address governor, address timelock, address treasury, address token, string name)',
]

async function mineBlocks(ethers: typeof hre.ethers, count: number) {
  for (let i = 0; i < count; i++) {
    await ethers.provider.send('evm_mine', [])
  }
}

async function main() {
  const { ethers } = hre

  const [deployer] = await ethers.getSigners()
  console.log('Proposer:', deployer.address)

  const net = await ethers.provider.getNetwork()
  let netName = net?.name && net.name !== 'unknown' ? net.name : ''
  if (!netName) {
    if (net.chainId === 31337n) netName = 'localhost'
    else if (net.chainId === 11155111n) netName = 'sepolia'
    else netName = net.chainId.toString()
  }

  const deploymentsFile = path.join('deployments', netName, 'root.json')
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployments file not found: ${deploymentsFile}. Run deploy:root first.`)
  }
  const root = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'))

  const governorAddr = root.root.governor as `0x${string}`
  const factoryAddr = root.factory as `0x${string}`
  const registryAddr = root.registry as `0x${string}`
  const tokenAddr = root.token as `0x${string}`
  const parentId = BigInt(root.root.id)

  const circleName = process.argv[2] || 'Ops Circle'

  const governor = new ethers.Contract(governorAddr, GOVERNOR_ABI, deployer)
  const registry = new ethers.Contract(registryAddr, REGISTRY_ABI, deployer)

  const params = {
    parentId,
    name: circleName,
    token: tokenAddr,
    votingDelay: 1n,
    votingPeriod: 10n,
    proposalThreshold: 0n,
    quorumNumerator: 4n,
    timelockDelay: 60n,
  }

  const iface = new ethers.Interface(FACTORY_ABI)
  const calldata = iface.encodeFunctionData('createCircle', [params])
  const targets = [factoryAddr]
  const values = [0]
  const calldatas = [calldata]
  const description = `Create child circle: ${circleName}`
  const descriptionHash = ethers.id(description)

  console.log('Proposing...')
  const tx = await governor.propose(targets, values, calldatas, description)
  const rc = await tx.wait()
  console.log('Proposed in tx:', rc?.hash)

  const proposalId = await governor.getProposalId(targets, values, calldatas, descriptionHash)
  console.log('Proposal ID:', proposalId.toString())

  // Move to voting start
  const snapshot = await governor.proposalSnapshot(proposalId)
  const current = await ethers.provider.getBlockNumber()
  if (current <= Number(snapshot)) {
    await mineBlocks(ethers, Number(snapshot) - current + 1)
  }

  console.log('Casting vote...')
  await (await governor.castVote(proposalId, 1)).wait() // 1 = For

  // Move to end of voting period
  const deadline = await governor.proposalDeadline(proposalId)
  const current2 = await ethers.provider.getBlockNumber()
  if (current2 <= Number(deadline)) {
    await mineBlocks(ethers, Number(deadline) - current2 + 1)
  }

  console.log('Queueing...')
  await (await governor.queue(targets, values, calldatas, descriptionHash)).wait()

  // Increase time for timelock
  await ethers.provider.send('evm_increaseTime', [61])
  await ethers.provider.send('evm_mine', [])

  console.log('Executing...')
  await (await governor.execute(targets, values, calldatas, descriptionHash, { value: 0 })).wait()

  const total = await registry.totalCircles()
  const childId = total // last created
  const circle = await registry.circles(childId)
  console.log('Child circle created:', {
    id: childId.toString(),
    parentId: circle.parentId.toString(),
    governor: circle.governor,
    timelock: circle.timelock,
    treasury: circle.treasury,
    token: circle.token,
    name: circle.name,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
