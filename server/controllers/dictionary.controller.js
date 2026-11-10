import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';

// Diccionario editable por docentes: materias/áreas adicionales y programas adicionales.
// Las salas siguen en su propia colección (rooms) y se gestionan desde la misma pestaña.
const NAME_MAX = 60;
const BASE_PROGRAMS = ['tutorias', 'psicoeducativo', 'comunidad'];
const BASE_SUBJECTS = {
  tutorias: ['matemática', 'programación', 'derecho'],
  psicoeducativo: ['manejo del tiempo', 'estrategias de estudio', 'control de ansiedad', 'autorregulación', 'neuro herramientas', 'motivación', 'evaluaciones orales', 'otro'],
  comunidad: ['actividad para la comunidad', 'otro'],
};

const cleanName = (v) => String(v || '').trim().replace(/\s+/g, ' ');
// "Talleres de Verano" -> "talleres_de_verano"
const slugify = (v) => cleanName(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

export const getDictionary = async (req, res) => {
  try {
    const entries = await req.db.collection('dictionary').find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
    res.json(entries);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const createDictionaryEntry = async (req, res) => {
  try {
    const col = req.db.collection('dictionary');
    const kind = req.body?.kind;
    const name = cleanName(req.body?.name);
    if (kind !== 'subject' && kind !== 'program') {
      return res.status(400).json({ error: 'Tipo de entrada inválido.' });
    }
    if (!name || name.length > NAME_MAX) {
      return res.status(400).json({ error: `El nombre es obligatorio (máximo ${NAME_MAX} caracteres).` });
    }

    let entry;
    if (kind === 'program') {
      const key = slugify(name);
      if (!key) return res.status(400).json({ error: 'El nombre del programa no es válido.' });
      if (BASE_PROGRAMS.includes(key) || await col.findOne({ kind: 'program', key })) {
        return res.status(409).json({ error: `El programa "${name}" ya existe.` });
      }
      entry = { id: `prog_${Date.now()}`, kind, key, name, createdAt: new Date().toISOString() };
    } else {
      const program = String(req.body?.program || '');
      const programExists = BASE_PROGRAMS.includes(program) || await col.findOne({ kind: 'program', key: program });
      if (!programExists) return res.status(400).json({ error: 'Selecciona un programa válido para la materia/área.' });
      const lower = name.toLowerCase();
      const dup = (BASE_SUBJECTS[program] || []).includes(lower) ||
        (await col.find({ kind: 'subject', program }).toArray()).some(s => s.name.toLowerCase() === lower);
      if (dup) return res.status(409).json({ error: `La materia/área "${name}" ya existe en ese programa.` });
      entry = { id: `subj_${Date.now()}`, kind, name, program, createdAt: new Date().toISOString() };
    }

    await col.insertOne({ ...entry });
    emitEvent('dictionary:changed', { action: 'create', entry });
    res.status(201).json(entry);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const deleteDictionaryEntry = async (req, res) => {
  try {
    const col = req.db.collection('dictionary');
    const entry = await col.findOne({ id: req.params.id });
    if (!entry) return res.status(404).json({ error: 'Entrada no encontrada.' });

    if (entry.kind === 'program') {
      const inUse = await req.db.collection('sessions').countDocuments({ program: entry.key, isCompleted: { $ne: true } });
      if (inUse > 0) {
        return res.status(409).json({ error: `El programa "${entry.name}" tiene ${inUse} sesión(es) activa(s); no se puede eliminar.` });
      }
      // Sus materias/áreas dejan de tener sentido sin el programa
      await col.deleteMany({ kind: 'subject', program: entry.key });
    }
    await col.deleteOne({ id: entry.id });
    emitEvent('dictionary:changed', { action: 'delete', id: entry.id });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
};
