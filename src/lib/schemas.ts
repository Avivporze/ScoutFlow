import { z } from 'zod'
import { ISRAELI_PREMIER_LEAGUE_TEAMS } from './constants'

export const bestFitSchema = z
  .enum(ISRAELI_PREMIER_LEAGUE_TEAMS)
  .nullable()
