import axios, { AxiosInstance } from 'axios'
import axiosRetry from 'axios-retry'
import { Provider, constants } from 'starknet'

export class VoyagerService {
  private axiosClient: AxiosInstance

  constructor(private provider: Provider) {
    if (this.provider.chainId === constants.StarknetChainId.MAINNET) {
      this.axiosClient = axios.create({ baseURL: 'https://voyager.online' })
    } else {
      this.axiosClient = axios.create({
        baseURL: 'https://goerli.voyager.online',
      })
    }
    axiosRetry(this.axiosClient, { retries: 3 })
  }

  getAxiosClient() {
    return this.axiosClient
  }

  parseEventId(id: string) {
    const parts = id.split('_')
    if (parts.length < 3) {
      throw new Error('Invalid input string')
    }
    const blockNumber = parseInt(parts[0], 10)
    const txPosition = parseInt(parts[1], 10)
    const eventIndex = parseInt(parts[2], 10)
    return { blockNumber, txPosition, eventIndex }
  }
}
