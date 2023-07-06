import {plainToInstance} from 'class-transformer'
import {Context, DefaultState} from 'koa'
import KoaRouter from 'koa-router'
import {AnalyticsService} from '../service/analytics'
import {AnalyticsServiceCache} from '../service/analytics_cache'
import {number} from "starknet";
import any = jasmine.any;

export default function (router: KoaRouter<DefaultState, Context>) {
    const analyticsService = new AnalyticsService()

    router.get('analytics', async ({restful}) => {
        const {tvlsByDay, volumesByDay} = AnalyticsServiceCache.cache

        restful.json({tvls: tvlsByDay, volumes: volumesByDay})
    })

    router.get('analytics/pairs', async ({restful, request}) => {
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

        for (let i = 0; i < pairs.pairs.length; i++) {
            if (pairs.pairs[i].liquidity < 0.01) {
                pairs.pairs.splice(i, 1);
                i--;
            }
        }

        restful.json(pairs)
    })

    router.get('analytics/transactions', async ({restful, request}) => {
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

        restful.json({transactions, summary})
    })

    router.get('analytics/top_tvl_accounts', async ({restful, request}) => {
        const params = plainToInstance(
            class {
                page: number
            },
            request.query
        )

        const tvls = await analyticsService.getTVLsByAccount()

        restful.json({
            page: params.page,
            limit: 25,
            tvls: tvls.slice((params.page - 1) * 25, params.page * 25),
        })
    })

    router.get('analytics/top_volume_accounts', async ({restful, request}) => {

        const params = plainToInstance(
            class {
                page: number
            },
            request.query
        )

        const volumes = await analyticsService.getVolumeByAccount()
        restful.json({
            page: params.page,
            limit: 25,
            volumes: volumes.slice((params.page - 1) * 25, params.page * 25),
        })
    })

    router.get('analytics/take_top_tvl_accounts', async ({restful}) => {
        const tvls = await analyticsService.getTVLsByAccount(1000000000)
        const dateStamp = new Date(new Date().toLocaleDateString()).getTime();
        const insert = await analyticsService.takeSnapshot(dateStamp, tvls)
        restful.json({tvls})
    })

    router.get('analytics/rank_tvl_accounts', async ({restful, request}) => {
        const params = plainToInstance(
            class {
                account_address: string
            },
            request.query
        )
        const rank = await analyticsService.getRankTVLsByAccount(params.account_address)
        restful.json({rank})
    })

    router.get('analytics/rank_volume_accounts', async ({restful, request}) => {
        const params = plainToInstance(
            class {
                account_address: string
            },
            request.query
        )
        const rank = await analyticsService.getRankVolumeByAccount(params.account_address)
        restful.json({rank})
    })

    router.get('analytics/get_snapshots', async ({restful, request}) => {
        const params = plainToInstance(
            class {
                page: number
            },
            request.query
        )

        const snapshots = await analyticsService.getSnapshotTVLsByAccount()

        restful.json({
            page: params.page,
            limit: 25,
            tvls: snapshots.slice((params.page - 1) * 25, params.page * 25),
        })

    })

    router.get('analytics/rank_snapshot_tvl_accounts', async ({restful, request}) => {
        const params = plainToInstance(
            class {
                account_address: string
            },
            request.query
        )

        interface tvl {
            account_address: string
            score: number
            tvlTotal: number
        }

        const snapshots: tvl[] = await analyticsService.getSnapshotTVLsByAccount()

        let total = 0;

        let result: {
            rank: number,
            info: tvl | null,
            top: number,
            total: number
        } = {
            rank: 0,
            info: null,
            top: 0,
            total: total
        };

        for (let i = 0; i < snapshots.length; i++) {
            if (snapshots[i].score > 0) {
                total++;
            }
        }


        for (let i = 0; i < snapshots.length; i++) {
            if (params.account_address == snapshots[i].account_address) {
                result = {
                    rank: i + 1,
                    info: snapshots[i],
                    top: (i + 1) / total,
                    total: total
                }
                break;
            }
        }
        restful.json({rank: result})
    })


}
