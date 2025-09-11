import React, { useState } from 'react'
import type { Address, Abi } from 'viem'
import { encodeFunctionData } from 'viem'
import { useAccount, usePublicClient, useWatchContractEvent, useWriteContract } from 'wagmi'
import { IVOTES_MINI_ABI, useGovernorToken } from '../../hooks/useGovernor'

type Props = { governor: Address }

export const DelegationPanel: React.FC<Props> = ({ governor }) => {
  const { address } = useAccount()
  const { data: token } = useGovernorToken(governor)
  const publicClient = usePublicClient()
  const { writeContractAsync, isPending } = useWriteContract()

  const [target, setTarget] = useState<Address | ''>('')

  const enabled = Boolean(address && token && publicClient)

  const [stats, setStats] = React.useState<{
    votes: bigint
    delegatee: Address | null
    decimals: number
  } | null>(null)
  const [msg, setMsg] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null)

  async function refresh() {
    if (!enabled || !address || !token || !publicClient) return
    try {
      let decimals = 18
      try {
        const d = (await publicClient.readContract({
          address: token,
          abi: [
            {
              type: 'function',
              name: 'decimals',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint8' }],
            },
          ] as const,
          functionName: 'decimals',
        })) as number
        if (typeof d === 'number') decimals = d
      } catch {
        // default 18
      }

      const [votes, delegatee] = await Promise.all([
        publicClient.readContract({
          address: token,
          abi: IVOTES_MINI_ABI,
          functionName: 'getVotes',
          args: [address],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: token,
          abi: IVOTES_MINI_ABI,
          functionName: 'delegates',
          args: [address],
        }) as Promise<Address>,
      ])
      setStats({ votes, delegatee, decimals })
    } catch {
      setStats(null)
    }
  }

  React.useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, token, publicClient?.chain?.id])

  const tokenAddr = token as `0x${string}` | undefined

  useWatchContractEvent({
    address: tokenAddr,
    abi: IVOTES_MINI_ABI,
    eventName: 'DelegateChanged',
    enabled: Boolean(tokenAddr),
    onLogs: () => refresh(),
  })

  const canDelegate = enabled && !isPending && Boolean(target || address)
  const isLocal = publicClient?.chain?.id === 1337 || publicClient?.chain?.id === 31337
  const targetAddr = (target || address) as Address

  return (
    <div className="border rounded p-3 space-y-2">
      {msg && (
        <div
          className={
            'text-xs px-2 py-1 rounded ' +
            (msg.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : msg.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-slate-50 text-slate-700 border border-slate-200')
          }
        >
          {msg.text}
        </div>
      )}
      <div className="text-xs text-gray-600">
        {stats?.delegatee && (
          <div>
            Delegatee: <span className="font-mono">{stats.delegatee}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <input
          className="flex-1 rounded border border-gray-300 bg-white text-gray-900 px-2 py-1"
          placeholder="Delegate to address (leave empty to self‑delegate)"
          value={target}
          onChange={(e) => setTarget(e.target.value as Address | '')}
        />
        <button
          disabled={!canDelegate}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
          onClick={async () => {
            if (!token) return
            await writeContractAsync({
              address: token,
              abi: IVOTES_MINI_ABI,
              functionName: 'delegate',
              args: [targetAddr],
            })
            setTarget('')
            setTimeout(refresh, 500)
          }}
        >
          {isPending ? 'Delegating…' : target ? 'Delegate' : 'Self‑delegate'}
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Delegations affect proposals created after the next block (snapshot‑based). Existing
        proposals are unaffected.
      </div>

      {isLocal && (
        <div className="pt-2">
          <button
            className="text-sm bg-slate-100 text-slate-700 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200 mr-2"
            disabled={!address || !token || !isLocal}
            onClick={async () => {
              if (!address || !token || !publicClient) return
              try {
                setMsg({ type: 'info', text: 'Funding votes on localhost…' })
                // Try to detect deployer/initial holder by reading mint logs (Transfer from 0x0)
                const zero = '0x0000000000000000000000000000000000000000'
                const latest = await publicClient.getBlockNumber()
                const logs: any[] = await (publicClient as any).getLogs({
                  address: token,
                  event: {
                    type: 'event',
                    name: 'Transfer',
                    inputs: [
                      { name: 'from', type: 'address', indexed: true },
                      { name: 'to', type: 'address', indexed: true },
                      { name: 'value', type: 'uint256', indexed: false },
                    ],
                  } as any,
                  fromBlock: 0n,
                  toBlock: latest,
                })
                const mint = logs.find((l) => l.args?.from?.toLowerCase() === zero)
                const defaultHolder = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address
                const holder: Address = (mint?.args?.to as Address) ?? defaultHolder

                // Read decimals to compute 1000 * 10^decimals
                let decimals = 18
                let isErc20 = true
                try {
                  const d = (await publicClient.readContract({
                    address: token,
                    abi: [
                      {
                        type: 'function',
                        name: 'decimals',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ type: 'uint8' }],
                      },
                    ] as const,
                    functionName: 'decimals',
                  })) as number
                  if (typeof d === 'number') decimals = d
                } catch (e) {
                  // Not an ERC20 (likely ERC1155 SBT); switch path
                  isErc20 = false
                }
                if (isErc20) {
                  const amount = 1000n * 10n ** BigInt(decimals)
                  // Build ERC20 transfer calldata
                  const erc20Abi: Abi = [
                    {
                      type: 'function',
                      name: 'transfer',
                      stateMutability: 'nonpayable',
                      inputs: [
                        { name: 'to', type: 'address' },
                        { name: 'value', type: 'uint256' },
                      ],
                      outputs: [{ type: 'bool' }],
                    },
                  ]
                  const data = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [address, amount],
                  })
                  // Impersonate initial holder and transfer
                  await (publicClient as any).request({
                    method: 'hardhat_impersonateAccount',
                    params: [holder],
                  })
                  let gas: bigint | undefined
                  try {
                    gas = await publicClient.estimateGas({ account: holder, to: token, data })
                  } catch (e) {
                    // ignore estimate failures; node will estimate internally
                  }
                  await (publicClient as any).request({
                    method: 'eth_sendTransaction',
                    params: [
                      {
                        from: holder,
                        to: token,
                        data,
                        gas: gas ? '0x' + gas.toString(16) : undefined,
                      },
                    ],
                  })
                  // Attempt auto self‑delegation via impersonation for convenience
                  try {
                    const dataDel = encodeFunctionData({
                      abi: [
                        {
                          type: 'function',
                          name: 'delegate',
                          stateMutability: 'nonpayable',
                          inputs: [{ name: 'delegatee', type: 'address' }],
                          outputs: [],
                        },
                      ] as const,
                      functionName: 'delegate',
                      args: [address],
                    })
                    await (publicClient as any).request({
                      method: 'hardhat_impersonateAccount',
                      params: [address],
                    })
                    await (publicClient as any).request({
                      method: 'hardhat_setBalance',
                      params: [address, '0x8AC7230489E80000'],
                    })
                    await (publicClient as any).request({
                      method: 'eth_sendTransaction',
                      params: [
                        {
                          from: address,
                          to: token,
                          data: dataDel,
                        },
                      ],
                    })
                    await (publicClient as any).request({
                      method: 'hardhat_stopImpersonatingAccount',
                      params: [address],
                    })
                  } catch (e) {
                    // If this fails, the user can use the Self‑delegate button
                  }
                  await (publicClient as any).request({
                    method: 'hardhat_stopImpersonatingAccount',
                    params: [holder],
                  })
                } else {
                  // Assume Soulbound1155Votes: owner() + mint(address,uint256)
                  const owner = (await publicClient.readContract({
                    address: token,
                    abi: [
                      {
                        type: 'function',
                        name: 'owner',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ type: 'address' }],
                      },
                    ] as const,
                    functionName: 'owner',
                  })) as Address
                  const mintAbi: Abi = [
                    {
                      type: 'function',
                      name: 'mint',
                      stateMutability: 'nonpayable',
                      inputs: [
                        { name: 'to', type: 'address' },
                        { name: 'amount', type: 'uint256' },
                      ],
                      outputs: [],
                    },
                  ]
                  const data = encodeFunctionData({
                    abi: mintAbi,
                    functionName: 'mint',
                    args: [address, 1n],
                  })
                  await (publicClient as any).request({
                    method: 'hardhat_impersonateAccount',
                    params: [owner],
                  })
                  await (publicClient as any).request({
                    method: 'eth_sendTransaction',
                    params: [
                      {
                        from: owner,
                        to: token,
                        data,
                      },
                    ],
                  })
                  await (publicClient as any).request({
                    method: 'hardhat_stopImpersonatingAccount',
                    params: [owner],
                  })
                }
                try {
                  await (publicClient as any).request({ method: 'evm_mine', params: [] })
                } catch (e) {
                  // ignore if evm_mine unsupported
                }
                setTimeout(refresh, 500)
                setMsg({ type: 'success', text: 'Funding complete. Votes will update shortly.' })
              } catch (e) {
                console.error('Local fund failed', e)
                const err = (e as any)?.message || String(e)
                setMsg({ type: 'error', text: `Funding failed: ${err}` })
              }
            }}
          >
            Fund me votes (1000) — localhost only
          </button>
          <button
            className="text-sm bg-slate-100 text-slate-700 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200"
            disabled={!address || !token || !isLocal}
            onClick={async () => {
              if (!address || !token) return
              await writeContractAsync({
                address: token,
                abi: IVOTES_MINI_ABI,
                functionName: 'delegate',
                args: [address],
              })
              try {
                await (publicClient as any)?.request({ method: 'evm_mine', params: [] })
              } catch (e) {
                // ignore if not supported
              }
              setTimeout(refresh, 500)
              setMsg({ type: 'success', text: 'Delegated and mined 1 block.' })
            }}
          >
            Self‑delegate and mine 1 block (localhost)
          </button>
        </div>
      )}
    </div>
  )
}
