import { Router } from 'express';
import search from './search';
import info from './info';
import guildInfo from './guildInfo';
import pickup from './pickup';

const router = Router();
router.use(search);
router.use(info);
router.use(guildInfo);
router.use(pickup);

export default router;