import Permissions from '../../../security/permissions'
import PermissionChecker from '../../../services/user/permissionChecker'

/**
 * GET /tenant/{tenantId}/devtel/projects/{projectId}/overview
 * @summary Get comprehensive project overview metrics
 * @tag DevTel Projects
 * @security Bearer
 */
export default async (req, res) => {
    try {
        new PermissionChecker(req).validateHas(Permissions.values.memberRead)

        const { projectId } = req.params
        const { days = 30 } = req.query

        const daysAgo = new Date()
        daysAgo.setDate(daysAgo.getDate() - parseInt(days))

        const previousPeriodStart = new Date(daysAgo)
        previousPeriodStart.setDate(previousPeriodStart.getDate() - parseInt(days))

        // Get all issues for the project
        const allIssues = await req.database.devtelIssues.findAll({
            where: {
                projectId,
                deletedAt: null,
            },
            include: [
                {
                    model: req.database.user,
                    as: 'assignee',
                    attributes: ['id', 'fullName', 'email'],
                },
            ],
        })

        // Get completed issues in current period
        const completedIssues = allIssues.filter(
            (issue) => issue.status === 'done' && new Date(issue.updatedAt) >= daysAgo
        )

        // Get completed issues in previous period
        const previousCompletedIssues = allIssues.filter(
            (issue) =>
                issue.status === 'done' &&
                new Date(issue.updatedAt) >= previousPeriodStart &&
                new Date(issue.updatedAt) < daysAgo
        )

        // Calculate velocity (story points per week)
        const totalPoints = completedIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0)
        const previousPoints = previousCompletedIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0)
        const weeksInPeriod = parseInt(days) / 7
        const velocity = totalPoints / weeksInPeriod
        const previousVelocity = previousPoints / weeksInPeriod
        const velocityTrend = previousVelocity > 0 ? ((velocity - previousVelocity) / previousVelocity) * 100 : 0

        // Calculate average cycle time
        const issuesWithCycleTime = completedIssues.filter((issue) => issue.createdAt && issue.updatedAt)
        const avgCycleTime =
            issuesWithCycleTime.length > 0
                ? issuesWithCycleTime.reduce((sum, issue) => {
                      const cycleTime = (new Date(issue.updatedAt) - new Date(issue.createdAt)) / (1000 * 60 * 60 * 24)
                      return sum + cycleTime
                  }, 0) / issuesWithCycleTime.length
                : 0

        const previousIssuesWithCycleTime = previousCompletedIssues.filter((issue) => issue.createdAt && issue.updatedAt)
        const previousAvgCycleTime =
            previousIssuesWithCycleTime.length > 0
                ? previousIssuesWithCycleTime.reduce((sum, issue) => {
                      const cycleTime = (new Date(issue.updatedAt) - new Date(issue.createdAt)) / (1000 * 60 * 60 * 24)
                      return sum + cycleTime
                  }, 0) / previousIssuesWithCycleTime.length
                : 0

        const cycleTimeTrend =
            previousAvgCycleTime > 0 ? ((avgCycleTime - previousAvgCycleTime) / previousAvgCycleTime) * 100 : 0

        // Calculate WIP
        const wipIssues = allIssues.filter((issue) => issue.status === 'in_progress')
        const wipCount = wipIssues.length

        // Get project settings for WIP limit
        const project = await req.database.devtelProjects.findByPk(projectId)
        const wipLimit = project?.wipLimit || 0

        // Calculate capacity metrics
        const teamMembers = await req.database.user.findAll({
            include: [
                {
                    model: req.database.tenantUser,
                    as: 'tenants',
                    where: { tenantId: req.currentTenant.id },
                    attributes: [],
                },
            ],
            attributes: ['id', 'fullName'],
        })

        const totalCapacity = teamMembers.length * 40 // 40 hours per week per person
        const allocatedHours = wipIssues.reduce((sum, issue) => sum + (issue.estimatedHours || 0), 0)
        const capacityUtilization = totalCapacity > 0 ? (allocatedHours / totalCapacity) * 100 : 0

        // Active contributors
        const activeContributors = new Set(
            completedIssues.filter((issue) => issue.assigneeId).map((issue) => issue.assigneeId)
        ).size

        // Aging issues (in progress > 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const agingIssues = wipIssues.filter((issue) => new Date(issue.updatedAt) < sevenDaysAgo).length

        const fourteenDaysAgo = new Date()
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
        const stalledIssues = wipIssues.filter((issue) => new Date(issue.updatedAt) < fourteenDaysAgo).length

        // Planned vs actual (from current cycle)
        const activeCycle = await req.database.devtelCycles.findOne({
            where: {
                projectId,
                status: 'active',
                deletedAt: null,
            },
        })

        let plannedVsActual = 0
        let completedPlanned = 0
        let totalPlanned = 0

        if (activeCycle) {
            const cycleIssues = allIssues.filter((issue) => issue.cycleId === activeCycle.id)
            totalPlanned = cycleIssues.length
            completedPlanned = cycleIssues.filter((issue) => issue.status === 'done').length
            plannedVsActual = totalPlanned > 0 ? (completedPlanned / totalPlanned) * 100 : 0
        }

        // Delivery trend data (weekly breakdown)
        const deliveryTrend = []
        const currentDate = new Date(daysAgo)
        while (currentDate <= new Date()) {
            const weekStart = new Date(currentDate)
            const weekEnd = new Date(currentDate)
            weekEnd.setDate(weekEnd.getDate() + 7)

            const weekCompleted = completedIssues.filter(
                (issue) => new Date(issue.updatedAt) >= weekStart && new Date(issue.updatedAt) < weekEnd
            )

            const weekPoints = weekCompleted.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0)

            deliveryTrend.push({
                date: weekStart.toISOString().split('T')[0],
                completed: weekPoints,
                planned: activeCycle ? activeCycle.plannedPoints / (parseInt(days) / 7) : 0,
            })

            currentDate.setDate(currentDate.getDate() + 7)
        }

        // Cycle time distribution
        const cycleTimeDistribution = [
            { range: '0-2 days', count: 0 },
            { range: '3-5 days', count: 0 },
            { range: '6-10 days', count: 0 },
            { range: '11-20 days', count: 0 },
            { range: '20+ days', count: 0 },
        ]

        issuesWithCycleTime.forEach((issue) => {
            const cycleTime = (new Date(issue.updatedAt) - new Date(issue.createdAt)) / (1000 * 60 * 60 * 24)
            if (cycleTime <= 2) cycleTimeDistribution[0].count++
            else if (cycleTime <= 5) cycleTimeDistribution[1].count++
            else if (cycleTime <= 10) cycleTimeDistribution[2].count++
            else if (cycleTime <= 20) cycleTimeDistribution[3].count++
            else cycleTimeDistribution[4].count++
        })

        // Contributor load balance
        const contributorLoad = []
        const assigneeMap = {}

        wipIssues.forEach((issue) => {
            if (issue.assigneeId) {
                if (!assigneeMap[issue.assigneeId]) {
                    assigneeMap[issue.assigneeId] = {
                        name: issue.assignee?.fullName || 'Unknown',
                        assigned: 0,
                        capacity: 40,
                    }
                }
                assigneeMap[issue.assigneeId].assigned += issue.estimatedHours || 0
            }
        })

        Object.values(assigneeMap).forEach((contributor: any) => {
            contributorLoad.push(contributor)
        })

        // Issue aging analysis
        const issueAging = [
            { range: '0-3 days', count: 0 },
            { range: '4-7 days', count: 0 },
            { range: '8-14 days', count: 0 },
            { range: '14+ days', count: 0 },
        ]

        const now = new Date()
        wipIssues.forEach((issue) => {
            const age = (now - new Date(issue.updatedAt)) / (1000 * 60 * 60 * 24)
            if (age <= 3) issueAging[0].count++
            else if (age <= 7) issueAging[1].count++
            else if (age <= 14) issueAging[2].count++
            else issueAging[3].count++
        })

        const overview = {
            // Primary metrics
            velocity: parseFloat(velocity.toFixed(1)),
            velocityTrend: parseFloat(velocityTrend.toFixed(1)),
            avgCycleTime: parseFloat(avgCycleTime.toFixed(1)),
            cycleTimeTrend: parseFloat(cycleTimeTrend.toFixed(1)),
            wipCount,
            wipLimit,
            wipTrend: 0, // Could calculate based on historical data
            capacityUtilization: parseFloat(capacityUtilization.toFixed(1)),
            capacityTrend: 0, // Could calculate based on historical data
            allocatedHours,
            totalCapacity,

            // Secondary metrics
            throughput: completedIssues.length,
            activeContributors,
            agingIssues,
            stalledIssues,
            plannedVsActual: parseFloat(plannedVsActual.toFixed(1)),
            completedPlanned,
            totalPlanned,
            completedIssues: completedIssues.length,

            // Chart data
            deliveryTrend,
            cycleTimeDistribution,
            contributorLoad,
            issueAging,
        }

        await req.responseHandler.success(req, res, overview)
    } catch (error) {
        console.error('Project Overview Error:', error.message)
        throw error
    }
}
