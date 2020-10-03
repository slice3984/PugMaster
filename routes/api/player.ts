import express from 'express';
import playerController from '../../controllers/player';

const router = express.Router();

router.post('/player', (req: express.Request, res: express.Response) => {
    playerController(req, res);
});

export default router;