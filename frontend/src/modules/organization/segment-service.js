import authAxios from '@/shared/axios/auth-axios';
import AuthCurrentTenant from '@/modules/auth/auth-current-tenant';

export class SegmentService {
  static async list() {
    const tenantId = AuthCurrentTenant.get();
    const response = await authAxios.get(`/tenant/${tenantId}/segment`);
    return response.data;
  }
}

export default SegmentService;
