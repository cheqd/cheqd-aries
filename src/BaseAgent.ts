import type { InitConfig } from '@aries-framework/core'
import { CheqdAnonCredsRegistry, CheqdDidRegistrar, CheqdDidResolver, CheqdModule, CheqdModuleConfig } from '@aries-framework/cheqd'

import {
  AnonCredsCredentialFormatService,
  AnonCredsModule,
  AnonCredsProofFormatService,
} from '@aries-framework/anoncreds'
import { AnonCredsRsModule } from '@aries-framework/anoncreds-rs'
import { AskarModule } from '@aries-framework/askar'
import {
  ConnectionsModule,
  DidsModule,
  V2ProofProtocol,
  V2CredentialProtocol,
  ProofsModule,
  AutoAcceptProof,
  AutoAcceptCredential,
  CredentialsModule,
  Agent,
  HttpOutboundTransport,
} from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'

import { greenText } from './OutputClass'

type DemoAgent = Agent<ReturnType<typeof getAskarAnonCredsCheqdModules>>

export class BaseAgent {
  public port: number
  public name: string
  public config: InitConfig
  public agent: DemoAgent
  public useLegacyIndySdk: boolean

  public constructor({
    port,
    name,
    useLegacyIndySdk = false,
  }: {
    port: number
    name: string
    useLegacyIndySdk?: boolean
  }) {
    this.name = name
    this.port = port

    const config = {
      label: name,
      walletConfig: {
        id: name,
        key: name,
      },
      endpoints: [`http://localhost:${this.port}`],
    } satisfies InitConfig

    this.config = config

    this.useLegacyIndySdk = useLegacyIndySdk

    this.agent = new Agent({
      config,
      dependencies: agentDependencies,
      modules: getAskarAnonCredsCheqdModules(),
    })
    this.agent.registerInboundTransport(new HttpInboundTransport({ port }))
    this.agent.registerOutboundTransport(new HttpOutboundTransport())
  }

  public async initializeAgent() {
    await this.agent.initialize()

    console.log(greenText(`\nAgent ${this.name} created!\n`))
  }
}

function getAskarAnonCredsCheqdModules() {
  return {
    // Connections module is enabled by default, but we can
    // override the default configuration
  
      // Credentials module is enabled by default, but we can
      // override the default configuration
      credentials: new CredentialsModule({
        autoAcceptCredentials: AutoAcceptCredential.Always,
  
        // Support v2 protocol
        credentialProtocols: [
          new V2CredentialProtocol({
            credentialFormats: [new AnonCredsCredentialFormatService()],
          }),
        ],
      }),
  
      // Proofs module is enabled by default, but we can
      // override the default configuration
      proofs: new ProofsModule({
        autoAcceptProofs: AutoAcceptProof.Always,
  
        // Support v2 protocol
        proofProtocols: [
          new V2ProofProtocol({
            proofFormats: [new AnonCredsProofFormatService()],
          }),
        ],
    }),
    anoncreds: new AnonCredsModule({
      registries: [new CheqdAnonCredsRegistry()],
    }),
    anoncredsRs: new AnonCredsRsModule({
      anoncreds,
    }),
    dids: new DidsModule({
      resolvers: [new CheqdDidResolver()],
      registrars: [new CheqdDidRegistrar()]
    }),
    askar: new AskarModule({
      ariesAskar,
    }),
    cheqd: new CheqdModule(new CheqdModuleConfig({
        networks: [
          {
            network: 'testnet',
            cosmosPayerSeed: '000000000000000000000000000cheqd',
          },
        ],
    })),
  } as const
}

// function getLegacyIndySdkModules() {
//   const legacyIndyCredentialFormatService = new LegacyIndyCredentialFormatService()
//   const legacyIndyProofFormatService = new LegacyIndyProofFormatService()

//   return {
//     connections: new ConnectionsModule({
//       autoAcceptConnections: true,
//     }),
//     credentials: new CredentialsModule({
//       autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
//       credentialProtocols: [
//         new V1CredentialProtocol({
//           indyCredentialFormat: legacyIndyCredentialFormatService,
//         }),
//         new V2CredentialProtocol({
//           credentialFormats: [legacyIndyCredentialFormatService],
//         }),
//       ],
//     }),
//     proofs: new ProofsModule({
//       autoAcceptProofs: AutoAcceptProof.ContentApproved,
//       proofProtocols: [
//         new V1ProofProtocol({
//           indyProofFormat: legacyIndyProofFormatService,
//         }),
//         new V2ProofProtocol({
//           proofFormats: [legacyIndyProofFormatService],
//         }),
//       ],
//     }),
//     anoncreds: new AnonCredsModule({
//       registries: [new IndySdkAnonCredsRegistry()],
//     }),
//     indySdk: new IndySdkModule({
//       indySdk,
//       networks: [indyNetworkConfig],
//     }),
//     dids: new DidsModule({
//       resolvers: [new IndySdkSovDidResolver()],
//     }),
//   } as const
// }
