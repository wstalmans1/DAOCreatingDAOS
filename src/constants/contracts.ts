export const REGISTRY_ADDRESS = (import.meta.env.VITE_REGISTRY_ADDRESS || '') as `0x${string}`
export const FACTORY_ADDRESS = (import.meta.env.VITE_FACTORY_ADDRESS || '') as `0x${string}`
export const GOVERNOR_ROOT_ADDRESS = (import.meta.env.VITE_GOVERNOR_ROOT_ADDRESS ||
  '') as `0x${string}`
export const TIMELOCK_ROOT_ADDRESS = (import.meta.env.VITE_TIMELOCK_ROOT_ADDRESS ||
  '') as `0x${string}`
export const TREASURY_ROOT_ADDRESS = (import.meta.env.VITE_TREASURY_ROOT_ADDRESS ||
  '') as `0x${string}`
export const VOTING_TOKEN_ROOT_ADDRESS = (import.meta.env.VITE_VOTING_TOKEN_ROOT_ADDRESS ||
  '') as `0x${string}`

export const CIRCLE_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createCircle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'p',
        type: 'tuple',
        components: [
          { name: 'parentId', type: 'uint256' },
          { name: 'name', type: 'string' },
          { name: 'token', type: 'address' },
          { name: 'votingDelay', type: 'uint48' },
          { name: 'votingPeriod', type: 'uint32' },
          { name: 'proposalThreshold', type: 'uint256' },
          { name: 'quorumNumerator', type: 'uint256' },
          { name: 'timelockDelay', type: 'uint48' },
        ],
      },
    ],
    outputs: [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'address' }],
  },
] as const

export const OZ_GOVERNOR_ABI = [
  {
    type: 'function',
    name: 'propose',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'description', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proposalThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const
