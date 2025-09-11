/* eslint-disable */
// Update .env.local from deployments/<network>/root.json
// Usage: node scripts/updateEnvFromDeploy.cjs [network]

const fs = require('fs')
const path = require('path')

function upsertEnv(file, updates) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const lines = content.split(/\r?\n/)
  const keys = Object.keys(updates)
  const set = new Set()
  const out = lines.map((line) => {
    for (const k of keys) {
      if (line.startsWith(k + '=')) {
        set.add(k)
        return `${k}=${updates[k]}`
      }
    }
    return line
  })
  for (const k of keys) {
    if (!set.has(k)) out.push(`${k}=${updates[k]}`)
  }
  fs.writeFileSync(file, out.join('\n'))
}

async function main() {
  const network = process.argv[2] || process.env.HARDHAT_NETWORK || 'localhost'
  const file = path.join('deployments', network, 'root.json')
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment file not found: ${file}`)
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const updates = {
    VITE_REGISTRY_ADDRESS: data.registry || '',
    VITE_FACTORY_ADDRESS: data.factory || '',
    VITE_GOVERNOR_ROOT_ADDRESS: data.root?.governor || '',
    VITE_TIMELOCK_ROOT_ADDRESS: data.root?.timelock || '',
    VITE_TREASURY_ROOT_ADDRESS: data.root?.treasury || '',
    VITE_VOTING_TOKEN_ROOT_ADDRESS: data.token || '',
  }
  upsertEnv(path.join('.env.local'), updates)
  console.log('Updated .env.local with:', updates)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
