import { AnalyticsService } from './analytics'

export class AnalyticsServiceCache {
  public static tvlsByDay: {
    date: string
    tvl: number
  }[] = []
  public static volumesByDay: {
    date: string
    volume: number
  }[] = []

  async cacheTVLsByDayAndVolumesByDay() {
    const analyticsService = new AnalyticsService()

    const _tvlsByDay = await analyticsService.getTVLsByDay()
    if (_tvlsByDay.length > 0) {
      AnalyticsServiceCache.tvlsByDay = _tvlsByDay
    }

    const _volumesByDay = await analyticsService.getVolumesByDay()
    if (_volumesByDay.length > 0) {
      AnalyticsServiceCache.volumesByDay = _volumesByDay
    }
  }
}
