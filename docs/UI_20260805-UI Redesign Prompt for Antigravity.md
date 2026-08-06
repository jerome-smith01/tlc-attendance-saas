# **TLC Attendance UI/UX Redesign \- Target Prototype & Instructions**

**To the AI Agent (Antigravity):**

You have been provided with the attendance-app-uiux-redesign-brief-v4.md and the current source files for the TLC Attendance app. Your goal is to execute the UI/UX redesign outlined in the brief.

Below is the **final, approved visual prototype** for the core screens. You must use this prototype as your structural and stylistic target when rewriting the real components (Scanner.jsx, Dashboard.jsx, Sessions.jsx, etc.).

## **Key UX/UI Decisions to Extract from this Prototype:**

1. **Global CSS & Tokens:**  
   * The prototype strictly adheres to the CSS variables in global.css.  
   * It uses var(--glass-bg) and var(--glass-border) for the card treatments.  
   * Notice how the camera viewfinder placeholder uses var(--muted) instead of a hardcoded black so it respects light/dark themes gracefully.  
2. **Scanner UX (The most critical view):**  
   * **Collapsible Inline Table:** The "Recent Scans" list is an inline table located directly below the camera. It uses a CSS Grid grid-template-rows: 1fr to 0fr animation to smoothly show/hide the list when the header is clicked, giving users control over viewfinder space.  
   * **Fixed Bottom Actions:** The primary scanning buttons are large, fixed at the bottom of the screen, and designed for one-handed thumb use.  
3. **Dashboard UX:**  
   * **Corrected Warning Banner:** The warning banner logic and copy have been updated to remove the inaccurate "auto-purge" language, focusing solely on the "Unsynced Session" status.  
   * Uses clean, glassmorphic cards for the troop overview metrics.  
4. **Role-Based Views:**  
   * The prototype demonstrates the strict visual boundaries. A badge\_scanner should **only** see the Scanner view, without any sidebar navigation or dashboard access.

## **Implementation Instructions:**

1. **Merge, do not overwrite logic:** Apply the HTML structures, CSS classes, and layout patterns from the prototype below into the real production files.  
2. **Preserve backend/state:** Do not alter useScanLogic, Supabase queries, or the Chrome Extension tlc\_id DOM targets.  
3. **Implement Role-Based Routing:** Ensure the generic \<ProtectedRoute\> in App.jsx is updated to enforce the badge\_scanner vs troop\_admin route matrix defined in the v4 brief.

## **Reference Prototype Code**

Here is the approved React prototype. Use its JSX structure and inline/class-based styling as your exact target for the redesign.

import React, { useState, useEffect } from 'react';

const globalCss \= \`  
  :root {  
    \--background: \#f4f4f5;  
    \--bg-gradient: \#f4f4f5;  
    \--foreground: \#0f172a;  
    \--muted: \#e4e4e7;  
    \--muted-foreground: \#475569;  
    \--primary-foreground: \#ffffff;  
    \--glass-bg: rgba(255, 255, 255, 0.7);  
    \--glass-border: rgba(224, 224, 227, 0.8);  
      
    \--color-primary: \#0284c7;  
    \--color-primary-hover: \#0369a1;  
    \--color-success: \#22c55e;  
    \--color-error: \#ef4444;  
    \--color-warning: \#f59e0b;  
      
    \--spacing-xs: 4px;  
    \--spacing-sm: 8px;  
    \--spacing-md: 16px;  
    \--spacing-lg: 24px;  
    \--spacing-xl: 40px;  
      
    \--radius-sm: 6px;  
    \--radius-md: 12px;  
    \--radius-lg: 20px;  
    \--radius-pill: 9999px;  
      
    \--font-sans: 'Inter', system-ui, sans-serif;  
  }

  .dark {  
    \--background: \#121214;  
    \--bg-gradient: \#121214;  
    \--foreground: \#ffffff;  
    \--color-primary: \#60a5fa;  
    \--color-primary-hover: \#93c5fd;  
    \--muted: \#1e293b;  
    \--muted-foreground: \#94a3b8;  
    \--glass-bg: rgba(30, 41, 59, 0.5);  
    \--glass-border: rgba(255, 255, 255, 0.1);  
  }

  \* { box-sizing: border-box; margin: 0; padding: 0; }  
  body {   
    font-family: var(--font-sans);   
    background: var(--background);   
    color: var(--foreground);   
    transition: background 0.3s, color 0.3s;  
    overflow-x: hidden;  
  }

  .glass-card {  
    background: var(--glass-bg);  
    border: 1px solid var(--glass-border);  
    backdrop-filter: blur(12px);  
    \-webkit-backdrop-filter: blur(12px);  
    border-radius: var(--radius-md);  
  }

  /\* Utility classes \*/  
  .btn {  
    display: inline-flex; align-items: center; justify-content: center;  
    padding: 0.75rem 1.5rem; border-radius: var(--radius-md);  
    font-weight: 700; font-size: 0.875rem; border: none;  
    cursor: pointer; transition: all 150ms ease; text-transform: uppercase;  
  }  
  .btn:active { transform: scale(0.96); }  
  .btn-primary { background: var(--color-primary); color: \#fff; box-shadow: 0 4px 6px \-2px rgba(0,0,0,0.05); }  
  .btn-primary:hover { background: var(--color-primary-hover); }  
  .btn-destructive { background: var(--color-error); color: \#fff; }  
  .btn-secondary { background: var(--muted); color: var(--foreground); }  
    
  .badge {  
    padding: 0.25rem 0.5rem; border-radius: var(--radius-pill); font-size: 0.75rem; font-weight: 600;  
  }  
  .badge-pending { background: color-mix(in srgb, var(--color-warning), transparent 85%); color: var(--color-warning); }  
  .badge-approved { background: color-mix(in srgb, var(--color-success), transparent 85%); color: var(--color-success); }  
    
  .bottom-sheet {  
    position: fixed; bottom: 0; left: 0; right: 0;  
    background: var(--background);  
    border-top-left-radius: var(--radius-lg); border-top-right-radius: var(--radius-lg);  
    box-shadow: 0 \-4px 20px rgba(0,0,0,0.15);  
    transition: transform 0.3s ease-in-out;  
    z-index: 100;  
    max-height: 80vh;  
    display: flex;  
    flex-direction: column;  
  }  
  .bottom-sheet.closed { transform: translateY(calc(100% \- 64px)); }  
  .bottom-sheet-handle {  
    width: 40px; height: 5px; background: var(--muted-foreground);  
    border-radius: var(--radius-pill); margin: 12px auto; opacity: 0.5;  
  }

  /\* DataTable Mocks \*/  
  .data-table { width: 100%; border-collapse: collapse; text-align: left; }  
  .data-table th { padding: 1rem; border-bottom: 2px solid var(--glass-border); color: var(--muted-foreground); font-size: 0.875rem; font-weight: 600; cursor: pointer; }  
  .data-table td { padding: 1rem; border-bottom: 1px solid var(--glass-border); font-size: 0.9rem; }  
  .data-table tr:last-child td { border-bottom: none; }  
\`;

const Icons \= {  
  Camera: () \=\> \<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"\>\<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"\>\</path\>\<circle cx="12" cy="13" r="4"\>\</circle\>\</svg\>,  
  Check: () \=\> \<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"\>\<polyline points="20 6 9 17 4 12"\>\</polyline\>\</svg\>,  
  Warning: () \=\> \<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"\>\<circle cx="12" cy="12" r="10"\>\</circle\>\<line x1="12" y1="8" x2="12" y2="12"\>\</line\>\<line x1="12" y1="16" x2="12.01" y2="16"\>\</line\>\</svg\>,  
  Menu: () \=\> \<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"\>\<line x1="3" y1="12" x2="21" y2="12"\>\</line\>\<line x1="3" y1="6" x2="21" y2="6"\>\</line\>\<line x1="3" y1="18" x2="21" y2="18"\>\</line\>\</svg\>,  
  X: () \=\> \<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"\>\<line x1="18" y1="6" x2="6" y2="18"\>\</line\>\<line x1="6" y1="6" x2="18" y2="18"\>\</line\>\</svg\>,  
  Moon: () \=\> \<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"\>\<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"\>\</path\>\</svg\>,  
  Image: () \=\> \<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"\>\<rect x="3" y="3" width="18" height="18" rx="2" ry="2"\>\</rect\>\<circle cx="8.5" cy="8.5" r="1.5"\>\</circle\>\<polyline points="21 15 16 10 5 21"\>\</polyline\>\</svg\>,  
  ChevronDown: () \=\> \<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"\>\<polyline points="6 9 12 15 18 9"\>\</polyline\>\</svg\>  
};

const MOCK\_SCANS \= \[  
  { id: 1, name: 'Liam N.', time: '08:14 AM', status: 'pending' },  
  { id: 2, name: 'Noah S.', time: '08:12 AM', status: 'approved' },  
  { id: 3, name: 'Oliver B.', time: '08:10 AM', status: 'approved' },  
  { id: 4, name: 'Elijah M.', time: '08:05 AM', status: 'approved' },  
\];

function ScannerView() {  
  const \[scans, setScans\] \= useState(MOCK\_SCANS);  
  const \[isTableVisible, setIsTableVisible\] \= useState(true);

  return (  
    \<div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}\>  
        
      {/\* Top Status Bar \*/}  
      \<div style={{ padding: 'var(--spacing-md)', background: 'var(--background)', color: 'var(--foreground)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}\>  
        \<div\>  
          \<h2 style={{ fontSize: '1.2rem', margin: 0 }}\>Summer Campout\</h2\>  
          \<span style={{ fontSize: '0.8rem', color: 'var(--color-warning)' }}\>Session Active • Unsynced\</span\>  
        \</div\>  
        \<div style={{ display: 'flex', gap: '8px' }}\>  
          \<span className="badge badge-pending"\>Offline Queue: {scans.filter(s \=\> s.status \=== 'pending').length}\</span\>  
        \</div\>  
      \</div\>

      {/\* Camera Viewfinder (Top Half) \*/}  
      \<div style={{ flex: isTableVisible ? '0 0 45%' : '1', transition: 'flex 0.3s cubic-bezier(0.4, 0, 0.2, 1)', background: 'var(--muted)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}\>  
        {/\* Decorative Viewfinder Corners \*/}  
        \<div style={{ position: 'absolute', width: '250px', height: '250px', border: '2px solid var(--glass-border)' }}\>  
          \<div style={{ position: 'absolute', top: \-2, left: \-2, width: '30px', height: '30px', borderTop: '4px solid var(--color-success)', borderLeft: '4px solid var(--color-success)' }}\>\</div\>  
          \<div style={{ position: 'absolute', top: \-2, right: \-2, width: '30px', height: '30px', borderTop: '4px solid var(--color-success)', borderRight: '4px solid var(--color-success)' }}\>\</div\>  
          \<div style={{ position: 'absolute', bottom: \-2, left: \-2, width: '30px', height: '30px', borderBottom: '4px solid var(--color-success)', borderLeft: '4px solid var(--color-success)' }}\>\</div\>  
          \<div style={{ position: 'absolute', bottom: \-2, right: \-2, width: '30px', height: '30px', borderBottom: '4px solid var(--color-success)', borderRight: '4px solid var(--color-success)' }}\>\</div\>  
        \</div\>  
        \<p style={{ color: 'var(--muted-foreground)', zIndex: 1, fontWeight: 500 }}\>Point camera at ID Badge\</p\>  
      \</div\>

      {/\* Inline Table & Bottom Controls \*/}  
      \<div style={{ flex: isTableVisible ? 1 : 'none', display: 'flex', flexDirection: 'column', background: 'var(--background)', transition: 'flex 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}\>  
          
        {/\* Interactive Header to Toggle Table \*/}  
        \<div   
          onClick={() \=\> setIsTableVisible(\!isTableVisible)}  
          style={{ padding: '12px var(--spacing-md)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-bg)', cursor: 'pointer', userSelect: 'none' }}  
        \>  
          \<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}\>  
            \<h3 style={{ margin: 0, fontSize: '1rem' }}\>Recent Scans ({scans.length})\</h3\>  
            \<div style={{ transform: isTableVisible ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', color: 'var(--muted-foreground)' }}\>  
              \<Icons.ChevronDown /\>  
            \</div\>  
          \</div\>  
          \<button className="btn btn-secondary" onClick={(e) \=\> e.stopPropagation()} style={{ padding: '6px 12px', fontSize: '0.75rem' }}\>+ Manual Entry\</button\>  
        \</div\>  
          
        {/\* Scrollable list inside table \- Animated Wrapper \*/}  
        \<div style={{   
          display: 'grid',   
          gridTemplateRows: isTableVisible ? '1fr' : '0fr',  
          transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',  
          flex: isTableVisible ? 1 : 'none'  
        }}\>  
          \<div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}\>  
            \<div style={{ flex: 1, overflowY: 'auto' }}\>  
              \<table className="data-table"\>  
                \<tbody\>  
                  {scans.map(scan \=\> (  
                    \<tr key={scan.id}\>  
                      \<td style={{ fontWeight: 600 }}\>  
                        {scan.name}  
                        \<div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', fontWeight: 'normal', marginTop: '4px' }}\>  
                          {scan.time}  
                        \</div\>  
                      \</td\>  
                      \<td style={{ textAlign: 'right' }}\>  
                        \<span className={\`badge ${scan.status \=== 'approved' ? 'badge-approved' : 'badge-pending'}\`}\>  
                          {scan.status}  
                        \</span\>  
                      \</td\>  
                    \</tr\>  
                  ))}  
                \</tbody\>  
              \</table\>  
            \</div\>  
          \</div\>  
        \</div\>

        {/\* Large Bottom Controls (Locked to bottom for one-handed use) \*/}  
        \<div style={{ padding: 'var(--spacing-md)', background: 'var(--glass-bg)', borderTop: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}\>  
          \<button className="btn btn-primary" style={{ padding: '1rem', fontSize: '1rem', display: 'flex', gap: '8px' }}\>  
            \<Icons.Camera /\> Scan  
          \</button\>  
          \<button className="btn btn-secondary" style={{ padding: '1rem', fontSize: '1rem', display: 'flex', gap: '8px' }}\>  
            \<Icons.Image /\> Photo  
          \</button\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

function DashboardView() {  
  return (  
    \<div style={{ padding: 'var(--spacing-lg)', maxWidth: '1200px', margin: '0 auto' }}\>  
      \<header style={{ marginBottom: 'var(--spacing-lg)' }}\>  
        \<h1 style={{ fontSize: '2rem', fontWeight: 800 }}\>Dashboard\</h1\>  
        \<p style={{ color: 'var(--muted-foreground)' }}\>Welcome back, Troop Admin\</p\>  
      \</header\>

      {/\* Corrected Warning Banner: No auto-purge text for unsynced sessions \*/}  
      \<div style={{   
        background: 'color-mix(in srgb, var(--color-warning), transparent 85%)',   
        borderLeft: '4px solid var(--color-warning)',   
        padding: '1rem',   
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',  
        marginBottom: 'var(--spacing-lg)',  
        display: 'flex', gap: '12px', alignItems: 'flex-start'  
      }}\>  
        \<div style={{ color: 'var(--color-warning)', marginTop: '2px' }}\>\<Icons.Warning /\>\</div\>  
        \<div\>  
          \<strong style={{ color: 'var(--color-warning)', display: 'block', marginBottom: '4px' }}\>Action Required: Unsynced Session\</strong\>  
          \<p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--foreground)' }}\>  
            Session "Summer Campout" (Aug 15\) has not been synced to Trail Life Connect yet. Please review and sync when you have a stable connection.  
          \</p\>  
        \</div\>  
      \</div\>

      \<div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}\>  
        \<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}\>  
          \<div\>  
            \<h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem' }}\>Troop 0123 Overview\</h2\>  
            \<p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.9rem' }}\>Active Members: 42 • Total Sessions: 12\</p\>  
          \</div\>  
          \<button className="btn btn-primary"\>Launch Scanner\</button\>  
        \</div\>  
      \</div\>  
        
      \<div style={{ marginTop: 'var(--spacing-lg)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-lg)' }}\>  
         \<div className="glass-card" style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}\>  
            \<h3 style={{ margin: '0 0 1rem 0', color: 'var(--muted-foreground)' }}\>Recent Attendance\</h3\>  
            \<div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-primary)' }}\>86%\</div\>  
            \<p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)' }}\>Average across last 3 sessions\</p\>  
         \</div\>  
      \</div\>  
    \</div\>  
  );  
}

function SessionsView() {  
  const SESSIONS\_DATA \= \[  
    { id: 101, name: 'Summer Campout', date: 'Aug 15, 2026', status: 'pending', attendees: 38, syncedBy: '-' },  
    { id: 102, name: 'Weekly Meeting', date: 'Aug 08, 2026', status: 'synced', attendees: 41, syncedBy: 'Admin User' },  
    { id: 103, name: 'Fundraiser', date: 'Aug 01, 2026', status: 'synced', attendees: 25, syncedBy: 'Admin User' },  
  \];

  return (  
    \<div style={{ padding: 'var(--spacing-lg)', maxWidth: '1200px', margin: '0 auto' }}\>  
      \<header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}\>  
        \<div\>  
          \<h1 style={{ fontSize: '2rem', fontWeight: 800 }}\>Sessions\</h1\>  
          \<p style={{ color: 'var(--muted-foreground)' }}\>Manage scanning sessions and sync status.\</p\>  
        \</div\>  
        \<button className="btn btn-primary"\>+ New Session\</button\>  
      \</header\>

      \<div className="glass-card" style={{ overflowX: 'auto' }}\>  
        {/\* DataTable Top Bar (Filters/Search Mock) \*/}  
        \<div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: '1rem' }}\>  
          \<input   
            type="text"   
            placeholder="Search sessions..."   
            style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--background)', color: 'var(--foreground)', flex: 1, maxWidth: '300px' }}  
          /\>  
        \</div\>

        \<table className="data-table"\>  
          \<thead\>  
            \<tr\>  
              \<th\>Event Name ↑\</th\>  
              \<th\>Date\</th\>  
              \<th\>Status\</th\>  
              \<th\>Attendees\</th\>  
              \<th\>Synced By\</th\>  
              \<th style={{ textAlign: 'right' }}\>Actions\</th\>  
            \</tr\>  
          \</thead\>  
          \<tbody\>  
            {SESSIONS\_DATA.map(s \=\> (  
              \<tr key={s.id} className="table-row-hover"\>  
                \<td style={{ fontWeight: 600, color: 'var(--color-primary)' }}\>{s.name}\</td\>  
                \<td\>{s.date}\</td\>  
                \<td\>  
                  {s.status \=== 'synced'   
                    ? \<span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}\>\<Icons.Check/\> Synced\</span\>  
                    : \<span style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '4px' }}\>⏳ Pending\</span\>  
                  }  
                \</td\>  
                \<td\>{s.attendees}\</td\>  
                \<td style={{ color: 'var(--muted-foreground)' }}\>{s.syncedBy}\</td\>  
                \<td style={{ textAlign: 'right' }}\>  
                  {s.status \=== 'pending' ? (  
                    \<button className="btn btn-destructive" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}\>End Session\</button\>  
                  ) : (  
                    \<button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}\>Reset Sync\</button\>  
                  )}  
                \</td\>  
              \</tr\>  
            ))}  
          \</tbody\>  
        \</table\>  
      \</div\>  
    \</div\>  
  );  
}

export default function App() {  
  const \[role, setRole\] \= useState('badge\_scanner'); // 'badge\_scanner' or 'troop\_admin'  
  const \[activeTab, setActiveTab\] \= useState('scanner');  
  const \[isDark, setIsDark\] \= useState(false);

  useEffect(() \=\> {  
    const styleTag \= document.createElement('style');  
    styleTag.innerHTML \= globalCss;  
    document.head.appendChild(styleTag);  
    return () \=\> document.head.removeChild(styleTag);  
  }, \[\]);

  // Enforce role-based routing constraint  
  useEffect(() \=\> {  
    if (role \=== 'badge\_scanner') setActiveTab('scanner');  
    else if (role \=== 'troop\_admin' && activeTab \=== 'scanner') setActiveTab('dashboard');  
  }, \[role\]);

  return (  
    \<div className={isDark ? 'dark' : ''} style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}\>  
        
      {/\* Dev Tool: Role & Theme Switcher (Not part of real app, just for prototype demo) \*/}  
      \<div style={{ background: 'var(--color-primary)', color: '\#fff', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', zIndex: 1000 }}\>  
        \<div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}\>  
          \<strong\>PROTOTYPE CONTROLS:\</strong\>  
          \<label style={{ display: 'flex', gap: '4px', cursor: 'pointer' }}\>  
            \<input type="radio" checked={role \=== 'badge\_scanner'} onChange={() \=\> setRole('badge\_scanner')} /\>   
            Badge Scanner (Scanner Only)  
          \</label\>  
          \<label style={{ display: 'flex', gap: '4px', cursor: 'pointer' }}\>  
            \<input type="radio" checked={role \=== 'troop\_admin'} onChange={() \=\> setRole('troop\_admin')} /\>   
            Troop Admin (Full App)  
          \</label\>  
        \</div\>  
        \<button onClick={() \=\> setIsDark(\!isDark)} style={{ background: 'none', border: 'none', color: '\#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}\>  
          \<Icons.Moon /\> {isDark ? 'Light' : 'Dark'} Mode  
        \</button\>  
      \</div\>

      \<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}\>  
          
        {/\* Sidebar Nav (Only visible to admins) \*/}  
        {role \=== 'troop\_admin' && (  
          \<nav style={{ width: '240px', borderRight: '1px solid var(--glass-border)', background: 'var(--glass-bg)', display: 'flex', flexDirection: 'column', padding: 'var(--spacing-lg) var(--spacing-md)' }}\>  
            \<h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', marginBottom: '2rem', padding: '0 12px' }}\>TLC Attendance\</h2\>  
              
            \<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}\>  
              {\['dashboard', 'sessions', 'scanner'\].map(tab \=\> (  
                \<button   
                  key={tab}  
                  onClick={() \=\> setActiveTab(tab)}  
                  style={{  
                    textAlign: 'left', padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,  
                    background: activeTab \=== tab ? 'var(--color-primary)' : 'transparent',  
                    color: activeTab \=== tab ? '\#fff' : 'var(--foreground)'  
                  }}  
                \>  
                  {tab.charAt(0).toUpperCase() \+ tab.slice(1)}  
                \</button\>  
              ))}  
            \</div\>  
          \</nav\>  
        )}

        {/\* Main Content Area \*/}  
        \<main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-gradient)' }}\>  
          {activeTab \=== 'scanner' && \<ScannerView /\>}  
          {activeTab \=== 'dashboard' && \<DashboardView /\>}  
          {activeTab \=== 'sessions' && \<SessionsView /\>}  
        \</main\>  
      \</div\>  
    \</div\>  
  );  
}  
