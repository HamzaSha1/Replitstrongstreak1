import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scanSplitRouter from "./scan-split";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scanSplitRouter);

export default router;
