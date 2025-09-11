/* eslint-disable */
// Usage:
//   node scripts/fund.cjs 0xYourAddress [amountEth]
// Defaults to 5 ETH if amount not provided.

async function main() {
  if (!process.env.HARDHAT_NETWORK) process.env.HARDHAT_NETWORK = 'localhost'
  const hre = require('hardhat')
  const { ethers } = hre

  const to = process.argv[2]
  const amountEth = process.argv[3] || '5'
  if (!to) throw new Error('Usage: node scripts/fund.cjs 0xYourAddress [amountEth]')
  if (!ethers.isAddress(to)) throw new Error(`Invalid address: ${to}`)

  const [deployer] = await ethers.getSigners()
  const provider = ethers.provider

  const before = await provider.getBalance(to)
  console.log('Deployer:', deployer.address)
  console.log('Recipient:', to)
  console.log('Before balance:', ethers.formatEther(before), 'ETH')

  const tx = await deployer.sendTransaction({ to, value: ethers.parseEther(amountEth) })
  console.log('Funding tx:', tx.hash)
  await tx.wait()

  const after = await provider.getBalance(to)
  console.log('After balance:', ethers.formatEther(after), 'ETH')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
