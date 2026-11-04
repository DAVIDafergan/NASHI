import React from 'react';
import { Check } from 'lucide-react';
import { MANAGER_TYPES, MANAGER_TYPE_IDS, SECTIONS, SECTION_LABELS, normType } from '../../shared/managers';

export type RoleValue = { type: string; perms: string[] };

export const defaultRole = (type?: string, perms?: string[]): RoleValue => {
  const t = normType(type);
  return { type: t, perms: perms && perms.length ? [...perms] : [...MANAGER_TYPES[t].perms] };
};

/** Perms to send to the server: nothing when they equal the default of the type (so a type keeps following its default). */
export const permsToSend = (v: RoleValue): string[] | undefined => {
  const d = MANAGER_TYPES[normType(v.type)].perms;
  const same = d.length === v.perms.length && d.every(p => v.perms.includes(p));
  return same ? undefined : v.perms;
};

/** Role of a culture manager (full / on behalf of the municipality / other) and, per person, the sections she may publish in. */
const RoleSelect: React.FC<{ value: RoleValue; onChange: (v: RoleValue) => void }> = ({ value, onChange }) => (
  <div className="space-y-3">
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-500">תפקיד</p>
      <div className="flex flex-wrap gap-1.5">
        {MANAGER_TYPE_IDS.map(id => (
          <button key={id} type="button" onClick={() => onChange(defaultRole(id))}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${value.type === id ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 text-slate-600 hover:border-rose-300'}`}>{MANAGER_TYPES[id as keyof typeof MANAGER_TYPES].label}</button>
        ))}
      </div>
    </div>
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-500">מה מותר לה להעלות</p>
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(s => {
          const on = value.perms.includes(s);
          return (
            <button key={s} type="button" aria-pressed={on}
              onClick={() => onChange({ ...value, perms: on ? value.perms.filter(p => p !== s) : [...value.perms, s] })}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] transition ${on ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-rose-100 text-slate-400 line-through hover:border-rose-300'}`}>
              {on && <Check size={12} />} {(SECTION_LABELS as any)[s]}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">כל מנהלת רואה ועורכת רק את מה שהעלתה בעצמה, גם אם יש כמה מנהלות באותה עיר.</p>
    </div>
  </div>
);

export default RoleSelect;
