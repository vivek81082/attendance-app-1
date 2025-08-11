import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';

const STORAGE_KEY = 'labour_attendance_v2';

function dateRangeDays(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (isNaN(s) || isNaN(e) || s > e) return null;
  let total = 0, sundays = 0;
  for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
    total++;
    if (cur.getDay() === 0) sundays++;
  }
  return { total, sundays, workingDays: total - sundays };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(l => ({ name: l.name || 'Unnamed', records: (l.records && typeof l.records === 'object') ? l.records : {} }));
  } catch (e) {
    console.error('load error', e);
    return [];
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('save error', e);
  }
}

export default function LabourAttendanceApp() {
  const today = new Date().toISOString().slice(0, 10);
  const [labours, setLabours] = useState(() => loadFromStorage());
  const [date, setDate] = useState(today);
  const [newName, setNewName] = useState('');

  useEffect(() => { saveToStorage(labours); }, [labours]);

  const addLabour = () => {
    const name = (newName || '').trim();
    if (!name) return;
    if (labours.some(l => l.name === name)) {
      alert('Labour already exists');
      return;
    }
    const updated = [...labours, { name, records: {} }];
    setLabours(updated);
    setNewName('');
  };

  const togglePresent = (index) => {
    const updated = labours.map((l, i) => ({ name: l.name, records: { ...(l.records || {}) } }));
    const rec = updated[index].records[date] || { status: 'Absent', time: '09:00' };
    const newStatus = rec.status === 'Present' ? 'Absent' : 'Present';
    updated[index].records[date] = { ...rec, status: newStatus };
    setLabours(updated);
  };

  const changeTime = (index, newTime) => {
    const updated = labours.map((l) => ({ name: l.name, records: { ...(l.records || {}) } }));
    if (!updated[index].records[date]) updated[index].records[date] = { status: 'Absent', time: '09:00' };
    updated[index].records[date].time = newTime;
    setLabours(updated);
  };

  const removeLabour = (index) => {
    if (!confirm(`Remove ${labours[index].name}?`)) return;
    const updated = labours.filter((_, i) => i !== index);
    setLabours(updated);
  };

  const computeStats = (start, end) => {
    const dr = dateRangeDays(start, end);
    if (!dr) return null;
    const { total, sundays, workingDays } = dr;
    const stats = labours.map(lab => {
      let present = 0, absent = 0, late = 0;
      for (let cur = new Date(start + 'T00:00:00'); cur <= new Date(end + 'T00:00:00'); cur.setDate(cur.getDate() + 1)) {
        const k = cur.toISOString().slice(0,10);
        const rec = lab.records && lab.records[k] ? lab.records[k] : null;
        if (rec && rec.status === 'Present') {
          present++;
          if (rec.time && rec.time !== '09:00') late++;
        } else {
          if (cur.getDay() !== 0) absent++;
        }
      }
      return { name: lab.name, present, absent, late, workingDays, sundays };
    });
    return { dr, stats };
  };

  const generatePDF = (start, end) => {
    const res = computeStats(start, end);
    if (!res) { alert('Invalid range'); return; }
    const { stats, dr } = res;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Labour Attendance Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Period: ${start} — ${end}`, 14, 26);
    doc.text(`Working days: ${dr.workingDays} | Sundays: ${dr.sundays}`, 14, 32);
    const startY = 40;
    doc.setFontSize(10);
    const colX = [14, 70, 110, 140, 170, 200];
    doc.text('Name', colX[0], startY);
    doc.text('Present', colX[1], startY);
    doc.text('Absent', colX[2], startY);
    doc.text('Late Days', colX[3], startY);
    doc.text('Working', colX[4], startY);
    doc.text('Sundays', colX[5], startY);
    let y = startY + 8;
    stats.forEach(s => {
      doc.text(s.name, colX[0], y);
      doc.text(String(s.present), colX[1], y);
      doc.text(String(s.absent), colX[2], y);
      doc.text(String(s.late), colX[3], y);
      doc.text(String(s.workingDays), colX[4], y);
      doc.text(String(s.sundays), colX[5], y);
      y += 8;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });
    doc.save(`attendance_${start}_to_${end}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="sticky top-0 backdrop-blur-sm bg-white/70 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Attendance Dashboard</h1>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-sm">
              <label className="text-sm text-gray-500 dark:text-gray-300">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
                onClick={() => {
                    const start = prompt('Start date (YYYY-MM-DD)', date);
                    const end = prompt('End date (YYYY-MM-DD)', date);
                    if (start && end) generatePDF(start, end);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-500"
            >
                Generate PDF
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm outline-none"
            placeholder="Add labour name"
            onKeyDown={(e) => { if (e.key === 'Enter') addLabour(); }}
          />
          <button
            onClick={addLabour}
            className="px-4 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-500"
          >
            Add
          </button>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {labours.length === 0 && (
            <div className="col-span-full p-6 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-center">
              No labours yet — add one above.
            </div>
          )}
          {labours.map((lab, idx) => {
            const rec = (lab.records && lab.records[date]) ? lab.records[date] : null;
            const isPresent = rec && rec.status === 'Present';
            const timeVal = rec && rec.time ? rec.time : '09:00';
            const isLate = timeVal !== '09:00';
            return (
              <div key={lab.name} className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-lg font-medium">{lab.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{isPresent ? 'Present' : 'Absent'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePresent(idx)}
                    className={`relative inline-flex items-center h-8 w-14 rounded-full transition-all focus:outline-none ${isPresent ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-pressed={isPresent}
                  >
                    <span className={`inline-block h-6 w-6 bg-white rounded-full transform transition-transform ${isPresent ? 'translate-x-6' : 'translate-x-1'}`}></span>
                  </button>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isLate ? 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800' : 'bg-transparent border-gray-100 dark:border-gray-700'}`}>
                    <input
                      type="time"
                      value={timeVal}
                      onChange={(e) => changeTime(idx, e.target.value)}
                      className="bg-transparent outline-none text-sm"
                    />
                  </div>
                  <button onClick={() => removeLabour(idx)} className="text-sm text-red-500 hover:text-red-400">Remove</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          Tip: Default time is <strong>09:00</strong>. Any change will be treated as a late arrival and shown as \"Late Days\" in reports.
        </div>
      </main>
    </div>
  );
}
