import { Express, Request, Response } from "express";
import { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execFile, exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// Upload directories
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "outputs");
[UPLOAD_DIR, OUTPUT_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// Multer setup — accept PDFs and images
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const COMPANY = {
  email: "admin@snappylandscaping.com",
  phone: "(717) 449-6660",
  website: "snappylandscaping.com",
};

const PYTHON = process.env.PYTHON_CMD || "python3";
const SCRIPTS_DIR = path.join(__dirname);

export async function registerRoutes(httpServer: Server, app: Express) {
  // ── Parse estimate PDF ────────────────────────────────────────────────────
  app.post(
    "/api/parse-estimate",
    upload.single("estimate"),
    async (req: Request, res: Response) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const pdfPath = req.file.path;
      try {
        const { stdout, stderr } = await execFileAsync(PYTHON, [
          path.join(SCRIPTS_DIR, "parse_estimate.py"),
          pdfPath,
        ]);
        if (stderr) console.warn("parse_estimate stderr:", stderr);
        const parsed = JSON.parse(stdout);
        res.json({ success: true, data: parsed, tempPath: pdfPath });
      } catch (err: any) {
        console.error("parse error:", err);
        res.status(500).json({ error: String(err.message || err) });
      }
    }
  );

  // ── Upload images ─────────────────────────────────────────────────────────
  app.post(
    "/api/upload-images",
    upload.array("images", 20),
    async (req: Request, res: Response) => {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No images uploaded" });
      }
      const paths = files.map((f) => ({
        path: f.path,
        originalName: f.originalname,
        mimetype: f.mimetype,
      }));
      res.json({ success: true, files: paths });
    }
  );

  // ── Generate proposal ─────────────────────────────────────────────────────
  app.post("/api/generate-proposal", async (req: Request, res: Response) => {
    const body = req.body;
    const proposalId = uuidv4();
    const outputPath = path.join(OUTPUT_DIR, `${proposalId}.pdf`);

    // Build data object for the generator
    const data = {
      client_name: body.clientName || "",
      client_address: body.clientAddress || "",
      client_phone: body.clientPhone || "",
      estimate_number: body.estimateNumber || "",
      estimate_total: body.estimateTotal || "",
      subtotal: body.subtotal || "",
      tax: body.tax || "",
      payment_schedule: body.paymentSchedule || [],
      scope_items: body.scopeItems || [],
      before_photos: body.beforePhotos || [],
      after_photos: body.afterPhotos || [],
      concept_image: body.conceptImage || null,
      cover_image: body.coverImage || null,
      project_vision: body.projectVision || "",
      vision_goals: body.visionGoals || [],
      existing_issues_text: body.existingIssuesText || "",
      concept_text: body.conceptText || "",
      materials: body.materials || [],
      investment_includes: body.investmentIncludes || [],
      why_points: body.whyPoints || [],
      next_steps: body.nextSteps || [],
      closing: body.closing || "",
    };

    // Save input to temp JSON
    const inputJson = path.join(UPLOAD_DIR, `${proposalId}_input.json`);
    fs.writeFileSync(
      inputJson,
      JSON.stringify({ data, company: COMPANY }, null, 2)
    );

    // Create DB record
    storage.createProposal({
      id: proposalId,
      clientName: data.client_name,
      clientAddress: data.client_address,
      clientPhone: data.client_phone,
      estimateNumber: data.estimate_number,
      estimateTotal: data.estimate_total,
      subtotal: data.subtotal,
      tax: data.tax,
      paymentSchedule: JSON.stringify(data.payment_schedule),
      scopeItems: JSON.stringify(data.scope_items),
      createdAt: Date.now(),
    });

    // Mark generating
    storage.updateProposalStatus(proposalId, "generating");

    // Run generator async
    execFileAsync(PYTHON, [
      path.join(SCRIPTS_DIR, "generate_proposal.py"),
      inputJson,
      outputPath,
    ])
      .then(({ stdout, stderr }) => {
        if (stderr) console.warn("generate stderr:", stderr);
        storage.updateProposalStatus(proposalId, "done", outputPath);
        // Cleanup input json
        fs.unlink(inputJson, () => {});
      })
      .catch((err) => {
        console.error("generate error:", err);
        storage.updateProposalStatus(proposalId, "error", undefined, String(err));
      });

    res.json({ success: true, proposalId });
  });

  // ── Poll status ───────────────────────────────────────────────────────────
  app.get("/api/proposal/:id/status", (req: Request, res: Response) => {
    const p = storage.getProposal(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({
      status: p.status,
      pdfPath: p.pdfPath,
      errorMessage: p.errorMessage,
    });
  });

  // ── Download PDF ──────────────────────────────────────────────────────────
  app.get("/api/proposal/:id/download", (req: Request, res: Response) => {
    const p = storage.getProposal(req.params.id);
    if (!p || p.status !== "done" || !p.pdfPath) {
      return res.status(404).json({ error: "PDF not ready" });
    }
    const clientName = p.clientName.replace(/[^a-zA-Z0-9\s]/g, "").trim() || "Proposal";
    const filename = `Snappy_Proposal_${clientName}_${p.estimateNumber}.pdf`;
    res.download(p.pdfPath, filename);
  });

  // ── List proposals ─────────────────────────────────────────────────────────
  app.get("/api/proposals", (_req: Request, res: Response) => {
    const list = storage.listProposals().map((p) => ({
      id: p.id,
      clientName: p.clientName,
      estimateNumber: p.estimateNumber,
      estimateTotal: p.estimateTotal,
      status: p.status,
      createdAt: p.createdAt,
    }));
    res.json(list);
  });
}
