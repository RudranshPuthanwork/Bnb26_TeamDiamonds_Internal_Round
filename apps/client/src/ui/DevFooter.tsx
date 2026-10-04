import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './DevFooter.module.css';
import { mockApi } from '../api/mockApi';
import { COPY } from '../copy';

export interface DevFooterProps {
  className?: string;
}

export const DevFooter: React.FC<DevFooterProps> = ({ className = '' }) => {
  const [failNext, setFailNext] = useState(mockApi.isFailNextWrite());

  const handleToggle = () => {
    const nextState = mockApi.toggleFailNextWrite();
    setFailNext(nextState);
  };

  return (
    <footer className={`${styles.footer} ${className}`.trim()}>
      <div className={styles.links}>
        <Link to="/">{COPY.nav.register}</Link>
        <Link to="/create">{COPY.nav.create}</Link>
        <Link to="/guardians">{COPY.nav.guardians}</Link>
        <Link to="/changes">{COPY.nav.changes}</Link>
        <Link to="/dev/states">{COPY.nav.devStates}</Link>
        <Link to="/dev/tokens">{COPY.nav.devTokens}</Link>
      </div>
      <div>
        <button
          type="button"
          onClick={handleToggle}
          className={`${styles.toggleBtn} ${failNext ? styles.failActive : ''}`.trim()}
          title={COPY.dev.toggleNotice}
        >
          {failNext ? COPY.dev.failNextOn : COPY.dev.failNextOff}
        </button>
      </div>
    </footer>
  );
};
