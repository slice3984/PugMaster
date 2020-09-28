import express from 'express';
import pickupCountController from '../../controllers/pickupCount';
import pickupInfoController from '../../controllers/pickupInfo';
import pickupsController from '../../controllers/pickups';
import pickupRowNumController from '../../controllers/pickupRowNum';

const router = express.Router();

router.post('/pickup-count', (req: express.Request, res: express.Response) => {
    pickupCountController(req, res);
});

router.post('/pickup-info', (req: express.Request, res: express.Response) => {
    pickupInfoController(req, res);
});

router.post('/pickups', (req: express.Request, res: express.Response) => {
    pickupsController(req, res);
})

router.post('/pickup-row-num', (req: express.Request, res: express.Response) => {
    pickupRowNumController(req, res);
});

export default router;