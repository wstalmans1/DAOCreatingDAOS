import hre from 'hardhat'
import fs from 'fs'
import path from 'path'

type Addr = `0x${string}`

const REGISTRY_ABI = [
  'function totalCircles() view returns (uint256)',
  'function circles(uint256 id) view returns (uint256 id_, uint256 parentId, address governor, address timelock, address treasury, address token, string name)',
]

type Circle = {
  id: number
  parentId: number
  name: string
  governor: Addr
  timelock: Addr
  treasury: Addr
  token: Addr
  children: Circle[]
}

function printTree(nodes: Circle[], depth = 0, verbose = false) {
  const pad = '  '.repeat(depth)
  for (const n of nodes) {
    console.log(`${pad}- [${n.id}] ${n.name}`)
    if (verbose) {
      console.log(`${pad}  governor: ${n.governor}`)
      console.log(`${pad}  timelock: ${n.timelock}`)
      console.log(`${pad}  treasury: ${n.treasury}`)
      console.log(`${pad}  token:    ${n.token}`)
    }
    if (n.children.length) printTree(n.children, depth + 1, verbose)
  }
}

async function main() {
  const { ethers } = hre
  const verbose = process.env.VERBOSE === '1' || process.env.VERBOSE === 'true'
  const asJson = process.env.JSON === '1' || process.env.JSON === 'true'

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
  const rootData = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'))
  const registryAddr = rootData.registry as Addr

  const registry = new ethers.Contract(registryAddr, REGISTRY_ABI, (await ethers.getSigners())[0])
  const total: bigint = await registry.totalCircles()
  const count = Number(total)
  const byId = new Map<number, Circle>()
  const roots: Circle[] = []

  for (let i = 1; i <= count; i++) {
    const c = await registry.circles(i)
    const circle: Circle = {
      id: Number(c.id_),
      parentId: Number(c.parentId),
      governor: c.governor as Addr,
      timelock: c.timelock as Addr,
      treasury: c.treasury as Addr,
      token: c.token as Addr,
      name: c.name as string,
      children: [],
    }
    byId.set(circle.id, circle)
  }

  for (const c of byId.values()) {
    if (c.parentId === 0) roots.push(c)
    else byId.get(c.parentId)?.children.push(c)
  }

  if (asJson) {
    console.log(JSON.stringify(roots, null, 2))
  } else {
    console.log(`Network: ${netName}`)
    console.log(`Registry: ${registryAddr}`)
    console.log(`Total circles: ${count}`)
    printTree(roots, 0, verbose)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
