# Anvil + Blockscout Integration Guide

## Overview

This guide explains how to integrate your project with Anvil (local blockchain) and Blockscout (blockchain explorer) for development and testing purposes. It covers both backend and frontend integration, including manual mining controls.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Anvil Setup](#anvil-setup)
3. [Blockscout Setup](#blockscout-setup)
4. [Backend Integration](#backend-integration)
5. [Frontend Integration](#frontend-integration)
6. [Manual Mining Controls](#manual-mining-controls)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Prerequisites

- Docker and Docker Compose installed
- Node.js and npm/yarn
- Git
- Basic understanding of blockchain development

## Anvil Setup

### 1. Install Anvil

```bash
# Install Foundry (includes Anvil)
curl -L https://foundry.rustup.rs | sh
foundryup
```

### 2. Start Anvil in Manual Mode

```bash
# Create Anvil state directory
mkdir -p ~/.anvil

# Start Anvil with manual mining
anvil --host 0.0.0.0 --port 8545 --chain-id 31337 --state ~/.anvil/anvilBlockchainState.json
```

**Key Parameters:**

- `--host 0.0.0.0`: Allows connections from any IP (needed for Docker)
- `--port 8545`: Standard Ethereum RPC port
- `--chain-id 31337`: Anvil's default chain ID
- `--state`: Persists blockchain state between restarts

### 3. Verify Anvil is Running

```bash
# Check if Anvil is responding
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545
```

Expected response: `{"jsonrpc":"2.0","id":1,"result":"0x0"}`

## Blockscout Setup

### 1. Clone and Start Blockscout

```bash
# Clone Blockscout repository
git clone https://github.com/blockscout/blockscout.git
cd blockscout

# Start Blockscout with Docker Compose
docker compose -f docker-compose/docker-compose.yml up -d
```

### 2. Verify Blockscout is Running

```bash
# Check Blockscout API
curl -s http://localhost/api/v2/stats | jq
```

Expected response: Shows block count, addresses, etc.

### 3. Access Blockscout UI

Open your browser and go to: `http://localhost`

## Backend Integration

### 1. Update RPC Configuration

Replace your Hardhat RPC URL with Anvil:

```javascript
// Before (Hardhat)
const RPC_URL = 'http://localhost:8545'

// After (Anvil)
const RPC_URL = 'http://localhost:8545'
// Same URL, but now pointing to Anvil instead of Hardhat
```

### 2. Update Chain ID

```javascript
// Update your chain ID to match Anvil
const CHAIN_ID = 31337 // Anvil's default chain ID
```

### 3. Update Network Configuration

```javascript
// Example with ethers.js
const provider = new ethers.JsonRpcProvider('http://localhost:8545')
const network = await provider.getNetwork()
console.log('Chain ID:', network.chainId) // Should be 31337
```

### 4. Handle Account Management

Anvil provides pre-funded accounts. Get them:

```javascript
// Get Anvil's default accounts
const accounts = await provider.listAccounts()
console.log('Available accounts:', accounts)

// Get private keys (for testing only)
const privateKeys = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  // ... more keys
]
```

## Frontend Integration

### 1. Update Web3 Provider

```javascript
// Update your frontend to connect to Anvil
const provider = new ethers.BrowserProvider(window.ethereum)
// or for direct RPC connection:
const provider = new ethers.JsonRpcProvider('http://localhost:8545')
```

### 2. Update Network Configuration

```javascript
// Add Anvil network to your frontend
const anvilNetwork = {
  chainId: '0x7A69', // 31337 in hex
  chainName: 'Anvil Local',
  rpcUrls: ['http://localhost:8545'],
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

// Add network to MetaMask
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [anvilNetwork],
})
```

## Manual Mining Controls

### 1. Backend Mining Functions

```javascript
// Add these functions to your backend
class AnvilMiner {
  constructor(rpcUrl = 'http://localhost:8545') {
    this.rpcUrl = rpcUrl
  }

  async mineBlock() {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [],
        id: 1,
      }),
    })
    return response.json()
  }

  async mineBlocks(count) {
    const promises = Array(count)
      .fill()
      .map(() => this.mineBlock())
    return Promise.all(promises)
  }

  async getCurrentBlock() {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    })
    const result = await response.json()
    return parseInt(result.result, 16)
  }
}
```

### 2. Frontend Mining Controls

```jsx
// React component for mining controls
import React, { useState, useEffect } from 'react'

const MiningControls = () => {
  const [currentBlock, setCurrentBlock] = useState(0)
  const [isMining, setIsMining] = useState(false)

  const mineBlock = async () => {
    setIsMining(true)
    try {
      const response = await fetch('/api/mine-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      await response.json()
      await updateCurrentBlock()
    } catch (error) {
      console.error('Mining failed:', error)
    } finally {
      setIsMining(false)
    }
  }

  const mineMultipleBlocks = async (count) => {
    setIsMining(true)
    try {
      const response = await fetch('/api/mine-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      })
      await response.json()
      await updateCurrentBlock()
    } catch (error) {
      console.error('Mining failed:', error)
    } finally {
      setIsMining(false)
    }
  }

  const updateCurrentBlock = async () => {
    try {
      const response = await fetch('/api/current-block')
      const data = await response.json()
      setCurrentBlock(data.blockNumber)
    } catch (error) {
      console.error('Failed to get current block:', error)
    }
  }

  useEffect(() => {
    updateCurrentBlock()
    const interval = setInterval(updateCurrentBlock, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="mining-controls">
      <h3>Mining Controls</h3>
      <p>Current Block: {currentBlock}</p>

      <button onClick={mineBlock} disabled={isMining} className="mine-button">
        {isMining ? 'Mining...' : 'Mine 1 Block'}
      </button>

      <button onClick={() => mineMultipleBlocks(5)} disabled={isMining} className="mine-button">
        {isMining ? 'Mining...' : 'Mine 5 Blocks'}
      </button>

      <button onClick={() => mineMultipleBlocks(10)} disabled={isMining} className="mine-button">
        {isMining ? 'Mining...' : 'Mine 10 Blocks'}
      </button>
    </div>
  )
}

export default MiningControls
```

### 3. Backend API Endpoints

```javascript
// Express.js API endpoints
app.post('/api/mine-block', async (req, res) => {
  try {
    const miner = new AnvilMiner()
    const result = await miner.mineBlock()
    res.json({ success: true, result })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/mine-blocks', async (req, res) => {
  try {
    const { count } = req.body
    const miner = new AnvilMiner()
    const result = await miner.mineBlocks(count)
    res.json({ success: true, result })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/current-block', async (req, res) => {
  try {
    const miner = new AnvilMiner()
    const blockNumber = await miner.getCurrentBlock()
    res.json({ blockNumber })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure Anvil is running on port 8545
   - Check if another process is using the port: `lsof -i :8545`

2. **Blockscout Not Showing Blocks**
   - Verify Blockscout is connected to Anvil
   - Check Blockscout logs: `docker compose logs backend`

3. **Frontend Can't Connect**
   - Ensure RPC URL is correct
   - Check if CORS is enabled
   - Verify network configuration

4. **Mining Not Working**
   - Ensure Anvil is running in manual mode (no `--block-time` parameter)
   - Check if RPC calls are reaching Anvil

### Debug Commands

```bash
# Check Anvil status
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545

# Check Blockscout status
curl -s http://localhost/api/v2/stats | jq

# Check Docker containers
docker ps | grep blockscout
```

## Best Practices

### 1. Development Workflow

1. Start Anvil first
2. Start Blockscout
3. Start your application
4. Use manual mining for testing

### 2. State Management

- Use Anvil's `--state` parameter to persist blockchain state
- This allows you to restart Anvil without losing your test data

### 3. Testing Strategy

- Use manual mining for deterministic testing
- Create test scenarios with specific block heights
- Use Blockscout to verify transaction states

### 4. Security

- Never use Anvil private keys in production
- Anvil is for development only
- Use proper key management for production

### 5. Performance

- Anvil is fast but not production-ready
- Use for development and testing only
- Consider using testnets for integration testing

## Example Project Structure

```
your-project/
├── backend/
│   ├── src/
│   │   ├── miners/
│   │   │   └── anvilMiner.js
│   │   └── routes/
│   │       └── mining.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── MiningControls.jsx
│   │   └── utils/
│   │       └── web3.js
│   └── package.json
└── README.md
```

## Conclusion

This guide provides a complete setup for integrating Anvil and Blockscout into your development workflow. The manual mining controls give you precise control over blockchain state for testing, while Blockscout provides a user-friendly interface for exploring your blockchain data.

Remember to always use Anvil for development and testing only, never in production environments.
