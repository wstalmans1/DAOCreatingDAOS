require('dotenv').config()
require('@nomicfoundation/hardhat-toolbox')
require('@nomicfoundation/hardhat-viem')

const config = {
  solidity: {
    version: '0.8.30',
    settings: {
      evmVersion: 'cancun',
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
      allowUnlimitedContractSize: true,
    },
    anvil: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
      allowUnlimitedContractSize: true,
      accounts: [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
      ],    },
    sepolia: {
      url:
        process.env.SEPOLIA_RPC_URL ||
        `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "anvil",
        chainId: 31337,
        urls: {
          apiURL: "http://localhost/api", // Blockscout API URL
          browserURL: "http://localhost"  // Blockscout browser URL
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
}

module.exports = config
