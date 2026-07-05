import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Flame,
  Heart,
  Moon,
  Settings,
  Smile,
  Stethoscope,
  ThermometerSun,
} from 'lucide-react';

const STORAGE_KEYS = {
  settings: 'anranqi_settings',
  records: 'anranqi_records',
};

const defaultSettings = {
  ageRange: '50-54',
  periodCurrentStatus: '经期不规律',
  longGapReminderDays: 60,
  dailyReminderEnabled: false,
  onboardingCompleted: false,
};

const todayISO = () => formatDate(new Date());
const pad = (value) => String(value).padStart(2, '0');
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (dateString, offset) => {
  const date = parseDate(dateString);
  date.setDate(date.getDate() + offset);
  return formatDate(date);
};
const dayDiff = (from, to) => Math.round((parseDate(to) - parseDate(from)) / 86400000);
const weekday = ['日', '一', '二', '三', '四', '五', '六'];
const displayDate = (dateString) => {
  const date = parseDate(dateString);
  return `${date.getMonth() + 1}/${date.getDate()} ${weekday[date.getDay()]}`;
};
const fullDate = (dateString) => {
  const date = parseDate(dateString);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const optionSets = {
  ageRange: ['45-49', '50-54', '55-60', '60+'],
  periodStatus: ['月经仍有', '经期不规律', '已较久没来', '不确定'],
  reminderDays: [60, 90, 180, 365],
  yesNo: [
    { label: '是', value: true },
    { label: '否', value: false },
  ],
};

const emptyRecord = () => ({});
const moodLabelMap = {
  很不好: '不愉快',
  不太好: '不太愉快',
  还可以: '不悲不喜',
  比较好: '愉快',
  很好: '非常愉快',
};
const moodFaceMap = {
  不愉快: '☹',
  不太愉快: '🙁',
  不悲不喜: '😐',
  愉快: '🙂',
  非常愉快: '😊',
};
const normalizeMoodLabel = (label) => moodLabelMap[label] || label;

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [settings, setSettings] = useState(() => ({ ...defaultSettings, ...loadJson(STORAGE_KEYS.settings, {}) }));
  const [records, setRecords] = useState(() => loadJson(STORAGE_KEYS.records, {}));
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState('today');
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => todayISO().slice(0, 7));
  const [pendingGap, setPendingGap] = useState(null);

  useEffect(() => localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records)), [records]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedRecord = records[selectedDate] || emptyRecord();
  const summary = useMemo(() => buildSummary(records, settings), [records, settings]);

  const saveRecordPart = (dateString, key, value, feedback = '已保存这一天的记录。') => {
    setRecords((current) => ({
      ...current,
      [dateString]: {
        ...(current[dateString] || {}),
        [key]: value,
      },
    }));
    setToast(feedback);
  };

  const handleBleedingSave = (value) => {
    const previousBleedingDate = findPreviousBleedingDate(records, selectedDate);
    const gapDays = previousBleedingDate ? dayDiff(previousBleedingDate, selectedDate) : null;
    const shouldAsk = value.hasBleeding && gapDays !== null && gapDays >= Number(settings.longGapReminderDays);
    const nextValue = {
      ...value,
      longGapBleeding: shouldAsk ? 'unsure' : value.longGapBleeding || null,
      longGapDays: shouldAsk ? gapDays : value.longGapDays || null,
    };
    saveRecordPart(selectedDate, 'bleeding', nextValue, `已保存${selectedDate === todayISO() ? '今天' : '这一天'}的出血记录。`);
    setSheet(null);
    if (shouldAsk) {
      setPendingGap({ date: selectedDate, days: gapDays });
    }
  };

  const updateGapAnswer = (answer) => {
    if (!pendingGap) return;
    setRecords((current) => {
      const record = current[pendingGap.date] || {};
      return {
        ...current,
        [pendingGap.date]: {
          ...record,
          bleeding: {
            ...(record.bleeding || {}),
            longGapBleeding: answer,
            longGapDays: pendingGap.days,
          },
        },
      };
    });
    setPendingGap(null);
    setToast('已保存确认结果。');
  };

  if (!settings.onboardingCompleted) {
    return <Onboarding settings={settings} onDone={(next) => setSettings({ ...settings, ...next, onboardingCompleted: true })} />;
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        {activeTab === 'today' && (
          <TodayPage
            date={selectedDate}
            records={records}
            record={selectedRecord}
            onSelectDate={setSelectedDate}
            onOpenSheet={setSheet}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarPage
            records={records}
            selectedDate={selectedDate}
            calendarMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            onSelectDate={setSelectedDate}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryPage
            records={records}
            settings={settings}
            summary={summary}
            onOpenSettings={() => setSheet('settings')}
            onOpenExport={() => setSheet('exportPreview')}
            onToast={setToast}
          />
        )}
      </main>

      <nav className="bottom-tabs" aria-label="主栏目">
        <TabButton active={activeTab === 'today'} icon={<ClipboardList />} label="今日记录" onClick={() => setActiveTab('today')} />
        <TabButton active={activeTab === 'calendar'} icon={<CalendarDays />} label="变化日历" onClick={() => setActiveTab('calendar')} />
        <TabButton active={activeTab === 'summary'} icon={<FileText />} label="就医摘要" onClick={() => setActiveTab('summary')} />
      </nav>

      {sheet === 'bleeding' && (
        <BleedingSheet
          initial={selectedRecord.bleeding}
          onClose={() => setSheet(null)}
          onSave={handleBleedingSave}
        />
      )}
      {sheet === 'vasomotor' && (
        <VasomotorSheet
          initial={selectedRecord.vasomotor}
          onClose={() => setSheet(null)}
          onSave={(value) => {
            saveRecordPart(selectedDate, 'vasomotor', value, '已保存潮热盗汗记录。');
            setSheet(null);
          }}
        />
      )}
      {sheet === 'sleep' && (
        <SleepSheet
          initial={selectedRecord.sleep}
          onClose={() => setSheet(null)}
          onSave={(value) => {
            saveRecordPart(selectedDate, 'sleep', value, '已保存睡眠变化记录。');
            setSheet(null);
          }}
        />
      )}
      {sheet === 'discomfort' && (
        <DiscomfortSheet
          initial={selectedRecord.discomfort}
          onClose={() => setSheet(null)}
          onSave={(value) => {
            saveRecordPart(selectedDate, 'discomfort', value, '已保存身体不适记录。');
            setSheet(null);
          }}
        />
      )}
      {sheet === 'mood' && (
        <MoodSheet
          initial={selectedRecord.mood}
          onClose={() => setSheet(null)}
          onSave={(value) => {
            saveRecordPart(selectedDate, 'mood', value, '已保存整体心情记录。');
            setSheet(null);
          }}
        />
      )}
      {sheet === 'settings' && (
        <SettingsSheet
          settings={settings}
          summary={summary}
          onClose={() => setSheet(null)}
          onSave={(next) => {
            setSettings({ ...settings, ...next });
            setToast('设置已保存。');
            setSheet(null);
          }}
          onOpenExport={() => setSheet('exportPreview')}
          onToast={setToast}
        />
      )}
      {sheet === 'exportPreview' && (
        <ExportPreviewSheet
          summary={summary}
          onClose={() => setSheet(null)}
          onToast={setToast}
        />
      )}
      {pendingGap && <GapConfirmSheet days={pendingGap.days} onChoose={updateGapAnswer} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Onboarding({ settings, onDone }) {
  const [step, setStep] = useState(0);
  const [ageRange, setAgeRange] = useState(settings.ageRange);
  const [periodCurrentStatus, setPeriodCurrentStatus] = useState(settings.periodCurrentStatus);
  const [longGapReminderDays, setLongGapReminderDays] = useState(settings.longGapReminderDays);
  const [customDays, setCustomDays] = useState('');

  const finalDays = longGapReminderDays === 'custom' ? Number(customDays || 60) : Number(longGapReminderDays);
  const steps = [
    {
      title: '先了解你的年龄段',
      body: (
        <Field title="年龄段">
          <Segmented options={optionSets.ageRange} value={ageRange} onChange={setAgeRange} />
        </Field>
      ),
    },
    {
      title: '现在的经期状态更接近哪一种？',
      body: (
        <Field title="经期当前状态">
          <Segmented options={optionSets.periodStatus} value={periodCurrentStatus} onChange={setPeriodCurrentStatus} />
        </Field>
      ),
    },
    {
      title: '设置一个较长间隔提醒',
      body: (
        <Field title="经期较长间隔提醒">
          <Segmented
            options={[60, 90, 180, 365, 'custom']}
            labels={{ 60: '60 天', 90: '90 天', 180: '180 天', 365: '365 天', custom: '自定义' }}
            value={longGapReminderDays}
            onChange={setLongGapReminderDays}
          />
          {longGapReminderDays === 'custom' && (
            <input className="text-input" type="number" min="1" value={customDays} onChange={(event) => setCustomDays(event.target.value)} placeholder="输入天数" />
          )}
          <p className="hint">当你较长时间没有记录出血后再次记录，系统会提醒你确认是否需要特别关注。</p>
        </Field>
      ),
    },
  ];
  const isLastStep = step === steps.length - 1;

  return (
    <div className="onboarding">
      <div className="brand-block">
        <span className="brand-mark">安</span>
        <div>
          <h1>安然期</h1>
          <p>温和记录身体变化，方便需要时与医生沟通。</p>
        </div>
      </div>
      <section className="panel onboarding-panel">
        <div className="step-dots" aria-label="引导进度">
          {steps.map((item, index) => <span key={item.title} className={index <= step ? 'active' : ''} />)}
        </div>
        <h2>{steps[step].title}</h2>
        {steps[step].body}
        <div className={`onboarding-actions ${step > 0 ? 'with-back' : ''}`}>
          {step > 0 && <button className="secondary-button" onClick={() => setStep(step - 1)}>上一步</button>}
          <button
            className="primary-button"
            onClick={() => {
              if (isLastStep) onDone({ ageRange, periodCurrentStatus, longGapReminderDays: finalDays });
              else setStep(step + 1);
            }}
          >
            {isLastStep ? '开始记录' : '下一步'}
          </button>
        </div>
      </section>
    </div>
  );
}

function TodayPage({ date, records, record, onSelectDate, onOpenSheet }) {
  const dates = Array.from({ length: 15 }, (_, index) => addDays(todayISO(), index - 14));
  const recorded = Boolean(records[date]);
  const periodStatus = summarizeBleeding(record.bleeding);
  return (
    <div className="page">
      <header className="page-header">
        <p>{fullDate(todayISO())}</p>
        <h1>今天身体怎么样</h1>
        <span className={recorded ? 'status-pill done' : 'status-pill'}>{recorded ? '这一天已记录' : '这一天未记录'}</span>
      </header>

      <div className="date-strip" aria-label="选择记录日期">
        {dates.map((item) => (
          <button key={item} className={`date-chip ${item === date ? 'selected' : ''}`} onClick={() => onSelectDate(item)}>
            <span>{item === todayISO() ? '今天' : displayDate(item).split(' ')[1]}</span>
            <strong>{displayDate(item).split(' ')[0]}</strong>
            {records[item]?.bleeding?.hasBleeding && <i className="mini-bleed" />}
          </button>
        ))}
      </div>

      <button className="bleeding-card" onClick={() => onOpenSheet('bleeding')}>
        <div>
          <h2>经期变化</h2>
          <p>是否有出血或点滴？</p>
          <span className={`bleeding-state ${record.bleeding ? 'done' : ''}`}>{periodStatus}</span>
        </div>
        <ThermometerSun />
      </button>

      <div className="quick-grid">
        <SmallCard title="潮热盗汗" text={summarizeVasomotor(record.vasomotor)} icon={<Flame />} onClick={() => onOpenSheet('vasomotor')} tone="blue" />
        <SmallCard title="睡眠变化" text={summarizeSleep(record.sleep)} icon={<Moon />} onClick={() => onOpenSheet('sleep')} tone="blue" />
        <SmallCard title="身体不适" text={summarizeDiscomfort(record.discomfort)} icon={<Stethoscope />} onClick={() => onOpenSheet('discomfort')} tone="purple" />
        <SmallCard title="整体心情" text={record.mood?.label ? normalizeMoodLabel(record.mood.label) : '记录今天的整体感受'} icon={<Smile />} onClick={() => onOpenSheet('mood')} tone="green" />
      </div>
    </div>
  );
}

function CalendarPage({ records, selectedDate, calendarMonth, onMonthChange, onSelectDate }) {
  const days = buildMonthDays(calendarMonth);
  const trend = buildTrend(records, 30);
  const today = todayISO();
  return (
    <div className="page">
      <header className="page-header compact">
        <p>历史记录与趋势</p>
        <h1>变化日历</h1>
      </header>
      <section className="panel">
        <div className="month-bar">
          <button onClick={() => onMonthChange(shiftMonth(calendarMonth, -1))}>上月</button>
          <strong>{calendarMonth.replace('-', ' 年 ')} 月</strong>
          <button onClick={() => onMonthChange(shiftMonth(calendarMonth, 1))}>下月</button>
        </div>
        <div className="week-row">{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {days.map((day, index) => {
            const record = day ? records[day] : null;
            return (
              <button
                key={day || index}
                className={`calendar-day ${day === selectedDate ? 'picked' : ''} ${day === today ? 'today' : ''} ${record?.bleeding?.hasBleeding ? 'has-bleeding' : ''}`}
                disabled={!day}
                onClick={() => onSelectDate(day)}
              >
                {day && <span>{parseDate(day).getDate()}</span>}
                {record && (
                  <div className="markers">
                    {hasDiscomfort(record) && <i className="dot purple" />}
                    {hasBlueMarker(record) && <i className="dot blue" />}
                    {record.mood && <i className="dot gray" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="calendar-legend" aria-label="日历标记说明">
          <span><i className="legend-today" />今天</span>
          <span><i className="legend-bleed" />经期变化</span>
          <span><i className="dot purple" />身体不适</span>
          <span><i className="dot blue" />潮热睡眠</span>
        </div>
      </section>
      <RecordDetail date={selectedDate} record={records[selectedDate]} />
      <TrendCards trend={trend} />
    </div>
  );
}

function SummaryPage({ records, settings, summary, onOpenSettings, onOpenExport, onToast }) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="page">
      <header className="page-header row">
        <div>
          <p>近 90 天</p>
          <h1>就医摘要</h1>
        </div>
        <button className="icon-button" aria-label="设置" onClick={onOpenSettings}><Settings /></button>
      </header>
      <section className={`summary-level ${summary.level.tone}`}>
        <span>{summary.level.label}</span>
      </section>
      <section className="notice-list">
        {summary.reminders.length > 0 ? summary.reminders.map((item) => (
          <div className="notice" key={item.text}>
            <strong>{item.text}</strong>
            <span>{item.reason}</span>
          </div>
        )) : <div className="notice calm">目前没有需要特别提示的记录。继续按自己的节奏记录即可。</div>}
      </section>
      <section className="panel">
        <h2>近 90 天摘要</h2>
        <div className="summary-metrics">
          {summary.metrics.map((item) => <InfoCard key={item.label} label={item.label} value={item.value} />)}
        </div>
        <div className="action-row">
          <button className="secondary-button" onClick={() => copyText(summary.text, onToast)}><ClipboardList />复制摘要</button>
          <button className="primary-button inline" onClick={onOpenExport}><Download />预览导出</button>
        </div>
        <button className="detail-toggle" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? '收起摘要明细' : '查看摘要明细'}
        </button>
        {showDetails && (
          <div className="summary-table" aria-label="摘要明细">
            {summary.rows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="disclaimer">本工具仅用于个人身体记录与就医沟通辅助，不能替代医生诊断或治疗建议。如出现明显不适或担心身体情况，请及时咨询医生。</p>
      <p className="privacy-note">当前提醒阈值：{settings.longGapReminderDays} 天。数据仅保存在本机浏览器中。</p>
    </div>
  );
}

function BleedingSheet({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    hasBleeding: initial?.hasBleeding ?? true,
    flow: initial?.flow || '少量',
    color: initial?.color || '不确定',
    clot: initial?.clot || '无',
    painLevel: initial?.painLevel ?? 0,
    note: initial?.note || '',
    longGapBleeding: initial?.longGapBleeding || null,
    longGapDays: initial?.longGapDays || null,
  });
  return (
    <BottomSheet title="记录经期" onClose={onClose}>
      <Field title="今天的情况"><Segmented options={[{ label: '今天没有', value: false }, { label: '今天有出血或点滴', value: true }]} value={form.hasBleeding} onChange={(value) => setForm({ ...form, hasBleeding: value })} /></Field>
      {form.hasBleeding && (
        <>
          <Field title="出血量"><Segmented options={['少量', '中等', '较多']} value={form.flow} onChange={(value) => setForm({ ...form, flow: value })} /></Field>
          <Field title="出血颜色"><Segmented options={['鲜红', '暗红', '褐色', '粉色', '不确定']} value={form.color} onChange={(value) => setForm({ ...form, color: value })} /></Field>
          <Field title="是否有血块"><Segmented options={['无', '少量', '较多']} value={form.clot} onChange={(value) => setForm({ ...form, clot: value })} /></Field>
          <Field title={`腹痛程度：${form.painLevel}/10`}><input className="range" type="range" min="0" max="10" value={form.painLevel} onChange={(event) => setForm({ ...form, painLevel: Number(event.target.value) })} /></Field>
        </>
      )}
      <Field title="备注"><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="有想补充的情况可以写在这里" /></Field>
      <button className="primary-button" onClick={() => onSave(form)}>保存记录</button>
    </BottomSheet>
  );
}

function VasomotorSheet({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    hotFlashLevel: initial?.hotFlashLevel || '无',
    hotFlashCount: initial?.hotFlashCount || '0',
    nightSweatLevel: initial?.nightSweatLevel || '无',
    wokeBySweat: initial?.wokeBySweat ?? false,
  });
  return (
    <BottomSheet title="潮热盗汗" onClose={onClose}>
      <Field title="潮热程度"><Segmented options={['无', '轻微', '明显', '严重']} value={form.hotFlashLevel} onChange={(value) => setForm({ ...form, hotFlashLevel: value })} /></Field>
      <Field title="潮热次数"><Segmented options={['0', '1-2 次', '3-5 次', '5 次以上']} value={form.hotFlashCount} onChange={(value) => setForm({ ...form, hotFlashCount: value })} /></Field>
      <Field title="盗汗程度"><Segmented options={['无', '轻微', '明显', '严重']} value={form.nightSweatLevel} onChange={(value) => setForm({ ...form, nightSweatLevel: value })} /></Field>
      <Field title="是否夜间出汗醒来"><Segmented options={optionSets.yesNo} value={form.wokeBySweat} onChange={(value) => setForm({ ...form, wokeBySweat: value })} /></Field>
      <button className="primary-button" onClick={() => onSave(form)}>保存记录</button>
    </BottomSheet>
  );
}

function SleepSheet({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    quality: initial?.quality || '一般',
    hardToFallAsleep: initial?.hardToFallAsleep ?? false,
    wakeCount: initial?.wakeCount || '0',
  });
  return (
    <BottomSheet title="睡眠变化" onClose={onClose}>
      <Field title="睡眠质量"><Segmented options={['好', '一般', '差']} value={form.quality} onChange={(value) => setForm({ ...form, quality: value })} /></Field>
      <Field title="是否入睡困难"><Segmented options={optionSets.yesNo} value={form.hardToFallAsleep} onChange={(value) => setForm({ ...form, hardToFallAsleep: value })} /></Field>
      <Field title="夜醒次数"><Segmented options={['0', '1-2 次', '3 次以上']} value={form.wakeCount} onChange={(value) => setForm({ ...form, wakeCount: value })} /></Field>
      <button className="primary-button" onClick={() => onSave(form)}>保存记录</button>
    </BottomSheet>
  );
}

function DiscomfortSheet({ initial, onClose, onSave }) {
  const commonOptions = ['心悸', '头痛/偏头痛', '关节痛', '肌肉酸痛', '腰酸', '乏力', '自定义'];
  const privateOptions = ['小便次数变多', '小便比较急', '私处干涩感', '私处不舒服', '皮肤干痒', '口腔不适', '自定义'];
  const [form, setForm] = useState({
    common: initial?.common || [],
    urinaryPrivate: initial?.urinaryPrivate || [],
    commonOtherNote: initial?.commonOtherNote || '',
    privateOtherNote: initial?.privateOtherNote || initial?.otherNote || '',
  });
  const toggle = (group, item) => {
    const exists = form[group].includes(item);
    setForm({ ...form, [group]: exists ? form[group].filter((value) => value !== item) : [...form[group], item] });
  };
  return (
    <BottomSheet title="身体不适" onClose={onClose}>
      <Field title="常见不适"><CheckGrid options={commonOptions} selected={form.common} onToggle={(item) => toggle('common', item)} /></Field>
      {form.common.includes('自定义') && <input className="text-input inline-input" value={form.commonOtherNote} onChange={(event) => setForm({ ...form, commonOtherNote: event.target.value })} placeholder="简单写一下其他不适" />}
      <Field title="私密不适">
        <p className="field-note">左右滑动选择，内容只保存在本机。</p>
        <ScrollPicker options={privateOptions} selected={form.urinaryPrivate} onToggle={(item) => toggle('urinaryPrivate', item)} />
      </Field>
      {form.urinaryPrivate.includes('自定义') && <input className="text-input inline-input" value={form.privateOtherNote} onChange={(event) => setForm({ ...form, privateOtherNote: event.target.value })} placeholder="简单写一下私密不适" />}
      <button className="primary-button" onClick={() => onSave(form)}>保存记录</button>
    </BottomSheet>
  );
}

function MoodSheet({ initial, onClose, onSave }) {
  const moods = [
    { score: 1, label: '不愉快', face: '☹' },
    { score: 2, label: '不太愉快', face: '🙁' },
    { score: 3, label: '不悲不喜', face: '😐' },
    { score: 4, label: '愉快', face: '🙂' },
    { score: 5, label: '非常愉快', face: '😊' },
  ];
  const initialLabel = normalizeMoodLabel(initial?.label);
  const [form, setForm] = useState({
    score: initial?.score || 3,
    label: initialLabel || '不悲不喜',
    face: initial?.face || moodFaceMap[initialLabel] || '😐',
    note: initial?.note || '',
  });
  return (
    <BottomSheet title="整体心情" onClose={onClose}>
      <p className="field-note">左右滑动，选择今天更接近的整体感受。</p>
      <div className="mood-strip" aria-label="选择整体心情">
        {moods.map((mood) => (
          <button key={mood.score} className={form.score === mood.score ? 'selected' : ''} onClick={() => setForm({ ...form, ...mood })}>
            <span>{mood.face}</span>
            <strong>{mood.label}</strong>
          </button>
        ))}
      </div>
      <Field title="备注"><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="今天有什么想记下来的？" /></Field>
      <button className="primary-button" onClick={() => onSave(form)}>保存记录</button>
    </BottomSheet>
  );
}

function SettingsSheet({ settings, summary, onClose, onSave, onOpenExport, onToast }) {
  const [form, setForm] = useState(settings);
  const [custom, setCustom] = useState('');
  const [baseStep, setBaseStep] = useState(null);
  const reminderValue = optionSets.reminderDays.includes(Number(form.longGapReminderDays)) ? Number(form.longGapReminderDays) : 'custom';
  const baseSteps = [
    {
      title: '年龄段',
      content: <Segmented options={optionSets.ageRange} value={form.ageRange} onChange={(value) => setForm({ ...form, ageRange: value })} />,
    },
    {
      title: '经期当前状态',
      content: <Segmented options={optionSets.periodStatus} value={form.periodCurrentStatus} onChange={(value) => setForm({ ...form, periodCurrentStatus: value })} />,
    },
    {
      title: '经期较长间隔提醒',
      content: (
        <>
          <Segmented
            options={[60, 90, 180, 365, 'custom']}
            labels={{ 60: '60 天', 90: '90 天', 180: '180 天', 365: '365 天', custom: '自定义' }}
            value={reminderValue}
            onChange={(value) => setForm({ ...form, longGapReminderDays: value === 'custom' ? Number(custom || form.longGapReminderDays) : value })}
          />
          {reminderValue === 'custom' && <input className="text-input" type="number" min="1" value={custom} onChange={(event) => {
            setCustom(event.target.value);
            setForm({ ...form, longGapReminderDays: Number(event.target.value || 60) });
          }} placeholder="输入天数" />}
        </>
      ),
    },
  ];
  if (baseStep !== null) {
    const item = baseSteps[baseStep];
    return (
      <BottomSheet title="基础信息" onClose={onClose}>
        <div className="step-dots" aria-label="基础信息进度">
          {baseSteps.map((stepItem, index) => <span key={stepItem.title} className={index <= baseStep ? 'active' : ''} />)}
        </div>
        <Field title={item.title}>{item.content}</Field>
        <div className={`onboarding-actions ${baseStep > 0 ? 'with-back' : ''}`}>
          {baseStep > 0 && <button className="secondary-button" onClick={() => setBaseStep(baseStep - 1)}>上一步</button>}
          <button className="primary-button" onClick={() => {
            if (baseStep === baseSteps.length - 1) setBaseStep(null);
            else setBaseStep(baseStep + 1);
          }}>{baseStep === baseSteps.length - 1 ? '完成调整' : '下一步'}</button>
        </div>
      </BottomSheet>
    );
  }
  return (
    <BottomSheet title="设置" onClose={onClose}>
      <div className="setting-section-title">基础信息</div>
      <Field title="年龄段"><Segmented options={optionSets.ageRange} value={form.ageRange} onChange={(value) => setForm({ ...form, ageRange: value })} /></Field>
      <Field title="经期当前状态"><Segmented options={optionSets.periodStatus} value={form.periodCurrentStatus} onChange={(value) => setForm({ ...form, periodCurrentStatus: value })} /></Field>
      <Field title="经期较长间隔提醒">
        <Segmented
          options={[60, 90, 180, 365, 'custom']}
          labels={{ 60: '60 天', 90: '90 天', 180: '180 天', 365: '365 天', custom: '自定义' }}
          value={reminderValue}
          onChange={(value) => setForm({ ...form, longGapReminderDays: value === 'custom' ? Number(custom || form.longGapReminderDays) : value })}
        />
        {reminderValue === 'custom' && <input className="text-input" type="number" min="1" value={custom} onChange={(event) => {
          setCustom(event.target.value);
          setForm({ ...form, longGapReminderDays: Number(event.target.value || 60) });
        }} placeholder="输入天数" />}
      </Field>
      <button className="soft-full-button" onClick={() => setBaseStep(0)}>逐步调整基础信息</button>
      <div className="setting-section-title">提醒与导出</div>
      <label className="toggle-row">
        <span>每日提醒</span>
        <input type="checkbox" checked={form.dailyReminderEnabled} onChange={(event) => setForm({ ...form, dailyReminderEnabled: event.target.checked })} />
      </label>
      <div className="action-row">
        <button className="secondary-button" onClick={() => copyText(summary.text, onToast)}>复制摘要</button>
        <button className="secondary-button" onClick={onOpenExport}>预览导出</button>
      </div>
      <p className="hint">当前 Demo 数据仅保存在本机浏览器中。</p>
      <button className="primary-button" onClick={() => onSave(form)}>保存设置</button>
    </BottomSheet>
  );
}

function ExportPreviewSheet({ summary, onClose, onToast }) {
  return (
    <BottomSheet title="导出预览" onClose={onClose}>
      <p className="field-note">以下内容会整理为 TXT，方便就医时给医生查看。</p>
      <div className="summary-table export-preview" aria-label="导出摘要预览">
        {summary.rows.map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
        <div>
          <span>温和提示</span>
          <strong>{summary.reminders.length ? formatReminderText(summary.reminders) : '暂无需要特别提示的记录'}</strong>
        </div>
      </div>
      <div className="action-row">
        <button className="secondary-button" onClick={() => copyText(summary.text, onToast)}>复制摘要</button>
        <button className="primary-button inline" onClick={() => exportTxt(summary.text)}><Download />导出 TXT</button>
      </div>
    </BottomSheet>
  );
}

function GapConfirmSheet({ days, onChoose }) {
  return (
    <BottomSheet title="温和确认" onClose={() => onChoose('unsure')}>
      <p className="gap-text">距离上次记录已有 {days} 天，这次是较长间隔后再次出血吗？</p>
      <div className="gap-actions">
        <button onClick={() => onChoose(true)}>是</button>
        <button onClick={() => onChoose(false)}>否</button>
        <button onClick={() => onChoose('unsure')}>不确定</button>
      </div>
    </BottomSheet>
  );
}

function BottomSheet({ title, children, onClose }) {
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <h2>{title}</h2>
          <button onClick={onClose}>关闭</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ title, children }) {
  return <div className="field"><label>{title}</label>{children}</div>;
}

function Segmented({ options, value, onChange, labels = {} }) {
  return (
    <div className="segmented">
      {options.map((option) => {
        const optionValue = typeof option === 'object' ? option.value : option;
        const label = typeof option === 'object' ? option.label : labels[option] || option;
        return <button key={String(optionValue)} className={value === optionValue ? 'selected' : ''} onClick={() => onChange(optionValue)}>{label}</button>;
      })}
    </div>
  );
}

function CheckGrid({ options, selected, onToggle }) {
  return <div className="check-grid">{options.map((item) => <button key={item} className={selected.includes(item) ? 'selected' : ''} onClick={() => onToggle(item)}>{item}</button>)}</div>;
}

function ScrollPicker({ options, selected, onToggle }) {
  return (
    <div className="scroll-picker-wrap">
      <div className="scroll-picker">
        {options.map((item, index) => (
          <button
            key={item}
            className={selected.includes(item) ? 'selected' : ''}
            onClick={() => onToggle(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function SmallCard({ title, text, icon, tone, onClick }) {
  return (
    <button className={`small-card ${tone}`} onClick={onClick}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </button>
  );
}

function TabButton({ active, icon, label, onClick }) {
  return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function RecordDetail({ date, record }) {
  return (
    <section className="panel detail">
      <h2>{fullDate(date)}</h2>
      {!record ? <p className="empty">这一天还没有记录。</p> : (
        <ul>
          {record.bleeding && <li>经期变化：{record.bleeding.hasBleeding ? `${record.bleeding.flow}，${record.bleeding.color}` : '今天没有'}</li>}
          {record.bleeding?.hasBleeding && <li>血块：{record.bleeding.clot}；腹痛：{record.bleeding.painLevel}/10</li>}
          {record.vasomotor && <li>潮热：{record.vasomotor.hotFlashLevel}，{record.vasomotor.hotFlashCount}；盗汗：{record.vasomotor.nightSweatLevel}</li>}
          {record.sleep && <li>睡眠：{record.sleep.quality}，夜醒 {record.sleep.wakeCount}</li>}
          {record.discomfort && <li>身体不适：{getDiscomfortItems(record.discomfort).join('、') || '未选择'}</li>}
          {record.mood && <li>整体心情：{normalizeMoodLabel(record.mood.label)}</li>}
          {[record.bleeding?.note, record.mood?.note].filter(Boolean).map((note, index) => <li key={index}>备注：{note}</li>)}
        </ul>
      )}
    </section>
  );
}

function TrendCards({ trend }) {
  return (
    <section className="trend">
      <h2>近 30 天趋势</h2>
      <div className="trend-grid">
        <InfoCard label="最近一次记录" value={trend.lastBleedingDate ? fullDate(trend.lastBleedingDate) : '暂无'} />
        <InfoCard label="经期变化" value={`${trend.bleedingDays} 天`} />
        <InfoCard label="潮热盗汗" value={`${trend.vasomotorDays} 天`} />
        <InfoCard label="睡眠受影响" value={`${trend.poorSleepDays} 天`} />
      </div>
      <div className="panel">
        <h3>常被记录的身体感受</h3>
        <p>{trend.topDiscomfort.length ? trend.topDiscomfort.join('、') : '近 30 天暂无明显集中记录。'}</p>
        <h3>整体心情分布</h3>
        <div className="mood-bars">
          {['非常愉快', '愉快', '不悲不喜', '不太愉快', '不愉快'].map((label) => {
            const count = trend.moodDistribution[label] || 0;
            return <span key={label} style={{ '--bar': `${Math.max(8, count * 18)}px` }}>{label} {count}</span>;
          })}
        </div>
      </div>
    </section>
  );
}

function InfoCard({ label, value }) {
  return <div className="info-card"><span>{label}</span><strong>{value}</strong></div>;
}

function findPreviousBleedingDate(records, dateString) {
  return Object.entries(records)
    .filter(([date, record]) => date < dateString && record.bleeding?.hasBleeding)
    .map(([date]) => date)
    .sort()
    .pop();
}

function buildMonthDays(monthString) {
  const [year, month] = monthString.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const days = Array(first.getDay()).fill(null);
  for (let day = 1; day <= last.getDate(); day += 1) days.push(formatDate(new Date(year, month - 1, day)));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function shiftMonth(monthString, offset) {
  const [year, month] = monthString.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function recentEntries(records, days) {
  const end = todayISO();
  const start = addDays(end, -days + 1);
  return Object.entries(records).filter(([date]) => date >= start && date <= end).sort(([a], [b]) => a.localeCompare(b));
}

function hasDiscomfort(record) {
  return Boolean(record.discomfort && getDiscomfortItems(record.discomfort).length);
}

function hasBlueMarker(record) {
  return Boolean(
    (record.vasomotor && (record.vasomotor.hotFlashLevel !== '无' || record.vasomotor.nightSweatLevel !== '无' || record.vasomotor.wokeBySweat)) ||
    (record.sleep && (record.sleep.quality === '差' || record.sleep.wakeCount !== '0' || record.sleep.hardToFallAsleep))
  );
}

function buildTrend(records, days) {
  const entries = recentEntries(records, days);
  const discomfortCount = {};
  const moodDistribution = { 非常愉快: 0, 愉快: 0, 不悲不喜: 0, 不太愉快: 0, 不愉快: 0 };
  let bleedingDays = 0;
  let lastBleedingDate = null;
  let vasomotorDays = 0;
  let poorSleepDays = 0;
  entries.forEach(([date, record]) => {
    if (record.bleeding?.hasBleeding) {
      bleedingDays += 1;
      lastBleedingDate = date;
    }
    if (record.vasomotor && (record.vasomotor.hotFlashLevel !== '无' || record.vasomotor.nightSweatLevel !== '无')) vasomotorDays += 1;
    if (record.sleep && (record.sleep.quality === '差' || record.sleep.wakeCount === '3 次以上')) poorSleepDays += 1;
    getDiscomfortItems(record.discomfort).forEach((item) => {
      discomfortCount[item] = (discomfortCount[item] || 0) + 1;
    });
    if (record.mood?.label) {
      const label = normalizeMoodLabel(record.mood.label);
      moodDistribution[label] = (moodDistribution[label] || 0) + 1;
    }
  });
  return {
    bleedingDays,
    lastBleedingDate,
    vasomotorDays,
    poorSleepDays,
    topDiscomfort: Object.entries(discomfortCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([item]) => item),
    moodDistribution,
  };
}

function buildSummary(records, settings) {
  const entries = recentEntries(records, 90);
  const bleedingEntries = entries.filter(([, record]) => record.bleeding?.hasBleeding);
  const heavyFlowCount = bleedingEntries.filter(([, record]) => record.bleeding?.flow === '较多').length;
  const lastBleedingDate = bleedingEntries.at(-1)?.[0] || null;
  const longGapEntries = bleedingEntries.filter(([, record]) => record.bleeding?.longGapBleeding === true);
  const yearGapEntries = bleedingEntries.filter(([, record]) => Number(record.bleeding?.longGapDays || 0) >= 365);
  const vasomotorDays = entries.filter(([, record]) => record.vasomotor && (record.vasomotor.hotFlashLevel !== '无' || record.vasomotor.nightSweatLevel !== '无')).length;
  const obviousHotFlashDays = entries.filter(([, record]) => record.vasomotor && ['明显', '严重'].includes(record.vasomotor.hotFlashLevel)).length;
  const obviousNightSweatDays = entries.filter(([, record]) => record.vasomotor && ['明显', '严重'].includes(record.vasomotor.nightSweatLevel)).length;
  const sleepAffectedDays = entries.filter(([, record]) => record.sleep && (record.sleep.quality === '差' || record.sleep.wakeCount !== '0' || record.sleep.hardToFallAsleep)).length;
  const nightSweatAffectsSleep = entries.filter(([, record]) => record.vasomotor && ['明显', '严重'].includes(record.vasomotor.nightSweatLevel) && record.vasomotor.wokeBySweat).length;
  const privateDiscomfortDays = entries.filter(([, record]) => getPrivateDiscomfortItems(record.discomfort).length).length;
  const lowMoodDays = entries.filter(([, record]) => record.mood && Number(record.mood.score) <= 2).length;
  const discomfortCount = {};
  const notes = [];
  const moodCounts = {};
  entries.forEach(([, record]) => {
    getDiscomfortItems(record.discomfort).forEach((item) => {
      discomfortCount[item] = (discomfortCount[item] || 0) + 1;
    });
    if (record.bleeding?.note) notes.push(record.bleeding.note);
    if (record.mood?.note) notes.push(record.mood.note);
    if (record.mood?.label) {
      const label = normalizeMoodLabel(record.mood.label);
      moodCounts[label] = (moodCounts[label] || 0) + 1;
    }
  });
  const discomfortRank = Object.entries(discomfortCount).sort((a, b) => b[1] - a[1]);
  const repeatedDiscomfort = discomfortRank.filter(([, count]) => count >= 5);
  const topDiscomfort = discomfortRank.slice(0, 5).map(([item, count]) => `${item} ${count} 次`);
  const moodText = Object.entries(moodCounts).length ? Object.entries(moodCounts).map(([label, count]) => `${label} ${count} 天`).join('，') : '暂无记录';
  const reminders = [];
  const addReminder = (textValue, reason) => {
    if (!reminders.some((item) => item.text === textValue)) reminders.push({ text: textValue, reason });
  };
  if (longGapEntries.length) addReminder('你记录了较长间隔后再次出血，建议持续观察，并在需要时咨询医生。', `依据：有 ${longGapEntries.length} 次记录被标记为较长间隔后再次出血。`);
  if (yearGapEntries.length || (Number(settings.longGapReminderDays) === 365 && longGapEntries.length)) addReminder('你记录了长期停经后再次出血，建议咨询医生。', `依据：有 ${yearGapEntries.length || longGapEntries.length} 次记录达到长期间隔提醒条件。`);
  if (hasConsecutiveHeavyBleeding(entries)) addReminder('近期经期变化中出血量偏多，建议继续记录，并考虑咨询医生。', '依据：有连续记录显示出血量为“较多”。');
  if (heavyFlowCount >= 2) addReminder(`近 90 天记录了 ${heavyFlowCount} 次出血量偏多，建议留意变化，必要时咨询医生。`, `依据：近 90 天“较多”记录达到 ${heavyFlowCount} 次。`);
  if (obviousHotFlashDays >= 7) addReminder(`近 90 天潮热明显或严重记录 ${obviousHotFlashDays} 天，建议关注发生频率和持续时间。`, `依据：潮热程度为“明显”或“严重”的记录达到 ${obviousHotFlashDays} 天。`);
  if (obviousNightSweatDays >= 5) addReminder(`近 90 天盗汗明显或严重记录 ${obviousNightSweatDays} 天，可以结合睡眠情况一起观察。`, `依据：盗汗程度为“明显”或“严重”的记录达到 ${obviousNightSweatDays} 天。`);
  if (nightSweatAffectsSleep >= 2) addReminder('近期盗汗对睡眠有影响，可以记录发生时间和频率，必要时咨询医生。', `依据：有 ${nightSweatAffectsSleep} 天记录夜间出汗醒来。`);
  if (sleepAffectedDays >= 10) addReminder(`近 90 天睡眠受影响记录 ${sleepAffectedDays} 天，建议关注休息状态，必要时咨询医生。`, `依据：睡眠质量、夜醒或入睡困难相关记录达到 ${sleepAffectedDays} 天。`);
  if (privateDiscomfortDays >= 3) addReminder(`近 90 天私密不适记录 ${privateDiscomfortDays} 天，建议持续记录，若反复出现可咨询医生。`, `依据：私密不适相关记录达到 ${privateDiscomfortDays} 天。`);
  if (repeatedDiscomfort.length) {
    const names = repeatedDiscomfort.slice(0, 2).map(([item, count]) => `${item} ${count} 次`).join('，');
    addReminder(`有些身体感受反复出现：${names}。建议观察诱因和持续时间。`, `依据：单项身体感受在近 90 天内记录达到 5 次或以上。`);
  }
  if (lowMoodDays >= 7) addReminder(`近 90 天有 ${lowMoodDays} 天整体心情偏低，建议多留意休息和支持，必要时和医生沟通。`, `依据：整体心情选择“不愉快”或“不太愉快”达到 ${lowMoodDays} 天。`);
  const needsConsult =
    yearGapEntries.length ||
    heavyFlowCount >= 2 ||
    sleepAffectedDays >= 10 ||
    privateDiscomfortDays >= 3 ||
    nightSweatAffectsSleep >= 2;
  const level = reminders.length === 0
    ? { tone: 'calm', label: '暂无特别提示', description: '目前记录整体平稳，继续按自己的节奏记录即可。' }
    : needsConsult
      ? { tone: 'consult', label: '建议咨询医生', description: '有几项记录值得带给医生看，提前整理会更方便沟通。' }
      : { tone: 'watch', label: '建议关注', description: '近期有一些变化，可以继续观察频率和持续时间。' };
  const text = [
    '安然期近 90 天就医摘要',
    `生成日期：${fullDate(todayISO())}`,
    '',
    `年龄段：${settings.ageRange || '未设置'}`,
    `经期当前状态：${settings.periodCurrentStatus}`,
    `最近一次经期变化日期：${lastBleedingDate ? fullDate(lastBleedingDate) : '暂无记录'}`,
    `近 90 天经期变化记录次数：${bleedingEntries.length} 次`,
    `近 90 天出血量偏多次数：${heavyFlowCount} 次`,
    `是否出现较长间隔后再次出血：${longGapEntries.length ? '是' : '未记录到'}`,
    `是否出现长期停经后再次出血：${yearGapEntries.length ? '是' : '未记录到'}`,
    `潮热盗汗记录：${vasomotorDays} 天有相关记录`,
    `潮热明显或严重天数：${obviousHotFlashDays} 天`,
    `盗汗明显或严重天数：${obviousNightSweatDays} 天`,
    `睡眠受影响天数：${sleepAffectedDays} 天`,
    `私密不适记录天数：${privateDiscomfortDays} 天`,
    `常被记录的身体感受：${topDiscomfort.length ? topDiscomfort.join('，') : '暂无集中记录'}`,
    `整体心情简要概览：${moodText}`,
    `用户备注汇总：${notes.length ? notes.slice(0, 8).join('；') : '暂无备注'}`,
    '',
    `温和提示：${reminders.length ? formatReminderText(reminders) : '暂无需要特别提示的记录'}`,
    '',
    '说明：本摘要来自个人记录，仅用于就医沟通辅助。'
  ].join('\n');
  const rows = [
    { label: '年龄段', value: settings.ageRange || '未设置' },
    { label: '经期当前状态', value: settings.periodCurrentStatus },
    { label: '最近一次记录', value: lastBleedingDate ? fullDate(lastBleedingDate) : '暂无记录' },
    { label: '经期变化记录', value: `${bleedingEntries.length} 次` },
    { label: '出血量偏多次数', value: `${heavyFlowCount} 次` },
    { label: '较长间隔后再次出血', value: longGapEntries.length ? '是' : '未记录到' },
    { label: '长期停经后再次出血', value: yearGapEntries.length ? '是' : '未记录到' },
    { label: '潮热盗汗记录', value: `${vasomotorDays} 天有相关记录` },
    { label: '潮热明显或严重', value: `${obviousHotFlashDays} 天` },
    { label: '盗汗明显或严重', value: `${obviousNightSweatDays} 天` },
    { label: '睡眠受影响天数', value: `${sleepAffectedDays} 天` },
    { label: '私密不适记录天数', value: `${privateDiscomfortDays} 天` },
    { label: '常被记录的身体感受', value: topDiscomfort.length ? topDiscomfort.join('，') : '暂无集中记录' },
    { label: '整体心情概览', value: moodText },
    { label: '用户备注汇总', value: notes.length ? notes.slice(0, 8).join('；') : '暂无备注' },
  ];
  const metrics = [
    { label: '关注提示', value: `${reminders.length} 条` },
    { label: '经期变化', value: `${bleedingEntries.length} 次` },
    { label: '潮热盗汗', value: `${vasomotorDays} 天` },
    { label: '睡眠受影响', value: `${sleepAffectedDays} 天` },
  ];
  return { text, reminders, rows, metrics, level };
}

function hasConsecutiveHeavyBleeding(entries) {
  let streak = 0;
  for (const [, record] of entries) {
    if (record.bleeding?.hasBleeding && record.bleeding?.flow === '较多') {
      streak += 1;
      if (streak >= 2) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

function summarizeVasomotor(value) {
  if (!value) return '记录潮热、盗汗和夜间醒来';
  return `潮热${value.hotFlashLevel}，盗汗${value.nightSweatLevel}`;
}
function summarizeSleep(value) {
  if (!value) return '记录睡眠质量和夜醒';
  return `${value.quality}，夜醒 ${value.wakeCount}`;
}
function summarizeDiscomfort(value) {
  const items = getDiscomfortItems(value);
  return items.length ? items.slice(0, 3).join('、') : '记录常见身体不适';
}

function summarizeBleeding(value) {
  if (!value) return '未记录';
  if (!value.hasBleeding) return '已记录：今天没有';
  return `已记录：有出血，${value.flow || '未填写量'}`;
}

function formatReminderText(reminders) {
  return reminders.map((item) => `${item.text}（${item.reason}）`).join('；');
}

function getDiscomfortItems(value) {
  if (!value) return [];
  return [
    ...(value.common || []).filter((item) => item !== '自定义'),
    value.commonOtherNote,
    ...getPrivateDiscomfortItems(value),
  ].filter(Boolean);
}

function getPrivateDiscomfortItems(value) {
  if (!value) return [];
  return [
    ...(value.urinaryPrivate || []).filter((item) => item !== '自定义' && item !== '其他'),
    value.privateOtherNote || value.otherNote,
  ].filter(Boolean);
}

async function copyText(text, onToast) {
  try {
    await navigator.clipboard.writeText(text);
    onToast('摘要已复制。');
  } catch {
    onToast('复制未完成，可以手动选择摘要文本。');
  }
}

function exportTxt(text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `安然期就医摘要-${todayISO()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default App;
