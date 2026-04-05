import React from 'react';
import { Box, Button, Container, Typography, Paper, Stack } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgcolor="background.default"
    >
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Stack spacing={3} alignItems="center">
            <LockIcon sx={{ fontSize: 64, color: 'error.main' }} />
            <Typography variant="h4" fontWeight={700}>
              Access Denied
            </Typography>
            <Typography color="text.secondary">
              Your Google account is not authorised to use King's Cards. This app is for registered
              teachers only.
            </Typography>
            <Typography color="text.secondary">
              Contact your school administrator to be added to the allowed list.
            </Typography>
            <Button variant="contained" component={Link} to="/">
              Back to Home
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
