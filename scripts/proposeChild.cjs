/* eslint-disable */
// Propose a child circle under root (localhost) to generate a ProposalCreated event
const fs = require('fs')
const path = require('path')

async function main() {
  if (!process.env.HARDHAT_NETWORK) process.env.HARDHAT_NETWORK = 'localhost'
  const hre = require('hardhat')
  const { ethers } = hre

  const netFile = path.join('deployments', 'localhost', 'root.json')
  if (!fs.existsSync(netFile))
    throw new Error('No deployments/localhost/root.json; deploy root first')
  const dep = JSON.parse(fs.readFileSync(netFile, 'utf8'))

  const governor = await ethers.getContractAt('CircleGovernor', dep.root.governor)
  const factoryAbi = (await hre.artifacts.readArtifact('CircleFactory')).abi
  const iface = new ethers.Interface(factoryAbi)

  const params = {
    parentId: 1n,
    name: 'Child via script',
    token: dep.token,
    votingDelay: 1n,
    votingPeriod: 5n,
    proposalThreshold: 0n,
    quorumNumerator: 4n,
    timelockDelay: 1n,
  }
  const calldata = iface.encodeFunctionData('createCircle', [params])
  const targets = [dep.factory]
  const values = [0]
  const calldatas = [calldata]
  const description = `Create child circle by script ${Date.now()}`

  const tx = await governor.propose(targets, values, calldatas, description)
  await tx.wait()
  console.log('Propose tx:', tx.hash)

  // Print the last ProposalCreated
  const filter = await governor.filters.ProposalCreated()
  const current = await ethers.provider.getBlockNumber()
  const from = Math.max(current - 5000, 0)
  const logs = await governor.queryFilter(filter, from, current)
  const last = logs.at(-1)
  if (last) {
    console.log('ProposalCreated:', last.args[0].toString(), last.args[8] || last.args.description)
  } else {
    console.log('No ProposalCreated logs found (unexpected).')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
