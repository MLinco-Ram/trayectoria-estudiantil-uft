import { Router } from 'express';
import { getStudentRequests, createStudentRequest, updateStudentRequest } from '../controllers/studentRequests.controller.js';

const router = Router();

router.get('/', getStudentRequests);
router.post('/', createStudentRequest);
router.put('/:id', updateStudentRequest);

export default router;
