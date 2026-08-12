import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { RosterList } from '../components/RosterList';

export function Roster() {
  const { troopNumber, tab } = useParams();
  const navigate = useNavigate();
  const { user, session: authSession } = useAuth();
  const { 
    selectedTroopId, 
    selectedTroop, 
    selectedTroopIdentifier, 
    selectTroopByNumberOrId, 
    isGlobalAdmin, 
    loadingTroops 
  } = useTroop();

  const activeTab = tab === 'leaders' ? 'leaders' : 'members';
  const userId = authSession?.user?.id || 'anonymous';

  // Sync TroopContext with URL parameter when troopNumber is present in URL
  useEffect(() => {
    if (loadingTroops) return;
    if (troopNumber) {
      selectTroopByNumberOrId(troopNumber);
    }
  }, [troopNumber, loadingTroops]);

  // If URL lacks troopNumber (legacy /roster/members), redirect to troop-scoped URL once troops are loaded
  useEffect(() => {
    if (loadingTroops || !selectedTroopIdentifier) return;
    if (!troopNumber) {
      navigate(`/troop/${selectedTroopIdentifier}/roster/${activeTab}`, { replace: true });
    }
  }, [troopNumber, selectedTroopIdentifier, activeTab, loadingTroops, navigate]);

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

  const currentTroopIdentifier = selectedTroopIdentifier || selectedTroopId;

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--foreground)', margin: 0 }}>Roster &amp; Invites</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
          Manage members for Troop {selectedTroop?.troop_number}
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div className="roster-tabs" role="tablist" aria-label="Roster sections" style={{ marginBottom: '1.5rem' }}>
          <button
            role="tab"
            aria-selected={activeTab === 'members'}
            aria-controls="roster-tabpanel"
            id="roster-tab-members"
            className={`roster-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => navigate(`/troop/${currentTroopIdentifier}/roster/members`)}
          >
            Members
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'leaders'}
            aria-controls="roster-tabpanel"
            id="roster-tab-leaders"
            className={`roster-tab ${activeTab === 'leaders' ? 'active' : ''}`}
            onClick={() => navigate(`/troop/${currentTroopIdentifier}/roster/leaders`)}
          >
            Leaders
          </button>
        </div>

        <div id="roster-tabpanel" role="tabpanel" aria-labelledby={`roster-tab-${activeTab}`}>
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
    </div>
  );
}
