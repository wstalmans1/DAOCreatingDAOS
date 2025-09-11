/* eslint-disable */
// Scan all governors via CircleRegistry and list ProposalCreated events with current state.
// Usage: node scripts/scanProposalsWithState.cjs [network]

const fs = require('fs')
const path = require('path')

const STATE_NAMES = [
  'Pending',
  'Active',
  'Canceled',
  'Defeated',
  'Succeeded',
  'Queued',
  'Expired',
  'Executed',
]

async function main() {
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
      name: String(c[6] ?? c.name),
      governor: c[2] ?? c.governor,
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
      const id = l.args?.proposalId
      const idStr = id?.toString?.() || '(unknown)'
      const desc = l.args?.description || ''
      let state = '(n/a)'
      try {
        const s = await publicClient.readContract({
          address: c.governor,
          abi: govAbi,
          functionName: 'state',
          args: [id],
        })
        const n = Number(s)
        state = STATE_NAMES[n] || `${n}`
      } catch (_) {}
      console.log(`   • id=${idStr}  state=${state}  "${desc.slice(0, 120)}"`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
