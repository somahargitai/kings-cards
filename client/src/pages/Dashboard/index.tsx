import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fab,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StyleIcon from '@mui/icons-material/Style';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gamesApi, GameSummary } from '../../services/api';

export default function Dashboard() {
  const { teacher, logout } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<GameSummary | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    gamesApi.list().then(setGames).finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await gamesApi.delete(deleteTarget.id);
    setGames((prev) => prev.filter((g) => g.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleStart = async (gameId: string) => {
    const session = await gamesApi.createSession(gameId);
    navigate(`/games/${gameId}/session`, { state: session });
  };

  return (
    <Box minHeight="100vh" bgcolor="background.default">
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <StyleIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            King's Cards
          </Typography>
          <Tooltip title={teacher?.displayName ?? ''}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
              {teacher?.avatarUrl ? (
                <Avatar src={teacher.avatarUrl} sx={{ width: 32, height: 32 }} />
              ) : (
                <AccountCircleIcon />
              )}
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>Profile</MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); logout(); navigate('/'); }}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">My Games</Typography>
        </Stack>

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : games.length === 0 ? (
          <Box textAlign="center" py={10}>
            <StyleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No games yet
            </Typography>
            <Typography color="text.secondary" mb={3}>
              Create your first memory card game
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/games/new')}>
              Create Game
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {games.map((game) => (
              <Grid item xs={12} sm={6} md={4} key={game.id}>
                <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" noWrap gutterBottom>
                      {game.title}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      <Chip label={`${game.cardPairCount} pairs`} size="small" color="primary" variant="outlined" />
                      <Chip label={`${game.config.rows}×${game.config.cols}`} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                      Updated {new Date(game.updatedAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<PlayArrowIcon />}
                      variant="contained"
                      onClick={() => handleStart(game.id)}
                    >
                      Start
                    </Button>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => navigate(`/games/${game.id}/edit`)}
                    >
                      Edit
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteTarget(game)}
                      sx={{ ml: 'auto' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Fab
        color="secondary"
        sx={{ position: 'fixed', bottom: 32, right: 32 }}
        onClick={() => navigate('/games/new')}
      >
        <AddIcon />
      </Fab>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Game</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{deleteTarget?.title}"? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
