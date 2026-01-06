import Permissions from '../../../security/permissions'
import PermissionChecker from '../../../services/user/permissionChecker'
import DevtelWorkspaceService from '../../../services/devtel/devtelWorkspaceService'
import { Error400, Error404 } from '@gitmesh/common'

/**
 * PUT /tenant/{tenantId}/devtel/settings/integrations/:integrationId
 * @summary Update an integration
 * @tag DevTel Settings
 * @security Bearer
 */
export default async (req, res) => {
    new PermissionChecker(req).validateHas(Permissions.values.settingsEdit)

    const { integrationId } = req.params
    const { settings } = req.body

    const workspaceService = new DevtelWorkspaceService(req)
    const workspace = await workspaceService.getForCurrentTenant()

    const integration = await req.database.devtelIntegrations.findOne({
        where: {
            id: integrationId,
            workspaceId: workspace.id,
        },
    })

    if (!integration) {
        throw new Error404(req.language, 'devtel.integration.notFound')
    }

    const updateData: any = {}
    if (settings) {
        updateData.settings = { ...integration.settings, ...settings }
    }

    if (Object.keys(updateData).length > 0) {
        await integration.update(updateData)
    }

    await req.responseHandler.success(req, res, {
        id: integration.id,
        provider: integration.provider,
        status: integration.status,
        settings: integration.settings,
        updatedAt: integration.updatedAt,
    })
}
