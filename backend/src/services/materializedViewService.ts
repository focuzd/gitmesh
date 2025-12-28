import { LoggerBase } from '@gitmesh/logging'
import SequelizeRepository from '../database/repositories/sequelizeRepository'
import { IServiceOptions } from './IServiceOptions'

export default class MaterializedViewService extends LoggerBase {
  options: IServiceOptions

  constructor(options: IServiceOptions) {
    super(options.log)
    this.options = options
  }

  async refreshActivityCube(): Promise<void> {
    const sequelize = SequelizeRepository.getSequelize(this.options)
    
    this.log.info('Refreshing mv_activities_cube materialized view')
    
    await sequelize.query('REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_activities_cube"', {
      useMaster: true,
    })
    
    this.log.info('Successfully refreshed mv_activities_cube materialized view')
  }

  async refreshOrganizationCube(): Promise<void> {
    const sequelize = SequelizeRepository.getSequelize(this.options)
    
    this.log.info('Refreshing mv_organizations_cube materialized view')
    
    await sequelize.query('REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_organizations_cube"', {
      useMaster: true,
    })
    
    this.log.info('Successfully refreshed mv_organizations_cube materialized view')
  }

  async refreshAllCubes(): Promise<void> {
    const sequelize = SequelizeRepository.getSequelize(this.options)
    
    const materializedViews = [
      'mv_members_cube',
      'mv_activities_cube',
      'mv_organizations_cube',
      'mv_segments_cube',
    ]

    this.log.info('Refreshing all cube materialized views')

    for (const view of materializedViews) {
      this.log.info(`Refreshing ${view}`)
      await sequelize.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`, {
        useMaster: true,
      })
    }

    this.log.info('Successfully refreshed all cube materialized views')
  }
}