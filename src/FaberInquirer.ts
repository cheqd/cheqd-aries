import { clear } from 'console'
import { textSync } from 'figlet'
import inquirer from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Faber } from './Faber'
import { Listener } from './Listener'
import { purpleText, Title } from './OutputClass'

export const runFaber = async () => {
  clear()
  console.log(textSync('Faber', { horizontalLayout: 'full' }))
  const faber = await FaberInquirer.build()
  await faber.processAnswer()
}

enum PromptOptions {
  MakeDidPublic = "Publish your DID",
  ResolveDid = "Resolve your DID",
  GetBalance = "Get your account balance",
  ReceiveConnectionUrl = 'Receive connection invitation',
  OfferCredential = 'Offer credential',
  RequestProof = 'Request proof',
  ListProofs = 'List proofs',
  SendMessage = 'Send message',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class FaberInquirer extends BaseInquirer {
  public faber: Faber
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(faber: Faber) {
    super()
    this.faber = faber
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.faber.agent, this.faber.name)
  }

  public static async build(): Promise<FaberInquirer> {
    const faber = await Faber.build()
    return new FaberInquirer(faber)
  }

  private async getPromptChoice() {
    const balance = await this.faber.getAccountBalance()
    const isDidRegistered = await this.faber.resolveDid()

    if(!balance) console.log(purpleText(Title.GetTokens))
    
    if (this.faber.connectionRecordAliceId) return inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
    
    let reducedOption = [PromptOptions.MakeDidPublic, PromptOptions.GetBalance, PromptOptions.Exit, PromptOptions.Restart]
    if (isDidRegistered.didDocument) {
      reducedOption = [PromptOptions.ResolveDid, PromptOptions.ReceiveConnectionUrl, PromptOptions.GetBalance, PromptOptions.Exit, PromptOptions.Restart]
    }
    
    return inquirer.prompt([this.inquireOptions(reducedOption)])
  }

  public async processAnswer() {
    const choice = await this.getPromptChoice()
    if (this.listener.on) return

    switch (choice.options) {
      case PromptOptions.MakeDidPublic:
        await this.registerDid()
        break
      case PromptOptions.ResolveDid:
        await this.resolveDid()
        break
      case PromptOptions.GetBalance:
        await this.getBalance()
        break
      case PromptOptions.ReceiveConnectionUrl:
        await this.connection()
        break
      case PromptOptions.OfferCredential:
        await this.credential()
        return
      case PromptOptions.RequestProof:
        await this.proof()
        return
      case PromptOptions.ListProofs:
        await this.getProofs()
        break
      case PromptOptions.SendMessage:
        await this.message()
        break
      case PromptOptions.Exit:
        await this.exit()
        break
      case PromptOptions.Restart:
        await this.restart()
        return
    }
    await this.processAnswer()
  }

  public async registerDid() {
    const balance = await this.faber.getAccountBalance()
    if(balance) await this.faber.registerDid()
  }

  public async resolveDid() {
    const response = await this.faber.resolveDid()
    console.log('Did document: ', {
      didDocument: response.didDocument,
      resources: response.didDocumentMetadata.linkedResourceMetadata
    })
  }

  public async getBalance() {
    const title = Title.GetBalanceTitle
    console.log('Your current balance: ', await this.faber.getAccountBalance())
  }

  public async connection() {
    const title = Title.InvitationTitle
    const getUrl = await inquirer.prompt([this.inquireInput(title)])
    await this.faber.acceptConnection(getUrl.input)
  }

  public async exitUseCase(title: string) {
    const confirm = await inquirer.prompt([this.inquireConfirmation(title)])
    if (confirm.options === ConfirmOptions.No) {
      return false
    } else if (confirm.options === ConfirmOptions.Yes) {
      return true
    }
  }

  public async credential() {
    await this.faber.issueCredential()
    const title = 'Is the credential offer accepted?'
    await this.listener.newAcceptedPrompt(title, this)
  }

  public async proof() {
    await this.faber.sendProofRequest()
    const title = 'Is the proof request accepted?'
    await this.listener.newAcceptedPrompt(title, this)
  }

  public async getProofs() {
    await this.faber.getProofs()
  }

  public async message() {
    const message = await this.inquireMessage()
    if (message) return

    await this.faber.sendMessage(message)
  }

  public async exit() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.faber.exit()
    }
  }

  public async restart() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      
      await this.faber.restart()
      await runFaber()
    }
  }
}

void runFaber()
