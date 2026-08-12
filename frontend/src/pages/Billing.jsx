import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTroop } from '../context/TroopContext';

export function Billing() {
  const { troopNumber } = useParams();
  const navigate = useNavigate();
  const { 
    selectedTroopId, 
    selectedTroop, 
    selectedTroopIdentifier, 
    selectTroopByNumberOrId, 
    loadingTroops 
  } = useTroop();

  // Sync TroopContext with URL parameter when troopNumber is present in URL
  useEffect(() => {
    if (loadingTroops) return;
    if (troopNumber) {
      selectTroopByNumberOrId(troopNumber);
    }
  }, [troopNumber, loadingTroops]);

  // If URL lacks troopNumber (legacy /billing), redirect to troop-scoped URL once troops are loaded
  useEffect(() => {
    if (loadingTroops || !selectedTroopIdentifier) return;
    if (!troopNumber) {
      navigate(`/troop/${selectedTroopIdentifier}/billing`, { replace: true });
    }
  }, [troopNumber, selectedTroopIdentifier, loadingTroops, navigate]);

  if (loadingTroops) {
    return <div style={{ padding: '2rem' }}>Loading Billing...</div>;
  }

  if (!selectedTroopId) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>No Troop Selected</h2>
        <p>Please select a troop from the top navigation bar to view its billing information.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--foreground)' }}>Billing</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage subscription and billing for Troop {selectedTroop?.troop_number}
        </p>
      </header>

      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Billing coming soon</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Subscription management, payment methods, and invoice history will be available here in a future update.
        </p>
      </div>
    </div>
  );
}
