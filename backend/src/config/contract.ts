import abiErc20 from './abis/erc20.json'
import abil0kFactory from './abis/l0k_factory.json'
import abil0kPair from './abis/l0k_pair.json'
import abil0kRouter from './abis/l0k_router.json'

export const abis = {
  erc20: abiErc20,
  l0kFactory: abil0kFactory,
  l0kPair: abil0kPair,
  l0kRouter: abil0kRouter,
}

export const addresses = {
  mainnet: {
    parirClassHash:
      '0x231adde42526bad434ca2eb983efdd64472638702f87f97e6e3c084f264e06f',
    factory:
      '0x00d018832f3b2b082f7ebaa3eae2a5323708a7bb7598db620c0dba0e985e9a53',
    router:
      '0x02db369f4fdd98815f0566c0d0ec8f4de09c3500739699e9652e0b1d67974c57',
  },

  goerli: {
    parirClassHash:
      '0x231adde42526bad434ca2eb983efdd64472638702f87f97e6e3c084f264e06f',
    factory:
      '0x021b9f5ea693def6bcf563f088008bd0db0b8ed80763dd7a0fbea112742578ab',
    router:
      '0x027d32f6c2b45c6d9fad20c7e07068061fb593e5d934058cca30bf41839b9306',
  },
}
