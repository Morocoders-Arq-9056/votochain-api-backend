import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: { chainId: 31337 },
    amoy: {
      url: process.env.AMOY_RPC_URL ?? 'https://polygon-amoy.drpc.org',
      chainId: 80002,
      accounts: process.env.AMOY_PAYER_KEY ? [process.env.AMOY_PAYER_KEY] : [],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
  },
};

export default config;
