import hre from 'hardhat'
import fs from 'fs'
import path from 'path'
import { type Abi } from 'viem'

type Addr = `0x${string}`

// ABI will be loaded from artifacts for accurate typing

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
  const verbose = process.env.VERBOSE === '1' || process.env.VERBOSE === 'true'
  const asJson = process.env.JSON === '1' || process.env.JSON === 'true'

  const publicClient = await hre.viem.getPublicClient()
  const chainId = await publicClient.getChainId()
  let netName = ''
  if (chainId === 31337 || chainId === 1337) netName = 'localhost'
  else if (chainId === 11155111) netName = 'sepolia'
  else netName = String(chainId)

  const deploymentsFile = path.join('deployments', netName, 'root.json')
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployments file not found: ${deploymentsFile}. Run deploy:root first.`)
  }
  const rootData = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'))
  const registryAddr = rootData.registry as Addr

  const registryAbi = (await hre.artifacts.readArtifact('CircleRegistry')).abi as Abi
  const total = (await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: 'totalCircles',
  })) as bigint
  const count = Number(total)
  const byId = new Map<number, Circle>()
  const roots: Circle[] = []

  for (let i = 1; i <= count; i++) {
    const c = (await publicClient.readContract({
      address: registryAddr,
      abi: registryAbi,
      functionName: 'circles',
      args: [BigInt(i)],
    })) as any
    const circle: Circle = {
      id: Number(c.id_ ?? c[0]),
      parentId: Number(c.parentId ?? c[1]),
      governor: (c.governor ?? c[2]) as Addr,
      timelock: (c.timelock ?? c[3]) as Addr,
      treasury: (c.treasury ?? c[4]) as Addr,
      token: (c.token ?? c[5]) as Addr,
      name: (c.name ?? c[6]) as string,
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
