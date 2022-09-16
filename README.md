<h1 align="center"><b>DEMO</b></h1>

This is the Cheqd - Aries Framework Javascript (AFJ) integration demo. Walk through the Cheqd - AFJ flow yourself together with agents Alice and Faber.

Alice, a former student of Faber College, connects with the College, is issued a credential about her degree and then is asked by the College for a proof.

## Features

- ✅ Publish/Resolve DIDs
- ✅ Get account balance 
- ✅ Creating a connection
- ✅ Offering a credential
- ✅ Requesting a proof
- ✅ Sending basic messages

## Getting Started

### Platform Specific Setup

In order to use the demo some platform specific dependencies and setup is required. See the guide below to quickly set up you project.

- [NodeJS](https://aries.js.org/guides/getting-started/installation/nodejs)

### Run the demo

These are the steps for running the Cheqd - AFJ demo:

Clone the cheqd-aries git repository:

```sh
git clone https://github.com/cheqd/cheqd-aries.git
```

Open two different terminals next to each other and in both, go to the demo folder:

```sh
cd cheqd-aries
```

Install the project in one of the terminals:

```sh
yarn install
```

In the left terminal run Alice:

```sh
yarn alice
```

In the right terminal run Faber:

```sh
yarn faber
```

### Usage

Setup Faber:

- Faber College needs a public DID on the cheqd network to issue a credential
- So first lets get some tokens for Faber to publish a DID on cheqd testnet
- Copy the Cheqd Address from the Faber terminal
- Go to https://tesnet-faucet.cheqd.io and get tokens for the cheqd address
- Select `Get account balance` to check the cheqd tokens balance
- Select `Publish your DID` to make the DID public
- Select `Resolve your DID` to fetch the DID document of Faber 

Let's start the Verifiable credential workflow

To set up a connection:

- Select `Create Invitation` in Alice
- Alice will print a invitation link which you then copy
- Select `Recive Invitation` in Faber
- Paste the invitation in Faber
- You have now set up a connection!

To offer a credential:

- Select `Offer credential` in Faber
- Faber will start with registering a schema and the credential definition accordingly
- You have now send a credential offer to Alice!
- Go to Alice to accept the incoming credential offer
- Select `List credentials` in Alice to check the credentials in wallet
- Select `Resolve DID` in Faber to check the schema/credential definition resoures linked to the DID Document

To request a proof:

- Select `Request proof` in Faber
- Faber will create a new proof attribute and will then send a proof request to Alice!
- Go to Alice to accept the incoming proof request
- Select `List Proofs` in Faber to check the proofs received

To send a basic message:

- Select `Send message` in either one of the Agents
- Type your message and press enter
- Message sent!

Exit:

- Select `Exit` to shutdown the agent.

Restart:

- Select `Restart`, to shutdown the current agent and start a new one
- If you want to try the tutorial with a new address and DID delete the `faber.json` file
