import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CommonEntity } from './common'
import {GetBlockResponse} from "starknet";

@Entity()
export class Snapshot extends CommonEntity {

    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number

    @Column('json')
    content: GetBlockResponse
}