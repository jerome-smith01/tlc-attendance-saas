import React from 'react';
import { useTroop } from '../context/TroopContext';

export function Billing() {
  const { selectedTroopId, selectedTroop } = useTroop();

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
        <p style={{ color: 'var(--muted-foreground)' }}>
          Manage subscription and billing for Troop {selectedTroop?.troop_number}
        </p>
      </header>

      <div style={{ border: '1px solid var(--border-color)', padding: '2rem', borderRadius: '8px', backgroundColor: 'var(--glass-bg)', textAlign: 'center' }}>
        <h2>Billing coming soon</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Subscription management, payment methods, and invoice history will be available here in a future update.
        </p>
      </div>
    </div>
  );
}
