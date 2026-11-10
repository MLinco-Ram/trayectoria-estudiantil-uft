import { Router } from 'express';
import { getDictionary, createDictionaryEntry, deleteDictionaryEntry } from '../controllers/dictionary.controller.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();
const staffOnly = requireRole('admin', 'docente');

router.get('/', getDictionary);
router.post('/', staffOnly, createDictionaryEntry);
router.delete('/:id', staffOnly, deleteDictionaryEntry);

export default router;
