import type { InitConfig } from '@aries-framework/core'

import { Agent, AutoAcceptCredential, AutoAcceptProof, HttpOutboundTransport } from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'

import { greenText } from './OutputClass'

export interface Wallet {
  mnemonic: string
  address: string
  seed?: string
}

export class BaseAgent {
  public port: number
  public name: string
  public config: InitConfig
  public agent: Agent
  public wallet: Wallet

  public constructor(port: number, name: string, wallet: Wallet) {
    this.name = name
    this.port = port
    this.wallet = wallet

    const config: InitConfig = {
      label: name,
      walletConfig: {
        id: name,
        key: name,
      },
      ledgerType: 'cheqd',
      cheqdConfig: {
        faucet: {
          prefix: 'cheqd',
          minimalDenom: 'ncheq',
          mnemonic: wallet.mnemonic,
          address: wallet.address,
        },
        rpcUrl: 'https://rpc.cheqd.network',
        resolverUrl: 'https://resolver.cheqd.net'
      },      
      endpoints: [`http://localhost:${this.port}`],
      autoAcceptConnections: true,
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
      autoAcceptProofs: AutoAcceptProof.ContentApproved,
    }

    this.config = config

    this.agent = new Agent(config, agentDependencies)
    this.agent.registerInboundTransport(new HttpInboundTransport({ port }))
    this.agent.registerOutboundTransport(new HttpOutboundTransport())
  }

  public async initializeAgent() {
    await this.agent.initialize()
    console.log(greenText(`\nAgent ${this.name} created!\n`))
  }
}
