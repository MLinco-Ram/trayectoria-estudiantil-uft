import React, { useState, useMemo } from 'react';
import { Session, User, StudentRequest, IssueReport } from '../../types';
import { 
  TrendingUp, 
  Users, 
  CheckSquare, 
  Calendar, 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  Sparkles, 
  Filter, 
  Clock, 
  AlertTriangle, 
  BookOpen, 
  GraduationCap, 
  ArrowUpRight, 
  Layers, 
  CalendarDays,
  PieChart as PieChartIcon,
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Flame,
  Target,
  Zap,
  Star,
  CheckCheck,
  CalendarCheck
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { TIME_SLOTS } from '../../data';

type TimeRangeFilter = 'dia' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'anio' | 'todo';

interface DocenteAnalyticsTabProps {
  sessions: Session[];
  allUsers: User[];
  studentRequests?: StudentRequest[];
  reports?: IssueReport[];
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const SHORT_MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Helper para generar curva SVG suave (Catmull-Rom / Bezier)
function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export const DocenteAnalyticsTab: React.FC<DocenteAnalyticsTabProps> = ({
  sessions,
  allUsers,
  studentRequests = [],
  reports = [],
}) => {
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('todo');
  const [selectedReportType, setSelectedReportType] = useState<'all_sessions' | 'tutors_summary' | 'detailed_attendance' | 'conflicts_summary'>('all_sessions');
  const [isExporting, setIsExporting] = useState(false);
  
  const [hoveredTutoriasMonth, setHoveredTutoriasMonth] = useState<number | null>(null);
  const [hoveredTalleresMonth, setHoveredTalleresMonth] = useState<number | null>(null);

  // Helper para validar si una fecha está dentro del rango temporal seleccionado
  const isWithinTimeRange = (dateStr?: string): boolean => {
    if (!dateStr || timeRange === 'todo') return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return true;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    switch (timeRange) {
      case 'dia':
        return diffDays >= -1 && diffDays <= 1;
      case 'semana':
        return diffDays >= -1 && diffDays <= 7;
      case 'mes':
        return diffDays >= -1 && diffDays <= 30;
      case 'trimestre':
        return diffDays >= -1 && diffDays <= 90;
      case 'semestre':
        return diffDays >= -1 && diffDays <= 180;
      case 'anio':
        return diffDays >= -1 && diffDays <= 365;
      default:
        return true;
    }
  };

  // Datos filtrados por rango
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => isWithinTimeRange(s.date));
  }, [sessions, timeRange]);

  const filteredStudentRequests = useMemo(() => {
    return studentRequests.filter(r => isWithinTimeRange(r.createdAt));
  }, [studentRequests, timeRange]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => isWithinTimeRange(r.createdAt));
  }, [reports, timeRange]);

  // ==========================================
  // CÁLCULOS KPI GLOBALES
  // ==========================================
  const totalSessions = filteredSessions.length;
  const completedSessions = filteredSessions.filter(s => s.isCompleted).length;

  let totalInscriptions = 0;
  let totalPresentes = 0;
  let totalAusentes = 0;
  let totalPendientes = 0;
  let totalCapacidadSalas = 0;
  let totalRatingsSum = 0;
  let totalRatingsCount = 0;

  const attendedStudentsSet = new Set<string>();
  const studentSessionCountMap = new Map<string, number>();

  filteredSessions.forEach(sess => {
    const studentIds = sess.studentIds || [];
    totalInscriptions += studentIds.length;
    totalCapacidadSalas += (sess.maxSpots || 10);

    studentIds.forEach(stId => {
      const count = studentSessionCountMap.get(stId) || 0;
      studentSessionCountMap.set(stId, count + 1);

      const att = sess.attendance?.[stId];
      if (att === 'presente') {
        totalPresentes++;
        attendedStudentsSet.add(stId);
      } else if (att === 'ausente') {
        totalAusentes++;
      } else {
        totalPendientes++;
      }
    });

    // Calificaciones / Feedback
    if (sess.ratings) {
      Object.values(sess.ratings).forEach((r: any) => {
        if (r && typeof r.rating === 'number') {
          totalRatingsSum += r.rating;
          totalRatingsCount++;
        }
      });
    }
  });

  const attendanceRatio = (totalPresentes + totalAusentes) > 0 
    ? Math.round((totalPresentes / (totalPresentes + totalAusentes)) * 100) 
    : 100;

  const occupancyRate = totalCapacidadSalas > 0
    ? Math.min(100, Math.round((totalInscriptions / totalCapacidadSalas) * 100))
    : 0;

  const averageRating = totalRatingsCount > 0 
    ? (totalRatingsSum / totalRatingsCount).toFixed(1) 
    : '4.8';

  const totalTutores = allUsers.filter(u => u.role === 'tutor').length;
  const totalAlumnos = allUsers.filter(u => u.role === 'alumno').length;

  // Alumnos recurrentes
  let recurringStudentsCount = 0;
  studentSessionCountMap.forEach((cnt) => {
    if (cnt >= 2) recurringStudentsCount++;
  });

  // ==========================================
  // 1. ANÁLISIS DE ASISTENCIA POR CARRERAS
  // ==========================================
  const careerAttendanceStats = useMemo(() => {
    const careerMap: Record<string, {
      career: string;
      totalInscritos: number;
      presentes: number;
      ausentes: number;
      pendientes: number;
      studentsCount: Set<string>;
    }> = {};

    const studentCareerMap = new Map<string, string>();
    allUsers.forEach(u => {
      if (u.role === 'alumno') {
        studentCareerMap.set(u.id, u.career || 'Otras Carreras / Pregrado');
      }
    });

    filteredSessions.forEach(sess => {
      const stIds = sess.studentIds || [];
      stIds.forEach(stId => {
        const career = studentCareerMap.get(stId) || 'Pregrado UFT';
        if (!careerMap[career]) {
          careerMap[career] = {
            career,
            totalInscritos: 0,
            presentes: 0,
            ausentes: 0,
            pendientes: 0,
            studentsCount: new Set(),
          };
        }
        careerMap[career].totalInscritos++;
        careerMap[career].studentsCount.add(stId);

        const att = sess.attendance?.[stId];
        if (att === 'presente') careerMap[career].presentes++;
        else if (att === 'ausente') careerMap[career].ausentes++;
        else careerMap[career].pendientes++;
      });
    });

    return Object.values(careerMap)
      .map(item => {
        const marcados = item.presentes + item.ausentes;
        const pct = marcados > 0 ? Math.round((item.presentes / marcados) * 100) : (item.totalInscritos > 0 ? 100 : 0);
        return {
          career: item.career,
          totalInscritos: item.totalInscritos,
          presentes: item.presentes,
          ausentes: item.ausentes,
          pendientes: item.pendientes,
          uniqueStudents: item.studentsCount.size,
          attendancePct: pct
        };
      })
      .sort((a, b) => b.presentes - a.presentes || b.totalInscritos - a.totalInscritos);
  }, [filteredSessions, allUsers]);

  const maxCareerPresentes = Math.max(...careerAttendanceStats.map(c => c.presentes), 1);

  // =========================================================================
  // 2. DOS GRANDES GRÁFICOS SEPARADOS:
  //    A) GRÁFICO GRANDE 1: TUTORÍAS ACADÉMICAS (12 MESES JUNTOS EN UN SOLO GRÁFICO)
  //    B) GRÁFICO GRANDE 2: TALLERES PSICOEDUCATIVOS (12 MESES JUNTOS EN UN SOLO GRÁFICO)
  // =========================================================================
  const { monthlyTutorias, monthlyTalleres, maxTutoriasVal, maxTalleresVal } = useMemo(() => {
    const tutArr = [];
    const talArr = [];

    for (let m = 0; m < 12; m++) {
      tutArr.push({
        monthIndex: m,
        monthName: MONTH_NAMES[m],
        shortName: SHORT_MONTH_NAMES[m],
        agendadas: 0,
        completadas: 0,
        inscritos: 0,
        presentes: 0,
        asistenciaPct: 0
      });

      talArr.push({
        monthIndex: m,
        monthName: MONTH_NAMES[m],
        shortName: SHORT_MONTH_NAMES[m],
        agendadas: 0,
        completadas: 0,
        inscritos: 0,
        presentes: 0,
        asistenciaPct: 0
      });
    }

    filteredSessions.forEach(sess => {
      const date = new Date(sess.date);
      if (isNaN(date.getTime())) return;
      const m = date.getMonth();
      const stIds = sess.studentIds || [];

      let pres = 0;
      stIds.forEach(id => {
        if (sess.attendance?.[id] === 'presente') pres++;
      });

      if (sess.program === 'tutorias') {
        tutArr[m].agendadas++;
        tutArr[m].inscritos += stIds.length;
        tutArr[m].presentes += pres;
        if (sess.isCompleted) tutArr[m].completadas++;
      } else {
        talArr[m].agendadas++;
        talArr[m].inscritos += stIds.length;
        talArr[m].presentes += pres;
        if (sess.isCompleted) talArr[m].completadas++;
      }
    });

    for (let m = 0; m < 12; m++) {
      tutArr[m].asistenciaPct = tutArr[m].inscritos > 0
        ? Math.round((tutArr[m].presentes / tutArr[m].inscritos) * 100)
        : (tutArr[m].agendadas > 0 ? 100 : 0);

      talArr[m].asistenciaPct = talArr[m].inscritos > 0
        ? Math.round((talArr[m].presentes / talArr[m].inscritos) * 100)
        : (talArr[m].agendadas > 0 ? 100 : 0);
    }

    const maxTut = Math.max(...tutArr.map(t => Math.max(t.agendadas, t.completadas, t.presentes)), 1);
    const maxTal = Math.max(...talArr.map(t => Math.max(t.agendadas, t.completadas, t.presentes)), 1);

    return {
      monthlyTutorias: tutArr,
      monthlyTalleres: talArr,
      maxTutoriasVal: maxTut,
      maxTalleresVal: maxTal
    };
  }, [filteredSessions]);

  // Dimensiones para los gráficos SVG continuos
  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 200;
  const PAD_X = 40;
  const PAD_Y = 25;
  const PLOT_W = SVG_WIDTH - 2 * PAD_X;
  const PLOT_H = SVG_HEIGHT - 2 * PAD_Y;

  // Puntos SVG para GRÁFICO 1: TUTORÍAS (Curva Agendadas y Curva Completadas)
  const tutAgendadasPoints = useMemo(() => {
    return monthlyTutorias.map((m, idx) => {
      const x = PAD_X + (idx / 11) * PLOT_W;
      const y = SVG_HEIGHT - PAD_Y - (m.agendadas / maxTutoriasVal) * PLOT_H;
      return { x, y, data: m };
    });
  }, [monthlyTutorias, maxTutoriasVal]);

  const tutCompletadasPoints = useMemo(() => {
    return monthlyTutorias.map((m, idx) => {
      const x = PAD_X + (idx / 11) * PLOT_W;
      const y = SVG_HEIGHT - PAD_Y - (m.completadas / maxTutoriasVal) * PLOT_H;
      return { x, y, data: m };
    });
  }, [monthlyTutorias, maxTutoriasVal]);

  const tutAgendadasPath = generateSmoothPath(tutAgendadasPoints);
  const tutAgendadasAreaPath = `${tutAgendadasPath} L ${PAD_X + PLOT_W} ${SVG_HEIGHT - PAD_Y} L ${PAD_X} ${SVG_HEIGHT - PAD_Y} Z`;
  const tutCompletadasPath = generateSmoothPath(tutCompletadasPoints);

  // Puntos SVG para GRÁFICO 2: TALLERES (Curva Agendadas y Curva Completadas)
  const talAgendadasPoints = useMemo(() => {
    return monthlyTalleres.map((m, idx) => {
      const x = PAD_X + (idx / 11) * PLOT_W;
      const y = SVG_HEIGHT - PAD_Y - (m.agendadas / maxTalleresVal) * PLOT_H;
      return { x, y, data: m };
    });
  }, [monthlyTalleres, maxTalleresVal]);

  const talCompletadasPoints = useMemo(() => {
    return monthlyTalleres.map((m, idx) => {
      const x = PAD_X + (idx / 11) * PLOT_W;
      const y = SVG_HEIGHT - PAD_Y - (m.completadas / maxTalleresVal) * PLOT_H;
      return { x, y, data: m };
    });
  }, [monthlyTalleres, maxTalleresVal]);

  const talAgendadasPath = generateSmoothPath(talAgendadasPoints);
  const talAgendadasAreaPath = `${talAgendadasPath} L ${PAD_X + PLOT_W} ${SVG_HEIGHT - PAD_Y} L ${PAD_X} ${SVG_HEIGHT - PAD_Y} Z`;
  const talCompletadasPath = generateSmoothPath(talCompletadasPoints);

  // ==========================================
  // 3. MATRIZ DE DEMANDA HORARIA (HEATMAP)
  // ==========================================
  const scheduleHeatmap = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    TIME_SLOTS.forEach(slot => {
      grid[slot] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    });

    filteredSessions.forEach(s => {
      if (!s.date || !s.timeSlot) return;
      const d = new Date(s.date);
      if (isNaN(d.getTime())) return;
      
      let dayIndex = d.getDay() - 1;
      if (dayIndex < 0 || dayIndex > 4) dayIndex = 0;

      if (grid[s.timeSlot]) {
        grid[s.timeSlot][dayIndex] = (grid[s.timeSlot][dayIndex] || 0) + (s.studentIds?.length || 1);
      }
    });

    let maxVal = 1;
    TIME_SLOTS.forEach(slot => {
      for (let day = 0; day < 5; day++) {
        if (grid[slot][day] > maxVal) maxVal = grid[slot][day];
      }
    });

    return { grid, maxVal };
  }, [filteredSessions]);

  // ==========================================
  // 4. ANÁLISIS DE INCIDENTES DE TOPE DE HORARIO
  // ==========================================
  const scheduleConflictStats = useMemo(() => {
    const conflictStudentIds = new Set<string>();
    let resolvedCount = 0;
    let pendingCount = 0;

    const careerConflictMap: Record<string, {
      career: string;
      conflictCount: number;
      students: Set<string>;
    }> = {};

    filteredStudentRequests.forEach(req => {
      if (req.studentId) conflictStudentIds.add(req.studentId);
      if (req.status === 'resuelto') resolvedCount++;
      else pendingCount++;

      const student = allUsers.find(u => u.id === req.studentId);
      const career = req.studentCareer || student?.career || 'Pregrado UFT';
      
      if (!careerConflictMap[career]) {
        careerConflictMap[career] = { career, conflictCount: 0, students: new Set() };
      }
      careerConflictMap[career].conflictCount++;
      if (req.studentId) careerConflictMap[career].students.add(req.studentId);
    });

    filteredReports.forEach(rep => {
      if (rep.status === 'resuelto') resolvedCount++;
      else pendingCount++;
    });

    const totalConflicts = filteredStudentRequests.length + filteredReports.length;
    const studentWithConflictCount = conflictStudentIds.size;
    const conflictPercentage = totalAlumnos > 0 
      ? Math.round((studentWithConflictCount / totalAlumnos) * 100) 
      : 0;

    const resolutionRate = totalConflicts > 0 
      ? Math.round((resolvedCount / totalConflicts) * 100) 
      : 100;

    const careerConflictList = Object.values(careerConflictMap)
      .map(c => ({
        career: c.career,
        totalConflicts: c.conflictCount,
        uniqueStudents: c.students.size,
        pctOfTotalConflicts: totalConflicts > 0 ? Math.round((c.conflictCount / totalConflicts) * 100) : 0
      }))
      .sort((a, b) => b.totalConflicts - a.totalConflicts);

    return {
      totalConflicts,
      studentWithConflictCount,
      conflictPercentage,
      resolvedCount,
      pendingCount,
      resolutionRate,
      careerConflictList,
      maxCareerConflicts: Math.max(...careerConflictList.map(c => c.totalConflicts), 1)
    };
  }, [filteredStudentRequests, filteredReports, allUsers, totalAlumnos]);

  // ==========================================
  // 5. ASIGNATURAS Y TALLERES CON MAYOR DEMANDA
  // ==========================================
  const topSubjectsStats = useMemo(() => {
    const subMap: Record<string, { subject: string; program: string; count: number; inscriptions: number; capacity: number }> = {};
    
    filteredSessions.forEach(s => {
      const sub = s.subject || s.title || 'General';
      if (!subMap[sub]) {
        subMap[sub] = {
          subject: sub,
          program: s.program,
          count: 0,
          inscriptions: 0,
          capacity: 0
        };
      }
      subMap[sub].count++;
      subMap[sub].inscriptions += (s.studentIds?.length || 0);
      subMap[sub].capacity += (s.maxSpots || 10);
    });

    return Object.values(subMap)
      .map(item => ({
        ...item,
        occupancy: item.capacity > 0 ? Math.min(100, Math.round((item.inscriptions / item.capacity) * 100)) : 0
      }))
      .sort((a, b) => b.inscriptions - a.inscriptions)
      .slice(0, 6);
  }, [filteredSessions]);

  // ==========================================
  // EXPORTACIÓN A EXCEL (.XLSX)
  // ==========================================
  const exportToExcel = async (type: 'all_sessions' | 'tutors_summary' | 'detailed_attendance' | 'conflicts_summary') => {
    setIsExporting(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const generatedAt = new Date().toLocaleString('es-CL');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Trayectoria Estudiantil UFT';
      workbook.created = new Date();

      const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (type === 'all_sessions') {
        const ws = workbook.addWorksheet('Sesiones y Talleres');
        ws.views = [{ showGridLines: true }];

        ws.mergeCells('A1:N1');
        const titleCell = ws.getCell('A1');
        titleCell.value = 'UNIVERSIDAD FINIS TERRAE  •  CENTRO DE APOYO AL APRENDIZAJE';
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092C4C' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(1).height = 30;

        ws.mergeCells('A2:N2');
        const subCell = ws.getCell('A2');
        subCell.value = `Reporte Oficial: Resumen de Sesiones | Filtro: ${timeRange.toUpperCase()} | Emitido: ${generatedAt} | Total: ${filteredSessions.length} Sesiones`;
        subCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF3A9AD9' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF061E34' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(2).height = 22;

        ws.getRow(3).height = 10;

        const headers = [
          'ID Sesión', 'Actividad / Título', 'Programa', 'Asignatura / Área',
          'Fecha', 'Horario', 'Lugar / Modalidad', 'Tutor a Cargo', 'RUT Tutor',
          'Inscritos', 'Presentes', 'Ausentes', '% Asistencia', 'Estado'
        ];

        const headerRow = ws.addRow(headers);
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092C4C' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = borderStyle;
        });

        filteredSessions.forEach((s, idx) => {
          const tutor = allUsers.find(u => u.id === s.tutorId);
          const stIds = s.studentIds || [];
          let presentes = 0;
          let ausentes = 0;
          stIds.forEach(id => {
            const att = s.attendance?.[id];
            if (att === 'presente') presentes++;
            else if (att === 'ausente') ausentes++;
          });
          const totalMarcados = presentes + ausentes;
          const pct = totalMarcados > 0 ? Math.round((presentes / totalMarcados) * 100) : (stIds.length > 0 ? 100 : 0);
          const isEven = idx % 2 === 0;

          const row = ws.addRow([
            s.id,
            s.title,
            s.program === 'tutorias' ? 'Tutorías Académicas' : 'Acompañamiento Psicoeducativo',
            s.subject || 'General',
            s.date,
            s.timeSlot,
            s.location || 'Sala UFT',
            tutor ? tutor.name : 'Coordinación Docente',
            tutor?.rut || 'N/A',
            stIds.length,
            presentes,
            ausentes,
            `${pct}%`,
            s.isCompleted ? 'Completada' : 'Programada'
          ]);

          row.height = 20;
          row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.border = borderStyle;
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
            };

            if ([1, 5, 6, 9, 10, 11, 12, 13, 14].includes(colNumber)) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
          });
        });

        ws.columns = [
          { width: 15 }, { width: 35 }, { width: 28 }, { width: 22 },
          { width: 14 }, { width: 16 }, { width: 22 }, { width: 26 },
          { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 },
          { width: 14 }, { width: 16 }
        ];

      } else if (type === 'tutors_summary') {
        const ws = workbook.addWorksheet('Desempeño Tutores');
        ws.views = [{ showGridLines: true }];

        ws.mergeCells('A1:J1');
        const titleCell = ws.getCell('A1');
        titleCell.value = 'UNIVERSIDAD FINIS TERRAE  •  CENTRO DE APOYO AL APRENDIZAJE';
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092C4C' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(1).height = 30;

        ws.mergeCells('A2:J2');
        const subCell = ws.getCell('A2');
        subCell.value = `Reporte de Desempeño de Tutores | Filtro: ${timeRange.toUpperCase()} | Emitido: ${generatedAt}`;
        subCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF3A9AD9' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF061E34' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(2).height = 22;

        ws.getRow(3).height = 10;

        const headers = [
          'ID Tutor', 'Nombre del Tutor', 'RUT', 'Carrera',
          'Correo Institucional', 'Sesiones Dirigidas', 'Total Alumnos',
          'Asistencias Efectivas', 'Ausencias Registradas', 'Tasa Efectividad'
        ];

        const headerRow = ws.addRow(headers);
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092C4C' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = borderStyle;
        });

        allUsers.filter(u => u.role === 'tutor').forEach((tutor, idx) => {
          const tutorSessions = filteredSessions.filter(s => s.tutorId === tutor.id);
          let totalStudents = 0;
          let tutPresentes = 0;
          let tutAusentes = 0;

          tutorSessions.forEach(s => {
            const stIds = s.studentIds || [];
            totalStudents += stIds.length;
            stIds.forEach(id => {
              const att = s.attendance?.[id];
              if (att === 'presente') tutPresentes++;
              else if (att === 'ausente') tutAusentes++;
            });
          });

          const totalMarcados = tutPresentes + tutAusentes;
          const pct = totalMarcados > 0 ? Math.round((tutPresentes / totalMarcados) * 100) : (totalStudents > 0 ? 100 : 0);
          const isEven = idx % 2 === 0;

          const row = ws.addRow([
            tutor.id,
            tutor.name,
            tutor.rut,
            tutor.career || 'Tutor Par',
            tutor.email || 'N/A',
            tutorSessions.length,
            totalStudents,
            tutPresentes,
            tutAusentes,
            `${pct}%`
          ]);

          row.height = 20;
          row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.border = borderStyle;
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
            };

            if ([1, 3, 6, 7, 8, 9, 10].includes(colNumber)) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
          });
        });

        ws.columns = [
          { width: 15 }, { width: 28 }, { width: 14 }, { width: 28 },
          { width: 26 }, { width: 18 }, { width: 20 }, { width: 22 },
          { width: 16 }, { width: 18 }
        ];

      } else if (type === 'detailed_attendance') {
        const ws = workbook.addWorksheet('Asistencia Nominal');
        ws.views = [{ showGridLines: true }];

        ws.mergeCells('A1:J1');
        const titleCell = ws.getCell('A1');
        titleCell.value = 'UNIVERSIDAD FINIS TERRAE  •  CENTRO DE APOYO AL APRENDIZAJE';
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092C4C' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(1).height = 30;

        ws.mergeCells('A2:J2');
        const subCell = ws.getCell('A2');
        subCell.value = `Reporte Oficial: Asistencia Detallada Alumno por Alumno | Filtro: ${timeRange.toUpperCase()} | Emitido: ${generatedAt}`;
        subCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF3A9AD9' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF061E34' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(2).height = 22;

        ws.getRow(3).height = 10;

        const headers = [
          'Fecha', 'Actividad / Sesión', 'Programa', 'Asignatura',
          'Tutor a Cargo', 'Nombre Alumno', 'RUT Alumno', 'Correo Alumno',
          'Carrera Alumno', 'Estado Asistencia'
        ];

        const headerRow = ws.addRow(headers);
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092C4C' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = borderStyle;
        });

        let rowIndex = 0;
        filteredSessions.forEach(s => {
          const tutor = allUsers.find(u => u.id === s.tutorId);
          const stIds = s.studentIds || [];
          stIds.forEach(stId => {
            rowIndex++;
            const student = allUsers.find(u => u.id === stId);
            const status = (s.attendance?.[stId] || 'pendiente').toUpperCase();
            const isEven = rowIndex % 2 === 0;

            const row = ws.addRow([
              s.date,
              s.title,
              s.program === 'tutorias' ? 'Tutorías Académicas' : 'Acompañamiento Psicoeducativo',
              s.subject || 'General',
              tutor ? tutor.name : 'Coordinación',
              student ? student.name : 'Alumno UFT',
              student?.rut || 'N/A',
              student?.email || 'N/A',
              student?.career || 'Pregrado UFT',
              status
            ]);

            row.height = 20;
            row.eachCell((cell, colNumber) => {
              cell.font = { name: 'Arial', size: 10 };
              cell.border = borderStyle;
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
              };

              if ([1, 7, 10].includes(colNumber)) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
              } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
              }
            });
          });
        });

        ws.columns = [
          { width: 14 }, { width: 34 }, { width: 28 }, { width: 22 },
          { width: 26 }, { width: 28 }, { width: 14 }, { width: 28 },
          { width: 26 }, { width: 18 }
        ];

      } else if (type === 'conflicts_summary') {
        const ws = workbook.addWorksheet('Incidentes y Topes');
        ws.views = [{ showGridLines: true }];

        ws.mergeCells('A1:H1');
        const titleCell = ws.getCell('A1');
        titleCell.value = 'UNIVERSIDAD FINIS TERRAE  •  CENTRO DE APOYO AL APRENDIZAJE';
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092C4C' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(1).height = 30;

        ws.mergeCells('A2:H2');
        const subCell = ws.getCell('A2');
        subCell.value = `Reporte de Incidentes de Horario y Topes | Emitido: ${generatedAt}`;
        subCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF3A9AD9' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF061E34' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(2).height = 22;

        ws.getRow(3).height = 10;

        const headers = [
          'Fecha', 'Tipo Solicitud', 'Nombre Estudiante', 'Carrera',
          'Programa', 'Horario Solicitado', 'Motivo / Mensaje', 'Estado'
        ];

        const headerRow = ws.addRow(headers);
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092C4C' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = borderStyle;
        });

        filteredStudentRequests.forEach((req, idx) => {
          const isEven = idx % 2 === 0;
          const row = ws.addRow([
            req.createdAt?.slice(0, 10) || 'N/A',
            'Tope Horario Alumno',
            req.studentName,
            req.studentCareer || 'Pregrado UFT',
            req.program === 'tutorias' ? 'Tutorías' : 'Psicoeducativo',
            req.preferredTime || 'Flexible',
            req.message,
            (req.status || 'pendiente').toUpperCase()
          ]);

          row.height = 20;
          row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.border = borderStyle;
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
            };
            if ([1, 2, 5, 8].includes(colNumber)) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
          });
        });

        ws.columns = [
          { width: 14 }, { width: 22 }, { width: 28 }, { width: 28 },
          { width: 18 }, { width: 22 }, { width: 40 }, { width: 16 }
        ];
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Reporte_UFT_${type}_${timeRange}_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error exportando a Excel:", e);
      alert("Ocurrió un error al generar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const timeRangeButtons: { id: TimeRangeFilter; label: string; subLabel: string }[] = [
    { id: 'todo', label: 'Todo', subLabel: 'Histórico' },
    { id: 'dia', label: 'Día', subLabel: 'Hoy / 24h' },
    { id: 'semana', label: 'Semana', subLabel: '7 días' },
    { id: 'mes', label: 'Mes', subLabel: '30 días' },
    { id: 'trimestre', label: 'Trimestre', subLabel: '3 meses' },
    { id: 'semestre', label: 'Semestre', subLabel: '6 meses' },
    { id: 'anio', label: 'Año', subLabel: '12 meses' },
  ];

  // Datos para el Donut Chart de Estado de Asistencia
  const totalAttendanceRecords = totalPresentes + totalAusentes + totalPendientes;
  const pctPresentes = totalAttendanceRecords > 0 ? Math.round((totalPresentes / totalAttendanceRecords) * 100) : 0;
  const pctAusentes = totalAttendanceRecords > 0 ? Math.round((totalAusentes / totalAttendanceRecords) * 100) : 0;
  const pctPendientes = totalAttendanceRecords > 0 ? (100 - pctPresentes - pctAusentes) : 0;

  return (
    <div className="space-y-8">
      {/* Panel Superior: Título, Filtro de Rango Temporal y Exportador Excel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        
        {/* Cabecera Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#3a9ad9]" />
              Centro de Analítica y Métricas Institucionales UFT
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Monitoreo continuo de tutorías y talleres en gráficos panorámicos dedicados, mapa de calor y fidelización.
            </p>
          </div>

          {/* Barra de Exportación a Excel */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold px-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Reporte:</span>
            </div>

            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
            >
              <option value="all_sessions">📊 Resumen de Sesiones y Clases</option>
              <option value="tutors_summary">🎓 Desempeño y Carga de Tutores</option>
              <option value="detailed_attendance">👥 Asistencia Nominal Alumno por Alumno</option>
              <option value="conflicts_summary">⚠️ Incidentes de Horario y Topes</option>
            </select>

            <button
              onClick={() => exportToExcel(selectedReportType)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              title="Descargar reporte en formato Microsoft Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Generando...' : 'Descargar Excel'}</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros por Rango de Tiempo */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-[#3a9ad9]" />
              <span>Filtrar período de tiempo:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {timeRangeButtons.map((btn) => {
                const isActive = timeRange === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setTimeRange(btn.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isActive
                        ? 'bg-[#092c4c] text-white shadow-md ring-2 ring-[#3a9ad9]/50'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>{btn.label}</span>
                    <span className={`text-[9px] font-normal ${isActive ? 'text-[#7bd6e0]' : 'text-slate-400'}`}>
                      {btn.subLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Mostrando <strong>{filteredSessions.length}</strong> sesiones en el rango: <strong className="text-[#3a9ad9] uppercase">{timeRange}</strong>
            </span>
            <span className="font-mono font-semibold">
              {totalPresentes + totalAusentes} asistencias registradas
            </span>
          </div>
        </div>

        {/* Tarjetas KPI Superiores (6 Indicadores Estratégicos) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sesiones Totales</span>
              <Calendar className="w-4 h-4 text-[#092c4c]" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{totalSessions}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{completedSessions} completadas</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasa Asistencia</span>
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-2">{attendanceRatio}%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{totalPresentes} de {totalPresentes + totalAusentes} asist.</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inscripciones</span>
              <Users className="w-4 h-4 text-[#3a9ad9]" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{totalInscriptions}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{attendedStudentsSet.size} alumnos únicos</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ocupación Salas</span>
              <Target className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-black text-purple-600 mt-2">{occupancyRate}%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{totalInscriptions} / {totalCapacidadSalas} cupos</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">% Topes Horario</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-500 mt-2">
              {scheduleConflictStats.conflictPercentage}%
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {scheduleConflictStats.studentWithConflictCount} de {totalAlumnos} alumnos
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Satisfacción</span>
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{averageRating} <span className="text-xs text-slate-400 font-normal">/ 5.0</span></p>
            <p className="text-[10px] text-slate-500 mt-0.5">{totalRatingsCount} valoraciones</p>
          </div>
        </div>

        {/* =========================================================================
            SECCIÓN 1: DOS GRANDES GRÁFICOS CONTINUOS Y SEPARADOS
            1. GRÁFICO GRANDE 1: TUTORÍAS ACADÉMICAS (12 MESES JUNTOS Y PEGADOS)
            2. GRÁFICO GRANDE 2: TALLERES PSICOEDUCATIVOS (12 MESES JUNTOS Y PEGADOS)
            ========================================================================= */}
        <div className="space-y-10 mb-10">
          
          {/* GRÁFICO GRANDE 1: EXCLUSIVO TUTORÍAS ACADÉMICAS (12 MESES CONTINUOS JUNTOS) */}
          <div className="bg-slate-50/75 border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-[#092c4c] text-white rounded-xl shadow-xs">
                    <BookOpen className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Flujo Anual Continuo: Tutorías Académicas (Entre Pares y Docentes)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visualización panorámica continua con todos los 12 meses juntos de tutorías agendadas vs completadas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#092c4c]" />
                  <span className="text-slate-700">Tutorías Agendadas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#3a9ad9]" />
                  <span className="text-slate-700">Tutorías Completadas</span>
                </div>
              </div>
            </div>

            {/* Canvas Panorámico SVG Continuo de Tutorías */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-inner space-y-4">
              <div className="relative w-full overflow-hidden" style={{ minHeight: '220px' }}>
                <svg
                  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                  className="w-full h-auto overflow-visible select-none"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="tutoriasAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#092c4c" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#3a9ad9" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Líneas Guía Horizontales */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = PAD_Y + (1 - ratio) * PLOT_H;
                    const val = Math.round(ratio * maxTutoriasVal);
                    return (
                      <g key={idx}>
                        <line
                          x1={PAD_X}
                          y1={y}
                          x2={PAD_X + PLOT_W}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={PAD_X - 10}
                          y={y + 3}
                          textAnchor="end"
                          fontSize="9"
                          fill="#94a3b8"
                          fontFamily="sans-serif"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Área degradada continua de Tutorías */}
                  <path d={tutAgendadasAreaPath} fill="url(#tutoriasAreaGradient)" />

                  {/* Curva 1: Tutorías Agendadas */}
                  <path
                    d={tutAgendadasPath}
                    fill="none"
                    stroke="#092c4c"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Curva 2: Tutorías Completadas */}
                  <path
                    d={tutCompletadasPath}
                    fill="none"
                    stroke="#3a9ad9"
                    strokeWidth="3"
                    strokeDasharray="5 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Nodos Interactivos en cada Mes */}
                  {tutAgendadasPoints.map((pt, idx) => {
                    const isHovered = hoveredTutoriasMonth === idx;
                    return (
                      <g
                        key={idx}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredTutoriasMonth(idx)}
                        onMouseLeave={() => setHoveredTutoriasMonth(null)}
                      >
                        {isHovered && (
                          <line
                            x1={pt.x}
                            y1={PAD_Y}
                            x2={pt.x}
                            y2={SVG_HEIGHT - PAD_Y}
                            stroke="#092c4c"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                        )}

                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 7 : 4.5}
                          fill={isHovered ? '#3a9ad9' : '#ffffff'}
                          stroke="#092c4c"
                          strokeWidth={isHovered ? 3.5 : 2.5}
                          className="transition-all duration-200"
                        />

                        <text
                          x={pt.x}
                          y={pt.y - 12}
                          textAnchor="middle"
                          fontSize={isHovered ? "11" : "9"}
                          fontWeight="bold"
                          fill={isHovered ? "#092c4c" : "#64748b"}
                          fontFamily="sans-serif"
                        >
                          {pt.data.agendadas}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Tira Continua Inferior de 12 Meses Pegados para Tutorías */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5 pt-2 border-t border-slate-100">
                {monthlyTutorias.map((m, idx) => {
                  const isHovered = hoveredTutoriasMonth === idx;
                  return (
                    <div
                      key={m.monthIndex}
                      onMouseEnter={() => setHoveredTutoriasMonth(idx)}
                      onMouseLeave={() => setHoveredTutoriasMonth(null)}
                      className={`p-2 rounded-xl transition-all cursor-pointer text-center border ${
                        isHovered 
                          ? 'bg-[#092c4c] text-white border-[#092c4c] shadow-md scale-105 z-10' 
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <p className={`text-[10px] font-extrabold uppercase ${isHovered ? 'text-[#7bd6e0]' : 'text-slate-500'}`}>
                        {m.shortName}
                      </p>
                      <p className="text-sm font-black my-0.5">
                        {m.agendadas} <span className="text-[9px] font-normal">tut.</span>
                      </p>
                      <p className={`text-[9px] font-bold ${isHovered ? 'text-[#7bd6e0]' : 'text-[#3a9ad9]'}`}>
                        {m.completadas} hechas
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* GRÁFICO GRANDE 2: EXCLUSIVO TALLERES PSICOEDUCATIVOS (12 MESES CONTINUOS JUNTOS) */}
          <div className="bg-slate-50/75 border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-[#02c39a] text-slate-900 rounded-xl shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Flujo Anual Continuo: Talleres Psicoeducativos (Acompañamiento)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visualización panorámica continua con todos los 12 meses juntos de talleres impartidos vs completados.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#02c39a]" />
                  <span className="text-slate-700">Talleres Agendados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-slate-700">Talleres Completados</span>
                </div>
              </div>
            </div>

            {/* Canvas Panorámico SVG Continuo de Talleres */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-inner space-y-4">
              <div className="relative w-full overflow-hidden" style={{ minHeight: '220px' }}>
                <svg
                  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                  className="w-full h-auto overflow-visible select-none"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="talleresAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#02c39a" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#0f7ea8" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Líneas Guía Horizontales */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = PAD_Y + (1 - ratio) * PLOT_H;
                    const val = Math.round(ratio * maxTalleresVal);
                    return (
                      <g key={idx}>
                        <line
                          x1={PAD_X}
                          y1={y}
                          x2={PAD_X + PLOT_W}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={PAD_X - 10}
                          y={y + 3}
                          textAnchor="end"
                          fontSize="9"
                          fill="#94a3b8"
                          fontFamily="sans-serif"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Área degradada continua de Talleres */}
                  <path d={talAgendadasAreaPath} fill="url(#talleresAreaGradient)" />

                  {/* Curva 1: Talleres Agendados */}
                  <path
                    d={talAgendadasPath}
                    fill="none"
                    stroke="#02c39a"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Curva 2: Talleres Completados */}
                  <path
                    d={talCompletadasPath}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeDasharray="5 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Nodos Interactivos en cada Mes */}
                  {talAgendadasPoints.map((pt, idx) => {
                    const isHovered = hoveredTalleresMonth === idx;
                    return (
                      <g
                        key={idx}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredTalleresMonth(idx)}
                        onMouseLeave={() => setHoveredTalleresMonth(null)}
                      >
                        {isHovered && (
                          <line
                            x1={pt.x}
                            y1={PAD_Y}
                            x2={pt.x}
                            y2={SVG_HEIGHT - PAD_Y}
                            stroke="#02c39a"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                        )}

                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 7 : 4.5}
                          fill={isHovered ? '#02c39a' : '#ffffff'}
                          stroke="#02c39a"
                          strokeWidth={isHovered ? 3.5 : 2.5}
                          className="transition-all duration-200"
                        />

                        <text
                          x={pt.x}
                          y={pt.y - 12}
                          textAnchor="middle"
                          fontSize={isHovered ? "11" : "9"}
                          fontWeight="bold"
                          fill={isHovered ? "#00a884" : "#64748b"}
                          fontFamily="sans-serif"
                        >
                          {pt.data.agendadas}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Tira Continua Inferior de 12 Meses Pegados para Talleres */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5 pt-2 border-t border-slate-100">
                {monthlyTalleres.map((m, idx) => {
                  const isHovered = hoveredTalleresMonth === idx;
                  return (
                    <div
                      key={m.monthIndex}
                      onMouseEnter={() => setHoveredTalleresMonth(idx)}
                      onMouseLeave={() => setHoveredTalleresMonth(null)}
                      className={`p-2 rounded-xl transition-all cursor-pointer text-center border ${
                        isHovered 
                          ? 'bg-[#02c39a] text-slate-900 border-[#02c39a] shadow-md scale-105 z-10 font-bold' 
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <p className={`text-[10px] font-extrabold uppercase ${isHovered ? 'text-slate-900' : 'text-slate-500'}`}>
                        {m.shortName}
                      </p>
                      <p className="text-sm font-black my-0.5">
                        {m.agendadas} <span className="text-[9px] font-normal">tall.</span>
                      </p>
                      <p className={`text-[9px] font-bold ${isHovered ? 'text-slate-900' : 'text-amber-600'}`}>
                        {m.completadas} hechos
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECCIÓN 2: DIVERSIDAD DE GRÁFICOS (DONUT DE ASISTENCIA + EMBUDO DE RETENCIÓN)
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          
          {/* GRÁFICO TIPO DONUT / CIRCULAR: DISTRIBUCIÓN GLOBAL DE ASISTENCIA */}
          <div className="lg:col-span-6 bg-slate-50/75 border border-slate-200 rounded-2xl p-6 md:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-[#3a9ad9]" />
                  Gráfico Circular: Distribución de Estado de Asistencia
                </h3>
                <span className="text-xs text-slate-500 font-mono font-semibold">
                  {totalAttendanceRecords} Registros
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Proporción exacta de asistencias efectivas (*Presentes*), inasistencias (*Ausentes*) y sesiones aún pendientes de toma de lista.
              </p>
            </div>

            {/* Donut Chart Visual SVG + Leyendas */}
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 bg-white p-6 rounded-2xl border border-slate-200">
              {/* Gráfico Donut SVG */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Círculo Base */}
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#e2e8f0" strokeWidth="14" />
                  
                  {/* Segmento Presentes (Verde) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="14"
                    strokeDasharray={`${pctPresentes * 2.38} 238`}
                    strokeDashoffset="0"
                    className="transition-all duration-1000"
                  />
                  
                  {/* Segmento Ausentes (Rojo) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#ef4444"
                    strokeWidth="14"
                    strokeDasharray={`${pctAusentes * 2.38} 238`}
                    strokeDashoffset={`-${pctPresentes * 2.38}`}
                    className="transition-all duration-1000"
                  />

                  {/* Segmento Pendientes (Ámbar) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#f59e0b"
                    strokeWidth="14"
                    strokeDasharray={`${pctPendientes * 2.38} 238`}
                    strokeDashoffset={`-${(pctPresentes + pctAusentes) * 2.38}`}
                    className="transition-all duration-1000"
                  />
                </svg>

                {/* Texto Central del Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900">{attendanceRatio}%</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Efectividad</span>
                </div>
              </div>

              {/* Leyenda Desglosada */}
              <div className="space-y-3 text-xs w-full max-w-[200px]">
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="font-bold text-emerald-900">Presentes</span>
                  </div>
                  <span className="font-extrabold text-emerald-700">{totalPresentes} ({pctPresentes}%)</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                    <span className="font-bold text-rose-900">Ausentes</span>
                  </div>
                  <span className="font-extrabold text-rose-700">{totalAusentes} ({pctAusentes}%)</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="font-bold text-amber-900">Pendientes</span>
                  </div>
                  <span className="font-extrabold text-amber-700">{totalPendientes} ({pctPendientes}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* EMBUDO DE RETENCIÓN Y ADHERENCIA ACADÉMICA */}
          <div className="lg:col-span-6 bg-slate-50/75 border border-slate-200 rounded-2xl p-6 md:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Embudo de Adherencia y Fidelización Estudiantil
                </h3>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Retención
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Seguimiento de la progresión desde el registro inicial hasta la participación recurrente en los programas.
              </p>
            </div>

            {/* Embudo Visual */}
            <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200">
              {/* Nivel 1: Total Alumnos Matrícula */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">1. Matrícula Activa Registrada</span>
                  <span className="text-slate-900">{totalAlumnos} Alumnos (100%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                  <div className="bg-[#092c4c] h-full rounded-full w-full" />
                </div>
              </div>

              {/* Nivel 2: Alumnos que se han Inscrito */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">2. Alumnos con Reservas Activas</span>
                  <span className="text-[#3a9ad9]">
                    {studentSessionCountMap.size} ({totalAlumnos > 0 ? Math.round((studentSessionCountMap.size / totalAlumnos) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                  <div 
                    className="bg-[#3a9ad9] h-full rounded-full transition-all duration-700"
                    style={{ width: `${totalAlumnos > 0 ? Math.round((studentSessionCountMap.size / totalAlumnos) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Nivel 3: Alumnos con Asistencia Efectiva */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">3. Asistencia Confirmada</span>
                  <span className="text-emerald-600">
                    {attendedStudentsSet.size} ({totalAlumnos > 0 ? Math.round((attendedStudentsSet.size / totalAlumnos) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                    style={{ width: `${totalAlumnos > 0 ? Math.round((attendedStudentsSet.size / totalAlumnos) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Nivel 4: Alumnos Recurrentes (Fidelizados 2+ sesiones) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">4. Alumnos Recurrentes (2+ Actividades)</span>
                  <span className="text-purple-600">
                    {recurringStudentsCount} ({totalAlumnos > 0 ? Math.round((recurringStudentsCount / totalAlumnos) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                  <div 
                    className="bg-purple-600 h-full rounded-full transition-all duration-700"
                    style={{ width: `${totalAlumnos > 0 ? Math.round((recurringStudentsCount / totalAlumnos) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECCIÓN 3: MAPA DE CALOR DE DEMANDA HORARIA (HEATMAP DÍAS VS BLOQUES)
            ========================================================================= */}
        <div className="mb-10 bg-slate-50/75 border border-slate-200 rounded-2xl p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Mapa de Calor (Heatmap) de Concurrencia por Días y Bloques Horarios
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualiza los bloques y días de mayor afluencia estudiantil y demanda de salas en la semana.
              </p>
            </div>

            {/* Escala de intensidad */}
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span>Baja</span>
              <span className="w-4 h-4 rounded bg-slate-100 border border-slate-200" />
              <span className="w-4 h-4 rounded bg-[#3a9ad9]/30" />
              <span className="w-4 h-4 rounded bg-[#3a9ad9]/70" />
              <span className="w-4 h-4 rounded bg-[#092c4c]" />
              <span>Alta Concurrencia</span>
            </div>
          </div>

          {/* Grilla Heatmap */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2 px-3 text-left">Bloque Horario</th>
                  {WEEK_DAYS.map(day => (
                    <th key={day} className="py-2 px-3">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3 text-left font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{slot}</span>
                    </td>
                    {[0, 1, 2, 3, 4].map((dayIdx) => {
                      const count = scheduleHeatmap.grid[slot]?.[dayIdx] || 0;
                      const ratio = count / scheduleHeatmap.maxVal;

                      let cellBg = 'bg-slate-50 text-slate-400';
                      if (count > 0) {
                        if (ratio >= 0.7) cellBg = 'bg-[#092c4c] text-white font-bold shadow-xs';
                        else if (ratio >= 0.4) cellBg = 'bg-[#3a9ad9] text-white font-bold';
                        else cellBg = 'bg-[#3a9ad9]/25 text-[#092c4c] font-bold';
                      }

                      return (
                        <td key={dayIdx} className="py-2 px-2">
                          <div className={`p-2 rounded-xl transition-all ${cellBg}`}>
                            <span>{count > 0 ? `${count} insc.` : '-'}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            SECCIÓN 4: ASISTENCIA POR CARRERAS + ASIGNATURAS CON MAYOR DEMANDA
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          
          {/* Gráfico de Barras: Carreras con Mayor Asistencia */}
          <div className="lg:col-span-7 bg-slate-50/75 border border-slate-200 rounded-2xl p-6 md:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#092c4c]" />
                  Asistencia Efectiva por Carrera (Gráfico Comparativo)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranking de asistencia efectiva y volumen de alumnos clasificado por carrera.
                </p>
              </div>
              <span className="text-xs font-bold bg-[#092c4c]/10 text-[#092c4c] px-3 py-1 rounded-full w-fit">
                {careerAttendanceStats.length} Carreras
              </span>
            </div>

            {careerAttendanceStats.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                No hay registros de asistencia para el período seleccionado ({timeRange}).
              </div>
            ) : (
              <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200">
                {careerAttendanceStats.map((item, idx) => {
                  const barWidth = Math.max(Math.round((item.presentes / maxCareerPresentes) * 100), item.presentes > 0 ? 8 : 2);
                  return (
                    <div key={item.career} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="w-5 h-5 rounded-full bg-[#092c4c]/10 text-[#092c4c] font-black text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 truncate" title={item.career}>
                            {item.career}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({item.uniqueStudents} alumnos)
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <span className="font-bold text-slate-700">
                            {item.presentes} <span className="text-slate-400 font-normal">/ {item.totalInscritos} asist.</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.attendancePct >= 80 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : item.attendancePct >= 50 
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {item.attendancePct}%
                          </span>
                        </div>
                      </div>

                      {/* Barra con gradiente */}
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex items-center">
                        <div
                          className="h-full bg-gradient-to-r from-[#092c4c] via-[#3a9ad9] to-[#02c39a] rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Asignaturas y Talleres con Mayor Demanda */}
          <div className="lg:col-span-5 bg-slate-50/75 border border-slate-200 rounded-2xl p-6 md:p-7">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Materias y Talleres con Mayor Convocatoria
              </h3>
              <span className="text-xs text-slate-500 font-mono font-semibold">Top Ranking</span>
            </div>

            <div className="space-y-3.5">
              {topSubjectsStats.map((item, idx) => (
                <div key={item.subject} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-900 truncate">
                        {idx + 1}. {item.subject}
                      </p>
                      <span className="text-[10px] font-semibold text-[#3a9ad9]">
                        {item.program === 'tutorias' ? 'Tutoría Académica' : 'Taller Psicoeducativo'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-900 block">{item.inscriptions} inscripciones</span>
                      <span className="text-[10px] text-emerald-600 font-bold">{item.occupancy}% ocupación</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.occupancy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECCIÓN 5: ANÁLISIS DE INCIDENTES DE TOPE DE HORARIO Y RESOLUCIÓN
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Tarjeta de Métricas de Topes de Horario */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Métricas de Topes e Incompatibilidad
              </h3>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Horario Flexible
              </span>
            </div>

            {/* KPI Circular / Proporción */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Alumnos con Topes de Horario
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-slate-900">
                    {scheduleConflictStats.conflictPercentage}%
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    ({scheduleConflictStats.studentWithConflictCount} de {totalAlumnos} alumnos)
                  </span>
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            {/* Desglose de Estado de Resolución */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Tasa de Resolución de Casos</span>
                <span className="font-bold text-emerald-600">{scheduleConflictStats.resolutionRate}% Resueltas</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${scheduleConflictStats.resolutionRate}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {scheduleConflictStats.resolvedCount} Casos Resueltos
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  {scheduleConflictStats.pendingCount} Casos Pendientes
                </span>
              </div>
            </div>

            {/* Protocolo */}
            <div className="p-3.5 bg-[#092c4c]/5 rounded-xl border border-[#092c4c]/10 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-[#092c4c] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#3a9ad9]" />
                Protocolo de Flexibilidad Horaria
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Los alumnos que notifican tope horario son contactados automáticamente y reubicados en bloques especiales coordinados por los docentes.
              </p>
            </div>
          </div>

          {/* Gráfico de Carreras con Mayor Frecuencia de Topes de Horario */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-600" />
                Carreras con Mayor Cantidad de Incidentes de Tope
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Total: {scheduleConflictStats.totalConflicts} Solicitudes
              </span>
            </div>

            {scheduleConflictStats.careerConflictList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200">
                No se registran solicitudes de tope de horario en este período.
              </div>
            ) : (
              <div className="space-y-3.5">
                {scheduleConflictStats.careerConflictList.map((item, idx) => {
                  const widthPct = Math.max(
                    Math.round((item.totalConflicts / scheduleConflictStats.maxCareerConflicts) * 100),
                    8
                  );

                  return (
                    <div key={item.career} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-bold text-slate-800 truncate" title={item.career}>
                            {idx + 1}. {item.career}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-slate-900">
                            {item.totalConflicts} incidentes
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                            {item.pctOfTotalConflicts}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
