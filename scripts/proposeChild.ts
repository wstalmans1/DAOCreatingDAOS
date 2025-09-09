import hre from 'hardhat'
import fs from 'fs'
import path from 'path'
import { encodeFunctionData, keccak256, stringToHex } from 'viem'

async function mineBlocks(count: number) {
  for (let i = 0; i < count; i++) {
    await hre.network.provider.send('evm_mine', [])
  }
}

async function main() {
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

  const governorAddr = root.root.governor as `0x${string}`
  const factoryAddr = root.factory as `0x${string}`
  const registryAddr = root.registry as `0x${string}`
  const tokenAddr = root.token as `0x${string}`
  const parentId = BigInt(root.root.id)

  const circleName = process.argv[2] || 'Ops Circle'

  const governorAbi = (await hre.artifacts.readArtifact('CircleGovernor')).abi
  const registryAbi = (await hre.artifacts.readArtifact('CircleRegistry')).abi

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

  const factoryAbi = (await hre.artifacts.readArtifact('CircleFactory')).abi
  const calldata = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'createCircle',
    args: [params],
  })
  const targets = [factoryAddr]
  const values = [0n]
  const calldatas = [calldata]
  const description = `Create child circle: ${circleName}`
  const descriptionHash = keccak256(stringToHex(description))

  console.log('Proposing...')
  await walletClient.writeContract({
    address: governorAddr,
    abi: governorAbi,
    functionName: 'propose',
    args: [targets, values, calldatas, description],
  })
  const proposalId = (await publicClient.readContract({
    address: governorAddr,
    abi: governorAbi,
    functionName: 'getProposalId',
    args: [targets, values, calldatas, descriptionHash],
  })) as bigint
  console.log('Proposal ID:', proposalId.toString())

  // Move to voting start
  const snapshot = (await publicClient.readContract({
    address: governorAddr,
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
    address: governorAddr,
    abi: governorAbi,
    functionName: 'castVote',
    args: [proposalId, 1],
  })

  // Move to end of voting period
  const deadline = (await publicClient.readContract({
    address: governorAddr,
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
    address: governorAddr,
    abi: governorAbi,
    functionName: 'queue',
    args: [targets, values, calldatas, descriptionHash],
  })

  // Increase time for timelock
  await hre.network.provider.send('evm_increaseTime', [61])
  await hre.network.provider.send('evm_mine', [])

  console.log('Executing...')
  await walletClient.writeContract({
    address: governorAddr,
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
  const circle = (await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'circles',
    args: [childId],
  })) as any
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
