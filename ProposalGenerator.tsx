import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { useToast } from "./use-toast";
import { apiRequest } from "./queryClient";

const API_BASE = ""; // Express serves frontend + backend on same port
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Separator } from "./separator";
import {
  Upload, FileText, Image, CheckCircle2, Loader2, Download,
  Trash2, ChevronRight, History, Leaf, Phone, Mail, X
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParsedEstimate {
  client_name: string;
  client_address: string;
  client_phone: string;
  estimate_number: string;
  estimate_total: string;
  subtotal: string;
  tax: string;
  payment_schedule: { name: string; amount: string; due: string }[];
  scope_items: { description: string; quantity: string; price: string; phase: string }[];
  tempPath?: string;
}

interface UploadedFile { path: string; originalName: string; mimetype: string; }

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  const labels = ["Estimate", "Photos", "Review & Generate"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const idx = i + 1;
        const state = idx < current ? "done" : idx === current ? "active" : "inactive";
        return (
          <div key={idx} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-[64px]">
              <div className={`step-dot ${state}`}>
                {state === "done" ? <CheckCircle2 size={16} /> : idx}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                state === "active" ? "text-primary" : "text-muted-foreground"
              }`}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 mx-1 transition-colors ${
                idx < current ? "bg-primary" : "bg-border"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Dropzone ──────────────────────────────────────────────────────────────────
function DropZone({
  onFiles, accept, label, sublabel, icon: Icon, disabled
}: {
  onFiles: (files: File[]) => void;
  accept: string;
  label: string;
  sublabel?: string;
  icon: any;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }, [onFiles]);
  return (
    <div
      className={`drop-zone ${dragging ? "drag-over" : ""} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      data-testid="drop-zone"
    >
      <input ref={ref} type="file" accept={accept} multiple hidden
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))} />
      <Icon className="mx-auto mb-3 text-muted-foreground" size={32} />
      <p className="font-semibold text-sm">{label}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}

// ── Image thumbnails ───────────────────────────────────────────────────────────
function Thumbs({ files, onRemove, label }: {
  files: File[]; onRemove: (i: number) => void; label: string;
}) {
  if (!files.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label} ({files.length})</p>
      <div className="thumb-grid">
        {files.map((f, i) => (
          <div key={i} className="relative group rounded-lg overflow-hidden border border-border aspect-square">
            <img src={URL.createObjectURL(f)} alt={f.name}
              className="w-full h-full object-cover" />
            <button
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`remove-image-${i}`}
            >
              <X size={12} />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">
              {f.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scope Items Display ───────────────────────────────────────────────────────
function ScopePreview({ items }: { items: ParsedEstimate["scope_items"] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground italic">No scope items parsed.</p>;
  // Group by phase
  const phases: Record<string, typeof items> = {};
  const ungrouped: typeof items = [];
  items.forEach(item => {
    if (item.phase) phases[item.phase] = [...(phases[item.phase] || []), item];
    else ungrouped.push(item);
  });

  const renderGroup = (title: string, group: typeof items) => (
    <div key={title} className="mb-3">
      {title && (
        <div className="bg-primary/10 border border-primary/20 rounded-md px-3 py-1.5 mb-1.5">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">{title}</p>
        </div>
      )}
      {group.map((item, i) => (
        <div key={i} className="scope-row">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
          </div>
          {item.quantity && (
            <span className="text-xs text-muted-foreground shrink-0">qty: {item.quantity}</span>
          )}
          {item.price && (
            <span className="text-xs font-semibold text-primary shrink-0">{item.price}</span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
      {Object.entries(phases).map(([ph, items]) => renderGroup(ph, items))}
      {ungrouped.length > 0 && renderGroup("", ungrouped)}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProposalGenerator() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedEstimate | null>(null);

  // Editable client fields
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [estimateNumber, setEstimateNumber] = useState("");
  const [estimateTotal, setEstimateTotal] = useState("");

  // Step 2 state
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [conceptFile, setConceptFile] = useState<File | null>(null);
  const [uploadedBefore, setUploadedBefore] = useState<UploadedFile[]>([]);
  const [uploadedAfter, setUploadedAfter] = useState<UploadedFile[]>([]);
  const [uploadedConcept, setUploadedConcept] = useState<UploadedFile | null>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [proposalStatus, setProposalStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Parse estimate ──────────────────────────────────────────────────────────
  const parseEstimate = async (file: File) => {
    setParsing(true);
    const form = new FormData();
    form.append("estimate", file);
    try {
      const res = await fetch(`${API_BASE}/api/parse-estimate`, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const isHtml = text.trim().startsWith("<");
        throw new Error(
          isHtml
            ? "Could not reach the server. Make sure you're using the correct app link."
            : `Server error (${res.status})`
        );
      }
      let json: any;
      try {
        json = await res.json();
      } catch {
        throw new Error("Server returned an unexpected response. Please try again.");
      }
      if (!json.success) throw new Error(json.error || "Parse failed");
      const d: ParsedEstimate = { ...json.data, tempPath: json.tempPath };
      setParsed(d);
      // Clean up common bad parse artifacts
      const rawName = d.client_name || "";
      const cleanName = /page \d/i.test(rawName) ? "" : rawName;
      setClientName(cleanName);
      setClientAddress(d.client_address);
      setClientPhone(d.client_phone);
      setEstimateNumber(d.estimate_number);
      setEstimateTotal(d.estimate_total);
      toast({ title: "Estimate parsed", description: `Found ${d.scope_items.length} line items — review the details below.` });
    } catch (err: any) {
      toast({ title: "Could not parse estimate", description: err.message, variant: "destructive" });
      setEstimateFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleEstimateFiles = (files: File[]) => {
    const pdf = files.find(f => f.name.endsWith(".pdf"));
    if (!pdf) { toast({ title: "Please upload a PDF file", variant: "destructive" }); return; }
    setEstimateFile(pdf);
    parseEstimate(pdf);
  };

  // ── Upload images ────────────────────────────────────────────────────────────
  const uploadImages = async (files: File[], type: "before" | "after" | "concept") => {
    const form = new FormData();
    files.forEach(f => form.append("images", f));
    try {
      const res = await fetch(`${API_BASE}/api/upload-images`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      let json: any;
      try { json = await res.json(); } catch { throw new Error("Unexpected server response"); }
      if (!json.success) throw new Error(json.error);
      if (type === "before") setUploadedBefore(prev => [...prev, ...json.files]);
      else if (type === "after") setUploadedAfter(prev => [...prev, ...json.files]);
      else if (type === "concept") setUploadedConcept(json.files[0]);
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    }
  };

  const handleBeforeFiles = (files: File[]) => {
    setBeforeFiles(prev => [...prev, ...files]);
    uploadImages(files, "before");
  };
  const handleAfterFiles = (files: File[]) => {
    setAfterFiles(prev => [...prev, ...files]);
    uploadImages(files, "after");
  };
  const handleConceptFiles = (files: File[]) => {
    setConceptFile(files[0]);
    uploadImages([files[0]], "concept");
  };

  // ── Generate ──────────────────────────────────────────────────────────────────
  const generate = async () => {
    if (!parsed) return;
    setGenerating(true);
    setProposalStatus("generating");
    try {
      const payload = {
        clientName,
        clientAddress,
        clientPhone,
        estimateNumber,
        estimateTotal,
        subtotal: parsed.subtotal,
        tax: parsed.tax,
        paymentSchedule: parsed.payment_schedule,
        scopeItems: parsed.scope_items,
        beforePhotos: uploadedBefore.map(f => f.path),
        afterPhotos: uploadedAfter.map(f => f.path),
        conceptImage: uploadedConcept?.path || null,
        coverImage: uploadedConcept?.path || null,
      };
      const res = await apiRequest("POST", "/api/generate-proposal", payload);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      let json: any;
      try { json = await res.json(); } catch { throw new Error("Unexpected server response"); }
      if (!json.proposalId) throw new Error("No proposal ID returned");
      setProposalId(json.proposalId);
      pollStatus(json.proposalId);
    } catch (err: any) {
      setProposalStatus("error");
      setErrorMsg(err.message);
      setGenerating(false);
    }
  };

  const pollStatus = (id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/proposal/${id}/status`);
        const json = await res.json();
        if (json.status === "done") {
          clearInterval(pollRef.current!);
          setProposalStatus("done");
          setGenerating(false);
          setStep(3);
        } else if (json.status === "error") {
          clearInterval(pollRef.current!);
          setProposalStatus("error");
          setErrorMsg(json.errorMessage || "Generation failed");
          setGenerating(false);
        }
      } catch {}
    }, 2000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setStep(1); setEstimateFile(null); setParsed(null);
    setClientName(""); setClientAddress(""); setClientPhone("");
    setEstimateNumber(""); setEstimateTotal("");
    setBeforeFiles([]); setAfterFiles([]); setConceptFile(null);
    setUploadedBefore([]); setUploadedAfter([]); setUploadedConcept(null);
    setGenerating(false); setProposalId(null); setProposalStatus("idle"); setErrorMsg("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Leaf size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Snappy Landscaping
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">Proposal Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/history">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" data-testid="nav-history">
                <History size={14} />
                <span className="hidden sm:inline">History</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <StepBar current={step} total={3} />

        {/* ── STEP 1: Upload Estimate ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Upload Estimate PDF</h2>
              <p className="text-sm text-muted-foreground">
                Drop your Snappy estimate and we'll pull out all the client info and line items automatically.
              </p>
            </div>

            {!estimateFile ? (
              <DropZone
                onFiles={handleEstimateFiles}
                accept=".pdf"
                label="Drop your estimate PDF here"
                sublabel="or click to browse — .pdf only"
                icon={FileText}
              />
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <FileText className="text-primary shrink-0" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{estimateFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(estimateFile.size / 1024).toFixed(0)} KB</p>
                </div>
                {parsing ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    Parsing…
                  </div>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 size={12} className="mr-1" /> Parsed
                  </Badge>
                )}
                <button onClick={() => { setEstimateFile(null); setParsed(null); }}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Parsed client info — editable */}
            {parsed && !parsing && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Client Information</CardTitle>
                  <p className="text-xs text-muted-foreground">Review and correct any details below.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs" htmlFor="clientName">Client Name</Label>
                      <Input id="clientName" value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="e.g. Blanca" data-testid="input-client-name" />
                    </div>
                    <div>
                      <Label className="text-xs" htmlFor="clientPhone">Phone</Label>
                      <Input id="clientPhone" value={clientPhone}
                        onChange={e => setClientPhone(e.target.value)}
                        placeholder="(717) 000-0000" data-testid="input-client-phone" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs" htmlFor="clientAddress">Address</Label>
                      <Input id="clientAddress" value={clientAddress}
                        onChange={e => setClientAddress(e.target.value)}
                        placeholder="123 Main St, Lancaster, PA" data-testid="input-client-address" />
                    </div>
                    <div>
                      <Label className="text-xs" htmlFor="estNumber">Estimate #</Label>
                      <Input id="estNumber" value={estimateNumber}
                        onChange={e => setEstimateNumber(e.target.value)}
                        data-testid="input-estimate-number" />
                    </div>
                    <div>
                      <Label className="text-xs" htmlFor="estTotal">Total</Label>
                      <Input id="estTotal" value={estimateTotal}
                        onChange={e => setEstimateTotal(e.target.value)}
                        data-testid="input-estimate-total" />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-semibold mb-2">Scope of Work
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({parsed.scope_items.length} items found)
                      </span>
                    </p>
                    <ScopePreview items={parsed.scope_items} />
                  </div>

                  {parsed.payment_schedule.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-semibold mb-2">Payment Schedule</p>
                        <div className="space-y-1.5">
                          {parsed.payment_schedule.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                              <span className="text-foreground">{p.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{p.due}</span>
                                <span className="font-semibold text-primary">{p.amount}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!parsed || parsing || !clientName}
                className="gap-2"
                data-testid="btn-next-step1"
              >
                Next: Add Photos <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Photos ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Add Photos</h2>
              <p className="text-sm text-muted-foreground">
                Upload before photos, after photos, and an optional concept render.
                Before photos are required; others are optional but make the proposal much stronger.
              </p>
            </div>

            {/* Before photos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Required</Badge>
                  Before Photos
                </CardTitle>
                <p className="text-xs text-muted-foreground">Current site conditions — the problem you're solving</p>
              </CardHeader>
              <CardContent>
                <DropZone
                  onFiles={handleBeforeFiles}
                  accept="image/*"
                  label="Drop before photos here"
                  sublabel="JPG, PNG, HEIC — multiple allowed"
                  icon={Image}
                />
                <Thumbs files={beforeFiles} onRemove={i => setBeforeFiles(prev => prev.filter((_, j) => j !== i))} label="Before" />
              </CardContent>
            </Card>

            {/* Concept render */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-900/20">Optional</Badge>
                  Concept Render / Design Image
                </CardTitle>
                <p className="text-xs text-muted-foreground">AI render or design mockup — used as the cover background</p>
              </CardHeader>
              <CardContent>
                {!conceptFile ? (
                  <DropZone
                    onFiles={handleConceptFiles}
                    accept="image/*"
                    label="Drop concept render here"
                    sublabel="1 image — becomes the cover page background"
                    icon={Image}
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                    <img src={URL.createObjectURL(conceptFile)} alt="concept"
                      className="w-16 h-12 object-cover rounded-md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conceptFile.name}</p>
                      <p className="text-xs text-muted-foreground">Cover image</p>
                    </div>
                    <button onClick={() => { setConceptFile(null); setUploadedConcept(null); }}
                      className="text-muted-foreground hover:text-destructive">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* After photos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-900/20">Optional</Badge>
                  After / Completed Work Photos
                </CardTitle>
                <p className="text-xs text-muted-foreground">Finished project photos for returning clients or portfolio pages</p>
              </CardHeader>
              <CardContent>
                <DropZone
                  onFiles={handleAfterFiles}
                  accept="image/*"
                  label="Drop after photos here"
                  sublabel="JPG, PNG, HEIC — multiple allowed"
                  icon={Image}
                />
                <Thumbs files={afterFiles} onRemove={i => setAfterFiles(prev => prev.filter((_, j) => j !== i))} label="After" />
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="btn-back-step2">Back</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={beforeFiles.length === 0}
                className="gap-2"
                data-testid="btn-next-step2"
              >
                Next: Review & Generate <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review & Generate ── */}
        {step === 3 && proposalStatus !== "done" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Review & Generate</h2>
              <p className="text-sm text-muted-foreground">Everything looks good? Hit generate and your PDF will be ready in seconds.</p>
            </div>

            {/* Summary card */}
            <Card>
              <CardContent className="pt-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-semibold">{clientName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimate #</p>
                    <p className="font-semibold">{estimateNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium text-xs">{clientAddress}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Investment</p>
                    <p className="font-bold text-primary text-base">{estimateTotal}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Before Photos</p>
                    <p className="font-medium">{beforeFiles.length} photo{beforeFiles.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Scope Items</p>
                    <p className="font-medium">{parsed?.scope_items.length || 0} items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generate button / progress */}
            {proposalStatus === "idle" && (
              <Button
                size="lg"
                className="w-full gap-2 text-base h-12"
                onClick={generate}
                disabled={generating}
                data-testid="btn-generate"
              >
                <FileText size={18} />
                Generate Decision Kit PDF
              </Button>
            )}

            {proposalStatus === "generating" && (
              <div className="rounded-xl border border-border p-6 text-center space-y-4">
                <Loader2 size={32} className="mx-auto animate-spin text-primary" />
                <div>
                  <p className="font-semibold">Building your proposal…</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Laying out {parsed?.scope_items.length} scope items, {beforeFiles.length} photos, and all client details
                  </p>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full shimmer w-2/3" />
                </div>
              </div>
            )}

            {proposalStatus === "error" && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center space-y-3">
                <p className="font-semibold text-destructive">Generation failed</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
                <Button variant="outline" onClick={() => setProposalStatus("idle")}>Try Again</Button>
              </div>
            )}

            {proposalStatus !== "generating" && (
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)} disabled={generating} data-testid="btn-back-step3">Back</Button>
              </div>
            )}
          </div>
        )}

        {/* ── DONE ── */}
        {step === 3 && proposalStatus === "done" && proposalId && (
          <div className="space-y-6 text-center">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold">Your Decision Kit is Ready!</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                A professional {estimateTotal} proposal for {clientName} — ready to send.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={`${API_BASE}/api/proposal/${proposalId}/download`} download>
                <Button size="lg" className="gap-2 w-full sm:w-auto" data-testid="btn-download">
                  <Download size={18} />
                  Download PDF
                </Button>
              </a>
              <Button variant="outline" size="lg" onClick={reset} className="gap-2 w-full sm:w-auto" data-testid="btn-new-proposal">
                <FileText size={18} />
                New Proposal
              </Button>
            </div>

            <Card className="text-left mt-4">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Summary</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Client</p><p className="font-semibold">{clientName}</p></div>
                  <div><p className="text-xs text-muted-foreground">Estimate</p><p className="font-semibold">{estimateNumber}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-primary">{estimateTotal}</p></div>
                  <div><p className="text-xs text-muted-foreground">Photos</p><p className="font-medium">{beforeFiles.length} before · {afterFiles.length} after</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-4">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Phone size={11} /> (717) 449-6660</span>
            <span className="flex items-center gap-1"><Mail size={11} /> admin@snappylandscaping.com</span>
          </div>
          <span>Snappy Landscaping — Proposal Generator</span>
        </div>
      </footer>
    </div>
  );
}
