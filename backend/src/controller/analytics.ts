import { plainToInstance } from 'class-transformer'
import { Context, DefaultState } from 'koa'
import KoaRouter from 'koa-router'
import { AnalyticsService } from '../service/analytics'
import { AnalyticsServiceCache } from '../service/analytics_cache'

export default function (router: KoaRouter<DefaultState, Context>) {
  const analyticsService = new AnalyticsService()

  router.get('analytics', async ({ restful }) => {
    const { tvlsByDay, volumesByDay } = AnalyticsServiceCache.cache

    restful.json({ tvls: tvlsByDay, volumes: volumesByDay })
  })

  router.get('analytics/pairs', async ({ restful, request }) => {
    const params = plainToInstance(
      class {
        startTime: number
        endTime: number
        page: number
      },
      request.query
    )

    const pairs = await analyticsService.getPairs(
      params.startTime,
      params.endTime,
      params.page
    )

      for(let i=0;i<pairs.pairs.length;i++){
          if(pairs.pairs[i].liquidity <0.01){
                pairs.pairs.splice(i,1);
                i--;
          }
      }

    restful.json(pairs)
  })

  router.get('analytics/transactions', async ({ restful, request }) => {
    const params = plainToInstance(
      class {
        startTime: number
        endTime: number
        keyName: string
        page: number
      },
      request.query
    )

    const [transactions, summary] = await Promise.all([
      analyticsService.getTransactions(
        params.startTime,
        params.endTime,
        params.keyName,
        params.page
      ),
      analyticsService.getTransactionsSummary(params.startTime, params.endTime),
    ])

    restful.json({ transactions, summary })
  })

  router.get('analytics/top_tvl_accounts', async ({ restful }) => {
    const tvls = await analyticsService.getTVLsByAccount()
    restful.json({ tvls })
  })

  router.get('analytics/top_volume_accounts', async ({ restful }) => {
      const volumes = await analyticsService.getVolumeByAccount()
      restful.json({ volumes })
  })
}
