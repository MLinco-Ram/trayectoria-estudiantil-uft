import React, { useState } from 'react';
import { User } from '../../types';
import { Users, UserPlus, Search, Edit3, Trash2, GraduationCap, Mail } from 'lucide-react';
import { formatRut, saveUsers } from '../../data';
import { usersApi } from '../../services/api';

interface DocenteStudentsTabProps {
  allUsers: User[];
  setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onReload: () => void;
}

export const DocenteStudentsTab: React.FC<DocenteStudentsTabProps> = ({
  allUsers,
  setAllUsers,
  onReload,
}) => {
  const [studentSearch, setStudentSearch] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRut, setNewStudentRut] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentCareer, setNewStudentCareer] = useState('Ing. Civil en Inform. y Telec.');
  const [newStudentPassword, setNewStudentPassword] = useState('123');
  const [studentFeedback, setStudentFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);

  // Edit Student Modal
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRut, setEditRut] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCareer, setEditCareer] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const alumnos = allUsers.filter(u => u.role === 'alumno');

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentFeedback(null);

    if (!newStudentName.trim() || !newStudentRut.trim() || !newStudentEmail.trim()) {
      setStudentFeedback({ status: 'error', message: 'Nombre, RUT y Correo son obligatorios.' });
      return;
    }

    const cleanRut = newStudentRut.replace(/[\.\-]/g, '').trim();
    if (cleanRut.length !== 9) {
      setStudentFeedback({ status: 'error', message: 'El RUT debe tener 9 caracteres.' });
      return;
    }

    setIsSubmittingStudent(true);

    const newStudent: User = {
      id: `alumno_${Date.now()}`,
      name: newStudentName.trim(),
      rut: newStudentRut.trim(),
      role: 'alumno',
      email: newStudentEmail.trim().toLowerCase(),
      career: newStudentCareer.trim() || 'Estudiante UFT',
      password: newStudentPassword.trim() || '123'
    };

    try {
      await usersApi.createUser(newStudent);
      const updated = [...allUsers, newStudent];
      setAllUsers(updated);
      saveUsers(updated);

      setStudentFeedback({
        status: 'success',
        message: `¡Estudiante "${newStudentName}" registrado con éxito!`
      });

      setNewStudentName('');
      setNewStudentRut('');
      setNewStudentEmail('');
      setNewStudentPassword('123');
    } catch (err: any) {
      const updated = [...allUsers, newStudent];
      setAllUsers(updated);
      saveUsers(updated);

      setStudentFeedback({
        status: 'success',
        message: `Estudiante registrado localmente. (${err.message})`
      });
    } finally {
      setIsSubmittingStudent(false);
      setTimeout(() => onReload(), 600);
    }
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const payload: Partial<User> = {
      name: editName.trim(),
      rut: editRut.trim(),
      email: editEmail.trim().toLowerCase(),
      career: editCareer.trim(),
    };
    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    try {
      await usersApi.updateUser(editingStudent.id, payload);
      const updated = allUsers.map(u => u.id === editingStudent.id ? { ...u, ...payload } : u);
      setAllUsers(updated);
      saveUsers(updated);
      setEditingStudent(null);
    } catch (err) {
      const updated = allUsers.map(u => u.id === editingStudent.id ? { ...u, ...payload } : u);
      setAllUsers(updated);
      saveUsers(updated);
      setEditingStudent(null);
    } finally {
      onReload();
    }
  };

  const handleDeleteStudent = async (student: User) => {
    if (!window.confirm(`¿Estás seguro de eliminar a "${student.name}"?`)) return;

    try {
      await usersApi.deleteUser(student.id);
      const updated = allUsers.filter(u => u.id !== student.id);
      setAllUsers(updated);
      saveUsers(updated);
    } catch (err) {
      const updated = allUsers.filter(u => u.id !== student.id);
      setAllUsers(updated);
      saveUsers(updated);
    } finally {
      onReload();
    }
  };

  const filteredAlumnos = alumnos.filter(a => 
    a.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    a.rut.toLowerCase().includes(studentSearch.toLowerCase()) ||
    a.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (a.career && a.career.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Registro */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#092c4c] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-[#3a9ad9]" />
            <h2 className="font-bold text-base">Registrar Nuevo Alumno</h2>
          </div>
        </div>

        <form onSubmit={handleCreateStudent} className="p-6">
          {studentFeedback && (
            <div className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              studentFeedback.status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}>
              <span>{studentFeedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre Completo</label>
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="Ej: Mayra Linco"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">RUT</label>
              <input
                type="text"
                value={newStudentRut}
                onChange={(e) => setNewStudentRut(formatRut(e.target.value))}
                placeholder="20.123.456-7"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Correo Institucional</label>
              <input
                type="email"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
                placeholder="mlinco@mail.uft.cl"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Carrera</label>
              <input
                type="text"
                value={newStudentCareer}
                onChange={(e) => setNewStudentCareer(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Contraseña</label>
              <input
                type="text"
                value={newStudentPassword}
                onChange={(e) => setNewStudentPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] font-mono"
                required
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmittingStudent}
                className="w-full py-2 px-4 bg-[#3a9ad9] text-white rounded-xl text-xs font-bold hover:bg-[#2b83bd] transition disabled:opacity-50"
              >
                {isSubmittingStudent ? 'Registrando...' : 'Crear Alumno'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Nómina */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Estudiantes Registrados ({alumnos.length})</h3>
            <p className="text-xs text-slate-500">Padrón de estudiantes para reservas y acompañamiento</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar alumno..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3a9ad9]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Alumno / Carrera</th>
                <th className="py-3 px-4">RUT</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAlumnos.map(alum => (
                <tr key={alum.id} className="hover:bg-slate-50">
                  <td className="py-3 px-5">
                    <div className="font-bold text-slate-900">{alum.name}</div>
                    <div className="text-[#3a9ad9]">{alum.career}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold">{alum.rut}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Activo
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      onClick={() => {
                        setEditingStudent(alum);
                        setEditName(alum.name);
                        setEditRut(alum.rut);
                        setEditEmail(alum.email);
                        setEditCareer(alum.career || '');
                        setEditPassword('');
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 mr-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(alum)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edición */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Editar Datos de Estudiante</h3>
            <form onSubmit={handleSaveEditStudent} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">RUT</label>
                <input
                  type="text"
                  value={editRut}
                  onChange={(e) => setEditRut(formatRut(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Correo</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Carrera</label>
                <input
                  type="text"
                  value={editCareer}
                  onChange={(e) => setEditCareer(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nueva Clave (opcional)</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Dejar en blanco para conservar"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-3 py-1.5 border rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#092c4c] text-white rounded-xl text-xs font-bold"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
