import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { RosterList } from '../components/RosterList';

export function Roster() {
  const { session: authSession } = useAuth();
  const userId = authSession?.user?.id || 'anonymous';
  const { selectedTroopId, selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();
  const [activeTab, setActiveTab] = useState('leaders');

  if (loadingTroops) {
    return <div style={{ padding: '2rem' }}>Loading roster...</div>;
  }

  if (!selectedTroopId) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>No Troop Selected</h2>
        <p>Please select a troop from the top navigation bar to view its roster.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--foreground)' }}>Roster & Invites</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage members for Troop {selectedTroop?.troop_number}
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="roster-tabs">
          <button 
            className={`roster-tab ${activeTab === 'leaders' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaders')}
          >
            Leaders
          </button>
          <button 
            className={`roster-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members
          </button>
        </div>

        <RosterList 
          troopId={selectedTroopId} 
          currentUserRole={selectedTroop?.currentUserRole}
          currentUserId={userId}
          isGlobalAdmin={isGlobalAdmin}
          activeTab={activeTab}
        />
      </div>
    </div>
  );
}

