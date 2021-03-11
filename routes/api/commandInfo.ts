import express from 'express';
import commandInfoController from '../../controllers/commandInfo';

const router = express.Router();

router.post('/commandinfo', (req: express.Request, res: express.Response) => {
    commandInfoController(req, res);
});

export default router;