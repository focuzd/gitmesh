import PermissionChecker from '../../services/user/permissionChecker'
import Permissions from '../../security/permissions'
import MaterializedViewService from '../../services/materializedViewService'

export default async (req, res) => {
  new PermissionChecker(req).validateHas(Permissions.values.organizationRead)

  const materializedViewService = new MaterializedViewService(req)

  // Refresh the materialized views that contain organization counts
  await materializedViewService.refreshActivityCube()
  await materializedViewService.refreshOrganizationCube()

  await req.responseHandler.success(req, res, { message: 'Organization counts refreshed successfully' })
}