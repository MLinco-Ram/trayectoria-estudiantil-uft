import { Router } from 'express';
import { getRooms, createRoom, deleteRoom } from '../controllers/rooms.controller.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();
const staffOnly = requireRole('admin', 'docente');

router.get('/', getRooms);
router.post('/', staffOnly, createRoom);
router.delete('/:id', staffOnly, deleteRoom);

export default router;
