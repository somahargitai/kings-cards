import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StyleIcon from '@mui/icons-material/Style';
import { useParams } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { useSocketContext } from '../../context/SocketContext';
import CardGrid from '../../components/CardGrid';
import SolvedPile from '../../components/SolvedPile';
import type { GameSessionState, BoardCard, Participant } from 'shared/types';

type Phase = 'entry' | 'waiting' | 'active' | 'completed' | 'abandoned' | 'error';

export default function JoinGame() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const { connect, disconnect } = useSocketContext();
  const socketRef = useRef<Socket | null>(null);

  const [phase, setPhase] = useState<Phase>('entry');
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [gameTitle, setGameTitle] = useState('');

  const [board, setBoard] = useState<BoardCard[]>([]);
  const [gameState, setGameState] = useState<Partial<GameSessionState>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [stats, setStats] = useState<{ totalPairs: number; totalFlips: number; duration: number } | null>(null);

  const setupSocketListeners = (socket: Socket) => {
    socket.on('session:state', (state: GameSessionState) => {
      setGameState(state);
      setBoard(state.board);
      setParticipants(state.participants);
      setGameTitle(state.gameTitle);
      if (state.status === 'active') setPhase('active');
      else setPhase('waiting');
    });

    socket.on('player:joined', () => {});
    socket.on('player:left', () => {});

    socket.on('game:started', ({ board: newBoard }: { board: BoardCard[] }) => {
      setBoard(newBoard);
      setPhase('active');
    });

    socket.on('card:flipped', ({ cardIndex, content }: { cardIndex: number; content: string }) => {
      setBoard((prev) =>
        prev.map((c) => (c.index === cardIndex ? { ...c, state: 'face_up', content } : c)),
      );
    });

    socket.on('card:match', ({ cardIndex1, cardIndex2, pairIndex }: any) => {
      setBoard((prev) =>
        prev.map((c) =>
          c.index === cardIndex1 || c.index === cardIndex2
            ? { ...c, state: 'matched', pairIndex }
            : c,
        ),
      );
      setGameState((prev) => ({ ...prev, matchedPairs: (prev.matchedPairs ?? 0) + 1 }));
    });

    socket.on('cards:flip_back', ({ cardIndex1, cardIndex2 }: { cardIndex1: number; cardIndex2: number }) => {
      setBoard((prev) =>
        prev.map((c) =>
          c.index === cardIndex1 || c.index === cardIndex2
            ? { ...c, state: 'face_down', content: undefined }
            : c,
        ),
      );
    });

    socket.on('settings:updated', ({ flipBackDelay }: { flipBackDelay: number }) => {
      setGameState((prev) => ({ ...prev, flipBackDelay }));
    });

    socket.on('game:completed', (data: { totalPairs: number; totalFlips: number; duration: number }) => {
      setStats(data);
      setPhase('completed');
    });

    socket.on('game:abandoned', () => setPhase('abandoned'));

    socket.on('error', ({ message }: { code: string; message: string }) => {
      setErrorMsg(message);
      setPhase('error');
    });
  };

  const handleJoin = () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      setNicknameError('Nickname must be 1–50 characters');
      return;
    }
    setNicknameError('');

    const socket = connect();
    socketRef.current = socket;
    setupSocketListeners(socket);

    socket.emit('student:join', { joinCode: joinCode?.toUpperCase(), nickname: trimmed });
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const handleCardClick = (cardIndex: number) => {
    socketRef.current?.emit('card:flip', { cardIndex });
  };

  if (phase === 'entry') {
    return (
      <Box
        minHeight="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor="background.default"
      >
        <Container maxWidth="xs">
          <Paper elevation={3} sx={{ p: 4 }}>
            <Stack spacing={3} alignItems="center">
              <StyleIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              <Typography variant="h5" fontWeight={700}>
                Join Game
              </Typography>
              <Typography color="text.secondary" textAlign="center">
                Join code: <strong>{joinCode?.toUpperCase()}</strong>
              </Typography>
              <TextField
                label="Your Nickname"
                fullWidth
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                error={Boolean(nicknameError)}
                helperText={nicknameError}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                autoFocus
              />
              <Button variant="contained" size="large" fullWidth onClick={handleJoin}>
                Join Game
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (phase === 'error') {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <Container maxWidth="xs">
          <Alert severity="error">{errorMsg || 'Something went wrong'}</Alert>
        </Container>
      </Box>
    );
  }

  if (phase === 'waiting') {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="background.default">
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: 4 }}>
            <Stack spacing={3} alignItems="center">
              <CircularProgress />
              <Typography variant="h6">Waiting for the teacher to start...</Typography>
              <Typography color="text.secondary">{gameTitle}</Typography>
              <Paper variant="outlined" sx={{ p: 2, width: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>Players</Typography>
                <List dense>
                  {participants.filter((p) => p.connected).map((p, i) => (
                    <ListItem key={i} disableGutters>
                      <ListItemText primary={p.nickname} secondary={p.role} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (phase === 'completed' || phase === 'abandoned') {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="background.default">
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              {phase === 'completed' ? '🎉 Congratulations!' : 'Game Over'}
            </Typography>
            {stats && phase === 'completed' && (
              <Stack spacing={1} my={3}>
                <Typography>All {stats.totalPairs} pairs found!</Typography>
                <Typography>Total flips: {stats.totalFlips}</Typography>
                <Typography>Time: {Math.round(stats.duration / 1000)}s</Typography>
              </Stack>
            )}
            <Typography color="text.secondary" mt={2}>
              Thanks for playing, {nickname}!
            </Typography>
          </Paper>
        </Container>
      </Box>
    );
  }

  // Active game
  return (
    <Box minHeight="100vh" bgcolor="background.default" display="flex" flexDirection="column">
      <Box bgcolor="primary.main" color="white" py={1.5} px={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          {gameTitle} — Playing as {nickname}
        </Typography>
      </Box>
      <Box
        flex={1}
        display="flex"
        flexDirection={{ xs: 'column', md: 'row' }}
        gap={2}
        p={2}
        alignItems={{ xs: 'center', md: 'flex-start' }}
      >
        <Box flex={1} display="flex" alignItems="center" justifyContent="center">
          <CardGrid
            board={board}
            rows={gameState.rows ?? 4}
            cols={gameState.cols ?? 4}
            onCardClick={handleCardClick}
            disabled={board.filter((c) => c.state === 'face_up').length >= 2}
          />
        </Box>
        <SolvedPile
          matchedPairs={gameState.matchedPairs ?? 0}
          totalPairs={gameState.totalPairs ?? 0}
          showFlipBack={gameState.flipBackDelay === 0 && board.filter((c) => c.state === 'face_up').length >= 2}
          onFlipBack={() => socketRef.current?.emit('cards:flip_back_manual')}
        />
      </Box>
    </Box>
  );
}
