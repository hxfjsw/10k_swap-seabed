import dayjs from 'dayjs'
import {utils} from 'ethers'
import {number as sNumber} from 'starknet'
import {Repository} from 'typeorm'
import {PairTransaction} from '../model/pair_transaction'
import {dateFormatNormal} from '../util'
import {Core} from '../util/core'
import {CoinbaseService} from './coinbase'
import type {Pair} from './pool'
import {PoolService} from './pool'
import {Snapshot} from "../model/snapshot";

export class AnalyticsService {
    private repoPairTransaction: Repository<PairTransaction>
    private repoSnapshot: Repository<Snapshot>

    constructor() {
        this.repoPairTransaction = Core.db.getRepository(PairTransaction)
        this.repoSnapshot = Core.db.getRepository(Snapshot)
    }

    async getTVLsByDay(startTime: Date | undefined = undefined) {
        // QueryBuilder
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        queryBuilder.select(
            `to_char(event_time, 'YYYY-MM-DD') as event_time_day, pair_address, CONCAT(ROUND(SUM(CAST(amount0 as numeric)), 0), '') as sum_amount0, CONCAT(ROUND(SUM(CAST(amount1 as numeric)), 0), '') as sum_amount1, key_name, swap_reverse`
        ) // CONCAT ''. Prevent automatic conversion to scientific notation
        queryBuilder.where('key_name IN (:...keynames)', {
            keynames: ['Mint', 'Burn', 'Swap'],
        })
        queryBuilder
            .addGroupBy('event_time_day')
            .addGroupBy('pair_address')
            .addGroupBy('key_name')
            .addGroupBy('swap_reverse')
        queryBuilder.addOrderBy('event_time_day', 'ASC')

        const rawMany = await queryBuilder.getRawMany<{
            event_time_day: string
            pair_address: string
            sum_amount0: string
            sum_amount1: string
            key_name: string
            swap_reverse: number
        }>()

        const tvls: { date: string; tvl: number }[] = []
        if (rawMany.length > 1) {
            const startDay = dayjs(rawMany[0].event_time_day)
            const endDay = dayjs(rawMany[rawMany.length - 1].event_time_day)

            let tvl_usd = 0
            for (let i = 0; ; i++) {
                const currentDate = startDay.add(i, 'day')
                if (currentDate.unix() > endDay.unix()) {
                    break
                }

                for (const item of rawMany) {
                    if (currentDate.unix() !== dayjs(item.event_time_day).unix()) {
                        continue
                    }

                    const targetPair = this.getTargetPair(item.pair_address)
                    if (!targetPair) {
                        continue
                    }

                    if (item.key_name == 'Swap') {
                        if (item.swap_reverse == 0) {
                            tvl_usd += await this.amount0AddAmount1ForUsd(
                                item.sum_amount0,
                                '-' + item.sum_amount1,
                                targetPair
                            )
                        } else {
                            tvl_usd += await this.amount0AddAmount1ForUsd(
                                '-' + item.sum_amount0,
                                item.sum_amount1,
                                targetPair
                            )
                        }
                    } else {
                        const _usd = await this.amount0AddAmount1ForUsd(
                            item.sum_amount0,
                            item.sum_amount1,
                            targetPair
                        )

                        // TODO: Excessive values may overflow
                        if (item.key_name === 'Mint') tvl_usd += _usd
                        if (item.key_name === 'Burn') tvl_usd -= _usd
                    }
                }

                if (startTime && currentDate.diff(startTime) < 0) continue

                tvls.push({date: currentDate.format('YYYY-MM-DD'), tvl: tvl_usd})
            }
        }

        return tvls
    }

    async getVolumesByDay(startTime: Date | undefined = undefined) {
        // QueryBuilder
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        queryBuilder.select(
            `to_char(event_time, 'YYYY-MM-DD') as event_time_day, pair_address, CONCAT(ROUND(SUM(CAST(amount0 as numeric)), 0), '') as sum_amount0, CONCAT(ROUND(SUM(CAST(amount1 as numeric)), 0), '') as sum_amount1, swap_reverse`
        ) // CONCAT ''. Prevent automatic conversion to scientific notation
        queryBuilder.where('key_name = :keyname', {keyname: 'Swap'})
        queryBuilder
            .addGroupBy('event_time_day')
            .addGroupBy('pair_address')
            .addGroupBy('swap_reverse')
        queryBuilder.addOrderBy('event_time_day', 'ASC')

        const rawMany = await queryBuilder.getRawMany<{
            event_time_day: string
            pair_address: string
            sum_amount0: string
            sum_amount1: string
            swap_reverse: number
        }>()

        const volumes: { date: string; volume: number }[] = []
        if (rawMany.length > 1) {
            const startDay = dayjs(rawMany[0].event_time_day)
            const endDay = dayjs(rawMany[rawMany.length - 1].event_time_day)

            for (let i = 0; ; i++) {
                const currentDate = startDay.add(i, 'day')
                if (currentDate.unix() > endDay.unix()) {
                    break
                }

                let volume_usd = 0
                for (const item of rawMany) {
                    if (currentDate.unix() !== dayjs(item.event_time_day).unix()) {
                        continue
                    }

                    const targetPair = this.getTargetPair(item.pair_address)
                    if (!targetPair) {
                        continue
                    }

                    // TODO: Excessive values may overflow
                    volume_usd += await this.getPairVolumeForUsd(
                        item.sum_amount0,
                        item.sum_amount1,
                        targetPair,
                        item.swap_reverse
                    )
                }

                if (startTime && currentDate.diff(startTime) < 0) continue

                volumes.push({
                    date: currentDate.format('YYYY-MM-DD'),
                    volume: volume_usd,
                })
            }
        }

        return volumes
    }

    async getTransactions(
        startTime: number,
        endTime: number,
        keyName: string,
        page = 1
    ) {
        const limit = 10
        page = page < 1 ? 1 : page

        // QueryBuilder
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        queryBuilder.andWhere(`account_address != ''`)
        if (keyName) {
            queryBuilder.andWhere('key_name = :keyName', {keyName})
        }
        if (startTime > 0) {
            queryBuilder.andWhere('event_time >= :startTimeFormat', {
                startTimeFormat: dateFormatNormal(startTime * 1000),
            })
        }
        if (endTime > 0) {
            queryBuilder.andWhere('event_time <= :endTimeFormat', {
                endTimeFormat: dateFormatNormal(endTime * 1000),
            })
        }
        queryBuilder.addOrderBy('event_time', 'DESC').addOrderBy('id', 'DESC')
        queryBuilder.limit(limit).offset(limit * (page - 1))

        const [transactions, total] = await queryBuilder.getManyAndCount()

        for (const item of transactions) {
            item['token0'] = undefined
            item['token1'] = undefined
            item['amount0_human'] = ''
            item['amount1_human'] = ''
            item['fee_usd'] = ''

            const pair = this.getTargetPair(item.pair_address)
            if (pair) {
                item['token0'] = pair.token0
                item['token1'] = pair.token1

                item['amount0_human'] = utils.formatUnits(
                    item.amount0,
                    pair.token0.decimals
                )
                item['amount1_human'] = utils.formatUnits(
                    item.amount1,
                    pair.token1.decimals
                )

                if (sNumber.toBN(item.fee).gtn(0)) {
                    const coinbaseService = new CoinbaseService()
                    const [_decimals, _symbol] =
                        item.swap_reverse === 0
                            ? [pair.token0.decimals, pair.token0.symbol]
                            : [pair.token1.decimals, pair.token1.symbol]
                    item['fee_usd'] = await coinbaseService.exchangeToUsd(
                        item.fee,
                        _decimals,
                        _symbol
                    )
                }
            }
        }

        return {transactions, total, limit, page}
    }

    async getTransactionsSummary(startTime: number, endTime: number) {
        const swapFees = await this.getPairSwapFees(startTime, endTime)

        const profits: {
            address: string
            name: string
            symbol: string
            decimals: number
            amount: string
            amountHuman: string
        }[] = []
        for (const item of swapFees) {
            const pair = this.getTargetPair(item.pair_address)
            if (!pair) {
                continue
            }

            const feeToken = item.swap_reverse === 0 ? pair.token0 : pair.token1
            const targetProfit = profits.find(
                (profit) => profit.address == feeToken.address
            )
            const amount = sNumber.toBN(item.sum_fee + '')

            if (targetProfit) {
                targetProfit.amount = amount.add(sNumber.toBN(targetProfit.amount)) + ''
                targetProfit.amountHuman = utils.formatUnits(
                    targetProfit.amount,
                    feeToken.decimals
                )
            } else {
                const amountHuman = utils.formatUnits(amount + '', feeToken.decimals)
                profits.push({...feeToken, amount: amount + '', amountHuman})
            }
        }

        // QueryBuilder
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        if (startTime > 0) {
            queryBuilder.andWhere('event_time >= :startTimeFormat', {
                startTimeFormat: dateFormatNormal(startTime * 1000),
            })
        }
        if (endTime > 0) {
            queryBuilder.andWhere('event_time <= :endTimeFormat', {
                endTimeFormat: dateFormatNormal(endTime * 1000),
            })
        }
        const total = await queryBuilder.getCount()

        return {total, profits}
    }

    async getPairs(startTime: number, endTime: number, page = 1) {
        // Currently not working
        const limit = 100
        page = page < 1 ? 1 : page

        const [
            pairVolumes24Hour,
            pairVolumes7Day,
            pairSwapFees24Hour,
            pairSwapFeesTotal,
        ] = await Promise.all([
            this.getPairVolumes24Hour(),
            this.getPairVolumes7Day(),
            this.getPairSwapFees24Hour(),
            this.getPairSwapFees(startTime, endTime),
        ])

        const pairs: (Pair & {
            liquidity: number
            volume24h: number
            volume7d: number
            fees24h: number
            feesTotal: number
        })[] = []
        for (const pair of PoolService.pairs) {
            // Volume(24h)
            let volume24h = 0
            for (const pv24h of pairVolumes24Hour) {
                if (pv24h.pair_address == pair.pairAddress) {
                    volume24h += await this.getPairVolumeForUsd(
                        pv24h.sum_amount0,
                        pv24h.sum_amount1,
                        pair,
                        pv24h.swap_reverse
                    )
                }
            }

            // Volume(7d)
            let volume7d = 0
            for (const pv7d of pairVolumes7Day) {
                if (pv7d.pair_address == pair.pairAddress) {
                    volume7d += await this.getPairVolumeForUsd(
                        pv7d.sum_amount0,
                        pv7d.sum_amount1,
                        pair,
                        pv7d.swap_reverse
                    )
                }
            }

            // fees(24h)
            let f24Amount0 = 0,
                f24Amount1 = 0
            pairSwapFees24Hour.forEach((item) => {
                if (pair.pairAddress == item.pair_address) {
                    if (item.swap_reverse == 0) f24Amount0 += item.sum_fee
                    if (item.swap_reverse == 1) f24Amount1 += item.sum_fee
                }
            })
            const fees24h = await this.amount0AddAmount1ForUsd(
                f24Amount0,
                f24Amount1,
                pair
            )

            // fees(total)
            let fTotalAmount0 = 0,
                fTotalAmount1 = 0
            pairSwapFeesTotal.forEach((item) => {
                if (pair.pairAddress == item.pair_address) {
                    if (item.swap_reverse == 0) fTotalAmount0 += item.sum_fee
                    if (item.swap_reverse == 1) fTotalAmount1 += item.sum_fee
                }
            })
            const feesTotal = await this.amount0AddAmount1ForUsd(
                fTotalAmount0,
                fTotalAmount1,
                pair
            )

            pairs.push({
                ...pair,
                volume24h,
                volume7d,
                fees24h,
                feesTotal,
            })
        }

        return {pairs, total: 0, limit, page}
    }

    async getVolumeByAccount(count = 100) {
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        // queryBuilder.select(
        //   `account_address, pair_address, CONCAT(ROUND(SUM(amount0), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1), 0), '') as sum_amount1, key_name`
        // ) // CONCAT ''. Prevent automatic conversion to scientific notation

        queryBuilder.select(
            `account_address, pair_address, CONCAT(ROUND(SUM(amount0::numeric), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1::numeric), 0), '') as sum_amount1, key_name`
        )
        queryBuilder.where('key_name IN (:...keynames)', {
            keynames: ['Swap'],
        })
        queryBuilder
            .addGroupBy('account_address')
            .addGroupBy('pair_address')
            .addGroupBy('key_name')


        const rawMany = await queryBuilder.getRawMany<{
            account_address: string
            pair_address: string
            sum_amount0: string
            sum_amount1: string
            key_name: string
        }>()


        const volumes: {
            account_address: string
            volumeTotal: number
            volumePairs: { [key: string]: number }
        }[] = []


        if (rawMany.length > 1) {
            const volumeAccountMap: {
                [key: string]: { [key: string]: number }
            } = {}

            for (const item of rawMany) {
                const targetPair = this.getTargetPair(item.pair_address)
                if (!targetPair) {
                    continue
                }

                const usd = await this.amount0AddAmount1ForUsd(
                    item.sum_amount0,
                    item.sum_amount1,
                    targetPair
                )

                const target = volumeAccountMap[item.account_address] || {}
                if (!target[item.pair_address]) target[item.pair_address] = 0

                target[item.pair_address] += usd
                volumeAccountMap[item.account_address] = target

            }

            for (const key in volumeAccountMap) {
                const volumePairs = volumeAccountMap[key]

                let volumeTotal = 0
                for (const key1 in volumePairs) {
                    volumeTotal += volumePairs[key1]
                }

                volumes.push({account_address: key, volumeTotal, volumePairs})
            }

        }


        return volumes.sort((a, b) => b.volumeTotal - a.volumeTotal).slice(0, count)
    }

    async getTVLsByAccount(count = 100) {
        // QueryBuilder
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        // queryBuilder.select(
        //   `account_address, pair_address, CONCAT(ROUND(SUM(amount0), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1), 0), '') as sum_amount1, key_name`
        // ) // CONCAT ''. Prevent automatic conversion to scientific notation

        queryBuilder.select(
            `account_address, pair_address, CONCAT(ROUND(SUM(amount0::numeric), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1::numeric), 0), '') as sum_amount1, key_name`
        )
        queryBuilder.where('key_name IN (:...keynames)', {
            keynames: ['Mint', 'Burn'],
        })
        queryBuilder
            .addGroupBy('account_address')
            .addGroupBy('pair_address')
            .addGroupBy('key_name')


        const rawMany = await queryBuilder.getRawMany<{
            account_address: string
            pair_address: string
            sum_amount0: string
            sum_amount1: string
            key_name: string
        }>()

        const tvls: {
            account_address: string
            tvlTotal: number
            score: number
            since: number
            tvlPairs: { [key: string]: number }
        }[] = []

        if (rawMany.length > 1) {
            const tvlAccountMap: {
                [key: string]: { [key: string]: number }
            } = {}

            for (const item of rawMany) {
                const targetPair = this.getTargetPair(item.pair_address)
                if (!targetPair) {
                    continue
                }

                const _usd = await this.amount0AddAmount1ForUsd(
                    item.sum_amount0,
                    item.sum_amount1,
                    targetPair
                )

                // TODO: Excessive values may overflow
                let tvl_usd = 0
                if (item.key_name === 'Mint') tvl_usd += _usd
                if (item.key_name === 'Burn') tvl_usd -= _usd

                const target = tvlAccountMap[item.account_address] || {}
                if (!target[item.pair_address]) target[item.pair_address] = 0

                target[item.pair_address] += tvl_usd
                tvlAccountMap[item.account_address] = target
            }

            for (const key in tvlAccountMap) {
                const tvlPairs = tvlAccountMap[key]

                let tvlTotal = 0
                for (const key1 in tvlPairs) {
                    tvlTotal += tvlPairs[key1]
                }

                const firstMintTimestamp = await this.getAccountFirstMintTimestamp(key)
                const duration_days = (Date.now() - firstMintTimestamp) / 86400;

                let score = 0;
                if (duration_days >= 30 && tvlTotal >= 20) {
                    //x * ((day-29)^1.25)
                    score = (Number)((tvlTotal * ((duration_days - 29) ^ 1.25)).toFixed(4));
                }


                tvls.push({account_address: key, tvlTotal, tvlPairs, score, since: firstMintTimestamp})
            }
        }

        return tvls.sort((a, b) => b.tvlTotal - a.tvlTotal).slice(0, count)
    }

    private getTargetPair(pairAddress: string) {
        return PoolService.pairs.find((item) => item.pairAddress == pairAddress)
    }

    private async getPairSwapFees(startTime: number, endTime: number) {
        // QueryBuilder
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        queryBuilder.select(
            `pair_address, swap_reverse, CONCAT(ROUND(SUM(CAST(fee AS DECIMAL(256,0))), 0), '') as sum_fee`
        )
        queryBuilder.where('key_name = :key_name', {key_name: 'Swap'})
        if (startTime > 0) {
            queryBuilder.andWhere('event_time >= :startTimeFormat', {
                startTimeFormat: dateFormatNormal(startTime * 1000),
            })
        }
        if (endTime > 0) {
            queryBuilder.andWhere('event_time <= :endTimeFormat', {
                endTimeFormat: dateFormatNormal(endTime * 1000),
            })
        }
        queryBuilder.addGroupBy('pair_address').addGroupBy('swap_reverse')

        return await queryBuilder.getRawMany<{
            pair_address: string
            swap_reverse: number
            sum_fee: number
        }>()
    }

    private async getPairSwapFees24Hour() {
        const startTime = dayjs().subtract(24, 'hour').unix()
        return this.getPairSwapFees(startTime, 0)
    }

    private async getPairVolumes(startTime: number, endTime: number) {
        // QueryBuilder
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        queryBuilder.select(
            `pair_address, CONCAT(ROUND(SUM(CAST(amount0 AS DECIMAL(256,0))), 0), '') as sum_amount0, CONCAT(ROUND(SUM(CAST(amount1 AS DECIMAL(256,0))), 0), '') as sum_amount1, swap_reverse`
        )
        queryBuilder.where('key_name = :key_name', {key_name: 'Swap'})
        if (startTime > 0) {
            queryBuilder.andWhere('event_time >= :startTimeFormat', {
                startTimeFormat: dateFormatNormal(startTime * 1000),
            })
        }
        if (endTime > 0) {
            queryBuilder.andWhere('event_time <= :endTimeFormat', {
                endTimeFormat: dateFormatNormal(endTime * 1000),
            })
        }
        queryBuilder.addGroupBy('pair_address').addGroupBy('swap_reverse')

        return await queryBuilder.getRawMany<{
            pair_address: string
            sum_amount0: string
            sum_amount1: string
            swap_reverse: number
        }>()
    }

    private async getPairVolumes24Hour() {
        const startTime = dayjs().subtract(24, 'hour').unix()
        return this.getPairVolumes(startTime, 0)
    }

    private async getPairVolumes7Day() {
        const startTime = dayjs().subtract(7, 'day').unix()
        return this.getPairVolumes(startTime, 0)
    }

    private async getPairVolumeForUsd(
        amount0: sNumber.BigNumberish | undefined,
        amount1: sNumber.BigNumberish | undefined,
        pair: Pair,
        swap_reverse: number
    ) {
        if (swap_reverse == 0)
            return await this.amount0AddAmount1ForUsd(amount0, 0, pair)

        if (swap_reverse == 1)
            return await this.amount0AddAmount1ForUsd(0, amount1, pair)

        return 0
    }

    private async amount0AddAmount1ForUsd(
        amount0: sNumber.BigNumberish | undefined,
        amount1: sNumber.BigNumberish | undefined,
        pair: Pair
    ) {
        const coinbaseService = new CoinbaseService()
        let amount0Usd = 0,
            amount1Usd = 0
        if (amount0) {
            amount0Usd = await coinbaseService.exchangeToUsd(
                amount0 + '',
                pair.token0.decimals,
                pair.token0.symbol
            )
        }
        if (amount1) {
            amount1Usd = await coinbaseService.exchangeToUsd(
                amount1 + '',
                pair.token1.decimals,
                pair.token1.symbol
            )
        }
        return amount0Usd + amount1Usd
    }

    private async getAccountFirstMintTimestamp(accountAddress: string) {

        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        queryBuilder.select("min(event_time) as min_time")

        queryBuilder.andWhere('account_address = :accountAddress', {accountAddress})

        let res = await queryBuilder.getRawOne()
        let time = res?.min_time.getTime();
        if (time === undefined) {
            return 0;
        } else {
            return time / 1000;
        }

    }

    async takeSnapshot(timestamp: number, json_content) {
        return await this.repoSnapshot.insert({
            content: json_content
        })
    }

    async getRankTVLsByAccount(account_address) {
        // QueryBuilder
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        // queryBuilder.select(
        //   `account_address, pair_address, CONCAT(ROUND(SUM(amount0), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1), 0), '') as sum_amount1, key_name`
        // ) // CONCAT ''. Prevent automatic conversion to scientific notation

        queryBuilder.select(
            `account_address, pair_address, CONCAT(ROUND(SUM(amount0::numeric), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1::numeric), 0), '') as sum_amount1, key_name`
        )
        queryBuilder.where('key_name IN (:...keynames)', {
            keynames: ['Mint', 'Burn'],
        })
        queryBuilder
            .addGroupBy('account_address')
            .addGroupBy('pair_address')
            .addGroupBy('key_name')


        const rawMany = await queryBuilder.getRawMany<{
            account_address: string
            pair_address: string
            sum_amount0: string
            sum_amount1: string
            key_name: string
        }>()

        const tvls: {
            account_address: string
            tvlTotal: number
            score: number
            since: number
            tvlPairs: { [key: string]: number }
        }[] = []

        if (rawMany.length > 1) {
            const tvlAccountMap: {
                [key: string]: { [key: string]: number }
            } = {}

            for (const item of rawMany) {
                const targetPair = this.getTargetPair(item.pair_address)
                if (!targetPair) {
                    continue
                }

                const _usd = await this.amount0AddAmount1ForUsd(
                    item.sum_amount0,
                    item.sum_amount1,
                    targetPair
                )

                // TODO: Excessive values may overflow
                let tvl_usd = 0
                if (item.key_name === 'Mint') tvl_usd += _usd
                if (item.key_name === 'Burn') tvl_usd -= _usd

                const target = tvlAccountMap[item.account_address] || {}
                if (!target[item.pair_address]) target[item.pair_address] = 0

                target[item.pair_address] += tvl_usd
                tvlAccountMap[item.account_address] = target
            }

            for (const key in tvlAccountMap) {
                const tvlPairs = tvlAccountMap[key]

                let tvlTotal = 0
                for (const key1 in tvlPairs) {
                    tvlTotal += tvlPairs[key1]
                }

                const firstMintTimestamp = await this.getAccountFirstMintTimestamp(key)
                const duration_days = (Date.now() - firstMintTimestamp) / 86400;

                let score = 0;
                if (duration_days >= 30 && tvlTotal >= 20) {
                    //x * ((day-29)^1.25)
                    score = (Number)((tvlTotal * ((duration_days - 29) ^ 1.25)).toFixed(4));
                }


                tvls.push({account_address: key, tvlTotal, tvlPairs, score, since: firstMintTimestamp})
            }
        }

        const rank_list = tvls.sort((a, b) => b.tvlTotal - a.tvlTotal);

        for (let i = 0; i < rank_list.length; i++) {
            if (rank_list[i].account_address == account_address) {
                let rank = i + 1;
                return {
                    rank: rank,
                    info: rank_list[i]
                };
            }
        }

        return null;
    }

    async getRankVolumeByAccount(account_address: string) {
        const queryBuilder = this.repoPairTransaction.createQueryBuilder()
        // queryBuilder.select(
        //   `account_address, pair_address, CONCAT(ROUND(SUM(amount0), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1), 0), '') as sum_amount1, key_name`
        // ) // CONCAT ''. Prevent automatic conversion to scientific notation

        queryBuilder.select(
            `account_address, pair_address, CONCAT(ROUND(SUM(amount0::numeric), 0), '') as sum_amount0, CONCAT(ROUND(SUM(amount1::numeric), 0), '') as sum_amount1, key_name`
        )
        queryBuilder.where('key_name IN (:...keynames)', {
            keynames: ['Swap'],
        })
        queryBuilder
            .addGroupBy('account_address')
            .addGroupBy('pair_address')
            .addGroupBy('key_name')


        const rawMany = await queryBuilder.getRawMany<{
            account_address: string
            pair_address: string
            sum_amount0: string
            sum_amount1: string
            key_name: string
        }>()


        const volumes: {
            account_address: string
            volumeTotal: number
            volumePairs: { [key: string]: number }
        }[] = []


        if (rawMany.length > 1) {
            const volumeAccountMap: {
                [key: string]: { [key: string]: number }
            } = {}

            for (const item of rawMany) {
                const targetPair = this.getTargetPair(item.pair_address)
                if (!targetPair) {
                    continue
                }

                const usd = await this.amount0AddAmount1ForUsd(
                    item.sum_amount0,
                    item.sum_amount1,
                    targetPair
                )

                const target = volumeAccountMap[item.account_address] || {}
                if (!target[item.pair_address]) target[item.pair_address] = 0

                target[item.pair_address] += usd
                volumeAccountMap[item.account_address] = target

            }

            for (const key in volumeAccountMap) {
                const volumePairs = volumeAccountMap[key]

                let volumeTotal = 0
                for (const key1 in volumePairs) {
                    volumeTotal += volumePairs[key1]
                }

                volumes.push({account_address: key, volumeTotal, volumePairs})
            }

        }


        let rank_list = volumes.sort((a, b) => b.volumeTotal - a.volumeTotal);

        for (let i = 0; i < rank_list.length; i++) {
            if (rank_list[i].account_address == account_address) {
                let rank = i + 1;
                return {
                    rank: rank,
                    info: rank_list[i]
                };
            }
        }

        return null;
    }

    async getSnapshotTVLsByAccount() {
        const snapshots = await this.repoSnapshot.find({
            order: { created_at: 'ASC' },
        });

        interface tvl{
            account_address: string
            score: number
            tvlTotal: number
        }

        let tvls = new Map<string, tvl>();

        for (let i = 0; i < snapshots.length; i++) {
            const snapshot = snapshots[i];
            const content = snapshot.content;
            for (let j = 0; j < content.length; j++) {
                const item = content[j];
                const account_address = item.account_address;
                const score = item.score;
                const tvlTotal = item.tvlTotal;
                if (tvls[account_address] == null) {
                    tvls[account_address] = {account_address, score, tvlTotal};
                } else {
                    tvls[account_address].score += score;
                    tvls[account_address].tvlTotal = tvlTotal;
                }
            }
        }

        let result:tvl[] = [];
        for (let key in tvls) {
            result.push(tvls[key]);
        }

        result.sort((a, b) => b.score - a.score);

        return result;
    }
}