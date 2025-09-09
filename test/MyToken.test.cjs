const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('MyToken', function () {
  let myToken
  let owner
  let addr1
  let addr2

  beforeEach(async function () {
    ;[owner, addr1, addr2] = await ethers.getSigners()
    const MyToken = await ethers.getContractFactory('MyToken')
    myToken = await MyToken.deploy()
    await myToken.waitForDeployment()
  })

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await myToken.owner()).to.equal(owner.address)
    })

    it('Should assign the total supply of tokens to the owner', async function () {
      const ownerBalance = await myToken.balanceOf(owner.address)
      expect(await myToken.totalSupply()).to.equal(ownerBalance)
    })
  })

  describe('Transactions', function () {
    it('Should mint tokens to specified address', async function () {
      await myToken.mint(addr1.address, 100)
      const addr1Balance = await myToken.balanceOf(addr1.address)
      expect(addr1Balance).to.equal(100)
    })

    it('Should fail if non-owner tries to mint', async function () {
      await expect(myToken.connect(addr1).mint(addr2.address, 100)).to.be.revertedWithCustomError(
        myToken,
        'OwnableUnauthorizedAccount',
      )
    })
  })
})
