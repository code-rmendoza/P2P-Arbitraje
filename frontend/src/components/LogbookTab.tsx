import { ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import type { DailyLog } from '../api';

interface LogbookTabProps {
  year: number;
  monthName: string;
  monthVolumeTotal: number;
  monthProfitTotal: number;
  calendarDays: { dateStr: string | null; dayNum: number | null; logs: DailyLog[] }[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayClick: (dateStr: string) => void;
  onExportCSV: () => void;
}

export function LogbookTab({
  year,
  monthName,
  monthVolumeTotal,
  monthProfitTotal,
  calendarDays,
  onPrevMonth,
  onNextMonth,
  onDayClick,
  onExportCSV,
}: LogbookTabProps) {
  return (
    <div className="card">
      <div className="calendar-header-row">
        <div className="calendar-title-nav">
          <button className="calendar-nav-btn" onClick={onPrevMonth}>
            <ChevronLeft style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
          <span className="calendar-title">{monthName} {year}</span>
          <button className="calendar-nav-btn" onClick={onNextMonth}>
            <ChevronRight style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>
        <div className="calendar-stats">
          <div className="calendar-stat-item">
            <span className="calendar-stat-label">Volumen Mensual</span>
            <span className="calendar-stat-value">${monthVolumeTotal.toFixed(2)} USDT</span>
          </div>
          <div className="calendar-stat-item">
            <span className="calendar-stat-label">Profit Mes Actual</span>
            <span className="calendar-stat-value profit">
              {monthProfitTotal >= 0 ? '+' : ''}${monthProfitTotal.toFixed(2)} USDT
            </span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={onExportCSV}>
            <FileSpreadsheet style={{ width: '1rem', height: '1rem' }} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SA', 'DOM'].map(name => (
          <div key={name} className="calendar-day-name">{name}</div>
        ))}

        {calendarDays.map((cell, idx) => {
          if (!cell.dayNum || !cell.dateStr) {
            return <div key={`empty-${idx}`} className="calendar-day empty" />;
          }

          const { logs: dayOperations, dateStr, dayNum } = cell;
          let activityClass = 'inactive';
          const dayProfit = dayOperations.reduce((sum, o) => sum + o.profit, 0);
          const dayVolume = dayOperations.reduce((sum, o) => sum + o.volume, 0);
          const hasImported = dayOperations.some(o => o.imported);

          if (dayVolume > 0) {
            activityClass = dayVolume > 2000 ? 'high-volume' : 'slow-volume';
          }

          return (
            <div key={dateStr} className={`calendar-day ${activityClass}`} onClick={() => onDayClick(dateStr)}>
              <span className="calendar-day-num">{dayNum}</span>
              {dayOperations.length > 0 && (
                <>
                  {hasImported && <span className="imported-indicator" title="Importado de Operativa"></span>}
                  <div style={{ display: 'flex', gap: '0.2rem', position: 'absolute', bottom: '6px', left: '6px', flexWrap: 'wrap' }}>
                    {dayOperations.some(o => o.tipo_operativa === 'USD') && <span className="legend-dot" style={{ backgroundColor: 'var(--color-primary)', width: '6px', height: '6px' }} title="USD Operations"></span>}
                    {dayOperations.some(o => o.tipo_operativa === 'VES') && <span className="legend-dot" style={{ backgroundColor: '#d97706', width: '6px', height: '6px' }} title="VES Operations"></span>}
                  </div>
                  <div className="calendar-day-data">
                    <span className={`calendar-day-profit-val ${dayProfit > 0 ? 'positive' : dayProfit < 0 ? 'negative' : ''}`}>
                      {dayProfit > 0 ? '+' : ''}{dayProfit.toFixed(1)}
                    </span>
                    <span className="calendar-day-vol-val">V: {dayVolume.toFixed(2)}</span>
                  </div>
                </>
              )}
              {dayOperations.length === 0 && (
                <div className="calendar-day-data">
                  <span className="calendar-day-profit-val">0.0</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="calendar-legend-row">
        <div className="legend-item">
          <span className="legend-dot inactive"></span>
          <span>Nulo / Inactivo</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot slow"></span>
          <span>Operacion Lenta (Vol &lt;= 2000 USDT)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot high"></span>
          <span>Alto Volumen (Vol &gt; 2000 USDT)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot imported"></span>
          <span>Importado de Operativa</span>
        </div>
        <div className="legend-item" style={{ marginLeft: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
          <span className="legend-dot" style={{ backgroundColor: 'var(--color-primary)', borderRadius: '50%', width: '8px', height: '8px' }}></span>
          <span>Operado en USD</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#d97706', borderRadius: '50%', width: '8px', height: '8px' }}></span>
          <span>Operado en VES</span>
        </div>
      </div>
    </div>
  );
}
