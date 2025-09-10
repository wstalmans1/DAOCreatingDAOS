const { expect } = require('chai')
const { ethers, network } = require('hardhat')

describe('CircleFactory/Registry/Governor wiring', () => {
  async function deployRoot() {
    const [deployer, other] = await ethers.getSigners()

    const Token = await ethers.getContractFactory('GovernanceToken')
    const token = await Token.deploy(
      'GovToken',
      'GOV',
      deployer.address,
      ethers.parseUnits('1000000', 18),
    )
    await token.waitForDeployment()
    await (await token.delegate(deployer.address)).wait()

    const Registry = await ethers.getContractFactory('CircleRegistry')
    const registry = await Registry.deploy()
    await registry.waitForDeployment()

    const Factory = await ethers.getContractFactory('CircleFactory')
    const factory = await Factory.deploy(await registry.getAddress())
    await factory.waitForDeployment()
    await (await registry.setFactory(await factory.getAddress())).wait()

    const params = {
      parentId: 0n,
      name: 'Root Circle',
      token: await token.getAddress(),
      votingDelay: 1n,
      votingPeriod: 5n,
      proposalThreshold: 0n,
      quorumNumerator: 4n,
      timelockDelay: 1n,
    }

    const tx = await factory.createCircle(params)
    await tx.wait()

    const rootId = await registry.totalCircles()
    const root = await registry.circles(rootId)
    return { deployer, other, token, registry, factory, rootId, root }
  }

  it('registers root circle and sets roles correctly', async () => {
    const { registry, factory, rootId, root } = await deployRoot()

    expect(root[0]).to.equal(rootId)
    expect(root[1]).to.equal(0n)

    const governorAddr = root[2]
    const timelockAddr = root[3]
    const treasuryAddr = root[4]

    const Timelock = await ethers.getContractFactory('TimelockController')
    const timelock = Timelock.attach(timelockAddr)

    const proposerRole = await timelock.PROPOSER_ROLE()
    const cancellerRole = await timelock.CANCELLER_ROLE()
    const adminRole = await timelock.DEFAULT_ADMIN_ROLE()

    expect(await timelock.hasRole(proposerRole, governorAddr)).to.equal(true)
    expect(await timelock.hasRole(cancellerRole, governorAddr)).to.equal(true)
    expect(await timelock.hasRole(adminRole, await factory.getAddress())).to.equal(false)

    const Treasury = await ethers.getContractFactory('MinimalTreasury')
    const treasury = Treasury.attach(treasuryAddr)
    expect(await treasury.owner()).to.equal(timelockAddr)
  })

  it('only parent timelock can create child circle', async () => {
    const { registry, factory, rootId } = await deployRoot()
    const [, other] = await ethers.getSigners()

    const Token = await ethers.getContractFactory('GovernanceToken')
    const t = await Token.deploy('X', 'X', other.address, 1)
    await t.waitForDeployment()

    const paramsChild = {
      parentId: rootId,
      name: 'Child',
      token: await t.getAddress(),
      votingDelay: 1n,
      votingPeriod: 5n,
      proposalThreshold: 0n,
      quorumNumerator: 4n,
      timelockDelay: 1n,
    }

    await expect(factory.connect(other).createCircle(paramsChild)).to.be.revertedWithCustomError(
      factory,
      'UnauthorizedCreator',
    )

    const root = await registry.circles(rootId)
    const parentTimelock = root[3]
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [parentTimelock],
    })
    await network.provider.request({
      method: 'hardhat_setBalance',
      params: [parentTimelock, '0x3635C9ADC5DEA00000'],
    })
    const tlSigner = await ethers.getSigner(parentTimelock)

    const tx = await factory.connect(tlSigner).createCircle(paramsChild)
    await tx.wait()

    const total = await registry.totalCircles()
    expect(total).to.equal(rootId + 1n)

    const child = await registry.circles(total)
    const childTl = child[3]
    const Timelock = await ethers.getContractFactory('TimelockController')
    const tl = Timelock.attach(childTl)
    const adminRole = await tl.DEFAULT_ADMIN_ROLE()
    expect(await tl.hasRole(adminRole, parentTimelock)).to.equal(true)
  })

  it('enforces treasury max transfer cap', async () => {
    const { root } = await deployRoot()
    const timelockAddr = root[3]
    const treasuryAddr = root[4]

    const Treasury = await ethers.getContractFactory('MinimalTreasury')
    const treasury = Treasury.attach(treasuryAddr)

    await network.provider.request({ method: 'hardhat_impersonateAccount', params: [timelockAddr] })
    await network.provider.request({
      method: 'hardhat_setBalance',
      params: [timelockAddr, '0x3635C9ADC5DEA00000'],
    })
    const tlSigner = await ethers.getSigner(timelockAddr)

    const [deployer] = await ethers.getSigners()
    await (
      await deployer.sendTransaction({ to: treasuryAddr, value: ethers.parseEther('5') })
    ).wait()

    await (await treasury.connect(tlSigner).setMaxTransferAmount(ethers.parseEther('1'))).wait()

    const recipient = (await ethers.getSigners())[1]
    await expect(
      treasury.connect(tlSigner).transferETH(recipient.address, ethers.parseEther('2')),
    ).to.be.revertedWithCustomError(treasury, 'EthTransferLimit')

    const before = await ethers.provider.getBalance(recipient.address)
    await (
      await treasury.connect(tlSigner).transferETH(recipient.address, ethers.parseEther('0.5'))
    ).wait()
    const after = await ethers.provider.getBalance(recipient.address)
    expect(after - before).to.equal(ethers.parseEther('0.5'))
  })
})
