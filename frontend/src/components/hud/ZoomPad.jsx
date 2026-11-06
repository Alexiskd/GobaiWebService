import { useCallback, useEffect, useRef } from 'react';
import { Paper, Tooltip, IconButton, Divider } from '@mui/material';
import { useViewport } from '@/hooks/useViewport';
import { edge } from '@/theme/layout';
import { AddIcon, RemoveIcon } from '../ui/icons';

const HOLD_INTERVAL_MS = 65;

export function ZoomPad({ onZoom }) {
  const { compact } = useViewport();
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = (factor) => (e) => {
    // Clic droit ignoré ; le doigt reste capturé même s'il glisse hors du bouton.
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stop();
    onZoom(factor);
    timer.current = setInterval(() => onZoom(factor), HOLD_INTERVAL_MS);
  };

  const onKeyDown = (factor) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onZoom(factor);
    }
  };

  useEffect(() => {
    const events = ['pointerup', 'pointercancel'];
    events.forEach((t) => window.addEventListener(t, stop));
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      stop();
      events.forEach((t) => window.removeEventListener(t, stop));
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [stop]);

  const common = {
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    // Empêche le menu contextuel / la loupe sur appui long (iOS, Android).
    onContextMenu: (e) => e.preventDefault(),
  };

  const button = (factor, label, Icon) => (
    <Tooltip title={label} placement="left">
      <IconButton
        size="large"
        aria-label={label}
        onPointerDown={start(factor)}
        onKeyDown={onKeyDown(factor)}
        {...common}
        sx={{ borderRadius: 0, width: 48, height: 48, touchAction: 'none' }}
      >
        <Icon />
      </IconButton>
    </Tooltip>
  );

  return (
    <Paper
      elevation={4}
      role="group"
      aria-label="Contrôles de zoom"
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.hud, right: edge('right', compact ? 8 : 14), top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {button(0.94, 'Maintenir pour zoomer', AddIcon)}
      <Divider />
      {button(1.064, 'Maintenir pour dézoomer', RemoveIcon)}
    </Paper>
  );
}
