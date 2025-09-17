import hre from 'hardhat'
import { parseEther } from 'viem'

async function main() {
  const publicClient = await hre.viem.getPublicClient()
  const [walletClient] = await hre.viem.getWalletClients()

  console.log('Deployer:', walletClient.account.address)

  // Use the correct token address from deployment
  const tokenAddress = '0x5fbdb2315678afecb367f032d93f642f64180aa3' as `0x${string}`
  const recipientAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' as `0x${string}`

  console.log('Token address:', tokenAddress)
  console.log('Recipient address:', recipientAddress)

  // Get token ABI
  const tokenAbi = (await hre.artifacts.readArtifact('GovernanceToken')).abi

  // Transfer 40001 tokens (40001 * 10^18)
  const amount = parseEther('40001')
  console.log('Transferring amount:', amount.toString())

  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: 'transfer',
    args: [recipientAddress, amount],
  })

  console.log('Transfer transaction hash:', hash)

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Transfer confirmed in block:', receipt.blockNumber)

  // Check balance
  const balance = await publicClient.readContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [recipientAddress],
  })

  console.log('Recipient balance:', balance.toString())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
