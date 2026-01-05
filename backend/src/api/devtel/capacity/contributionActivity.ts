import Permissions from '../../../security/permissions'
import PermissionChecker from '../../../services/user/permissionChecker'

/**
 * GET /tenant/{tenantId}/devtel/projects/{projectId}/capacity/contributions
 * @summary Get contribution activity heatmap data
 * @tag DevTel Capacity
 * @security Bearer
 */
export default async (req, res) => {
    try {
        new PermissionChecker(req).validateHas(Permissions.values.memberRead)

        const { projectId } = req.params

        // Get date range for last 365 days
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 365)

        // Query issues updated/created in the last 365 days
        const contributions = await req.database.devtelIssues.findAll({
            where: {
                projectId,
                updatedAt: {
                    [req.database.Sequelize.Op.gte]: startDate,
                    [req.database.Sequelize.Op.lte]: endDate,
                },
                deletedAt: null,
            },
            attributes: [
                [req.database.sequelize.fn('DATE', req.database.sequelize.col('updatedAt')), 'date'],
                [req.database.sequelize.fn('COUNT', '*'), 'count'],
            ],
            group: [req.database.sequelize.fn('DATE', req.database.sequelize.col('updatedAt'))],
            raw: true,
        })

        // Transform to map of date -> count
        const contributionMap = contributions.reduce((acc, item: any) => {
            acc[item.date] = parseInt(item.count, 10)
            return acc
        }, {})

        // Generate array of all 365 days with counts
        const heatmapData = []
        const currentDate = new Date(startDate)
        
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0]
            heatmapData.push({
                date: dateStr,
                count: contributionMap[dateStr] || 0,
            })
            currentDate.setDate(currentDate.getDate() + 1)
        }

        await req.responseHandler.success(req, res, {
            projectId,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            contributions: heatmapData,
        })
    } catch (error) {
        console.error('Contribution Activity Error:', error.message)
        throw error
    }
}
