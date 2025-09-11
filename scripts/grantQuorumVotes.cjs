/* eslint-disable */
// Ensure an address has at least quorum votes on localhost/sepolia by
// transferring governance tokens to it and (re)delegating to itself.
//
// Usage:
//   node scripts/grantQuorumVotes.cjs 0xYourAddress [network]
// Example:
//   node scripts/grantQuorumVotes.cjs 0xABCD... localhost

const fs = require('fs')
const path = require('path')

async function main() {
  const recipient = process.argv[2]
  const netArg = process.argv[3]
  if (!recipient)
    throw new Error('Usage: node scripts/grantQuorumVotes.cjs 0xYourAddress [network]')
  if (netArg) process.env.HARDHAT_NETWORK = netArg
  if (!process.env.HARDHAT_NETWORK) process.env.HARDHAT_NETWORK = 'localhost'

  const hre = require('hardhat')
  const { ethers } = hre

  // Load deployment info (registry/governor/token) from deployments/<network>/root.json
  const network = process.env.HARDHAT_NETWORK
  const file = path.join('deployments', network, 'root.json')
  if (!fs.existsSync(file)) throw new Error(`Deployment file not found: ${file}`)
  const dep = JSON.parse(fs.readFileSync(file, 'utf8'))
  const tokenAddr = dep.token
  const governorAddr = dep.root?.governor

  const token = await ethers.getContractAt('GovernanceToken', tokenAddr)
  const governor = await ethers.getContractAt('CircleGovernor', governorAddr)

  // Use the previous block for historical lookups (ERC-5805 forbids future/current)
  const latestBn = await ethers.provider.getBlockNumber()
  const bn = latestBn > 0 ? latestBn - 1 : 0
  const decimals = await token.decimals()
  const one = ethers.parseUnits('1', decimals)

  // Read quorum at current block and current votes of recipient
  const [quorumUnits, votesUnits, delegatee] = await Promise.all([
    governor.quorum(bn),
    token.getVotes(recipient),
    token.delegates(recipient).catch(() => ethers.ZeroAddress),
  ])

  // If already sufficient, exit early
  if (votesUnits >= quorumUnits) {
    console.log('Already meets quorum.')
    console.log('Recipient:', recipient)
    console.log('Token:', tokenAddr)
    console.log('Governor:', governorAddr)
    console.log('Quorum:', quorumUnits.toString())
    console.log('Votes :', votesUnits.toString())
    return
  }

  const short = (x) => x.slice(0, 6) + '…' + x.slice(-4)
  console.log('Ensuring quorum votes on', network)
  console.log('Recipient:', recipient)
  console.log('Token    :', tokenAddr, ' Governor:', governorAddr)
  console.log('Block    :', bn)
  console.log('Quorum   :', quorumUnits.toString())
  console.log('Current  :', votesUnits.toString())

  // Find initial holder to transfer from (look for mint Transfer from 0x0)
  const zero = '0x0000000000000000000000000000000000000000'
  const filter = await token.filters.Transfer(zero)
  const logs = await token.queryFilter(filter, 0, bn)
  const initialHolder =
    logs?.[0]?.args?.to ||
    (await (async () => {
      const [deployer] = await ethers.getSigners()
      return deployer.address
    })())

  // Amount needed + small buffer of 1 token to be safe
  const needUnits = quorumUnits - votesUnits + one

  console.log('Initial holder:', initialHolder, '(impersonating)')
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [initialHolder],
  })
  await hre.network.provider.request({
    method: 'hardhat_setBalance',
    params: [initialHolder, '0x8AC7230489E80000'],
  }) // 10 ETH
  const holderSigner = await ethers.getSigner(initialHolder)

  // Transfer tokens
  const tx = await token.connect(holderSigner).transfer(recipient, needUnits)
  await tx.wait()

  // (Re)delegate to self to ensure votes are counted
  await hre.network.provider.request({ method: 'hardhat_impersonateAccount', params: [recipient] })
  await hre.network.provider.request({
    method: 'hardhat_setBalance',
    params: [recipient, '0x8AC7230489E80000'],
  })
  const recSigner = await ethers.getSigner(recipient)
  const delTx = await token.connect(recSigner).delegate(recipient)
  await delTx.wait()
  await hre.network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [recipient],
  })
  await hre.network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [initialHolder],
  })

  // Mine one block so snapshots after now pick up votes immediately
  try {
    await hre.network.provider.send('evm_mine', [])
  } catch {}

  const afterVotes = await token.getVotes(recipient)
  console.log('Votes after:', afterVotes.toString())
  console.log('Done. You should now meet or exceed quorum for new proposals.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
