import React, { useEffect, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import { gamesApi } from '../../services/api';
import type { CardPairInput, CreateGameInput } from 'shared/types';
import { FLIP_DELAY_OPTIONS } from '../../constants/flipDelay';

export default function GameEditor() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [flipDelay, setFlipDelay] = useState(3000);
  const [pairs, setPairs] = useState<CardPairInput[]>([]);

  const totalCells = rows * cols;
  const isEvenGrid = totalCells % 2 === 0;
  const requiredPairs = isEvenGrid ? totalCells / 2 : 0;

  // Sync pairs array length to requiredPairs
  useEffect(() => {
    if (!isEvenGrid) return;
    setPairs((prev) => {
      if (prev.length === requiredPairs) return prev;
      if (prev.length < requiredPairs) {
        return [
          ...prev,
          ...Array.from({ length: requiredPairs - prev.length }, (_, i) => ({
            pairIndex: prev.length + i,
            cardAContent: '',
            cardBContent: '',
            contentType: 'text' as const,
          })),
        ];
      }
      return prev.slice(0, requiredPairs).map((p, i) => ({ ...p, pairIndex: i }));
    });
  }, [requiredPairs, isEvenGrid]);

  useEffect(() => {
    if (!id) return;
    gamesApi.get(id).then((game) => {
      setTitle(game.title);
      setRows(game.config.rows);
      setCols(game.config.cols);
      setFlipDelay(game.config.defaultFlipBackDelay);
      setPairs(
        game.cardPairs.map((p) => ({
          pairIndex: p.pairIndex,
          cardAContent: p.cardAContent,
          cardBContent: p.cardBContent,
          contentType: p.contentType as 'text',
        })),
      );
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!isEvenGrid) { setError('Grid must have an even number of cells'); return; }
    if (pairs.some((p) => !p.cardAContent.trim() || !p.cardBContent.trim())) {
      setError('All card pairs must have content on both sides');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const data: CreateGameInput = {
        title: title.trim(),
        gameType: 'memory_cards',
        config: { rows, cols, defaultFlipBackDelay: flipDelay },
        cardPairs: pairs,
      };
      if (isEdit && id) {
        await gamesApi.update(id, data);
      } else {
        await gamesApi.create(data);
      }
      navigate('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Failed to save game');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box minHeight="100vh" bgcolor="background.default">
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => navigate('/dashboard')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {isEdit ? 'Edit Game' : 'New Game'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Game Details</Typography>
            <Stack spacing={2}>
              <TextField
                label="Game Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                required
              />
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Rows</InputLabel>
                    <Select value={rows} label="Rows" onChange={(e) => setRows(Number(e.target.value))}>
                      {[2,3,4,5,6].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Columns</InputLabel>
                    <Select value={cols} label="Columns" onChange={(e) => setCols(Number(e.target.value))}>
                      {[2,3,4,5,6,7,8].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Flip-back Delay</InputLabel>
                    <Select value={flipDelay} label="Flip-back Delay" onChange={(e) => setFlipDelay(Number(e.target.value))}>
                      {FLIP_DELAY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              {!isEvenGrid && (
                <Alert severity="warning">
                  {rows}×{cols} = {totalCells} cells — must be an even number
                </Alert>
              )}
              {isEvenGrid && (
                <Typography variant="body2" color="text.secondary">
                  {rows}×{cols} grid = {requiredPairs} pairs needed
                </Typography>
              )}
            </Stack>
          </Paper>

          {isEvenGrid && (
            <Paper elevation={1} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Card Pairs</Typography>
              <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid item xs={1}><Typography variant="caption" color="text.secondary">#</Typography></Grid>
                <Grid item xs={5.5}><Typography variant="caption" color="text.secondary">Card A</Typography></Grid>
                <Grid item xs={5.5}><Typography variant="caption" color="text.secondary">Card B</Typography></Grid>
              </Grid>
              <Stack spacing={1}>
                {pairs.map((pair, i) => (
                  <Grid container spacing={1} key={i} alignItems="center">
                    <Grid item xs={1}>
                      <Typography variant="body2" color="text.secondary">{i + 1}</Typography>
                    </Grid>
                    <Grid item xs={5.5}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={`Card A`}
                        value={pair.cardAContent}
                        onChange={(e) => {
                          const updated = [...pairs];
                          updated[i] = { ...updated[i], cardAContent: e.target.value };
                          setPairs(updated);
                        }}
                      />
                    </Grid>
                    <Grid item xs={5.5}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={`Card B`}
                        value={pair.cardBContent}
                        onChange={(e) => {
                          const updated = [...pairs];
                          updated[i] = { ...updated[i], cardBContent: e.target.value };
                          setPairs(updated);
                        }}
                      />
                    </Grid>
                  </Grid>
                ))}
              </Stack>
            </Paper>
          )}

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={() => navigate('/dashboard')}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save Game'}
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
