import React from 'react';
import { Box, Button, Container, Typography, Stack, Paper } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import StyleIcon from '@mui/icons-material/Style';
import GroupIcon from '@mui/icons-material/Group';
import BoltIcon from '@mui/icons-material/Bolt';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Landing() {
  const { teacher, loading } = useAuth();
  if (!loading && teacher) return <Navigate to="/dashboard" replace />;

  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      sx={{ background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }}
    >
      <Container maxWidth="sm">
        <Stack spacing={4} alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <StyleIcon sx={{ color: '#FF8F00', fontSize: 48 }} />
            <Typography variant="h3" fontWeight={800} color="white">
              King's Cards
            </Typography>
          </Stack>

          <Typography variant="h6" color="rgba(255,255,255,0.85)" textAlign="center">
            Real-time memory card games for the classroom
          </Typography>

          <Paper elevation={4} sx={{ p: 4, borderRadius: 3, width: '100%' }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={2} alignItems="center">
                <SchoolIcon color="primary" />
                <Typography>Teachers create games and share a join link</Typography>
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center">
                <GroupIcon color="primary" />
                <Typography>Students join with no sign-up required</Typography>
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center">
                <BoltIcon color="primary" />
                <Typography>Cards sync in real-time for everyone</Typography>
              </Stack>

              <Button
                variant="contained"
                size="large"
                href="/api/auth/google"
                fullWidth
                sx={{ mt: 1, py: 1.5, fontSize: '1rem' }}
                startIcon={
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    width={20}
                    height={20}
                  />
                }
              >
                Sign in with Google
              </Button>

              <Typography variant="caption" color="text.secondary" textAlign="center">
                For teachers only — contact your administrator to get access
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
