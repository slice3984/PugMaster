import express from 'express';
import playerSearchController from '../../controllers/playerSearch';

const router = express.Router();

router.post('/player-search', (req: express.Request, res: express.Response) => {
    playerSearchController(req, res);
});

export default router;