import type { ConnectionRecord } from '@aries-framework/core'
import type { CredDef, Schema } from 'indy-sdk'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import { V1CredentialPreview, AttributeFilter, ProofAttributeInfo, utils } from '@aries-framework/core'
import { ui } from 'inquirer'

import { BaseAgent, Wallet } from './BaseAgent'
import { Color, greenText, Output, purpleText, redText } from './OutputClass'

import { generateKeyPairFromSeed } from '@stablelib/ed25519'
import { TypedArrayEncoder } from '@aries-framework/core/build/utils'
import { createVerificationKeys } from '@cheqd/sdk'
import { MethodSpecificIdAlgo } from '@cheqd/sdk/build/types'
import { toString } from 'uint8arrays'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { StargateClient } from '@cosmjs/stargate'
import { existsSync, readFileSync, writeFileSync } from 'fs' 
import fetch from 'node-fetch'

export class Faber extends BaseAgent {
  public connectionRecordAliceId?: string
  public credentialDefinition?: CredDef
  public ui: BottomBar
  public did?: string

  public constructor(port: number, name: string, wallet: Wallet) {
    super(port, name, wallet)
    this.ui = new ui.BottomBar()
    this.config.publicDidSeed = wallet.seed
  }

  public static async build(): Promise<Faber> {
    const account = await DirectSecp256k1HdWallet.generate(undefined, {prefix: 'cheqd'})
    let wallet:Wallet

    if (existsSync('./faber.json')) {
      wallet =  JSON.parse(readFileSync("./faber.json", 'utf-8'))
    } else {
      wallet = {
        address: (await account.getAccounts())[0].address,
        mnemonic: account.mnemonic,
        seed: Math.random().toString(2).substring(2, 34)
      }
      writeFileSync('./faber.json', JSON.stringify(wallet))
    }

    const faber = new Faber(9001, 'faber', wallet)
    await faber.initializeAgent()

    console.log(greenText(`Your Cheqd address: ${wallet.address}`))

    return faber
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordAliceId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    return await this.agent.connections.getById(this.connectionRecordAliceId)
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    const { connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(invitationUrl)
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand))
    }
    return connectionRecord
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(greenText(Output.ConnectionEstablished))
    return connectionRecord.id
  }

  public async registerDid() {
    try {
      await this.agent.ledger.registerPublicDid("", "", "")
      console.log(greenText(`${this.did} registered successfully`))
    } catch {
      console.log('Please try again, Failed to register DID')
    }
  }

  public async resolveDid() {
    if (!this.did) {
      const seed = this.agent.config.publicDidSeed!
      const keyPair = generateKeyPairFromSeed(TypedArrayEncoder.fromString(seed))
      const cheqdKeyPair = {
        publicKey: toString(keyPair.publicKey, 'base64'),
        privateKey: toString(keyPair.secretKey, 'base64'),
      }
      const verificationKey = createVerificationKeys(cheqdKeyPair, MethodSpecificIdAlgo.Base58, 'key-1')
      this.did = verificationKey.didUrl
      console.log('Your DID: ', this.did)
    } 
    try {
      const resp = await fetch(`${this.config.cheqdConfig!.resolverUrl}/1.0/identifiers/${this.did}`)
      return await resp.json()
    } catch {
      return null
    }
  }

  public async getAccountBalance() {
    const client = await StargateClient.connect(this.config.cheqdConfig!.rpcUrl)
    const balance = await client.getBalance(this.wallet.address, 'ncheq')
    return parseInt(balance.amount)
  }

  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    this.connectionRecordAliceId = await this.waitForConnection(connectionRecord)
  }

  private printSchema(name: string, version: string, attributes: string[]) {
    console.log(`\n\nThe credential definition will look like this:\n`)
    console.log(purpleText(`Name: ${Color.Reset}${name}`))
    console.log(purpleText(`Version: ${Color.Reset}${version}`))
    console.log(purpleText(`Attributes: ${Color.Reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`))
  }

  private async registerSchema() {
    const schemaTemplate = {
      name: 'FaberCollege' + utils.uuid(),
      version: '1.0',
      attributes: ['name', 'degree', 'date'],
    }
    this.printSchema(schemaTemplate.name, schemaTemplate.version, schemaTemplate.attributes)
    this.ui.updateBottomBar(greenText('\nRegistering schema...\n', false))
    const schema = await this.agent.ledger.registerSchema(schemaTemplate)
    this.ui.updateBottomBar('\nSchema registered!\n')
    return schema
  }

  private async registerCredentialDefinition(schema: Schema) {
    this.ui.updateBottomBar('\nRegistering credential definition...\n')
    this.credentialDefinition = await this.agent.ledger.registerCredentialDefinition({
      schema,
      tag: 'latest',
      supportRevocation: false,
    })
    this.ui.updateBottomBar('\nCredential definition registered!!\n')
    return this.credentialDefinition
  }

  private getCredentialPreview() {
    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'Alice Smith',
      degree: 'Computer Science',
      date: '01/01/2022',
    })
    return credentialPreview
  }

  public async issueCredential() {
    const schema = await this.registerSchema()
    const credDef = await this.registerCredentialDefinition(schema)
    const credentialPreview = this.getCredentialPreview()
    const connectionRecord = await this.getConnectionRecord()

    this.ui.updateBottomBar('\nSending credential offer...\n')

    await this.agent.credentials.offerCredential({
      connectionId: connectionRecord.id,
      protocolVersion: 'v1',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDef.id,
        },
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
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: this.credentialDefinition?.id,
          }),
        ],
      }),
    }
    return proofAttribute
  }

  public async sendProofRequest() {
    const connectionRecord = await this.getConnectionRecord()
    const proofAttribute = await this.newProofAttribute()
    await this.printProofFlow(greenText('\nRequesting proof...\n', false))
    await this.agent.proofs.requestProof(connectionRecord.id, {
      requestedAttributes: proofAttribute,
    })
    this.ui.updateBottomBar(
      `\nProof request sent!\n\nGo to the Alice agent to accept the proof request\n\n${Color.Reset}`
    )
  }

  public async getProofs() {
    const proofs = await this.agent.proofs.getAll()
    for(var proof of proofs) {
      if(proof.presentationMessage) 
        console.log(proof.presentationMessage.indyProof?.requested_proof, "\n")
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
