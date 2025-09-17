import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import hre from 'hardhat'

type ContractConfig = {
  name: string
  address: string
  constructorArgs: unknown[]
}

type VerificationParams = {
  contractaddress: string
  sourceCode: string
  codeformat: string
  contractname: string
  compilerversion: string
  optimizationUsed: string
  runs: string
  constructorArguements: string
  evmversion?: string
  apikey?: string
}

const BLOCKSCOUT_API_URL = process.env.BLOCKSCOUT_API_URL ?? 'http://localhost/api'
const BLOCKSCOUT_API_KEY = process.env.BLOCKSCOUT_API_KEY ?? ''
const BLOCKSCOUT_POLL_INTERVAL = Number(process.env.BLOCKSCOUT_POLL_INTERVAL ?? '3000')
const BLOCKSCOUT_POLL_TIMEOUT = Number(process.env.BLOCKSCOUT_POLL_TIMEOUT ?? '120000')
const DEPLOYMENTS_ROOT =
  process.env.DEPLOYMENTS_ROOT ?? path.join('deployments', 'anvil', 'root.json')

function resolveRpcUrl(): string {
  const fromEnv = process.env.BLOCKSCOUT_RPC_URL ?? process.env.VERIFICATION_RPC_URL
  if (fromEnv) return fromEnv
  const configUrl = (hre.network.config as { url?: string } | undefined)?.url
  if (configUrl) return configUrl
  return 'http://127.0.0.1:8545'
}

function assertNonEmpty(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message)
  }
  return value
}

async function loadContracts(): Promise<ContractConfig[]> {
  if (!fs.existsSync(DEPLOYMENTS_ROOT)) {
    throw new Error(`Deployment file not found: ${DEPLOYMENTS_ROOT}`)
  }

  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENTS_ROOT, 'utf8'))

  const configs: ContractConfig[] = [
    {
      name: 'GovernanceToken',
      address: assertNonEmpty(
        deployment.token,
        'GovernanceToken address missing in deployment file',
      ),
      constructorArgs: [
        'GovToken',
        'GOV',
        '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
        '1000000000000000000000000',
      ],
    },
    {
      name: 'CircleRegistry',
      address: assertNonEmpty(
        deployment.registry,
        'CircleRegistry address missing in deployment file',
      ),
      constructorArgs: [],
    },
    {
      name: 'CircleFactory',
      address: assertNonEmpty(
        deployment.factory,
        'CircleFactory address missing in deployment file',
      ),
      constructorArgs: [
        assertNonEmpty(deployment.registry, 'CircleFactory constructor requires registry address'),
      ],
    },
  ]

  const root = deployment.root ?? {}
  const rootGovernor = root.governor as string | undefined
  const rootTimelock = root.timelock as string | undefined
  const rootTreasury = root.treasury as string | undefined
  const registryAddress = assertNonEmpty(
    deployment.registry,
    'Registry address missing in deployment data',
  )

  if (rootGovernor && rootTimelock && rootTreasury) {
    try {
      const rootId = BigInt(root.id ?? '1')
      const rpcUrl = resolveRpcUrl()
      const provider = new hre.ethers.JsonRpcProvider(rpcUrl)
      const registryArtifact = await hre.artifacts.readArtifact('CircleRegistry')
      const registryContract = new hre.ethers.Contract(
        registryAddress,
        registryArtifact.abi,
        provider,
      ) as any
      const circle: any = await registryContract.circles(rootId)

      const circleName: string = circle.name ?? circle[6]
      const circleToken: string = circle.token ?? circle[5]

      const governorArtifact = await hre.artifacts.readArtifact('CircleGovernor')
      const governorContract = new hre.ethers.Contract(
        rootGovernor,
        governorArtifact.abi,
        provider,
      ) as any
      const votingDelay = (await governorContract.votingDelay()) as bigint
      const votingPeriod = (await governorContract.votingPeriod()) as bigint
      const proposalThreshold = (await governorContract.proposalThreshold()) as bigint
      const quorumNumerator = (await governorContract.quorumNumerator()) as bigint

      configs.push({
        name: 'CircleGovernor',
        address: rootGovernor,
        constructorArgs: [
          circleName,
          circleToken,
          rootTimelock,
          votingDelay,
          votingPeriod,
          proposalThreshold,
          quorumNumerator,
        ],
      })

      const timelockArtifact = await hre.artifacts.readArtifact('TimelockController')
      const timelockContract = new hre.ethers.Contract(
        rootTimelock,
        timelockArtifact.abi,
        provider,
      ) as any
      const minDelay = (await timelockContract.getMinDelay()) as bigint

      configs.push({
        name: 'TimelockController',
        address: rootTimelock,
        constructorArgs: [
          minDelay,
          [],
          [hre.ethers.ZeroAddress],
          assertNonEmpty(deployment.factory, 'Factory address missing in deployment data'),
        ],
      })

      configs.push({
        name: 'MinimalTreasury',
        address: rootTreasury,
        constructorArgs: [rootTimelock],
      })
    } catch (error) {
      console.warn('⚠️  Unable to load root circle metadata for verification:', error)
    }
  }

  const seen = new Set<string>()
  return configs.filter((contract) => {
    const address = contract.address.toLowerCase()
    if (address === '0x0000000000000000000000000000000000000000') return false
    if (seen.has(address)) return false
    seen.add(address)
    return true
  })
}

async function buildVerificationPayload(config: ContractConfig): Promise<VerificationParams> {
  const artifact = await hre.artifacts.readArtifact(config.name)
  const fqName = `${artifact.sourceName}:${artifact.contractName}`
  const buildInfo = await hre.artifacts.getBuildInfo(fqName)

  if (!buildInfo) {
    throw new Error(`Build info not found for ${config.name}. Try running \`pnpm compile\` first.`)
  }

  const constructor = artifact.abi.find((entry) => entry.type === 'constructor')
  const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder()
  const types = constructor?.inputs?.map((input) => input.type) ?? []
  const values = config.constructorArgs
  const encodedArgs = types.length > 0 ? abiCoder.encode(types, values).replace(/^0x/, '') : ''

  const optimizerEnabled = buildInfo.input.settings.optimizer?.enabled ? '1' : '0'
  const optimizerRuns = (buildInfo.input.settings.optimizer?.runs ?? 0).toString()
  const evmVersion = buildInfo.input.settings.evmVersion
  const compilerVersion = `v${buildInfo.solcLongVersion}`

  return {
    contractaddress: config.address,
    sourceCode: JSON.stringify(buildInfo.input),
    codeformat: 'solidity-standard-json-input',
    contractname: fqName,
    compilerversion: compilerVersion,
    optimizationUsed: optimizerEnabled,
    runs: optimizerRuns,
    constructorArguements: encodedArgs,
    evmversion: evmVersion,
    apikey: BLOCKSCOUT_API_KEY,
  }
}

const ALREADY_VERIFIED = 'ALREADY_VERIFIED'

async function submitVerification(params: VerificationParams): Promise<string> {
  const body = new URLSearchParams({ module: 'contract', action: 'verifysourcecode' })

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    body.append(key, value)
  }

  const response = await fetch(BLOCKSCOUT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`Blockscout API returned HTTP ${response.status}`)
  }

  const json = (await response.json()) as { status: string; message: string; result: string }
  if (json.status !== '1') {
    const message = (json.result || json.message || '').toLowerCase()
    if (message.includes('already verified')) {
      return ALREADY_VERIFIED
    }
    throw new Error(`Verification submission failed: ${json.result || json.message}`)
  }

  return json.result
}

async function waitForVerificationResult(guid: string): Promise<string> {
  const params = new URLSearchParams({ module: 'contract', action: 'checkverifystatus', guid })
  const deadline = Date.now() + BLOCKSCOUT_POLL_TIMEOUT

  while (Date.now() < deadline) {
    const response = await fetch(`${BLOCKSCOUT_API_URL}?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`Verification status check failed with HTTP ${response.status}`)
    }

    const json = (await response.json()) as { status: string; message: string; result: string }

    // Blockscout mirrors Etherscan's responses
    if (json.status === '1' && json.result.toLowerCase().includes('already verified')) {
      return json.result
    }

    if (json.status === '1' && json.result.toLowerCase().includes('pass')) {
      return json.result
    }

    if (json.status === '0' && json.result.toLowerCase().includes('pending')) {
      await new Promise((resolve) => setTimeout(resolve, BLOCKSCOUT_POLL_INTERVAL))
      continue
    }

    if (json.status === '0' && json.result) {
      throw new Error(`Verification failed: ${json.result}`)
    }

    await new Promise((resolve) => setTimeout(resolve, BLOCKSCOUT_POLL_INTERVAL))
  }

  throw new Error(`Verification timed out after ${BLOCKSCOUT_POLL_TIMEOUT / 1000}s`)
}

async function verifyContract(config: ContractConfig) {
  console.log(`\n🔍 Verifying ${config.name} at ${config.address}`)
  const payload = await buildVerificationPayload(config)
  console.log('   Submitting verification to Blockscout...')
  const guid = await submitVerification(payload)

  if (guid === ALREADY_VERIFIED) {
    console.log(`✅ ${config.name} is already verified on Blockscout`)
    return
  }

  console.log(`   Submission accepted. GUID: ${guid}`)
  const result = await waitForVerificationResult(guid)
  console.log(`✅ ${config.name} verification result: ${result}`)
}

export async function runBlockscoutVerification() {
  console.log('🚀 Blockscout verification starting...')
  console.log(`   → API endpoint: ${BLOCKSCOUT_API_URL}`)

  const contracts = await loadContracts()
  if (contracts.length === 0) {
    console.log('No contracts to verify.')
    return
  }

  await hre.run('compile')

  for (const contract of contracts) {
    try {
      await verifyContract(contract)
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Verification failed for ${contract.name}: ${error.message}`)
      } else {
        console.error(`❌ Verification failed for ${contract.name}:`, error)
      }
    }
  }

  console.log('\n🎉 Verification script finished.')
}

const isExecutedDirectly = (() => {
  if (typeof process === 'undefined') return false
  const scriptPath = process.argv[1]
  if (!scriptPath) return false
  return import.meta.url === pathToFileURL(path.resolve(scriptPath)).href
})()

if (isExecutedDirectly) {
  runBlockscoutVerification().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
