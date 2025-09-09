import { ethers } from 'hardhat'
import fs from 'fs'
import path from 'path'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying contracts with the account:', deployer.address)

  const MyToken = await ethers.getContractFactory('MyToken')
  const myToken = await MyToken.deploy()
  await myToken.waitForDeployment()

  const address = await myToken.getAddress()
  console.log('MyToken deployed to:', address)

  // Persist deployment info for scripts and reference

  const net = await ethers.provider.getNetwork()
  let netName = net?.name && net.name !== 'unknown' ? net.name : ''
  if (!netName) {
    if (net.chainId === 31337n) netName = 'localhost'
    else if (net.chainId === 11155111n) netName = 'sepolia'
    else netName = net.chainId.toString()
  }

  const outDir = path.join('deployments', netName)
  fs.mkdirSync(outDir, { recursive: true })

  const contractInfo = {
    address,
    abi: JSON.parse(myToken.interface.format('json') as string),
    chainId: net.chainId.toString(),
    network: netName,
    name: 'MyToken',
  }

  const outfile = path.join(outDir, 'MyToken.json')
  fs.writeFileSync(outfile, JSON.stringify(contractInfo, null, 2))
  console.log(`Deployment info saved to ${outfile}`)
  console.log('Remember to set VITE_MY_TOKEN_ADDRESS in .env.local for the frontend.')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
