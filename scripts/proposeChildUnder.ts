import hre from 'hardhat'
import fs from 'fs'
import path from 'path'

const GOVERNOR_ABI = [
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
  'function exists(uint256 id) view returns (bool)',
  'function circles(uint256 id) view returns (uint256 id_, uint256 parentId, address governor, address timelock, address treasury, address token, string name)',
]

async function mineBlocks(ethers: typeof hre.ethers, count: number) {
  for (let i = 0; i < count; i++) {
    await ethers.provider.send('evm_mine', [])
  }
}

async function main() {
  const { ethers } = hre

  const parentIdEnv = process.env.PARENT_ID
  if (!parentIdEnv) throw new Error('Set PARENT_ID (e.g., PARENT_ID=1)')
  const parentId = BigInt(parentIdEnv)

  const childName = process.env.CHILD_NAME || `Sub Circle ${Date.now()}`
  const votingDelay = BigInt(process.env.VOTING_DELAY || '1')
  const votingPeriod = BigInt(process.env.VOTING_PERIOD || '10')
  const proposalThreshold = BigInt(process.env.THRESHOLD || '0')
  const quorumNumerator = BigInt(process.env.QUORUM || '4')
  const timelockDelay = BigInt(process.env.TIMELOCK_DELAY || '60')

  const [proposer] = await ethers.getSigners()
  console.log('Proposer:', proposer.address)

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

  const registryAddr = root.registry as `0x${string}`
  const factoryAddr = root.factory as `0x${string}`

  const registry = new ethers.Contract(registryAddr, REGISTRY_ABI, proposer)

  const exists: boolean = await registry.exists(parentId)
  if (!exists) throw new Error(`Parent circle id ${parentId} does not exist`)

  const circle = await registry.circles(parentId)
  const parentGovernor = circle.governor as `0x${string}`
  const parentToken = circle.token as `0x${string}`

  const governor = new ethers.Contract(parentGovernor, GOVERNOR_ABI, proposer)
  const iface = new ethers.Interface(FACTORY_ABI)
  const calldata = iface.encodeFunctionData('createCircle', [
    {
      parentId,
      name: childName,
      token: parentToken,
      votingDelay,
      votingPeriod,
      proposalThreshold,
      quorumNumerator,
      timelockDelay,
    },
  ])

  const targets = [factoryAddr]
  const values = [0]
  const calldatas = [calldata]
  const description = `Create child circle under ${parentId}: ${childName}`
  const descriptionHash = ethers.id(description)

  console.log('Proposing...')
  const tx = await governor.propose(targets, values, calldatas, description)
  await tx.wait()

  const proposalId = await governor.getProposalId(targets, values, calldatas, descriptionHash)
  console.log('Proposal ID:', proposalId.toString())

  // move to voting start
  const snapshot = await governor.proposalSnapshot(proposalId)
  const current = await ethers.provider.getBlockNumber()
  if (current <= Number(snapshot)) {
    await mineBlocks(ethers, Number(snapshot) - current + 1)
  }

  console.log('Casting vote...')
  await (await governor.castVote(proposalId, 1)).wait()

  const deadline = await governor.proposalDeadline(proposalId)
  const current2 = await ethers.provider.getBlockNumber()
  if (current2 <= Number(deadline)) {
    await mineBlocks(ethers, Number(deadline) - current2 + 1)
  }

  console.log('Queueing...')
  await (await governor.queue(targets, values, calldatas, descriptionHash)).wait()

  await ethers.provider.send('evm_increaseTime', [Number(timelockDelay) + 1])
  await ethers.provider.send('evm_mine', [])

  console.log('Executing...')
  await (await governor.execute(targets, values, calldatas, descriptionHash)).wait()

  const total = await registry.totalCircles()
  const childId = total
  const child = await registry.circles(childId)
  console.log('Child circle created:', {
    id: childId.toString(),
    parentId: child.parentId.toString(),
    governor: child.governor,
    timelock: child.timelock,
    treasury: child.treasury,
    token: child.token,
    name: child.name,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
