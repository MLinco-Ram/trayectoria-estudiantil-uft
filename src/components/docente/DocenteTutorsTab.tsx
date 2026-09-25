import React, { useState } from 'react';
import { User, TutorType } from '../../types';
import { BookOpen, UserPlus, Search, Edit3, Trash2, GraduationCap, CheckCircle2, AlertTriangle, Lock, Mail, ShieldCheck, Users, UserCheck, ArrowRight, Sparkles } from 'lucide-react';
import { formatRut, getSavedUsers, saveUsers } from '../../data';
import { usersApi } from '../../services/api';

interface DocenteTutorsTabProps {
  allUsers: User[];
  setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onReload: () => void;
}

export const DocenteTutorsTab: React.FC<DocenteTutorsTabProps> = ({
  allUsers,
  setAllUsers,
  onReload,
}) => {
  const [tutorSearch, setTutorSearch] = useState('');
  const [newTutorName, setNewTutorName] = useState('');
  const [newTutorRut, setNewTutorRut] = useState('');
  const [newTutorEmail, setNewTutorEmail] = useState('');
  const [newTutorCareer, setNewTutorCareer] = useState('Ing. Civil en Informática');
  const [newTutorPassword, setNewTutorPassword] = useState('123');
  const [newTutorType, setNewTutorType] = useState<TutorType>('tutor_par');
  const [tutorFeedback, setTutorFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingTutor, setIsSubmittingTutor] = useState(false);

  // Edit Modal State
  const [editingTutor, setEditingTutor] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRut, setEditRut] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCareer, setEditCareer] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTutorType, setEditTutorType] = useState<TutorType>('tutor_par');

  // Assignment Management State (Docente asignando tutores pares a un Tutor de Tutores)
  const [selectedLeadTutorId, setSelectedLeadTutorId] = useState<string>('');
  const [selectedAssignedIds, setSelectedAssignedIds] = useState<string[]>([]);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);

  const tutores = allUsers.filter(u => u.role === 'tutor');
  const leadTutores = tutores.filter(u => u.tutorType === 'tutor_de_tutores');
  const peerTutores = tutores.filter(u => u.tutorType !== 'tutor_de_tutores');

  // Keep selectedLeadTutor in sync
  const currentLeadTutor = leadTutores.find(t => t.id === selectedLeadTutorId) || leadTutores[0] || null;

  // Sync assigned IDs when lead tutor changes
  React.useEffect(() => {
    if (currentLeadTutor) {
      setSelectedLeadTutorId(currentLeadTutor.id);
      setSelectedAssignedIds(currentLeadTutor.assignedTutorIds || []);
    } else {
      setSelectedLeadTutorId('');
      setSelectedAssignedIds([]);
    }
  }, [leadTutores.length, currentLeadTutor?.id]);

  const handleCreateTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    setTutorFeedback(null);

    if (!newTutorName.trim() || !newTutorRut.trim() || !newTutorEmail.trim()) {
      setTutorFeedback({ status: 'error', message: 'Nombre, RUT y Correo son obligatorios.' });
      return;
    }

    const cleanRut = newTutorRut.replace(/[\.\-]/g, '').trim();
    if (cleanRut.length !== 9) {
      setTutorFeedback({ status: 'error', message: 'El RUT debe tener 9 caracteres.' });
      return;
    }

    setIsSubmittingTutor(true);

    const newTutorUser: User = {
      id: `tutor_${Date.now()}`,
      name: newTutorName.trim(),
      rut: newTutorRut.trim(),
      role: 'tutor',
      tutorType: newTutorType,
      assignedTutorIds: newTutorType === 'tutor_de_tutores' ? [] : undefined,
      email: newTutorEmail.trim().toLowerCase(),
      career: newTutorCareer.trim() || 'Ing. Civil en Informática',
      password: newTutorPassword.trim() || '123'
    };

    try {
      await usersApi.createUser(newTutorUser);
      const updated = [...allUsers, newTutorUser];
      setAllUsers(updated);
      saveUsers(updated);

      setTutorFeedback({
        status: 'success',
        message: `¡${newTutorType === 'tutor_de_tutores' ? 'Tutor de Tutores' : 'Tutor Par'} "${newTutorName}" registrado exitosamente!`
      });

      setNewTutorName('');
      setNewTutorRut('');
      setNewTutorEmail('');
      setNewTutorPassword('123');
      setNewTutorType('tutor_par');
    } catch (err: any) {
      const updated = [...allUsers, newTutorUser];
      setAllUsers(updated);
      saveUsers(updated);

      setTutorFeedback({
        status: 'success',
        message: `Tutor registrado localmente. (${err.message})`
      });
    } finally {
      setIsSubmittingTutor(false);
      setTimeout(() => onReload(), 600);
    }
  };

  const handleSaveEditTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTutor) return;

    const payload: Partial<User> = {
      name: editName.trim(),
      rut: editRut.trim(),
      email: editEmail.trim().toLowerCase(),
      career: editCareer.trim(),
      tutorType: editTutorType,
    };
    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    try {
      await usersApi.updateUser(editingTutor.id, payload);
      const updated = allUsers.map(u => u.id === editingTutor.id ? { ...u, ...payload } : u);
      setAllUsers(updated);
      saveUsers(updated);
      setEditingTutor(null);
    } catch (err) {
      const updated = allUsers.map(u => u.id === editingTutor.id ? { ...u, ...payload } : u);
      setAllUsers(updated);
      saveUsers(updated);
      setEditingTutor(null);
    } finally {
      onReload();
    }
  };

  const handleDeleteTutor = async (tutor: User) => {
    if (!window.confirm(`¿Estás seguro de eliminar al tutor "${tutor.name}"?`)) return;

    try {
      await usersApi.deleteUser(tutor.id);
      const updated = allUsers.filter(u => u.id !== tutor.id);
      setAllUsers(updated);
      saveUsers(updated);
    } catch (err) {
      const updated = allUsers.filter(u => u.id !== tutor.id);
      setAllUsers(updated);
      saveUsers(updated);
    } finally {
      onReload();
    }
  };

  const handleToggleAssignTutor = (peerId: string) => {
    if (selectedAssignedIds.includes(peerId)) {
      setSelectedAssignedIds(selectedAssignedIds.filter(id => id !== peerId));
    } else {
      setSelectedAssignedIds([...selectedAssignedIds, peerId]);
    }
  };

  const handleSaveAssignments = async () => {
    if (!currentLeadTutor) return;
    setIsSavingAssignments(true);
    setAssignmentFeedback(null);

    const payload: Partial<User> = {
      assignedTutorIds: selectedAssignedIds
    };

    try {
      await usersApi.updateUser(currentLeadTutor.id, payload);
      const updated = allUsers.map(u => u.id === currentLeadTutor.id ? { ...u, assignedTutorIds: selectedAssignedIds } : u);
      setAllUsers(updated);
      saveUsers(updated);
      setAssignmentFeedback(`¡Tutores asignados exitosamente a ${currentLeadTutor.name}!`);
      setTimeout(() => setAssignmentFeedback(null), 4000);
    } catch (err: any) {
      const updated = allUsers.map(u => u.id === currentLeadTutor.id ? { ...u, assignedTutorIds: selectedAssignedIds } : u);
      setAllUsers(updated);
      saveUsers(updated);
      setAssignmentFeedback(`Asignaciones guardadas localmente. (${err.message})`);
      setTimeout(() => setAssignmentFeedback(null), 4000);
    } finally {
      setIsSavingAssignments(false);
      onReload();
    }
  };

  const handlePromoteToLead = async (tutor: User) => {
    const updatedType: TutorType = tutor.tutorType === 'tutor_de_tutores' ? 'tutor_par' : 'tutor_de_tutores';
    try {
      await usersApi.updateUser(tutor.id, { tutorType: updatedType });
      const updated = allUsers.map(u => u.id === tutor.id ? { ...u, tutorType: updatedType } : u);
      setAllUsers(updated);
      saveUsers(updated);
    } catch (err) {
      const updated = allUsers.map(u => u.id === tutor.id ? { ...u, tutorType: updatedType } : u);
      setAllUsers(updated);
      saveUsers(updated);
    } finally {
      onReload();
    }
  };

  const filteredTutores = tutores.filter(t => 
    t.name.toLowerCase().includes(tutorSearch.toLowerCase()) ||
    t.rut.toLowerCase().includes(tutorSearch.toLowerCase()) ||
    t.email.toLowerCase().includes(tutorSearch.toLowerCase()) ||
    (t.career && t.career.toLowerCase().includes(tutorSearch.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Formulario de Registro con Opción de Tipo de Tutor */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#092c4c] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-[#3a9ad9]" />
            <h2 className="font-bold text-base">Registrar Nuevo Tutor (Tutor Par o Tutor de Tutores)</h2>
          </div>
        </div>

        <form onSubmit={handleCreateTutor} className="p-6">
          {tutorFeedback && (
            <div className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              tutorFeedback.status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}>
              <span>{tutorFeedback.message}</span>
            </div>
          )}

          {/* Selector de Subtipo de Tutor */}
          <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Tipo / Nivel de Tutor
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                newTutorType === 'tutor_par'
                  ? 'bg-sky-50/80 border-sky-300 text-[#092c4c] ring-1 ring-sky-400'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60'
              }`}>
                <input
                  type="radio"
                  name="newTutorType"
                  value="tutor_par"
                  checked={newTutorType === 'tutor_par'}
                  onChange={() => setNewTutorType('tutor_par')}
                  className="mt-0.5 text-[#3a9ad9]"
                />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#3a9ad9]" />
                    <span>Tutor Par (Estándar)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Acceso a: Mis Tutorías, Cargar Horario y Avisar Inconveniente.
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                newTutorType === 'tutor_de_tutores'
                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 ring-1 ring-indigo-400'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60'
              }`}>
                <input
                  type="radio"
                  name="newTutorType"
                  value="tutor_de_tutores"
                  checked={newTutorType === 'tutor_de_tutores'}
                  onChange={() => setNewTutorType('tutor_de_tutores')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5 text-indigo-900">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tutor de Tutores (Coordinador de Pares)</span>
                  </div>
                  <p className="text-[11px] text-indigo-700/80 mt-0.5">
                    Incluye todas las funciones y agrega la pestaña <strong>"Tutores a Cargo"</strong> para supervisar avance, cronogramas y asistencias.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre Completo</label>
              <input
                type="text"
                value={newTutorName}
                onChange={(e) => setNewTutorName(e.target.value)}
                placeholder="Ej: Carlos Valenzuela"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">RUT</label>
              <input
                type="text"
                value={newTutorRut}
                onChange={(e) => setNewTutorRut(formatRut(e.target.value))}
                placeholder="18.456.789-K"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Correo Institucional</label>
              <input
                type="email"
                value={newTutorEmail}
                onChange={(e) => setNewTutorEmail(e.target.value)}
                placeholder="cvalenzuela@mail.uft.cl"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Carrera</label>
              <input
                type="text"
                value={newTutorCareer}
                onChange={(e) => setNewTutorCareer(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Contraseña</label>
              <input
                type="text"
                value={newTutorPassword}
                onChange={(e) => setNewTutorPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] font-mono"
                required
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmittingTutor}
                className="w-full py-2 px-4 bg-[#3a9ad9] text-white rounded-xl text-xs font-bold hover:bg-[#2b83bd] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmittingTutor ? 'Registrando...' : 'Guardar Tutor'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* APARTADO DOCENTE: ASIGNACIÓN DE TUTORES A UN TUTOR DE TUTORES */}
      <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#092c4c] to-indigo-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Asignar Tutores a Cargo (Tutor de Tutores)</h2>
              <p className="text-xs text-indigo-200">Coordina qué tutores pares supervisa cada Tutor de Tutores asignado por la coordinación</p>
            </div>
          </div>
          {leadTutores.length > 0 && (
            <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/40 rounded-full text-xs font-bold text-indigo-100 flex items-center gap-1.5 self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {leadTutores.length} Tutor(es) de Tutores habilitado(s)
            </span>
          )}
        </div>

        <div className="p-6 space-y-6">
          {leadTutores.length === 0 ? (
            <div className="bg-indigo-50/60 p-6 rounded-2xl border border-indigo-100 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-indigo-400 mx-auto" />
              <h4 className="font-bold text-indigo-950 text-sm">No hay Tutores de Tutores registrados aún</h4>
              <p className="text-xs text-indigo-800/80 max-w-md mx-auto">
                Para asignar tutores a cargo, primero registra un nuevo tutor con el rol <strong>Tutor de Tutores</strong> arriba, o edita un tutor existente en la nómina para promoverlo.
              </p>
            </div>
          ) : (
            <>
              {assignmentFeedback && (
                <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{assignmentFeedback}</span>
                </div>
              )}

              {/* Selector de Tutor de Tutores a gestionar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  1. Selecciona el Tutor de Tutores para gestionar sus tutores a cargo:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {leadTutores.map(lt => {
                    const count = (lt.assignedTutorIds || []).length;
                    const isSelected = (currentLeadTutor?.id === lt.id);

                    return (
                      <button
                        key={lt.id}
                        type="button"
                        onClick={() => {
                          setSelectedLeadTutorId(lt.id);
                          setSelectedAssignedIds(lt.assignedTutorIds || []);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-[#092c4c] text-white border-[#092c4c] shadow-md ring-2 ring-indigo-400/50'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <ShieldCheck className={`w-4 h-4 ${isSelected ? 'text-[#3a9ad9]' : 'text-indigo-600'}`} />
                        <span>{lt.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {count} a cargo
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista de tutores pares disponibles para asignarle */}
              {currentLeadTutor && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#3a9ad9]" />
                        <span>2. Tutores Pares Disponibles para Asignar a <strong>{currentLeadTutor.name}</strong></span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Marca las casillas de los tutores que estarán bajo la supervisión de este Tutor de Tutores.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 self-start sm:self-auto">
                      {selectedAssignedIds.length} tutores seleccionados
                    </span>
                  </div>

                  {peerTutores.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl">
                      No hay tutores pares estándar registrados para asignar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {peerTutores.map(peer => {
                        const isAssigned = selectedAssignedIds.includes(peer.id);

                        return (
                          <div
                            key={peer.id}
                            onClick={() => handleToggleAssignTutor(peer.id)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isAssigned
                                ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400/40'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="space-y-1">
                              <p className="font-bold text-slate-900 text-xs leading-snug">{peer.name}</p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-[#3a9ad9]" />
                                <span className="truncate">{peer.career || 'Tutor Par'}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">RUT: {peer.rut}</p>
                            </div>

                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => {}} // handled by parent onClick
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer mt-0.5"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSaveAssignments}
                      disabled={isSavingAssignments}
                      className="px-5 py-2.5 bg-[#092c4c] hover:bg-indigo-950 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <UserCheck className="w-4 h-4 text-[#3a9ad9]" />
                      <span>{isSavingAssignments ? 'Guardando...' : `Guardar Tutores a Cargo de ${currentLeadTutor.name}`}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Nómina General de Tutores */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Equipo Completo de Tutores ({tutores.length})</h3>
            <p className="text-xs text-slate-500">Tutores Pares y Tutores de Tutores capacitados para acompañamiento académico</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tutor..."
              value={tutorSearch}
              onChange={(e) => setTutorSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3a9ad9]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Tutor / Carrera</th>
                <th className="py-3 px-4">Tipo de Tutor</th>
                <th className="py-3 px-4">RUT</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTutores.map(tut => {
                const isLead = tut.tutorType === 'tutor_de_tutores';
                const assignedCount = (tut.assignedTutorIds || []).length;

                return (
                  <tr key={tut.id} className="hover:bg-slate-50">
                    <td className="py-3 px-5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{tut.name}</span>
                        {isLead && (
                          <span title="Tutor de Tutores">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 inline" />
                          </span>
                        )}
                      </div>
                      <div className="text-[#3a9ad9]">{tut.career}</div>
                    </td>
                    <td className="py-3 px-4">
                      {isLead ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            Tutor de Tutores
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {assignedCount} tutor(es) a cargo
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                          <BookOpen className="w-3 h-3 text-sky-600" />
                          Tutor Par
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">{tut.rut}</td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => {
                          setEditingTutor(tut);
                          setEditName(tut.name);
                          setEditRut(tut.rut);
                          setEditEmail(tut.email);
                          setEditCareer(tut.career || '');
                          setEditTutorType(tut.tutorType || 'tutor_par');
                          setEditPassword('');
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 mr-1"
                        title="Editar Tutor"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTutor(tut)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                        title="Eliminar Tutor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edición */}
      {editingTutor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Editar Información del Tutor</h3>
            <form onSubmit={handleSaveEditTutor} className="space-y-3">
              {/* Selector de Subtipo en Edición */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tipo de Tutor</label>
                <select
                  value={editTutorType}
                  onChange={(e) => setEditTutorType(e.target.value as TutorType)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  <option value="tutor_par">Tutor Par (Estándar)</option>
                  <option value="tutor_de_tutores">Tutor de Tutores (Coordinador de Pares)</option>
                </select>
              </div>

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
                  onClick={() => setEditingTutor(null)}
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

