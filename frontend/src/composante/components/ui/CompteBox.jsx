import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  ArrowForwardRounded,
  CheckCircleRounded,
  LanguageRounded,
  LockOutlined,
  PersonOutlineRounded,
  SecurityRounded,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

/**
 * Espace de compte partagé entre la Boutique et Contribuer.
 * Le JWT reste dans un cookie HttpOnly : le composant ne reçoit qu'un profil public et un marqueur de session.
 */
export function CompteBox({ compte, hint = 'Connectez-vous pour publier un placement et voter.' }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (compte.busy) return;
    if (await compte.submit(mode, name.trim(), password)) {
      setName('');
      setPassword('');
      setShowPassword(false);
    }
  };

  if (compte.session) {
    const accountName = compte.session.account?.name || 'Compte Gobai Space';
    return (
      <Paper
        variant="outlined"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          p: { xs: 2, sm: 2.5 },
          borderRadius: 4,
          background: 'linear-gradient(130deg, rgba(90,217,179,0.10), rgba(139,174,255,0.09) 58%, rgba(179,154,255,0.08))',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <Avatar sx={{ width: 46, height: 46, flex: 'none', bgcolor: 'success.main' }}>
              <CheckCircleRounded />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
                <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Session active</Typography>
                <Chip size="small" color="success" variant="outlined" label="Connecté" />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                Connecté comme <Box component="strong" sx={{ color: 'text.primary' }}>{accountName}</Box>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Session protégée par cookie HttpOnly
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="outlined"
            color="inherit"
            onClick={compte.logout}
            disabled={compte.busy}
            sx={{ flex: 'none', borderColor: 'divider' }}
          >
            Se déconnecter
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      component="form"
      onSubmit={onSubmit}
      variant="outlined"
      noValidate
      sx={{
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        display: 'grid',
        gap: { xs: 2, sm: 2.4 },
        p: { xs: 2, sm: 3 },
        borderRadius: 4,
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(145deg, rgba(25,42,76,0.94), rgba(9,15,30,0.96) 62%, rgba(35,25,64,0.88))'
          : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(235,241,251,0.98) 62%, rgba(244,239,255,0.94))',
        boxShadow: '0 18px 50px rgba(0,0,0,0.16)',
        '&::before': {
          content: '""',
          position: 'absolute',
          zIndex: -1,
          width: 240,
          height: 240,
          top: -155,
          right: -75,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,174,255,0.30), rgba(139,174,255,0) 70%)',
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          zIndex: -1,
          width: 210,
          height: 210,
          bottom: -165,
          left: -95,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(179,154,255,0.18), rgba(179,154,255,0) 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Avatar
            variant="rounded"
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              background: 'linear-gradient(135deg, #AFC5FF, #8BAEFF 54%, #B39AFF)',
              color: '#101A31',
            }}
          >
            <LanguageRounded />
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 850, letterSpacing: '0.13em' }}>GOBAI SPACE</Typography>
            <Typography variant="caption" color="text.secondary">Identité numérique unifiée</Typography>
          </Box>
        </Stack>
        <Chip
          size="small"
          variant="outlined"
          icon={<SecurityRounded sx={{ fontSize: '15px !important' }} />}
          label="Connexion sécurisée"
          sx={{ borderColor: 'divider', bgcolor: 'action.hover' }}
        />
      </Stack>

      <Box sx={{ display: 'grid', gap: 0.7 }}>
        <Typography component="h2" variant="h3" sx={{ fontSize: { xs: '1.45rem', sm: '1.75rem' } }}>
          {mode === 'login' ? 'Ravi de vous revoir.' : 'Créez votre espace.'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
          {mode === 'login'
            ? hint
            : 'Un pseudonyme et un mot de passe suffisent pour créer votre compte Gobai Space.'}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 1 }}>
        <ToggleButtonGroup
          fullWidth
          exclusive
          size="large"
          color="primary"
          value={mode}
          onChange={(_, value) => {
            if (value) {
              setMode(value);
              compte.setError('');
            }
          }}
          aria-label="Mode du compte"
          sx={{
            p: 0.5,
            gap: 0.5,
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
            '& .MuiToggleButton-root': {
              flex: 1,
              minHeight: 40,
              border: 0,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'text.primary',
                bgcolor: 'background.paper',
                boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              },
              '&.Mui-selected:hover': { bgcolor: 'background.paper' },
            },
          }}
        >
          <ToggleButton value="login">Connexion</ToggleButton>
          <ToggleButton value="signup">Créer un compte</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Stack spacing={1.6}>
        <TextField
          label="Pseudonyme"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="username"
          required
          slotProps={{
            htmlInput: { maxLength: 24, minLength: 3, autoCapitalize: 'none', spellCheck: false },
            input: {
              startAdornment: <InputAdornment position="start"><PersonOutlineRounded fontSize="small" /></InputAdornment>,
            },
          }}
        />
        <TextField
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          slotProps={{
            htmlInput: { maxLength: 200, minLength: 8 },
            input: {
              startAdornment: <InputAdornment position="start"><LockOutlined fontSize="small" /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    tabIndex={0}
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      {compte.error && (
        <Alert severity="error" role="alert" sx={{ overflowWrap: 'anywhere' }}>
          {compte.error}
        </Alert>
      )}

      <Stack spacing={1.15}>
        <Button
          type="submit"
          fullWidth
          size="large"
          variant="contained"
          endIcon={compte.busy ? undefined : <ArrowForwardRounded />}
          disabled={compte.busy || name.trim().length < 3 || password.length < 8}
          sx={{ minHeight: 50, fontSize: '0.92rem' }}
        >
          {compte.busy
            ? <CircularProgress size={21} thickness={5} color="inherit" />
            : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </Button>
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.8}>
          <SecurityRounded sx={{ fontSize: 15, color: 'success.main' }} />
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Session stockée dans un cookie HttpOnly, inaccessible à JavaScript.
          </Typography>
        </Stack>
      </Stack>

      <Divider sx={{ borderStyle: 'dashed' }} />
      <Typography variant="caption" color="text.secondary" textAlign="center">
        Un seul compte pour votre boutique, vos achats et vos contributions LiDAR.
      </Typography>
    </Paper>
  );
}
