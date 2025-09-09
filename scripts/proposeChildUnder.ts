import hre from 'hardhat'
import fs from 'fs'
import path from 'path'
import { encodeFunctionData, keccak256, stringToHex, type Abi, type Hex } from 'viem'

async function mineBlocks(count: number) {
  for (let i = 0; i < count; i++) {
    await hre.network.provider.send('evm_mine', [])
  }
}

async function main() {
  const parentIdEnv = process.env.PARENT_ID
  if (!parentIdEnv) throw new Error('Set PARENT_ID (e.g., PARENT_ID=1)')
  const parentId = BigInt(parentIdEnv)

  const childName = process.env.CHILD_NAME || `Sub Circle ${Date.now()}`
  const votingDelay = BigInt(process.env.VOTING_DELAY || '1')
  const votingPeriod = BigInt(process.env.VOTING_PERIOD || '10')
  const proposalThreshold = BigInt(process.env.THRESHOLD || '0')
  const quorumNumerator = BigInt(process.env.QUORUM || '4')
  const timelockDelay = BigInt(process.env.TIMELOCK_DELAY || '60')

  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  console.log('Proposer:', walletClient.account.address)

  const chainId = await publicClient.getChainId()
  let netName = ''
  if (chainId === 31337 || chainId === 1337) netName = 'localhost'
  else if (chainId === 11155111) netName = 'sepolia'
  else netName = String(chainId)

  const deploymentsFile = path.join('deployments', netName, 'root.json')
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployments file not found: ${deploymentsFile}. Run deploy:root first.`)
  }
  const root = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'))

  const registryAddr = root.registry as `0x${string}`
  const factoryAddr = root.factory as `0x${string}`

  const registryAbi = (await hre.artifacts.readArtifact('CircleRegistry')).abi as Abi
  const exists = (await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'exists',
    args: [parentId],
  })) as boolean
  if (!exists) throw new Error(`Parent circle id ${parentId} does not exist`)

  const circle = (await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'circles',
    args: [parentId],
  })) as any
  const parentGovernor = (circle.governor ?? circle[2]) as `0x${string}`
  const parentToken = (circle.token ?? circle[5]) as `0x${string}`

  const factoryAbi = (await hre.artifacts.readArtifact('CircleFactory')).abi as Abi
  const governorAbi = (await hre.artifacts.readArtifact('CircleGovernor')).abi as Abi
  const calldata = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'createCircle',
    args: [
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
    ],
  })

  type Address = `0x${string}`
  const targets: readonly Address[] = [factoryAddr]
  const values: readonly bigint[] = [0n]
  const calldatas: readonly Hex[] = [calldata as Hex]
  const description = `Create child circle under ${parentId}: ${childName}`
  const descriptionHash = keccak256(stringToHex(description)) as Hex

  console.log('Proposing...')
  await walletClient.writeContract({
    address: parentGovernor,
    abi: governorAbi,
    functionName: 'propose',
    args: [targets, values, calldatas, description],
  })

  const proposalId = (await publicClient.readContract({
    address: parentGovernor,
    abi: governorAbi,
    functionName: 'getProposalId',
    args: [targets, values, calldatas, descriptionHash],
  })) as bigint
  console.log('Proposal ID:', proposalId.toString())

  // move to voting start
  const snapshot = (await publicClient.readContract({
    address: parentGovernor,
    abi: governorAbi,
    functionName: 'proposalSnapshot',
    args: [proposalId],
  })) as bigint
  const current = Number(await publicClient.getBlockNumber())
  if (current <= Number(snapshot)) {
    await mineBlocks(Number(snapshot) - current + 1)
  }

  console.log('Casting vote...')
  await walletClient.writeContract({
    address: parentGovernor,
    abi: governorAbi,
    functionName: 'castVote',
    args: [proposalId, 1],
  })

  const deadline = (await publicClient.readContract({
    address: parentGovernor,
    abi: governorAbi,
    functionName: 'proposalDeadline',
    args: [proposalId],
  })) as bigint
  const current2 = Number(await publicClient.getBlockNumber())
  if (current2 <= Number(deadline)) {
    await mineBlocks(Number(deadline) - current2 + 1)
  }

  console.log('Queueing...')
  await walletClient.writeContract({
    address: parentGovernor,
    abi: governorAbi,
    functionName: 'queue',
    args: [targets, values, calldatas, descriptionHash],
  })

  await hre.network.provider.send('evm_increaseTime', [Number(timelockDelay) + 1])
  await hre.network.provider.send('evm_mine', [])

  console.log('Executing...')
  await walletClient.writeContract({
    address: parentGovernor,
    abi: governorAbi,
    functionName: 'execute',
    args: [targets, values, calldatas, descriptionHash],
    value: 0n,
  })

  const total = (await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'totalCircles',
  })) as bigint
  const childId = total
  const child = (await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'circles',
    args: [childId],
  })) as any
  console.log('Child circle created:', {
    id: childId.toString(),
    parentId: (child.parentId ?? child[1]).toString(),
    governor: child.governor ?? child[2],
    timelock: child.timelock ?? child[3],
    treasury: child.treasury ?? child[4],
    token: child.token ?? child[5],
    name: child.name ?? child[6],
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
