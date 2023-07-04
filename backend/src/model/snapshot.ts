import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CommonEntity } from './common'

interface SnapshotContent {
    account_address:string
    tvlTotal:number,
    score:number,
}

@Entity()
export class Snapshot extends CommonEntity {

    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number

    @Column('json')
    content: SnapshotContent[]
}