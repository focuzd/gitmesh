import Permissions from '../../../security/permissions'
import PermissionChecker from '../../../services/user/permissionChecker'
import DevtelWorkspaceService from '../../../services/devtel/devtelWorkspaceService'
import { Error400, Error500 } from '@gitmesh/common'

/**
 * POST /tenant/{tenantId}/devtel/settings/integrations
 * @summary Create a new external integration
 * @tag DevSpace Settings
 * @security Bearer
 */
export default async (req, res) => {
    try {
        new PermissionChecker(req).validateHas(Permissions.values.settingsEdit)

        const { provider, credentials, settings } = req.body

        req.log.info({ provider, hasCredentials: !!credentials, hasSettings: !!settings }, 
                 'Creating new integration')

        if (!provider) {
            req.log.error({}, 'Provider is required')
            throw new Error400(req.language, 'devtel.integration.providerRequired')
        }

        const workspaceService = new DevtelWorkspaceService(req)
        const workspace = await workspaceService.getForCurrentTenant()

        if (!workspace) {
            req.log.error({}, 'No workspace found for tenant')
            throw new Error400(req.language, 'devtel.workspace.notFound')
        }

        req.log.info({ workspaceId: workspace.id, provider }, 'Got workspace for integration')

        // Check if integration already exists for this provider
        const existing = await req.database.devtelIntegrations.findOne({
            where: {
                workspaceId: workspace.id,
                provider,
            },
        })

        if (existing) {
            req.log.warn({ workspaceId: workspace.id, provider, existingId: existing.id }, 
                     'Integration already exists for this provider')
            throw new Error400(req.language, 'devtel.integration.alreadyExists')
        }

        req.log.info({ workspaceId: workspace.id, provider }, 'Creating integration record')

        const createData: any = {
            workspaceId: workspace.id,
            provider,
            credentials: credentials || {},
            settings: settings || {},
            status: 'active',
        }

        const integration = await req.database.devtelIntegrations.create(createData)

        req.log.info({ 
            integrationId: integration.id, 
            workspaceId: workspace.id, 
            provider 
        }, 'Integration created successfully')

        // For GitHub, log the webhook URL that should be configured
        if (provider === 'github') {
            const webhookUrl = `${req.protocol}://${req.get('host')}/webhook/devtel/github/${workspace.id}`
            req.log.info({ 
                integrationId: integration.id, 
                webhookUrl 
            }, 'GitHub integration created. Configure this webhook URL in your GitHub App settings.')
        }

        await req.responseHandler.success(req, res, {
            id: integration.id,
            provider: integration.provider,
            status: integration.status,
            createdAt: integration.createdAt,
        })
    } catch (error) {
        req.log.error({ error: error.message, stack: error.stack }, 'Failed to create integration')
        throw error
    }
}
