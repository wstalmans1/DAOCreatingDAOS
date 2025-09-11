/* eslint-disable */
// Grant ERC20Votes to an address and self-delegate on localhost.
// Usage: node scripts/grantVotes.cjs 0xYourAddress [amountTokens]

async function main() {
  const addr = process.argv[2]
  const amountStr = process.argv[3] || '1000'
  if (!addr) throw new Error('Usage: node scripts/grantVotes.cjs 0xYourAddress [amountTokens]')
  if (!process.env.HARDHAT_NETWORK) process.env.HARDHAT_NETWORK = 'localhost'
  const hre = require('hardhat')
  const { ethers } = hre

  const path = require('path')
  const depPath = path.join(process.cwd(), 'deployments', 'localhost', 'root.json')
  const dep = require(depPath)
  const tokenAddr = dep.token
  const token = await ethers.getContractAt('GovernanceToken', tokenAddr)

  const decimals = await token.decimals()
  const amount = ethers.parseUnits(amountStr, decimals)

  const [deployer] = await ethers.getSigners()
  console.log('Deployer:', deployer.address)
  console.log('Token:', tokenAddr)
  console.log('Recipient:', addr, 'Amount:', amountStr)

  // Transfer tokens to recipient
  await (await token.transfer(addr, amount)).wait()

  // Impersonate recipient to delegate to self (localhost only)
  await hre.network.provider.request({ method: 'hardhat_impersonateAccount', params: [addr] })
  // Fund the impersonated account so it can pay gas
  await hre.network.provider.request({
    method: 'hardhat_setBalance',
    params: [addr, '0x8AC7230489E80000' /* 10 ETH */],
  })
  const recSigner = await ethers.getSigner(addr)
  await (await token.connect(recSigner).delegate(addr)).wait()
  await hre.network.provider.request({ method: 'hardhat_stopImpersonatingAccount', params: [addr] })

  const votes = await token.getVotes(addr)
  console.log('Votes after delegation:', votes.toString())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
