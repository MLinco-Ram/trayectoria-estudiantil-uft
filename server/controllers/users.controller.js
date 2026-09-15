import bcrypt from 'bcryptjs';
import { encryptField, hashRut, sanitizeUserOutput } from '../services/crypto.service.js';
import { emitEvent } from '../services/socket.service.js';

export const getUsers = async (req, res) => {
  const db = req.db;
  try {
    const users = await db.collection('users').find({}).toArray();
    const safeUsers = users.map(u => sanitizeUserOutput(u));
    res.json(safeUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createUser = async (req, res) => {
  const db = req.db;
  try {
    const newUser = { ...req.body };

    // Validación de seguridad de RUT (exactamente 9 caracteres ignorando puntos y guión)
    const cleanRut = (newUser.rut || '').replace(/[\.\-]/g, '').trim();
    if (cleanRut.length !== 9) {
      return res.status(400).json({ error: "El RUT debe tener exactamente 9 dígitos/caracteres (ej: 123456789 o 12.345.678-9)." });
    }

    const rutBlindIndex = hashRut(cleanRut);

    // Verificar si ya existe un usuario con este RUT usando el Blind Index seguro
    const existing = await db.collection('users').findOne({ rutHash: rutBlindIndex });
    if (existing) {
      return res.status(400).json({ error: "El RUT ya se encuentra registrado en el sistema." });
    }

    if (newUser.password) {
      const salt = await bcrypt.genSalt(10);
      newUser.password = await bcrypt.hash(newUser.password, salt);
    }

    const plainRut = newUser.rut;
    // Cifrar el RUT en reposo antes de guardar en MongoDB Atlas
    newUser.rut = encryptField(plainRut);
    newUser.rutHash = rutBlindIndex;

    await db.collection('users').insertOne(newUser);
    
    const safeResult = sanitizeUserOutput({ ...newUser, rut: plainRut });
    emitEvent('users:changed', { action: 'create', user: safeResult });

    res.status(201).json(safeResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUser = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const { email, name, career, rut, password, tutorType, assignedTutorIds, role } = req.body;
    const updateData = {};
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (name !== undefined) updateData.name = name.trim();
    if (career !== undefined) updateData.career = career.trim();
    if (tutorType !== undefined) updateData.tutorType = tutorType;
    if (assignedTutorIds !== undefined) updateData.assignedTutorIds = assignedTutorIds;
    if (role !== undefined) updateData.role = role;
    
    if (rut !== undefined && rut.trim()) {
      const cleanRut = rut.replace(/[\.\-]/g, '').trim();
      if (cleanRut.length !== 9) {
        return res.status(400).json({ error: "El RUT debe tener exactamente 9 dígitos/caracteres." });
      }
      updateData.rut = encryptField(rut.trim());
      updateData.rutHash = hashRut(cleanRut);
    }

    if (password !== undefined && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password.trim(), salt);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No hay datos para actualizar." });
    }

    const targetHash = hashRut(id);
    await db.collection('users').updateOne(
      { $or: [{ id }, { rutHash: targetHash }, { rut: id }] },
      { $set: updateData }
    );

    const updatedUser = await db.collection('users').findOne({
      $or: [{ id }, { rutHash: targetHash }, { rut: id }]
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const safeResult = sanitizeUserOutput(updatedUser);
    emitEvent('users:changed', { action: 'update', userId: id, user: safeResult });

    res.json({ success: true, user: safeResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteUser = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const targetHash = hashRut(id);
    const result = await db.collection('users').deleteOne({
      $or: [{ id }, { rutHash: targetHash }, { rut: id }]
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado para eliminar." });
    }

    emitEvent('users:changed', { action: 'delete', userId: id });

    res.json({ success: true, message: `Usuario ${id} eliminado exitosamente de MongoDB Atlas.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

