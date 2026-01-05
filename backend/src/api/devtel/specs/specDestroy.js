"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const permissions_1 = __importDefault(require("../../../security/permissions"));
const permissionChecker_1 = __importDefault(require("../../../services/user/permissionChecker"));
const common_1 = require("@gitmesh/common");
/**
 * DELETE /tenant/{tenantId}/devtel/projects/:projectId/specs/:specId
 * @summary Delete a spec document
 * @tag DevTel Specs
 * @security Bearer
 */
exports.default = async (req, res) => {
    try {
        console.log('=== BACKEND DELETE ENDPOINT START ===');
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        console.log('Request params:', req.params);
        
        new permissionChecker_1.default(req).validateHas(permissions_1.default.values.memberDestroy);
        console.log('Permission check passed');
        
        const { specId, projectId, tenantId } = req.params;
        console.log('Extracted params:', { specId, projectId, tenantId });
        
        console.log('Searching for spec in database...');
        const spec = await req.database.devtelSpecDocuments.findOne({
            where: {
                id: specId,
                projectId,
                tenantId,
            },
        });
        
        console.log('Database query result:', spec ? 'FOUND' : 'NOT FOUND');
        if (!spec) {
            console.log('Spec not found, throwing 400 error');
            throw new common_1.Error400(req.language, 'devtel.spec.notFound');
        }
        
        console.log('Starting deletion process...');
        
        // Delete spec comments first
        console.log('Deleting spec comments...');
        const commentsDeleted = await req.database.devtelSpecComments.destroy({
            where: { specId }
        });
        console.log('Comments deleted count:', commentsDeleted);
        
        // Delete spec versions
        console.log('Deleting spec versions...');
        const versionsDeleted = await req.database.devtelSpecVersions.destroy({
            where: { specId }
        });
        console.log('Versions deleted count:', versionsDeleted);
        
        // Delete the spec itself using direct database destroy
        console.log('Deleting the spec using direct destroy...');
        const specDeleteResult = await req.database.devtelSpecDocuments.destroy({
            where: {
                id: specId,
                projectId,
                tenantId,
            }
        });
        console.log('Direct destroy result (number of rows deleted):', specDeleteResult);
        
        console.log('All deletions completed successfully');
        console.log('=== BACKEND DELETE ENDPOINT SUCCESS ===');
        
        await req.responseHandler.success(req, res, { success: true });
        
    } catch (error) {
        console.error('=== BACKEND DELETE ENDPOINT ERROR ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('=== END ERROR ===');
        throw error;
    }
};
//# sourceMappingURL=specDestroy.js.map