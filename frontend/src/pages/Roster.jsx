import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { RosterList } from '../components/RosterList';

export function Roster() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { user, session: authSession } = useAuth();
  const { selectedTroopId, selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();
  const activeTab = tab === 'leaders' ? 'leaders' : 'members';
  const userId = authSession?.user?.id || 'anonymous';

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
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--foreground)', margin: 0 }}>Roster &amp; Invites</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
          Manage members for Troop {selectedTroop?.troop_number}
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div className="roster-tabs" style={{ marginBottom: '1.5rem' }}>
          <button
            className={`roster-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => navigate('/roster/members')}
          >
            Members
          </button>
          <button
            className={`roster-tab ${activeTab === 'leaders' ? 'active' : ''}`}
            onClick={() => navigate('/roster/leaders')}
          >
            Leaders
          </button>
        </div>

        <RosterList
          troopId={selectedTroopId}
          currentUserRole={selectedTroop?.currentUserRole}
          currentUserId={user?.id}
          isGlobalAdmin={isGlobalAdmin}
          activeTab={activeTab}
          userId={userId}
        />
      </div>
    </div>
  );
}
