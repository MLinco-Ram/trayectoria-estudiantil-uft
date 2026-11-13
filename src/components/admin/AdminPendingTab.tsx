import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, FileSpreadsheet, Loader2, Search, Send, Trash2, Upload, UserPlus, X
} from 'lucide-react';
import { PendingUser, TutorType } from '../../types';
import { pendingUsersApi } from '../../services/api';
import { getSocket } from '../../services/socket';
import { formatRut } from '../../data';
import { CareerSelect } from '../common/CareerSelect';

// Opciones de rol: el tutor puede ser Par, de Tutores o ambos
type RoleOption = '' | 'alumno' | 'tutor_par' | 'tutor_de_tutores' | 'tutor_both' | 'docente';
const ROLE_OPTIONS: { value: RoleOption; label: string }[] = [
  { value: '', label: '— Sin rol —' },
  { value: 'alumno', label: 'Alumno' },
  { value: 'tutor_par', label: 'Tutor Par' },
  { value: 'tutor_de_tutores', label: 'Tutor de Tutores' },
  { value: 'tutor_both', label: 'Tutor Par + de Tutores' },
  { value: 'docente', label: 'Docente' },
];

const toRoleOption = (p: PendingUser): RoleOption => {
  if (p.role === 'tutor') {
    const par = p.tutorTypes.includes('tutor_par');
    const lead = p.tutorTypes.includes('tutor_de_tutores');
    return par && lead ? 'tutor_both' : lead ? 'tutor_de_tutores' : 'tutor_par';
  }
  return p.role || '';
};

const fromRoleOption = (opt: RoleOption): { role: PendingUser['role']; tutorTypes?: TutorType[] } => {
  if (opt === 'tutor_par') return { role: 'tutor', tutorTypes: ['tutor_par'] };
  if (opt === 'tutor_de_tutores') return { role: 'tutor', tutorTypes: ['tutor_de_tutores'] };
  if (opt === 'tutor_both') return { role: 'tutor', tutorTypes: ['tutor_par', 'tutor_de_tutores'] };
  return { role: opt || null };
};

// Normaliza encabezados: "Correo Electrónico" -> "correoelectronico"
const normHeader = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const cellText = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (o.richText) return o.richText.map(r => r.text).join('').trim();
    if (o.text) return String(o.text).trim();
    if (o.result != null) return String(o.result).trim();
    if (o.hyperlink) return o.hyperlink.replace(/^mailto:/i, '').trim();
  }
  return String(v).trim();
};

// Lee el primer hoja del .xlsx: columnas Nombre, Apellido, RUT, Correo y (opcional) Carrera.
// La columna Contraseña se ignora: la contraseña son los últimos 4 caracteres del RUT. El RUT no se
// guarda; la cuenta se crea sin RUT y la persona ingresa con su correo.
async function parseExcel(file: File) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('El archivo no tiene hojas.');

  const headerRow = sheet.getRow(1);
  const cols: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const h = normHeader(cell.value);
    if (h.startsWith('nombre')) cols.name ??= col;
    else if (h.startsWith('apellido')) cols.lastName ??= col;
    else if (h === 'rut' || h.startsWith('rut')) cols.rut ??= col;
    else if (h.startsWith('correo') || h.startsWith('email') || h.startsWith('mail')) cols.email ??= col;
    else if (h.startsWith('carrera')) cols.career ??= col;
  });
  if (!cols.name || !cols.rut || !cols.email) {
    throw new Error('No se encontraron las columnas obligatorias en la fila 1: Nombre, RUT y Correo.');
  }

  const rows: { name: string; rut: string; email: string; career?: string }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const first = cellText(row.getCell(cols.name).value);
    const last = cols.lastName ? cellText(row.getCell(cols.lastName).value) : '';
    const rut = cellText(row.getCell(cols.rut).value);
    const email = cellText(row.getCell(cols.email).value);
    if (!first && !rut && !email) return; // fila vacía
    rows.push({
      name: [first, last].filter(Boolean).join(' ').replace(/\s+/g, ' '),
      rut,
      email,
      career: cols.career ? cellText(row.getCell(cols.career).value) : undefined,
    });
  });
  return rows;
}

type Banner = { status: 'success' | 'error'; message: string; details?: string[] } | null;

export const AdminPendingTab: React.FC<{ onRegistered?: () => void }> = ({ onRegistered }) => {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [bulkRole, setBulkRole] = useState<RoleOption>('');
  const [banner, setBanner] = useState<Banner>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showManual, setShowManual] = useState(false);
  const emptyManual = { name: '', rut: '', email: '', career: '', role: '' as RoleOption };
  const [manual, setManual] = useState(emptyManual);

  const load = useCallback(async () => {
    try {
      const list = await pendingUsersApi.list();
      setPending(list);
      setSelected(prev => new Set([...prev].filter(id => list.some(p => p.id === id))));
    } catch (err: any) {
      setBanner({ status: 'error', message: err.message || 'No se pudo cargar la lista de pendientes.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('pending_users:changed', load);
    return () => {
      socket.off('pending_users:changed', load);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(p =>
      p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [pending, search]);

  const selectedIds = [...selected];
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const withoutRole = pending.filter(p => !p.role).length;

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach(p => next.delete(p.id));
      else filtered.forEach(p => next.add(p.id));
      return next;
    });

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err: any) {
      setBanner({ status: 'error', message: err.message || 'Ocurrió un error.' });
    } finally {
      setBusy(null);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run('import', async () => {
      const rows = await parseExcel(file);
      if (rows.length === 0) throw new Error('El archivo no tiene filas con datos.');
      const res = await pendingUsersApi.import(rows);
      setBanner({
        status: res.added > 0 ? 'success' : 'error',
        message: `${res.added} de ${rows.length} usuarios agregados a pendientes.${res.skipped.length ? ` ${res.skipped.length} omitidos.` : ''} Aún no se ha enviado ningún correo.`,
        details: res.skipped.map(s => `${s.label}: ${s.reason}`),
      });
      await load();
    });
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    run('manual', async () => {
      const roleData = fromRoleOption(manual.role);
      const res = await pendingUsersApi.import([{
        name: manual.name.trim(),
        rut: manual.rut.trim(),
        email: manual.email.trim(),
        career: manual.role === 'docente' ? '' : manual.career,
        role: roleData.role,
        tutorTypes: roleData.tutorTypes,
      }]);
      if (res.added === 0) {
        throw new Error(res.skipped[0]?.reason || 'No se pudo agregar a pendientes.');
      }
      setBanner({ status: 'success', message: `${manual.name.trim()} agregado a pendientes. Aún no se le ha enviado ningún correo.` });
      setManual(emptyManual);
      await load();
    });
  };

  const updateRows = (ids: string[], changes: Parameters<typeof pendingUsersApi.update>[1]) =>
    run(`update:${ids.join(',')}`, async () => {
      // Actualización optimista para que el selector responda al instante
      setPending(prev => prev.map(p => (ids.includes(p.id) ? { ...p, ...changes } as PendingUser : p)));
      await pendingUsersApi.update(ids, changes);
    });

  const applyBulkRole = () => {
    if (selectedIds.length === 0 || !bulkRole) return;
    const change = fromRoleOption(bulkRole);
    updateRows(selectedIds, { role: change.role, ...(change.tutorTypes ? { tutorTypes: change.tutorTypes } : {}) });
  };

  const register = (ids: string[]) => {
    const targets = pending.filter(p => ids.includes(p.id));
    const ready = targets.filter(p => p.role);
    if (ready.length === 0) {
      setBanner({ status: 'error', message: 'Asigna un rol antes de registrar.' });
      return;
    }
    const missing = targets.length - ready.length;
    const ok = window.confirm(
      `Se crearán ${ready.length} cuenta(s) y cada persona recibirá un correo con su contraseña (últimos 4 caracteres del RUT). Ingresarán con su correo.` +
        (missing ? `\n\n${missing} seleccionado(s) sin rol se omitirán.` : '') +
        '\n\n¿Continuar?'
    );
    if (!ok) return;
    run('register', async () => {
      const res = await pendingUsersApi.register(ready.map(p => p.id));
      const sent = res.registered.filter(r => r.emailSent).length;
      const notSent = res.registered.length - sent;
      setBanner({
        status: res.failed.length === 0 ? 'success' : 'error',
        message:
          `${res.registered.length} usuario(s) registrado(s); ${sent} correo(s) enviado(s).` +
          (notSent ? ` ${notSent} sin correo (revisa la configuración SMTP y usa "Enviar contraseña por correo" desde su ficha).` : '') +
          (res.failed.length ? ` ${res.failed.length} no se pudieron registrar.` : ''),
        details: res.failed.map(f => `${f.name}: ${f.reason}`),
      });
      await load();
      onRegistered?.();
    });
  };

  const remove = (ids: string[]) => {
    if (!window.confirm(`¿Quitar ${ids.length} persona(s) de pendientes? No se les enviará ningún correo.`)) return;
    run('delete', async () => {
      await pendingUsersApi.remove(ids);
      await load();
    });
  };

  const selectClass =
    'px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none cursor-pointer';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Cabecera */}
      <div className="bg-[#092c4c] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10 border border-white/15">
            <ClipboardList className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <h2 className="font-bold text-base">Usuarios Pendientes de Registro ({pending.length})</h2>
            <p className="text-xs text-slate-300">
              Importados desde Excel. No reciben correo hasta que les asignes un rol y los registres.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowManual(v => !v)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{showManual ? 'Cerrar formulario' : 'Agregar a mano'}</span>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy === 'import'}
            className="px-4 py-2 rounded-xl bg-[#3a9ad9] hover:bg-sky-400 text-[#092c4c] font-bold text-xs flex items-center gap-2 transition disabled:opacity-60 cursor-pointer"
          >
            {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>Importar Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {showManual && (
          <form onSubmit={handleManualAdd} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#3a9ad9]" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Agregar a pendientes</h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">No se envía correo hasta registrarlo.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label htmlFor="pm-name" className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Nombre completo</label>
                <input id="pm-name" required value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none" placeholder="Nombre y apellidos" />
              </div>
              <div>
                <label htmlFor="pm-rut" className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1" title="Solo se usan sus últimos 4 caracteres como contraseña; el RUT no se guarda">RUT <span className="normal-case font-normal">(no se guarda)</span></label>
                <input id="pm-rut" required value={manual.rut} onChange={(e) => setManual({ ...manual, rut: formatRut(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono" placeholder="20.123.456-7" />
              </div>
              <div className="lg:col-span-2">
                <label htmlFor="pm-email" className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Correo</label>
                <input id="pm-email" type="email" required value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono" placeholder="usuario@uft.edu" />
              </div>
              <div>
                <label htmlFor="pm-role" className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Rol <span className="normal-case font-normal">(opcional)</span></label>
                <select id="pm-role" value={manual.role} onChange={(e) => setManual({ ...manual, role: e.target.value as RoleOption })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none cursor-pointer">
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {manual.role !== 'docente' && (
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Carrera <span className="normal-case font-normal">(opcional)</span></label>
                  <CareerSelect value={manual.career} onChange={(v) => setManual({ ...manual, career: v })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none" />
                </div>
              )}
              <div className="flex items-end lg:col-start-5">
                <button
                  type="submit"
                  disabled={busy === 'manual'}
                  className="w-full px-3 py-2 rounded-lg bg-[#092c4c] dark:bg-[#3a9ad9] text-white dark:text-[#092c4c] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#0c3c66] disabled:opacity-50 cursor-pointer"
                >
                  {busy === 'manual' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Agregar a pendientes
                </button>
              </div>
            </div>
          </form>
        )}

        {banner && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              banner.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {banner.status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold">{banner.message}</p>
              {banner.details && banner.details.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-bold">Ver detalle ({banner.details.length})</summary>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
                    {banner.details.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </details>
              )}
            </div>
            <button type="button" onClick={() => setBanner(null)} className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer" aria-label="Cerrar aviso">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Barra de acciones */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{selectedIds.length} seleccionado(s)</span>
            <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value as RoleOption)} className={selectClass} aria-label="Rol para los seleccionados">
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value ? o.label : 'Elegir rol…'}</option>)}
            </select>
            <button
              type="button"
              onClick={applyBulkRole}
              disabled={selectedIds.length === 0 || !bulkRole || busy !== null}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              Asignar rol
            </button>
            <button
              type="button"
              onClick={() => register(selectedIds)}
              disabled={selectedIds.length === 0 || busy !== null}
              className="px-3 py-1.5 rounded-lg bg-[#092c4c] dark:bg-[#3a9ad9] text-white dark:text-[#092c4c] text-xs font-bold flex items-center gap-1.5 hover:bg-[#0c3c66] disabled:opacity-40 cursor-pointer"
            >
              {busy === 'register' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Registrar y enviar correo
            </button>
            <button
              type="button"
              onClick={() => remove(selectedIds)}
              disabled={selectedIds.length === 0 || busy !== null}
              className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 cursor-pointer"
            >
              Quitar
            </button>
          </div>
        </div>

        {withoutRole > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {withoutRole} persona(s) sin rol. Asígnalo antes de registrarlas.
          </p>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : pending.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No hay usuarios pendientes</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Importa un Excel con las columnas <strong>Nombre</strong>, <strong>Apellido</strong>, <strong>RUT</strong> y <strong>Correo</strong> (Carrera opcional), o usa <strong>Agregar a mano</strong>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 w-8">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Seleccionar todos" className="cursor-pointer" />
                  </th>
                  <th className="p-3 text-left">Nombre</th>
                  <th className="p-3 text-left">Correo</th>
                  <th className="p-3 text-left">Rol</th>
                  <th className="p-3 text-left">Carrera / Cargo</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(p => (
                  <tr key={p.id} className={selected.has(p.id) ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Seleccionar a ${p.name}`} className="cursor-pointer" />
                    </td>
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{p.name}</td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{p.email}</td>
                    <td className="p-3">
                      <select
                        value={toRoleOption(p)}
                        onChange={(e) => {
                          const change = fromRoleOption(e.target.value as RoleOption);
                          updateRows([p.id], { role: change.role, ...(change.tutorTypes ? { tutorTypes: change.tutorTypes } : {}) });
                        }}
                        className={`${selectClass} ${!p.role ? 'border-amber-400 dark:border-amber-600' : ''}`}
                        aria-label={`Rol de ${p.name}`}
                      >
                        {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="p-3 min-w-[180px]">
                      {p.role === 'docente' ? (
                        <span className="text-slate-500 dark:text-slate-400">{p.career || 'Coordinación Docente'}</span>
                      ) : (
                        <CareerSelect
                          value={p.career}
                          onChange={(v) => updateRows([p.id], { career: v })}
                          className={`${selectClass} w-full`}
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => register([p.id])}
                          disabled={!p.role || busy !== null}
                          title={p.role ? 'Registrar y enviar correo' : 'Asigna un rol primero'}
                          className="p-1.5 rounded-lg text-[#092c4c] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 disabled:opacity-30 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove([p.id])}
                          disabled={busy !== null}
                          title="Quitar de pendientes"
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
