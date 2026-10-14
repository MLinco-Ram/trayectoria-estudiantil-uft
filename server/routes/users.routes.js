import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/users.controller.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();
const staffOnly = requireRole('admin', 'docente');

router.get('/', getUsers);
router.post('/', staffOnly, createUser);
router.put('/:id', staffOnly, updateUser);
router.delete('/:id', staffOnly, deleteUser);

export default router;
