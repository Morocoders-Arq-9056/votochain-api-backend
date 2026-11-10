import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const factory = await ethers.getContractFactory('VotoChainLedger');
  const ledger = await factory.deploy();
  await ledger.waitForDeployment();
  const address = await ledger.getAddress();
  console.log(`VotoChainLedger deployed at ${address}`);
  console.log(`AMOY_LEDGER_ADDRESS=${address}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
