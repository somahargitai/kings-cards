import React, { useState } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../services/api';

export default function Profile() {
  const { teacher, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(teacher?.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await profileApi.update(nickname);
      await refreshAuth();
      setSuccess(true);
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box minHeight="100vh" bgcolor="background.default">
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => navigate('/dashboard')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>Profile</Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Stack spacing={3} alignItems="center">
            {teacher?.avatarUrl ? (
              <Avatar src={teacher.avatarUrl} sx={{ width: 80, height: 80 }} />
            ) : (
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 32 }}>
                {teacher?.displayName?.[0]}
              </Avatar>
            )}
            <Typography variant="h6">{teacher?.displayName}</Typography>
            <Typography color="text.secondary">{teacher?.email}</Typography>
          </Stack>

          <Box mt={4}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              In-game Nickname
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                helperText="Shown to students during the game"
              />
              <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ minWidth: 80 }}>
                {saving ? <CircularProgress size={20} /> : 'Save'}
              </Button>
            </Stack>
            {success && <Alert severity="success" sx={{ mt: 2 }}>Saved!</Alert>}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
