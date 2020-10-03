import express from 'express';
import playedPickupsController from '../../controllers/playedPickups';

const router = express.Router();

router.post('/played-pickups', (req: express.Request, res: express.Response) => {
    playedPickupsController(req, res);
});

export default router;