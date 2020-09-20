import { Router } from 'express';
import search from './search';
import info from './info';
import guildInfo from './guildInfo';

const router = Router();
router.use(search);
router.use(info);
router.use(guildInfo);

export default router;