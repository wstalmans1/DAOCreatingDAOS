/* eslint-disable */
// Scan all governors known via the CircleRegistry and list ProposalCreated events.
// Usage: node scripts/scanProposals.cjs [network]

const fs = require('fs')
const path = require('path')

async function main() {
  // Ensure Hardhat uses the right network when creating clients
  const netArg = process.argv[2] || process.env.HARDHAT_NETWORK || null
  if (netArg) process.env.HARDHAT_NETWORK = netArg
  const hre = require('hardhat')
  const publicClient = await hre.viem.getPublicClient()
  const chainId = await publicClient.getChainId()
  let net = process.argv[2] || process.env.HARDHAT_NETWORK || null
  if (!net) {
    if (chainId === 31337 || chainId === 1337) net = 'localhost'
    else if (chainId === 11155111) net = 'sepolia'
    else net = String(chainId)
  }

  const rootFiles = [
    path.join('deployments', net, 'root.json'),
    path.join('deployments', net, 'root-1155.json'),
  ]
  const rootFile = rootFiles.find((f) => fs.existsSync(f))
  if (!rootFile) throw new Error(`No deployment file found under deployments/${net}/`)
  const dep = JSON.parse(fs.readFileSync(rootFile, 'utf8'))
  const registry = dep.registry

  const registryAbi = (await hre.artifacts.readArtifact('CircleRegistry')).abi
  const total = await publicClient.readContract({
    address: registry,
    abi: registryAbi,
    functionName: 'totalCircles',
  })
  const count = Number(total)
  const circles = []
  for (let i = 1; i <= count; i++) {
    const c = await publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: 'circles',
      args: [BigInt(i)],
    })
    circles.push({
      id: Number(c[0] ?? c.id),
      parentId: Number(c[1] ?? c.parentId),
      governor: c[2] ?? c.governor,
      timelock: c[3] ?? c.timelock,
      token: c[5] ?? c.token,
      name: String(c[6] ?? c.name),
    })
  }

  const govAbi = (await hre.artifacts.readArtifact('CircleGovernor')).abi
  const govEvent = govAbi.find((x) => x.type === 'event' && x.name === 'ProposalCreated')
  const latest = await publicClient.getBlockNumber()
  const fromBlock =
    chainId === 1337 || chainId === 31337 ? 0n : latest > 500000n ? latest - 500000n : 0n

  console.log(`Network: ${net}  Circles: ${circles.length}`)
  for (const c of circles) {
    const logs = await publicClient.getLogs({
      address: c.governor,
      event: govEvent,
      fromBlock,
      toBlock: latest,
    })
    console.log(`- [${c.id}] ${c.name}  governor=${c.governor}  proposals=${logs.length}`)
    for (const l of logs) {
      const id = l.args?.proposalId?.toString?.() || '(unknown)'
      const desc = l.args?.description || ''
      console.log(`   • id=${id}  "${desc.slice(0, 80)}"`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
