import { Router } from 'express';
import { verifyToken } from './auth';

const apiRouter = Router();

// Mount sub-routers
import { visitorRouter } from './visitor';
import { adminRouter } from './admin';
import { authRouter } from './auth';
import { experienceRouter } from './experience';
import { operationsRouter } from './operations';

apiRouter.use('/auth', authRouter);
apiRouter.use('/visitor', visitorRouter);
apiRouter.use('/visitor', experienceRouter);
apiRouter.use('/admin', verifyToken, adminRouter);
apiRouter.use('/admin', verifyToken, operationsRouter);

export { apiRouter };
