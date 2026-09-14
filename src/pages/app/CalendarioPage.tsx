import { Pencil, Plus, Repeat, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DateBrInput } from "@/components/ui/DateBrInput";
import { MoneyBrInput } from "@/components/ui/MoneyBrInput";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth";
import { calendarItems, type CalendarItem } from "@/lib/cashflow";
import { nextBusinessDay } from "@/lib/das";
import { hasPremiumAccess, isSimplesNacionalCompany } from "@/lib/plans";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { MONTHS } from "@/lib/types";
import { addDaysIso, addMonthsOnDay, cn, currentYear, formatDate, formatMoney, isoDate, todayIso } from "@/lib/utils";

type RepeatFreq = "semanal" | "mensal" | "anual";

function kindLabel(kind: CalendarItem["kind"]) {
  if (kind === "receber") return "A receber";
  if (kind === "pagar") return "A pagar";
  if (kind === "evento") return "Evento / agendamento";
  return "Agendado";
}

function kindClass(kind: CalendarItem["kind"]) {
  if (kind === "receber") return "border-green/40 bg-green/5";
  if (kind === "pagar") return "border-orange/40 bg-orange/5";
  if (kind === "evento") return "border-blue/40 bg-blue/5";
  return "border-navy/40 bg-navy/5";
}

function freqLabel(freq: RepeatFreq) {
  if (freq === "semanal") return "semanal";
  if (freq === "anual") return "anual";
  return "mensal";
}

function toBusinessDayIso(iso: string) {
  return isoDate(nextBusinessDay(new Date(`${iso.slice(0, 10)}T12:00:00`)));
}

/** Gera as datas da série. Com Dia útil + mensal, cada ocorrência vai para o próximo dia útil. */
function buildRepeatDates(start: string, freq: RepeatFreq, times: number, diaUtil: boolean) {
  const dayOfMonth = Number(start.slice(8, 10)) || 1;
  const dates: string[] = [];
  for (let i = 0; i < times; i++) {
    let iso =
      i === 0
        ? start
        : freq === "semanal"
          ? addDaysIso(start, 7 * i)
          : freq === "anual"
            ? addMonthsOnDay(start, 12 * i, dayOfMonth)
            : addMonthsOnDay(start, i, dayOfMonth);
    if (diaUtil && freq === "mensal") iso = toBusinessDayIso(iso);
    dates.push(iso);
  }
  return dates;
}

type EventForm = {
  id?: string;
  date: string;
  title: string;
  note: string;
  valor: number;
  repeat: boolean;
  freq: RepeatFreq;
  times: string;
  diaUtil: boolean;
};

const emptyForm = (date: string): EventForm => ({
  date: date || todayIso(),
  title: "",
  note: "",
  valor: 0,
  repeat: false,
  freq: "mensal",
  times: "12",
  diaUtil: false,
});

export function CalendarioPage() {
  const { user } = useAuth();
  const { company, entries, events, addEvent, addEvents, updateEvent, removeEvent } = useStore();
  const isPremium = hasPremiumAccess(user);
  const isSn = isSimplesNacionalCompany(company);
  const now = new Date();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(todayIso());
  const [form, setForm] = useState<EventForm | null>(null);

  const items = useMemo(
    () => calendarItems(entries, year, month, company, events),
    [entries, year, month, company, events],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const list = map.get(it.date) || [];
      list.push(it);
      map.set(it.date, list);
    }
    return map;
  }, [items]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayItems = selected ? byDate.get(selected) || [] : [];

  function openCreate() {
    setForm(emptyForm(selected || todayIso()));
  }

  function openEdit(eventId: string) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    setForm({
      id: ev.id,
      date: ev.date,
      title: ev.title,
      note: ev.note || "",
      valor: ev.valor != null && ev.valor > 0 ? ev.valor : 0,
      repeat: false,
      freq: "mensal",
      times: "12",
      diaUtil: false,
    });
  }

  function saveEvent(e: FormEvent) {
    e.preventDefault();
    if (!form?.title.trim() || !form.date) return;
    const valor = form.valor > 0 ? form.valor : undefined;
    const title = form.title.trim();
    const note = form.note.trim() || undefined;

    if (form.id) {
      updateEvent(form.id, { date: form.date, title, note, valor });
      setSelected(form.date);
      setForm(null);
      return;
    }

    const times = Math.max(1, Math.min(120, Math.floor(Number(form.times) || 0)));
    const count = form.repeat ? times : 1;
    const dates = form.repeat
      ? buildRepeatDates(form.date, form.freq, count, form.diaUtil)
      : [form.date];

    const series: Array<Omit<CalendarEvent, "id" | "createdAt">> = dates.map((date, i) => ({
      date,
      title: count > 1 ? `${title} (${i + 1}/${count})` : title,
      note:
        count > 1
          ? [
              note,
              `Repetição ${freqLabel(form.freq)}`,
              form.diaUtil && form.freq === "mensal" ? "dia útil" : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : note,
      valor,
    }));
    if (series.length === 1) addEvent(series[0]);
    else addEvents(series);

    setSelected(dates[0] || form.date);
    setForm(null);
  }

  const repeatPreview =
    form && form.repeat && !form.id
      ? (() => {
          const times = Math.max(1, Math.min(120, Math.floor(Number(form.times) || 0)));
          if (!form.date || !times) return null;
          const dates = buildRepeatDates(form.date, form.freq, times, form.diaUtil);
          const last = dates[dates.length - 1];
          return `Serão criados ${times} eventos (${freqLabel(form.freq)}${
            form.diaUtil && form.freq === "mensal" ? ", dia útil" : ""
          }): de ${formatDate(dates[0])} até ${formatDate(last)}.`;
        })()
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Calendário</h1>
          <p className="mt-1 text-sm text-mute">
            Clique no dia para ver a receber, a pagar,{" "}
            {isSn
              ? "DAS do Simples, eSocial (até dia 15), DCTFWeb (último dia útil), FGTS (dia 20) e eventos"
              : "o DAS e seus eventos"}
            . Verde = receber · laranja = pagar · roxo = {isSn ? "obrigações" : "DAS"} · azul = evento.
            {isPremium ? " Premium: e-mail e aviso no celular às 06h no dia do evento." : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
          <input
            className="input w-24"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
          />
          <button type="button" className="btn-primary gap-2" onClick={openCreate}>
            <Plus className="size-4" />
            Evento / agendamento
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-line bg-paper p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-mute">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="min-h-16 rounded-xl bg-bg/40" />;
              const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const list = byDate.get(iso) || [];
              const hasR = list.some((x) => x.kind === "receber");
              const hasP = list.some((x) => x.kind === "pagar");
              const hasDas = list.some((x) => x.kind === "agendado");
              const hasEvt = list.some((x) => x.kind === "evento");
              const isSel = selected === iso;
              const isToday = iso === todayIso();
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelected(iso)}
                  className={cn(
                    "min-h-16 rounded-xl border px-1.5 py-1.5 text-left transition",
                    isSel ? "border-navy bg-navy/10" : "border-line bg-paper hover:border-navy/40",
                    isToday && !isSel && "ring-1 ring-gold",
                  )}
                >
                  <span className="text-xs font-semibold">{String(day).padStart(2, "0")}</span>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {hasR ? <span className="size-1.5 rounded-full bg-green" title="A receber" /> : null}
                    {hasP ? <span className="size-1.5 rounded-full bg-orange" title="A pagar" /> : null}
                    {hasDas ? (
                      <span
                        className="size-1.5 rounded-full bg-navy"
                        title={isSn ? "Obrigação Simples / DAS" : "DAS mensal"}
                      />
                    ) : null}
                    {hasEvt ? <span className="size-1.5 rounded-full bg-blue" title="Evento" /> : null}
                  </div>
                  {list.length ? (
                    <p className="mt-1 truncate text-[10px] text-mute">
                      {list.length} item{list.length > 1 ? "s" : ""}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold">{selected ? formatDate(selected) : "Selecione um dia"}</h2>
            <button type="button" className="btn-ghost gap-1 !px-2 text-xs" onClick={openCreate}>
              <Plus className="size-3.5" />
              Incluir
            </button>
          </div>
          {!dayItems.length ? (
            <p className="mt-4 text-sm text-mute">Nada agendado neste dia.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {dayItems.map((it) => (
                <li key={it.id} className={cn("relative rounded-xl border px-3 py-2 text-sm", kindClass(it.kind))}>
                  {it.eventId ? (
                    <div className="absolute left-2 top-2 flex items-center gap-0.5">
                      <button
                        type="button"
                        className="rounded-md p-1 text-mute hover:bg-red/10 hover:text-red"
                        aria-label="Excluir evento"
                        onClick={() => {
                          if (confirm("Excluir este evento/agendamento?")) removeEvent(it.eventId!);
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1 text-mute hover:bg-navy/10 hover:text-navy"
                        aria-label="Editar evento"
                        onClick={() => openEdit(it.eventId!)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  ) : null}
                  <div className={it.eventId ? "pl-12" : undefined}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-mute">{kindLabel(it.kind)}</p>
                    <p className="font-medium">{it.title}</p>
                    {it.detail ? <p className="text-xs text-mute">{it.detail}</p> : null}
                    {it.valor > 0 ? <p className="font-semibold">{formatMoney(it.valor)}</p> : null}
                    {it.href ? (
                      <Link to={it.href} className="mt-1 inline-block text-xs font-semibold text-navy">
                        Abrir
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            <Link to="/app/contas" className="text-navy">
              Contas a receber / pagar
            </Link>
            {isSn ? (
              <Link to="/app/simples" className="text-navy">
                Simples Nacional
              </Link>
            ) : (
              <Link to="/app/das" className="text-navy">
                DAS mensal
              </Link>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={!!form}
        title={form?.id ? "Editar evento / agendamento" : "Novo evento / agendamento"}
        onClose={() => setForm(null)}
      >
        {form ? (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveEvent}>
            <label className="block text-sm sm:col-span-2">
              <span className="text-mute">Título</span>
              <input
                className="input mt-1"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Reunião com cliente"
              />
            </label>
            <label className="block text-sm">
              <span className="text-mute">Data</span>
              <DateBrInput
                className="input mt-1"
                required
                value={form.date}
                onChange={(iso) => setForm({ ...form, date: iso })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-mute">Valor (opcional)</span>
              <MoneyBrInput
                className="input mt-1"
                value={form.valor}
                onChange={(valor) => setForm({ ...form, valor })}
                min={0}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-mute">Observação</span>
              <textarea
                className="input mt-1 min-h-20"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Detalhes do agendamento"
              />
            </label>
            {!form.id ? (
              <div className="sm:col-span-2 space-y-3">
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
                    form.repeat
                      ? "border-navy bg-navy/10 text-navy"
                      : "border-line bg-paper text-mute hover:border-navy/40 hover:text-ink",
                  )}
                  aria-pressed={form.repeat}
                  onClick={() => setForm({ ...form, repeat: !form.repeat })}
                >
                  <Repeat className="size-4" />
                  Repetição
                </button>
                {form.repeat ? (
                  <div className="space-y-3 rounded-2xl border border-line bg-bg/60 p-3">
                    <div>
                      <p className="text-xs font-medium text-mute">Frequência</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(
                          [
                            ["semanal", "Semanal"],
                            ["mensal", "Mensal"],
                            ["anual", "Anual"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                              form.freq === value
                                ? "border-navy bg-navy text-white"
                                : "border-line bg-paper text-mute hover:border-navy/40 hover:text-ink",
                            )}
                            aria-pressed={form.freq === value}
                            onClick={() => setForm({ ...form, freq: value })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="text-mute">Quantas vezes</span>
                        <input
                          className="input mt-1"
                          type="number"
                          min={1}
                          max={120}
                          required
                          value={form.times}
                          onChange={(e) => setForm({ ...form, times: e.target.value })}
                          placeholder="12"
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          className={cn(
                            "inline-flex w-full items-center justify-center rounded-full border px-3 py-2.5 text-sm font-semibold transition",
                            form.diaUtil
                              ? "border-navy bg-navy/10 text-navy"
                              : "border-line bg-paper text-mute hover:border-navy/40 hover:text-ink",
                          )}
                          aria-pressed={form.diaUtil}
                          onClick={() => setForm({ ...form, diaUtil: !form.diaUtil })}
                        >
                          Dia útil
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-mute">
                      {form.diaUtil && form.freq === "mensal"
                        ? "Com Dia útil + Mensal, cada data cai no próximo dia útil (pula sábado, domingo e feriado nacional)."
                        : "Escolha a frequência e quantas vezes o evento deve se repetir."}
                      {repeatPreview ? (
                        <>
                          <br />
                          <span className="font-medium text-ink">{repeatPreview}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isPremium ? (
              <p className="text-xs text-mute sm:col-span-2">
                Conta Premium: no dia do evento você recebe e-mail e aviso no celular às 06h.
              </p>
            ) : (
              <p className="text-xs text-mute sm:col-span-2">
                No Premium, o lembrete também sai por e-mail e notificação no celular às 06h do dia.
              </p>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary flex-1">
                {form.repeat && !form.id ? "Criar série" : "Salvar"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
