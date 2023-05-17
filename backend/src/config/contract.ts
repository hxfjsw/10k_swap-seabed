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
      '0x525f513c79c6affa761d7adc8f4083e3fe23de697cbc923e2e8c884ce3751a2',
    factory:
      '0x07df3bce30857e8f9c08bcd9d9668df34166e94dd968db6e2920b870c4410e34',
    router:
      '0x07ebd0e95dfc4411045f9424d45a0f132d3e40642c38fdfe0febacf78cc95e76',
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
