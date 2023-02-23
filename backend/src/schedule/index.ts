import { getProviderFromEnv, isDevelopEnv } from '../util'
import {
  jobCoinbaseCache,
  jobFaucetTwitter,
  jobPairEventStartWork,
  jobPairTransactionPurify,
  jobPairTransactionAccountAddress,
  jobPoolCollect,
} from './jobs'

export const startMasterJobs = async () => {
  // Only develop env
  if (isDevelopEnv()) jobFaucetTwitter()

  const provider = getProviderFromEnv()

  jobPoolCollect(provider)

  jobCoinbaseCache()

  jobPairEventStartWork(provider)
  jobPairTransactionPurify(provider)
  jobPairTransactionAccountAddress(provider)
}

export const startWorkerJobs = async () => {}
