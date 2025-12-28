import PermissionChecker from '../../services/user/permissionChecker'
import Permissions from '../../security/permissions'
import SegmentService from '../../services/segmentService'

export default async (req, res) => {
  new PermissionChecker(req).validateHas(Permissions.values.segmentRead)

  const payload = await new SegmentService(req).list()

  await req.responseHandler.success(req, res, payload)
}