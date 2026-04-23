import { Router, type IRouter, type Request, type Response } from "express";

// แก้ไขโดยการระบุ Interface แทนการนำเข้าจาก @workspace เพื่อเลี่ยงปัญหา Path Alias ในช่วง Build
interface IHealthResponse {
  status: string;
  timestamp?: string;
}

const router: IRouter = Router();

/**
 * @route   GET /healthz
 * @desc    Check API Health Status
 */
router.get("/healthz", (_req: Request, res: Response) => {
  // สร้างโครงสร้างข้อมูลโดยตรงเพื่อให้แน่ใจว่าไม่มี Error จาก Zod ถ้า Library ไม่พร้อม
  const data: IHealthResponse = { 
    status: "ok",
    timestamp: new Date().toISOString()
  };
  
  res.status(200).json(data);
});

export default router;
