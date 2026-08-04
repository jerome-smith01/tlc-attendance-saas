import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { RosterList } from '../components/RosterList';
import { InviteUser } from '../components/InviteUser';

export function Roster() {
  const { user } = useAuth();
  const { selectedTroopId, selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();

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
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--foreground)' }}>Roster & Invites</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>
          Manage members for Troop {selectedTroop?.troop_number}
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <InviteUser troopId={selectedTroopId} />
        
        <RosterList 
          troopId={selectedTroopId} 
          currentUserRole={selectedTroop?.currentUserRole}
          currentUserId={user?.id}
          isGlobalAdmin={isGlobalAdmin}
        />
      </div>
    </div>
  );
}
