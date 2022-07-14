import path from 'path'
import { ConnectionOptions } from 'typeorm'

const isDevelopment = process.env.NODE_ENV == 'development'

export const options: ConnectionOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3030,
  username: process.env.DB_USER || 'linkdrone_cryptocoin',
  password: process.env.DB_PASS || '123456',
  database: process.env.DB_NAME || 'linkdrone_cryptocoin',
  synchronize: isDevelopment,
  logging: false,
  extra: {},
  maxQueryExecutionTime: 1000, // Show slow query

  entities: [path.resolve(__dirname, '..', 'model', '**', '*.{ts,js}')],
  migrations: [
    //   'src/migration/**/*.ts'
  ],
  subscribers: [
    //   'src/subscriber/**/*.ts'
  ],
}
