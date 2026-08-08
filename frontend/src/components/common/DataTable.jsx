import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

export function DataTable({ 
  columns: initialColumns, 
  data, 
  storageKey, 
  searchable = true,
  onRowClick
}) {
  const { session } = useAuth();
  const userId = session?.user?.id || 'anonymous';
  const fullStorageKey = `tlc_datatable_${storageKey}_${userId}`;

  // Default state initialization
  const defaultState = {
    columnOrder: initialColumns.map(c => c.key),
    hiddenColumns: [],
    sortKey: initialColumns[0]?.key,
    sortDirection: 'asc',
    columnWidths: {}
  };

  const [tableState, setTableState] = useState(() => {
    try {
      const saved = localStorage.getItem(fullStorageKey);
      if (saved) return { ...defaultState, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Failed to parse DataTable state', e);
    }
    return defaultState;
  });

  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const tableRef = useRef(null);

  // Persist state when it changes
  useEffect(() => {
    localStorage.setItem(fullStorageKey, JSON.stringify(tableState));
  }, [tableState, fullStorageKey]);

  // Derived state
  const visibleColumns = useMemo(() => {
    return tableState.columnOrder
      .map(key => initialColumns.find(c => c.key === key))
      .filter(c => c && !tableState.hiddenColumns.includes(c.key));
  }, [initialColumns, tableState.columnOrder, tableState.hiddenColumns]);

  const sortedAndFilteredData = useMemo(() => {
    let result = [...data];

    // Global Filter
    if (globalFilter) {
      const lowerFilter = globalFilter.toLowerCase();
      result = result.filter(row => 
        visibleColumns.some(col => {
          const val = row[col.key];
          return val && String(val).toLowerCase().includes(lowerFilter);
        })
      );
    }

    // Column Filters
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        const lowerFilter = filterValue.toLowerCase();
        result = result.filter(row => {
          const val = row[key];
          return val && String(val).toLowerCase().includes(lowerFilter);
        });
      }
    });

    // Sorting
    if (tableState.sortKey) {
      result.sort((a, b) => {
        let valA = a[tableState.sortKey];
        let valB = b[tableState.sortKey];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return tableState.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return tableState.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, visibleColumns, globalFilter, columnFilters, tableState.sortKey, tableState.sortDirection]);

  // Actions
  const handleSort = (key) => {
    setTableState(prev => ({
      ...prev,
      sortKey: key,
      sortDirection: prev.sortKey === key && prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleColumn = (key) => {
    setTableState(prev => ({
      ...prev,
      hiddenColumns: prev.hiddenColumns.includes(key) 
        ? prev.hiddenColumns.filter(k => k !== key)
        : [...prev.hiddenColumns, key]
    }));
  };

  const resetState = () => {
    setTableState(defaultState);
    setGlobalFilter('');
    setColumnFilters({});
  };

  // Drag and drop for columns
  const [draggedCol, setDraggedCol] = useState(null);

  const handleDragStart = (e, key) => {
    setDraggedCol(key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, key) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetKey) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetKey) return;
    
    setTableState(prev => {
      const newOrder = [...prev.columnOrder];
      const draggedIdx = newOrder.indexOf(draggedCol);
      const targetIdx = newOrder.indexOf(targetKey);
      
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedCol);
      
      return { ...prev, columnOrder: newOrder };
    });
    setDraggedCol(null);
  };

  // Resizable columns logic
  const handleStartResize = (e, leftIdx) => {
    e.preventDefault();
    e.stopPropagation();

    if (!tableRef.current || leftIdx >= visibleColumns.length - 1) return;

    const leftCol = visibleColumns[leftIdx];
    const rightCol = visibleColumns[leftIdx + 1];
    const containerWidth = tableRef.current.getBoundingClientRect().width;
    const startX = e.clientX;

    const currentWidths = tableState.columnWidths || {};
    const startLeftFr = currentWidths[leftCol.key] ?? 1.0;
    const startRightFr = currentWidths[rightCol.key] ?? 1.0;

    const totalFr = visibleColumns.reduce((sum, c) => sum + (currentWidths[c.key] ?? 1.0), 0);

    const handleMouseMove = (moveEv) => {
      const deltaX = moveEv.clientX - startX;
      const deltaFr = (deltaX / containerWidth) * totalFr;

      const minFr = 0.4;
      let newLeftFr = startLeftFr + deltaFr;
      let newRightFr = startRightFr - deltaFr;

      if (newLeftFr < minFr) {
        newLeftFr = minFr;
        newRightFr = startLeftFr + startRightFr - minFr;
      } else if (newRightFr < minFr) {
        newRightFr = minFr;
        newLeftFr = startLeftFr + startRightFr - minFr;
      }

      setTableState(prev => ({
        ...prev,
        columnWidths: {
          ...(prev.columnWidths || {}),
          [leftCol.key]: Number(newLeftFr.toFixed(2)),
          [rightCol.key]: Number(newRightFr.toFixed(2))
        }
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="datatable-container">
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        {searchable && (
          <input 
            type="text" 
            placeholder="Search all columns..." 
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            style={{ 
              padding: '0.5rem 1rem', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-secondary)', 
              color: 'var(--foreground)', 
              flex: 1, 
              maxWidth: '300px' 
            }}
          />
        )}
        <div style={{ position: 'relative' }}>
          <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)} style={{ padding: '0.5rem 1rem' }}>
            ⚙️ Columns
          </button>
          
          {showSettings && (
            <div className="glass-card" style={{ 
              position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', 
              padding: '1rem', zIndex: 50, minWidth: '200px',
              display: 'flex', flexDirection: 'column', gap: '0.5rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Show/Hide Columns</h4>
              {initialColumns.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={!tableState.hiddenColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
              <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.75rem' }} onClick={resetState}>
                Reset to Default
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table ref={tableRef} className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
          <colgroup>
            {visibleColumns.map(col => (
              <col key={col.key} style={{ width: `${tableState.columnWidths?.[col.key] || 1.0}fr` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((col, idx) => (
                <th 
                  key={col.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, col.key)}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDrop={(e) => handleDrop(e, col.key)}
                  onClick={() => handleSort(col.key)}
                  style={{ 
                    padding: '1rem', 
                    borderBottom: '2px solid var(--border-color)', 
                    color: 'var(--muted-foreground)', 
                    fontSize: '0.875rem', 
                    fontWeight: 600, 
                    cursor: 'pointer',
                    userSelect: 'none',
                    position: 'relative',
                    background: draggedCol === col.key ? 'var(--muted)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {col.label}
                    {tableState.sortKey === col.key && (
                      <span style={{ fontSize: '0.75rem' }}>
                        {tableState.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                  {idx < visibleColumns.length - 1 && (
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleStartResize(e, idx)}
                      title="Drag to resize column"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                  No data available.
                </td>
              </tr>
            ) : (
              sortedAndFilteredData.map((row, idx) => (
                <tr 
                  key={row.id || idx} 
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{ 
                    cursor: onRowClick ? 'pointer' : 'default',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                  className={onRowClick ? 'table-row-hover' : ''}
                >
                  {visibleColumns.map(col => (
                    <td key={col.key} style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
