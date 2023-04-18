import type { RegisterCredentialDefinitionReturnStateFinished } from '@aries-framework/anoncreds'
import { ConnectionRecord, ConnectionStateChangedEvent, DidDocument, V2CredentialPreview } from '@aries-framework/core'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import { KeyType, TypedArrayEncoder, utils, ConnectionEventTypes } from '@aries-framework/core'
import { ui } from 'inquirer'

import { BaseAgent } from './BaseAgent'
import { Color, greenText, Output, purpleText, redText } from './OutputClass'

export class Faber extends BaseAgent {
  public outOfBandId?: string
  public credentialDefinition?: RegisterCredentialDefinitionReturnStateFinished
  public anonCredsIssuerId?: string
  public ui: BottomBar

  public constructor(port: number, name: string) {
    super({ port, name, useLegacyIndySdk: false })
    this.ui = new ui.BottomBar()
  }

  public static async build(): Promise<Faber> {
    const faber = new Faber(11020, 'faber')
    await faber.initializeAgent()

    // NOTE: we assume the did is already registered on the ledger, we just store the private key in the wallet
    // and store the existing did in the wallet
    const privateKey = TypedArrayEncoder.fromString('afjdemoverysercure00000000000003')

    await faber.agent.wallet.createKey({
      keyType: KeyType.Ed25519,
      privateKey,
    }).catch(()=>{})

    // create a DID
    await faber.agent.dids.import({
        did: "did:cheqd:testnet:2d6841a0-8614-44c0-95c5-d54c61e420f2",
        didDocument: new DidDocument({
            id: "did:cheqd:testnet:2d6841a0-8614-44c0-95c5-d54c61e420f2",
            controller: [
              "did:cheqd:testnet:2d6841a0-8614-44c0-95c5-d54c61e420f2"
            ],
            verificationMethod: [
              {
                "id": "did:cheqd:testnet:2d6841a0-8614-44c0-95c5-d54c61e420f2#key-1",
                "type": "Ed25519VerificationKey2018",
                "controller": "did:cheqd:testnet:2d6841a0-8614-44c0-95c5-d54c61e420f2",
                "publicKeyBase58": "281EuEPGaUVqTn96xFmGMZk5qrMiiPBZhLqGCyBqEPmA"
              }
            ],
            authentication: [
              "did:cheqd:testnet:2d6841a0-8614-44c0-95c5-d54c61e420f2#key-1"
            ],
            assertionMethod: [
                "did:cheqd:testnet:2d6841a0-8614-44c0-95c5-d54c61e420f2#key-1"
            ]
          }),
          privateKeys: [{
            keyType: KeyType.Ed25519,
            privateKey
          }]
    }).catch(()=>{})
    faber.anonCredsIssuerId = 'did:cheqd:testnet:2d6841a0-8614-44c0-95c5-d54c61e420f2' //didResposne.didState.did
    console.log(faber.anonCredsIssuerId)

    return faber
  }

  private async getConnectionRecord() {
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    const [connection] = await this.agent.connections.findAllByOutOfBandId(this.outOfBandId)

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    return connection
  }

  private async printConnectionInvite() {
    const outOfBand = await this.agent.oob.createInvitation({
        autoAcceptConnection: true
    })
    this.outOfBandId = outOfBand.id

    console.log(
      Output.ConnectionLink,
      outOfBand.outOfBandInvitation.toUrl({ domain: `http://localhost:${this.port}` }),
      '\n'
    )
  }

  private async waitForConnection() {
    if (!this.outOfBandId) {
      throw new Error(redText(Output.MissingConnectionRecord))
    }

    console.log('Waiting for Alice to finish connection...')

    const getConnectionRecord = (outOfBandId: string) =>
      new Promise<ConnectionRecord>((resolve, reject) => {
        // Timeout of 20 seconds
        const timeoutId = setTimeout(() => reject(new Error(redText(Output.MissingConnectionRecord))), 40000)

        // Start listener
        this.agent.events.on<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged, (e) => {
          if (e.payload.connectionRecord.outOfBandId !== outOfBandId) return

          clearTimeout(timeoutId)
          resolve(e.payload.connectionRecord)
        })

        // Also retrieve the connection record by invitation if the event has already fired
        void this.agent.connections.findAllByOutOfBandId(outOfBandId).then(([connectionRecord]) => {
          if (connectionRecord) {
            clearTimeout(timeoutId)
            resolve(connectionRecord)
          }
        })
      })

    const connectionRecord = await getConnectionRecord(this.outOfBandId)

    try {
      await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    } catch (e) {
      console.log(redText(`\nTimeout of 20 seconds reached.. Returning to home screen.\n`))
      return
    }
    console.log(greenText(Output.ConnectionEstablished))
  }

  public async setupConnection() {
    await this.printConnectionInvite()
    await this.waitForConnection()
  }

  private printSchema(name: string, version: string, attributes: string[]) {
    console.log(`\n\nThe credential definition will look like this:\n`)
    console.log(purpleText(`Name: ${Color.Reset}${name}`))
    console.log(purpleText(`Version: ${Color.Reset}${version}`))
    console.log(purpleText(`Attributes: ${Color.Reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`))
  }

  private async registerSchema() {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText('Missing anoncreds issuerId'))
    }
    const schemaTemplate = {
      name: 'Faber College' + utils.uuid(),
      version: '1.0.0',
      attrNames: ['name', 'degree'],
      issuerId: this.anonCredsIssuerId,
    }
    this.printSchema(schemaTemplate.name, schemaTemplate.version, schemaTemplate.attrNames)
    this.ui.updateBottomBar(greenText('\nRegistering schema...\n', false))

    const { schemaState } = await this.agent.modules.anoncreds.registerSchema({
      schema: schemaTemplate,
      options: {},
    })

    if (schemaState.state !== 'finished') {
      throw new Error(
        `Error registering schema: ${schemaState.state === 'failed' ? schemaState.reason : 'Not Finished'}`
      )
    }
    this.ui.updateBottomBar(`\n${schemaState.schemaId} Schema registered!\n`)
    return schemaState
  }

  private async registerCredentialDefinition(schemaId: string) {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText('Missing anoncreds issuerId'))
    }

    this.ui.updateBottomBar('\nRegistering credential definition...\n')
    console.log(schemaId, this.anonCredsIssuerId)
    const { credentialDefinitionState } = await this.agent.modules.anoncreds.registerCredentialDefinition({
      credentialDefinition: {
        schemaId,
        issuerId: this.anonCredsIssuerId,
        tag: 'latest',
      },
      options: {},
    })

    if (credentialDefinitionState.state !== 'finished') {
      throw new Error(
        `Error registering credential definition: ${
          credentialDefinitionState.state === 'failed' ? credentialDefinitionState.reason : 'Not Finished'
        }}`
      )
    }

    this.credentialDefinition = credentialDefinitionState
    this.ui.updateBottomBar(`\n${this.credentialDefinition.credentialDefinitionId} Credential definition registered!!\n`)
    return this.credentialDefinition
  }

  private getCredentialPreview() {
    const credentialPreview = V2CredentialPreview.fromRecord({
      name: 'Alice Smith',
      degree: 'Computer Science'
    })
    return credentialPreview
  }

  public async issueCredential() {
    const schema = await this.registerSchema()
    const credentialDefinition = await this.registerCredentialDefinition(schema.schemaId)
    const connectionRecord = await this.getConnectionRecord()
    const credentialPreview = this.getCredentialPreview()
    this.ui.updateBottomBar('\nSending credential offer...\n')

    await this.agent.credentials.offerCredential({
      connectionId: connectionRecord.id,
      protocolVersion: 'v2',
      credentialFormats: {
        anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinition.credentialDefinitionId,
        }
      },
    })
    this.ui.updateBottomBar(
      `\nCredential offer sent!\n\nGo to the Alice agent to accept the credential offer\n\n${Color.Reset}`
    )
  }

  private async printProofFlow(print: string) {
    this.ui.updateBottomBar(print)
    await new Promise((f) => setTimeout(f, 2000))
  }

  private async newProofAttribute() {
    await this.printProofFlow(greenText(`Creating new proof attribute for 'name' ...\n`))
    const proofAttribute = {
      name: {
        name: 'name',
        restrictions: [
          {
            cred_def_id: this.credentialDefinition?.credentialDefinitionId,
          },
        ],
      },
    }

    return proofAttribute
  }

  public async sendProofRequest() {
    const connectionRecord = await this.getConnectionRecord()
    const proofAttribute = await this.newProofAttribute()
    await this.printProofFlow(greenText('\nRequesting proof...\n', false))

    await this.agent.proofs.requestProof({
      protocolVersion: 'v2',
      connectionId: connectionRecord.id,
      proofFormats: {
        anoncreds: {
          name: 'proof-request',
          version: '1.0',
          requested_attributes: proofAttribute,
        },
      },
    })
    this.ui.updateBottomBar(
      `\nProof request sent!\n\nGo to the Alice agent to accept the proof request\n\n${Color.Reset}`
    )
  }

  public async getProofs() {
    const proofs = await this.agent.proofs.getAll()
    for(var proof of proofs) {
      const data = await this.agent.proofs.getFormatData(proof.id)
      console.log(purpleText(`\nverified: ${proof.isVerified}\n`))
      console.log(greenText(`${JSON.stringify(data.presentation?.anoncreds?.requested_proof.revealed_attrs, null, 2)}\n`))
    }
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
