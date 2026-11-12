import { Router } from 'express';
import {
  listPendingUsers, importPendingUsers, updatePendingUsers, deletePendingUsers, registerPendingUsers
} from '../controllers/pendingUsers.controller.js';

// Montado bajo /api/pending-users con requireRole('admin')
const router = Router();

router.get('/', listPendingUsers);
router.post('/import', importPendingUsers);
router.patch('/', updatePendingUsers);
router.post('/delete', deletePendingUsers);
router.post('/register', registerPendingUsers);

export default router;
